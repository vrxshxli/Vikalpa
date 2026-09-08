/**
 * Surfaces.
 *
 * Everything the traveller touches is a soft rounded panel: a card, a boarding
 * pass, a small badge, a tag. Depth is a diffuse cool shadow plus an optional
 * coloured glow — no WebGL, no blur stacks, so it stays fast on a mid-range
 * phone.
 *
 * The export names and props are unchanged from the previous paper system, so
 * every screen keeps working; only what they render changed. `rotate` props
 * are still accepted and deliberately ignored — panels sit straight now.
 */
import React, { memo, useEffect, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Defs, Line, RadialGradient, Rect, Stop } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';

import { colors, glow, motion, paper, radius, space, touch, type, useReducedMotion } from '@/theme';

/* ------------------------------------------------------------------ */
/* Corner light, highlight bar, soft divider                          */
/* ------------------------------------------------------------------ */

/**
 * Light catching the corner of a panel. Replaces the old turned-up page
 * corner: the same "this is a distinct object" cue, without the paper.
 */
export const FoldedCorner = memo(function FoldedCorner({
  size = 54,
  tint = colors.peri,
}: {
  size?: number;
  tint?: string;
}) {
  return (
    <View
      style={{ position: 'absolute', top: 0, right: 0, width: size, height: size }}
      pointerEvents="none"
    >
      <Svg width={size} height={size}>
        <Defs>
          <RadialGradient id="cornerLight" cx="100%" cy="0%" r="100%">
            <Stop offset="0" stopColor={tint} stopOpacity={0.22} />
            <Stop offset="1" stopColor={tint} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x={0} y={0} width={size} height={size} fill="url(#cornerLight)" />
      </Svg>
    </View>
  );
});

/** A soft highlight bar, marking something that moved or needs a look. */
export const TapeStrip = memo(function TapeStrip({
  width = 66,
  tint = colors.peach,
  rotate: _rotate,
  style,
}: {
  width?: number;
  tint?: string;
  /** Accepted for compatibility; panels no longer rotate. */
  rotate?: number;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View
      pointerEvents="none"
      style={[{ position: 'absolute', width, height: 5, borderRadius: radius.pill, overflow: 'hidden' }, style]}
    >
      <LinearGradient
        colors={[`${tint}00`, tint, `${tint}00`]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={{ flex: 1 }}
      />
    </View>
  );
});

/** The divider between a pass and its stub. A soft dashed rule, no punch holes. */
export const Perforation = memo(function Perforation({
  vertical,
  length,
  bg: _bg,
}: {
  vertical?: boolean;
  length: number;
  /** Accepted for compatibility; nothing is punched through any more. */
  bg?: string;
}) {
  const pad = 10;
  if (vertical) {
    return (
      <View style={{ width: 12, height: length, alignItems: 'center' }} pointerEvents="none">
        <Svg width={12} height={length}>
          <Line
            x1={6}
            y1={pad}
            x2={6}
            y2={Math.max(pad, length - pad)}
            stroke={colors.frost}
            strokeWidth={1.6}
            strokeDasharray="2 5"
            strokeLinecap="round"
          />
        </Svg>
      </View>
    );
  }
  return (
    <View style={{ height: 12, width: length, justifyContent: 'center' }} pointerEvents="none">
      <Svg width={length} height={12}>
        <Line
          x1={pad}
          y1={6}
          x2={Math.max(pad, length - pad)}
          y2={6}
          stroke={colors.frost}
          strokeWidth={1.6}
          strokeDasharray="2 5"
          strokeLinecap="round"
        />
      </Svg>
    </View>
  );
});

/* ------------------------------------------------------------------ */
/* PaperCard                                                          */
/* ------------------------------------------------------------------ */

export interface PaperCardProps {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** flat = resting, lifted = a card, held = picked up. */
  depth?: 'flat' | 'lifted' | 'held';
  /** A soft rounded bar down the left edge — carries status quietly. */
  accent?: string;
  /** Accepted for compatibility; panels no longer rotate. */
  tiltIndex?: number;
  /** Adds the corner light. */
  folded?: boolean;
  tinted?: string;
  onPress?: () => void;
  accessibilityLabel?: string;
  accessibilityHint?: string;
}

export function PaperCard({
  children,
  style,
  depth = 'lifted',
  accent,
  tiltIndex: _tiltIndex,
  folded,
  tinted,
  onPress,
  accessibilityLabel,
  accessibilityHint,
}: PaperCardProps) {
  const sheet = (
    <View
      style={[
        styles.card,
        paper[depth],
        tinted ? { backgroundColor: tinted } : null,
        accent ? glow(accent, 0.12) : null,
        style,
      ]}
    >
      {accent ? <View style={[styles.accentBar, { backgroundColor: accent }]} pointerEvents="none" /> : null}
      {folded ? <FoldedCorner tint={accent ?? colors.peri} /> : null}
      {children}
    </View>
  );

  if (!onPress) return sheet;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      // The minimum has to sit on the Pressable, not on the card inside it:
      // a child's minHeight does not raise the button's own box, and the
      // button is what a thumb and a screen reader actually target. This one
      // line covers every interactive card in the product.
      style={({ pressed }) => [styles.pressTarget, pressed ? styles.pressedPaper : null]}
    >
      {sheet}
    </Pressable>
  );
}

/* ------------------------------------------------------------------ */
/* PopUpCard                                                          */
/* ------------------------------------------------------------------ */

/**
 * A panel that rises gently into place as it arrives. The old version hinged
 * on rotateX like a pop-up book; this one just drifts up and settles, which
 * suits the calmer voice.
 */
