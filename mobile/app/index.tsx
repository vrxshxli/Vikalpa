/**
 * Splash — first light.
 *
 * A single route line draws itself between three stops over a dawn sky, then
 * the wordmark. That is the whole product in one gesture: a path being found.
 */
import React, { useEffect } from 'react';
import { Dimensions, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, LinearGradient as SvgGradient, Path, Stop } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';

import { colors, dur, fonts, space, type, useReducedMotion } from '@/theme';
import { VikalpaMark } from '@/components/brand/Logo';
import { Scene } from '@/components/scene/Scene';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const { width } = Dimensions.get('window');
const W = Math.min(width - 56, 360);
const H = 156;

const ROUTE = `M 18 ${H - 34} C ${W * 0.24} ${H - 100}, ${W * 0.4} ${H - 24}, ${W * 0.56} ${H - 76} S ${W * 0.82} ${H - 132}, ${W - 18} 30`;
const LEN = 760;

const STOPS = [
  { x: 18, y: H - 34, label: 'Mumbai' },
  { x: W * 0.56, y: H - 76, label: 'Dubai' },
  { x: W - 18, y: 30, label: 'Paris' },
];

export default function Splash() {
  const reduced = useReducedMotion();
  const draw = useSharedValue(reduced ? 0 : LEN);
  const stops = useSharedValue(reduced ? 1 : 0);
  const brand = useSharedValue(reduced ? 1 : 0);
  const tag = useSharedValue(reduced ? 1 : 0);

  useEffect(() => {
    if (!reduced) {
      draw.value = withDelay(240, withTiming(0, { duration: 1450, easing: Easing.bezier(0.33, 0, 0.15, 1) }));
      stops.value = withDelay(520, withTiming(1, { duration: 850 }));
      brand.value = withDelay(1000, withTiming(1, { duration: dur(560, reduced) }));
      tag.value = withDelay(1340, withTiming(1, { duration: dur(560, reduced) }));
    }
    const t = setTimeout(() => router.replace('/onboarding'), reduced ? 900 : 3000);
    return () => clearTimeout(t);
  }, [draw, stops, brand, tag, reduced]);

  const pathProps = useAnimatedProps(() => ({ strokeDashoffset: draw.value }));
  const stopProps = useAnimatedProps(() => ({ opacity: stops.value }));
  const brandStyle = useAnimatedStyle(() => ({
    opacity: brand.value,
    transform: [{ translateY: (1 - brand.value) * 14 }],
  }));
  const tagStyle = useAnimatedStyle(() => ({ opacity: tag.value }));

  return (
    <Pressable
      style={styles.root}
      onPress={() => router.replace('/onboarding')}
      accessibilityRole="button"
      accessibilityLabel="VIKALPA. Tap to continue"
    >
      {/* full-bleed dawn, held back so slate type stays readable over it */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none" importantForAccessibility="no-hide-descendants">
        <Scene variant="dawn" width={1200} overlay={false} style={StyleSheet.absoluteFill} />
        <LinearGradient
          colors={['rgba(246,248,255,0.42)', 'rgba(246,248,255,0.80)', 'rgba(246,248,255,0.96)']}
          locations={[0, 0.5, 1]}
          style={StyleSheet.absoluteFill}
        />
      </View>

      <View style={styles.art}>
        <Svg width={W} height={H}>
          <Defs>
            <SvgGradient id="route" x1="0" y1="1" x2="1" y2="0">
              <Stop offset="0" stopColor={colors.peach} />
              <Stop offset="0.5" stopColor={colors.sakura} />
              <Stop offset="1" stopColor={colors.indigo} />
            </SvgGradient>
          </Defs>
          <Path d={ROUTE} stroke={colors.periMid} strokeWidth={1.6} fill="none" strokeDasharray="2 6" strokeLinecap="round" />
          <AnimatedPath
            d={ROUTE}
            stroke="url(#route)"
            strokeWidth={3.2}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={LEN}
            animatedProps={pathProps}
          />
          {STOPS.map((s, i) => (
            <AnimatedCircle
              key={s.label}
              cx={s.x}
              cy={s.y}
              r={i === 1 ? 5 : 6}
              fill={colors.cloud}
              stroke={i === 2 ? colors.indigo : colors.sakura}
              strokeWidth={2.6}
              animatedProps={stopProps}
            />
          ))}
        </Svg>
      </View>

      <Animated.View style={[styles.brand, brandStyle]}>
        <VikalpaMark size={64} style={{ marginBottom: space(4) }} />
        <Text style={styles.wordmark} accessibilityRole="header">
          VIKALPA
        </Text>
        <View style={styles.rule} />
      </Animated.View>

      <Animated.View style={[styles.taglines, tagStyle]}>
        {/* Baloo 2 carries Devanagari, so the Hindi line sets in the brand face. */}
        <Text style={styles.devanagari}>हर सफ़र का एक और रास्ता।</Text>
        <Text style={styles.english}>When plans change, find another way.</Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.mist,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space(7),
  },
  art: { height: H, justifyContent: 'center' },
  brand: { marginTop: space(9), alignItems: 'center' },
  wordmark: {
    fontFamily: fonts.display,
    fontSize: 42,
    letterSpacing: 8,
    color: colors.indigoDeep,
    textAlign: 'center',
  },
  rule: { width: 58, height: 2, borderRadius: 1, backgroundColor: colors.sakura, marginTop: space(3) },
  taglines: { marginTop: space(5), alignItems: 'center' },
  devanagari: { fontFamily: fonts.medium, fontSize: 17, lineHeight: 28, color: colors.inkSoft, textAlign: 'center' },
  english: { ...type.small, color: colors.inkMuted, marginTop: 6, textAlign: 'center' },
});
