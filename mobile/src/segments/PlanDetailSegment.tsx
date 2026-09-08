/**
 * SCREEN 11 — Before / after, and the rebuilt trip.
 *
 * Every change is a reissued ticket: the old time struck through, the new time
 * stamped beside it, and the engine's reason underneath. Accepting runs the
 * same ItineraryCanvas over the new node set, so the trip visibly rearranges
 * itself rather than a different screen appearing.
 */
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, LinearTransition } from 'react-native-reanimated';

import { colors, fonts, motion, radius, space, useReducedMotion } from '@/theme';
import {
  ChapterHeader,
  Chip,
  Divider,
  Empty,
  Eyebrow,
  Pill,
  Reveal,
  Row,
  ScreenScaffold,
  SectionHeader,
  StatTile,
  StickyCTA,
  Txt,
} from '@/components/primitives';
import { LuggageTag, PaperCard, Stamp, TapeStrip } from '@/components/travel/paper';
import { ItineraryCanvas } from '@/components/travel/ItineraryCanvas';
import { JourneyRibbon } from '@/components/travel/JourneyRibbon';
import { TravelIcon, kindIcon } from '@/components/travel/TravelIcon';
import { inr } from '@/utils/format';
import * as haptic from '@/utils/haptics';
import { useTrip } from '@/state/store';
import type { PlanChange, RecoveryPlan } from '@/types/domain';

const CHANGE_TONE: Record<PlanChange['changeType'], { tint: string; label: string }> = {
  REPLACED: { tint: colors.amberInk, label: 'Reissued' },
  MOVED: { tint: colors.amberInk, label: 'Moved' },
  DROPPED: { tint: colors.coralInk, label: 'Let go' },
  ADDED: { tint: colors.indigo, label: 'Added' },
  UNCHANGED: { tint: colors.inkFaint, label: 'Unchanged' },
};

