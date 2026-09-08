/**
 * Recovery planner.
 *
 * Deterministic, exhaustive-within-bounds search. It does NOT invent options:
 * every alternative comes from seeded inventory, and every candidate is put
 * through the validator before it can be ranked.
 *
 * Pipeline:
 *   decision variables → enumerate combinations → apply → repair → validate → score
 */
import type {
  ActivitySlot,
  CascadeResult,
  PlanChange,
  PlanMetrics,
  RecoveryAction,
  RecoveryPlan,
  RecoveryStrategy,
  StayOption,
  TransportOption,
  Trip,
  TripNode,
} from '../types.js';
import { activitySlots, stayOptions, transportOptions } from '../data/index.js';
import { TripGraph, readyTime } from './graph.js';
import { validate, type PlanDraft } from './validator.js';
import { clock, dayIndex, durationMinutes, isLateNight, local, ms, MINUTE, offsetOf, prettyDate, toIso } from './time.js';

/** Guard rail so an unusually branchy trip cannot wedge a request. */
const MAX_COMBINATIONS = 40_000;

const TRAVEL_KINDS = new Set(['FLIGHT', 'TRAIN', 'BUS', 'TRANSFER']);
const PRIORITY_WEIGHT: Record<string, number> = { MUST_DO: 3, IMPORTANT: 2, OPTIONAL: 1, FIXED: 0 };

type Choice =
  | { var: 'transport'; nodeId: string; label: string; mode: 'KEEP' | 'KEEP_DELAYED'; option?: undefined }
  | { var: 'transport'; nodeId: string; label: string; mode: 'REPLACE'; option: TransportOption }
  | { var: 'activity'; nodeId: string; label: string; mode: 'SLOT'; slot: ActivitySlot }
  | { var: 'activity'; nodeId: string; label: string; mode: 'DROP' }
  | { var: 'stay'; nodeId: string; label: string; mode: 'KEEP' | 'REPLACE'; option?: StayOption };

interface Variable {
  nodeId: string;
  choices: Choice[];
}

/* ------------------------------------------------------------------ */
/* 1. decision variables                                              */
/* ------------------------------------------------------------------ */

function buildVariables(trip: Trip, cascade: CascadeResult): Variable[] {
  const graph = TripGraph.of(trip);
  const impacted = new Set(
    cascade.impacts.filter((i) => i.status !== 'SAFE' && i.status !== 'COMPLETED').map((i) => i.nodeId),
  );
  const sourceId = cascade.disruption.nodeId;
  const source = graph.node(sourceId);
  const variables: Variable[] = [];

  /* the disrupted booking */
  if (TRAVEL_KINDS.has(source.kind)) {
    const keepable = cascade.disruption.type === 'FLIGHT_DELAYED' || cascade.disruption.type === 'SCHEDULE_CHANGED';
    const choices: Choice[] = [];
    if (keepable) {
      choices.push({
        var: 'transport',
        nodeId: sourceId,
        label: `Stay on ${source.ref ?? source.title} as rescheduled`,
        mode: 'KEEP_DELAYED',
      });
    }
    for (const option of transportOptions.filter((t) => t.replacesNodeId === sourceId)) {
      choices.push({
        var: 'transport',
        nodeId: sourceId,
        label: `Move to ${option.provider} ${option.ref}`,
        mode: 'REPLACE',
        option,
      });
    }
    if (choices.length) variables.push({ nodeId: sourceId, choices });
  } else if (source.kind === 'HOTEL') {
    const choices: Choice[] = stayOptions
      .filter((s) => s.replacesNodeId === sourceId)
      .map<Choice>((option) => ({ var: 'stay', nodeId: sourceId, label: `Rebook into ${option.name}`, mode: 'REPLACE', option }));
    if (choices.length) variables.push({ nodeId: sourceId, choices });
  }

  /* onward legs that could absorb the change */
  const downstream = graph.downstream(sourceId);
  for (const node of trip.nodes) {
    if (node.id === sourceId) continue;
    if (!TRAVEL_KINDS.has(node.kind)) continue;
    if (!downstream.has(node.id)) continue;
    const options = transportOptions.filter((t) => t.replacesNodeId === node.id);
    if (!options.length) continue;
    variables.push({
      nodeId: node.id,
      choices: [
        { var: 'transport', nodeId: node.id, label: `Keep ${node.ref ?? node.title}`, mode: 'KEEP' },
        ...options.map<Choice>((option) => ({
          var: 'transport',
          nodeId: node.id,
          label: `Move to ${option.provider} ${option.ref}`,
          mode: 'REPLACE',
          option,
        })),
      ],
    });
  }

  /* every experience that is either broken or sits downstream of a movable leg */
  const transportVarIds = new Set(variables.map((v) => v.nodeId));
  const reachable = new Set<string>();
  for (const id of transportVarIds) for (const d of graph.downstream(id).keys()) reachable.add(d);

  for (const node of trip.nodes) {
    if (node.kind !== 'ACTIVITY') continue;
    if (!impacted.has(node.id) && !reachable.has(node.id)) continue;
    const slots = activitySlots.filter((s) => s.nodeId === node.id);
    const choices: Choice[] = slots.map((slot) => ({
      var: 'activity',
      nodeId: node.id,
      label: `${node.title} on ${prettyDate(slot.start)} at ${clock(slot.start)}`,
      mode: 'SLOT',
      slot,
    }));
    if (node.priority !== 'MUST_DO' && node.priority !== 'FIXED') {
      choices.push({ var: 'activity', nodeId: node.id, label: `Let go of ${node.title}`, mode: 'DROP' });
    }
    if (choices.length) variables.push({ nodeId: node.id, choices });
  }

  return variables;
}

