/**
 * The companion's masthead.
 *
 * Present on every screen so the trip never leaves the page. Three facts —
 * where, when, who — the one sentence that matters right now, and the journey
 * ribbon underneath.
 *
 * Behind all of it sits a scene band whose sky follows the trip's phase: dawn
 * while watching, overcast when something has broken, dusk once it is settled.
 * That band replaces the old tinted mood strip — the weather *is* the status.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

import { colors, mood, radius, space, type, useReducedMotion } from '@/theme';
import { Row, Txt } from '@/components/primitives';
import { JourneyRibbon } from '@/components/travel/JourneyRibbon';
import { TravelIcon } from '@/components/travel/TravelIcon';
import { Scene, sceneForPhase } from '@/components/scene/Scene';
import { VikalpaMark } from '@/components/brand/Logo';
import { initials } from '@/utils/format';
import { useTrip } from '@/state/store';

function LiveMark({ tint }: { tint: string }) {
  const reduced = useReducedMotion();
  const pulse = useSharedValue(0);

  React.useEffect(() => {
    if (reduced) return;
    pulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1050, easing: Easing.out(Easing.quad) }),
        withTiming(0, { duration: 1050, easing: Easing.in(Easing.quad) }),
      ),
      -1,
      false,
    );
  }, [pulse, reduced]);

  const halo = useAnimatedStyle(() => ({
    opacity: 0.45 - pulse.value * 0.4,
    transform: [{ scale: 1 + pulse.value * 1.7 }],
  }));

  return (
    <View style={styles.live}>
      <Animated.View style={[styles.liveHalo, { backgroundColor: tint }, halo]} />
      <View style={[styles.liveCore, { backgroundColor: tint }]} />
    </View>
  );
}

export function JourneyHeader({
  onPressStatus,
  showRibbon = true,
  onPressNode,
}: {
  onPressStatus?: () => void;
  showRibbon?: boolean;
  onPressNode?: (nodeId: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const overview = useTrip((s) => s.overview);
  const connection = useTrip((s) => s.connection);
  const phase = useTrip((s) => s.phase);

  const variant = sceneForPhase(phase);

  if (!overview) return <View style={[styles.root, { paddingTop: insets.top + space(3) }]} />;

  const { trip, headline, subhead } = overview;
  const tone =
    trip.status === 'DISRUPTED'
      ? mood.disruption
      : trip.status === 'RECOVERING' || trip.status === 'AT_RISK'
        ? mood.warning
        : mood.calm;

  return (
    <View style={styles.root}>
      {/* the sky behind the masthead — decorative, never carries information */}
      <View style={styles.band} pointerEvents="none" importantForAccessibility="no-hide-descendants">
        <Scene variant={variant} width={900} overlay={false} style={StyleSheet.absoluteFill} />
        {/* Held well back, so slate text stays comfortably above 4.5:1. */}
        <LinearGradient
          colors={['rgba(246,248,255,0.58)', 'rgba(246,248,255,0.86)', colors.mist]}
          locations={[0, 0.58, 1]}
          style={StyleSheet.absoluteFill}
        />
      </View>

      <View style={{ paddingTop: insets.top + space(3), paddingHorizontal: space(5), paddingBottom: space(3) }}>
        <Row justify="space-between" align="flex-start">
          <View style={{ flex: 1, paddingRight: space(3) }}>
            <Row gap={space(1.5)}>
              <VikalpaMark size={18} />
              <Text style={[type.stamp, { color: colors.indigo, letterSpacing: 2.6 }]}>VIKALPA</Text>
              {connection === 'OFFLINE' ? (
                <Row gap={4}>
                  <TravelIcon name="signal" size={11} color={colors.amberInk} weight={2} />
                  <Text style={[type.stamp, { color: colors.amberInk, fontSize: 9 }]}>SAVED COPY</Text>
                </Row>
              ) : (
                <Row gap={5}>
                  <LiveMark tint={tone.ink} />
                  <Text style={[type.stamp, { color: colors.inkMuted, fontSize: 9 }]}>WATCHING</Text>
                </Row>
              )}
            </Row>

            <Txt variant="h1" accessibilityRole="header" style={{ marginTop: space(1) }} numberOfLines={1}>
              {trip.origin.city} → {trip.destination.city}
            </Txt>
            <Row gap={5}>
              <TravelIcon name="calendar" size={11} color={colors.inkMuted} weight={1.8} />
              <Txt variant="meta" color={colors.inkMuted}>
                {subhead}
              </Txt>
            </Row>
          </View>

          <Row gap={-10} style={{ marginTop: space(5) }}>
            {trip.travellers.map((t, i) => (
              <View
                key={t.id}
                style={[styles.avatar, { backgroundColor: t.avatarTone, marginLeft: i === 0 ? 0 : -10, zIndex: 9 - i }]}
                accessible
                accessibilityLabel={t.name}
              >
                <Text style={[type.stamp, { color: colors.white, fontSize: 9.5 }]}>{initials(t.name)}</Text>
              </View>
            ))}
          </Row>
        </Row>

        {/* the one sentence that matters, on frosted glass */}
        <Pressable
          onPress={onPressStatus}
          disabled={!onPressStatus}
          accessibilityRole={onPressStatus ? 'button' : undefined}
          accessibilityLabel={headline}
          accessibilityHint={onPressStatus ? 'Opens recovery' : undefined}
        >
          {({ pressed }) => (
            <View style={[styles.status, pressed && { opacity: 0.82 }]}>
              <View style={[styles.statusIcon, { backgroundColor: tone.fill }]}>
                <TravelIcon
                  name={trip.status === 'RECOVERED' ? 'shield' : trip.status === 'DISRUPTED' ? 'warning' : 'check'}
                  size={16}
                  color={tone.ink}
                  weight={2}
                />
              </View>
              <Txt variant="h3" style={{ flex: 1, fontSize: 15 }} numberOfLines={2}>
                {headline}
              </Txt>
              {onPressStatus ? <TravelIcon name="chevron" size={15} color={colors.inkMuted} weight={2} /> : null}
            </View>
          )}
        </Pressable>

        {showRibbon ? (
          <JourneyRibbon
            nodes={trip.nodes}
            variant="cities"
            orientation="horizontal"
            compact
            onPressNode={onPressNode}
            style={{ marginTop: space(3) }}
          />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: colors.mist },
  band: { position: 'absolute', left: 0, right: 0, top: 0, height: 210 },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.cloud,
  },
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(2.5),
    marginTop: space(3.5),
    padding: space(2.5),
    paddingRight: space(3.5),
    borderRadius: radius.lg,
    backgroundColor: colors.glassDeep,
    borderWidth: 1,
    borderColor: colors.cloud,
  },
  statusIcon: {
    width: 34,
    height: 34,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  live: { width: 8, height: 8, alignItems: 'center', justifyContent: 'center' },
  liveHalo: { position: 'absolute', width: 8, height: 8, borderRadius: 4 },
  liveCore: { width: 6, height: 6, borderRadius: 3 },
});
