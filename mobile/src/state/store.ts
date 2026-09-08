/**
 * One living trip.
 *
 * Every segment of the app reads from this store, so a disruption or an accepted
 * recovery plan updates the timeline, the digital twin, the monitor, the history
 * feed and the resilience score in the same tick. There is no per-screen state
 * that can drift out of sync with the trip.
 */
import { create } from 'zustand';

import { api, connectionState, onConnectionChange, type ConnectionState } from '@/api/client';
import type {
  AlternativesResponse,
  CatalogueResponse,
  GraphResponse,
  PlansResponse,
  RisksResponse,
  ScenarioResponse,
  SignalsResponse,
  TripOverview,
} from '@/api/client';
import type {
  CascadeResult,
  Disruption,
  HistoryEvent,
  Preferences,
  Priority,
  RecoveryPlan,
  SafetyConstraints,
  GroupConstraints,
  Trip,
  TripNode,
} from '@/types/domain';

export type Phase =
  | 'IDLE'
  | 'MONITORING'
  | 'DISRUPTED'
  | 'CASCADING'
  | 'PLANNING'
  | 'CHOOSING'
  | 'RECOVERED';

export interface ParseStage {
  key: string;
  label: string;
  detail: string;
  weight: number;
}

interface State {
  tripId: string;
  overview: TripOverview | null;
  connection: ConnectionState;

  graph: GraphResponse | null;
  risks: RisksResponse | null;
  signals: SignalsResponse | null;
  catalogue: CatalogueResponse | null;
  alternatives: AlternativesResponse | null;
  scenarios: { id: string; label: string; detail: string; disruption: Disruption }[];

  cascade: CascadeResult | null;
  cascadeNarrative: string;
  plans: RecoveryPlan[];
  recommendation: string;
  baselineNodes: TripNode[];
  selectedPlanId: string | null;
  appliedPlan: RecoveryPlan | null;

  history: HistoryEvent[];
  simulation: ScenarioResponse | null;

  parse: { stages: ParseStage[]; recognised: { kind: string; title: string; confidence: number }[]; summary: string } | null;

  /** Drives the app's motion temperament and the Recover tab's entry point. */
  phase: Phase;
  /** Node the user last inspected — shared by the timeline, twin and cascade. */
  selectedNodeId: string | null;
  loading: Record<string, boolean>;
  error: string | null;

  bootstrap: () => Promise<void>;
  refreshTrip: () => Promise<void>;
  runImport: (source: string, fileName?: string) => Promise<void>;
  loadGraph: () => Promise<void>;
  loadRisks: () => Promise<void>;
  loadSignals: () => Promise<void>;
  loadCatalogue: () => Promise<void>;
  loadAlternatives: () => Promise<void>;
  loadScenarios: () => Promise<void>;
  loadHistory: () => Promise<void>;
  triggerDisruption: (disruption: Partial<Disruption>) => Promise<void>;
  generatePlans: () => Promise<void>;
  acceptPlan: (planId: string) => Promise<void>;
  simulate: (body: { scenarioId?: string; nodeId?: string; type?: string; delayMinutes?: number }) => Promise<void>;
  clearSimulation: () => void;
  savePreferences: (patch: {
    preferences?: Partial<Preferences>;
    safety?: Partial<SafetyConstraints>;
    group?: Partial<GroupConstraints>;
  }) => Promise<void>;
  savePriorities: (priorities: { nodeId: string; priority: Priority }[]) => Promise<void>;
  selectNode: (nodeId: string | null) => void;
  setPhase: (phase: Phase) => void;
  resetTrip: () => Promise<void>;
}

const DEMO_TRIP = 'demo';

function phaseFor(overview: TripOverview | null, hasPlans: boolean): Phase {
  if (!overview) return 'IDLE';
  switch (overview.status) {
    case 'RECOVERED':
      return 'RECOVERED';
    case 'RECOVERING':
      return hasPlans ? 'CHOOSING' : 'PLANNING';
    case 'DISRUPTED':
      return 'DISRUPTED';
    case 'AT_RISK':
    case 'ON_TRACK':
    default:
      return 'MONITORING';
  }
}

