import { AccessibilityInfo } from 'react-native';
import { useEffect, useState } from 'react';

/**
 * VIKALPA design system — "a calm travel companion".
 *
 * The product reads as a soft anime-sky travel companion: luminous pastel
 * surfaces, rounded friendly type, and gentle scenery framing the content.
 * Colour is low-saturation and warm-cool (peach → lilac → sky), so a booking
 * turning coral still reads instantly without ever feeling like an alarm.
 */

/* ------------------------------------------------------------------ */
/* Colour                                                             */
/* ------------------------------------------------------------------ */

export const colors = {
  /* --- base: soft sky surfaces --- */
  mist: '#F6F8FF',
  cloud: '#FFFFFF',
  haze: '#EEF2FB',
  frost: '#E7ECF7',
  /** Frosted panel over scenery — text sits on this, never on a raw image. */
  glass: 'rgba(255,255,255,0.72)',
  glassDeep: 'rgba(255,255,255,0.86)',

  /* --- ink: soft slate, never pure black --- */
  ink: '#242A38',
  inkSoft: '#454C5E',
  /**
   * Darker than a "muted grey" instinct wants, deliberately. This carries
   * body copy and metadata all over the product, and the lighter #7C8598 it
   * replaced measured only 3.5:1 on `mist` — under the 4.5:1 floor. At
   * #626B7F it clears 5:1 on both `mist` and `cloud` and still reads clearly
   * quieter than `inkSoft`.
   */
  inkMuted: '#626B7F',
  /** Decorative only — never put words in this. */
  inkFaint: '#AEB6C6',
  rule: '#E5E9F2',
  ruleStrong: '#CDD5E4',

  /* --- primary: dusk indigo / periwinkle --- */
  /**
   * Deepened from #5B6CD9, which measured 4.31:1 as text on `mist` — just
   * under the floor. It is used both as a button fill behind white text and
   * as a label colour on light, so it has to clear 4.5:1 in both directions;
   * this does, at 5.5:1 on light and 5.9:1 against white.
   */
  indigo: '#4A5AC8',
  indigoDeep: '#3E4CB0',
  peri: '#8A97F0',
  periSoft: '#E9ECFF',
  periMid: '#C7CEFB',

  /* --- anime-sky accents --- */
  sky: '#7FC7E8',
  skySoft: '#E4F3FB',
  sakura: '#F2A6C0',
  sakuraSoft: '#FCE6EE',
  peach: '#F7B98C',
  peachSoft: '#FCEBDD',
  /** Disruption — soft coral, deliberately not alarm red. */
  coral: '#F08A7C',
  coralSoft: '#FCE0DC',
  amber: '#E9B252',
  amberSoft: '#FBF0D8',
  mint: '#8FD1B6',
  mintSoft: '#E1F4EC',
  lilac: '#B9A6E6',
  lilacSoft: '#F0EAFB',

  /**
   * Accessible "on light" variants of the accents above.
   *
   * The pastels are luminous by design, which makes them lovely as fills,
   * edges and glows but unusable as text — `sky` on `cloud` is only 1.9:1.
   * These deeper siblings all clear 4.5:1, so anywhere an accent carries a
   * word or a glyph it uses the *Ink form and the pastel stays decorative.
   */
  skyInk: '#2A7EA4',
  coralInk: '#C2503F',
  amberInk: '#96660F',
  mintInk: '#2F7D5E',
  sakuraInk: '#B4526F',
  lilacInk: '#6F5AA8',

  white: '#FFFFFF',
  scrim: 'rgba(36,42,56,0.46)',
  /** Shadow tint — cool blue-grey. Soft UI casts gentle cool shadows. */
  shadowTint: '#2A3350',
} as const;

/**
 * Disruption language: calm → gentle concern → focus → reassurance.
 * Never alarmist; "something shifted, and we've got this".
 *
 * `ink` is the readable foreground, `tone` the luminous pastel for glows and
 * scenery tinting, `fill`/`edge` the surface. Keys `ink`/`fill`/`edge` are
 * unchanged from the previous system so every consumer keeps working.
 */
