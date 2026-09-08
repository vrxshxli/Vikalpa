/**
 * Recovery assistant — natural language in, optimizer constraints out.
 *
 * Deliberate division of labour:
 *   • Language model (or the rule-based fallback) reads INTENT out of free text.
 *   • It never proposes, ranks, or justifies a recovery plan.
 *   • The deterministic engine takes those constraints and does the rest.
 *
 * That boundary is the whole point: a model that cannot invent an itinerary
 * cannot hallucinate one.
 */
import type { Preferences, Priority, SafetyConstraints, Trip } from '../types.js';

export interface AssistantReading {
  label: string;
  value: string;
}

export interface AssistantIntent {
  preferences: Partial<Preferences>;
  safety: Partial<SafetyConstraints>;
  priorities: { nodeId: string; priority: Priority }[];
  readings: AssistantReading[];
  reply: string;
  source: 'RULES' | 'LLM';
}

export interface LanguageModel {
  name: string;
  extract(text: string, trip: Trip): Promise<AssistantIntent>;
}

/* ------------------------------------------------------------------ */
/* Rule-based reader — always available, no network, no API key        */
/* ------------------------------------------------------------------ */

interface Rule {
  test: RegExp;
  apply: (intent: AssistantIntent, trip: Trip, match: RegExpExecArray) => void;
}

