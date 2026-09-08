/**
 * Precomputes the whole demo journey and writes it into the mobile bundle.
 *
 * The app always prefers the live API. This snapshot is the fallback so a demo
 * on a phone with no route back to the dev machine still shows real engine
 * output rather than an empty screen.
 *
 *   npm run snapshot
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildSeedTrip, quickActions, seasonalRisks, seededFeed, disruptionCatalogue } from '../data/index.js';
import { analyseRisks, resilience } from '../engine/riskEngine.js';
import { runCascade, applyCascadeToTrip } from '../engine/cascadeEngine.js';
import { paretoFront, searchCandidates } from '../engine/recoveryPlanner.js';
import { scoreCandidates, selectPlans, weightsFromPreferences } from '../engine/ranker.js';
import { explainCascade, explainRecommendation } from '../engine/explain.js';
import { simulate } from '../engine/scenarios.js';
import { riskSignals } from '../data/index.js';
import { importItinerary } from '../engine/parser.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(HERE, '..', '..', '..', 'mobile', 'src', 'data');
const OUT_FILE = join(OUT_DIR, 'offline.json');

async function main() {
  const trip = buildSeedTrip();
  const parsed = await importItinerary('DEMO');
  const risks = analyseRisks(trip, riskSignals);
  const score = resilience(trip, risks);

  const disruption = seededFeed(trip.id)[0];
  const cascade = runCascade(trip, disruption);
  const disruptedTrip = applyCascadeToTrip(trip, cascade);

  const candidates = searchCandidates(trip, cascade);
  const shortlist = paretoFront(candidates);
  const plans = selectPlans(trip, scoreCandidates(trip, shortlist));
  const recommendation = explainRecommendation(trip, plans);

  const scenarios = disruptionCatalogue(trip.id).map((d) => simulate(trip, d));

  const snapshot = {
    generatedAt: new Date().toISOString(),
    trip,
    disruptedTrip,
    parse: { stages: parsed.stages, recognised: parsed.recognised, summary: parsed.summary },
    risks,
    resilience: score,
    signals: riskSignals,
    seasonal: seasonalRisks,
    disruption,
    cascade,
    cascadeNarrative: explainCascade(cascade),
    plans,
    recommendation,
    candidateCount: candidates.length,
    shortlistCount: shortlist.length,
    weights: weightsFromPreferences(trip.preferences),
    scenarios,
    quickActions,
    catalogue: disruptionCatalogue(trip.id),
  };

  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(OUT_FILE, JSON.stringify(snapshot, null, 2), 'utf8');

  console.log(`Snapshot written to ${OUT_FILE}`);
  console.log(`  risks:        ${risks.length} (${risks.filter((r) => r.severity === 'HIGH').length} high)`);
  console.log(`  resilience:   ${score.score}/100 ${score.band}`);
  console.log(`  cascade:      ${cascade.summary}`);
  console.log(`  candidates:   ${candidates.length} feasible, ${shortlist.length} non-dominated`);
  console.log(`  plans:        ${plans.length}`);
  for (const plan of plans) {
    const s = plan.scores;
    console.log(
      `    ${plan.recommended ? '★' : ' '} ${plan.id} ${plan.title.padEnd(24)} ` +
        `${plan.metrics.experiencesPreserved}/${plan.metrics.experiencesTotal} exp  ` +
        `₹${plan.metrics.addedCost.toLocaleString('en-IN').padStart(8)}  ` +
        `${String(plan.metrics.changeCount).padStart(2)} chg  ` +
        `late ${plan.metrics.lateNightArrivals}  ` +
        `[cost ${String(s.cost).padStart(3)} time ${String(s.time).padStart(3)} exp ${String(s.experiences).padStart(
          3,
        )} conv ${String(s.convenience).padStart(3)} safe ${String(s.safety).padStart(3)}] = ${s.total}`,
    );
    if (process.argv.includes('--verbose')) {
      for (const c of plan.changes.filter((c) => c.changeType !== 'UNCHANGED')) {
        console.log(`        ${c.changeType.padEnd(9)} ${c.title} :: ${c.before} → ${c.after ?? 'removed'}`);
      }
    }
  }
  console.log(`  recommended:  ${recommendation}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
