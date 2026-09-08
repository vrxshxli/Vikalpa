/**
 * REST surface for the trip intelligence engine.
 *
 * Every route is a thin shell: parse, delegate to the engine, shape the
 * response. No business logic lives here.
 */
import { Router } from 'express';

import type { Disruption, DisruptionType } from '../types.js';
import {
  activitySlots,
  disruptionCatalogue,
  quickActions,
  seasonalRisks,
  stayOptions,
  transportOptions,
} from '../data/index.js';
import * as store from '../store.js';
import { importItinerary, type ImportSource } from '../engine/parser.js';
import { explainCascade, explainImpact } from '../engine/explain.js';
import { scenarioCatalogue, simulate } from '../engine/scenarios.js';
import { interpret } from '../engine/assistant.js';
import { weightsFromPreferences } from '../engine/ranker.js';
import { backupCount } from '../engine/riskEngine.js';
import { durationMinutes, ms } from '../engine/time.js';

export const trips = Router();

function overview(session: store.TripSession) {
  return {
    trip: session.trip,
    headline: store.describeTripHeadline(session),
    subhead: store.tripSubhead(session),
    status: session.trip.status,
    disruption: session.disruption,
    selectedPlanId: session.selectedPlanId,
    hasPlans: session.plans.length > 0,
    weights: weightsFromPreferences(session.trip.preferences),
  };
}

/* ------------------------------------------------------------------ */
/* Import + read                                                      */
/* ------------------------------------------------------------------ */

trips.post('/import', async (req, res) => {
  const source = (req.body?.source as ImportSource) ?? 'DEMO';
  const parsed = await importItinerary(source, req.body?.fileName);
  const session = store.importTrip();
  res.json({
    ...overview(session),
    stages: parsed.stages,
    recognised: parsed.recognised,
    parseSummary: parsed.summary,
  });
});

trips.get('/:id', (req, res) => {
  const session = store.requireSession(req.params.id);
  res.json(overview(session));
});

trips.post('/:id/reset', (req, res) => {
  const session = store.resetSession(req.params.id);
  res.json(overview(session));
});

trips.get('/:id/graph', (req, res) => {
  const session = store.requireSession(req.params.id);
  const { trip } = session;
  res.json({
    nodes: trip.nodes.map((n) => ({
      id: n.id,
      kind: n.kind,
      title: n.title,
      subtitle: n.subtitle,
      status: n.status,
      start: n.start,
      end: n.end,
      day: n.day,
      place: n.location ?? n.to ?? n.from,
      priority: n.priority,
      cost: n.cost,
      durationMinutes: durationMinutes(n.start, n.end),
      backups: backupCount(n.id, n.kind),
    })),
    edges: trip.edges.filter(
      (e) => trip.nodes.some((n) => n.id === e.from) && trip.nodes.some((n) => n.id === e.to),
    ),
  });
});

trips.get('/:id/risks', (req, res) => {
  const session = store.requireSession(req.params.id);
  const { risks, resilience } = store.tripRisks(session);
  res.json({ risks, resilience, highCount: risks.filter((r) => r.severity === 'HIGH').length });
});

trips.get('/:id/signals', (req, res) => {
  const session = store.requireSession(req.params.id);
  const signals = store.signalsForTrip(session);
  res.json({
    signals,
    connected: signals.filter((s) => s.relatedNodeIds.length > 0).length,
    seasonal: seasonalRisks,
    pending: store.pendingDisruption(session),
  });
});

trips.get('/:id/seasonal', (req, res) => {
  const session = store.requireSession(req.params.id);
  const cities = new Set(
    session.trip.nodes.flatMap((n) => [n.location?.city, n.from?.city, n.to?.city].filter(Boolean) as string[]),
  );
  res.json({
    relevant: seasonalRisks.filter((s) => cities.has(s.city)),
    other: seasonalRisks.filter((s) => !cities.has(s.city)),
  });
});

/* ------------------------------------------------------------------ */
/* Disruption + cascade                                               */
/* ------------------------------------------------------------------ */

