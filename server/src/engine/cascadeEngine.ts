/**
 * Cascade engine.
 *
 * Answers exactly one question: *if nobody does anything*, what does this
 * disruption break? It never proposes fixes — that is the recovery planner's
 * job — it only propagates consequences through the dependency graph and
 * labels each downstream booking.
 */
import type {
  CascadeResult,
  Disruption,
  NodeImpact,
  NodeKind,
  NodeStatus,
  Trip,
  TripEdge,
  TripNode,
} from '../types.js';
import { TripGraph, readyTime } from './graph.js';
import { clock, durationMinutes, local, ms, MINUTE, prettyDate, toIso, offsetOf } from './time.js';
import { transportOptions } from '../data/index.js';

export interface Projection {
  nodeId: string;
  start: string;
  end: string;
  /** When this booking releases you to whatever it ENABLES (hotel: check-in). */
  ready: string;
  /** When it releases you to whatever REQUIRES it (hotel: check-out). */
  readyOut: string;
  status: NodeStatus;
  delayMinutes: number;
  reason: string;
  hops: number;
  causeId?: string;
}

export function formatDelay(minutes: number): string {
  const abs = Math.abs(Math.round(minutes));
  if (abs < 60) return `${abs}m`;
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  if (h >= 24 && m === 0 && h % 24 === 0) return `${h / 24 === 1 ? '24h' : `${h}h`}`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

/**
 * How far the disrupted booking itself moves.
 *
 * A cancellation has no delay of its own, so we price it as the wait until the
 * earliest seeded replacement — that is what actually lands on the traveller.
 */
function sourceShiftMinutes(node: TripNode, disruption: Disruption): number {
  if (disruption.type === 'FLIGHT_DELAYED' || disruption.type === 'SCHEDULE_CHANGED') {
    return disruption.delayMinutes;
  }
  if (disruption.type === 'FLIGHT_CANCELLED' || disruption.type === 'TRAIN_MISSED') {
    const replacements = transportOptions
      .filter((t) => t.replacesNodeId === node.id && ms(t.arrive) > ms(node.end))
      .sort((a, b) => ms(a.arrive) - ms(b.arrive));
    if (replacements.length) return Math.round((ms(replacements[0].arrive) - ms(node.end)) / MINUTE);
    return 24 * 60;
  }
  if (disruption.type === 'TRANSFER_FAILED') {
    // You still have to get there — assume a self-arranged replacement.
    return durationMinutes(node.start, node.end) + 45;
  }
  return disruption.delayMinutes;
}

function sourceStatus(disruption: Disruption): NodeStatus {
  switch (disruption.type) {
    case 'FLIGHT_CANCELLED':
    case 'HOTEL_CANCELLED':
    case 'ACTIVITY_UNAVAILABLE':
      return 'CANCELLED';
    case 'TRANSFER_FAILED':
    case 'TRAIN_MISSED':
      return 'MISSED';
    case 'WEATHER':
      return 'CANCELLED';
    default:
      return 'DISRUPTED';
  }
}

const BROKEN: NodeStatus[] = ['MISSED', 'CANCELLED'];
const SCHEDULED = new Set<NodeKind>(['FLIGHT', 'TRAIN', 'BUS']);

/**
 * An overrunning activity does not delay a departing flight — the flight leaves
 * on time and the activity is what gets cut. Edges like "tour must end 3h
 * before EK073" encode a constraint, not causality, so the forward pass skips
 * them and `applyBackwardConstraints` resolves them in the honest direction.
 */
function activityYields(predecessor: TripNode, successor: TripNode): boolean {
  if (predecessor.kind !== 'ACTIVITY') return false;
  return SCHEDULED.has(successor.kind) || !successor.flexibility.canMove;
}

/** "HH:mm" opening bound as an instant on the same local day as `ref`. */
function boundOn(ref: string, hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  const l = local(ref);
  const off = offsetOf(ref);
  return Date.UTC(l.year, l.month - 1, l.date, h, m) - off * MINUTE;
}

/**
 * Classify one node given the earliest instant the traveller can actually
 * reach it. Returns the projected times plus a human reason.
 */
function classify(
  node: TripNode,
  requiredStartMs: number,
  cause: TripNode,
  causeBroken: boolean,
): { status: NodeStatus; start: string; end: string; ready: string; readyOut: string; reason: string } {
  const originalStart = ms(node.start);
  const duration = durationMinutes(node.start, node.end);
  const deficit = Math.round((requiredStartMs - originalStart) / MINUTE);
  const off = offsetOf(node.start);
  const projStart = toIso(Math.max(requiredStartMs, originalStart), off);
  const projEnd = toIso(Math.max(requiredStartMs, originalStart) + duration * MINUTE, offsetOf(node.end));

  if (deficit <= 0 && !causeBroken) {
    return {
      status: 'SAFE',
      start: node.start,
      end: node.end,
      ready: readyTime(node),
      readyOut: node.end,
      reason: 'Unaffected — the disruption resolves before this booking needs you.',
    };
  }

  const slack = node.flexibility.slackMinutes;

  if (node.kind === 'HOTEL') {
    const checkoutMs = ms(node.end);
    const lostStay = requiredStartMs >= checkoutMs - 60 * MINUTE;
    if (lostStay) {
      return {
        status: 'CANCELLED',
        start: toIso(requiredStartMs, off),
        end: node.end,
        ready: toIso(requiredStartMs, off),
        readyOut: node.end,
        reason: `You now reach ${node.location?.name ?? 'the hotel'} at ${clock(
          toIso(requiredStartMs, off),
        )} on ${prettyDate(toIso(requiredStartMs, off))}, after the ${clock(node.end)} checkout. The whole stay is lost.`,
      };
    }
    const late = local(toIso(requiredStartMs, off)).hour >= 23 || local(toIso(requiredStartMs, off)).hour < 5;
    return {
      status: late ? 'AFFECTED' : deficit <= slack ? 'AT_RISK' : 'AFFECTED',
      start: toIso(requiredStartMs, off),
      end: node.end,
      ready: toIso(requiredStartMs, off),
      readyOut: node.end,
      reason: late
        ? `Check-in slips to ${clock(toIso(requiredStartMs, off))} — a late-night arrival at reception.`
        : `Check-in moves from ${clock(node.start)} to ${clock(toIso(requiredStartMs, off))}, ${formatDelay(
            deficit,
          )} later than booked.`,
    };
  }

  if (deficit > 0 && deficit <= slack) {
    return {
      status: 'AT_RISK',
      start: projStart,
      end: projEnd,
      ready: projEnd,
      readyOut: projEnd,
      reason: `Runs ${formatDelay(deficit)} late — inside the ${formatDelay(
        slack,
      )} of slack this booking has, but there is nothing left in reserve.`,
    };
  }

  if (node.kind === 'ACTIVITY') {
    const sameDay = local(toIso(requiredStartMs, off)).dateKey === local(node.start).dateKey;
    const closes = node.openingHours ? boundOn(node.start, node.openingHours.close) : Infinity;
    const fits = sameDay && requiredStartMs + duration * MINUTE <= closes;
    if (fits) {
      return {
        status: 'AFFECTED',
        start: projStart,
        end: projEnd,
        ready: projEnd,
        readyOut: projEnd,
        reason: `Pushed to ${clock(projStart)} — still inside opening hours, but ${formatDelay(
          deficit,
        )} later than booked.`,
      };
    }
    return {
      status: 'MISSED',
      start: node.start,
      end: node.end,
      // You didn't do it, so you are free from the moment you could have started.
      ready: toIso(requiredStartMs, off),
      readyOut: toIso(requiredStartMs, off),
      reason: sameDay
        ? `The ${clock(node.start)} slot cannot absorb ${formatDelay(deficit)} — it would run past the ${
            node.openingHours?.close ?? 'closing'
          } close.`
        : `Your booked ${clock(node.start)} slot on ${prettyDate(node.start)} goes ahead without you — ${
            cause.title
          } does not release you until ${prettyDate(toIso(requiredStartMs, off))}.`,
    };
  }

  // Transport and transfers are point departures: they leave without you.
  return {
    status: 'MISSED',
    start: node.start,
    end: node.end,
    ready: toIso(requiredStartMs + duration * MINUTE, off),
    readyOut: toIso(requiredStartMs + duration * MINUTE, off),
    reason: `Departs ${clock(node.start)} on ${prettyDate(node.start)}; you are not free until ${clock(
      toIso(requiredStartMs, off),
    )} on ${prettyDate(toIso(requiredStartMs, off))} — ${formatDelay(deficit)} too late.`,
  };
}

/**
 * A soft predecessor (an activity) must never be allowed to "delay" a booking
 * that physically cannot move, like a departing flight. In reality the
 * activity is the thing that gets cut, so we resolve the conflict backwards.
 */
function applyBackwardConstraints(
  graph: TripGraph,
  proj: Map<string, Projection>,
): void {
  for (const edge of graph.edges) {
    if (edge.type !== 'REQUIRES') continue;
    const successor = graph.node(edge.to);
    const predecessor = graph.node(edge.from);
    if (!activityYields(predecessor, successor)) continue;

    const p = proj.get(predecessor.id)!;
    if (p.status === 'SAFE') continue;

    const latestEnd = ms(successor.start) - edge.minGapMinutes * MINUTE;
    if (ms(p.end) <= latestEnd) continue;

    const freeFrom = ms(p.start);
    p.status = 'MISSED';
    p.start = predecessor.start;
    p.end = predecessor.end;
    p.ready = toIso(freeFrom, offsetOf(predecessor.start));
    p.readyOut = p.ready;
    p.reason = `Would have to end by ${clock(
      toIso(latestEnd, offsetOf(successor.start)),
    )} to keep ${successor.title} — it can no longer start early enough to fit.`;
  }
}

export function runCascade(trip: Trip, disruption: Disruption): CascadeResult {
  const graph = TripGraph.of(trip);
  const source = graph.node(disruption.nodeId);
  const proj = new Map<string, Projection>();

  for (const node of trip.nodes) {
    proj.set(node.id, {
      nodeId: node.id,
      start: node.start,
      end: node.end,
      ready: readyTime(node),
      readyOut: node.end,
      status: node.status === 'COMPLETED' ? 'COMPLETED' : 'SAFE',
      delayMinutes: 0,
      reason: 'Unaffected by this disruption.',
      hops: 0,
    });
  }

  /** Which hand-off instant an edge should read from its predecessor. */
  const handoff = (p: Projection, edge: TripEdge): number =>
    graph.node(edge.from).kind === 'HOTEL' && edge.type !== 'ENABLES' ? ms(p.readyOut) : ms(p.ready);

  /* --- 1. the disrupted booking itself ------------------------------- */
  const shift = sourceShiftMinutes(source, disruption);
  const sp = proj.get(source.id)!;
  sp.status = sourceStatus(disruption);
  sp.delayMinutes = shift;
  if (BROKEN.includes(sp.status)) {
    // Cancelled/failed: the booking does not happen, but the traveller is only
    // free once the realistic replacement lands.
    sp.ready = toIso(ms(readyTime(source)) + shift * MINUTE, offsetOf(readyTime(source)));
    sp.readyOut = toIso(ms(source.end) + shift * MINUTE, offsetOf(source.end));
    sp.reason = disruption.detail;
  } else {
    sp.start = toIso(ms(source.start) + shift * MINUTE, offsetOf(source.start));
    sp.end = toIso(ms(source.end) + shift * MINUTE, offsetOf(source.end));
    sp.ready = toIso(ms(readyTime(source)) + shift * MINUTE, offsetOf(readyTime(source)));
    sp.readyOut = sp.end;
    sp.reason = `${disruption.headline} — now landing ${clock(sp.end)} on ${prettyDate(sp.end)}.`;
  }

  /* --- 2. forward propagation --------------------------------------- */
  for (const node of graph.topological()) {
    if (node.id === source.id) continue;
    const p = proj.get(node.id)!;
    if (p.status === 'COMPLETED') continue;

    let requiredStart = -Infinity;
    let cause: TripEdge | null = null;
    let causeBroken = false;

    for (const edge of graph.incoming(node.id)) {
      const upstream = proj.get(edge.from)!;
      const untouched = upstream.status === 'SAFE' && upstream.delayMinutes === 0;
      if (untouched) continue;
      if (activityYields(graph.node(edge.from), node)) continue;
      const candidate = handoff(upstream, edge) + edge.minGapMinutes * MINUTE;
      if (candidate > requiredStart) {
        requiredStart = candidate;
        cause = edge;
        causeBroken = BROKEN.includes(upstream.status) && edge.type !== 'SEQUENCE';
      }
    }

    if (!cause) continue;

    const causeNode = graph.node(cause.from);
    const result = classify(node, requiredStart, causeNode, causeBroken);
    p.status = result.status;
    p.start = result.start;
    p.end = result.end;
    p.ready = result.ready;
    p.readyOut = result.readyOut;
    p.reason = result.reason;
    p.causeId = cause.from;
    p.delayMinutes = Math.round((ms(result.start) - ms(node.start)) / MINUTE);
    p.hops = (proj.get(cause.from)?.hops ?? 0) + 1;
  }

  applyBackwardConstraints(graph, proj);

  /* --- 3. shape the result ------------------------------------------ */
  const impacts: NodeImpact[] = trip.nodes.map((node) => {
    const p = proj.get(node.id)!;
    return {
      nodeId: node.id,
      title: node.title,
      kind: node.kind,
      status: node.id === source.id ? p.status : p.status,
      previousStatus: node.status,
      originalStart: node.start,
      projectedStart: p.status === 'SAFE' ? node.start : p.start,
      delayMinutes: p.delayMinutes,
      chain: node.id === source.id ? [node.id] : graph.path(source.id, node.id),
      reason: p.reason,
      hops: p.hops,
    };
  });

  const downstream = impacts.filter((i) => i.nodeId !== source.id && i.status !== 'SAFE' && i.status !== 'COMPLETED');
  const activities = impacts.filter((i) => i.kind === 'ACTIVITY');
  const lost = activities.filter((i) => BROKEN.includes(i.status)).map((i) => i.title);
  const atRisk = activities.filter((i) => i.status === 'AT_RISK' || i.status === 'AFFECTED').map((i) => i.title);

  return {
    disruption,
    impacts,
    downstreamCount: downstream.length,
    lostExperiences: lost,
    atRiskExperiences: atRisk,
    summary:
      downstream.length === 0
        ? 'This disruption stops with the booking it hit — nothing downstream depends on it closely enough to break.'
        : `1 disruption → ${downstream.length} downstream ${
            downstream.length === 1 ? 'impact' : 'impacts'
          }${lost.length ? `, ${lost.length} ${lost.length === 1 ? 'experience' : 'experiences'} lost` : ''}.`,
    computedAt: new Date().toISOString(),
  };
}

/** Apply a cascade's projected statuses onto a trip (used for the live view). */
export function applyCascadeToTrip(trip: Trip, cascade: CascadeResult): Trip {
  const byId = new Map(cascade.impacts.map((i) => [i.nodeId, i]));
  const nodes = trip.nodes.map((n) => {
    const impact = byId.get(n.id);
    return impact ? { ...n, status: impact.status } : n;
  });
  return { ...trip, nodes, status: 'DISRUPTED' };
}
