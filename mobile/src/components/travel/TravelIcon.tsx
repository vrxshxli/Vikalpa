/**
 * The product's icon language.
 *
 * All drawn as single-weight line art on a 24-unit grid, so every glyph reads
 * like the same pen on the same paper. No emoji anywhere in the UI.
 *
 * Combination icons — "flight + warning", "hotel + rain", "suitcase + shield" —
 * come from the `badge` prop rather than from separate artwork, which keeps the
 * set small and the pairings infinite.
 */
import React, { memo } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, G, Path, Polyline } from 'react-native-svg';

import { colors } from '@/theme';

export type IconName =
  | 'plane'
  | 'planeUp'
  | 'luggage'
  | 'map'
  | 'compass'
  | 'ticket'
  | 'passport'
  | 'hotel'
  | 'train'
  | 'bus'
  | 'transfer'
  | 'cruise'
  | 'mountain'
  | 'waves'
  | 'sun'
  | 'moon'
  | 'cloud'
  | 'rain'
  | 'wind'
  | 'pin'
  | 'camera'
  | 'coffee'
  | 'warning'
  | 'shield'
  | 'recovery'
  | 'clock'
  | 'heart'
  | 'calendar'
  | 'globe'
  | 'route'
  | 'stamp'
  | 'check'
  | 'cross'
  | 'arrowRight'
  | 'arrowDown'
  | 'plus'
  | 'minus'
  | 'chevron'
  | 'spark'
  | 'binoculars'
  | 'signal'
  | 'lock';

