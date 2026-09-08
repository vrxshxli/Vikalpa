/**
 * Shared UI primitives, in the companion's voice.
 *
 * Anything appearing on more than one screen lives here, so the product reads
 * as one continuous space rather than 25 designs. Surfaces are soft rounded
 * panels; emphasis comes from light and colour temperature rather than from
 * borders and stamps.
 */
import React, { useEffect, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import Animated, {
  Easing,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

import {
  colors,
  dur,
  glow,
  gutter,
  maxContent,
  mood,
  motion,
  paper,
  radius,
  severityMood,
  severityWord,
  space,
  statusStyle,
  touch,
  type,
  useReducedMotion,
} from '@/theme';
import { TravelIcon, type IconName } from '@/components/travel/TravelIcon';
import { SkyGradient, SceneThumb, type SceneVariant } from '@/components/scene/Scene';
import * as haptic from '@/utils/haptics';

/* ------------------------------------------------------------------ */
/* Type                                                               */
/* ------------------------------------------------------------------ */

type TypeKey = keyof typeof type;

export function Txt({
  variant = 'body',
  color = colors.ink,
  style,
  children,
  numberOfLines,
  accessibilityRole,
}: {
  variant?: TypeKey;
  color?: string;
  style?: StyleProp<TextStyle>;
  children: ReactNode;
  numberOfLines?: number;
  accessibilityRole?: 'header' | 'text';
}) {
  return (
    <Text
      numberOfLines={numberOfLines}
      accessibilityRole={accessibilityRole}
      style={[type[variant], { color }, style]}
    >
      {children}
    </Text>
  );
}

/** Small caps marker. */
export function Eyebrow({
  children,
  color = colors.inkMuted,
  style,
}: {
  children: ReactNode;
  color?: string;
  style?: StyleProp<TextStyle>;
}) {
  return <Text style={[type.stamp, { color }, style]}>{String(children).toUpperCase()}</Text>;
}

/** A softer aside, for notes the engine adds in the margin. */
export function Annotation({
  children,
  color = colors.inkMuted,
  style,
}: {
  children: ReactNode;
  color?: string;
  style?: StyleProp<TextStyle>;
}) {
  return <Text style={[type.hand, { color }, style]}>{children}</Text>;
}

/* ------------------------------------------------------------------ */
/* Layout                                                             */
/* ------------------------------------------------------------------ */

export function Row({
  children,
  style,
  gap = 8,
  align = 'center',
  justify,
  wrap,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  gap?: number;
  align?: ViewStyle['alignItems'];
  justify?: ViewStyle['justifyContent'];
  wrap?: boolean;
}) {
  return (
    <View
      style={[
        { flexDirection: 'row', alignItems: align, gap, justifyContent: justify, flexWrap: wrap ? 'wrap' : 'nowrap' },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function Spacer({ h = 12 }: { h?: number }) {
  return <View style={{ height: h }} />;
}

export function Divider({ style, dashed }: { style?: StyleProp<ViewStyle>; dashed?: boolean }) {
  if (dashed) {
    return (
      <View
        style={[{ borderTopWidth: 1, borderStyle: 'dashed', borderColor: colors.frost }, style]}
      />
    );
  }
  return <View style={[{ height: StyleSheet.hairlineWidth * 2, backgroundColor: colors.rule }, style]} />;
}

/**
 * Every screen body sits in this. Handles the page colour, an optional sky
 * behind the content, responsive gutters, a reading measure on tablets, and
 * room for the nav bar.
 */
export function ScreenScaffold({
  children,
  scroll = true,
  scene,
  bg = colors.mist,
  contentStyle,
  refreshControl,
  footer,
}: {
  children: ReactNode;
  scroll?: boolean;
  /** A very faint sky behind the page. Omit for a plain surface. */
  scene?: SceneVariant;
  bg?: string;
  contentStyle?: StyleProp<ViewStyle>;
  refreshControl?: React.ComponentProps<typeof ScrollView>['refreshControl'];
  /** Rendered outside the scroll area, pinned to the bottom. */
  footer?: ReactNode;
}) {
  const { width } = useWindowDimensions();
  const pad = gutter(width);

  const inner = (
    <View style={[{ width: '100%', maxWidth: maxContent, alignSelf: 'center' }, contentStyle]}>{children}</View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: bg }}>
      {scene ? (
        <View style={styles.pageSky} pointerEvents="none" importantForAccessibility="no-hide-descendants">
          <SkyGradient variant={scene} />
          <LinearGradient
            colors={['rgba(246,248,255,0.25)', colors.mist]}
            locations={[0, 0.9]}
            style={styles.absolute}
          />
        </View>
      ) : null}

      {scroll ? (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            paddingHorizontal: pad,
            paddingTop: space(4),
            paddingBottom: footer ? space(8) : space(26),
          }}
          showsVerticalScrollIndicator={false}
          refreshControl={refreshControl}
        >
          {inner}
        </ScrollView>
      ) : (
        <View style={{ flex: 1, paddingHorizontal: pad, paddingTop: space(4) }}>{inner}</View>
      )}
      {footer}
    </View>
  );
}

/**
 * Screen heading: a small marker, a friendly title, a line of orientation, and
 * a rounded scene chip in the corner.
 */
export function ChapterHeader({
  marker,
  title,
  standfirst,
  scene,
  right,
  style,
}: {
  marker?: string;
  title: string;
  standfirst?: string;
  /** A small scene chip in the corner, in place of the old margin doodle. */
  scene?: SceneVariant;
  right?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[{ marginBottom: space(5) }, style]}>
      <Row justify="space-between" align="flex-start">
        <View style={{ flex: 1, paddingRight: space(3) }}>
          {marker ? <Eyebrow color={colors.indigo}>{marker}</Eyebrow> : null}
          <Txt variant="chapter" accessibilityRole="header" style={{ marginTop: marker ? space(2) : 0 }}>
            {title}
          </Txt>
        </View>
        {right ?? (scene ? <SceneThumb variant={scene} size={58} style={{ marginTop: space(2) }} /> : null)}
      </Row>
      {standfirst ? (
        <Txt variant="small" color={colors.inkMuted} style={{ marginTop: space(3) }}>
          {standfirst}
        </Txt>
      ) : null}
    </View>
  );
}

/** Lighter heading for sections inside a screen. */
export function SectionHeader({
  eyebrow,
  title,
  subtitle,
  right,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  right?: ReactNode;
}) {
  return (
    <View style={{ marginBottom: space(3.5) }}>
      <Row justify="space-between" align="flex-end">
        <View style={{ flex: 1, paddingRight: space(2) }}>
          {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
          <Txt variant="h2" accessibilityRole="header" style={{ marginTop: eyebrow ? 4 : 0 }}>
            {title}
          </Txt>
        </View>
        {right}
      </Row>
      {subtitle ? (
        <Txt variant="small" color={colors.inkMuted} style={{ marginTop: 6 }}>
          {subtitle}
        </Txt>
      ) : null}
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Badges                                                             */
/* ------------------------------------------------------------------ */

export function Pill({
  label,
  fg = colors.inkSoft,
  bg = colors.haze,
  style,
  dot,
  icon,
}: {
  label: string;
  fg?: string;
  bg?: string;
  style?: StyleProp<ViewStyle>;
  dot?: boolean;
  icon?: IconName;
}) {
  return (
    <View style={[styles.pill, { backgroundColor: bg }, style]}>
      {dot ? <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: fg, marginRight: 6 }} /> : null}
      {icon ? <TravelIcon name={icon} size={12} color={fg} weight={1.8} style={{ marginRight: 5 }} /> : null}
      <Text style={[type.stamp, { color: fg }]} numberOfLines={1}>
        {label.toUpperCase()}
      </Text>
    </View>
  );
}

export function StatusPill({ status, style }: { status: string; style?: StyleProp<ViewStyle> }) {
  const s = statusStyle(status);
  return <Pill label={s.label} fg={s.ink} bg={s.fill} dot style={style} />;
}

/**
 * Severity in plain language. The traveller sees "Needs attention" rather than
 * a band name or a number — the maths stays in the engine.
 */
export function RiskBadge({
  severity,
  kind,
  style,
}: {
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  kind?: IconName;
  style?: StyleProp<ViewStyle>;
}) {
  const m = mood[severityMood[severity]];
  return <Pill label={severityWord[severity]} fg={m.ink} bg={m.fill} icon={kind} style={style} />;
}

export const SeverityPill = RiskBadge;

export function StatusDot({ status, size = 10 }: { status: string; size?: number }) {
  const s = statusStyle(status);
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: s.ink,
      }}
    />
  );
}

