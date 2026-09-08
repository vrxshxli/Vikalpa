/**
 * Risk engine — "prevent what you can, anticipate what you can't".
 *
 * Runs against a healthy trip and finds the places where it is thin: no buffer,
 * weather-exposed experiences, money you cannot get back, and single bookings
 * that everything else hangs off.
 */
import type {
  ResilienceScore,
  RiskPoint,
  RiskSignal,
  Severity,
  Trip,
  TripNode,
} from '../types.js';
import { TripGraph, readyTime } from './graph.js';
import { activitySlots, transportOptions, stayOptions } from '../data/index.js';
import { clock, dayIndex, durationMinutes, gapMinutes, isLateNight, local, ms, prettyDate, shiftIso } from './time.js';

const shiftDays = (iso: string, days: number) => shiftIso(iso, days * 24 * 60);

const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

function worst(a: Severity, b: Severity): Severity {
  const rank = { LOW: 0, MEDIUM: 1, HIGH: 2 };
  return rank[a] >= rank[b] ? a : b;
}

/** Alternatives the recovery planner could reach for, per node. */
export function backupCount(nodeId: string, kind: TripNode['kind']): number {
  if (kind === 'ACTIVITY') return activitySlots.filter((s) => s.nodeId === nodeId).length - 1;
  if (kind === 'HOTEL') return stayOptions.filter((s) => s.replacesNodeId === nodeId).length - 1;
  return transportOptions.filter((t) => t.replacesNodeId === nodeId).length;
}

