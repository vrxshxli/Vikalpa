/**
 * SCREEN 21 — Safety and comfort. "Your travel boundaries."
 *
 * Every toggle states what it actually does to the engine — whether it makes a
 * plan infeasible or merely costs it points. A switch that quietly did nothing
 * would be worse than no switch at all.
 *
 * The page closes with the rulebook: the same settings, restated as the rules
 * recovery will be held to.
 */
import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, fonts, radius, space, type } from '@/theme';
import {
  ChapterHeader,
  Divider,
  Eyebrow,
  Loading,
  Pill,
  Row,
  ScreenScaffold,
  SectionHeader,
  StickyCTA,
  Txt,
} from '@/components/primitives';
import { LuggageTag, PaperCard, Stamp } from '@/components/travel/paper';
import { ConstraintToggle, Stepper } from '@/components/Slider';
import { TravelIcon, type IconName } from '@/components/travel/TravelIcon';
import { useTrip } from '@/state/store';
import type { SafetyConstraints } from '@/types/domain';

const RULES: {
  key: keyof SafetyConstraints;
  label: string;
  icon: IconName;
  kind: 'HARD' | 'SOFT';
  effect: string;
}[] = [
  {
    key: 'avoidLateNightArrival',
    label: 'Avoid late-night arrival',
    icon: 'moon',
    kind: 'SOFT',
    effect: 'Any arrival between 23:00 and 05:00 costs a plan 28 points on the safety axis. Arrivals on legs you cannot move are not counted against it.',
  },
  {
    key: 'preferVerifiedTransfers',
    label: 'Prefer verified transfers',
    icon: 'shield',
    kind: 'SOFT',
    effect: 'Each unvetted ground operator costs 12 points on the safety axis.',
  },
  {
    key: 'avoidIsolatedLocations',
    label: 'Avoid isolated locations',
    icon: 'pin',
    kind: 'SOFT',
    effect: 'Deprioritises stays and pickups away from populated areas.',
  },
  {
    key: 'keepGroupTogether',
    label: 'Keep group together',
    icon: 'luggage',
    kind: 'HARD',
    effect: 'A plan that splits the party across different legs is discarded.',
  },
  {
    key: 'preferAccessibleTransport',
    label: 'Prefer accessible transport',
    icon: 'transfer',
    kind: 'HARD',
    effect: 'Where a traveller declared step-free needs, transport that cannot meet them is rejected.',
  },
  {
    key: 'preferNearbyEmergencyFacilities',
    label: 'Prefer nearby emergency facilities',
    icon: 'heart',
    kind: 'SOFT',
    effect: 'Prefers stays close to medical facilities when the choice is otherwise even.',
  },
];