/** Path geometry only — colour and weight are applied by the wrapper. */
const GLYPHS: Record<IconName, (p: { c: string; w: number }) => React.ReactNode> = {
  plane: ({ c, w }) => (
    <Path
      d="M11.1 3.1c.4-1.1 1.4-1.1 1.8 0v6.6l8 4.1v1.9l-8-2.2v4.2l2.5 2v1.3l-3.4-1-3.4 1v-1.3l2.5-2v-4.2l-8 2.2v-1.9l8-4.1z"
      stroke={c}
      strokeWidth={w}
      fill="none"
      strokeLinejoin="round"
    />
  ),
  planeUp: ({ c, w }) => (
    <>
      <Path d="M3 14.5 20.5 4l-6.5 16.5-2.8-6.2z" stroke={c} strokeWidth={w} fill="none" strokeLinejoin="round" />
      <Path d="M11.2 14.3 20.5 4" stroke={c} strokeWidth={w} fill="none" strokeLinecap="round" />
    </>
  ),
  luggage: ({ c, w }) => (
    <>
      <Path d="M4.5 8h15v11.5a1.5 1.5 0 0 1-1.5 1.5H6a1.5 1.5 0 0 1-1.5-1.5z" stroke={c} strokeWidth={w} fill="none" strokeLinejoin="round" />
      <Path d="M9 8V4.8a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1V8" stroke={c} strokeWidth={w} fill="none" strokeLinecap="round" />
      <Path d="M9.5 12v5M14.5 12v5" stroke={c} strokeWidth={w * 0.8} fill="none" strokeLinecap="round" />
    </>
  ),
  map: ({ c, w }) => (
    <>
      <Path d="M3 6.5 9 4.5l6 2 6-2v13l-6 2-6-2-6 2z" stroke={c} strokeWidth={w} fill="none" strokeLinejoin="round" />
      <Path d="M9 4.5v13M15 6.5v13" stroke={c} strokeWidth={w * 0.8} fill="none" />
    </>
  ),
  compass: ({ c, w }) => (
    <>
      <Circle cx={12} cy={12} r={8.5} stroke={c} strokeWidth={w} fill="none" />
      <Path d="M15.2 8.8 10.5 10.5 8.8 15.2 13.5 13.5z" stroke={c} strokeWidth={w} fill="none" strokeLinejoin="round" />
    </>
  ),
  ticket: ({ c, w }) => (
    <>
      <Path d="M3 8.5h18v3a2.5 2.5 0 0 0 0 5v3H3v-3a2.5 2.5 0 0 0 0-5z" stroke={c} strokeWidth={w} fill="none" strokeLinejoin="round" />
      <Path d="M12 10v1.5M12 14v1.5M12 18v1" stroke={c} strokeWidth={w * 0.85} strokeLinecap="round" />
    </>
  ),
  passport: ({ c, w }) => (
    <>
      <Path d="M5 3.5h11.5A2.5 2.5 0 0 1 19 6v14.5H7.5A2.5 2.5 0 0 1 5 18z" stroke={c} strokeWidth={w} fill="none" strokeLinejoin="round" />
      <Circle cx={12} cy={10.5} r={2.8} stroke={c} strokeWidth={w * 0.85} fill="none" />
      <Path d="M9 16h6" stroke={c} strokeWidth={w * 0.85} strokeLinecap="round" />
    </>
  ),
  hotel: ({ c, w }) => (
    <>
      <Path d="M3.5 20.5V6.5l8.5-3 8.5 3v14" stroke={c} strokeWidth={w} fill="none" strokeLinejoin="round" />
      <Path d="M8 20.5v-5h8v5" stroke={c} strokeWidth={w} fill="none" strokeLinejoin="round" />
      <Path d="M8.5 10.5h2.5M13 10.5h2.5" stroke={c} strokeWidth={w * 0.85} strokeLinecap="round" />
    </>
  ),
  train: ({ c, w }) => (
    <>
      <Path d="M6 3.5h12a1.5 1.5 0 0 1 1.5 1.5v10a1.5 1.5 0 0 1-1.5 1.5H6A1.5 1.5 0 0 1 4.5 15V5A1.5 1.5 0 0 1 6 3.5z" stroke={c} strokeWidth={w} fill="none" strokeLinejoin="round" />
      <Path d="M4.5 9h15" stroke={c} strokeWidth={w * 0.85} />
      <Path d="M8 16.5 5.5 20.5M16 16.5l2.5 4" stroke={c} strokeWidth={w} strokeLinecap="round" />
      <Circle cx={8.6} cy={12.8} r={1} fill={c} />
      <Circle cx={15.4} cy={12.8} r={1} fill={c} />
    </>
  ),
  bus: ({ c, w }) => (
    <>
      <Path d="M4 5.5h16v10H4z" stroke={c} strokeWidth={w} fill="none" strokeLinejoin="round" />
      <Path d="M4 10h16" stroke={c} strokeWidth={w * 0.85} />
      <Circle cx={7.5} cy={18} r={1.9} stroke={c} strokeWidth={w} fill="none" />
      <Circle cx={16.5} cy={18} r={1.9} stroke={c} strokeWidth={w} fill="none" />
    </>
  ),
  transfer: ({ c, w }) => (
    <>
      <Path d="M3.5 15.5v-3l2-4.5a2 2 0 0 1 1.8-1.2h9.4a2 2 0 0 1 1.8 1.2l2 4.5v3z" stroke={c} strokeWidth={w} fill="none" strokeLinejoin="round" />
      <Path d="M5.5 12.5h13" stroke={c} strokeWidth={w * 0.8} />
      <Circle cx={7.2} cy={17.4} r={1.7} stroke={c} strokeWidth={w} fill="none" />
      <Circle cx={16.8} cy={17.4} r={1.7} stroke={c} strokeWidth={w} fill="none" />
    </>
  ),
  cruise: ({ c, w }) => (
    <>
      <Path d="M3.5 14.5h17l-2 5.5H5.5z" stroke={c} strokeWidth={w} fill="none" strokeLinejoin="round" />
      <Path d="M6.5 14.5V10h11v4.5" stroke={c} strokeWidth={w} fill="none" strokeLinejoin="round" />
      <Path d="M12 10V3.5" stroke={c} strokeWidth={w} strokeLinecap="round" />
      <Path d="M12 4.5 17 8h-5" stroke={c} strokeWidth={w * 0.85} fill="none" strokeLinejoin="round" />
    </>
  ),
  mountain: ({ c, w }) => (
    <>
      <Path d="M2 19.5 9 7l4.5 7.5" stroke={c} strokeWidth={w} fill="none" strokeLinejoin="round" />
      <Path d="M11 19.5 16 10.5l6 9z" stroke={c} strokeWidth={w} fill="none" strokeLinejoin="round" />
      <Path d="M2 19.5h20" stroke={c} strokeWidth={w} strokeLinecap="round" />
    </>
  ),
  waves: ({ c, w }) => (
    <Path
      d="M2 8.5c2.5-2 4.5-2 7 0s4.5 2 7 0 4.5-2 6 0M2 13.5c2.5-2 4.5-2 7 0s4.5 2 7 0 4.5-2 6 0M2 18.5c2.5-2 4.5-2 7 0s4.5 2 7 0 4.5-2 6 0"
      stroke={c}
      strokeWidth={w}
      fill="none"
      strokeLinecap="round"
    />
  ),
  sun: ({ c, w }) => (
    <>
      <Circle cx={12} cy={12} r={4.5} stroke={c} strokeWidth={w} fill="none" />
      <Path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M5 5l1.8 1.8M17.2 17.2 19 19M19 5l-1.8 1.8M6.8 17.2 5 19" stroke={c} strokeWidth={w} strokeLinecap="round" />
    </>
  ),
  moon: ({ c, w }) => (
    <Path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z" stroke={c} strokeWidth={w} fill="none" strokeLinejoin="round" />
  ),
  cloud: ({ c, w }) => (
    <Path d="M6.5 17.5h11a3.5 3.5 0 0 0 .3-7 5.5 5.5 0 0 0-10.5-1 3.9 3.9 0 0 0-.8 8z" stroke={c} strokeWidth={w} fill="none" strokeLinejoin="round" />
  ),
  rain: ({ c, w }) => (
    <>
      <Path d="M6.5 14.5h11a3.5 3.5 0 0 0 .3-7 5.5 5.5 0 0 0-10.5-1 3.9 3.9 0 0 0-.8 8z" stroke={c} strokeWidth={w} fill="none" strokeLinejoin="round" />
      <Path d="M8.5 17.5 7.5 20.5M12 17.5 11 21M15.5 17.5 14.5 20.5" stroke={c} strokeWidth={w} strokeLinecap="round" />
    </>
  ),
  wind: ({ c, w }) => (
    <Path
      d="M2 8h11a3 3 0 1 0-3-3M2 13h15M2 18h9a3 3 0 1 1-3 3"
      stroke={c}
      strokeWidth={w}
      fill="none"
      strokeLinecap="round"
    />
  ),
  pin: ({ c, w }) => (
    <>
      <Path d="M12 21.5s7-6 7-11a7 7 0 1 0-14 0c0 5 7 11 7 11z" stroke={c} strokeWidth={w} fill="none" strokeLinejoin="round" />
      <Circle cx={12} cy={10} r={2.6} stroke={c} strokeWidth={w * 0.85} fill="none" />
    </>
  ),
  camera: ({ c, w }) => (
    <>
      <Path d="M3.5 7.5h4l1.5-2.5h6L16.5 7.5h4v12h-17z" stroke={c} strokeWidth={w} fill="none" strokeLinejoin="round" />
      <Circle cx={12} cy={13.5} r={3.6} stroke={c} strokeWidth={w} fill="none" />
    </>
  ),
  coffee: ({ c, w }) => (
    <>
      <Path d="M4.5 8h12v6.5a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4z" stroke={c} strokeWidth={w} fill="none" strokeLinejoin="round" />
      <Path d="M16.5 9.5h1.8a2.2 2.2 0 0 1 0 4.5h-1.8" stroke={c} strokeWidth={w} fill="none" strokeLinejoin="round" />
      <Path d="M8 4.5c0 1-1 1.5-1 2.5M12 4c0 1-1 1.5-1 2.5" stroke={c} strokeWidth={w * 0.8} strokeLinecap="round" />
    </>
  ),
  warning: ({ c, w }) => (
    <>
      <Path d="M12 3.8 21.5 20H2.5z" stroke={c} strokeWidth={w} fill="none" strokeLinejoin="round" />
      <Path d="M12 9.5v5" stroke={c} strokeWidth={w} strokeLinecap="round" />
      <Circle cx={12} cy={17.3} r={0.95} fill={c} />
    </>
  ),
  shield: ({ c, w }) => (
    <Path d="M12 2.8 20 5.6v6.2c0 4.9-3.4 8.3-8 9.4-4.6-1.1-8-4.5-8-9.4V5.6z" stroke={c} strokeWidth={w} fill="none" strokeLinejoin="round" />
  ),
  recovery: ({ c, w }) => (
    <>
      <Path d="M20 12a8 8 0 1 1-2.9-6.2" stroke={c} strokeWidth={w} fill="none" strokeLinecap="round" />
      <Polyline points="20.5,3.5 20.5,8 16,8" stroke={c} strokeWidth={w} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  clock: ({ c, w }) => (
    <>
      <Circle cx={12} cy={12} r={8.6} stroke={c} strokeWidth={w} fill="none" />
      <Polyline points="12,6.8 12,12 16,14.2" stroke={c} strokeWidth={w} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  heart: ({ c, w }) => (
    <Path d="M12 20.5S3.5 15.4 3.5 9.6A4.6 4.6 0 0 1 12 7a4.6 4.6 0 0 1 8.5 2.6c0 5.8-8.5 10.9-8.5 10.9z" stroke={c} strokeWidth={w} fill="none" strokeLinejoin="round" />
  ),
  calendar: ({ c, w }) => (
    <>
      <Path d="M4 6.5h16v14H4z" stroke={c} strokeWidth={w} fill="none" strokeLinejoin="round" />
      <Path d="M4 11h16M8.5 3.5V7M15.5 3.5V7" stroke={c} strokeWidth={w * 0.9} strokeLinecap="round" />
    </>
  ),
  globe: ({ c, w }) => (
    <>
      <Circle cx={12} cy={12} r={8.6} stroke={c} strokeWidth={w} fill="none" />
      <Path d="M3.5 12h17" stroke={c} strokeWidth={w * 0.85} />
      <Path d="M12 3.4c3 2.4 3 14.2 0 17.2-3-3-3-14.8 0-17.2z" stroke={c} strokeWidth={w * 0.85} fill="none" />
    </>
  ),
  route: ({ c, w }) => (
    <>
      <Circle cx={5.5} cy={18.5} r={2.4} stroke={c} strokeWidth={w} fill="none" />
      <Circle cx={18.5} cy={5.5} r={2.4} stroke={c} strokeWidth={w} fill="none" />
      <Path d="M7.6 17c3.4-.6 4.2-3 4.4-5s1-4.2 4.3-4.9" stroke={c} strokeWidth={w} fill="none" strokeLinecap="round" strokeDasharray="2.6 2.6" />
    </>
  ),
  stamp: ({ c, w }) => (
    <>
      <Path d="M4.5 4.5h15v15h-15z" stroke={c} strokeWidth={w} fill="none" strokeDasharray="2.4 2.2" />
      <Circle cx={12} cy={12} r={4.2} stroke={c} strokeWidth={w * 0.9} fill="none" />
    </>
  ),
  check: ({ c, w }) => (
    <Polyline points="4,13 9.5,18.5 20,6.5" stroke={c} strokeWidth={w * 1.15} fill="none" strokeLinecap="round" strokeLinejoin="round" />
  ),
  cross: ({ c, w }) => (
    <Path d="M6 6l12 12M18 6 6 18" stroke={c} strokeWidth={w * 1.1} strokeLinecap="round" />
  ),
  arrowRight: ({ c, w }) => (
    <>
      <Path d="M3.5 12h16" stroke={c} strokeWidth={w} strokeLinecap="round" />
      <Polyline points="14,6.5 19.5,12 14,17.5" stroke={c} strokeWidth={w} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  arrowDown: ({ c, w }) => (
    <>
      <Path d="M12 3.5v16" stroke={c} strokeWidth={w} strokeLinecap="round" />
      <Polyline points="6.5,14 12,19.5 17.5,14" stroke={c} strokeWidth={w} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  plus: ({ c, w }) => <Path d="M12 5v14M5 12h14" stroke={c} strokeWidth={w * 1.1} strokeLinecap="round" />,
  minus: ({ c, w }) => <Path d="M5 12h14" stroke={c} strokeWidth={w * 1.1} strokeLinecap="round" />,
  chevron: ({ c, w }) => (
    <Polyline points="9,5.5 16,12 9,18.5" stroke={c} strokeWidth={w} fill="none" strokeLinecap="round" strokeLinejoin="round" />
  ),
  spark: ({ c, w }) => (
    <Path d="M12 3.5 13.8 9.6 20 11.5 13.8 13.4 12 19.5 10.2 13.4 4 11.5 10.2 9.6z" stroke={c} strokeWidth={w} fill="none" strokeLinejoin="round" />
  ),
  binoculars: ({ c, w }) => (
    <>
      <Circle cx={6.8} cy={15} r={4} stroke={c} strokeWidth={w} fill="none" />
      <Circle cx={17.2} cy={15} r={4} stroke={c} strokeWidth={w} fill="none" />
      <Path d="M6.8 11 8 5h3v6M17.2 11 16 5h-3v6" stroke={c} strokeWidth={w} fill="none" strokeLinejoin="round" />
    </>
  ),
  signal: ({ c, w }) => (
    <>
      <Circle cx={12} cy={18.5} r={1.7} fill={c} />
      <Path d="M8 14.5a5.5 5.5 0 0 1 8 0M5 11a9.8 9.8 0 0 1 14 0" stroke={c} strokeWidth={w} fill="none" strokeLinecap="round" />
    </>
  ),
  lock: ({ c, w }) => (
    <>
      <Path d="M5.5 10.5h13v10h-13z" stroke={c} strokeWidth={w} fill="none" strokeLinejoin="round" />
      <Path d="M8.5 10.5V7.8a3.5 3.5 0 0 1 7 0v2.7" stroke={c} strokeWidth={w} fill="none" strokeLinecap="round" />
    </>
  ),
};

export interface TravelIconProps {
  name: IconName;
  size?: number;
  color?: string;
  /** Stroke weight in grid units; scales with size. */
  weight?: number;
  /** Corner overlay that turns any glyph into a combination icon. */
  badge?: IconName;
  badgeColor?: string;
  badgeBackground?: string;
  style?: StyleProp<ViewStyle>;
  /** Decorative by default; pass a label when the icon carries meaning alone. */
  label?: string;
}

export const TravelIcon = memo(function TravelIcon({
  name,
  size = 22,
  color = colors.inkSoft,
  weight = 1.5,
  badge,
  badgeColor = colors.white,
  badgeBackground = colors.coralInk,
  style,
  label,
}: TravelIconProps) {
  const glyph = GLYPHS[name] ?? GLYPHS.pin;
  const badgeSize = Math.round(size * 0.52);

  return (
    <View
      style={[{ width: size, height: size }, style]}
      accessible={Boolean(label)}
      accessibilityRole={label ? 'image' : undefined}
      accessibilityLabel={label}
      importantForAccessibility={label ? 'yes' : 'no-hide-descendants'}
    >
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <G>{glyph({ c: color, w: weight })}</G>
      </Svg>

      {badge ? (
        <View
          style={{
            position: 'absolute',
            right: -badgeSize * 0.22,
            bottom: -badgeSize * 0.22,
            width: badgeSize,
            height: badgeSize,
            borderRadius: badgeSize / 2,
            backgroundColor: badgeBackground,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Svg width={badgeSize * 0.72} height={badgeSize * 0.72} viewBox="0 0 24 24">
            {(GLYPHS[badge] ?? GLYPHS.warning)({ c: badgeColor, w: 2.6 })}
          </Svg>
        </View>
      ) : null}
    </View>
  );
});

/** Booking kind → glyph. One mapping, used by every screen. */
export const kindIcon: Record<string, IconName> = {
  FLIGHT: 'plane',
  TRAIN: 'train',
  BUS: 'bus',
  TRANSFER: 'transfer',
  HOTEL: 'hotel',
  ACTIVITY: 'ticket',
};

/** World-signal kind → glyph. */
export const signalIcon: Record<string, IconName> = {
  WEATHER: 'cloud',
  AIRPORT: 'plane',
  TRANSPORT: 'train',
  ADVISORY: 'shield',
  DISRUPTION: 'warning',
  STRIKE: 'wind',
  DISASTER: 'waves',
};

/** Risk kind → glyph, so a vulnerability always looks like the same thing. */
export const riskIcon: Record<string, IconName> = {
  TIGHT_CONNECTION: 'clock',
  WEATHER_EXPOSURE: 'rain',
  NO_BUFFER: 'calendar',
  LATE_ARRIVAL: 'moon',
  NON_REFUNDABLE: 'lock',
  SINGLE_POINT_OF_FAILURE: 'route',
  DENSE_DAY: 'calendar',
};
