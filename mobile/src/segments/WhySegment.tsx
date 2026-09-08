/**
 * SCREEN 10 — Why this plan.
 *
 * The trust layer. Rather than asserting a recommendation, the page shows the
 * derivation: your priorities, plus the trip's hard constraints, plus what was
 * actually available, arrowed down into the plan that came out. Then the
 * sentence, in plain language.
 *
 * Everything here is engine output. Nothing is written by a language model.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, radius, space, type } from '@/theme';
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
  Txt,
} from '@/components/primitives';
import { PaperCard, Stamp } from '@/components/travel/paper';
import { TravelIcon, type IconName } from '@/components/travel/TravelIcon';
import { inr } from '@/utils/format';
import { useTrip } from '@/state/store';

export function WhySegment({ planId, onPlanId }: { planId: string | null; onPlanId: (id: string) => void }) {
  const plans = useTrip((s) => s.plans);
  const recommendation = useTrip((s) => s.recommendation);
  const overview = useTrip((s) => s.overview);
  const alternatives = useTrip((s) => s.alternatives);
  const history = useTrip((s) => s.history);

  if (!plans.length || !overview) {
    return (
      <ScreenScaffold>
        <Empty
          title="No plan to explain yet"
          body="Once the engine has ranked some options, this page shows exactly how it got there."
          icon="compass"
        />
      </ScreenScaffold>
    );
  }

  const plan = plans.find((p) => p.id === planId) ?? plans.find((p) => p.recommended) ?? plans[0];
  const prefs = overview.trip.preferences;
  const safety = overview.trip.safety;
  const generation = history.find((h) => h.kind === 'GENERATION');

  const priorities = (
    [
      { label: 'Experience', value: prefs.experience, icon: 'heart' },
      { label: 'Safety', value: prefs.safety, icon: 'shield' },
      { label: 'Comfort', value: prefs.comfort, icon: 'luggage' },
      { label: 'Time', value: prefs.time, icon: 'clock' },
      { label: 'Budget', value: prefs.budget, icon: 'ticket' },
    ] satisfies { label: string; value: number; icon: IconName }[]
  ).sort((a, b) => b.value - a.value);

  const hardRules = [
    safety.keepGroupTogether ? 'Keep the group together' : null,
    safety.preferAccessibleTransport ? 'Accessible transport only' : null,
    `Under ${safety.maxTravelHoursPerDay}h travel per day`,
    'Must-do experiences cannot be dropped',
  ].filter(Boolean) as string[];

  return (
    <ScreenScaffold>
      {/* plan switcher, so "why" never means going back */}
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
        marker="Chapter four · the reasoning"
        title="Why we recommend this."
        standfirst="Three inputs, one output. Every number below came from your itinerary or your own settings."
        scene="night"
      />

      {/* --- input 1: your priorities --- */}
      <Reveal index={0}>
        <PaperCard depth="lifted" style={{ marginBottom: space(2) }}>
          <Row justify="space-between">
            <Row gap={7}>
              <TravelIcon name="passport" size={15} color={colors.indigo} weight={1.7} />
              <Eyebrow color={colors.indigo}>Input one · your priorities</Eyebrow>
            </Row>
            <Text style={[type.code, { color: colors.inkFaint }]}>YOU</Text>
          </Row>

          <View style={{ marginTop: space(4) }}>
            {priorities.map((p, i) => (
              <Row key={p.label} gap={space(2.5)} style={{ marginBottom: space(2.5) }}>
                <TravelIcon name={p.icon} size={13} color={i === 0 ? colors.indigo : colors.inkMuted} weight={1.7} />
                <Txt variant="small" color={i === 0 ? colors.ink : colors.inkSoft} style={{ width: 86 }}>
                  {p.label}
                </Txt>
                <View style={styles.bar}>
                  <View
                    style={[
                      styles.barFill,
                      { width: `${p.value}%`, backgroundColor: i === 0 ? colors.indigo : colors.periMid },
                    ]}
                  />
                </View>
                {/* The bar length is the reading. Printing the slider number
                    invites arguing with a weight rather than adjusting it. */}
                {i === 0 ? <Eyebrow color={colors.indigo}>leads</Eyebrow> : <View style={{ width: 30 }} />}
              </Row>
            ))}
          </View>

          <Txt variant="meta" color={colors.inkMuted} style={{ marginTop: space(2) }}>
            {prefs.summary}
          </Txt>
        </PaperCard>
      </Reveal>

      <Joint />

      {/* --- input 2: the trip's hard constraints --- */}
      <Reveal index={1}>
        <PaperCard depth="lifted" style={{ marginBottom: space(2) }}>
          <Row justify="space-between">
            <Row gap={7}>
              <TravelIcon name="lock" size={15} color={colors.coralInk} weight={1.7} />
              <Eyebrow color={colors.coralInk}>Input two · what cannot bend</Eyebrow>
            </Row>
            <Text style={[type.code, { color: colors.inkFaint }]}>RULES</Text>
          </Row>

          <View style={{ marginTop: space(3.5), gap: space(2) }}>
            {hardRules.map((rule) => (
              <Row key={rule} gap={space(2)} align="flex-start">
                <TravelIcon name="check" size={11} color={colors.coralInk} weight={2.6} style={{ marginTop: 4 }} />
                <Txt variant="small" color={colors.inkSoft} style={{ flex: 1 }}>
                  {rule}
                </Txt>
              </Row>
            ))}
          </View>

          <Txt variant="meta" color={colors.inkMuted} style={{ marginTop: space(3) }}>
            A plan breaking any of these is discarded before it can be ranked — you are never shown one.
          </Txt>
        </PaperCard>
      </Reveal>

      <Joint />

      {/* --- input 3: what was actually available --- */}
      <Reveal index={2}>
        <PaperCard depth="lifted" style={{ marginBottom: space(2) }}>
          <Row justify="space-between">
            <Row gap={7}>
              <TravelIcon name="luggage" size={15} color={colors.amberInk} weight={1.7} />
              <Eyebrow color={colors.amberInk}>Input three · what was available</Eyebrow>
            </Row>
            <Text style={[type.code, { color: colors.inkFaint }]}>SUPPLY</Text>
          </Row>

          <Row gap={space(2)} wrap style={{ marginTop: space(3.5) }}>
            <Pill label={`${alternatives?.transport.length ?? 0} transport options`} icon="plane" />
            <Pill label={`${alternatives?.stays.length ?? 0} stays`} icon="hotel" />
            <Pill label={`${alternatives?.slots.length ?? 0} activity slots`} icon="ticket" />
          </Row>

          {generation ? (
            <Txt variant="meta" color={colors.inkMuted} style={{ marginTop: space(3) }}>
              {generation.detail}
            </Txt>
          ) : null}
        </PaperCard>
      </Reveal>

      {/* --- the output --- */}
      <View style={styles.outputJoint}>
        <View style={styles.outputLine} />
        <View style={styles.outputArrow}>
          <TravelIcon name="arrowDown" size={16} color={colors.indigo} weight={2.2} />
        </View>
      </View>

      <Reveal index={3}>
        <PaperCard depth="held" accent={colors.indigo} tinted={colors.periSoft}>
          <Row justify="space-between" align="flex-start">
            <View style={{ flex: 1, paddingRight: space(3) }}>
              <Eyebrow color={colors.indigo}>The plan that came out</Eyebrow>
              <Txt variant="h1" style={{ marginTop: space(2) }}>
                {plan.title}
              </Txt>
            </View>
            <Stamp
              label={plan.recommended ? 'Recommended' : 'Alternative'}
              tint={colors.indigo}
              fill={colors.white}
              rotate={-8}
            />
          </Row>

          <Divider dashed style={{ marginVertical: space(4) }} />

          <Txt variant="body" >
            {plan.explanation}
          </Txt>

          <Row gap={space(2)} wrap style={{ marginTop: space(4) }}>
            <Pill
              label={`${plan.metrics.experiencesPreserved}/${plan.metrics.experiencesTotal} experiences`}
              fg={colors.indigo}
              bg={colors.white}
              icon="heart"
            />
            <Pill label={inr(plan.metrics.addedCost)} fg={colors.inkSoft} bg={colors.white} icon="ticket" />
            <Pill
              label={plan.metrics.lateNightArrivals === 0 ? 'No late nights' : `${plan.metrics.lateNightArrivals} late night`}
              fg={plan.metrics.lateNightArrivals === 0 ? colors.indigo : colors.amberInk}
              bg={colors.white}
              icon="moon"
            />
          </Row>
        </PaperCard>
      </Reveal>

      {/* the comparative sentence */}
      <View style={{ marginTop: space(7) }}>
        <SectionHeader eyebrow="In one sentence" title="How it beat the others" />
        <PaperCard depth="flat" tinted={colors.haze}>
          <Row gap={space(2.5)} align="flex-start">
            <TravelIcon name="compass" size={16} color={colors.indigo} weight={1.7} />
            <Txt variant="body" style={{ flex: 1 }}>
              {recommendation}
            </Txt>
          </Row>
        </PaperCard>
      </View>

      {/* trade-offs being accepted */}
      {plan.feasibility.violations.filter((v) => !v.hard).length ? (
        <PaperCard depth="flat" accent={colors.amberInk} tinted={colors.amberSoft} style={{ marginTop: space(4) }}>
          <Row gap={space(2.5)} align="flex-start">
            <TravelIcon name="warning" size={15} color={colors.amberInk} weight={1.7} />
            <View style={{ flex: 1 }}>
              <Eyebrow color={colors.amberInk}>What you would be accepting</Eyebrow>
              {plan.feasibility.violations
                .filter((v) => !v.hard)
                .map((v, i) => (
                  <Txt key={i} variant="small" color={colors.inkSoft} style={{ marginTop: space(2) }}>
                    · {v.message}
                  </Txt>
                ))}
            </View>
          </Row>
        </PaperCard>
      ) : null}

      <Txt variant="meta" color={colors.inkFaint} style={{ marginTop: space(5) }}>
        Weights are a stated trade-off from your own sliders, not a measured model of human preference. Prices and
        availability are seeded demo inventory.
      </Txt>
    </ScreenScaffold>
  );
}

/** The dotted joint that threads the inputs together. */
function Joint() {
  return (
    <View style={styles.joint}>
      <View style={styles.jointLine} />
      <View style={styles.jointPlus}>
        <TravelIcon name="plus" size={12} color={colors.inkFaint} weight={2.4} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flex: 1,
    height: 7,
    borderRadius: radius.xs,
    backgroundColor: colors.haze,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.rule,
    overflow: 'hidden',
  },
  barFill: { height: '100%', borderRadius: radius.xs },
  joint: { alignItems: 'center', height: 34, justifyContent: 'center', marginBottom: space(2) },
  jointLine: { position: 'absolute', width: 1.5, height: 34, backgroundColor: colors.rule },
  jointPlus: { backgroundColor: colors.mist, paddingVertical: 2, paddingHorizontal: 3 },
  outputJoint: { alignItems: 'center', height: 44, justifyContent: 'center', marginVertical: space(1) },
  outputLine: { position: 'absolute', width: 2, height: 44, backgroundColor: colors.periMid },
  outputArrow: { backgroundColor: colors.mist, padding: 3 },
});
