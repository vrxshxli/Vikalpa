/**
 * SCREEN 3 — Trip risk. "Before you go."
 *
 * A check-up on the itinerary, told in plain language. Each weak point is
 * stated as a consequence rather than a category, and carries what we would do
 * about it.
 *
 * No arithmetic reaches this screen: no readiness score, no resilience points,
 * no severity numbers. The engine still ranks these by severity and by how
 * much each fix would buy back — that ordering is what you read top to bottom —
 * but the numbers stay in the engine, because they invite arguing with the
 * model instead of fixing the trip.
 */
import React, { useState } from 'react';
import { View } from 'react-native';

import { colors, mood, radius, severityMood, space, touch } from '@/theme';
import {
  ChapterHeader,
  Divider,
  Empty,
  Eyebrow,
  Expandable,
  Loading,
  Pill,
  Reveal,
  RiskBadge,
  Row,
  ScreenScaffold,
  Txt,
} from '@/components/primitives';
import { PaperCard } from '@/components/travel/paper';
import { TravelIcon, riskIcon } from '@/components/travel/TravelIcon';
import { useTrip } from '@/state/store';

export function RiskSegment() {
  const risks = useTrip((s) => s.risks);
  const trip = useTrip((s) => s.overview?.trip ?? null);
  const [open, setOpen] = useState<string | null>(null);

  if (!risks || !trip) return <Loading label="Looking over your trip" icon="binoculars" />;

  const { risks: list, highCount } = risks;
  const nameOf = (id: string) => trip.nodes.find((n) => n.id === id)?.title ?? id;

  return (
    <ScreenScaffold>
      <ChapterHeader
        marker="Chapter two · before you go"
        title={list.length === 0 ? 'Nothing to flag.' : 'A few things worth a look.'}
        standfirst={
          list.length === 0
            ? 'Every handover has room in it, and every experience has a fallback. Rest easy.'
            : highCount
              ? `${highCount} of these could cost you an experience rather than an hour. They are ordered by what we would fix first.`
              : 'Nothing serious here. Your itinerary can absorb a moderate delay.'
        }
        scene="mountain"
      />

      {list.length === 0 ? (
        <Empty
          title="A well-built itinerary"
          body="Every handover has room in it and every experience has a fallback."
          icon="sun"
          scene="dawn"
        />
      ) : null}

      {list.map((risk, i) => {
        const m = mood[severityMood[risk.severity]];
        const expanded = open === risk.id;

        return (
          <Reveal key={risk.id} index={i} style={{ marginBottom: space(3.5) }}>
            <PaperCard depth="lifted" accent={m.ink}>
              {/* what it is */}
              <Row gap={space(3)} align="flex-start">
                <View style={[styles_icon, { backgroundColor: m.fill }]}>
                  <TravelIcon name={riskIcon[risk.kind] ?? 'warning'} size={18} color={m.ink} weight={1.8} />
                </View>
                <View style={{ flex: 1 }}>
                  <Txt variant="h3">{risk.title}</Txt>
                  <RiskBadge severity={risk.severity} style={{ marginTop: space(2) }} />
                </View>
              </Row>

              {/* one calm sentence */}
              <Txt variant="body" color={colors.inkSoft} style={{ marginTop: space(3.5) }}>
                {risk.whyItMatters}
              </Txt>

              {/* what we would do */}
              <View style={styles_action}>
                <TravelIcon name="recovery" size={16} color={colors.indigo} weight={1.9} />
                <View style={{ flex: 1 }}>
                  <Eyebrow color={colors.indigo}>What we would do</Eyebrow>
                  <Txt variant="small" style={{ marginTop: 3 }}>
                    {risk.recommendedAction}
                  </Txt>
                </View>
              </View>

              {/* the specifics, only if asked for */}
              <Expandable
                open={expanded}
                onToggle={() => setOpen(expanded ? null : risk.id)}
                accessibilityLabel={`${risk.title}. ${expanded ? 'Hide' : 'Show'} the specifics`}
                header={
                  <Row gap={6} style={{ marginTop: space(2), minHeight: touch.min }}>
                    <Txt variant="meta" color={colors.indigo}>
                      {expanded ? 'Hide the specifics' : 'Show me the specifics'}
                    </Txt>
                    <TravelIcon
                      name="chevron"
                      size={11}
                      color={colors.indigo}
                      weight={2.2}
                      style={{ transform: [{ rotate: expanded ? '90deg' : '0deg' }] }}
                    />
                  </Row>
                }
              >
                <View>
                  <Divider dashed style={{ marginBottom: space(3.5) }} />
                  <Txt variant="small" color={colors.inkSoft}>
                    {risk.detail}
                  </Txt>
                  {risk.nodeIds.length ? (
                    <View style={{ marginTop: space(4) }}>
                      <Eyebrow>Bookings involved</Eyebrow>
                      <Row gap={space(2)} wrap style={{ marginTop: space(2) }}>
                        {risk.nodeIds.map((id) => (
                          <Pill key={id} label={nameOf(id)} icon="pin" />
                        ))}
                      </Row>
                    </View>
                  ) : null}
                </View>
              </Expandable>
            </PaperCard>
          </Reveal>
        );
      })}
    </ScreenScaffold>
  );
}

const styles_icon = {
  width: 40,
  height: 40,
  borderRadius: radius.md,
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
};

const styles_action = {
  flexDirection: 'row' as const,
  alignItems: 'flex-start' as const,
  gap: space(2.5),
  marginTop: space(4),
  padding: space(3),
  borderRadius: radius.md,
  backgroundColor: colors.periSoft,
};
