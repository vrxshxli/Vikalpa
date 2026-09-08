/**
 * Trip state store.
 *
 * One living trip per session, plus the derived artefacts that hang off it.
 * Backed by a JSON file so a demo survives a server restart. The read/write
 * surface is deliberately narrow — swapping this for Postgres or Redis means
 * reimplementing this file and nothing above it.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type {
  CascadeResult,
  Disruption,
  GroupConstraints,
  HistoryEvent,
  HistoryKind,
  Preferences,
  Priority,
  RecoveryPlan,
  ResilienceScore,
  RiskPoint,
  SafetyConstraints,
  Trip,
  TripNode,
} from './types.js';
import { buildSeedTrip, riskSignals, seededFeed } from './data/index.js';
import { analyseRisks, resilience } from './engine/riskEngine.js';
import { applyCascadeToTrip, runCascade } from './engine/cascadeEngine.js';
import { paretoFront, searchCandidates } from './engine/recoveryPlanner.js';
import { scoreCandidates, selectPlans } from './engine/ranker.js';
import { explainRecommendation } from './engine/explain.js';
import { clock, prettyDate } from './engine/time.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(HERE, '..', '.data');
const STATE_FILE = join(DATA_DIR, 'state.json');

export interface TripSession {
  trip: Trip;
  /** The trip exactly as imported, kept for before/after comparisons. */
  baseline: Trip;
  disruption: Disruption | null;
  cascade: CascadeResult | null;
  plans: RecoveryPlan[];
  recommendation: string | null;
  selectedPlanId: string | null;
  history: HistoryEvent[];
}

const sessions = new Map<string, TripSession>();
let sequence = 0;