/* ------------------------------------------------------------------ */
/* 2. apply a combination                                             */
/* ------------------------------------------------------------------ */

function boundOn(ref: string, hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  const l = local(ref);
  return Date.UTC(l.year, l.month - 1, l.date, h, m) - offsetOf(ref) * MINUTE;
}

function dayDiff(fromIso: string, toIso_: string): number {
  const a = local(fromIso);
  const b = local(toIso_);
  return Math.round(
    (Date.UTC(b.year, b.month - 1, b.date) - Date.UTC(a.year, a.month - 1, a.date)) / (24 * 60 * MINUTE),
  );
}

/**
 * Re-time the bookings a traveller would never choose by hand: transfers follow
 * whatever they connect, and stays shrink or stretch to cover the nights that
 * are actually spent in a city.
 */
function repair(trip: Trip, graph: TripGraph, nodes: Map<string, TripNode>): void {
  const handoff = (predecessor: TripNode, edgeType: string): number =>
    predecessor.kind === 'HOTEL' && edgeType !== 'ENABLES' ? ms(predecessor.end) : ms(readyTime(predecessor));

  for (const original of graph.topological()) {
    const node = nodes.get(original.id);
    if (!node) continue;

    if (node.kind === 'TRANSFER') {
      let earliest = -Infinity;
      for (const edge of graph.incoming(node.id)) {
        if (edge.type !== 'REQUIRES' && edge.type !== 'ENABLES') continue;
        const pred = nodes.get(edge.from);
        if (!pred) continue;
        earliest = Math.max(earliest, handoff(pred, edge.type) + edge.minGapMinutes * MINUTE);
      }
      if (earliest === -Infinity) continue;
      const duration = durationMinutes(original.start, original.end);

      // Never push a transfer past something immovable that depends on it.
      let latestStart = Infinity;
      for (const edge of graph.outgoing(node.id)) {
        const succ = nodes.get(edge.to);
        if (!succ || succ.flexibility.canMove || edge.type !== 'REQUIRES') continue;
        latestStart = Math.min(latestStart, ms(succ.start) - (edge.minGapMinutes + duration) * MINUTE);
      }
      const startMs = Math.min(earliest, latestStart === Infinity ? earliest : latestStart);
      node.start = toIso(startMs, offsetOf(original.start));
      node.end = toIso(startMs + duration * MINUTE, offsetOf(original.end));
      continue;
    }

    if (node.kind === 'HOTEL') {
      const stay = stayOptions.find((s) => s.id === (node as TripNode & { optionId?: string }).optionId)
        ?? stayOptions.find((s) => s.replacesNodeId === original.id && s.provider === original.provider)
        ?? stayOptions.find((s) => s.replacesNodeId === original.id);

      let arrival = -Infinity;
      for (const edge of graph.incoming(node.id)) {
        if (edge.type !== 'REQUIRES' && edge.type !== 'ENABLES') continue;
        const pred = nodes.get(edge.from);
        if (!pred) continue;
        arrival = Math.max(arrival, handoff(pred, edge.type) + edge.minGapMinutes * MINUTE);
      }
      if (arrival === -Infinity) continue;

      const arrivalIso = toIso(arrival, offsetOf(original.start));
      // An arrival before 06:00 belongs to the previous night.
      const nightAnchor = local(arrivalIso).hour < 6 ? toIso(arrival - 12 * 60 * MINUTE, offsetOf(original.start)) : arrivalIso;
      const checkInFrom = boundOn(nightAnchor, stay?.checkInFrom ?? clock(original.start));
      const checkIn = Math.max(arrival, checkInFrom);

      const city = original.location?.city;
      const outbound = [...nodes.values()]
        .filter(
          (n) =>
            TRAVEL_KINDS.has(n.kind) &&
            n.kind !== 'TRANSFER' &&
            n.from?.city === city &&
            n.to?.city !== city &&
            ms(n.start) > checkIn,
        )
        .sort((a, b) => ms(a.start) - ms(b.start))[0];

      const checkOut = outbound
        ? Math.min(ms(outbound.start), boundOn(outbound.start, stay?.checkOutBy ?? clock(original.end)))
        : ms(original.end);

      const nights = Math.max(0, dayDiff(nightAnchor, toIso(checkOut, offsetOf(original.end))));
      if (nights === 0) {
        nodes.delete(node.id);
        continue;
      }
      const perNight =
        stay?.pricePerNight ?? Math.round(original.cost / Math.max(1, dayDiff(original.start, original.end)));
      node.start = toIso(checkIn, offsetOf(original.start));
      node.end = toIso(checkOut, offsetOf(original.end));
      node.cost = perNight * nights;
      node.subtitle = `${nights} night${nights === 1 ? '' : 's'} · ${original.location?.name ?? ''}`.trim();
    }
  }
}