export const mood = {
  calm: { ink: colors.skyInk, tone: colors.sky, fill: colors.skySoft, edge: colors.periMid },
  warning: { ink: colors.amberInk, tone: colors.amber, fill: colors.amberSoft, edge: '#F0DCA8' },
  disruption: { ink: colors.coralInk, tone: colors.coral, fill: colors.coralSoft, edge: '#F6C9C2' },
  recovery: { ink: colors.indigo, tone: colors.peri, fill: colors.periSoft, edge: colors.periMid },
  done: { ink: colors.inkMuted, tone: colors.inkFaint, fill: colors.haze, edge: colors.ruleStrong },
} as const;

export type MoodKey = keyof typeof mood;

export type StatusKey =
  | 'SAFE'
  | 'AT_RISK'
  | 'AFFECTED'
  | 'MISSED'
  | 'CANCELLED'
  | 'DISRUPTED'
  | 'COMPLETED';

export const statusMood: Record<StatusKey, { mood: MoodKey; label: string }> = {
  SAFE: { mood: 'calm', label: 'On track' },
  AT_RISK: { mood: 'warning', label: 'At risk' },
  AFFECTED: { mood: 'warning', label: 'Affected' },
  MISSED: { mood: 'disruption', label: 'Missed' },
  CANCELLED: { mood: 'disruption', label: 'Cancelled' },
  DISRUPTED: { mood: 'disruption', label: 'Disrupted' },
  COMPLETED: { mood: 'done', label: 'Done' },
};

export function statusStyle(status: string) {
  const entry = statusMood[status as StatusKey] ?? statusMood.SAFE;
  return { ...mood[entry.mood], label: entry.label };
}

export const severityMood: Record<'HIGH' | 'MEDIUM' | 'LOW', MoodKey> = {
  HIGH: 'disruption',
  MEDIUM: 'warning',
  LOW: 'done',
};

/**
 * Plain-language severity, for the simplified risk display. The traveller sees
 * these words instead of a severity band or a score.
 */
export const severityWord: Record<'HIGH' | 'MEDIUM' | 'LOW', string> = {
  HIGH: 'Needs attention',
  MEDIUM: 'Worth watching',
  LOW: 'Minor',
};

/* ------------------------------------------------------------------ */
/* Type                                                              */
/* ------------------------------------------------------------------ */

/**
 * Real bundled fonts, loaded in `app/_layout.tsx`.
 *
 * One family across the whole app: Baloo 2, at four weights. It is a rounded,
 * friendly, Indic-first face, which suits a product with a Hindi name — and,
 * decisively, it is the only rounded candidate here that carries every glyph
 * the app actually renders. The obvious pairing partners each dropped
 * something: M PLUS Rounded 1c has no `₹` (so every price became tofu) and no
 * Devanagari for the tagline; Nunito has `₹` but no `→` or `↓`, which the
 * masthead route and the ribbon both depend on. A second family that renders
 * a box on the price line is worse than one family that renders everything.
 *
 * Verified against the source: the only codepoints Baloo 2 lacks were `★` and
 * `✓`, both of which are now drawn as icons instead.
 */
export const fonts = {
  display: 'Baloo2_700Bold',
  displaySemi: 'Baloo2_600SemiBold',
  text: 'Baloo2_400Regular',
  medium: 'Baloo2_500Medium',
  bold: 'Baloo2_600SemiBold',
  /**
   * Kept as a role so `type.code` consumers keep working, but rounded rather
   * than monospace — codes are short enough that column alignment is not worth
   * a typeface that would break the soft feel.
   */
  mono: 'Baloo2_500Medium',
  hand: 'Baloo2_500Medium',
} as const;

/**
 * Rounded display faces look wrong when tightened, so tracking is 0 or
 * slightly positive everywhere except all-caps `stamp`. Line heights are
 * generous — Baloo has a tall ascent and the airier rhythm is the point.
 */
