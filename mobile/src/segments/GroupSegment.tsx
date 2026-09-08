/**
 * SCREEN 14 — Group intelligence. "Your travel crew."
 *
 * Every traveller's needs are read from what they declared, never inferred from
 * a name, an age or a gender. Declared accessibility needs become hard
 * constraints in the validator, not preferences — and the card says so.
 */
import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, fonts, radius, space, type } from '@/theme';
import {
  Button,
  ChapterHeader,
  Divider,
  Eyebrow,
  Loading,
  MetricBar,
  Pill,
  Reveal,
  Row,
  ScreenScaffold,
  StickyCTA,
  Txt,
} from '@/components/primitives';
import { PaperCard, Stamp } from '@/components/travel/paper';
import { ConstraintToggle, Stepper } from '@/components/Slider';
import { TravelIcon, type IconName } from '@/components/travel/TravelIcon';
import { initials } from '@/utils/format';
import { useTrip } from '@/state/store';
import type { GroupConstraints, TravellerInterest } from '@/types/domain';

const INTEREST: Record<TravellerInterest, { label: string; icon: IconName }> = {
  ADVENTURE: { label: 'Adventure', icon: 'mountain' },
  COMFORT: { label: 'Comfort', icon: 'luggage' },
  BUDGET: { label: 'Budget', icon: 'ticket' },
  RELAXATION: { label: 'Relaxation', icon: 'coffee' },
  ACCESSIBILITY: { label: 'Accessibility', icon: 'shield' },
  SAFETY: { label: 'Safety', icon: 'shield' },
  CULTURE: { label: 'Culture', icon: 'camera' },
  FOOD: { label: 'Food', icon: 'coffee' },
};

const ALL = Object.keys(INTEREST) as TravellerInterest[];