function applyCombination(
  trip: Trip,
  graph: TripGraph,
  cascade: CascadeResult,
  combination: Choice[],
): PlanDraft {
  const nodes = new Map<string, TripNode>(trip.nodes.map((n) => [n.id, { ...n, status: 'SAFE' as const }]));
  const dropped = new Set<string>();
  const usedOptionIds: string[] = [];

  for (const choice of combination) {
    const node = nodes.get(choice.nodeId);
    if (!node) continue;

    if (choice.var === 'transport') {
      if (choice.mode === 'KEEP') continue;
      if (choice.mode === 'KEEP_DELAYED') {
        const shift = cascade.disruption.delayMinutes;
        node.start = toIso(ms(node.start) + shift * MINUTE, offsetOf(node.start));
        node.end = toIso(ms(node.end) + shift * MINUTE, offsetOf(node.end));
        continue;
      }
      const option = choice.option!;
      node.kind = option.kind;
      node.provider = option.provider;
      node.ref = option.ref;
      node.title = `${option.from.city} → ${option.to.city}`;
      node.subtitle = `${option.provider} · ${option.ref}`;
      node.start = option.depart;
      node.end = option.arrive;
      node.from = option.from;
      node.to = option.to;
      node.cost = option.price;
      node.refundable = option.refundable;
      node.verifiedOperator = option.verifiedOperator;
      usedOptionIds.push(option.id);
      continue;
    }

    if (choice.var === 'activity') {
      if (choice.mode === 'DROP') {
        nodes.delete(choice.nodeId);
        dropped.add(choice.nodeId);
        continue;
      }
      node.start = choice.slot.start;
      node.end = choice.slot.end;
      node.cost = choice.slot.price;
      continue;
    }

    if (choice.var === 'stay' && choice.mode === 'REPLACE' && choice.option) {
      node.provider = choice.option.provider;
      node.title = choice.option.name;
      node.location = choice.option.location;
      node.refundable = choice.option.refundable;
      (node as TripNode & { optionId?: string }).optionId = choice.option.id;
    }
  }

  repair(trip, graph, nodes);
  for (const id of trip.nodes.map((n) => n.id)) {
    if (!nodes.has(id) && !dropped.has(id)) dropped.add(id);
  }

  const ordered = [...nodes.values()].sort((a, b) => ms(a.start) - ms(b.start));
  for (const node of ordered) node.day = dayIndex(node.start, trip.startDate);

  return { nodes: ordered, droppedIds: dropped, usedOptionIds };
}

