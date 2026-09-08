/**
 * Preference controls, drawn as gauges printed on the page.
 *
 * Hand-rolled on gestures so each control can carry its label, its live value
 * and both poles of the trade-off — which is what makes a preference legible
 * rather than an abstract number.
 */
import React, { useState } from 'react';
import { LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { colors, fonts, motion, radius, space, touch, type } from '@/theme';
import { Eyebrow, Row, Txt } from '@/components/primitives';
import { TravelIcon, type IconName } from '@/components/travel/TravelIcon';
import * as haptic from '@/utils/haptics';

export function Slider({
  label,
  low,
  high,
  value,
  onChange,
  tint = colors.indigo,
  icon,
}: {
  label: string;
  /** What a low value means, in the traveller's words. */
  low: string;
  high: string;
  value: number;
  onChange: (next: number) => void;
  tint?: string;
  icon?: IconName;
}) {
  const [width, setWidth] = useState(0);
  const pressed = useSharedValue(0);

  const commit = (x: number) => {
    if (width <= 0) return;
    const next = Math.round(Math.max(0, Math.min(100, (x / width) * 100)));
    if (next !== value) {
      onChange(next);
      if (next % 10 === 0) haptic.tap();
    }
  };

  const pan = Gesture.Pan()
    .minDistance(0)
    .onBegin((e) => {
      pressed.value = withSpring(1, motion.springPaper);
      runOnJS(commit)(e.x);
    })
    .onUpdate((e) => runOnJS(commit)(e.x))
    .onFinalize(() => {
      pressed.value = withSpring(0, motion.springPaper);
    });

  const knob = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + pressed.value * 0.24 }],
  }));

  return (
    <View style={{ marginBottom: space(5) }}>
      <Row justify="space-between" style={{ marginBottom: space(2) }}>
        <Row gap={7}>
          {icon ? <TravelIcon name={icon} size={14} color={tint} weight={1.7} /> : null}
          <Txt variant="h3" style={{ fontSize: 15 }}>
            {label}
          </Txt>
        </Row>
        <Text style={[type.clock, { color: tint, fontSize: 17 }]}>{value}</Text>
      </Row>

      <GestureDetector gesture={pan}>
        <View
          style={styles.hit}
          onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
          collapsable={false}
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel={label}
          accessibilityValue={{ min: 0, max: 100, now: value }}
          accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
          onAccessibilityAction={(e) => {
            const step = e.nativeEvent.actionName === 'increment' ? 5 : -5;
            onChange(Math.max(0, Math.min(100, value + step)));
          }}
        >
          <View style={styles.track}>
            {[25, 50, 75].map((t) => (
              <View key={t} style={[styles.tick, { left: `${t}%` }]} />
            ))}
            <View style={[styles.fill, { width: `${value}%`, backgroundColor: tint }]} />
          </View>
          <Animated.View style={[styles.knob, { left: `${value}%`, borderColor: tint }, knob]} pointerEvents="none" />
        </View>
      </GestureDetector>

      <Row justify="space-between" style={{ marginTop: space(2) }}>
        <Eyebrow color={colors.inkFaint}>{low}</Eyebrow>
        <Eyebrow color={colors.inkFaint}>{high}</Eyebrow>
      </Row>
    </View>
  );
}