export function PlanDetailSegment({ planId, onPlanId }: { planId: string | null; onPlanId: (id: string) => void }) {
  const plans = useTrip((s) => s.plans);
  const appliedPlan = useTrip((s) => s.appliedPlan);
  const acceptPlan = useTrip((s) => s.acceptPlan);
  const phase = useTrip((s) => s.phase);
  const loading = useTrip((s) => s.loading);

  const [showUnchanged, setShowUnchanged] = useState(false);

  /* Once accepted, this chapter becomes the payoff. */
  if (phase === 'RECOVERED' && appliedPlan) return <Rebuilt plan={appliedPlan} />;

  if (!plans.length) {
    return (
      <ScreenScaffold>
        <Empty
          title="No plan open"
          body="Pick one from the Options chapter to see exactly what it changes."
          icon="ticket"
        />
      </ScreenScaffold>
    );
  }

  const plan = plans.find((p) => p.id === planId) ?? plans[0];
  const changed = plan.changes.filter((c) => c.changeType !== 'UNCHANGED');
  const unchanged = plan.changes.filter((c) => c.changeType === 'UNCHANGED');

  return (
    <ScreenScaffold
      footer={
        <StickyCTA
          label="Accept this plan"
          icon="check"
          onPress={() => {
            haptic.heavy();
            void acceptPlan(plan.id);
          }}
          loading={loading.accept}
          disabled={!plan.feasibility.feasible}
          note="Prices and availability are seeded demo inventory, not live market data."
        />
      }
    >
      <Row gap={space(2)} wrap style={{ marginBottom: space(5) }}>
        {plans.map((p) => (
          <Chip
            key={p.id}
            label={p.title}
            icon={p.recommended ? 'check' : undefined}
            active={p.id === plan.id}
            onPress={() => onPlanId(p.id)}
          />
        ))}
      </Row>

      <ChapterHeader
        marker={plan.recommended ? 'Chapter four · recommended plan' : 'Chapter four · recovery plan'}
        title={plan.title}
        standfirst={plan.explanation}
        scene="dusk"
      />

      <Row gap={space(2)}>
        <StatTile
          label="Experiences"
          value={`${plan.metrics.experiencesPreserved}/${plan.metrics.experiencesTotal}`}
          tint={colors.indigo}
          icon="heart"
        />
        <StatTile label="Extra cost" value={inr(plan.metrics.addedCost)} icon="ticket" />
        <StatTile
          label="Sunk"
          value={inr(plan.metrics.refundLost)}
          hint="not recoverable"
          tint={plan.metrics.refundLost > 0 ? colors.coralInk : colors.indigo}
          icon="lock"
        />
      </Row>

      {/* ---------- before / after ---------- */}
      <View style={{ marginTop: space(8) }}>
        <SectionHeader
          eyebrow="Before / after"
          title={`${changed.length} bookings change`}
          subtitle="Each one carries the engine's reason for touching it."
        />

        {changed.map((change, i) => {
          const tone = CHANGE_TONE[change.changeType];
          return (
            <Reveal key={change.nodeId} index={i} style={{ marginBottom: space(3) }}>
              <PaperCard accent={tone.tint} tiltIndex={i}>
                {change.changeType === 'MOVED' || change.changeType === 'REPLACED' ? (
                  <TapeStrip width={50} rotate={-15} tint={colors.amberSoft} style={{ top: -8, right: 18 }} />
                ) : null}

                <Row justify="space-between" align="flex-start">
                  <Row gap={space(2.5)} style={{ flex: 1, paddingRight: space(2) }} align="flex-start">
                    <TravelIcon
                      name={kindIcon[change.kind] ?? 'pin'}
                      size={15}
                      color={tone.tint}
                      weight={1.7}
                      badge={change.changeType === 'DROPPED' ? 'cross' : undefined}
                      badgeBackground={tone.tint}
                    />
                    <View style={{ flex: 1 }}>
                      <Eyebrow color={tone.tint}>{tone.label}</Eyebrow>
                      <Txt variant="h3" style={{ marginTop: 4, fontSize: 15.5 }} numberOfLines={2}>
                        {change.title}
                      </Txt>
                    </View>
                  </Row>
                  {change.costDelta !== 0 ? (
                    <LuggageTag edge={change.costDelta > 0 ? colors.coralInk : colors.indigo}>
                      <Txt variant="meta" color={change.costDelta > 0 ? colors.coralInk : colors.indigo} style={{ fontSize: 10.5 }}>
                        {inr(change.costDelta, { sign: true })}
                      </Txt>
                    </LuggageTag>
                  ) : null}
                </Row>

                {/* the reissue */}
                <Row gap={space(2.5)} align="center" style={{ marginTop: space(4) }}>
                  <View style={styles.slot}>
                    <Eyebrow color={colors.inkFaint}>Was</Eyebrow>
                    <Txt
                      variant="small"
                      color={colors.inkMuted}
                      style={{ marginTop: 3, textDecorationLine: 'line-through' }}
                    >
                      {change.before ?? '—'}
                    </Txt>
                  </View>
                  <TravelIcon name="arrowRight" size={14} color={colors.inkFaint} weight={2} />
                  <View style={[styles.slot, { backgroundColor: `${tone.tint}18` }]}>
                    <Eyebrow color={tone.tint}>{change.changeType === 'DROPPED' ? 'Removed' : 'Now'}</Eyebrow>
                    <Txt variant="small" style={{ marginTop: 3, fontFamily: fonts.bold }}>
                      {change.after ?? 'Not happening'}
                    </Txt>
                  </View>
                </Row>

                <Txt variant="meta" color={colors.inkSoft} style={{ marginTop: space(3.5) }}>
                  {change.explanation}
                </Txt>
              </PaperCard>
            </Reveal>
          );
        })}

        {unchanged.length ? (
          <Pressable
            onPress={() => setShowUnchanged(!showUnchanged)}
            accessibilityRole="button"
            accessibilityState={{ expanded: showUnchanged }}
            accessibilityLabel={`${unchanged.length} bookings untouched`}
          >
            <PaperCard depth="flat" tinted={colors.haze}>
              <Row justify="space-between">
                <Row gap={7}>
                  <TravelIcon name="check" size={13} color={colors.indigo} weight={2.4} />
                  <Txt variant="small" color={colors.inkSoft}>
                    {unchanged.length} booking{unchanged.length === 1 ? '' : 's'} untouched
                  </Txt>
                </Row>
                <Txt variant="meta" color={colors.indigo} style={{ fontFamily: fonts.bold }}>
                  {showUnchanged ? 'Hide' : 'Show'}
                </Txt>
              </Row>
              {showUnchanged ? (
                <Animated.View entering={FadeIn.duration(motion.quick)} style={{ marginTop: space(3) }}>
                  {unchanged.map((c) => (
                    <Row key={c.nodeId} justify="space-between" style={{ paddingVertical: 4 }}>
                      <Txt variant="meta" color={colors.inkMuted} numberOfLines={1} style={{ flex: 1 }}>
                        {c.title}
                      </Txt>
                      <Txt variant="meta" color={colors.inkFaint}>
                        {c.after}
                      </Txt>
                    </Row>
                  ))}
                </Animated.View>
              ) : null}
            </PaperCard>
          </Pressable>
        ) : null}
      </View>

      {/* ---------- why this works ---------- */}
      <View style={{ marginTop: space(8) }}>
        <SectionHeader
          eyebrow="Feasibility"
          title="Why this works"
          subtitle="Every candidate is put through these checks before it is allowed to be ranked."
        />
        <PaperCard depth="lifted">
          {plan.feasibility.checks.map((check, i) => (
            <View key={check.label}>
              <Row gap={space(3)} align="flex-start" style={{ paddingVertical: space(2.5) }}>
                <View style={[styles.checkMark, { backgroundColor: check.passed ? colors.periSoft : colors.coralSoft }]}>
                  <TravelIcon
                    name={check.passed ? 'check' : 'cross'}
                    size={11}
                    color={check.passed ? colors.indigo : colors.coralInk}
                    weight={2.8}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Txt variant="small" style={{ fontFamily: fonts.bold }}>
                    {check.label}
                  </Txt>
                  <Txt variant="meta" color={colors.inkMuted} style={{ marginTop: 2 }}>
                    {check.detail}
                  </Txt>
                </View>
              </Row>
              {i < plan.feasibility.checks.length - 1 ? <Divider /> : null}
            </View>
          ))}
        </PaperCard>

        {plan.feasibility.violations.filter((v) => !v.hard).length ? (
          <PaperCard depth="flat" accent={colors.amberInk} tinted={colors.amberSoft} style={{ marginTop: space(3) }}>
            <Eyebrow color={colors.amberInk}>Trade-offs you are accepting</Eyebrow>
            {plan.feasibility.violations
              .filter((v) => !v.hard)
              .map((v, i) => (
                <Txt key={i} variant="small" color={colors.inkSoft} style={{ marginTop: space(2) }}>
                  · {v.message}
                </Txt>
              ))}
          </PaperCard>
        ) : null}
      </View>
    </ScreenScaffold>
  );
}