trips.get('/:id/disruptions/catalogue', (req, res) => {
  const session = store.requireSession(req.params.id);
  res.json({
    catalogue: disruptionCatalogue(session.trip.id),
    quickActions,
    nodes: session.trip.nodes.map((n) => ({ id: n.id, kind: n.kind, title: n.title, subtitle: n.subtitle })),
  });
});

trips.post('/:id/disruptions', (req, res) => {
  const session = store.requireSession(req.params.id);
  const body = req.body ?? {};

  const node = session.trip.nodes.find((n) => n.id === body.nodeId);
  if (!node) {
    res.status(400).json({ error: `Unknown booking: ${body.nodeId}` });
    return;
  }

  const disruption: Disruption = {
    id: body.id ?? '',
    tripId: session.trip.id,
    nodeId: body.nodeId,
    type: (body.type as DisruptionType) ?? 'FLIGHT_DELAYED',
    delayMinutes: Number(body.delayMinutes ?? 0),
    headline: body.headline ?? `${node.title} disrupted`,
    detail: body.detail ?? `A change was reported on ${node.title}.`,
    source: body.source ?? 'MANUAL',
    detectedAt: body.detectedAt ?? new Date().toISOString(),
  };

  const cascade = store.applyDisruption(session, disruption);
  res.json({ ...overview(session), cascade, narrative: explainCascade(cascade) });
});

trips.get('/:id/cascade', (req, res) => {
  const session = store.requireSession(req.params.id);
  if (!session.cascade) {
    res.status(409).json({ error: 'No disruption has been applied to this trip yet.' });
    return;
  }
  res.json({ cascade: session.cascade, narrative: explainCascade(session.cascade) });
});

trips.get('/:id/cascade/:nodeId', (req, res) => {
  const session = store.requireSession(req.params.id);
  if (!session.cascade) {
    res.status(409).json({ error: 'No disruption has been applied to this trip yet.' });
    return;
  }
  res.json({
    nodeId: req.params.nodeId,
    explanation: explainImpact(session.cascade, req.params.nodeId),
    impact: session.cascade.impacts.find((i) => i.nodeId === req.params.nodeId) ?? null,
  });
});

/* ------------------------------------------------------------------ */
/* Recovery                                                           */
/* ------------------------------------------------------------------ */

trips.get('/:id/recovery-plans', (req, res) => {
  const session = store.requireSession(req.params.id);
  const { plans, recommendation } = store.recoveryPlans(session);
  res.json({
    plans,
    recommendation,
    weights: weightsFromPreferences(session.trip.preferences),
    baselineNodes: session.baseline.nodes,
  });
});

trips.get('/:id/recovery-plans/:planId', (req, res) => {
  const session = store.requireSession(req.params.id);
  const { plans } = store.recoveryPlans(session);
  const plan = plans.find((p) => p.id === req.params.planId);
  if (!plan) {
    res.status(404).json({ error: `No plan ${req.params.planId}` });
    return;
  }
  res.json({ plan, baselineNodes: session.baseline.nodes });
});

trips.post('/:id/recovery-plans/:planId/select', (req, res) => {
  const session = store.requireSession(req.params.id);
  store.recoveryPlans(session);
  const updated = store.selectPlan(session, req.params.planId);
  const plan = updated.plans.find((p) => p.id === req.params.planId)!;
  res.json({ ...overview(updated), plan, baselineNodes: updated.baseline.nodes });
});

