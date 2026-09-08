/**
 * SCREEN 22 — Destination / seasonal risk. "Why is your trip at risk?"
 *
 * Destination profiles are everywhere; the only part that matters is the
 * paragraph that names your bookings. Cities on your route lead and carry an
 * exposure figure; everything else is clearly filed as reference.
 */
import React, { useEffect } from 'react';
import { View } from 'react-native';

import { colors, mood, severityMood, severityWord, space } from '@/theme';
import {
  ChapterHeader,
  Divider,
  Eyebrow,
  Loading,
  MetricBar,
  Pill,
  Reveal,
  Row,
  ScreenScaffold,
  SectionHeader,
  Txt,
} from '@/components/primitives';
import { PaperCard, Stamp } from '@/components/travel/paper';
import { TravelIcon } from '@/components/travel/TravelIcon';
import { useTrip } from '@/state/store';
import type { SeasonalRisk, Severity } from '@/types/domain';

const VALUE: Record<Severity, number> = { LOW: 25, MEDIUM: 60, HIGH: 92 };

export function SeasonalSegment() {
  const signals = useTrip((s) => s.signals);
  const trip = useTrip((s) => s.overview?.trip ?? null);
  const loadSignals = useTrip((s) => s.loadSignals);

  useEffect(() => {
    if (!signals) void loadSignals();
  }, [signals, loadSignals]);

  if (!signals || !trip) return <Loading label="Reading the season" icon="cloud" />;

  const cities = new Set(
    trip.nodes.flatMap((n) => [n.location?.city, n.from?.city, n.to?.city].filter(Boolean) as string[]),
  );
  const relevant = signals.seasonal.filter((s) => cities.has(s.city));
  const reference = signals.seasonal.filter((s) => !cities.has(s.city));

  return (
    <ScreenScaffold>
      <ChapterHeader
        marker="Chapter nine · understand the world"
        title="Why is your trip at risk?"
        standfirst="Where you are going, when you are going. Each profile ends with what it means for the bookings you actually hold."
        scene="storm"
      />

      {relevant.map((profile, i) => (
        <Profile key={profile.city} profile={profile} index={i} onRoute trip={trip} />
      ))}

      {reference.length ? (
        <View style={{ marginTop: space(6) }}>
          <SectionHeader
            eyebrow="Reference"
            title="Not on your route"
            subtitle="Kept for comparison, so the seasonal model stays legible."
          />
          {reference.map((profile, i) => (
            <Profile key={profile.city} profile={profile} index={i} trip={trip} />
          ))}
        </View>
      ) : null}
    </ScreenScaffold>
  );
}

function Profile({
  profile,
  index,
  onRoute,
  trip,
}: {
  profile: SeasonalRisk;
  index: number;
  onRoute?: boolean;
  trip: NonNullable<ReturnType<typeof useTrip.getState>['overview']>['trip'];
}) {
  /* One headline reading, from the worst of the three factors. */
  const worst = [profile.floodExposure, profile.transportDisruption, profile.crowdLevel].reduce<Severity>(
    (acc, s) => (VALUE[s] > VALUE[acc] ? s : acc),
    'LOW',
  );
  const m = mood[severityMood[worst]];

  /* Which of your bookings sit in this city. */
  const here = trip.nodes.filter(
    (n) => n.location?.city === profile.city || n.to?.city === profile.city || n.from?.city === profile.city,
  );

  return (
    <Reveal index={index} style={{ marginBottom: space(4) }}>
      <PaperCard depth={onRoute ? 'lifted' : 'flat'} tinted={onRoute ? undefined : colors.haze} accent={onRoute ? m.ink : undefined} folded={onRoute}>
        <Row justify="space-between" align="flex-start">
          <View style={{ flex: 1 }}>
            <Row gap={space(2)}>
              <TravelIcon name="calendar" size={12} color={colors.inkFaint} weight={1.8} />
              <Eyebrow>{profile.month}</Eyebrow>
            </Row>
            <Txt variant="h1" style={{ marginTop: 2 }}>
              {profile.city}
            </Txt>
          </View>

          {onRoute ? (
            /* The engine blends flood and transport exposure into a figure; the
               traveller gets the word for it, not the percentage. */
            <Stamp label={severityWord[worst]} tint={m.ink} fill={m.fill} />
          ) : (
            <Stamp label="Reference" tint={colors.inkMuted} fill={colors.haze} />
          )}
        </Row>

        <Row gap={space(2.5)} style={{ marginTop: space(3) }} align="flex-start">
          <TravelIcon name="cloud" size={14} color={colors.inkMuted} weight={1.7} />
          <Txt variant="small" color={colors.inkSoft} style={{ flex: 1 }}>
            {profile.weather}
          </Txt>
        </Row>

        <View style={{ marginTop: space(4.5) }}>
          <MetricBar
            label="Flood exposure"
            value={VALUE[profile.floodExposure]}
            display={profile.floodExposure.toLowerCase()}
            tint={mood[severityMood[profile.floodExposure]].ink}
          />
          <MetricBar
            label="Transport disruption"
            value={VALUE[profile.transportDisruption]}
            display={profile.transportDisruption.toLowerCase()}
            tint={mood[severityMood[profile.transportDisruption]].ink}
          />
          <MetricBar
            label="Crowd level"
            value={VALUE[profile.crowdLevel]}
            display={profile.crowdLevel.toLowerCase()}
            tint={mood[severityMood[profile.crowdLevel]].ink}
          />
        </View>

        <Eyebrow>Activity availability</Eyebrow>
        <Txt variant="small" color={colors.inkSoft} style={{ marginTop: 4 }}>
          {profile.activityAvailability}
        </Txt>

        <Divider dashed style={{ marginVertical: space(4) }} />

        {/* the only part that really matters */}
        <Row gap={space(2)} align="flex-start">
          <TravelIcon name="arrowRight" size={13} color={onRoute ? m.ink : colors.inkFaint} weight={2} style={{ marginTop: 3 }} />
          <View style={{ flex: 1 }}>
            <Eyebrow color={onRoute ? m.ink : colors.inkFaint}>
              {onRoute ? 'What this means for your itinerary' : 'Not connected to your trip'}
            </Eyebrow>
            <Txt variant="body" style={{ marginTop: space(1.5) }}>
              {profile.tripImpact}
            </Txt>
          </View>
        </Row>

        {onRoute && here.length ? (
          <Row gap={space(2)} wrap style={{ marginTop: space(3.5) }}>
            {here.slice(0, 6).map((node) => (
              <Pill key={node.id} label={node.title} icon="pin" />
            ))}
          </Row>
        ) : null}

        {profile.recommendations.length ? (
          <View style={{ marginTop: space(4) }}>
            <Eyebrow color={colors.indigo}>What we would do</Eyebrow>
            {profile.recommendations.map((rec) => (
              <Row key={rec} gap={space(2)} align="flex-start" style={{ marginTop: space(2) }}>
                <TravelIcon name="check" size={11} color={colors.indigo} weight={2.5} style={{ marginTop: 4 }} />
                <Txt variant="small" color={colors.inkSoft} style={{ flex: 1 }}>
                  {rec}
                </Txt>
              </Row>
            ))}
          </View>
        ) : null}
      </PaperCard>
    </Reveal>
  );
}