/** The emotional payoff: the journey, back on its feet. */
function Rebuilt({ plan }: { plan: RecoveryPlan }) {
  const trip = useTrip((s) => s.overview?.trip ?? null);
  const reduced = useReducedMotion();

  useEffect(() => {
    haptic.success();
  }, []);

  if (!trip) return null;

  const changedIds = new Set(
    plan.changes.filter((c) => c.changeType === 'MOVED' || c.changeType === 'REPLACED').map((c) => c.nodeId),
  );
  const dropped = plan.changes.filter((c) => c.changeType === 'DROPPED');

  return (
    <ScreenScaffold>
      <Animated.View entering={reduced ? undefined : FadeInDown.duration(motion.rebuild)}>
        <PaperCard depth="held" accent={colors.indigo} tinted={colors.periSoft} folded>
          <Row justify="space-between" align="flex-start">
            <Pill label="Back on track" fg={colors.indigo} bg={colors.white} dot icon="shield" />
            <Stamp
              label="Recovered"
              tint={colors.indigo}
              fill={colors.white}
              rotate={9}
              icon={<TravelIcon name="check" size={11} color={colors.indigo} weight={2.6} />}
            />
          </Row>

          <Txt variant="hero" accessibilityRole="header" style={{ marginTop: space(4) }}>
            {plan.metrics.experiencesPreserved} of {plan.metrics.experiencesTotal}
          </Txt>
          <Txt variant="h3" color={colors.inkSoft} style={{ marginTop: -2 }}>
            experiences saved
          </Txt>
          <Txt variant="small" color={colors.inkSoft} style={{ marginTop: space(3) }}>
            {plan.explanation}
          </Txt>

          <JourneyRibbon nodes={trip.nodes} variant="cities" orientation="horizontal" style={{ marginTop: space(4) }} />
        </PaperCard>
      </Animated.View>

      <Row gap={space(2)} style={{ marginTop: space(4) }}>
        <StatTile label="Extra cost" value={inr(plan.metrics.addedCost)} icon="ticket" />
        <StatTile label="Changed" value={String(plan.metrics.changeCount)} hint="bookings" icon="recovery" />
        <StatTile
          label="Late nights"
          value={String(plan.metrics.lateNightArrivals)}
          tint={plan.metrics.lateNightArrivals ? colors.amberInk : colors.indigo}
          icon="moon"
        />
      </Row>

      {dropped.length ? (
        <PaperCard depth="flat" accent={colors.coralInk} tinted={colors.coralSoft} style={{ marginTop: space(4) }}>
          <Row gap={space(2.5)} align="flex-start">
            <TravelIcon name="heart" size={15} color={colors.coralInk} weight={1.7} badge="cross" badgeBackground={colors.coralInk} />
            <View style={{ flex: 1 }}>
              <Eyebrow color={colors.coralInk}>What we had to give up</Eyebrow>
              {dropped.map((d) => (
                <View key={d.nodeId} style={{ marginTop: space(2.5) }}>
                  <Txt variant="small" style={{ fontFamily: fonts.bold }}>
                    {d.title}
                  </Txt>
                  <Txt variant="meta" color={colors.inkMuted} style={{ marginTop: 2 }}>
                    {d.explanation}
                  </Txt>
                </View>
              ))}
            </View>
          </Row>
        </PaperCard>
      ) : null}

      <View style={{ marginTop: space(8) }}>
        <SectionHeader
          eyebrow="Your journey now"
          title="Rebuilt itinerary"
          subtitle="Taped bookings are the ones this plan moved."
        />
        <Animated.View layout={LinearTransition.springify().damping(motion.springSoft.damping)}>
          <ItineraryCanvas nodes={trip.nodes} changedIds={changedIds} />
        </Animated.View>
      </View>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  slot: { flex: 1, backgroundColor: colors.haze, borderRadius: radius.sm, padding: space(2.5) },
  checkMark: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
});