export const type = {
  hero: { fontFamily: fonts.display, fontSize: 40, lineHeight: 48 },
  chapter: { fontFamily: fonts.display, fontSize: 32, lineHeight: 40 },
  h1: { fontFamily: fonts.display, fontSize: 26, lineHeight: 34 },
  h2: { fontFamily: fonts.displaySemi, fontSize: 21, lineHeight: 28 },
  h3: { fontFamily: fonts.bold, fontSize: 16, lineHeight: 23 },
  body: { fontFamily: fonts.text, fontSize: 15, lineHeight: 24 },
  small: { fontFamily: fonts.text, fontSize: 13.5, lineHeight: 21 },
  meta: { fontFamily: fonts.text, fontSize: 12, lineHeight: 18 },
  /** All-caps micro-label; keeps positive tracking for legibility. */
  stamp: { fontFamily: fonts.bold, fontSize: 10.5, lineHeight: 14, letterSpacing: 1.1 },
  code: { fontFamily: fonts.mono, fontSize: 12.5, lineHeight: 17, letterSpacing: 0.2 },
  clock: { fontFamily: fonts.displaySemi, fontSize: 19, lineHeight: 25 },
  numeral: { fontFamily: fonts.display, fontSize: 52, lineHeight: 60 },
  hand: { fontFamily: fonts.hand, fontSize: 15, lineHeight: 21 },
} as const;

/* ------------------------------------------------------------------ */
/* Space, radius, elevation                                          */
/* ------------------------------------------------------------------ */

export const space = (n: number) => n * 4;

/** Rounder than the previous system — softness comes mostly from here. */
export const radius = { xs: 6, sm: 12, md: 16, lg: 22, xl: 30, pill: 999 } as const;

/** Touch targets: a stressed traveller with luggage, one hand. */
export const touch = { min: 48, comfortable: 56, hero: 64 } as const;

/**
 * Elevation. Three heights only — resting on the surface, a lifted card, and
 * something genuinely picked up. Cool-tinted and diffuse rather than crisp.
 *
 * The key names are unchanged from the previous system so every consumer keeps
 * working; only the feel changed.
 */
export const paper = {
  flat: {
    shadowColor: colors.shadowTint,
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  lifted: {
    shadowColor: colors.shadowTint,
    shadowOpacity: 0.09,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  },
  held: {
    shadowColor: colors.shadowTint,
    shadowOpacity: 0.14,
    shadowRadius: 34,
    shadowOffset: { width: 0, height: 16 },
    elevation: 12,
  },
} as const;

/**
 * A soft coloured glow, for primary actions and status emphasis. This replaces
 * the old accent-edge-and-stamp vocabulary: emphasis now comes from light.
 */
export const glow = (color: string, strength = 0.3) => ({
  shadowColor: color,
  shadowOpacity: strength,
  shadowRadius: 18,
  shadowOffset: { width: 0, height: 6 },
  elevation: 6,
});

/**
 * Cards sit straight in this system. The helper is kept so existing
 * `tiltIndex` props stay valid, but it deliberately returns no rotation.
 */
export const tiltAt = (_i: number) => 0;

/* ------------------------------------------------------------------ */
/* Motion                                                            */
/* ------------------------------------------------------------------ */

/**
 * Durations sit in the 150–500ms band so nothing ever feels like waiting.
 * `rebuild` is the one exception, reserved for the itinerary rearranging
 * itself. Springs are damped a touch more than before so everything glides.
 */
export const motion = {
  tap: 140,
  quick: 200,
  settle: 320,
  page: 480,
  /** The itinerary rearranging — the emotional payoff, allowed to breathe. */
  rebuild: 620,
  stagger: 42,
  /** Ambient cloud drift in scene headers. One slow loop, nothing else. */
  drift: 42000,
  spring: { damping: 20, stiffness: 170, mass: 0.9 },
  springSoft: { damping: 24, stiffness: 110, mass: 1 },
  springPaper: { damping: 18, stiffness: 200, mass: 0.8 },
} as const;

/**
 * Honours the OS "reduce motion" setting. Every animated surface reads this
 * and collapses to an instant state change rather than being disabled.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let alive = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (alive) setReduced(value);
    });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);
  return reduced;
}

/** Duration helper: collapses to 0 when the traveller asked for less motion. */
export const dur = (ms: number, reduced: boolean) => (reduced ? 0 : ms);

/* ------------------------------------------------------------------ */
/* Layout                                                            */
/* ------------------------------------------------------------------ */

/** Mobile is the design target; wider screens just get more margin. */
export function gutter(width: number): number {
  if (width >= 1024) return space(12);
  if (width >= 768) return space(8);
  if (width <= 360) return space(4);
  return space(5);
}

/** Content never stretches past a comfortable reading measure. */
export const maxContent = 680;
