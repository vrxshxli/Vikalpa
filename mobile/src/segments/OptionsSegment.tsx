/**
 * SCREEN 8 — Recovery options.
 *
 * Each card is a whole alternate route through the trip, not a row in a table.
 * They sit in a swipeable deck so moving between them feels like weighing two
 * futures against each other; neighbours sit slightly back so the deck reads as
 * depth.
 *
 * The generation state narrates the actual engine pipeline, so the wait reads
 * as work rather than as a spinner.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, {
  FadeInDown,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { colors, fonts, gutter, motion, radius, space, type, useReducedMotion } from '@/theme';
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
import { LuggageTag, PaperCard, Stamp } from '@/components/travel/paper';
import { TravelIcon } from '@/components/travel/TravelIcon';
import { DoodleField } from '@/components/travel/Doodles';
import { inr } from '@/utils/format';
import * as haptic from '@/utils/haptics';
import { useTrip } from '@/state/store';
import type { RecoveryPlan } from '@/types/domain';

const STAGES: { label: string; icon: Parameters<typeof TravelIcon>[0]['name'] }[] = [
  { label: 'Reading the cascade', icon: 'route' },
  { label: 'Pulling alternatives from inventory', icon: 'luggage' },
  { label: 'Testing travel time and opening hours', icon: 'clock' },
  { label: 'Checking seats, rooms and capacity', icon: 'ticket' },
  { label: 'Applying your safety constraints', icon: 'shield' },
  { label: 'Ranking what survived', icon: 'compass' },
];

/** The engine, working — narrated. */
function Generating() {
  const reduced = useReducedMotion();
  const [stage, setStage] = useState(0);
  const sweep = useSharedValue(0);

  useEffect(() => {
    sweep.value = withTiming(1, { duration: reduced ? 0 : 2600 });
    const id = setInterval(() => {
      setStage((s) => {
        if (s >= STAGES.length - 1) {
          clearInterval(id);
          return s;
        }
        haptic.tap();
        return s + 1;
      });
    }, 420);
    return () => clearInterval(id);
  }, [sweep, reduced]);

  const bar = useAnimatedStyle(() => ({ width: `${sweep.value * 100}%` }));

  return (
    <View style={styles.generating}>
      <DoodleField opacity={0.05} density={0.6} />
      <Eyebrow color={colors.indigo}>Working</Eyebrow>
      <Txt variant="chapter" accessibilityRole="header" style={{ marginTop: space(2) }}>
        Finding every way through.
      </Txt>

      <View style={styles.track}>
        <Animated.View style={[styles.trackFill, bar]} />
      </View>

      <View style={{ marginTop: space(7), gap: space(3.5) }}>
        {STAGES.map((s, i) => (
          <Row key={s.label} gap={space(3)}>
            <View
              style={[
                styles.stageDot,
                i < stage && { backgroundColor: colors.indigo, borderColor: colors.indigo },
                i === stage && { borderColor: colors.indigo, borderWidth: 2.5 },
              ]}
            >
              {i < stage ? <TravelIcon name="check" size={9} color={colors.mist} weight={3} /> : null}
            </View>
            <TravelIcon name={s.icon} size={14} color={i <= stage ? colors.inkSoft : colors.inkFaint} weight={1.6} />
            <Txt variant="small" color={i <= stage ? colors.ink : colors.inkFaint} style={{ flex: 1 }}>
              {s.label}
            </Txt>
          </Row>
        ))}
      </View>
    </View>
  );
}

