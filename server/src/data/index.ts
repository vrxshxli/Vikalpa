/**
 * Seed loader.
 *
 * The JSON files are the "database": they use foreign keys into places.json
 * exactly as a relational store would. This module resolves those keys into
 * fully hydrated domain objects, and is the ONLY place that knows the raw
 * on-disk shape. Swapping in a real datastore means reimplementing this file.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import type {
  ActivitySlot,
  Disruption,
  DisruptionType,
  NodeKind,
  Place,
  RiskSignal,
  SeasonalRisk,
  StayOption,
  TransportOption,
  Trip,
  TripEdge,
  TripNode,
} from '../types.js';
import { dayIndex } from '../engine/time.js';

const HERE = dirname(fileURLToPath(import.meta.url));

function readJson<T>(name: string): T {
  return JSON.parse(readFileSync(join(HERE, name), 'utf8')) as T;
}

const placesRaw = readJson<Record<string, Place>>('places.json');
const tripRaw = readJson<any>('trip.json');
const inventoryRaw = readJson<any>('inventory.json');
const signalsRaw = readJson<any[]>('signals.json');
const seasonalRaw = readJson<SeasonalRisk[]>('seasonal.json');
const disruptionsRaw = readJson<any>('disruptions.json');

export const places: Record<string, Place> = placesRaw;

export function place(key: string): Place {
  const p = places[key];
  if (!p) throw new Error(`Unknown place key: ${key}`);
  return p;
}

function hydrateNode(raw: any, tripStart: string): TripNode {
  return {
    id: raw.id,
    kind: raw.kind as NodeKind,
    title: raw.title,
    subtitle: raw.subtitle,
    provider: raw.provider,
    ref: raw.ref,
    start: raw.start,
    end: raw.end,
    from: raw.fromKey ? place(raw.fromKey) : undefined,
    to: raw.toKey ? place(raw.toKey) : undefined,
    location: raw.locationKey
      ? place(raw.locationKey)
      : raw.toKey
        ? place(raw.toKey)
        : undefined,
    cost: raw.cost,
    currency: 'INR',
    refundable: raw.refundable,
    refundPercent: raw.refundPercent,
    priority: raw.priority,
    flexibility: {
      canMove: raw.flexibility?.canMove ?? false,
      slackMinutes: raw.flexibility?.slackMinutes ?? 0,
      alternateSlots: raw.flexibility?.alternateSlots,
      earliest: raw.flexibility?.earliest,
      latest: raw.flexibility?.latest,
    },
    openingHours: raw.openingHours,
    weatherSensitive: raw.weatherSensitive ?? false,
    verifiedOperator: raw.verifiedOperator ?? false,
    day: raw.day ?? dayIndex(raw.start, tripStart),
    status: 'SAFE',
    notes: raw.notes,
  };
}

/** A fresh, un-disrupted copy of the demo trip. */
export function buildSeedTrip(): Trip {
  const nodes = tripRaw.nodes.map((n: any) => hydrateNode(n, tripRaw.startDate));
  const edges: TripEdge[] = tripRaw.edges;
  return {
    id: tripRaw.id,
    title: tripRaw.title,
    origin: place(tripRaw.originKey),
    destination: place(tripRaw.destinationKey),
    waypoints: (tripRaw.waypointKeys ?? []).map((k: string) => place(k)),
    startDate: tripRaw.startDate,
    endDate: tripRaw.endDate,
    travellers: tripRaw.travellers,
    nodes,
    edges,
    preferences: tripRaw.preferences,
    safety: tripRaw.safety,
    group: tripRaw.group,
    currency: 'INR',
    totalCost: nodes.reduce((sum: number, n: TripNode) => sum + n.cost, 0),
    status: 'ON_TRACK',
    createdAt: new Date().toISOString(),
  };
}

export const transportOptions: TransportOption[] = inventoryRaw.transport.map((t: any) => ({
  id: t.id,
  kind: t.kind as NodeKind,
  provider: t.provider,
  ref: t.ref,
  from: place(t.fromKey),
  to: place(t.toKey),
  depart: t.depart,
  arrive: t.arrive,
  price: t.price,
  seatsLeft: t.seatsLeft,
  refundable: t.refundable,
  verifiedOperator: t.verifiedOperator,
  replacesNodeId: t.replacesNodeId,
  notes: t.notes,
}));

export const stayOptions: StayOption[] = inventoryRaw.stays.map((s: any) => ({
  id: s.id,
  provider: s.provider,
  name: s.name,
  location: place(s.locationKey),
  pricePerNight: s.pricePerNight,
  refundable: s.refundable,
  checkInFrom: s.checkInFrom,
  checkOutBy: s.checkOutBy,
  nearEmergencyFacilities: s.nearEmergencyFacilities,
  replacesNodeId: s.replacesNodeId,
  rating: s.rating,
}));

export const activitySlots: ActivitySlot[] = inventoryRaw.activitySlots;

export const riskSignals: RiskSignal[] = signalsRaw.map((s) => ({
  id: s.id,
  kind: s.kind,
  severity: s.severity,
  headline: s.headline,
  body: s.body,
  place: place(s.placeKey),
  relatedNodeIds: s.relatedNodeIds,
  tripImpact: s.tripImpact,
  observedAt: s.observedAt,
  live: s.live,
  confidence: s.confidence,
}));

export const seasonalRisks: SeasonalRisk[] = seasonalRaw;

function hydrateDisruption(raw: any, tripId: string, simulated: boolean): Disruption {
  return {
    id: raw.id,
    tripId,
    nodeId: raw.nodeId,
    type: raw.type as DisruptionType,
    delayMinutes: raw.delayMinutes ?? 0,
    headline: raw.headline,
    detail: raw.detail,
    source: raw.source,
    detectedAt: raw.detectedAt,
    simulated,
  };
}

export function seededFeed(tripId: string): Disruption[] {
  return disruptionsRaw.feed.map((d: any) => hydrateDisruption(d, tripId, false));
}

export function disruptionCatalogue(tripId: string): Disruption[] {
  return disruptionsRaw.catalogue.map((d: any) => hydrateDisruption(d, tripId, true));
}

export const quickActions: {
  id: string;
  label: string;
  prompt: string;
  kinds: NodeKind[];
  types: DisruptionType[];
}[] = disruptionsRaw.quickActions;
