/**
 * SCREEN 13 — Traveller preferences, as a travel passport.
 *
 * These sliders are literally the optimizer's weights, not a personality quiz.
 * The live "recovery style" summary and the resulting weight stamps exist so
 * the effect of moving one is visible before you commit.
 */
import React, { useMemo, useState } from 'react';
import { Text, View } from 'react-native';

import { colors, fonts, space, type } from '@/theme';
import {
  ChapterHeader,
  Chip,
  Eyebrow,
  Loading,
  Row,
  ScreenScaffold,
  StickyCTA,
  Txt,
} from '@/components/primitives';
import { LuggageTag, PaperCard, Stamp } from '@/components/travel/paper';
import { Slider } from '@/components/Slider';
import { TravelIcon, type IconName } from '@/components/travel/TravelIcon';
import { useTrip } from '@/state/store';
import type { Preferences } from '@/types/domain';

const PACES: { key: Preferences['pace']; label: string; detail: string; icon: IconName }[] = [
  { key: 'FAST', label: 'Fast-paced', detail: 'Fit in as much as possible', icon: 'spark' },
  { key: 'BALANCED', label: 'Balanced', detail: 'A full day with room to breathe', icon: 'compass' },
  { key: 'RELAXED', label: 'Relaxed', detail: 'One thing a day is plenty', icon: 'coffee' },
];

/** Mirrors the server's own summariser, so the preview never lies. */
function summarise(p: Preferences): string {
  const ranked: [string, number][] = [
    ['Experience-first', p.experience],
    ['Time-first', p.time],
    ['Safety-first', p.safety],
    ['Comfort-first', p.comfort],
    ['Budget-first', p.budget],
  ];
  ranked.sort((a, b) => b[1] - a[1]);
  const money = p.budget >= 70 ? 'Tight budget.' : p.budget >= 40 ? 'Moderate budget.' : 'Budget is flexible.';
  const nights = p.safety >= 70 ? 'Avoid late nights.' : 'Late arrivals acceptable.';
  const pace = p.pace === 'FAST' ? 'Fast-paced days.' : p.pace === 'RELAXED' ? 'Relaxed days.' : 'Balanced days.';
  return `${ranked[0][0]}. ${money} ${nights} ${pace}`;
}

/** The same sharpening the ranker applies, so the stamps match the engine. */
function weightsFrom(p: Preferences): { label: string; value: number; icon: IconName }[] {
  const raw: [string, number, IconName][] = [
    ['Cost', p.budget, 'ticket'],
    ['Time', p.time, 'clock'],
    ['Experience', p.experience, 'heart'],
    ['Convenience', p.comfort, 'luggage'],
    ['Safety', p.safety, 'shield'],
  ];
  const sharp = raw.map(([label, v, icon]) => [label, Math.pow(Math.max(v, 0), 2), icon] as const);
  const total = sharp.reduce((sum, [, v]) => sum + v, 0) || 1;
  return sharp.map(([label, v, icon]) => ({ label, value: v / total, icon }));
}