/* ------------------------------------------------------------------ */
/* 3. measure                                                         */
/* ------------------------------------------------------------------ */

/**
 * Waking time left after landing, summed over every arrival into a place that
 * is not home. Two flights of identical length are not identical trips.
 */
function usableArrivalMinutes(trip: Trip, nodes: TripNode[]): number {
  let total = 0;
  for (const leg of nodes) {
    if (!TRAVEL_KINDS.has(leg.kind) || !leg.from || !leg.to) continue;
    if (leg.from.city === leg.to.city) continue;
    if (leg.to.city === trip.origin.city) continue; // arriving home is not usable trip time
    const l = local(leg.end);
    const eveningEnd = Date.UTC(l.year, l.month - 1, l.date, 22, 0) - offsetOf(leg.end) * MINUTE;
    total += Math.max(0, Math.round((eveningEnd - ms(leg.end)) / MINUTE));
  }
  return total;
}

function measure(trip: Trip, draft: PlanDraft): PlanMetrics {
  const originals = new Map(trip.nodes.map((n) => [n.id, n]));
  let addedCost = 0;
  let refundLost = 0;
  let changeCount = 0;
  const daysTouched = new Set<number>();

  for (const node of draft.nodes) {
    const original = originals.get(node.id);
    if (!original) {
      addedCost += node.cost;
      changeCount += 1;
      daysTouched.add(node.day);
      continue;
    }
    const moved = ms(node.start) !== ms(original.start);
    const swapped = node.ref !== original.ref || node.provider !== original.provider;
    const costDelta = node.cost - original.cost;

    if (swapped) {
      const recovered = original.refundable ? (original.cost * original.refundPercent) / 100 : 0;
      addedCost += node.cost - recovered;
      refundLost += original.cost - recovered;
    } else if (costDelta > 0) {
      addedCost += costDelta;
    } else if (costDelta < 0) {
      if (original.refundable) addedCost += costDelta;
      else refundLost += -costDelta;
    }

    if (moved || swapped) {
      changeCount += 1;
      daysTouched.add(original.day);
      daysTouched.add(node.day);
    }
  }

  for (const id of draft.droppedIds) {
    const original = originals.get(id);
    if (!original) continue;
    const recovered = original.refundable ? (original.cost * original.refundPercent) / 100 : 0;
    addedCost -= recovered;
    refundLost += original.cost - recovered;
    changeCount += 1;
    daysTouched.add(original.day);
  }

  const activities = trip.nodes.filter((n) => n.kind === 'ACTIVITY');
  const kept = activities.filter((a) => draft.nodes.some((n) => n.id === a.id));
  const totalValue = activities.reduce((s, a) => s + (PRIORITY_WEIGHT[a.priority] ?? 1), 0);
  const keptValue = kept.reduce((s, a) => s + (PRIORITY_WEIGHT[a.priority] ?? 1), 0);

  const travelBefore = trip.nodes
    .filter((n) => TRAVEL_KINDS.has(n.kind))
    .reduce((s, n) => s + durationMinutes(n.start, n.end), 0);
  const travelAfter = draft.nodes
    .filter((n) => TRAVEL_KINDS.has(n.kind))
    .reduce((s, n) => s + durationMinutes(n.start, n.end), 0);

  const perDay = new Map<number, number>();
  for (const node of draft.nodes) {
    if (!TRAVEL_KINDS.has(node.kind)) continue;
    perDay.set(node.day, (perDay.get(node.day) ?? 0) + durationMinutes(node.start, node.end));
  }

  // Only count late arrivals a plan could have avoided. The return leg lands at
  // 01:50 whatever we do, and charging every plan for it flattens the safety
  // axis into noise.
  const lateNightArrivals = draft.nodes.filter((n) => {
    if (!TRAVEL_KINDS.has(n.kind) && n.kind !== 'HOTEL') return false;
    if (!n.flexibility.canMove) return false;
    return isLateNight(n.kind === 'HOTEL' ? n.start : n.end);
  }).length;

  const usableBefore = usableArrivalMinutes(trip, trip.nodes);
  const usableAfter = usableArrivalMinutes(trip, draft.nodes);

  return {
    addedCost: Math.round(addedCost),
    addedTravelMinutes: travelAfter - travelBefore,
    usableArrivalMinutes: usableAfter,
    usableMinutesLost: usableBefore - usableAfter,
    experiencesPreserved: kept.length,
    experiencesTotal: activities.length,
    experienceValuePreserved: totalValue ? keptValue / totalValue : 1,
    changeCount,
    lateNightArrivals,
    maxTravelHoursInADay: Math.max(0, ...perDay.values()) / 60,
    daysAffected: daysTouched.size,
    refundLost: Math.round(refundLost),
  };
}

