/**
 * The five destinations.
 *
 *   Journey · Insight · Recover · You · Journal
 *
 * Twenty-five screens organised as five destinations, each holding several
 * chapters you swipe between — never twenty-five nav items. The bar stays put
 * through every state change; it is the app's spine.
 *
 * During an active disruption, Recover becomes visually dominant: it takes the
 * coral tone and carries a count of what needs a decision.
 */
import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Tabs } from 'expo-router';

import { colors, glow, motion, radius, space, touch, type } from '@/theme';
import { TravelIcon, type IconName } from '@/components/travel/TravelIcon';
import * as haptic from '@/utils/haptics';
import { useTrip } from '@/state/store';

const TABS: { name: string; label: string; icon: IconName }[] = [
  { name: 'journey', label: 'Journey', icon: 'map' },
  { name: 'intelligence', label: 'Insight', icon: 'binoculars' },
  { name: 'recover', label: 'Recover', icon: 'recovery' },
  { name: 'profile', label: 'You', icon: 'passport' },
  { name: 'history', label: 'Journal', icon: 'stamp' },
];

const ICONS: Record<string, IconName> = {
  journey: 'map',
  intelligence: 'binoculars',
  recover: 'recovery',
  profile: 'passport',
  history: 'stamp',
};

interface TabBarProps {
  state: { index: number; routes: { key: string; name: string }[] };
  navigation: { navigate: (name: string) => void };
}

function TabButton({
  focused,
  label,
  icon,
  badge,
  urgent,
  onPress,
}: {
  focused: boolean;
  label: string;
  icon: IconName;
  badge?: number;
  urgent?: boolean;
  onPress: () => void;
}) {
  const style = useAnimatedStyle(() => ({
    transform: [{ scale: withSpring(focused ? 1 : 0.94, motion.springPaper) }],
    opacity: withSpring(focused ? 1 : 0.62),
  }));

  const tint = urgent ? colors.coralInk : focused ? colors.indigo : colors.inkMuted;
  const halo = urgent ? colors.coralSoft : colors.periSoft;

  return (
    <Pressable
      style={styles.tab}
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="tab"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={badge ? `${label}, ${badge} needing attention` : label}
    >
      <Animated.View style={[styles.tabInner, style]}>
        {/* the active state is a soft halo, not a hard underline */}
        <View
          style={[
            styles.iconWrap,
            focused ? { backgroundColor: halo } : null,
            focused ? glow(urgent ? colors.coral : colors.peri, 0.26) : null,
          ]}
        >
          <TravelIcon name={icon} size={21} color={tint} weight={focused ? 2 : 1.7} />
          {badge ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{badge > 9 ? '9+' : badge}</Text>
            </View>
          ) : null}
        </View>
        <Text style={[styles.tabLabel, { color: tint }]}>{label}</Text>
      </Animated.View>
    </Pressable>
  );
}

function TabBar({ state, navigation }: TabBarProps) {
  const insets = useSafeAreaInsets();
  const phase = useTrip((s) => s.phase);
  const cascade = useTrip((s) => s.cascade);

  const recovering = phase === 'DISRUPTED' || phase === 'PLANNING' || phase === 'CHOOSING';
  const badge = recovering ? (cascade?.downstreamCount ?? 0) || undefined : undefined;

  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, space(2.5)) }]}>
      {state.routes.map((route, i) => {
        const meta = TABS.find((t) => t.name === route.name);
        if (!meta) return null;
        const isRecover = route.name === 'recover';
        return (
          <TabButton
            key={route.key}
            focused={state.index === i}
            label={meta.label}
            icon={ICONS[route.name] ?? meta.icon}
            badge={isRecover ? badge : undefined}
            urgent={isRecover && recovering}
            onPress={() => {
              haptic.light();
              navigation.navigate(route.name);
            }}
          />
        );
      })}
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <TabBar {...(props as unknown as TabBarProps)} />}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.mist },
        animation: 'shift',
      }}
    >
      <Tabs.Screen name="journey" />
      <Tabs.Screen name="intelligence" />
      <Tabs.Screen name="recover" />
      <Tabs.Screen name="profile" />
      <Tabs.Screen name="history" />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: colors.cloud,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingTop: space(2.5),
    ...Platform.select({
      ios: {
        shadowColor: colors.shadowTint,
        shadowOpacity: 0.1,
        shadowRadius: 22,
        shadowOffset: { width: 0, height: -8 },
      },
      default: { elevation: 16 },
    }),
  },
  tab: { flex: 1, alignItems: 'center', minHeight: touch.min, justifyContent: 'center' },
  tabInner: { alignItems: 'center', gap: 4 },
  iconWrap: {
    width: 44,
    height: 30,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabLabel: { ...type.stamp, fontSize: 9, letterSpacing: 0.4 },
  badge: {
    position: 'absolute',
    top: -4,
    right: 0,
    minWidth: 17,
    height: 17,
    borderRadius: radius.pill,
    backgroundColor: colors.coralInk,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: colors.cloud,
  },
  badgeText: { ...type.stamp, fontSize: 9, color: colors.white, letterSpacing: 0 },
});