export function PopUpCard({
  children,
  index = 0,
  style,
  depth = 'lifted',
  accent,
  folded,
  tinted,
  onPress,
  accessibilityLabel,
}: PaperCardProps & { index?: number }) {
  const reduced = useReducedMotion();
  const open = useSharedValue(reduced ? 1 : 0);

  useEffect(() => {
    open.value = withDelay(
      reduced ? 0 : index * motion.stagger,
      reduced ? withTiming(1, { duration: 0 }) : withSpring(1, motion.springSoft),
    );
  }, [index, open, reduced]);

  const animated = useAnimatedStyle(() => ({
    opacity: open.value,
    transform: [{ translateY: (1 - open.value) * 14 }, { scale: 0.98 + open.value * 0.02 }],
  }));

  return (
    <Animated.View style={animated}>
      <PaperCard
        depth={depth}
        accent={accent}
        folded={folded}
        tinted={tinted}
        onPress={onPress}
        accessibilityLabel={accessibilityLabel}
        style={style}
      >
        {children}
      </PaperCard>
    </Animated.View>
  );
}

/* ------------------------------------------------------------------ */
/* TravelTicket                                                       */
/* ------------------------------------------------------------------ */

/**
 * Boarding-pass shape: a wide main panel and a narrow stub, split by a soft
 * dashed rule. Used for anything bookable — activities, alternatives,
 * recovery legs.
 */
export function TravelTicket({
  children,
  stub,
  stubWidth = 74,
  accent = colors.peri,
  onPress,
  style,
  depth = 'lifted',
  tiltIndex: _tiltIndex,
  pageBg: _pageBg,
  accessibilityLabel,
}: {
  children: ReactNode;
  stub?: ReactNode;
  stubWidth?: number;
  accent?: string;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  depth?: 'flat' | 'lifted' | 'held';
  tiltIndex?: number;
  /** Accepted for compatibility; the divider no longer punches through. */
  pageBg?: string;
  accessibilityLabel?: string;
}) {
  const [height, setHeight] = React.useState(96);

  const body = (
    <View
      style={[styles.ticket, paper[depth], style]}
      onLayout={(e) => setHeight(e.nativeEvent.layout.height)}
    >
      <View style={[styles.ticketAccent, { backgroundColor: accent }]} />
      <View style={styles.ticketMain}>{children}</View>
      {stub ? (
        <>
          <Perforation vertical length={height} />
          <View style={[styles.ticketStub, { width: stubWidth }]}>{stub}</View>
        </>
      ) : null}
    </View>
  );

  if (!onPress) return body;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => (pressed ? styles.pressedPaper : undefined)}
    >
      {body}
    </Pressable>
  );
}

/* ------------------------------------------------------------------ */
/* Badge + tag                                                        */
/* ------------------------------------------------------------------ */

/** A soft pastel badge. Statuses, verdicts, chapter marks. */
export const Stamp = memo(function Stamp({
  label,
  tint = colors.coralInk,
  fill,
  rotate: _rotate,
  style,
  icon,
}: {
  label: string;
  tint?: string;
  fill?: string;
  /** Accepted for compatibility; badges are no longer rotated. */
  rotate?: number;
  style?: StyleProp<ViewStyle>;
  icon?: ReactNode;
}) {
  return (
    <View style={[styles.stamp, { backgroundColor: fill ?? `${tint}1A` }, style]}>
      {icon}
      <Text style={[type.stamp, { color: tint }]} numberOfLines={1}>
        {label.toUpperCase()}
      </Text>
    </View>
  );
});

/** A small rounded chip — day markers, counts, prices. */
export const LuggageTag = memo(function LuggageTag({
  children,
  tint = colors.haze,
  edge = colors.frost,
  style,
}: {
  children: ReactNode;
  tint?: string;
  edge?: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.tag, { backgroundColor: tint, borderColor: edge }, style]}>{children}</View>
  );
});

/* ------------------------------------------------------------------ */
/* Section label                                                      */
/* ------------------------------------------------------------------ */

/** "DAY 02" style marker with a soft rule running off the edge. */
export function SectionLabel({
  children,
  tint = colors.inkMuted,
  rule = true,
}: {
  children: ReactNode;
  tint?: string;
  rule?: boolean;
}) {
  return (
    <View style={styles.sectionLabel}>
      <Text style={[type.stamp, { color: tint }]}>{String(children).toUpperCase()}</Text>
      {rule ? <View style={styles.sectionRule} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.cloud,
    borderRadius: radius.lg,
    padding: space(4),
    overflow: 'hidden',
  },
  accentBar: {
    position: 'absolute',
    left: 0,
    top: space(3),
    bottom: space(3),
    width: 4,
    borderTopRightRadius: radius.pill,
    borderBottomRightRadius: radius.pill,
  },
  pressTarget: { minHeight: touch.min, justifyContent: 'center' },
  pressedPaper: { opacity: 0.9, transform: [{ scale: 0.985 }] },
  ticket: {
    flexDirection: 'row',
    backgroundColor: colors.cloud,
    borderRadius: radius.lg,
    overflow: 'hidden',
    alignItems: 'stretch',
  },
  ticketAccent: { width: 5 },
  ticketMain: { flex: 1, padding: space(3.5) },
  ticketStub: {
    paddingVertical: space(3),
    paddingHorizontal: space(2),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.haze,
  },
  stamp: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: radius.pill,
    paddingHorizontal: space(2.5),
    paddingVertical: space(1.5),
    alignSelf: 'flex-start',
  },
  tag: {
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: space(3),
    paddingVertical: space(1.75),
    alignSelf: 'flex-start',
    justifyContent: 'center',
  },
  sectionLabel: { flexDirection: 'row', alignItems: 'center', gap: space(2.5), marginBottom: space(2.5) },
  sectionRule: { flex: 1, height: StyleSheet.hairlineWidth * 2, backgroundColor: colors.frost },
});