export const useTrip = create<State>((set, get) => {
  onConnectionChange((connection) => set({ connection }));

  const withLoading = async <T>(key: string, fn: () => Promise<T>): Promise<T | undefined> => {
    set((s) => ({ loading: { ...s.loading, [key]: true }, error: null }));
    try {
      return await fn();
    } catch (error) {
      set({ error: (error as Error).message });
      return undefined;
    } finally {
      set((s) => ({ loading: { ...s.loading, [key]: false } }));
    }
  };

  return {
    tripId: DEMO_TRIP,
    overview: null,
    connection: connectionState(),

    graph: null,
    risks: null,
    signals: null,
    catalogue: null,
    alternatives: null,
    scenarios: [],

    cascade: null,
    cascadeNarrative: '',
    plans: [],
    recommendation: '',
    baselineNodes: [],
    selectedPlanId: null,
    appliedPlan: null,

    history: [],
    simulation: null,
    parse: null,

    phase: 'IDLE',
    selectedNodeId: null,
    loading: {},
    error: null,

    bootstrap: async () => {
      await withLoading('bootstrap', async () => {
        const overview = await api.trip(get().tripId);
        set({
          overview,
          baselineNodes: overview.trip.nodes,
          selectedPlanId: overview.selectedPlanId,
          phase: phaseFor(overview, overview.hasPlans),
        });
        // Risks and signals are what the home screen leads with.
        await Promise.all([get().loadRisks(), get().loadSignals(), get().loadHistory()]);
      });
    },

    refreshTrip: async () => {
      const overview = await api.trip(get().tripId);
      set({ overview, phase: phaseFor(overview, get().plans.length > 0) });
    },

    runImport: async (source, fileName) => {
      await withLoading('import', async () => {
        const result = await api.importTrip(source, fileName);
        set({
          overview: result,
          baselineNodes: result.trip.nodes,
          parse: { stages: result.stages, recognised: result.recognised, summary: result.parseSummary },
          cascade: null,
          plans: [],
          appliedPlan: null,
          selectedPlanId: null,
          phase: 'MONITORING',
        });
        await Promise.all([get().loadRisks(), get().loadSignals(), get().loadHistory(), get().loadGraph()]);
      });
    },

    loadGraph: async () => {
      const graph = await api.graph(get().tripId);
      set({ graph });
    },
    loadRisks: async () => {
      const risks = await api.risks(get().tripId);
      set({ risks });
    },
    loadSignals: async () => {
      const signals = await api.signals(get().tripId);
      set({ signals });
    },
    loadCatalogue: async () => {
      const catalogue = await api.catalogue(get().tripId);
      set({ catalogue });
    },
    loadAlternatives: async () => {
      const alternatives = await api.alternatives(get().tripId);
      set({ alternatives });
    },
    loadScenarios: async () => {
      const { scenarios } = await api.scenarios(get().tripId);
      set({ scenarios });
    },
    loadHistory: async () => {
      const { events } = await api.history(get().tripId);
      set({ history: events });
    },

    triggerDisruption: async (disruption) => {
      await withLoading('disruption', async () => {
        const result = await api.applyDisruption(get().tripId, disruption);
        set({
          overview: result,
          cascade: result.cascade,
          cascadeNarrative: result.narrative,
          plans: [],
          recommendation: '',
          appliedPlan: null,
          selectedPlanId: null,
          phase: 'DISRUPTED',
        });
        await Promise.all([get().loadHistory(), get().loadGraph(), get().loadRisks()]);
      });
    },

    generatePlans: async () => {
      set({ phase: 'PLANNING' });
      await withLoading('plans', async () => {
        const result: PlansResponse = await api.plans(get().tripId);
        set({
          plans: result.plans,
          recommendation: result.recommendation,
          baselineNodes: result.baselineNodes,
          phase: result.plans.length ? 'CHOOSING' : 'DISRUPTED',
        });
        await get().loadHistory();
      });
    },

    acceptPlan: async (planId) => {
      await withLoading('accept', async () => {
        const result = await api.selectPlan(get().tripId, planId);
        set({
          overview: result,
          appliedPlan: result.plan,
          selectedPlanId: planId,
          baselineNodes: result.baselineNodes,
          phase: 'RECOVERED',
        });
        await Promise.all([get().loadHistory(), get().loadGraph(), get().loadRisks()]);
      });
    },

    simulate: async (body) => {
      await withLoading('simulate', async () => {
        const simulation = await api.simulate(get().tripId, body);
        set({ simulation });
      });
    },
    clearSimulation: () => set({ simulation: null }),

    savePreferences: async (patch) => {
      await withLoading('preferences', async () => {
        const overview = await api.savePreferences(get().tripId, patch);
        // Preferences change the ranking weights, so any generated deck is stale.
        set({ overview, plans: [], recommendation: '' });
        await Promise.all([get().loadHistory(), get().loadRisks()]);
      });
    },

    savePriorities: async (priorities) => {
      await withLoading('priorities', async () => {
        const overview = await api.savePriorities(get().tripId, priorities);
        set({ overview, plans: [], recommendation: '' });
        await get().loadHistory();
      });
    },

    selectNode: (selectedNodeId) => set({ selectedNodeId }),
    setPhase: (phase) => set({ phase }),

    resetTrip: async () => {
      await withLoading('reset', async () => {
        const overview = await api.reset(get().tripId);
        set({
          overview,
          baselineNodes: overview.trip.nodes,
          cascade: null,
          cascadeNarrative: '',
          plans: [],
          recommendation: '',
          appliedPlan: null,
          selectedPlanId: null,
          simulation: null,
          selectedNodeId: null,
          phase: 'MONITORING',
        });
        await Promise.all([get().loadRisks(), get().loadSignals(), get().loadHistory(), get().loadGraph()]);
      });
    },
  };
});

/* ------------------------------------------------------------------ */
/* Selectors                                                          */
/* ------------------------------------------------------------------ */

/**
 * Selectors must return a stable identity for unchanged state — anything that
 * builds a fresh array or object on every read makes `useSyncExternalStore`
 * re-render forever. So these only ever narrow to an existing reference (or to
 * `null`), and any filtering or mapping happens in the component afterwards.
 */
export const selectTrip = (s: State): Trip | null => s.overview?.trip ?? null;

export const selectNodes = (s: State): TripNode[] | null => s.overview?.trip.nodes ?? null;

export const selectImpact = (nodeId: string) => (s: State) =>
  s.cascade?.impacts.find((i) => i.nodeId === nodeId) ?? null;

export const selectRecommended = (s: State): RecoveryPlan | null =>
  s.plans.find((p) => p.recommended) ?? s.plans[0] ?? null;

/** Nodes grouped into days, the shape most screens actually render. */
export function groupByDay(nodes: TripNode[]): { day: number; nodes: TripNode[] }[] {
  const map = new Map<number, TripNode[]>();
  for (const node of [...nodes].sort((a, b) => Date.parse(a.start) - Date.parse(b.start))) {
    if (!map.has(node.day)) map.set(node.day, []);
    map.get(node.day)!.push(node);
  }
  return [...map.entries()].sort((a, b) => a[0] - b[0]).map(([day, dayNodes]) => ({ day, nodes: dayNodes }));
}