const RULES: Rule[] = [
  {
    test: /(don'?t|do not|doesn'?t) (care|mind) about (the )?(extra )?(cost|money|price|budget)|cost (is )?(no|not an) (object|issue)|whatever it costs|money is not/i,
    apply: (i) => {
      i.preferences.budget = 12;
      i.readings.push({ label: 'Budget sensitivity', value: 'LOW' });
    },
  },
  {
    test: /cheapest|as cheap as|lowest cost|save money|tight budget|on a budget|keep (the )?cost/i,
    apply: (i) => {
      i.preferences.budget = 92;
      i.readings.push({ label: 'Budget sensitivity', value: 'HIGH' });
    },
  },
  {
    test: /(don'?t|do not|dont) want to miss (the |my )?(?<what>[a-z\s'&-]+)|must (do|see) (the |my )?(?<what2>[a-z\s'&-]+)|(?<what3>[a-z\s'&-]+) is non[- ]negotiable/i,
    apply: (i, trip, match) => {
      const phrase = (match.groups?.what ?? match.groups?.what2 ?? match.groups?.what3 ?? '').trim();
      const node = matchNode(trip, phrase);
      i.preferences.experience = 95;
      i.readings.push({ label: 'Experience priority', value: 'HIGH' });
      if (node) {
        i.priorities.push({ nodeId: node.id, priority: 'MUST_DO' });
        i.readings.push({ label: node.title, value: 'MUST DO' });
      }
    },
  },
  {
    test: /(happy to |ok(ay)? to |fine to )?(drop|skip|lose|give up) (the |my )?(?<what>[a-z\s'&-]+)/i,
    apply: (i, trip, match) => {
      const node = matchNode(trip, (match.groups?.what ?? '').trim());
      if (node) {
        i.priorities.push({ nodeId: node.id, priority: 'OPTIONAL' });
        i.readings.push({ label: node.title, value: 'OPTIONAL' });
      }
    },
  },
  {
    test: /no late night|avoid late[- ]night|nothing after midnight|not arriving late|no red[- ]eye/i,
    apply: (i) => {
      i.safety.avoidLateNightArrival = true;
      i.preferences.safety = 90;
      i.readings.push({ label: 'Late-night arrivals', value: 'AVOID' });
    },
  },
  {
    test: /as (fast|quick|soon) as|fastest|get (there|home) quickly|minimi[sz]e (the )?travel|less time in transit/i,
    apply: (i) => {
      i.preferences.time = 90;
      i.readings.push({ label: 'Time sensitivity', value: 'HIGH' });
    },
  },
  {
    test: /take it slow|relaxed|no rush|slow(er)? pace|not too packed/i,
    apply: (i) => {
      i.preferences.pace = 'RELAXED';
      i.preferences.comfort = 85;
      i.readings.push({ label: 'Pace', value: 'RELAXED' });
    },
  },
  {
    test: /pack(ed)? (it )?in|fast[- ]paced|see as much as|cram/i,
    apply: (i) => {
      i.preferences.pace = 'FAST';
      i.readings.push({ label: 'Pace', value: 'FAST-PACED' });
    },
  },
  {
    test: /comfort|comfortable|business class|nice hotel|don'?t want to rough/i,
    apply: (i) => {
      i.preferences.comfort = 88;
      i.readings.push({ label: 'Comfort', value: 'HIGH' });
    },
  },
  {
    test: /keep (the |our )?group together|stay together|all of us together|don'?t split/i,
    apply: (i) => {
      i.safety.keepGroupTogether = true;
      i.readings.push({ label: 'Group', value: 'KEEP TOGETHER' });
    },
  },
  {
    test: /step[- ]free|wheelchair|accessible|mobility/i,
    apply: (i) => {
      i.safety.preferAccessibleTransport = true;
      i.readings.push({ label: 'Transport', value: 'ACCESSIBLE ONLY' });
    },
  },
  {
    test: /verified|licensed|official (taxi|transfer)|trusted driver/i,
    apply: (i) => {
      i.safety.preferVerifiedTransfers = true;
      i.readings.push({ label: 'Transfers', value: 'VERIFIED ONLY' });
    },
  },
  {
    test: /safe(ty|st)?|feel safe|security/i,
    apply: (i) => {
      i.preferences.safety = Math.max(i.preferences.safety ?? 0, 88);
      i.readings.push({ label: 'Safety weighting', value: 'HIGH' });
    },
  },
];

function normalise(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Loose token-overlap match from a phrase to an itinerary item. */
function matchNode(trip: Trip, phrase: string) {
  if (!phrase) return undefined;
  const words = normalise(phrase).split(' ').filter((w) => w.length > 2);
  if (!words.length) return undefined;
  let best: { node: Trip['nodes'][number]; score: number } | undefined;
  for (const node of trip.nodes) {
    const haystack = normalise(`${node.title} ${node.subtitle ?? ''} ${node.provider ?? ''}`);
    const score = words.filter((w) => haystack.includes(w)).length;
    if (score > 0 && (!best || score > best.score)) best = { node, score };
  }
  return best?.node;
}

export const ruleBasedModel: LanguageModel = {
  name: 'rules',
  async extract(text, trip) {
    const intent: AssistantIntent = {
      preferences: {},
      safety: {},
      priorities: [],
      readings: [],
      reply: '',
      source: 'RULES',
    };

    for (const rule of RULES) {
      const match = rule.test.exec(text);
      if (match) rule.apply(intent, trip, match);
    }

    // De-duplicate readings, last write wins per label.
    const byLabel = new Map(intent.readings.map((r) => [r.label, r]));
    intent.readings = [...byLabel.values()];

    intent.reply = intent.readings.length
      ? `Understood — ${intent.readings.map((r) => `${r.label.toLowerCase()} → ${r.value.toLowerCase()}`).join(', ')}. Re-running the planner with those constraints.`
      : 'I could not pull a clear constraint out of that. Try naming what matters — an experience you refuse to lose, a budget limit, or a time you will not travel after.';

    return intent;
  },
};

/* ------------------------------------------------------------------ */
/* Claude-backed reader — used when a key is available                 */
/* ------------------------------------------------------------------ */

const EXTRACTION_SYSTEM = `You read a traveller's message and convert it into optimizer constraints for a
trip-recovery engine. You do NOT plan trips, propose alternatives, or justify recommendations —
a deterministic engine does that. Only report what the traveller stated or clearly implied.

Preference fields are 0-100 weights. Higher "budget" means MORE cost-sensitive.
Leave any field out when the message says nothing about it. Never guess.`;

const EXTRACTION_TOOL = {
  name: 'record_constraints',
  description: "Record the constraints found in the traveller's message.",
  input_schema: {
    type: 'object' as const,
    additionalProperties: false,
    properties: {
      budget: { type: 'number', description: '0-100 cost sensitivity; higher = more cost-sensitive' },
      time: { type: 'number', description: '0-100 weight on minimising time in transit' },
      experience: { type: 'number', description: '0-100 weight on preserving experiences' },
      comfort: { type: 'number', description: '0-100 weight on convenience and comfort' },
      safety: { type: 'number', description: '0-100 weight on safety constraints' },
      pace: { type: 'string', enum: ['FAST', 'BALANCED', 'RELAXED'] },
      avoidLateNightArrival: { type: 'boolean' },
      preferVerifiedTransfers: { type: 'boolean' },
      preferAccessibleTransport: { type: 'boolean' },
      keepGroupTogether: { type: 'boolean' },
      mustDoNodeIds: {
        type: 'array',
        items: { type: 'string' },
        description: 'Itinerary node ids the traveller refuses to lose',
      },
      optionalNodeIds: {
        type: 'array',
        items: { type: 'string' },
        description: 'Itinerary node ids the traveller is willing to give up',
      },
      readings: {
        type: 'array',
        description: 'Short label/value pairs to show the traveller what was understood',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: { label: { type: 'string' }, value: { type: 'string' } },
          required: ['label', 'value'],
        },
      },
    },
    required: ['readings'],
  },
  strict: true,
};

export function claudeModel(apiKey: string): LanguageModel {
  return {
    name: 'claude-opus-5',
    async extract(text, trip) {
      const { default: Anthropic } = await import('@anthropic-ai/sdk');
      const client = new Anthropic({ apiKey });

      const itinerary = trip.nodes
        .map((n) => `${n.id} | ${n.kind} | ${n.title} | priority ${n.priority}`)
        .join('\n');

      const response = await client.messages.create({
        model: 'claude-opus-5',
        max_tokens: 4000,
        system: EXTRACTION_SYSTEM,
        tools: [EXTRACTION_TOOL],
        messages: [
          {
            role: 'user',
            content: `Itinerary items:\n${itinerary}\n\nTraveller said: "${text}"\n\nRecord the constraints.`,
          },
        ],
      });

      const call = response.content.find((b) => b.type === 'tool_use');
      if (!call || call.type !== 'tool_use') {
        return ruleBasedModel.extract(text, trip);
      }
      const args = call.input as Record<string, any>;

      const preferences: Partial<Preferences> = {};
      for (const key of ['budget', 'time', 'experience', 'comfort', 'safety'] as const) {
        if (typeof args[key] === 'number') preferences[key] = Math.max(0, Math.min(100, args[key]));
      }
      if (args.pace) preferences.pace = args.pace;

      const safety: Partial<SafetyConstraints> = {};
      for (const key of [
        'avoidLateNightArrival',
        'preferVerifiedTransfers',
        'preferAccessibleTransport',
        'keepGroupTogether',
      ] as const) {
        if (typeof args[key] === 'boolean') safety[key] = args[key];
      }

      const known = new Set(trip.nodes.map((n) => n.id));
      const priorities: AssistantIntent['priorities'] = [];
      for (const id of args.mustDoNodeIds ?? []) {
        if (known.has(id)) priorities.push({ nodeId: id, priority: 'MUST_DO' });
      }
      for (const id of args.optionalNodeIds ?? []) {
        if (known.has(id)) priorities.push({ nodeId: id, priority: 'OPTIONAL' });
      }

      const readings: AssistantReading[] = (args.readings ?? []).filter(
        (r: any) => typeof r?.label === 'string' && typeof r?.value === 'string',
      );

      return {
        preferences,
        safety,
        priorities,
        readings,
        reply: readings.length
          ? `Understood — ${readings.map((r) => `${r.label.toLowerCase()} → ${r.value.toLowerCase()}`).join(', ')}. Re-running the planner with those constraints.`
          : 'I could not pull a clear constraint out of that. Tell me what you refuse to lose, or what you will not do.',
        source: 'LLM',
      };
    },
  };
}

/**
 * The active reader. Falls back to rules when no key is configured, which keeps
 * the whole demo working offline.
 */
export function resolveModel(): LanguageModel {
  const key = process.env.ANTHROPIC_API_KEY;
  return key ? claudeModel(key) : ruleBasedModel;
}

export async function interpret(text: string, trip: Trip): Promise<AssistantIntent> {
  const model = resolveModel();
  try {
    return await model.extract(text, trip);
  } catch (error) {
    // A model outage must never take the recovery flow down with it.
    const fallback = await ruleBasedModel.extract(text, trip);
    fallback.reply = `${fallback.reply} (read locally — the language model was unavailable)`;
    return fallback;
  }
}
