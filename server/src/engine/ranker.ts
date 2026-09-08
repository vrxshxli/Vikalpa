/**
 * Multi-objective ranker.
 *
 * Weights come from the traveller's own preference sliders — they are a stated
 * trade-off, not a validated model of human utility, and the UI says so.
 * Everything here is monotonic and explainable: no learned parameters.
 */
import type {
  PlanArchetype,
  PlanScores,
  Preferences,
  RankingWeights,
  RecoveryAction,
  RecoveryPlan,
  Trip,
} from '../types.js';
import type { Candidate } from './recoveryPlanner.js';
import { describeChanges, inferStrategies } from './recoveryPlanner.js';
import { explainPlan, planBullets } from './explain.js';

/**
 * Sliders are ordinal statements of emphasis, not utilities. Normalising them
 * linearly lets the sum of four secondary preferences outvote the one the
 * traveller actually called out, so we sharpen before normalising: at
 * exponent 2 an 85 leads an 45 decisively instead of marginally. Configurable
 * on purpose — this is a product judgement, not a measured constant.
 */
const PREFERENCE_SHARPNESS = 2;

export function weightsFromPreferences(prefs: Preferences): RankingWeights {
  const sharpen = (n: number) => Math.pow(Math.max(n, 0), PREFERENCE_SHARPNESS);
  const raw = {
    costWeight: sharpen(prefs.budget),
    timeWeight: sharpen(prefs.time),
    experienceWeight: sharpen(prefs.experience),
    convenienceWeight: sharpen(prefs.comfort),
    safetyWeight: sharpen(prefs.safety),
  };
  const total = Object.values(raw).reduce((a, b) => a + b, 0) || 1;
  return {
    costWeight: raw.costWeight / total,
    timeWeight: raw.timeWeight / total,
    experienceWeight: raw.experienceWeight / total,
    convenienceWeight: raw.convenienceWeight / total,
    safetyWeight: raw.safetyWeight / total,
  };
}

const clamp = (n: number) => Math.max(0, Math.min(100, n));

/**
 * 100 = best in this candidate set, 0 = worst. Lower raw value is better.
 *
 * `minSpan` stops a degenerate scale: if every plan changes 10 or 11 bookings,
 * that one-booking gap must not read as the whole 0–100 range.
 */
function invert(value: number, min: number, max: number, minSpan: number): number {
  const span = Math.max(max - min, minSpan);
  return clamp(((min + span - value) / span) * 100);
}

function safetyScore(trip: Trip, candidate: Candidate): number {
  const { metrics, draft } = candidate;
  const ceiling = Math.min(trip.group.maxTravelHoursPerDay, trip.safety.maxTravelHoursPerDay);
  const overCeiling = Math.max(0, metrics.maxTravelHoursInADay - ceiling);
  const unverified = trip.safety.preferVerifiedTransfers
    ? draft.nodes.filter((n) => n.kind === 'TRANSFER' && !n.verifiedOperator).length
    : 0;
  const soft = candidate.feasibility.violations.filter((v) => !v.hard).length;
  return clamp(100 - metrics.lateNightArrivals * 28 - overCeiling * 18 - unverified * 12 - soft * 4);
}

export function scoreCandidates(trip: Trip, candidates: Candidate[]): { candidate: Candidate; scores: PlanScores }[] {
  if (!candidates.length) return [];
  const weights = weightsFromPreferences(trip.preferences);

  const costs = candidates.map((c) => c.metrics.addedCost);
  // "Time" is both time spent in transit and usable time lost at the far end.
  const times = candidates.map((c) => c.metrics.addedTravelMinutes + c.metrics.usableMinutesLost);
  const changes = candidates.map((c) => c.metrics.changeCount);

  const bounds = {
    cost: [Math.min(...costs), Math.max(...costs)] as const,
    time: [Math.min(...times), Math.max(...times)] as const,
    change: [Math.min(...changes), Math.max(...changes)] as const,
  };

  return candidates.map((candidate) => {
    const cost = invert(candidate.metrics.addedCost, bounds.cost[0], bounds.cost[1], 5000);
    const time = invert(
      candidate.metrics.addedTravelMinutes + candidate.metrics.usableMinutesLost,
      bounds.time[0],
      bounds.time[1],
      120,
    );
    const experiences = clamp(candidate.metrics.experienceValuePreserved * 100);
    const convenience = invert(candidate.metrics.changeCount, bounds.change[0], bounds.change[1], 6);
    const safety = safetyScore(trip, candidate);
    const total =
      cost * weights.costWeight +
      time * weights.timeWeight +
      experiences * weights.experienceWeight +
      convenience * weights.convenienceWeight +
      safety * weights.safetyWeight;
    return {
      candidate,
      scores: {
        cost: Math.round(cost),
        time: Math.round(time),
        experiences: Math.round(experiences),
        convenience: Math.round(convenience),
        safety: Math.round(safety),
        total: Math.round(total * 10) / 10,
      },
    };
  });
}

