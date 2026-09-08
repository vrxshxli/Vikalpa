/**
 * What-if simulator.
 *
 * Runs the real cascade engine against a throwaway copy of the trip, so the
 * numbers a traveller sees while exploring "what if the flight slips six
 * hours?" are the same numbers they would get if it actually did — but nothing
 * is persisted and the live trip never changes state.
 */
import type { CascadeResult, Disruption, Trip } from '../types.js';
import { disruptionCatalogue } from '../data/index.js';
import { runCascade } from './cascadeEngine.js';
import { paretoFront, searchCandidates } from './recoveryPlanner.js';
import { scoreCandidates, selectPlans } from './ranker.js';
import { explainCascade } from './explain.js';

export interface ScenarioDefinition {
  id: string;
  label: string;
  detail: string;
  disruption: Disruption;
}

export function scenarioCatalogue(trip: Trip): ScenarioDefinition[] {
  return disruptionCatalogue(trip.id).map((d) => ({
    id: d.id,
    label: d.headline,
    detail: d.detail,
    disruption: d,
  }));
}

export interface ScenarioResult {
  scenario: ScenarioDefinition;
  cascade: CascadeResult;
  narrative: string;
  /** Chain of consequence, one line per hop, for the animated read-out. */
  ripple: { nodeId: string; title: string; status: string; hops: number; reason: string }[];
  recoverable: boolean;
  planCount: number;
  bestPlanSummary: string | null;
}

export function simulate(trip: Trip, disruption: Disruption): ScenarioResult {
  const simulated: Disruption = { ...disruption, simulated: true, tripId: trip.id };
  const cascade = runCascade(trip, simulated);

  const ripple = cascade.impacts
    .filter((i) => i.status !== 'SAFE' || i.nodeId === simulated.nodeId)
    .sort((a, b) => a.hops - b.hops)
    .map((i) => ({
      nodeId: i.nodeId,
      title: i.title,
      status: i.status,
      hops: i.hops,
      reason: i.reason,
    }));

  const candidates = searchCandidates(trip, cascade);
  const plans = selectPlans(trip, scoreCandidates(trip, paretoFront(candidates)), 3);
  const best = plans.find((p) => p.recommended) ?? plans[0] ?? null;

  return {
    scenario: {
      id: simulated.id,
      label: simulated.headline,
      detail: simulated.detail,
      disruption: simulated,
    },
    cascade,
    narrative: explainCascade(cascade),
    ripple,
    recoverable: plans.length > 0,
    planCount: candidates.length,
    bestPlanSummary: best
      ? `${best.title} — ${best.metrics.experiencesPreserved}/${best.metrics.experiencesTotal} experiences kept, ₹${best.metrics.addedCost.toLocaleString('en-IN')} extra.`
      : null,
  };
}
