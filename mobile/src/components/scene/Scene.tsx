/**
 * Scenery.
 *
 * The app is framed by soft anime-adjacent landscape: pastel skies, misty
 * hills, a low sun. Two layers, and the order matters:
 *
 *   1. `SkyGradient` — hand-built gradient + SVG scenery. No network, works
 *      offline, always renders. This is the real implementation.
 *   2. A photograph fading in on top of it, from free-license stock.
 *
 * Because the gradient is always underneath, a slow network, an offline
 * session or a dead URL degrades to intentional art rather than a grey box.
 * That is what keeps the SAVED-COPY demo intact.
 *
 * Text NEVER sits on a raw photo — every scene that carries content puts a
 * `glass` frost and a bottom scrim between the two.
 */
import React, { memo, useState } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Ellipse, Path } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';

import { colors, motion, radius, useReducedMotion } from '@/theme';

export type SceneVariant =
  | 'dawn'
  | 'dusk'
  | 'storm'
  | 'night'
  | 'sea'
  | 'mountain'
  | 'city'
  | 'forest';

interface SkySpec {
  /** Four stops, top to horizon. */
  stops: readonly [string, string, string, string];
  /** Two hill bands, far then near. */
  hills: readonly [string, string];
  /** Sun or moon disc; omit for overcast. */
  disc?: string;
  stars?: boolean;
  /** Unsplash photo id — verified to resolve, and reviewed for mood. */
  photo: string;
}

const SKY: Record<SceneVariant, SkySpec> = {
  dawn: {
    stops: ['#FDE8D8', '#FBD8DF', '#E6DCFA', '#DCEBF8'],
    hills: ['#E4D7EF', '#D3C6E8'],
    disc: '#FFF1E2',
    photo: 'photo-1533387520709-752d83de3630',
  },
  dusk: {
    stops: ['#FBDCC4', '#F7C0C6', '#D9C1EE', '#BFC9F2'],
    hills: ['#C9B6E4', '#B2A3D8'],
    disc: '#FBE3CE',
    photo: 'photo-1506905925346-21bda4d32df4',
  },
  storm: {
    stops: ['#E2E8F2', '#CFD9E7', '#BCC8DC', '#AAB8CE'],
    hills: ['#B7C3D5', '#A3B0C6'],
    photo: 'photo-1464822759023-fed622ff2c3b',
  },
  night: {
    stops: ['#C6CDEB', '#A9B2DE', '#8C97CA', '#7480B8'],
    hills: ['#6E7AAE', '#5D689C'],
    disc: '#EEF1FF',
    stars: true,
    photo: 'photo-1419242902214-272b3f66ee7a',
  },
  sea: {
    stops: ['#E2F2FB', '#C8E7F6', '#ABD9EF', '#93CBE7'],
    hills: ['#9FC9DF', '#8ABBD4'],
    disc: '#FFF1E2',
    photo: 'photo-1495616811223-4d98c6e9c869',
  },
  mountain: {
    stops: ['#EAF1FA', '#DAE5F3', '#C9DAEC', '#BAD0E4'],
    hills: ['#B9CFDF', '#A3BFD2'],
    photo: 'photo-1470071459604-3b5ec3a7fe05',
  },
  city: {
    stops: ['#FBE6D8', '#F6D2D6', '#DED1EE', '#C7D4F0'],
    hills: ['#CBBEE4', '#B6A9D6'],
    disc: '#FFF1E2',
    photo: 'photo-1493976040374-85c8e12f0c0e',
  },
  forest: {
    stops: ['#E8F3E9', '#D6EBDA', '#C2E0CA', '#AED4BC'],
    hills: ['#A8CBB4', '#93BCA2'],
    photo: 'photo-1441974231531-c6227db76b6e',
  },
};