const ARCHETYPE_COPY: Record<PlanArchetype, { title: string; tagline: string }> = {
  SAVE_EXPERIENCES: { title: 'Save the experiences', tagline: 'Protects what you came for' },
  LOWEST_COST: { title: 'Lowest cost', tagline: 'Cheapest way back on track' },
  LOWEST_STRESS: { title: 'Lowest stress', tagline: 'Fewest moving parts' },
  MAXIMUM_SAFETY: { title: 'Maximum safety', tagline: 'No late nights, verified transport' },
  FASTEST: { title: 'Most time on the ground', tagline: 'Least travel, most daylight' },
  BALANCED: { title: 'Balanced', tagline: 'Even trade across every axis' },
  MINIMAL_CHANGE: { title: 'Minimal change', tagline: 'Closest to your original plan' },
};

type Scored = { candidate: Candidate; scores: PlanScores };

function best(list: Scored[], compare: (a: Scored, b: Scored) => number): Scored | undefined {
  return [...list].sort(compare)[0];
}

interface ArchetypePick {
  archetype: PlanArchetype;
  /** Sort ascending — the winner for this objective sorts first. */
  compare: (a: Scored, b: Scored) => number;
  /**
   * The thing this archetype claims to be best at, higher = better. A pick is
   * dropped when an already-selected plan matches or beats it here, so we never
   * label a plan "Maximum safety" alongside an equally safe "Lowest cost".
   */
  claim: (s: Scored) => number;
}

const PICKS: ArchetypePick[] = [
  {
    archetype: 'SAVE_EXPERIENCES',
    // Among the plans that keep the most, take the one that is best overall —
    // not merely the cheapest, which is how you end up recommending a plan that
    // lands in Paris at 20:30.
    compare: (a, b) =>
      b.candidate.metrics.experienceValuePreserved - a.candidate.metrics.experienceValuePreserved ||
      b.scores.total - a.scores.total,
    claim: (s) => s.candidate.metrics.experienceValuePreserved,
  },
  {
    archetype: 'LOWEST_COST',
    compare: (a, b) =>
      a.candidate.metrics.addedCost - b.candidate.metrics.addedCost || b.scores.total - a.scores.total,
    claim: (s) => -s.candidate.metrics.addedCost,
  },
  {
    archetype: 'FASTEST',
    compare: (a, b) =>
      a.candidate.metrics.addedTravelMinutes +
        a.candidate.metrics.usableMinutesLost -
        (b.candidate.metrics.addedTravelMinutes + b.candidate.metrics.usableMinutesLost) ||
      b.scores.total - a.scores.total,
    claim: (s) => -(s.candidate.metrics.addedTravelMinutes + s.candidate.metrics.usableMinutesLost),
  },
  {
    archetype: 'MAXIMUM_SAFETY',
    compare: (a, b) => b.scores.safety - a.scores.safety || b.scores.total - a.scores.total,
    claim: (s) => s.scores.safety,
  },
  {
    archetype: 'MINIMAL_CHANGE',
    compare: (a, b) =>
      a.candidate.metrics.changeCount - b.candidate.metrics.changeCount || b.scores.total - a.scores.total,
    claim: (s) => -s.candidate.metrics.changeCount,
  },
  {
    archetype: 'LOWEST_STRESS',
    compare: (a, b) =>
      b.scores.convenience + b.scores.safety - (a.scores.convenience + a.scores.safety) ||
      b.scores.total - a.scores.total,
    claim: (s) => s.scores.convenience + s.scores.safety,
  },
  {
    archetype: 'BALANCED',
    compare: (a, b) => b.scores.total - a.scores.total,
    claim: (s) => s.scores.total,
  },
];

/** "Dubai City Tour" → "city tour" — how someone would actually say it. */
function shortName(title: string): string {
  return title.split(/\s+/).slice(-2).join(' ').toLowerCase();
}

/**
 * Names an unlabelled plan after what it gives up, because that is the thing a
 * traveller is actually choosing between.
 */
function distinctiveTitle(trip: Trip, scored: Scored): string {
  const dropped = [...scored.candidate.draft.droppedIds]
    .map((id) => trip.nodes.find((n) => n.id === id))
    .filter((n) => n && n.kind === 'ACTIVITY')
    .map((n) => shortName(n!.title));
  if (!dropped.length) return 'Everything kept';
  if (dropped.length > 2) return `Without ${dropped.length} experiences`;
  return `Without the ${dropped.join(' + ')}`;
}