export function GroupSegment() {
  const trip = useTrip((s) => s.overview?.trip ?? null);
  const savePreferences = useTrip((s) => s.savePreferences);
  const loading = useTrip((s) => s.loading);

  const [draft, setDraft] = useState<GroupConstraints | null>(null);
  const group = draft ?? trip?.group ?? null;

  const dirty = useMemo(() => {
    if (!draft || !trip) return false;
    return JSON.stringify(draft) !== JSON.stringify(trip.group);
  }, [draft, trip]);

  if (!trip || !group) return <Loading label="Gathering the crew" icon="luggage" />;

  const set = (patch: Partial<GroupConstraints>) => setDraft({ ...group, ...patch });

  /* An honest tally of who asked for what — not a personality model. */
  const balance = ALL.map((interest) => ({
    interest,
    count: trip.travellers.filter((t) => t.interests.includes(interest)).length,
  }))
    .filter((row) => row.count > 0)
    .sort((a, b) => b.count - a.count);

  const accessibility = trip.travellers.filter((t) => t.accessibilityNeeds.length > 0);
  const activities = trip.nodes.filter((n) => n.kind === 'ACTIVITY');

  return (
    <ScreenScaffold
      footer={
        dirty ? (
          <StickyCTA
            label="Save group rules"
            icon="check"
            loading={loading.preferences}
            onPress={() => void savePreferences({ group }).then(() => setDraft(null))}
            note="These are hard constraints — saving re-validates every candidate plan."
            secondary={{ label: 'Discard changes', onPress: () => setDraft(null) }}
          />
        ) : undefined
      }
    >
      <ChapterHeader
        marker="Chapter six · your travel crew"
        title={`${trip.travellers.length} travelling together`}
        standfirst="Preferences come from what each person declared. Nothing here is inferred from a name or an age."
        scene="city"
      />

      {/* overlapping traveller cards */}
      {trip.travellers.map((traveller, i) => (
        <Reveal key={traveller.id} index={i} style={{ marginBottom: i === trip.travellers.length - 1 ? space(4) : -space(2) }}>
          <PaperCard depth="lifted" tiltIndex={i} style={{ zIndex: trip.travellers.length - i }}>
            <Row gap={space(3.5)} align="flex-start">
              <View style={[styles.avatar, { backgroundColor: traveller.avatarTone }]}>
                <Text style={[type.stamp, { color: colors.white, fontSize: 12 }]}>{initials(traveller.name)}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Row justify="space-between" align="flex-start">
                  <Txt variant="h3">{traveller.name}</Txt>
                  {traveller.accessibilityNeeds.length ? (
                    <Stamp label="Needs met" tint={colors.coralInk} rotate={-6} />
                  ) : null}
                </Row>

                <Row gap={space(2)} wrap style={{ marginTop: space(2.5) }}>
                  {traveller.interests.map((interest) => (
                    <Pill
                      key={interest}
                      label={INTEREST[interest].label}
                      icon={INTEREST[interest].icon}
                      fg={colors.indigo}
                      bg={colors.periSoft}
                    />
                  ))}
                </Row>

                {traveller.accessibilityNeeds.length ? (
                  <View style={styles.needs}>
                    <Eyebrow color={colors.coralInk}>Declared — treated as hard constraints</Eyebrow>
                    {traveller.accessibilityNeeds.map((need) => (
                      <Row key={need} gap={space(2)} style={{ marginTop: 5 }}>
                        <TravelIcon name="check" size={10} color={colors.coralInk} weight={2.6} />
                        <Txt variant="small" color={colors.inkSoft}>
                          {need}
                        </Txt>
                      </Row>
                    ))}
                  </View>
                ) : null}
              </View>
            </Row>
          </PaperCard>
        </Reveal>
      ))}

      {/* the balance */}
      <PaperCard depth="lifted" style={{ marginTop: space(3) }}>
        <Eyebrow>Group preference balance</Eyebrow>
        <Txt variant="meta" color={colors.inkMuted} style={{ marginTop: 4, marginBottom: space(4) }}>
          How many of you asked for each thing. Where these pull against each other, the ranker splits the difference
          using the weights on the previous page.
        </Txt>
        {balance.map((row) => (
          <MetricBar
            key={row.interest}
            label={INTEREST[row.interest].label}
            value={(row.count / trip.travellers.length) * 100}
            display={`${row.count} of ${trip.travellers.length}`}
            tint={row.count === trip.travellers.length ? colors.indigo : colors.indigo}
          />
        ))}
      </PaperCard>

      {accessibility.length ? (
        <PaperCard depth="flat" accent={colors.coralInk} tinted={colors.coralSoft} style={{ marginTop: space(4) }}>
          <Row gap={space(2.5)} align="flex-start">
            <TravelIcon name="shield" size={16} color={colors.coralInk} weight={1.7} />
            <View style={{ flex: 1 }}>
              <Eyebrow color={colors.coralInk}>Accessibility in force</Eyebrow>
              <Txt variant="small" color={colors.inkSoft} style={{ marginTop: space(2) }}>
                {accessibility.map((t) => t.name).join(' and ')} declared needs the validator enforces on every
                candidate. Transport that cannot meet them is rejected outright, not merely penalised.
              </Txt>
            </View>
          </Row>
        </PaperCard>
      ) : null}

      {/* group rules */}
      <PaperCard depth="lifted" style={{ marginTop: space(4) }}>
        <Eyebrow>Group rules</Eyebrow>
        <View style={{ marginTop: space(2) }}>
          <ConstraintToggle
            label="Keep the group together"
            detail="No plan splits you across different flights or stays"
            value={group.keepGroupTogether}
            onChange={(keepGroupTogether) => set({ keepGroupTogether })}
            icon="luggage"
          />
          <ConstraintToggle
            label="Avoid late-night travel"
            detail="Nothing arriving between 23:00 and 05:00"
            value={group.avoidLateNightTravel}
            onChange={(avoidLateNightTravel) => set({ avoidLateNightTravel })}
            icon="moon"
          />
          <Stepper
            label="Maximum travel hours per day"
            detail="Over by more than 2h makes a plan infeasible"
            value={group.maxTravelHoursPerDay}
            min={4}
            max={18}
            suffix="h"
            onChange={(maxTravelHoursPerDay) => set({ maxTravelHoursPerDay })}
            icon="clock"
          />
        </View>
      </PaperCard>

      {/* priority activities */}
      <PaperCard depth="lifted" style={{ marginTop: space(4) }}>
        <Eyebrow>Priority experiences</Eyebrow>
        <Txt variant="meta" color={colors.inkMuted} style={{ marginTop: 4, marginBottom: space(3) }}>
          Agreed as a group. A plan that drops one of these is discarded outright.
        </Txt>
        {activities.map((activity, i) => {
          const chosen = group.priorityActivityIds.includes(activity.id);
          return (
            <View key={activity.id}>
              <Row justify="space-between" style={{ paddingVertical: space(2.5) }}>
                <Row gap={space(2.5)} style={{ flex: 1, paddingRight: space(3) }}>
                  <TravelIcon name="ticket" size={14} color={chosen ? colors.coralInk : colors.inkFaint} weight={1.7} />
                  <Txt variant="small" style={{ flex: 1, fontFamily: chosen ? fonts.bold : fonts.text }} numberOfLines={1}>
                    {activity.title}
                  </Txt>
                </Row>
                <Button
                  label={chosen ? 'Priority' : 'Add'}
                  variant={chosen ? 'primary' : 'secondary'}
                  onPress={() =>
                    set({
                      priorityActivityIds: chosen
                        ? group.priorityActivityIds.filter((id) => id !== activity.id)
                        : [...group.priorityActivityIds, activity.id],
                    })
                  }
                  style={styles.priorityBtn}
                />
              </Row>
              {i < activities.length - 1 ? <Divider /> : null}
            </View>
          );
        })}
      </PaperCard>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  needs: {
    marginTop: space(3),
    padding: space(3),
    borderRadius: radius.sm,
    backgroundColor: colors.coralSoft,
  },
  priorityBtn: { minHeight: 44, paddingHorizontal: space(3.5) },
});