/* ------------------------------------------------------------------ */
/* Controls                                                           */
/* ------------------------------------------------------------------ */

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  style,
  icon,
  size = 'regular',
  accessibilityHint,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  icon?: IconName;
  size?: 'regular' | 'large';
  accessibilityHint?: string;
}) {
  const palette = {
    primary: { bg: colors.indigo, fg: colors.white, border: 'transparent', lift: colors.indigo },
    secondary: { bg: colors.cloud, fg: colors.indigo, border: colors.periMid, lift: null },
    ghost: { bg: 'transparent', fg: colors.indigo, border: 'transparent', lift: null },
    danger: { bg: colors.coralInk, fg: colors.white, border: 'transparent', lift: colors.coral },
  }[variant];

  const height = size === 'large' ? touch.hero : touch.min;

  return (
    <Pressable
      onPress={() => {
        if (disabled || loading) return;
        haptic.light();
        onPress();
      }}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: Boolean(disabled || loading), busy: Boolean(loading) }}
      style={({ pressed }) => [
        styles.button,
        {
          minHeight: height,
          backgroundColor: palette.bg,
          borderColor: palette.border,
          borderWidth: palette.border === 'transparent' ? 0 : 1.4,
        },
        // Emphasis is a soft coloured glow rather than a hard shadow.
        palette.lift ? glow(palette.lift, 0.34) : null,
        (disabled || loading) && { opacity: 0.45, shadowOpacity: 0 },
        pressed && styles.pressedButton,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={palette.fg} />
      ) : (
        <Row gap={9}>
          {icon ? <TravelIcon name={icon} size={17} color={palette.fg} weight={1.9} /> : null}
          <Text style={[type.h3, { color: palette.fg, fontSize: 15 }]}>{label}</Text>
        </Row>
      )}
    </Pressable>
  );
}