function describeChanges(trip: Trip, draft: PlanDraft): PlanChange[] {
  const byId = new Map(draft.nodes.map((n) => [n.id, n]));
  const changes: PlanChange[] = [];

  for (const original of trip.nodes) {
    const now = byId.get(original.id);
    if (!now) {
      changes.push({
        nodeId: original.id,
        title: original.title,
        kind: original.kind,
        changeType: 'DROPPED',
        before: `${prettyDate(original.start)} · ${clock(original.start)}`,
        after: null,
        costDelta: original.refundable ? -Math.round((original.cost * original.refundPercent) / 100) : 0,
        explanation:
          original.priority === 'OPTIONAL'
            ? `Let go of ${original.title} — it was the lowest-priority item competing for that slot.`
            : `${original.title} could not be fitted anywhere that also kept your must-do experiences.`,
      });
      continue;
    }
    const moved = ms(now.start) !== ms(original.start);
    const swapped = now.ref !== original.ref || now.provider !== original.provider;
    if (!moved && !swapped) {
      changes.push({
        nodeId: original.id,
        title: original.title,
        kind: original.kind,
        changeType: 'UNCHANGED',
        before: `${prettyDate(original.start)} · ${clock(original.start)}`,
        after: `${prettyDate(now.start)} · ${clock(now.start)}`,
        costDelta: 0,
        explanation: `${original.title} is untouched.`,
      });
      continue;
    }
    const dayShift = dayDiff(original.start, now.start);
    changes.push({
      nodeId: original.id,
      title: swapped ? `${original.title} → ${now.provider} ${now.ref}` : original.title,
      kind: now.kind,
      changeType: swapped ? 'REPLACED' : 'MOVED',
      before: `${prettyDate(original.start)} · ${clock(original.start)}`,
      after: `${prettyDate(now.start)} · ${clock(now.start)}`,
      costDelta: Math.round(now.cost - original.cost),
      explanation: swapped
        ? `Rebooked onto ${now.provider} ${now.ref}, departing ${clock(now.start)} on ${prettyDate(now.start)}.`
        : dayShift !== 0
          ? `${original.title} moves ${prettyDate(original.start)} → ${prettyDate(now.start)}.`
          : `${original.title} moves ${clock(original.start)} → ${clock(now.start)}.`,
    });
  }

  const order = { REPLACED: 0, MOVED: 1, DROPPED: 2, ADDED: 3, UNCHANGED: 4 } as const;
  return changes.sort((a, b) => order[a.changeType] - order[b.changeType]);
}