/** Store phase → the sky the traveller should be under. */
export function sceneForPhase(phase: string | undefined): SceneVariant {
  switch (phase) {
    case 'DISRUPTED':
    case 'CASCADING':
      return 'storm';
    case 'PLANNING':
    case 'CHOOSING':
      return 'mountain';
    case 'RECOVERED':
      return 'dusk';
    default:
      return 'dawn';
  }
}

function photoUrl(variant: SceneVariant, width: number): string {
  // Ask the CDN for roughly the size we will draw, so a header band does not
  // pull a 4MB original over a hotel wifi.
  return `https://images.unsplash.com/${SKY[variant].photo}?w=${width}&q=62&fit=crop&auto=format`;
}

/* ------------------------------------------------------------------ */
/* Layer 1 — the hand-built sky                                       */
/* ------------------------------------------------------------------ */

/** Two cloud banks drifting at different speeds. The only ambient motion. */
const CloudBank = memo(function CloudBank({
  tint,
  opacity,
  speed,
  y,
  reduced,
}: {
  tint: string;
  opacity: number;
  speed: number;
  y: number;
  reduced: boolean;
}) {
  const t = useSharedValue(0);

  React.useEffect(() => {
    if (reduced) {
      t.value = 0;
      return;
    }
    t.value = withRepeat(
      withTiming(1, { duration: motion.drift * speed, easing: Easing.linear }),
      -1,
      false,
    );
  }, [t, speed, reduced]);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: -60 + t.value * 120 }],
  }));

  return (
    <Animated.View style={[StyleSheet.absoluteFill, style]} pointerEvents="none">
      <Svg width="100%" height="100%" viewBox="0 0 200 100" preserveAspectRatio="xMidYMid slice">
        <Ellipse cx={40} cy={y} rx={30} ry={7} fill={tint} opacity={opacity} />
        <Ellipse cx={62} cy={y - 3} rx={20} ry={6} fill={tint} opacity={opacity * 0.8} />
        <Ellipse cx={140} cy={y + 6} rx={34} ry={8} fill={tint} opacity={opacity * 0.7} />
        <Ellipse cx={168} cy={y + 2} rx={18} ry={5} fill={tint} opacity={opacity * 0.6} />
      </Svg>
    </Animated.View>
  );
});