/** The transport swap that defines a plan, for use as a tagline. */
function routeTagline(scored: Scored): string {
  const replaced = scored.candidate.combination.filter(
    (c): c is Extract<typeof c, { var: 'transport'; mode: 'REPLACE' }> =>
      c.var === 'transport' && c.mode === 'REPLACE',
  );
  const m = scored.candidate.metrics;
  const route = replaced.length
    ? `Via ${replaced.map((c) => `${c.option.provider} ${c.option.ref}`).join(' + ')}`
    : 'On your rescheduled flights';
  return `${route} · ${m.experiencesPreserved}/${m.experiencesTotal} experiences`;
}

/**
 * Pick one representative plan per objective, then top up with whatever else
 * scores well. Travellers reason about "cheapest" and "safest", not about a
 * ranked list of near-identical permutations.
 */
export function selectPlans(trip: Trip, scored: Scored[], limit = 7): RecoveryPlan[] {
  if (!scored.length) return [];

  const used = new Set<string>();
  const selected: { archetype: PlanArchetype; scored: Scored; labelled: boolean }[] = [];

  for (const pick of PICKS) {
    if (selected.length >= limit) break;
    const available = scored.filter((s) => !used.has(s.candidate.key));
    const chosen = best(available, pick.compare);
    if (!chosen) continue;
    // Must genuinely lead on its own claim, or the label would be a lie.
    if (selected.some((sel) => pick.claim(sel.scored) >= pick.claim(chosen))) continue;
    used.add(chosen.candidate.key);
    selected.push({ archetype: pick.archetype, scored: chosen, labelled: true });
  }

  // Top up with the remaining genuine trade-offs, named after what sets them apart.
  for (const s of [...scored].sort((a, b) => b.scores.total - a.scores.total)) {
    if (selected.length >= limit) break;
    if (used.has(s.candidate.key)) continue;
    used.add(s.candidate.key);
    selected.push({ archetype: 'BALANCED', scored: s, labelled: false });
  }

  const trimmed = selected.slice(0, limit);
  const recommendedKey = [...trimmed].sort((a, b) => b.scored.scores.total - a.scored.scores.total)[0].scored.candidate
    .key;

  const titleCounts = new Map<string, number>();
  const plans = trimmed.map(({ archetype, scored: s, labelled }, index) => {
    const { candidate, scores } = s;
    const changes = describeChanges(trip, candidate.draft);
    const actions: RecoveryAction[] = candidate.combination.map((choice) => {
      if (choice.var === 'activity') {
        return choice.mode === 'DROP'
          ? { type: 'DROP' as const, nodeId: choice.nodeId }
          : { type: 'RESCHEDULE' as const, nodeId: choice.nodeId, newStart: choice.slot.start, newEnd: choice.slot.end };
      }
      if (choice.var === 'stay') {
        return { type: 'REBOOK_STAY' as const, nodeId: choice.nodeId, optionId: choice.option?.id };
      }
      if (choice.mode === 'REPLACE') {
        return { type: 'REPLACE_TRANSPORT' as const, nodeId: choice.nodeId, optionId: choice.option.id };
      }
      return { type: 'KEEP' as const, nodeId: choice.nodeId };
    });

    // Filler slots are named after what actually distinguishes them, so a
    // traveller is never asked to choose between "Balanced" and "Balanced".
    const base = labelled ? ARCHETYPE_COPY[archetype].title : distinctiveTitle(trip, s);
    const seenBefore = titleCounts.get(base) ?? 0;
    titleCounts.set(base, seenBefore + 1);
    // Two plans can give up the same things on different flights — disambiguate
    // with the leg that actually differs rather than a bare counter.
    const swap = candidate.combination.find((c) => c.var === 'transport' && c.mode === 'REPLACE');
    const suffix =
      swap && swap.var === 'transport' && swap.mode === 'REPLACE' ? swap.option.ref : String(seenBefore + 1);
    const title = seenBefore === 0 ? base : `${base} · ${suffix}`;
    const tagline = labelled ? ARCHETYPE_COPY[archetype].tagline : routeTagline(s);

    const plan: RecoveryPlan = {
      id: `plan-${String.fromCharCode(65 + index)}`,
      archetype,
      title,
      tagline,
      strategies: inferStrategies(trip, candidate.draft, candidate.metrics),
      actions,
      changes,
      nodes: candidate.draft.nodes,
      metrics: candidate.metrics,
      scores,
      feasibility: candidate.feasibility,
      recommended: candidate.key === recommendedKey,
      explanation: '',
      bullets: [],
    };
    plan.explanation = explainPlan(trip, plan);
    plan.bullets = planBullets(trip, plan);
    return plan;
  });

  // Recommended plan leads the deck.
  return plans.sort((a, b) => Number(b.recommended) - Number(a.recommended) || b.scores.total - a.scores.total);
}