export function PreferencesSegment() {
  const trip = useTrip((s) => s.overview?.trip ?? null);
  const savePreferences = useTrip((s) => s.savePreferences);
  const loading = useTrip((s) => s.loading);

  const [draft, setDraft] = useState<Preferences | null>(null);
  const current = draft ?? trip?.preferences ?? null;

  const dirty = useMemo(() => {
    if (!draft || !trip) return false;
    const p = trip.preferences;
    return (
      draft.budget !== p.budget ||
      draft.time !== p.time ||
      draft.experience !== p.experience ||
      draft.comfort !== p.comfort ||
      draft.safety !== p.safety ||
      draft.pace !== p.pace
    );
  }, [draft, trip]);

  if (!trip || !current) return <Loading label="Opening your passport" icon="passport" />;

  const set = (patch: Partial<Preferences>) => setDraft({ ...current, ...patch });
  const weights = weightsFrom(current);

  return (
    <ScreenScaffold
      footer={
        dirty ? (
          <StickyCTA
            label="Save preferences"
            icon="check"
            loading={loading.preferences}
            onPress={() => void savePreferences({ preferences: current }).then(() => setDraft(null))}
            note="Saving clears the current recovery deck so the engine can re-rank."
            secondary={{ label: 'Discard changes', onPress: () => setDraft(null) }}
          />
        ) : undefined
      }
    >
      <ChapterHeader
        marker="Chapter six · understand the traveller"
        title="How do you like to travel?"
        standfirst="These become the weights the recovery ranker uses. Move one and watch the stamps at the bottom shift."
        scene="dawn"
      />

      {/* the passport page */}
      <PaperCard depth="held" folded style={{ marginBottom: space(6) }} tinted={colors.haze}>
        <Row justify="space-between" align="flex-start">
          <Eyebrow color={colors.indigo}>Your recovery style</Eyebrow>
          <Stamp label="Traveller" tint={colors.amberInk} rotate={8} icon={<TravelIcon name="stamp" size={10} color={colors.amberInk} weight={2.2} />} />
        </Row>
        <Txt variant="h2" style={{ marginTop: space(3) }}>
          {summarise(current)}
        </Txt>
      </PaperCard>

      <PaperCard depth="lifted">
        <Slider
          label="Budget sensitivity"
          low="Cost is flexible"
          high="Every rupee counts"
          value={current.budget}
          onChange={(budget) => set({ budget })}
          tint={colors.amberInk}
          icon="ticket"
        />
        <Slider
          label="Time"
          low="Happy to wait"
          high="Minimise transit"
          value={current.time}
          onChange={(time) => set({ time })}
          icon="clock"
        />
        <Slider
          label="Experience"
          low="Getting there is enough"
          high="Protect what we came for"
          value={current.experience}
          onChange={(experience) => set({ experience })}
          tint={colors.coralInk}
          icon="heart"
        />
        <Slider
          label="Comfort"
          low="Anything goes"
          high="Keep it easy"
          value={current.comfort}
          onChange={(comfort) => set({ comfort })}
          tint={colors.lilacInk}
          icon="luggage"
        />
        <Slider
          label="Safety"
          low="Not a concern"
          high="Weigh it heavily"
          value={current.safety}
          onChange={(safety) => set({ safety })}
          tint={colors.indigo}
          icon="shield"
        />
      </PaperCard>

      {/* travel style */}
      <PaperCard depth="lifted" style={{ marginTop: space(4) }}>
        <Eyebrow>Your travel style</Eyebrow>
        <View style={{ marginTop: space(3.5), gap: space(3) }}>
          {PACES.map((pace) => (
            <Row key={pace.key} justify="space-between">
              <Row gap={space(2.5)} style={{ flex: 1, paddingRight: space(3) }} align="flex-start">
                <TravelIcon
                  name={pace.icon}
                  size={16}
                  color={current.pace === pace.key ? colors.indigo : colors.inkFaint}
                  weight={1.7}
                />
                <View style={{ flex: 1 }}>
                  <Txt variant="small" style={{ fontFamily: fonts.bold }}>
                    {pace.label}
                  </Txt>
                  <Txt variant="meta" color={colors.inkMuted} style={{ marginTop: 2 }}>
                    {pace.detail}
                  </Txt>
                </View>
              </Row>
              <Chip
                label={current.pace === pace.key ? 'Selected' : 'Choose'}
                active={current.pace === pace.key}
                onPress={() => set({ pace: pace.key })}
              />
            </Row>
          ))}
        </View>
      </PaperCard>

      {/* the resulting weights, stamped */}
      <PaperCard depth="flat" tinted={colors.haze} style={{ marginTop: space(4) }}>
        <Eyebrow>What the engine will optimise for</Eyebrow>
        <Txt variant="meta" color={colors.inkMuted} style={{ marginTop: 4, marginBottom: space(3.5) }}>
          Sharpened before normalising, so your leading preference actually leads rather than being outvoted by the sum
          of the rest. A stated trade-off, not a validated model of anyone's utility.
        </Txt>
        <Row gap={space(2)} wrap>
          {weights.map((w) => (
            <LuggageTag key={w.label} edge={w.value > 0.25 ? colors.indigo : colors.ruleStrong}>
              <Row gap={5}>
                <TravelIcon name={w.icon} size={11} color={w.value > 0.25 ? colors.indigo : colors.inkMuted} weight={1.9} />
                <Text style={[type.stamp, { color: colors.inkSoft }]}>
                  {w.label} {Math.round(w.value * 100)}%
                </Text>
              </Row>
            </LuggageTag>
          ))}
        </Row>
      </PaperCard>
    </ScreenScaffold>
  );
}