function inferStrategies(trip: Trip, draft: PlanDraft, metrics: PlanMetrics): RecoveryStrategy[] {
  const out = new Set<RecoveryStrategy>();
  const byId = new Map(draft.nodes.map((n) => [n.id, n]));
  for (const original of trip.nodes) {
    const now = byId.get(original.id);
    if (!now) {
      if (original.kind === 'ACTIVITY') out.add('DROP_LOW_PRIORITY');
      continue;
    }
    if (now.ref !== original.ref) out.add('ALTERNATE_TRANSPORT');
    else if (ms(now.start) !== ms(original.start)) {
      out.add(dayDiff(original.start, now.start) !== 0 ? 'REARRANGE' : 'RESCHEDULE');
    }
  }
  const lastBefore = Math.max(...trip.nodes.map((n) => ms(n.end)));
  const lastAfter = Math.max(...draft.nodes.map((n) => ms(n.end)));
  if (lastAfter > lastBefore) out.add('EXTEND');
  if (metrics.maxTravelHoursInADay > 0 && draft.nodes.length < trip.nodes.length) out.add('COMPRESS');
  return [...out];
}

/* ------------------------------------------------------------------ */
/* 4. search                                                          */
/* ------------------------------------------------------------------ */

export interface Candidate {
  key: string;
  combination: Choice[];
  draft: PlanDraft;
  metrics: PlanMetrics;
  feasibility: ReturnType<typeof validate>;
}

function enumerate(variables: Variable[]): Choice[][] {
  let combos: Choice[][] = [[]];
  for (const variable of variables) {
    const next: Choice[][] = [];
    for (const combo of combos) {
      for (const choice of variable.choices) {
        next.push([...combo, choice]);
        if (next.length > MAX_COMBINATIONS) break;
      }
      if (next.length > MAX_COMBINATIONS) break;
    }
    combos = next;
  }
  return combos;
}

/**
 * Keep only the Pareto front.
 *
 * A plan that is worse on cost AND worse on experiences AND changes more
 * bookings is not a choice, it is clutter. Removing dominated candidates means
 * every plan a traveller is shown represents a genuine trade-off against the
 * others rather than padding the deck to a round number.
 */
export function paretoFront(candidates: Candidate[]): Candidate[] {
  // Each axis expressed so that higher is better.
  const axes = (c: Candidate): number[] => [
    c.metrics.experienceValuePreserved,
    -c.metrics.addedCost,
    -c.metrics.changeCount,
    -c.metrics.lateNightArrivals,
    c.metrics.usableArrivalMinutes,
  ];

  const dominates = (a: number[], b: number[]) =>
    a.every((v, i) => v >= b[i]) && a.some((v, i) => v > b[i]);

  const scored = candidates.map((c) => ({ candidate: c, axes: axes(c) }));
  const front = scored.filter((x) => !scored.some((y) => y !== x && dominates(y.axes, x.axes)));

  // Exact ties survive dominance (nothing is strictly better), but two plans
  // that read identically on every axis are one choice, not two.
  const seen = new Set<string>();
  return front
    .filter((x) => {
      const signature = x.axes.join('|');
      if (seen.has(signature)) return false;
      seen.add(signature);
      return true;
    })
    .map((x) => x.candidate);
}

export function searchCandidates(trip: Trip, cascade: CascadeResult): Candidate[] {
  const graph = TripGraph.of(trip);
  const variables = buildVariables(trip, cascade);
  const combinations = enumerate(variables);
  const seen = new Set<string>();
  const feasible: Candidate[] = [];

  for (const combination of combinations) {
    const draft = applyCombination(trip, graph, cascade, combination);
    const key = draft.nodes
      .map((n) => `${n.id}@${ms(n.start)}#${n.ref ?? ''}`)
      .concat([...draft.droppedIds].sort().map((d) => `-${d}`))
      .join('|');
    if (seen.has(key)) continue;
    seen.add(key);

    const feasibility = validate(trip, draft);
    if (!feasibility.feasible) continue;
    feasible.push({ key, combination, draft, metrics: measure(trip, draft), feasibility });
  }

  return feasible;
}

export { measure, describeChanges, inferStrategies };