/**
 * The primary action, pinned above the nav bar. A traveller holding luggage
 * should never have to scroll to find the next step.
 */
export function StickyCTA({
  label,
  onPress,
  loading,
  disabled,
  icon,
  note,
  secondary,
}: {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  icon?: IconName;
  note?: string;
  secondary?: { label: string; onPress: () => void };
}) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  return (
    <View
      style={[
        styles.stickyWrap,
        { paddingHorizontal: gutter(width), paddingBottom: Math.max(insets.bottom, space(3)) + space(1) },
      ]}
    >
      <View style={{ width: '100%', maxWidth: maxContent, alignSelf: 'center' }}>
        {note ? (
          <Txt variant="meta" color={colors.inkMuted} style={{ marginBottom: space(2), textAlign: 'center' }}>
            {note}
          </Txt>
        ) : null}
        <Button label={label} onPress={onPress} loading={loading} disabled={disabled} icon={icon} size="large" />
        {secondary ? (
          <Pressable
            onPress={secondary.onPress}
            accessibilityRole="button"
            style={{ minHeight: touch.min, alignItems: 'center', justifyContent: 'center' }}
          >
            <Txt variant="small" color={colors.inkMuted}>
              {secondary.label}
            </Txt>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

export function Chip({
  label,
  active,
  onPress,
  style,
  icon,
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  icon?: IconName;
}) {
  return (
    <Pressable
      onPress={() => {
        if (!onPress) return;
        haptic.tap();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityState={{ selected: Boolean(active) }}
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.chip,
        active ? { backgroundColor: colors.indigo, borderColor: colors.indigo } : null,
        active ? glow(colors.indigo, 0.26) : null,
        pressed && styles.pressed,
        style,
      ]}
    >
      <Row gap={7}>
        {icon ? <TravelIcon name={icon} size={14} color={active ? colors.white : colors.inkMuted} weight={1.7} /> : null}
        <Text
          style={[active ? type.h3 : type.small, { color: active ? colors.white : colors.inkSoft, fontSize: 13.5 }]}
          numberOfLines={1}
        >
          {label}
        </Text>
      </Row>
    </Pressable>
  );
}

/* ------------------------------------------------------------------ */
/* Meters                                                             */
/* ------------------------------------------------------------------ */

/**
 * A soft rounded gauge with a gradient fill and a glowing cap.
 *
 * `showValue` exists because the product deliberately hides abstract scores:
 * the fill width carries the reading, and the digits are dropped. Money and
 * durations still print, because those are real quantities.
 */
export function MetricBar({
  label,
  value,
  display,
  showValue = true,
  tint = colors.indigo,
  hint,
}: {
  label: string;
  /** 0–100. */
  value: number;
  display?: string;
  showValue?: boolean;
  tint?: string;
  hint?: string;
}) {
  const reduced = useReducedMotion();
  const grow = useSharedValue(reduced ? 1 : 0);
  const pct = Math.max(2, Math.min(100, value));

  useEffect(() => {
    grow.value = withTiming(1, { duration: dur(motion.settle, reduced) });
  }, [grow, reduced, value]);

  const fill = useAnimatedStyle(() => ({ width: `${pct * grow.value}%` }));

  return (
    <View
      style={{ marginBottom: space(3.5) }}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(value), text: display }}
    >
      <Row justify="space-between" style={{ marginBottom: 7 }}>
        <Txt variant="small" color={colors.inkSoft}>
          {label}
        </Txt>
        {showValue ? (
          <Text style={[type.code, { color: colors.inkMuted }]}>{display ?? Math.round(value)}</Text>
        ) : null}
      </Row>
      <View style={styles.track}>
        <Animated.View style={[styles.fill, fill, glow(tint, 0.34)]}>
          <LinearGradient
            colors={[tint, colors.peri]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={styles.fillGradient}
          />
        </Animated.View>
      </View>
      {hint ? (
        <Txt variant="meta" color={colors.inkFaint} style={{ marginTop: 5 }}>
          {hint}
        </Txt>
      ) : null}
    </View>
  );
}

export function StatTile({
  label,
  value,
  hint,
  tint = colors.ink,
  icon,
  style,
}: {
  label: string;
  value: string;
  hint?: string;
  tint?: string;
  icon?: IconName;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.tile, style]} accessible accessibilityLabel={`${label}: ${value}${hint ? `, ${hint}` : ''}`}>
      <Row justify="space-between">
        <Eyebrow>{label}</Eyebrow>
        {icon ? <TravelIcon name={icon} size={14} color={colors.periMid} weight={1.7} /> : null}
      </Row>
      <Text style={[type.h2, { color: tint, marginTop: 5 }]} numberOfLines={1}>
        {value}
      </Text>
      {hint ? (
        <Txt variant="meta" color={colors.inkMuted} style={{ marginTop: 2 }} numberOfLines={1}>
          {hint}
        </Txt>
      ) : null}
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* States                                                             */
/* ------------------------------------------------------------------ */

/** A gently bobbing glyph, drifting like something carried on a breeze. */
export function Loading({ label = 'One moment', icon = 'cloud' }: { label?: string; icon?: IconName }) {
  const reduced = useReducedMotion();
  const bob = useSharedValue(0);

  useEffect(() => {
    if (reduced) {
      bob.value = 0;
      return;
    }
    bob.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 1200, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );
  }, [reduced, bob]);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: -6 * bob.value }],
    opacity: 0.72 + bob.value * 0.28,
  }));

  return (
    <View
      style={{ paddingVertical: space(12), alignItems: 'center', gap: space(3) }}
      accessibilityRole="progressbar"
      accessibilityLabel={label}
    >
      <Animated.View style={style}>
        <TravelIcon name={icon} size={34} color={colors.peri} weight={1.6} />
      </Animated.View>
      <Eyebrow color={colors.inkMuted}>{label}</Eyebrow>
    </View>
  );
}

