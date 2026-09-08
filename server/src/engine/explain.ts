/**
 * Explanation layer.
 *
 * Turns engine output into sentences a traveller would actually accept as a
 * reason. Deliberately template-driven and deterministic — the numbers in every
 * sentence come straight from the metrics, so an explanation can never drift
 * away from the plan it describes.
 *
 * (The LLM in `assistant.ts` reads preferences out of free text; it never
 * writes these sentences, so it cannot invent a justification.)
 */
import type { CascadeResult, RecoveryPlan, Trip } from '../types.js';
import { clock, prettyDate } from './time.js';

export const inr = (n: number): string => {
  const abs = Math.abs(Math.round(n));
  return `${n < 0 ? '−' : ''}₹${abs.toLocaleString('en-IN')}`;
};

export function explainPlan(trip: Trip, plan: RecoveryPlan): string {
  const m = plan.metrics;
  const parts: string[] = [];

  const preserved =
    m.experiencesPreserved === m.experiencesTotal
      ? `keeps all ${m.experiencesTotal} of your experiences`
      : `preserves ${m.experiencesPreserved} of ${m.experiencesTotal} experiences`;

  const money =
    m.addedCost > 0
      ? `costs ${inr(m.addedCost)} more`
      : m.addedCost < 0
        ? `comes back ${inr(-m.addedCost)} cheaper`
        : 'costs you nothing extra';

  parts.push(`${plan.title} ${preserved} and ${money}.`);

  if (m.lateNightArrivals === 0 && (trip.safety.avoidLateNightArrival || trip.group.avoidLateNightTravel)) {
    parts.push('No arrival lands in the late-night window you asked us to avoid.');
  } else if (m.lateNightArrivals > 0) {
    parts.push(
      `It does put you in late on ${m.lateNightArrivals} occasion${
        m.lateNightArrivals === 1 ? '' : 's'
      }, which counts against it on your safety preference.`,
    );
  }

  const dropped = plan.changes.filter((c) => c.changeType === 'DROPPED');
  if (dropped.length) {
    parts.push(
      `${dropped.map((d) => d.title).join(' and ')} ${dropped.length === 1 ? 'is' : 'are'} the only ${
        dropped.length === 1 ? 'thing' : 'things'
      } given up, and ${dropped.length === 1 ? 'it was' : 'they were'} the lowest-priority ${
        dropped.length === 1 ? 'item' : 'items'
      } competing for that time.`,
    );
  }

  if (m.refundLost > 0) {
    parts.push(`${inr(m.refundLost)} of what you already paid cannot be recovered on these terms.`);
  }

  parts.push(
    `${m.changeCount} booking${m.changeCount === 1 ? '' : 's'} change across ${m.daysAffected} day${
      m.daysAffected === 1 ? '' : 's'
    }.`,
  );

  return parts.join(' ');
}

export function planBullets(trip: Trip, plan: RecoveryPlan): string[] {
  const m = plan.metrics;
  const bullets: string[] = [];
  bullets.push(
    m.experiencesPreserved === m.experiencesTotal
      ? `All ${m.experiencesTotal} experiences kept`
      : `${m.experiencesPreserved}/${m.experiencesTotal} experiences preserved`,
  );
  bullets.push(m.addedCost === 0 ? 'No additional cost' : `${inr(m.addedCost)} additional cost`);
  bullets.push(
    m.lateNightArrivals === 0 ? 'No late-night arrival' : `${m.lateNightArrivals} late-night arrival`,
  );
  bullets.push(`${m.changeCount} booking${m.changeCount === 1 ? '' : 's'} changed`);
  if (m.addedTravelMinutes !== 0) {
    const h = Math.abs(m.addedTravelMinutes) / 60;
    bullets.push(`${m.addedTravelMinutes > 0 ? '+' : '−'}${h.toFixed(1)}h in transit`);
  }
  bullets.push(`${m.maxTravelHoursInADay.toFixed(1)}h busiest travel day`);
  return bullets;
}

/** The sentence shown under "RECOMMENDED" on the comparison screen. */
export function explainRecommendation(trip: Trip, plans: RecoveryPlan[]): string {
  const winner = plans.find((p) => p.recommended) ?? plans[0];
  if (!winner) return 'No feasible recovery plan survived validation against your constraints.';
  const others = plans.filter((p) => p.id !== winner.id);
  const m = winner.metrics;

  const edges: string[] = [];
  if (others.every((p) => p.metrics.experienceValuePreserved <= m.experienceValuePreserved)) {
    edges.push(`preserves ${m.experiencesPreserved}/${m.experiencesTotal} experiences`);
  }
  if (m.lateNightArrivals === 0 && others.some((p) => p.metrics.lateNightArrivals > 0)) {
    edges.push('avoids the late-night arrival the alternatives accept');
  }
  const cheaper = others.filter((p) => p.metrics.addedCost > m.addedCost).length;
  if (cheaper >= others.length / 2) {
    edges.push(`costs less than ${cheaper} of the ${others.length} alternatives`);
  }
  if (!edges.length) {
    edges.push(`scores highest against your own weighting (${winner.scores.total}/100)`);
  }

  const pref = trip.preferences;
  const lead = pref.experience >= 70 ? 'You told us experiences matter most' : 'Weighted against your preferences';

  return `${winner.title} is recommended because it ${edges.join(', and ')}. ${lead}, so that is what we optimised for.`;
}

export function explainCascade(cascade: CascadeResult): string {
  const broken = cascade.impacts.filter((i) => i.status === 'MISSED' || i.status === 'CANCELLED');
  const shaken = cascade.impacts.filter((i) => i.status === 'AT_RISK' || i.status === 'AFFECTED');
  const safe = cascade.impacts.filter((i) => i.status === 'SAFE');
  const bits = [cascade.summary];
  if (broken.length) bits.push(`${broken.map((b) => b.title).join(', ')} cannot happen as booked.`);
  if (shaken.length) bits.push(`${shaken.map((b) => b.title).join(', ')} still ${shaken.length === 1 ? 'runs' : 'run'} but with no margin.`);
  if (safe.length) bits.push(`${safe.length} booking${safe.length === 1 ? '' : 's'} ${safe.length === 1 ? 'is' : 'are'} untouched.`);
  return bits.join(' ');
}

export function explainImpact(cascade: CascadeResult, nodeId: string): string {
  const impact = cascade.impacts.find((i) => i.nodeId === nodeId);
  if (!impact) return 'This booking is not connected to the disruption.';
  if (impact.status === 'SAFE') return impact.reason;
  const chain = impact.chain
    .map((id) => cascade.impacts.find((i) => i.nodeId === id)?.title ?? id)
    .join(' → ');
  return `${chain}\n\n${impact.reason}`;
}

export function summariseBeforeAfter(plan: RecoveryPlan): string[] {
  return plan.changes
    .filter((c) => c.changeType !== 'UNCHANGED')
    .map((c) =>
      c.changeType === 'DROPPED'
        ? `${c.title} — removed`
        : `${c.title}: ${c.before} → ${c.after}`,
    );
}

export function prettyWhen(iso: string): string {
  return `${prettyDate(iso)} · ${clock(iso)}`;
}
