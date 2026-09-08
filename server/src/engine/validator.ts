/**
 * Feasibility validator.
 *
 * The optimizer is allowed to be creative; this file is not. Every candidate
 * plan is checked against physical and contractual reality here, and anything
 * with a hard violation is discarded before it is ever shown to a traveller.
 */
import type { FeasibilityReport, TripNode, Trip, Violation } from '../types.js';
import { activitySlots, transportOptions } from '../data/index.js';
import { TripGraph, readyTime } from './graph.js';
import { clock, dayIndex, durationMinutes, gapMinutes, isLateNight, local, ms, prettyDate } from './time.js';

export interface PlanDraft {
  nodes: TripNode[];
  droppedIds: Set<string>;
  /** Transport option ids used, for seat checks. */
  usedOptionIds: string[];
}

const TRAVEL_KINDS = new Set(['FLIGHT', 'TRAIN', 'BUS', 'TRANSFER']);

export function validate(trip: Trip, draft: PlanDraft): FeasibilityReport {
  const violations: Violation[] = [];
  const present = draft.nodes;
  const byId = new Map(present.map((n) => [n.id, n]));
  const graph = TripGraph.of(trip);
  const party = trip.travellers.length;

  const add = (rule: string, hard: boolean, message: string, nodeId?: string) =>
    violations.push({ rule, hard, message, nodeId });

  /* --- 1. dependency gaps still hold -------------------------------- */
  let gapsOk = true;
  for (const edge of trip.edges) {
    if (edge.type !== 'REQUIRES' && edge.type !== 'ENABLES') continue;
    const from = byId.get(edge.from);
    const to = byId.get(edge.to);
    if (!from || !to) continue;
    const actual = gapMinutes(readyTime(from, edge), to.start);
    if (actual < edge.minGapMinutes) {
      gapsOk = false;
      add(
        'travel-time',
        true,
        `${to.title} starts ${clock(to.start)}, only ${actual} min after ${from.title} — it needs ${
          edge.minGapMinutes
        }.`,
        to.id,
      );
    }
  }

  /* --- 2. opening hours and closed days ----------------------------- */
  let hoursOk = true;
  for (const node of present) {
    if (node.kind !== 'ACTIVITY' || !node.openingHours) continue;
    const s = local(node.start);
    const e = local(node.end);
    const [oh, om] = node.openingHours.open.split(':').map(Number);
    const [ch, cm] = node.openingHours.close.split(':').map(Number);
    if (node.openingHours.closedDays.includes(s.weekday)) {
      hoursOk = false;
      add('opening-hours', true, `${node.title} is closed on ${prettyDate(node.start)}.`, node.id);
      continue;
    }
    if (s.minutesOfDay < oh * 60 + om || e.minutesOfDay > ch * 60 + cm || e.dateKey !== s.dateKey) {
      hoursOk = false;
      add(
        'opening-hours',
        true,
        `${node.title} would run ${clock(node.start)}–${clock(node.end)}, outside its ${
          node.openingHours.open
        }–${node.openingHours.close} hours.`,
        node.id,
      );
    }
  }

  /* --- 3. supplier availability ------------------------------------- */
  let availabilityOk = true;
  for (const node of present) {
    if (node.kind !== 'ACTIVITY') continue;
    const slot = activitySlots.find((s) => s.nodeId === node.id && ms(s.start) === ms(node.start));
    if (!slot) {
      availabilityOk = false;
      add(
        'availability',
        true,
        `${node.title} has no published departure at ${clock(node.start)} on ${prettyDate(node.start)}.`,
        node.id,
      );
    } else if (slot.capacity < party) {
      availabilityOk = false;
      add(
        'availability',
        true,
        `${node.title} has ${slot.capacity} place${slot.capacity === 1 ? '' : 's'} left at that time; you are ${party}.`,
        node.id,
      );
    }
  }
  for (const optionId of draft.usedOptionIds) {
    const option = transportOptions.find((t) => t.id === optionId);
    if (!option) continue;
    if (option.seatsLeft < party) {
      availabilityOk = false;
      add(
        'availability',
        true,
        `${option.provider} ${option.ref} has ${option.seatsLeft} seat${
          option.seatsLeft === 1 ? '' : 's'
        } left — your party is ${party}.`,
        option.replacesNodeId,
      );
    }
  }

  /* --- 4. nothing double-booked ------------------------------------- */
  let overlapOk = true;
  const timed = present
    .filter((n) => n.kind !== 'HOTEL')
    .sort((a, b) => ms(a.start) - ms(b.start));
  for (let i = 1; i < timed.length; i += 1) {
    const prev = timed[i - 1];
    const cur = timed[i];
    if (ms(cur.start) < ms(prev.end)) {
      overlapOk = false;
      add(
        'overlap',
        true,
        `${prev.title} and ${cur.title} overlap on ${prettyDate(cur.start)}.`,
        cur.id,
      );
    }
  }

  /* --- 5. somewhere to sleep every night ---------------------------- */
  // Walk each stretch spent in a city and require a stay across every local
  // midnight inside it. Anchoring on 02:00 keeps a 23:30 check-in valid.
  let staysOk = true;
  const stays = present.filter((n) => n.kind === 'HOTEL');
  const covered = (t: number) => stays.some((s) => ms(s.start) <= t && ms(s.end) >= t);
  const hops = present
    .filter((n) => TRAVEL_KINDS.has(n.kind) && n.from && n.to && n.from.city !== n.to.city)
    .sort((a, b) => ms(a.start) - ms(b.start));

  for (let i = 0; i < hops.length && staysOk; i += 1) {
    const arrival = hops[i];
    const departure = hops.slice(i + 1).find((h) => h.from!.city === arrival.to!.city);
    if (!departure) continue;
    const offset = arrival.to!.tzOffset;
    const arrivedLocal = local(arrival.end);
    let midnight = Date.UTC(arrivedLocal.year, arrivedLocal.month - 1, arrivedLocal.date + 1) - offset * 60_000;
    while (midnight < ms(departure.start)) {
      const anchor = midnight + 2 * 60 * 60_000;
      if (anchor < ms(departure.start) && !covered(anchor)) {
        staysOk = false;
        add(
          'accommodation',
          true,
          `Nothing covers the night before ${prettyDate(new Date(midnight).toISOString())} in ${arrival.to!.city}.`,
        );
        break;
      }
      midnight += 24 * 60 * 60_000;
    }
  }

  /* --- 5b. you are physically in the right city --------------------- */
  let locationOk = true;
  const relocations = present
    .filter((n) => TRAVEL_KINDS.has(n.kind) && n.from && n.to && n.from.city !== n.to.city)
    .sort((a, b) => ms(a.start) - ms(b.start));
  for (const act of present) {
    if (act.kind !== 'ACTIVITY' || !act.location) continue;
    const city = act.location.city;
    const arrivals = relocations.filter((l) => l.to!.city === city && ms(l.end) <= ms(act.start));
    const arrival = arrivals[arrivals.length - 1];
    if (!arrival) {
      locationOk = false;
      add('location', true, `${act.title} is in ${city}, but nothing gets you there beforehand.`, act.id);
      continue;
    }
    const departure = relocations.find((l) => l.from!.city === city && ms(l.start) > ms(arrival.end));
    if (departure && ms(act.end) > ms(departure.start)) {
      locationOk = false;
      add(
        'location',
        true,
        `${act.title} runs until ${clock(act.end)} on ${prettyDate(act.end)}, but you leave ${city} for ${
          departure.to!.city
        } at ${clock(departure.start)}.`,
        act.id,
      );
    }
  }

  /* --- 6. group and safety constraints ------------------------------ */
  const perDay = new Map<number, number>();
  for (const node of present) {
    if (!TRAVEL_KINDS.has(node.kind)) continue;
    const d = dayIndex(node.start, trip.startDate);
    perDay.set(d, (perDay.get(d) ?? 0) + durationMinutes(node.start, node.end));
  }
  let ceilingOk = true;
  const ceiling = Math.min(trip.group.maxTravelHoursPerDay, trip.safety.maxTravelHoursPerDay) * 60;
  for (const [day, minutes] of perDay) {
    if (minutes <= ceiling) continue;
    const over = minutes - ceiling;
    ceilingOk = false;
    add(
      'travel-ceiling',
      over > 120,
      `Day ${day} carries ${(minutes / 60).toFixed(1)}h of travel against your ${(ceiling / 60).toFixed(
        0,
      )}h ceiling.`,
    );
  }

  let lateNightOk = true;
  if (trip.safety.avoidLateNightArrival || trip.group.avoidLateNightTravel) {
    for (const node of present) {
      const at = node.kind === 'HOTEL' ? node.start : node.end;
      if (!TRAVEL_KINDS.has(node.kind) && node.kind !== 'HOTEL') continue;
      // An immovable leg's arrival time is not a choice, so it is not a finding.
      if (!node.flexibility.canMove) continue;
      if (!isLateNight(at)) continue;
      lateNightOk = false;
      add(
        'late-night',
        false,
        `${node.title} puts you in at ${clock(at)} on ${prettyDate(at)}, inside the window you asked us to avoid.`,
        node.id,
      );
    }
  }

  let verifiedOk = true;
  if (trip.safety.preferVerifiedTransfers) {
    for (const node of present) {
      if (node.kind !== 'TRANSFER' || node.verifiedOperator) continue;
      verifiedOk = false;
      add('verified-transfer', false, `${node.title} is not a verified operator.`, node.id);
    }
  }

  /* --- 7. priorities ------------------------------------------------ */
  let prioritiesOk = true;
  for (const id of draft.droppedIds) {
    const original = graph.nodes.get(id);
    if (!original) continue;
    if (original.priority === 'MUST_DO' || original.priority === 'FIXED') {
      prioritiesOk = false;
      add(
        'priority',
        true,
        `${original.title} is marked ${original.priority.replace('_', ' ').toLowerCase()} — a plan that drops it is not on the table.`,
        id,
      );
    } else if (trip.group.priorityActivityIds.includes(id)) {
      prioritiesOk = false;
      add('priority', true, `${original.title} is a group priority activity.`, id);
    } else if (original.priority === 'IMPORTANT') {
      add('priority', false, `${original.title} was marked important and would be dropped.`, id);
    }
  }

  const checks = [
    { label: 'Travel time valid', passed: gapsOk, detail: 'Every handover keeps its required minimum gap.' },
    { label: 'Activity open', passed: hoursOk, detail: 'All experiences fall inside published opening hours.' },
    { label: 'Inventory available', passed: availabilityOk, detail: `Seats and places for ${party} travellers.` },
    { label: 'No double-booking', passed: overlapOk, detail: 'Nothing on the plan overlaps anything else.' },
    { label: 'Accommodation covered', passed: staysOk, detail: 'Every night away has a booked stay.' },
    { label: 'In the right city', passed: locationOk, detail: 'Each experience happens while you are actually there.' },
    { label: 'Daily travel ceiling', passed: ceilingOk, detail: `Under ${(ceiling / 60).toFixed(0)}h of travel per day.` },
    { label: 'Late-night preference', passed: lateNightOk, detail: 'No arrivals between 23:00 and 05:00.' },
    { label: 'Verified transfers', passed: verifiedOk, detail: 'Ground transport uses vetted operators.' },
    { label: 'Priorities respected', passed: prioritiesOk, detail: 'Must-do and group-priority items are kept.' },
  ];

  return {
    feasible: !violations.some((v) => v.hard),
    checks,
    violations,
  };
}
