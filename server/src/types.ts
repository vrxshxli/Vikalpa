/**
 * VIKALPA — shared domain types.
 *
 * These are duplicated (verbatim) in mobile/src/types/domain.ts so the client
 * stays type-safe against the API without a build-time package link.
 */

export type NodeKind =
  | 'FLIGHT'
  | 'TRAIN'
  | 'BUS'
  | 'TRANSFER'
  | 'HOTEL'
  | 'ACTIVITY';

/** Health of a single itinerary item inside the digital twin. */
export type NodeStatus =
  | 'SAFE'
  | 'AT_RISK'
  | 'AFFECTED'
  | 'MISSED'
  | 'CANCELLED'
  | 'DISRUPTED'
  | 'COMPLETED';

export type Priority = 'MUST_DO' | 'IMPORTANT' | 'OPTIONAL' | 'FIXED';

export type EdgeType =
  | 'REQUIRES' // B cannot start until A has completed (+ gap)
  | 'ENABLES' // A unlocks B (e.g. hotel check-in enables evening activity)
  | 'SEQUENCE' // ordering within a day
  | 'SAME_DAY' // must land on the same calendar day
  | 'LOCATION'; // B happens where A leaves you

export interface Place {
  code?: string; // IATA / station code
  name: string;
  city: string;
  country: string;
  lat: number;
  lon: number;
  /** UTC offset in minutes, e.g. 330 for IST. */
  tzOffset: number;
}

export interface OpeningHours {
  /** "HH:mm" local to the venue. */
  open: string;
  close: string;
  /** 0 = Sunday … 6 = Saturday. */
  closedDays: number[];
}

export interface Flexibility {
  canMove: boolean;
  /** ISO instants bounding where this item may be replanned. */
  earliest?: string;
  latest?: string;
  /** Concrete alternate start instants offered by the supplier. */
  alternateSlots?: string[];
  /** How many minutes it may slip before it is considered at risk. */
  slackMinutes: number;
}

export interface TripNode {
  id: string;
  kind: NodeKind;
  title: string;
  subtitle?: string;
  provider?: string;
  /** Flight number / booking reference. */
  ref?: string;
  /** ISO instants with explicit offset. */
  start: string;
  end: string;
  from?: Place;
  to?: Place;
  location?: Place;
  cost: number;
  currency: 'INR';
  refundable: boolean;
  /** 0–100, share of `cost` returned if this booking is dropped. */
  refundPercent: number;
  priority: Priority;
  flexibility: Flexibility;
  openingHours?: OpeningHours;
  weatherSensitive?: boolean;
  /** Marks a transfer as vetted/licensed — used by safety constraints. */
  verifiedOperator?: boolean;
  /** 1-indexed trip day, derived from the trip start date. */
  day: number;
  status: NodeStatus;
  notes?: string;
}

export interface TripEdge {
  id: string;
  from: string;
  to: string;
  type: EdgeType;
  /** Minimum minutes that must exist between `from.end` and `to.start`. */
  minGapMinutes: number;
  label: string;
}

export interface Traveller {
  id: string;
  name: string;
  /** Self-declared interests only — never inferred from age or gender. */
  interests: TravellerInterest[];
  accessibilityNeeds: string[];
  avatarTone: string;
}

export type TravellerInterest =
  | 'ADVENTURE'
  | 'COMFORT'
  | 'BUDGET'
  | 'RELAXATION'
  | 'ACCESSIBILITY'
  | 'SAFETY'
  | 'CULTURE'
  | 'FOOD';

export interface Preferences {
  /** All 0–100. Used directly as optimizer weights. */
  budget: number;
  time: number;
  experience: number;
  comfort: number;
  safety: number;
  pace: 'FAST' | 'BALANCED' | 'RELAXED';
  /** Free-text summary shown in the UI, regenerated whenever sliders change. */
  summary: string;
}

export interface SafetyConstraints {
  avoidLateNightArrival: boolean;
  preferVerifiedTransfers: boolean;
  avoidIsolatedLocations: boolean;
  maxTravelHoursPerDay: number;
  keepGroupTogether: boolean;
  preferAccessibleTransport: boolean;
  preferNearbyEmergencyFacilities: boolean;
}

export interface GroupConstraints {
  keepGroupTogether: boolean;
  maxTravelHoursPerDay: number;
  avoidLateNightTravel: boolean;
  priorityActivityIds: string[];
}

