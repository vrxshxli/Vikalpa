/** Scratch diagnostics for the demo scenario. Not part of the API surface. */
import { buildSeedTrip, riskSignals, seededFeed } from '../data/index.js';
import { runCascade } from '../engine/cascadeEngine.js';
import { validate } from '../engine/validator.js';
import { searchCandidates } from '../engine/recoveryPlanner.js';
import { analyseRisks } from '../engine/riskEngine.js';
import { clock, prettyDate } from '../engine/time.js';

const trip = buildSeedTrip();

console.log('\n=== baseline validation ===');
const base = validate(trip, { nodes: trip.nodes, droppedIds: new Set(), usedOptionIds: [] });
console.log('feasible:', base.feasible);
for (const v of base.violations) console.log(`  ${v.hard ? 'HARD' : 'soft'} [${v.rule}] ${v.message}`);

console.log('\n=== cascade (AI182 +24h) ===');
const cascade = runCascade(trip, seededFeed(trip.id)[0]);
for (const i of cascade.impacts) {
  console.log(
    `  ${i.status.padEnd(10)} ${i.title.padEnd(28)} ${prettyDate(i.originalStart)} ${clock(i.originalStart)} -> ${
      i.projectedStart ? `${prettyDate(i.projectedStart)} ${clock(i.projectedStart)}` : '—'
    }  hops ${i.hops}`,
  );
  console.log(`             ${i.reason}`);
}
console.log(' summary:', cascade.summary);

console.log('\n=== candidate search ===');
const candidates = searchCandidates(trip, cascade);
console.log('feasible candidates:', candidates.length);

console.log('\n=== risks ===');
for (const r of analyseRisks(trip, riskSignals)) {
  console.log(`  ${r.severity.padEnd(6)} ${r.kind.padEnd(26)} ${r.title}`);
}