export const SkyGradient = memo(function SkyGradient({
  variant = 'dawn',
  style,
  children,
}: {
  variant?: SceneVariant;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}) {
  const spec = SKY[variant];
  const reduced = useReducedMotion();

  return (
    <View style={[styles.fill, style]}>
      <LinearGradient
        colors={spec.stops}
        locations={[0, 0.38, 0.72, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* stars, sun/moon, birds — all static */}
      <Svg
        width="100%"
        height="100%"
        viewBox="0 0 200 100"
        preserveAspectRatio="xMidYMid slice"
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      >
        {spec.stars
          ? [
              [24, 14],
              [52, 9],
              [78, 20],
              [104, 11],
              [131, 17],
              [158, 8],
              [176, 22],
              [38, 27],
              [92, 31],
              [146, 29],
            ].map(([cx, cy], i) => (
              <Circle key={i} cx={cx} cy={cy} r={i % 3 === 0 ? 0.9 : 0.6} fill="#FFFFFF" opacity={0.85} />
            ))
          : null}

        {spec.disc ? <Circle cx={148} cy={30} r={13} fill={spec.disc} opacity={0.9} /> : null}

        {/* two distant birds, a few strokes each */}
        <Path d="M52 24 q3 -2.4 6 0 M58 24 q3 -2.4 6 0" stroke="#FFFFFF" strokeWidth={0.9} fill="none" opacity={0.5} />
      </Svg>

      <CloudBank tint="#FFFFFF" opacity={0.34} speed={1} y={30} reduced={reduced} />
      <CloudBank tint="#FFFFFF" opacity={0.2} speed={1.7} y={48} reduced={reduced} />

      {/* rolling hills */}
      <Svg
        width="100%"
        height="100%"
        viewBox="0 0 200 100"
        preserveAspectRatio="xMidYMax slice"
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      >
        <Path d="M0 72 q34 -16 68 -3 q30 12 62 -6 q38 -20 70 -1 V100 H0 Z" fill={spec.hills[0]} opacity={0.62} />
        <Path d="M0 86 q42 -14 82 -1 q34 11 68 -6 q28 -14 50 -2 V100 H0 Z" fill={spec.hills[1]} opacity={0.8} />
      </Svg>

      {children}
    </View>
  );
});

/* ------------------------------------------------------------------ */
/* Layer 2 — the photograph, over the sky                             */
/* ------------------------------------------------------------------ */

export const Scene = memo(function Scene({
  variant = 'dawn',
  height,
  width = 900,
  imagery = true,
  overlay = true,
  radiusStyle,
  style,
  children,
}: {
  variant?: SceneVariant;
  height?: number;
  /** Requested CDN width; keep near the drawn size. */
  width?: number;
  /** Set false for a pure gradient panel. */
  imagery?: boolean;
  /** The frost + scrim that makes text readable. Only drop it if nothing sits on top. */
  overlay?: boolean;
  radiusStyle?: StyleProp<ViewStyle>;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}) {
  const [failed, setFailed] = useState(false);

  return (
    <View style={[styles.scene, height !== undefined && { height }, radiusStyle, style]}>
      <SkyGradient variant={variant} />

      {imagery && !failed ? (
        <Image
          source={{ uri: photoUrl(variant, width) }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={420}
          cachePolicy="memory-disk"
          onError={() => setFailed(true)}
          accessible={false}
          // Decorative framing only; the information is always in the text.
          importantForAccessibility="no-hide-descendants"
        />
      ) : null}

      {overlay ? (
        <>
          <View style={styles.frost} pointerEvents="none" />
          <LinearGradient
            colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.55)', colors.mist]}
            locations={[0, 0.55, 1]}
            style={styles.scrim}
            pointerEvents="none"
          />
        </>
      ) : null}

      {children}
    </View>
  );
});

/**
 * A full-bleed scene behind a whole screen, held far enough back that slate
 * text stays comfortably readable over it. Used by the entry screens.
 */
export const SceneBackdrop = memo(function SceneBackdrop({
  variant = 'dawn',
  strength = 1,
}: {
  variant?: SceneVariant;
  /** 0–1; higher pushes the scene further back. */
  strength?: number;
}) {
  const a = 0.42 * strength;
  const b = 0.8 * strength;
  const c = 0.96 * strength;
  return (
    <View style={styles.fill} pointerEvents="none" importantForAccessibility="no-hide-descendants">
      <Scene variant={variant} width={1200} overlay={false} style={styles.fill} />
      <LinearGradient
        colors={[`rgba(246,248,255,${a})`, `rgba(246,248,255,${b})`, `rgba(246,248,255,${c})`]}
        locations={[0, 0.5, 1]}
        style={styles.fill}
      />
    </View>
  );
});

/** A small rounded scene chip, for chapter headers. */
export const SceneThumb = memo(function SceneThumb({
  variant = 'dawn',
  size = 56,
  style,
}: {
  variant?: SceneVariant;
  size?: number;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View
      style={[{ width: size, height: size, borderRadius: radius.md, overflow: 'hidden' }, style]}
      pointerEvents="none"
      importantForAccessibility="no-hide-descendants"
    >
      <Scene variant={variant} width={160} imagery overlay={false} />
      <View style={[StyleSheet.absoluteFill, { borderRadius: radius.md, borderWidth: 1, borderColor: colors.frost }]} />
    </View>
  );
});

/** This RN version does not type `absoluteFillObject`, so insets are explicit. */
const ABSOLUTE = { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 } as const;

const styles = StyleSheet.create({
  fill: { ...ABSOLUTE, overflow: 'hidden' },
  scene: { overflow: 'hidden', backgroundColor: colors.periSoft },
  frost: { ...ABSOLUTE, backgroundColor: 'rgba(255,255,255,0.16)' },
  scrim: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '62%' },
});