export interface Trip {
  id: string;
  title: string;
  origin: Place;
  destination: Place;
  waypoints: Place[];
  startDate: string;
  endDate: string;
  travellers: Traveller[];
  nodes: TripNode[];
  edges: TripEdge[];
  preferences: Preferences;
  safety: SafetyConstraints;
  group: GroupConstraints;
  currency: 'INR';
  totalCost: number;
  status: TripStatus;
  createdAt: string;
  /** Set once a recovery plan has been applied. */
  recoveredFromPlanId?: string;
}

export type TripStatus =
  | 'ON_TRACK'
  | 'AT_RISK'
  | 'DISRUPTED'
  | 'RECOVERING'
  | 'RECOVERED'
  | 'COMPLETED';

/* ------------------------------------------------------------------ */
/* Risk                                                                */
/* ------------------------------------------------------------------ */

export type RiskKind =
  | 'TIGHT_CONNECTION'
  | 'WEATHER_EXPOSURE'
  | 'NO_BUFFER'
  | 'LATE_ARRIVAL'
  | 'NON_REFUNDABLE'
  | 'SINGLE_POINT_OF_FAILURE'
  | 'DENSE_DAY';

export type Severity = 'LOW' | 'MEDIUM' | 'HIGH';

export interface RiskPoint {
  id: string;
  kind: RiskKind;
  title: string;
  severity: Severity;
  nodeIds: string[];
  whyItMatters: string;
  recommendedAction: string;
  /** Resilience points recovered if the action is taken. */
  resilienceDelta: number;
  detail: string;
}

export interface ResilienceBreakdown {
  connectionBuffer: number;
  weatherExposure: number;
  scheduleDensity: number;
  transportFlexibility: number;
  backupOptions: number;
}

export interface ResilienceScore {
  score: number;
  band: 'FRAGILE' | 'EXPOSED' | 'STABLE' | 'RESILIENT';
  breakdown: ResilienceBreakdown;
  suggestions: { id: string; label: string; delta: number; detail: string }[];
}

/* ------------------------------------------------------------------ */
/* Disruption + cascade                                                */
/* ------------------------------------------------------------------ */

export type DisruptionType =
  | 'FLIGHT_DELAYED'
  | 'FLIGHT_CANCELLED'
  | 'TRAIN_MISSED'
  | 'HOTEL_CANCELLED'
  | 'TRANSFER_FAILED'
  | 'ACTIVITY_UNAVAILABLE'
  | 'SCHEDULE_CHANGED'
  | 'WEATHER';

export interface Disruption {
  id: string;
  tripId: string;
  nodeId: string;
  type: DisruptionType;
  /** Positive = later. Ignored for cancellations. */
  delayMinutes: number;
  headline: string;
  detail: string;
  source: 'LIVE_MONITOR' | 'MANUAL' | 'SIMULATION';
  detectedAt: string;
  /** Simulations never mutate the persisted trip. */
  simulated?: boolean;
}

export interface NodeImpact {
  nodeId: string;
  title: string;
  kind: NodeKind;
  status: NodeStatus;
  previousStatus: NodeStatus;
  originalStart: string;
  projectedStart: string | null;
  delayMinutes: number;
  /** Node ids from the disruption source down to this node. */
  chain: string[];
  reason: string;
  /** Depth in the dependency graph from the disrupted node. */
  hops: number;
}

export interface CascadeResult {
  disruption: Disruption;
  impacts: NodeImpact[];
  downstreamCount: number;
  lostExperiences: string[];
  atRiskExperiences: string[];
  summary: string;
  computedAt: string;
}

/* ------------------------------------------------------------------ */
/* Recovery                                                            */
/* ------------------------------------------------------------------ */

export type RecoveryStrategy =
  | 'COMPRESS'
  | 'REARRANGE'
  | 'EXTEND'
  | 'ALTERNATE_TRANSPORT'
  | 'DROP_LOW_PRIORITY'
  | 'RESCHEDULE';

export type PlanArchetype =
  | 'SAVE_EXPERIENCES'
  | 'LOWEST_COST'
  | 'LOWEST_STRESS'
  | 'MAXIMUM_SAFETY'
  | 'FASTEST'
  | 'BALANCED'
  | 'MINIMAL_CHANGE';

export type ActionType =
  | 'REPLACE_TRANSPORT'
  | 'RESCHEDULE'
  | 'DROP'
  | 'REBOOK_STAY'
  | 'SHIFT'
  | 'KEEP';

export interface RecoveryAction {
  type: ActionType;
  nodeId: string;
  optionId?: string;
  newStart?: string;
  newEnd?: string;
  shiftMinutes?: number;
}