/** Constraint toggle — reads as a checkbox stamped on the rulebook. */
export function ConstraintToggle({
  label,
  detail,
  value,
  onChange,
  icon,
}: {
  label: string;
  detail?: string;
  value: boolean;
  onChange: (next: boolean) => void;
  icon?: IconName;
}) {
  return (
    <GestureDetector
      gesture={Gesture.Tap().onEnd((_e, ok) => {
        if (ok) {
          runOnJS(onChange)(!value);
          runOnJS(haptic.tap)();
        }
      })}
    >
      <View
        style={styles.row}
        collapsable={false}
        accessible
        accessibilityRole="switch"
        accessibilityState={{ checked: value }}
        accessibilityLabel={label}
        accessibilityHint={detail}
      >
        <View style={[styles.box, value && { backgroundColor: colors.indigo, borderColor: colors.indigo }]}>
          {value ? <TravelIcon name="check" size={12} color={colors.mist} weight={2.8} /> : null}
        </View>
        <View style={{ flex: 1 }}>
          <Row gap={6}>
            {icon ? <TravelIcon name={icon} size={13} color={value ? colors.indigo : colors.inkFaint} weight={1.7} /> : null}
            <Txt variant="small" style={{ fontFamily: fonts.bold, flex: 1 }}>
              {label}
            </Txt>
          </Row>
          {detail ? (
            <Txt variant="meta" color={colors.inkMuted} style={{ marginTop: 3 }}>
              {detail}
            </Txt>
          ) : null}
        </View>
      </View>
    </GestureDetector>
  );
}

export function Stepper({
  label,
  detail,
  value,
  min,
  max,
  suffix,
  onChange,
  icon,
}: {
  label: string;
  detail?: string;
  value: number;
  min: number;
  max: number;
  suffix?: string;
  onChange: (next: number) => void;
  icon?: IconName;
}) {
  const step = (delta: number) => {
    const next = Math.max(min, Math.min(max, value + delta));
    if (next !== value) {
      onChange(next);
      haptic.tap();
    }
  };

  return (
    <View style={styles.row}>
      <View style={{ flex: 1, paddingRight: space(3) }}>
        <Row gap={6}>
          {icon ? <TravelIcon name={icon} size={13} color={colors.inkFaint} weight={1.7} /> : null}
          <Txt variant="small" style={{ fontFamily: fonts.bold }}>
            {label}
          </Txt>
        </Row>
        {detail ? (
          <Txt variant="meta" color={colors.inkMuted} style={{ marginTop: 3 }}>
            {detail}
          </Txt>
        ) : null}
      </View>
      <Row gap={space(2.5)}>
        <GestureDetector gesture={Gesture.Tap().onEnd((_e, ok) => ok && runOnJS(step)(-1))}>
          <View style={styles.stepBtn} collapsable={false} accessible accessibilityRole="button" accessibilityLabel={`Decrease ${label}`}>
            <TravelIcon name="minus" size={14} color={colors.indigo} weight={2.2} />
          </View>
        </GestureDetector>
        <Text style={[type.clock, { minWidth: 46, textAlign: 'center', color: colors.ink }]}>
          {value}
          {suffix ?? ''}
        </Text>
        <GestureDetector gesture={Gesture.Tap().onEnd((_e, ok) => ok && runOnJS(step)(1))}>
          <View style={styles.stepBtn} collapsable={false} accessible accessibilityRole="button" accessibilityLabel={`Increase ${label}`}>
            <TravelIcon name="plus" size={14} color={colors.indigo} weight={2.2} />
          </View>
        </GestureDetector>
      </Row>
    </View>
  );
}

const styles = StyleSheet.create({
  hit: { paddingVertical: space(3.5), justifyContent: 'center' },
  track: {
    height: 8,
    borderRadius: radius.xs,
    backgroundColor: colors.haze,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.rule,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  tick: { position: 'absolute', top: 0, bottom: 0, width: 1, backgroundColor: colors.rule },
  fill: { height: '100%', borderRadius: radius.xs },
  knob: {
    position: 'absolute',
    width: 24,
    height: 24,
    marginLeft: -12,
    borderRadius: 12,
    backgroundColor: colors.cloud,
    borderWidth: 2.5,
    shadowColor: colors.shadowTint,
    shadowOpacity: 0.16,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(3),
    minHeight: touch.min,
    paddingVertical: space(3),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.rule,
  },
  box: {
    width: 22,
    height: 22,
    borderRadius: radius.xs,
    borderWidth: 1.6,
    borderColor: colors.ruleStrong,
    backgroundColor: colors.cloud,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtn: {
    width: touch.min - 4,
    height: touch.min - 4,
    borderRadius: radius.pill,
    borderWidth: 1.2,
    borderColor: colors.ruleStrong,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.cloud,
  },
});
