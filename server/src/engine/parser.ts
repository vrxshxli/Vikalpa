/**
 * Itinerary parser.
 *
 * In the MVP this recognises the seeded demo booking set rather than doing real
 * OCR — but the shape is the shape a real parser would have, so swapping in a
 * PDF/vision pipeline means implementing `ItineraryParser` and nothing else.
 */
import type { Trip } from '../types.js';
import { buildSeedTrip } from '../data/index.js';
import { TripGraph } from './graph.js';

export type ImportSource = 'PDF' | 'SCREENSHOT' | 'CONNECTED_ACCOUNT' | 'DEMO';

export interface ParseStage {
  key: string;
  label: string;
  detail: string;
  /** Rough share of total work, for the progress animation. */
  weight: number;
}

export interface ParseResult {
  trip: Trip;
  stages: ParseStage[];
  recognised: { kind: string; title: string; confidence: number }[];
  summary: string;
}

export interface ItineraryParser {
  name: string;
  parse(source: ImportSource, fileName?: string): Promise<ParseResult>;
}

function stagesFor(source: ImportSource, fileName?: string): ParseStage[] {
  const label = fileName ?? (source === 'SCREENSHOT' ? 'screenshot.png' : 'itinerary.pdf');
  return [
    {
      key: 'read',
      label: 'Reading document',
      detail: source === 'CONNECTED_ACCOUNT' ? 'Pulling bookings from the connected account' : `Opening ${label}`,
      weight: 0.15,
    },
    {
      key: 'extract',
      label: 'Extracting bookings',
      detail: 'Finding flight numbers, reference codes, dates and times',
      weight: 0.3,
    },
    {
      key: 'recognise',
      label: 'Recognising suppliers',
      detail: 'Matching airlines, hotels and activity operators',
      weight: 0.2,
    },
    {
      key: 'locate',
      label: 'Connecting locations',
      detail: 'Resolving airports, neighbourhoods and time zones',
      weight: 0.2,
    },
    {
      key: 'graph',
      label: 'Building your trip',
      detail: 'Linking each booking to the ones that depend on it',
      weight: 0.15,
    },
  ];
}

export const seededParser: ItineraryParser = {
  name: 'seeded',
  async parse(source, fileName) {
    const trip = buildSeedTrip();
    const graph = TripGraph.of(trip);
    const radius = graph.blastRadius();

    const recognised = trip.nodes.map((node) => ({
      kind: node.kind,
      title: `${node.title}${node.ref ? ` · ${node.ref}` : ''}`,
      // Documents give up transport details cleanly; activity descriptions less so.
      confidence: node.kind === 'ACTIVITY' ? 0.88 : node.ref ? 0.97 : 0.92,
    }));

    const dependencies = trip.edges.length;
    const critical = [...radius.entries()].sort((a, b) => b[1] - a[1])[0];

    return {
      trip,
      stages: stagesFor(source, fileName),
      recognised,
      summary: `${trip.nodes.length} bookings, ${dependencies} dependencies, ${trip.travellers.length} travellers. ${
        critical ? `${graph.node(critical[0]).title} carries ${critical[1]} downstream bookings.` : ''
      }`.trim(),
    };
  },
};

export async function importItinerary(source: ImportSource, fileName?: string): Promise<ParseResult> {
  return seededParser.parse(source, fileName);
}