export interface PlanChange {
  nodeId: string;
  title: string;
  kind: NodeKind;
  changeType: 'MOVED' | 'REPLACED' | 'DROPPED' | 'UNCHANGED' | 'ADDED';
  before: string | null;
  after: string | null;
  costDelta: number;
  explanation: string;
}

export interface PlanMetrics {
  addedCost: number;
  /** Total added travel time across the trip, in minutes. */
  addedTravelMinutes: number;
  /**
   * Waking minutes left in the day after each arrival into a destination.
   * This is what separates "lands at 13:35" from "lands at 20:30" — the flights
   * are the same length, but one of them gives you an afternoon in Paris.
   */
  usableArrivalMinutes: number;
  /** Usable minutes lost against the original itinerary. */
  usableMinutesLost: number;
  experiencesPreserved: number;
  experiencesTotal: number;
  experienceValuePreserved: number; // priority-weighted, 0–1
  changeCount: number;
  lateNightArrivals: number;
  maxTravelHoursInADay: number;
  daysAffected: number;
  refundLost: number;
}

export interface PlanScores {
  cost: number;
  time: number;
  experiences: number;
  convenience: number;
  safety: number;
  total: number;
}

export interface RecoveryPlan {
  id: string;
  archetype: PlanArchetype;
  title: string;
  tagline: string;
  strategies: RecoveryStrategy[];
  actions: RecoveryAction[];
  changes: PlanChange[];
  nodes: TripNode[];
  metrics: PlanMetrics;
  scores: PlanScores;
  feasibility: FeasibilityReport;
  recommended: boolean;
  explanation: string;
  bullets: string[];
}

export interface Violation {
  rule: string;
  hard: boolean;
  nodeId?: string;
  message: string;
}

export interface FeasibilityReport {
  feasible: boolean;
  checks: { label: string; passed: boolean; detail: string }[];
  violations: Violation[];
}

export interface RankingWeights {
  costWeight: number;
  timeWeight: number;
  experienceWeight: number;
  convenienceWeight: number;
  safetyWeight: number;
}

/* ------------------------------------------------------------------ */
/* World intelligence + monitoring                                     */
/* ------------------------------------------------------------------ */

export type SignalKind =
  | 'WEATHER'
  | 'AIRPORT'
  | 'TRANSPORT'
  | 'ADVISORY'
  | 'DISRUPTION'
  | 'STRIKE'
  | 'DISASTER';

export interface RiskSignal {
  id: string;
  kind: SignalKind;
  severity: Severity;
  headline: string;
  body: string;
  place: Place;
  /** Itinerary nodes this signal actually touches. */
  relatedNodeIds: string[];
  /** Plain-language consequence for *this* trip. Never generic. */
  tripImpact: string;
  observedAt: string;
  live: boolean;
  /** Rough confidence of the feed, 0–1. */
  confidence: number;
}

export interface SeasonalRisk {
  city: string;
  month: string;
  weather: string;
  floodExposure: Severity;
  transportDisruption: Severity;
  activityAvailability: string;
  crowdLevel: Severity;
  tripImpact: string;
  recommendations: string[];
}

/* ------------------------------------------------------------------ */
/* Inventory (seeded demo supply)                                      */
/* ------------------------------------------------------------------ */

export interface TransportOption {
  id: string;
  kind: NodeKind;
  provider: string;
  ref: string;
  from: Place;
  to: Place;
  depart: string;
  arrive: string;
  price: number;
  seatsLeft: number;
  refundable: boolean;
  verifiedOperator: boolean;
  /** Which itinerary node this can substitute for. */
  replacesNodeId: string;
  notes?: string;
}

export interface StayOption {
  id: string;
  provider: string;
  name: string;
  location: Place;
  pricePerNight: number;
  refundable: boolean;
  checkInFrom: string;
  checkOutBy: string;
  nearEmergencyFacilities: boolean;
  replacesNodeId: string;
  rating: number;
}

export interface ActivitySlot {
  nodeId: string;
  start: string;
  end: string;
  capacity: number;
  price: number;
}

/* ------------------------------------------------------------------ */
/* History                                                             */
/* ------------------------------------------------------------------ */

export type HistoryKind =
  | 'IMPORT'
  | 'RISK'
  | 'DETECTION'
  | 'CASCADE'
  | 'GENERATION'
  | 'RECOMMENDATION'
  | 'SELECTION'
  | 'REBUILD'
  | 'PREFERENCE'
  | 'SIMULATION';

export interface HistoryEvent {
  id: string;
  tripId: string;
  at: string;
  kind: HistoryKind;
  title: string;
  detail: string;
  /** Expandable causal chain shown in "What changed". */
  chain: string[];
  meta?: Record<string, unknown>;
}