trips.get('/:id/alternatives', (req, res) => {
  const session = store.requireSession(req.params.id);
  const party = session.trip.travellers.length;
  const byId = new Map(session.trip.nodes.map((n) => [n.id, n]));

  const transport = transportOptions
    .filter((o) => byId.has(o.replacesNodeId))
    .map((o) => {
      const original = byId.get(o.replacesNodeId)!;
      return {
        ...o,
        replaces: original.title,
        durationMinutes: durationMinutes(o.depart, o.arrive),
        priceDelta: o.price - original.cost,
        refundImpact: original.refundable
          ? `${original.refundPercent}% of ₹${original.cost.toLocaleString('en-IN')} recoverable`
          : `₹${original.cost.toLocaleString('en-IN')} is non-refundable and would be lost`,
        available: o.seatsLeft >= party,
        availability:
          o.seatsLeft >= party
            ? `${o.seatsLeft} seats left`
            : `Only ${o.seatsLeft} seat${o.seatsLeft === 1 ? '' : 's'} — your party is ${party}`,
      };
    })
    .sort((a, b) => ms(a.depart) - ms(b.depart));

  const stays = stayOptions
    .filter((o) => byId.has(o.replacesNodeId))
    .map((o) => {
      const original = byId.get(o.replacesNodeId)!;
      return {
        ...o,
        replaces: original.title,
        priceDelta: o.pricePerNight - Math.round(original.cost / Math.max(1, Math.round(durationMinutes(original.start, original.end) / 1440))),
        available: true,
        availability: 'Rooms available',
        refundImpact: o.refundable ? 'Free cancellation' : 'Non-refundable rate',
      };
    });

  const slots = activitySlots
    .filter((s) => byId.has(s.nodeId))
    .map((s) => {
      const original = byId.get(s.nodeId)!;
      return {
        ...s,
        title: original.title,
        current: ms(s.start) === ms(original.start),
        available: s.capacity >= party,
        availability: s.capacity >= party ? `${s.capacity} places` : `Only ${s.capacity} places`,
      };
    });

  res.json({ transport, stays, slots, party });
});

/* ------------------------------------------------------------------ */
/* Scenarios, history, preferences, assistant                         */
/* ------------------------------------------------------------------ */

trips.get('/:id/scenarios', (req, res) => {
  const session = store.requireSession(req.params.id);
  res.json({ scenarios: scenarioCatalogue(session.trip) });
});

trips.post('/:id/scenarios', (req, res) => {
  const session = store.requireSession(req.params.id);
  const body = req.body ?? {};
  const catalogue = scenarioCatalogue(session.trip);
  const chosen = body.scenarioId ? catalogue.find((s) => s.id === body.scenarioId) : undefined;

  const disruption: Disruption = chosen
    ? chosen.disruption
    : {
        id: body.id ?? 'scenario-adhoc',
        tripId: session.trip.id,
        nodeId: body.nodeId,
        type: (body.type as DisruptionType) ?? 'FLIGHT_DELAYED',
        delayMinutes: Number(body.delayMinutes ?? 0),
        headline: body.headline ?? 'Custom scenario',
        detail: body.detail ?? 'Ad-hoc what-if.',
        source: 'SIMULATION',
        detectedAt: new Date().toISOString(),
        simulated: true,
      };

  if (!session.trip.nodes.some((n) => n.id === disruption.nodeId)) {
    res.status(400).json({ error: `Unknown booking: ${disruption.nodeId}` });
    return;
  }

  // Simulations are read-only against the live trip.
  res.json(simulate(session.trip, disruption));
});

trips.get('/:id/history', (req, res) => {
  const session = store.requireSession(req.params.id);
  res.json({ events: store.historyFeed(session) });
});

trips.post('/:id/preferences', (req, res) => {
  const session = store.requireSession(req.params.id);
  const updated = store.updatePreferences(session, req.body ?? {});
  res.json(overview(updated));
});

trips.post('/:id/priorities', (req, res) => {
  const session = store.requireSession(req.params.id);
  const updated = store.updatePreferences(session, { priorities: req.body?.priorities ?? [] });
  res.json(overview(updated));
});

trips.post('/:id/assistant', async (req, res) => {
  const session = store.requireSession(req.params.id);
  const text = String(req.body?.text ?? '').trim();
  if (!text) {
    res.status(400).json({ error: 'Say something for the assistant to read.' });
    return;
  }

  const intent = await interpret(text, session.trip);
  const hasConstraints =
    Object.keys(intent.preferences).length > 0 ||
    Object.keys(intent.safety).length > 0 ||
    intent.priorities.length > 0;

  if (hasConstraints) {
    store.updatePreferences(session, {
      preferences: intent.preferences,
      safety: intent.safety,
      priorities: intent.priorities,
    });
  }

  let planCount = 0;
  let recommendation: string | null = null;
  if (session.cascade) {
    const result = store.recoveryPlans(session);
    planCount = result.plans.length;
    recommendation = result.recommendation;
  }

  res.json({
    intent,
    applied: hasConstraints,
    planCount,
    recommendation,
    trip: overview(session),
  });
});