export function analyseRisks(trip: Trip, signals: RiskSignal[]): RiskPoint[] {
  const graph = TripGraph.of(trip);
  const radius = graph.blastRadius();
  const risks: RiskPoint[] = [];

  /* --- tight connections -------------------------------------------- */
  // `graph.edges` is already pruned to edges whose endpoints still exist — a
  // recovery plan that drops a booking leaves dangling edges behind on the trip.
  for (const edge of graph.edges) {
    if (edge.type !== 'REQUIRES') continue;
    const from = graph.node(edge.from);
    const to = graph.node(edge.to);
    const actual = gapMinutes(readyTime(from, edge), to.start);
    const margin = actual - edge.minGapMinutes;
    if (margin > 30) continue;

    const downstream = radius.get(to.id) ?? 0;
    const severity: Severity = margin <= 0 && downstream >= 5 ? 'HIGH' : margin <= 20 ? 'MEDIUM' : 'LOW';
    risks.push({
      id: `risk-tight-${edge.id}`,
      kind: 'TIGHT_CONNECTION',
      title: `${from.title} → ${to.title}`,
      severity,
      nodeIds: [from.id, to.id],
      whyItMatters:
        margin <= 0
          ? `There is no spare time at all. ${to.title} needs ${edge.minGapMinutes} minutes after ${from.title} and gets exactly ${actual}.`
          : `Only ${margin} minutes of slack sit between these two bookings.`,
      recommendedAction:
        to.kind === 'TRANSFER'
          ? 'Switch to a meet-and-greet transfer that tracks your flight'
          : `Move ${to.title} ${Math.max(60 - margin, 30)} minutes later`,
      resilienceDelta: severity === 'HIGH' ? 9 : severity === 'MEDIUM' ? 5 : 2,
      detail: `${from.title} releases you at ${clock(readyTime(from, edge))} on ${prettyDate(readyTime(from, edge))}. ${
        to.title
      } starts at ${clock(to.start)}. ${downstream} later ${
        downstream === 1 ? 'booking depends' : 'bookings depend'
      } on this handover holding.`,
    });
  }

  /* --- weather exposure --------------------------------------------- */
  for (const node of trip.nodes) {
    if (!node.weatherSensitive) continue;
    const city = node.location?.city ?? node.to?.city;
    const day = local(node.start).dateKey;
    const matching = signals.filter(
      (s) =>
        (s.kind === 'WEATHER' || s.kind === 'DISASTER') &&
        s.place.city === city &&
        s.severity !== 'LOW' &&
        Math.abs(ms(s.observedAt) - ms(node.start)) < 48 * 60 * 60 * 1000,
    );
    if (!matching.length) continue;
    const sev = matching.reduce<Severity>((acc, s) => worst(acc, s.severity), 'LOW');
    const severity: Severity = !node.refundable && sev !== 'LOW' ? 'HIGH' : sev;
    risks.push({
      id: `risk-weather-${node.id}`,
      kind: 'WEATHER_EXPOSURE',
      title: `${node.title} is weather-exposed`,
      severity,
      nodeIds: [node.id],
      whyItMatters: matching[0].tripImpact,
      recommendedAction: node.refundable
        ? `Hold a backup slot for ${node.title}`
        : `Ask the operator for a weather-transfer voucher on ${node.title}`,
      resilienceDelta: severity === 'HIGH' ? 8 : 4,
      detail: `${matching[0].headline}. ${node.title} runs ${clock(node.start)}–${clock(node.end)} on ${prettyDate(
        node.start,
      )} in ${city}${node.refundable ? '' : `, and the ${inr(node.cost)} you paid is non-refundable`}.`,
    });
  }

  /* --- late-night arrivals ------------------------------------------ */
  // A late flight, its transfer and the check-in that follows are one event to
  // a traveller, so group by night and report the whole cluster once.
  const lastNodeId = [...trip.nodes].sort((a, b) => ms(a.end) - ms(b.end)).pop()?.id;
  const lateByNight = new Map<string, TripNode[]>();
  for (const node of trip.nodes) {
    const at = node.kind === 'HOTEL' ? node.start : node.end;
    if (!isLateNight(at)) continue;
    const l = local(at);
    // 00:30 belongs to the night that started the previous evening.
    const key = l.hour < 5 ? prettyDate(shiftDays(at, -1)) : prettyDate(at);
    if (!lateByNight.has(key)) lateByNight.set(key, []);
    lateByNight.get(key)!.push(node);
  }
  for (const [night, nodes] of lateByNight) {
    const anchor = nodes.reduce((worst, n) => {
      const at = n.kind === 'HOTEL' ? n.start : n.end;
      const worstAt = worst.kind === 'HOTEL' ? worst.start : worst.end;
      return ms(at) > ms(worstAt) ? n : worst;
    });
    const at = anchor.kind === 'HOTEL' ? anchor.start : anchor.end;
    const homeward = nodes.some((n) => n.id === lastNodeId);
    risks.push({
      id: `risk-late-${night.replace(/\s/g, '')}`,
      kind: 'LATE_ARRIVAL',
      title: homeward ? `Late arrival home — ${prettyDate(at)}` : `Late-night arrival on ${night}`,
      severity: homeward ? 'MEDIUM' : trip.safety.avoidLateNightArrival ? 'HIGH' : 'MEDIUM',
      nodeIds: nodes.map((n) => n.id),
      whyItMatters: homeward
        ? 'The last leg lands after midnight. Nothing depends on it, but plan for onward transport at that hour.'
        : trip.safety.avoidLateNightArrival
          ? 'You asked us to avoid late-night arrivals, and this night lands inside that window.'
          : 'Late arrivals leave little room to recover if anything upstream slips.',
      recommendedAction: homeward ? 'No action needed' : 'Move this leg to an earlier departure',
      resilienceDelta: homeward ? 2 : 7,
      detail: `${nodes.map((n) => `${clock(n.kind === 'HOTEL' ? n.start : n.end)} ${n.title}`).join('\n')}\n\nOptions for fixing anything that goes wrong shrink sharply after 23:00.`,
    });
  }

  /* --- non-refundable exposure -------------------------------------- */
  const nonRefundable = trip.nodes.filter((n) => !n.refundable);
  if (nonRefundable.length) {
    const exposed = nonRefundable.reduce((s, n) => s + n.cost, 0);
    const share = exposed / Math.max(trip.totalCost, 1);
    risks.push({
      id: 'risk-refund',
      kind: 'NON_REFUNDABLE',
      title: `${inr(exposed)} cannot be recovered`,
      severity: share > 0.4 ? 'HIGH' : share > 0.2 ? 'MEDIUM' : 'LOW',
      nodeIds: nonRefundable.map((n) => n.id),
      whyItMatters: `${Math.round(share * 100)}% of what you have paid is on non-refundable terms, so any change costs you twice — once to rebook, once in sunk money.`,
      recommendedAction: 'Switch the largest non-refundable booking to a flexible rate',
      resilienceDelta: 6,
      detail: nonRefundable
        .map((n) => `${n.title} — ${inr(n.cost)}${n.notes ? ` (${n.notes})` : ''}`)
        .join('\n'),
    });
  }

  /* --- single point of failure -------------------------------------- */
  // Only the worst one is worth saying out loud: on a linear itinerary every
  // early booking technically has a large blast radius.
  const spof = [...trip.nodes]
    .filter((n) => n.kind !== 'ACTIVITY')
    .sort((a, b) => (radius.get(b.id) ?? 0) - (radius.get(a.id) ?? 0))[0];
  for (const node of spof ? [spof] : []) {
    const downstream = radius.get(node.id) ?? 0;
    if (downstream < Math.ceil(trip.nodes.length * 0.6)) continue;
    const backups = backupCount(node.id, node.kind);
    risks.push({
      id: `risk-spof-${node.id}`,
      kind: 'SINGLE_POINT_OF_FAILURE',
      title: `Everything hangs off ${node.title}`,
      severity: backups === 0 ? 'HIGH' : 'MEDIUM',
      nodeIds: [node.id],
      whyItMatters: `${downstream} of your ${trip.nodes.length} bookings sit downstream of this one. If it moves, they all move.`,
      recommendedAction:
        backups === 0
          ? 'Add a same-day backup for this leg'
          : `Keep the ${backups} alternative${backups === 1 ? '' : 's'} we found within reach`,
      resilienceDelta: backups === 0 ? 10 : 4,
      detail: `We found ${backups} viable ${
        backups === 1 ? 'alternative' : 'alternatives'
      } for ${node.title} in your dates.`,
    });
  }

  /* --- day density and buffer --------------------------------------- */
  const byDay = new Map<number, TripNode[]>();
  for (const node of trip.nodes) {
    if (node.kind === 'HOTEL') continue;
    const d = dayIndex(node.start, trip.startDate);
    if (!byDay.has(d)) byDay.set(d, []);
    byDay.get(d)!.push(node);
  }
  for (const [day, nodes] of byDay) {
    const busyMinutes = nodes.reduce((s, n) => s + durationMinutes(n.start, n.end), 0);
    if (busyMinutes < 9 * 60) continue;
    risks.push({
      id: `risk-dense-day-${day}`,
      kind: 'DENSE_DAY',
      title: `Day ${day} is ${Math.round(busyMinutes / 60)} hours of scheduled commitments`,
      severity: busyMinutes > 11 * 60 ? 'HIGH' : 'MEDIUM',
      nodeIds: nodes.map((n) => n.id),
      whyItMatters: `Your group agreed a ${trip.group.maxTravelHoursPerDay}-hour daily ceiling. Day ${day} runs to ${Math.round(
        busyMinutes / 60,
      )} hours, so a single delay has nowhere to go.`,
      recommendedAction: `Move one item off Day ${day}`,
      resilienceDelta: 5,
      detail: nodes.map((n) => `${clock(n.start)}–${clock(n.end)} ${n.title}`).join('\n'),
    });
  }

  const freeDays = [...Array(dayIndex(trip.endDate + 'T12:00:00+00:00', trip.startDate)).keys()]
    .map((i) => i + 1)
    .filter((d) => !byDay.has(d));
  if (freeDays.length === 0) {
    risks.push({
      id: 'risk-no-buffer',
      kind: 'NO_BUFFER',
      title: 'No buffer day anywhere in the trip',
      severity: 'MEDIUM',
      nodeIds: trip.nodes.filter((n) => n.kind === 'FLIGHT').map((n) => n.id),
      whyItMatters:
        'Every day carries a fixed commitment. A delay on any leg has to be paid for by cancelling something rather than by absorbing it.',
      recommendedAction: 'Add 1 buffer day',
      resilienceDelta: 7,
      detail: `All ${byDay.size} days of your trip are committed. One free half-day is usually enough to absorb a 6-hour delay without losing an experience.`,
    });
  }

  const order = { HIGH: 0, MEDIUM: 1, LOW: 2 };
  return risks.sort((a, b) => order[a.severity] - order[b.severity] || b.resilienceDelta - a.resilienceDelta);
}

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