export function Empty({
  title,
  body,
  action,
  icon = 'map',
  scene = 'mountain',
}: {
  title: string;
  body: string;
  action?: ReactNode;
  icon?: IconName;
  scene?: SceneVariant;
}) {
  return (
    <View style={styles.empty}>
      <SceneThumb variant={scene} size={64} style={{ marginBottom: space(4) }} />
      <Row gap={8} style={{ marginBottom: 4 }}>
        <TravelIcon name={icon} size={17} color={colors.peri} weight={1.7} />
        <Txt variant="h3">{title}</Txt>
      </Row>
      <Txt variant="small" color={colors.inkMuted} style={{ marginBottom: action ? space(4) : 0 }}>
        {body}
      </Txt>
      {action}
    </View>
  );
}

/** Staggered arrival, so a list settles onto the page rather than snapping in. */
export function Reveal({
  index = 0,
  children,
  style,
}: {
  index?: number;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const reduced = useReducedMotion();
  if (reduced) return <View style={style}>{children}</View>;
  return (
    <Animated.View
      entering={FadeInDown.delay(index * motion.stagger)
        .duration(motion.settle)
        .springify()
        .damping(motion.springSoft.damping)}
      style={style}
    >
      {children}
    </Animated.View>
  );
}

/** Progressive disclosure — the "Why?" pattern used across the product. */
export function Expandable({
  header,
  children,
  open,
  onToggle,
  accessibilityLabel,
}: {
  header: ReactNode;
  children: ReactNode;
  open: boolean;
  onToggle: () => void;
  accessibilityLabel?: string;
}) {
  const reduced = useReducedMotion();
  return (
    <View>
      <Pressable
        onPress={() => {
          haptic.tap();
          onToggle();
        }}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={accessibilityLabel}
        style={({ pressed }) => (pressed ? styles.pressed : undefined)}
      >
        {header}
      </Pressable>
      {open ? (
        <Animated.View
          entering={reduced ? undefined : FadeInDown.duration(motion.quick)}
          style={{ marginTop: space(3) }}
        >
          {children}
        </Animated.View>
      ) : null}
    </View>
  );
}

/** Kept for screens that just need a plain scrolling page. */
export function ScrollPage({ children, contentStyle }: { children: ReactNode; contentStyle?: StyleProp<ViewStyle> }) {
  return <ScreenScaffold contentStyle={contentStyle}>{children}</ScreenScaffold>;
}

const styles = StyleSheet.create({
  absolute: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  pageSky: { position: 'absolute', left: 0, right: 0, top: 0, height: 320 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
  },
  pressed: { opacity: 0.7 },
  pressedButton: { opacity: 0.92, transform: [{ scale: 0.97 }] },
  button: {
    borderRadius: radius.pill,
    paddingHorizontal: space(6),
    alignItems: 'center',
    justifyContent: 'center',
  },
  stickyWrap: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.frost,
    backgroundColor: colors.mist,
    paddingTop: space(3),
  },
  chip: {
    minHeight: 44,
    paddingHorizontal: space(4),
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderWidth: 1.3,
    borderColor: colors.frost,
    backgroundColor: colors.cloud,
  },
  track: {
    height: 10,
    borderRadius: radius.pill,
    backgroundColor: colors.haze,
    overflow: 'visible',
  },
  fill: { height: '100%', borderRadius: radius.pill, overflow: 'hidden' },
  fillGradient: { flex: 1, borderRadius: radius.pill },
  tile: {
    flex: 1,
    backgroundColor: colors.cloud,
    borderRadius: radius.lg,
    padding: space(3.5),
    ...paper.flat,
  },
  empty: {
    alignItems: 'flex-start',
    backgroundColor: colors.cloud,
    borderRadius: radius.xl,
    padding: space(5),
    ...paper.flat,
  },
});