function nextId(prefix: string): string {
  sequence += 1;
  return `${prefix}-${Date.now().toString(36)}-${sequence}`;
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

/* ------------------------------------------------------------------ */
/* Persistence                                                        */
/* ------------------------------------------------------------------ */

function persist(): void {
  try {
    if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
    const payload = {
      version: 1,
      savedAt: new Date().toISOString(),
      sessions: [...sessions.values()],
    };
    writeFileSync(STATE_FILE, JSON.stringify(payload, null, 2), 'utf8');
  } catch (error) {
    // Persistence is a convenience; never let it break a request.
    console.warn('[store] could not persist state:', (error as Error).message);
  }
}

function restore(): void {
  try {
    if (!existsSync(STATE_FILE)) return;
    const payload = JSON.parse(readFileSync(STATE_FILE, 'utf8'));
    for (const session of payload.sessions ?? []) {
      if (session?.trip?.id) sessions.set(session.trip.id, session as TripSession);
    }
  } catch (error) {
    console.warn('[store] could not restore state:', (error as Error).message);
  }
}

restore();

/* ------------------------------------------------------------------ */
/* History                                                            */
/* ------------------------------------------------------------------ */

export function record(
  session: TripSession,
  kind: HistoryKind,
  title: string,
  detail: string,
  chain: string[] = [],
  meta?: Record<string, unknown>,
): HistoryEvent {
  const event: HistoryEvent = {
    id: nextId('evt'),
    tripId: session.trip.id,
    at: new Date().toISOString(),
    kind,
    title,
    detail,
    chain,
    meta,
  };
  session.history.unshift(event);
  return event;
}

/* ------------------------------------------------------------------ */
/* Sessions                                                           */
/* ------------------------------------------------------------------ */

function newSession(trip: Trip): TripSession {
  const session: TripSession = {
    trip,
    baseline: clone(trip),
    disruption: null,
    cascade: null,
    plans: [],
    recommendation: null,
    selectedPlanId: null,
    history: [],
  };
  record(
    session,
    'IMPORT',
    'Trip imported',
    `${trip.nodes.length} bookings and ${trip.edges.length} dependencies recognised across ${trip.travellers.length} travellers.`,
    trip.nodes.slice(0, 4).map((n) => n.title),
  );
  const risks = analyseRisks(trip, riskSignals);
  const high = risks.filter((r) => r.severity === 'HIGH');
  record(
    session,
    'RISK',
    `${risks.length} risk point${risks.length === 1 ? '' : 's'} identified`,
    high.length
      ? `${high.length} of them rated high: ${high.map((r) => r.title).join('; ')}.`
      : 'Nothing rated high severity.',
    risks.slice(0, 4).map((r) => r.title),
  );
  return session;
}

/** The trip the demo opens on. Created on first access. */
export function demoSession(): TripSession {
  const seed = buildSeedTrip();
  const existing = sessions.get(seed.id);
  if (existing) return existing;
  const session = newSession(seed);
  sessions.set(seed.id, session);
  persist();
  return session;
}

export function getSession(tripId: string): TripSession | undefined {
  if (tripId === 'demo' || tripId === 'current') return demoSession();
  return sessions.get(tripId) ?? (tripId === buildSeedTrip().id ? demoSession() : undefined);
}

export function requireSession(tripId: string): TripSession {
  const session = getSession(tripId);
  if (!session) throw Object.assign(new Error(`No trip ${tripId}`), { status: 404 });
  return session;
}

export function importTrip(): TripSession {
  const trip = buildSeedTrip();
  const session = newSession(trip);
  sessions.set(trip.id, session);
  persist();
  return session;
}

export function resetSession(tripId: string): TripSession {
  sessions.delete(tripId);
  const session = importTrip();
  persist();
  return session;
}

/* ------------------------------------------------------------------ */
/* Derived reads                                                      */
/* ------------------------------------------------------------------ */

export function tripRisks(session: TripSession): { risks: RiskPoint[]; resilience: ResilienceScore } {
  const risks = analyseRisks(session.trip, riskSignals);
  return { risks, resilience: resilience(session.trip, risks) };
}

export function signalsForTrip(session: TripSession) {
  const known = new Set(session.trip.nodes.map((n) => n.id));
  return riskSignals
    .map((signal) => ({
      ...signal,
      relatedNodeIds: signal.relatedNodeIds.filter((id) => known.has(id)),
    }))
    .sort((a, b) => {
      const rank = { HIGH: 0, MEDIUM: 1, LOW: 2 } as const;
      const connected = Number(b.relatedNodeIds.length > 0) - Number(a.relatedNodeIds.length > 0);
      return connected || rank[a.severity] - rank[b.severity];
    });
}

/** The live monitor's pending disruption, before the traveller acknowledges it. */
export function pendingDisruption(session: TripSession): Disruption | null {
  if (session.disruption) return session.disruption;
  return seededFeed(session.trip.id)[0] ?? null;
}

/* ------------------------------------------------------------------ */
/* Writes                                                             */
/* ------------------------------------------------------------------ */

export function applyDisruption(session: TripSession, incoming: Disruption): CascadeResult {
  const disruption: Disruption = { ...incoming, tripId: session.trip.id, id: incoming.id || nextId('dis') };
  const cascade = runCascade(session.trip, disruption);

  session.disruption = disruption;
  session.cascade = cascade;
  session.plans = [];
  session.recommendation = null;
  session.selectedPlanId = null;
  session.trip = applyCascadeToTrip(session.trip, cascade);

  record(
    session,
    'DETECTION',
    disruption.headline,
    disruption.detail,
    [disruption.headline],
    { nodeId: disruption.nodeId, source: disruption.source },
  );
  record(
    session,
    'CASCADE',
    'Cascade calculated',
    cascade.summary,
    cascade.impacts
      .filter((i) => i.status !== 'SAFE')
      .map((i) => `${i.title} — ${i.status.replace('_', ' ').toLowerCase()}`),
  );
  persist();
  return cascade;
}

export function recoveryPlans(session: TripSession): { plans: RecoveryPlan[]; recommendation: string } {
  if (!session.cascade) {
    throw Object.assign(new Error('No disruption to recover from'), { status: 409 });
  }
  if (session.plans.length) {
    return { plans: session.plans, recommendation: session.recommendation ?? '' };
  }

  const started = Date.now();
  const candidates = searchCandidates(session.trip, session.cascade);
  const shortlist = paretoFront(candidates);
  const plans = selectPlans(session.trip, scoreCandidates(session.trip, shortlist));
  const recommendation = explainRecommendation(session.trip, plans);

  session.plans = plans;
  session.recommendation = recommendation;
  session.trip = { ...session.trip, status: plans.length ? 'RECOVERING' : 'DISRUPTED' };

  record(
    session,
    'GENERATION',
    `${plans.length} recovery plan${plans.length === 1 ? '' : 's'} generated`,
    `${candidates.length} candidate itinerar${
      candidates.length === 1 ? 'y' : 'ies'
    } passed feasibility; ${shortlist.length} of them are genuine trade-offs rather than strictly worse copies. Ranked in ${
      Date.now() - started
    }ms.`,
    plans.map((p) => `${p.title} — ${p.metrics.experiencesPreserved}/${p.metrics.experiencesTotal} experiences`),
  );
  const recommended = plans.find((p) => p.recommended);
  if (recommended) {
    record(session, 'RECOMMENDATION', `${recommended.title} recommended`, recommendation, recommended.bullets);
  }
  persist();
  return { plans, recommendation };
}

export function selectPlan(session: TripSession, planId: string): TripSession {
  const plan = session.plans.find((p) => p.id === planId);
  if (!plan) throw Object.assign(new Error(`No plan ${planId}`), { status: 404 });

  const nodes: TripNode[] = plan.nodes.map((n) => ({ ...n, status: 'SAFE' }));
  // A plan that drops a booking would otherwise leave edges pointing at a node
  // that no longer exists. Prune them so the trip stays internally consistent.
  const present = new Set(nodes.map((n) => n.id));
  const edges = session.trip.edges.filter((e) => present.has(e.from) && present.has(e.to));

  session.trip = {
    ...session.trip,
    nodes,
    edges,
    totalCost: nodes.reduce((s, n) => s + n.cost, 0),
    status: 'RECOVERED',
    recoveredFromPlanId: plan.id,
  };
  session.selectedPlanId = plan.id;

  record(
    session,
    'SELECTION',
    `${plan.title} accepted`,
    plan.explanation,
    plan.changes.filter((c) => c.changeType !== 'UNCHANGED').map((c) => c.explanation),
  );
  record(
    session,
    'REBUILD',
    'Trip rebuilt',
    `${plan.metrics.experiencesPreserved} of ${plan.metrics.experiencesTotal} experiences saved. ${plan.metrics.changeCount} bookings changed.`,
    nodes
      .slice(0, 6)
      .map((n) => `Day ${n.day} · ${clock(n.start)} ${n.title}`),
  );
  persist();
  return session;
}

export function updatePreferences(
  session: TripSession,
  patch: {
    preferences?: Partial<Preferences>;
    safety?: Partial<SafetyConstraints>;
    group?: Partial<GroupConstraints>;
    priorities?: { nodeId: string; priority: Priority }[];
  },
): TripSession {
  const preferences = { ...session.trip.preferences, ...patch.preferences };
  preferences.summary = summarisePreferences(preferences);

  const nodes = patch.priorities?.length
    ? session.trip.nodes.map((node) => {
        const found = patch.priorities!.find((p) => p.nodeId === node.id);
        return found && node.priority !== 'FIXED' ? { ...node, priority: found.priority } : node;
      })
    : session.trip.nodes;

  session.trip = {
    ...session.trip,
    preferences,
    safety: { ...session.trip.safety, ...patch.safety },
    group: { ...session.trip.group, ...patch.group },
    nodes,
  };

  // Ranking weights and hard constraints both changed — the old deck is stale.
  session.plans = [];
  session.recommendation = null;

  record(
    session,
    'PREFERENCE',
    'Preferences updated',
    preferences.summary,
    [
      `Budget ${preferences.budget} · Time ${preferences.time} · Experience ${preferences.experience}`,
      `Comfort ${preferences.comfort} · Safety ${preferences.safety} · ${preferences.pace.toLowerCase()} pace`,
    ],
  );
  persist();
  return session;
}

export function summarisePreferences(p: Preferences): string {
  const ranked: [string, number][] = [
    ['Experience-first', p.experience],
    ['Time-first', p.time],
    ['Safety-first', p.safety],
    ['Comfort-first', p.comfort],
    ['Budget-first', p.budget],
  ];
  ranked.sort((a, b) => b[1] - a[1]);

  const lead = ranked[0][0];
  const money = p.budget >= 70 ? 'Tight budget.' : p.budget >= 40 ? 'Moderate budget.' : 'Budget is flexible.';
  const nights = p.safety >= 70 ? 'Avoid late nights.' : 'Late arrivals acceptable.';
  const pace = p.pace === 'FAST' ? 'Fast-paced days.' : p.pace === 'RELAXED' ? 'Relaxed days.' : 'Balanced days.';
  return `${lead}. ${money} ${nights} ${pace}`;
}

/** Timeline copy used by both "Recovery history" and "What changed". */
export function historyFeed(session: TripSession): HistoryEvent[] {
  return session.history;
}

export function describeTripHeadline(session: TripSession): string {
  const { trip } = session;
  const broken = trip.nodes.filter((n) => n.status === 'MISSED' || n.status === 'CANCELLED').length;
  const shaken = trip.nodes.filter((n) => n.status === 'AT_RISK' || n.status === 'AFFECTED').length;

  if (trip.status === 'RECOVERED') {
    const plan = session.plans.find((p) => p.id === session.selectedPlanId);
    return plan
      ? `Trip recovered — ${plan.metrics.experiencesPreserved} of ${plan.metrics.experiencesTotal} experiences saved`
      : 'Trip recovered';
  }
  if (broken) return `${broken} booking${broken === 1 ? '' : 's'} broken, ${shaken} at risk`;
  if (shaken) return `${shaken} connection${shaken === 1 ? '' : 's'} at risk`;
  return 'Trip is on track';
}

export function tripSubhead(session: TripSession): string {
  const { trip } = session;
  return `${prettyDate(`${trip.startDate}T12:00:00+00:00`)} – ${prettyDate(
    `${trip.endDate}T12:00:00+00:00`,
  )} · ${trip.travellers.length} traveller${trip.travellers.length === 1 ? '' : 's'}`;
}