export function OptionsSegment({ onOpenPlan }: { onOpenPlan: (planId: string) => void }) {
  const { width } = useWindowDimensions();
  const plans = useTrip((s) => s.plans);
  const recommendation = useTrip((s) => s.recommendation);
  const cascade = useTrip((s) => s.cascade);
  const phase = useTrip((s) => s.phase);
  const loading = useTrip((s) => s.loading);
  const generatePlans = useTrip((s) => s.generatePlans);
  const history = useTrip((s) => s.history);

  const pad = gutter(width);
  const cardW = width - pad * 2 - space(6);
  const gap = space(3);

  const scrollX = useSharedValue(0);
  const [index, setIndex] = useState(0);
  const scroller = useRef<ScrollView>(null);

  const onScroll = useAnimatedScrollHandler({
    onScroll: (e) => {
      scrollX.value = e.contentOffset.x;
    },
  });

  if (!cascade) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.mist, padding: pad, paddingTop: space(6) }}>
        <Empty
          title="Nothing to recover from"
          body="Recovery plans are generated against a specific cascade. Report a change or run a scenario first."
          icon="sun"
        />
      </View>
    );
  }

  if (loading.plans || phase === 'PLANNING') return <Generating />;

  if (!plans.length) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.mist, padding: pad, paddingTop: space(6) }}>
        <Empty
          title="No plans generated yet"
          body="The engine searches the seeded inventory, validates every candidate, and keeps only the ones that genuinely trade off against each other."
          icon="compass"
          action={<Button label="Generate recovery plans" icon="recovery" onPress={() => void generatePlans()} />}
        />
      </View>
    );
  }

  const generation = history.find((h) => h.kind === 'GENERATION');

  return (
    <View style={{ flex: 1, backgroundColor: colors.mist }}>
      <DoodleField opacity={0.04} density={0.5} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: space(26) }}>
        <View style={{ paddingHorizontal: pad, paddingTop: space(4) }}>
          <ChapterHeader
            marker="Chapter four · save the journey"
            title={`${plans.length} ways to save your trip.`}
            standfirst={generation?.detail}
            scene="mountain"
          />
        </View>

        {/* the deck */}
        <Animated.ScrollView
          ref={scroller as never}
          horizontal
          snapToInterval={cardW + gap}
          decelerationRate="fast"
          showsHorizontalScrollIndicator={false}
          onScroll={onScroll}
          scrollEventThrottle={16}
          onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / (cardW + gap)))}
          contentContainerStyle={{ paddingHorizontal: pad, paddingVertical: space(2), gap }}
        >
          {plans.map((plan, i) => (
            <PlanDeckCard
              key={plan.id}
              plan={plan}
              index={i}
              width={cardW}
              step={cardW + gap}
              scrollX={scrollX}
              onOpen={() => onOpenPlan(plan.id)}
            />
          ))}
        </Animated.ScrollView>

        {/* deck position */}
        <Row gap={7} justify="center" style={{ marginTop: space(3) }}>
          {plans.map((plan, i) => (
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

        <View style={{ paddingHorizontal: pad, paddingTop: space(7) }}>
          <PaperCard depth="lifted" accent={colors.indigo} tinted={colors.periSoft}>
            <Row gap={space(2.5)} align="flex-start">
              <TravelIcon name="compass" size={17} color={colors.indigo} weight={1.7} />
              <View style={{ flex: 1 }}>
                <Eyebrow color={colors.indigo}>Why we lean this way</Eyebrow>
                <Txt variant="body" style={{ marginTop: space(2) }}>
                  {recommendation}
                </Txt>
              </View>
            </Row>
          </PaperCard>
        </View>
      </ScrollView>
    </View>
  );
}

/** One whole alternate route, as a card in the deck. */
function PlanDeckCard({
  plan,
  index,
  width,
  step,
  scrollX,
  onOpen,
}: {
  plan: RecoveryPlan;
  index: number;
  width: number;
  step: number;
  scrollX: SharedValue<number>;
  onOpen: () => void;
}) {
  const style = useAnimatedStyle(() => {
    const distance = Math.abs(scrollX.value - index * step) / step;
    return {
      transform: [{ perspective: 900 }, { scale: interpolate(distance, [0, 1], [1, 0.95], 'clamp') }],
      opacity: interpolate(distance, [0, 1.15], [1, 0.6], 'clamp'),
    };
  });

  const m = plan.metrics;
  const kept = m.experiencesPreserved === m.experiencesTotal;

  return (
    <Animated.View style={[{ width }, style]}>
      <Animated.View entering={FadeInDown.delay(index * 60).duration(motion.settle)}>
        <PaperCard
          depth={plan.recommended ? 'held' : 'lifted'}
          accent={plan.recommended ? colors.indigo : colors.ruleStrong}
          onPress={onOpen}
          accessibilityLabel={`${plan.title}. ${plan.tagline}. ${m.experiencesPreserved} of ${m.experiencesTotal} experiences, ${inr(m.addedCost)} extra`}
          accessibilityHint="Opens the before and after"
        >
          {plan.recommended ? (
            <Stamp
              label="Recommended"
              tint={colors.indigo}
              fill={colors.periSoft}
              rotate={7}
              style={styles.recStamp}
              icon={<TravelIcon name="check" size={10} color={colors.indigo} weight={2.6} />}
            />
          ) : null}

          <Row justify="space-between" align="flex-start">
            <View style={{ flex: 1, paddingRight: space(3) }}>
              <Eyebrow color={plan.recommended ? colors.indigo : colors.inkFaint}>
                {`Plan ${String.fromCharCode(65 + index)}`}
              </Eyebrow>
              <Txt variant="h2" style={{ marginTop: 5 }} numberOfLines={2}>
                {plan.title}
              </Txt>
              <Txt variant="meta" color={colors.inkMuted} style={{ marginTop: 4 }} numberOfLines={2}>
                {plan.tagline}
              </Txt>
            </View>
          </Row>

          <Divider dashed style={{ marginVertical: space(4) }} />

          {/* headline numbers, on tags */}
          <Row gap={space(2)} wrap>
            <LuggageTag edge={kept ? colors.indigo : colors.amberInk}>
              <Row gap={5}>
                <TravelIcon name="heart" size={11} color={kept ? colors.indigo : colors.amberInk} weight={1.9} />
                <Text style={[type.stamp, { color: colors.inkSoft }]}>
                  {m.experiencesPreserved}/{m.experiencesTotal} KEPT
                </Text>
              </Row>
            </LuggageTag>
            <LuggageTag edge={m.addedCost > 0 ? colors.coralInk : colors.indigo}>
              <Text style={[type.stamp, { color: colors.inkSoft }]}>{inr(m.addedCost)}</Text>
            </LuggageTag>
            <LuggageTag>
              <Text style={[type.stamp, { color: colors.inkSoft }]}>{m.changeCount} CHANGES</Text>
            </LuggageTag>
          </Row>

          {/* what it protects */}
          <View style={{ marginTop: space(4), gap: space(2) }}>
            {plan.bullets.slice(0, 4).map((bullet) => (
              <Row key={bullet} gap={space(2)} align="flex-start">
                <TravelIcon name="check" size={11} color={colors.indigo} weight={2.6} style={{ marginTop: 4 }} />
                <Txt variant="small" color={colors.inkSoft} style={{ flex: 1 }}>
                  {bullet}
                </Txt>
              </Row>
            ))}
          </View>

          <Row gap={space(2)} wrap style={{ marginTop: space(4) }}>
            {plan.strategies.map((s) => (
              <Pill key={s} label={s.replace(/_/g, ' ')} />
            ))}
          </Row>

          <Divider dashed style={{ marginVertical: space(4) }} />

          <Row justify="space-between">
            <Pill
              label={plan.feasibility.feasible ? 'Validated' : 'Blocked'}
              fg={plan.feasibility.feasible ? colors.indigo : colors.coralInk}
              bg={plan.feasibility.feasible ? colors.periSoft : colors.coralSoft}
              icon={plan.feasibility.feasible ? 'shield' : 'cross'}
            />
            <Row gap={6}>
              <Txt variant="meta" color={colors.indigo} style={{ fontFamily: fonts.bold }}>
                Before / after
              </Txt>
              <TravelIcon name="arrowRight" size={12} color={colors.indigo} weight={2.2} />
            </Row>
          </Row>
        </PaperCard>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  generating: { flex: 1, backgroundColor: colors.mist, padding: space(6), paddingTop: space(8) },
  track: {
    height: 6,
    borderRadius: radius.xs,
    backgroundColor: colors.haze,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.rule,
    marginTop: space(6),
    overflow: 'hidden',
  },
  trackFill: { height: '100%', backgroundColor: colors.indigo, borderRadius: radius.xs },
  stageDot: {
    width: 17,
    height: 17,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: colors.ruleStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recStamp: { position: 'absolute', right: space(3), top: space(3), backgroundColor: colors.cloud, zIndex: 2 },
  dot: { width: 7, height: 7, borderRadius: radius.pill, backgroundColor: colors.ruleStrong },
});