export function resilience(trip: Trip, risks: RiskPoint[]): ResilienceScore {
  const graph = TripGraph.of(trip);

  /* connection buffer — average margin across hard handovers */
  const requires = graph.edges.filter((e) => e.type === 'REQUIRES');
  const margins = requires.map(
    (e) => gapMinutes(readyTime(graph.node(e.from), e), graph.node(e.to).start) - e.minGapMinutes,
  );
  const avgMargin = margins.length ? margins.reduce((a, b) => a + b, 0) / margins.length : 60;
  const connectionBuffer = clamp((Math.min(avgMargin, 120) / 120) * 100);

  /* weather exposure — inverse of exposed, unhedged experiences */
  const sensitive = trip.nodes.filter((n) => n.weatherSensitive);
  const hedged = sensitive.filter((n) => n.refundable || backupCount(n.id, n.kind) > 0);
  const weatherExposure = clamp(
    sensitive.length === 0 ? 100 : 40 + (hedged.length / sensitive.length) * 60 - risks.filter((r) => r.kind === 'WEATHER_EXPOSURE' && r.severity === 'HIGH').length * 12,
  );

  /* schedule density — how close the busiest day runs to the agreed ceiling */
  const byDay = new Map<number, number>();
  for (const n of trip.nodes) {
    if (n.kind === 'HOTEL') continue;
    const d = dayIndex(n.start, trip.startDate);
    byDay.set(d, (byDay.get(d) ?? 0) + durationMinutes(n.start, n.end));
  }
  const busiest = Math.max(0, ...byDay.values()) / 60;
  const scheduleDensity = clamp(100 - (busiest / Math.max(trip.group.maxTravelHoursPerDay, 1)) * 55);

  /* transport flexibility — share of legs with a seeded alternative */
  const legs = trip.nodes.filter((n) => n.kind !== 'ACTIVITY' && n.kind !== 'HOTEL');
  const withAlt = legs.filter((n) => backupCount(n.id, n.kind) > 0);
  const transportFlexibility = clamp(legs.length ? (withAlt.length / legs.length) * 100 : 50);

  /* backup options — alternate slots plus refundability */
  const activities = trip.nodes.filter((n) => n.kind === 'ACTIVITY');
  const withSlots = activities.filter((n) => backupCount(n.id, 'ACTIVITY') > 0);
  const refundShare = trip.nodes.filter((n) => n.refundable).reduce((s, n) => s + n.cost, 0) / Math.max(trip.totalCost, 1);
  const backupOptions = clamp(
    (activities.length ? (withSlots.length / activities.length) * 60 : 30) + refundShare * 40,
  );

  const breakdown = {
    connectionBuffer,
    weatherExposure,
    scheduleDensity,
    transportFlexibility,
    backupOptions,
  };

  const score = clamp(
    connectionBuffer * 0.26 +
      weatherExposure * 0.18 +
      scheduleDensity * 0.18 +
      transportFlexibility * 0.22 +
      backupOptions * 0.16,
  );

  const band: ResilienceScore['band'] =
    score >= 80 ? 'RESILIENT' : score >= 62 ? 'STABLE' : score >= 45 ? 'EXPOSED' : 'FRAGILE';

  const suggestions = risks
    .filter((r) => r.severity !== 'LOW')
    .slice(0, 5)
    .map((r) => ({
      id: r.id,
      label: r.recommendedAction,
      delta: r.resilienceDelta,
      detail: r.whyItMatters,
    }));

  return { score, band, breakdown, suggestions };
}