export function SafetySegment() {
  const trip = useTrip((s) => s.overview?.trip ?? null);
  const savePreferences = useTrip((s) => s.savePreferences);
  const loading = useTrip((s) => s.loading);

  const [draft, setDraft] = useState<SafetyConstraints | null>(null);
  const safety = draft ?? trip?.safety ?? null;

  const dirty = useMemo(() => {
    if (!draft || !trip) return false;
    return JSON.stringify(draft) !== JSON.stringify(trip.safety);
  }, [draft, trip]);

  if (!trip || !safety) return <Loading label="Reading your boundaries" icon="shield" />;

  const set = (patch: Partial<SafetyConstraints>) => setDraft({ ...safety, ...patch });
  const active = RULES.filter((r) => safety[r.key]);
  const hard = active.filter((r) => r.kind === 'HARD');

  return (
    <ScreenScaffold
      footer={
        dirty ? (
          <StickyCTA
            label="Save boundaries"
            icon="check"
            loading={loading.preferences}
            onPress={() => void savePreferences({ safety }).then(() => setDraft(null))}
            note="Saving re-validates and re-ranks every candidate plan."
            secondary={{ label: 'Discard changes', onPress: () => setDraft(null) }}
          />
        ) : undefined
      }
    >
      <ChapterHeader
        marker="Chapter eight · boundaries"
        title="Lines we should not cross."
        standfirst={`${active.length} in force — ${hard.length} of them can make a plan infeasible outright, the rest cost it points.`}
        scene="mountain"
      />

      <PaperCard depth="lifted">
        {RULES.map((rule) => (
          <View key={rule.key}>
            <ConstraintToggle
              label={rule.label}
              detail={rule.effect}
              value={Boolean(safety[rule.key])}
              onChange={(value) => set({ [rule.key]: value } as Partial<SafetyConstraints>)}
              icon={rule.icon}
            />
            {safety[rule.key] ? (
              <Pill
                label={rule.kind === 'HARD' ? 'Hard constraint' : 'Scored penalty'}
                fg={rule.kind === 'HARD' ? colors.coralInk : colors.amberInk}
                bg={rule.kind === 'HARD' ? colors.coralSoft : colors.amberSoft}
                icon={rule.kind === 'HARD' ? 'lock' : 'warning'}
                style={{ marginTop: -space(1.5), marginBottom: space(2.5), marginLeft: space(8) }}
              />
            ) : null}
          </View>
        ))}

        <Stepper
          label="Maximum travel hours per day"
          detail="Over by up to 2h is a penalty. Over by more than 2h is infeasible."
          value={safety.maxTravelHoursPerDay}
          min={4}
          max={18}
          suffix="h"
          onChange={(maxTravelHoursPerDay) => set({ maxTravelHoursPerDay })}
          icon="clock"
        />
      </PaperCard>

      {/* the rulebook */}
      <View style={{ marginTop: space(7) }}>
        <SectionHeader
          eyebrow="In force"
          title="Your recovery rulebook"
          subtitle="Every plan you are shown has already been held to these."
        />
        <PaperCard depth="held" tinted={colors.haze} folded>
          <Row justify="space-between" align="flex-start" style={{ marginBottom: space(4) }}>
            <LuggageTag edge={colors.indigo}>
              <Text style={[type.stamp, { color: colors.indigo }]}>RULEBOOK</Text>
            </LuggageTag>
            <Stamp
              label={`${active.length} rules`}
              tint={colors.indigo}
              rotate={7}
              icon={<TravelIcon name="lock" size={10} color={colors.indigo} weight={2.2} />}
            />
          </Row>

          {active.length === 0 ? (
            <Txt variant="small" color={colors.inkMuted}>
              No boundaries set. The ranker will optimise purely on your preference weights.
            </Txt>
          ) : (
            active.map((rule, i) => (
              <View key={rule.key}>
                <Row gap={space(2.5)} align="flex-start" style={{ paddingVertical: space(2.5) }}>
                  <View
                    style={[
                      styles.mark,
                      { backgroundColor: rule.kind === 'HARD' ? colors.coralSoft : colors.amberSoft },
                    ]}
                  >
                    <TravelIcon
                      name={rule.kind === 'HARD' ? 'lock' : 'warning'}
                      size={11}
                      color={rule.kind === 'HARD' ? colors.coralInk : colors.amberInk}
                      weight={2.2}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Txt variant="small" style={{ fontFamily: fonts.bold }}>
                      {rule.label}
                    </Txt>
                    <Txt variant="meta" color={colors.inkMuted} style={{ marginTop: 2 }}>
                      {rule.kind === 'HARD' ? 'Plans breaking this are never shown to you' : 'Plans breaking this rank lower'}
                    </Txt>
                  </View>
                </Row>
                {i < active.length - 1 ? <Divider /> : null}
              </View>
            ))
          )}

          <Divider dashed style={{ marginVertical: space(3.5) }} />
          <Row gap={space(2.5)} align="flex-start">
            <TravelIcon name="clock" size={13} color={colors.inkMuted} weight={1.7} />
            <Txt variant="small" color={colors.inkSoft} style={{ flex: 1 }}>
              No more than {safety.maxTravelHoursPerDay} hours of travel on any single day.
            </Txt>
          </Row>
        </PaperCard>

        <PaperCard depth="flat" tinted={colors.haze} style={{ marginTop: space(4) }}>
          <Eyebrow>How to read this</Eyebrow>
          <Txt variant="small" color={colors.inkSoft} style={{ marginTop: space(2) }}>
            A hard constraint removes plans from the deck entirely — you will never see one that breaks it. A scored
            penalty leaves the plan on the table but pushes it down the ranking, so you can still take it knowingly.
            Every plan's Before / After page lists the soft violations it is asking you to accept.
          </Txt>
        </PaperCard>
      </View>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  mark: { width: 22, height: 22, borderRadius: radius.xs, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
});
