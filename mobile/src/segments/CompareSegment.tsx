/**
 * SCREEN 9 — Plan comparison.
 *
 * Not a spreadsheet. Each plan is a card you swipe between, and the five axes
 * are printed gauges normalised across the plans on screen — so "longest bar"
 * always means "best of these", which is the only comparison a traveller is
 * actually making.
 */
import React, { useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { colors, gutter, motion, radius, space, type } from '@/theme';
import {
  Button,
  ChapterHeader,
  Divider,
  Empty,
  Eyebrow,
  Pill,
  Row,
  Txt,
} from '@/components/primitives';
import { PaperCard, Stamp } from '@/components/travel/paper';
import { TravelIcon, type IconName } from '@/components/travel/TravelIcon';
import { DoodleField } from '@/components/travel/Doodles';
import { durationLabel, inr } from '@/utils/format';
import { useTrip } from '@/state/store';
import type { PlanScores, RecoveryPlan } from '@/types/domain';

/** What each plan is actually best at — the label that replaces its score. */
const STRENGTH: Record<string, string> = {
  SAVE_EXPERIENCES: 'Most kept',
  LOWEST_COST: 'Cheapest',
  LOWEST_STRESS: 'Calmest',
  MAXIMUM_SAFETY: 'Safest',
  FASTEST: 'Fastest',
  MINIMAL_CHANGE: 'Gentlest',
  BALANCED: 'Balanced',
};

const AXES: { key: keyof PlanScores; label: string; icon: IconName; explain: string }[] = [
  { key: 'cost', label: 'Cost', icon: 'ticket', explain: 'Additional spend, refunds included' },
  { key: 'time', label: 'Time', icon: 'clock', explain: 'Transit plus usable hours lost at the far end' },
  { key: 'experiences', label: 'Experiences', icon: 'heart', explain: 'Weighted by your must-do / important / optional bands' },
  { key: 'convenience', label: 'Convenience', icon: 'luggage', explain: 'How many bookings you have to touch' },
  { key: 'safety', label: 'Safety', icon: 'shield', explain: 'Late-night arrivals, verified operators, daily travel ceiling' },
];

export function CompareSegment({ onOpenPlan }: { onOpenPlan: (planId: string) => void }) {
  const { width } = useWindowDimensions();
  const plans = useTrip((s) => s.plans);
  const recommendation = useTrip((s) => s.recommendation);
  const weights = useTrip((s) => s.overview?.weights ?? null);

  const [explaining, setExplaining] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const scroller = useRef<ScrollView>(null);

  const pad = gutter(width);

  if (!plans.length) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.mist, padding: pad, paddingTop: space(6) }}>
        <Empty
          title="Nothing to compare yet"
          body="Generate recovery plans from the Options chapter and they will line up here."
          icon="compass"
        />
      </View>
    );
  }

  /* Four is the most anyone can genuinely hold side by side. */
  const shortlist = [...plans]
    .sort((a, b) => Number(b.recommended) - Number(a.recommended) || b.scores.total - a.scores.total)
    .slice(0, 4);

  const cardW = width - pad * 2 - space(6);
  const gap = space(3);

  return (
    <View style={{ flex: 1, backgroundColor: colors.mist }}>
      <DoodleField opacity={0.04} density={0.5} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: space(26) }}>
        <View style={{ paddingHorizontal: pad, paddingTop: space(4) }}>
          <ChapterHeader
            marker="Chapter four · compare"
            title="Side by side"
            standfirst="Bars are relative to the plans shown. Longer is always better. Tap an axis to see what it measures."
            scene="mountain"
          />
        </View>

        <ScrollView
          ref={scroller}
          horizontal
          snapToInterval={cardW + gap}
          decelerationRate="fast"
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / (cardW + gap)))}
          contentContainerStyle={{ paddingHorizontal: pad, paddingVertical: space(2), gap }}
        >
          {shortlist.map((plan, i) => (
            <Animated.View
              key={plan.id}
              entering={FadeInDown.delay(i * 70).duration(motion.settle)}
              style={{ width: cardW }}
            >
              {/* The card itself is not pressable: the axis gauges inside are,
                  and nesting one control inside another breaks both semantics
                  and screen-reader focus order. Opening is an explicit action. */}
              <PaperCard
                depth={plan.recommended ? 'held' : 'lifted'}
                accent={plan.recommended ? colors.indigo : colors.ruleStrong}
              >
                <Row justify="space-between" align="flex-start">
                  <View style={{ flex: 1, paddingRight: space(2) }}>
                    {plan.recommended ? (
                      <Pill label="Recommended" fg={colors.indigo} bg={colors.periSoft} icon="check" />
                    ) : (
                      <Eyebrow>Plan {String.fromCharCode(65 + i)}</Eyebrow>
                    )}
                    <Txt variant="h2" style={{ marginTop: 6 }} numberOfLines={2}>
                      {plan.title}
                    </Txt>
                  </View>
                  {/* The engine's weighted score decides the order of this deck;
                      the traveller gets the word instead of the number. */}
                  <Stamp
                    label={STRENGTH[plan.archetype] ?? 'Balanced'}
                    tint={plan.recommended ? colors.indigo : colors.inkMuted}
                    fill={plan.recommended ? colors.periSoft : colors.haze}
                  />
                </Row>

                <Divider dashed style={{ marginVertical: space(4) }} />

                {AXES.map((axis) => (
                  <Gauge
                    key={axis.key}
                    label={axis.label}
                    icon={axis.icon}
                    score={plan.scores[axis.key]}
                    display={displayFor(axis.key, plan)}
                    tint={plan.recommended ? colors.indigo : colors.indigo}
                    onPress={() => setExplaining(explaining === axis.key ? null : axis.key)}
                  />
                ))}

                {explaining ? (
                  <PaperCard depth="flat" tinted={colors.haze} style={{ marginTop: space(2) }}>
                    <Txt variant="meta" color={colors.inkMuted}>
                      {AXES.find((a) => a.key === explaining)?.explain}
                    </Txt>
                  </PaperCard>
                ) : null}

                <Divider dashed style={{ marginTop: space(4), marginBottom: space(3) }} />

                <Txt variant="meta" color={colors.inkMuted}>
                  {plan.metrics.experiencesPreserved}/{plan.metrics.experiencesTotal} experiences ·{' '}
                  {inr(plan.metrics.addedCost)}
                </Txt>

                <Button
                  label="Open this plan"
                  variant={plan.recommended ? 'primary' : 'secondary'}
                  icon="arrowRight"
                  onPress={() => onOpenPlan(plan.id)}
                  style={{ marginTop: space(3) }}
                />
              </PaperCard>
            </Animated.View>
          ))}
        </ScrollView>

        <Row gap={7} justify="center" style={{ marginTop: space(3) }}>
          {shortlist.map((plan, i) => (
            <Pressable
              key={plan.id}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel={`Show ${plan.title}`}
              onPress={() => {
                setIndex(i);
                scroller.current?.scrollTo({ x: i * (cardW + gap), animated: true });
              }}
            >
              <View style={[styles.dot, i === index && { width: 22, backgroundColor: colors.indigo }]} />
            </Pressable>
          ))}
        </Row>

        <View style={{ paddingHorizontal: pad, marginTop: space(7) }}>
          <PaperCard depth="lifted" accent={colors.indigo} tinted={colors.periSoft}>
            <Row justify="space-between" align="flex-start">
              <Eyebrow color={colors.indigo}>Our recommendation</Eyebrow>
              <Stamp label="Ranked" tint={colors.indigo} rotate={-6} />
            </Row>
            <Txt variant="body" style={{ marginTop: space(2.5) }}>
              {recommendation}
            </Txt>
          </PaperCard>

          {weights ? (
            <PaperCard depth="flat" tinted={colors.haze} style={{ marginTop: space(4) }}>
              <Eyebrow>Your weighting</Eyebrow>
              <Txt variant="meta" color={colors.inkMuted} style={{ marginTop: 4, marginBottom: space(3) }}>
                Taken from your own preference sliders and sharpened so your leading preference actually leads. A stated
                trade-off, not a validated model of anyone's utility.
              </Txt>
              <Row gap={space(2)} wrap>
                {(
                  [
                    ['Cost', weights.costWeight, 'ticket'],
                    ['Time', weights.timeWeight, 'clock'],
                    ['Experience', weights.experienceWeight, 'heart'],
                    ['Convenience', weights.convenienceWeight, 'luggage'],
                    ['Safety', weights.safetyWeight, 'shield'],
                  ] as const
                ).map(([label, value, icon]) => (
                  <Pill
                    key={label}
                    label={`${label} ${Math.round(value * 100)}%`}
                    icon={icon}
                    fg={value > 0.25 ? colors.indigo : colors.inkSoft}
                    bg={value > 0.25 ? colors.periSoft : colors.haze}
                  />
                ))}
              </Row>
            </PaperCard>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

function Gauge({
  label,
  icon,
  score,
  display,
  tint,
  onPress,
}: {
  label: string;
  icon: IconName;
  score: number;
  display: string;
  tint: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{ marginBottom: space(3) }}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${display}`}
      accessibilityHint="Explains what this axis measures"
    >
      <Row justify="space-between" style={{ marginBottom: 5 }}>
        <Row gap={6}>
          <TravelIcon name={icon} size={12} color={colors.inkMuted} weight={1.7} />
          <Txt variant="small" color={colors.inkSoft}>
            {label}
          </Txt>
        </Row>
        <Text style={[type.code, { color: colors.inkMuted }]}>{display}</Text>
      </Row>
      <View style={styles.track}>
        {[25, 50, 75].map((t) => (
          <View key={t} style={[styles.tick, { left: `${t}%` }]} />
        ))}
        <View style={[styles.fill, { width: `${Math.max(2, score)}%`, backgroundColor: tint }]} />
      </View>
    </Pressable>
  );
}

function displayFor(key: keyof PlanScores, plan: RecoveryPlan): string {
  const m = plan.metrics;
  switch (key) {
    case 'cost':
      return inr(m.addedCost);
    case 'time':
      return m.usableMinutesLost > 0 ? `−${durationLabel(m.usableMinutesLost)} on the ground` : 'no time lost';
    case 'experiences':
      return `${m.experiencesPreserved}/${m.experiencesTotal}`;
    case 'convenience':
      return `${m.changeCount} changed`;
    case 'safety':
      return m.lateNightArrivals === 0 ? 'no late nights' : `${m.lateNightArrivals} late night`;
    default:
      return String(Math.round(plan.scores[key]));
  }
}

const styles = StyleSheet.create({
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
  dot: { width: 7, height: 7, borderRadius: radius.pill, backgroundColor: colors.ruleStrong },
});
