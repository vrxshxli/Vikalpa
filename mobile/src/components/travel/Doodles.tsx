/**
 * Page texture.
 *
 * Soft pastel light blooming behind the content — the feeling of sun through
 * haze rather than a pattern. Built from SVG radial gradients so it is a
 * handful of draw calls, renders once, and never competes with the text.
 *
 * The exports and props are unchanged from the previous line-art doodle field,
 * so every screen that already asks for texture keeps working.
 */
import React, { memo } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';

import { colors } from '@/theme';
import { TravelIcon, type IconName } from '@/components/travel/TravelIcon';

interface Bloom {
  /** Percentages of the field. */
  x: number;
  y: number;
  r: number;
  color: string;
}

/* Placed by hand so the warm blooms sit high and the cool ones settle low. */
const FIELD: Bloom[] = [
  { x: 14, y: 6, r: 30, color: colors.peach },
  { x: 82, y: 3, r: 26, color: colors.sakura },
  { x: 48, y: 16, r: 34, color: colors.periMid },
  { x: 92, y: 24, r: 22, color: colors.lilac },
  { x: 6, y: 32, r: 28, color: colors.sky },
  { x: 66, y: 40, r: 30, color: colors.peri },
  { x: 26, y: 52, r: 26, color: colors.mint },
  { x: 88, y: 58, r: 24, color: colors.sky },
  { x: 10, y: 68, r: 30, color: colors.lilac },
  { x: 56, y: 76, r: 28, color: colors.periMid },
  { x: 90, y: 86, r: 24, color: colors.sakura },
  { x: 30, y: 92, r: 26, color: colors.sky },
];

export const DoodleField = memo(function DoodleField({
  opacity = 0.5,
  tint,
  style,
  density = 1,
}: {
  opacity?: number;
  /** Force every bloom to one colour. Left unset, the field uses its own palette. */
  tint?: string;
  style?: StyleProp<ViewStyle>;
  /** 0–1; trims the field on short pages so it stays a whisper. */
  density?: number;
}) {
  const items = density >= 1 ? FIELD : FIELD.slice(0, Math.max(4, Math.round(FIELD.length * density)));

  return (
    <View
      style={[StyleSheet.absoluteFill, { opacity }, style]}
      pointerEvents="none"
      importantForAccessibility="no-hide-descendants"
    >
      <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
        <Defs>
          {items.map((b, i) => (
            <RadialGradient key={`g${i}`} id={`bloom${i}`} cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor={tint ?? b.color} stopOpacity={0.3} />
              <Stop offset="0.6" stopColor={tint ?? b.color} stopOpacity={0.11} />
              <Stop offset="1" stopColor={tint ?? b.color} stopOpacity={0} />
            </RadialGradient>
          ))}
        </Defs>
        {items.map((b, i) => (
          <Circle key={i} cx={b.x} cy={b.y} r={b.r} fill={`url(#bloom${i})`} />
        ))}
      </Svg>
    </View>
  );
});

/**
 * A single soft glyph, for placing next to a heading. Kept for screens that
 * want a light accent without a full scene chip.
 */
export const TravelDoodle = memo(function TravelDoodle({
  name,
  size = 44,
  rotate = 0,
  tint = colors.periMid,
  style,
}: {
  name: IconName;
  size?: number;
  rotate?: number;
  tint?: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View
      style={[rotate ? { transform: [{ rotate: `${rotate}deg` }] } : null, style]}
      pointerEvents="none"
      importantForAccessibility="no-hide-descendants"
    >
      <TravelIcon name={name} size={size} color={tint} weight={1.5} />
    </View>
  );
});
