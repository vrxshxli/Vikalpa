/**
 * SCREEN 12 — Resilience history, as a travel diary.
 *
 * Not an event table. Each entry is a dated page with a stamp for what kind of
 * thing happened, and expands into the reasoning the engine recorded at the
 * time — so a decision can be re-read months later.
 */
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { colors, fonts, motion, radius, space, type } from '@/theme';
import {
  Button,
  ChapterHeader,
  Empty,
  Eyebrow,
  Loading,
  Reveal,
  Row,
  ScreenScaffold,
  Txt,
} from '@/components/primitives';
import { LuggageTag, PaperCard, Stamp } from '@/components/travel/paper';
import { TravelIcon, type IconName } from '@/components/travel/TravelIcon';
import { useTrip } from '@/state/store';
import type { HistoryKind } from '@/types/domain';

const KIND: Record<HistoryKind, { label: string; tint: string; icon: IconName }> = {
  IMPORT: { label: 'Imported', tint: colors.inkMuted, icon: 'luggage' },
  RISK: { label: 'Checked', tint: colors.amberInk, icon: 'binoculars' },
  DETECTION: { label: 'Detected', tint: colors.coralInk, icon: 'warning' },
  CASCADE: { label: 'Traced', tint: colors.coralInk, icon: 'route' },
  GENERATION: { label: 'Searched', tint: colors.indigo, icon: 'compass' },
  RECOMMENDATION: { label: 'Ranked', tint: colors.indigo, icon: 'spark' },
  SELECTION: { label: 'Accepted', tint: colors.indigo, icon: 'check' },
  REBUILD: { label: 'Rebuilt', tint: colors.indigo, icon: 'recovery' },
  PREFERENCE: { label: 'Preferences', tint: colors.lilac, icon: 'passport' },
  SIMULATION: { label: 'Simulated', tint: colors.sky, icon: 'spark' },
};

export function HistorySegment() {
  const history = useTrip((s) => s.history);
  const loadHistory = useTrip((s) => s.loadHistory);
  const resetTrip = useTrip((s) => s.resetTrip);
  const loading = useTrip((s) => s.loading);
  const [open, setOpen] = useState<string | null>(null);

  if (loading.bootstrap && !history.length) return <Loading label="Opening the diary" icon="passport" />;

  if (!history.length) {
    return (
      <ScreenScaffold>
        <Empty
          title="Nothing written yet"
          body="Every detection, cascade and decision gets a dated page here."
          icon="passport"
        />
      </ScreenScaffold>
    );
  }

  return (
    <ScreenScaffold>
      <ChapterHeader
        marker="Chapter five · keep moving"
        title="Travel journal"
        standfirst="Everything the engine did, and why. Tap a page to read the reasoning it recorded at the time."
        scene="dusk"
      />

      {history.map((event, i) => {
        const meta = KIND[event.kind] ?? { label: event.kind, tint: colors.inkMuted, icon: 'stamp' as IconName };
        const at = new Date(event.at);
        const expanded = open === event.id;

        return (
          <Reveal key={event.id} index={i} style={{ marginBottom: space(3) }}>
            <Pressable
              onPress={() => setOpen(expanded ? null : event.id)}
              accessibilityRole="button"
              accessibilityState={{ expanded }}
              accessibilityLabel={`${event.title}. ${meta.label}. ${event.chain.length} details`}
            >
              <PaperCard depth="lifted" tiltIndex={i} accent={meta.tint}>
                <Row justify="space-between" align="flex-start">
                  {/* the date, as a tag */}
                  <LuggageTag edge={meta.tint}>
                    <Text style={[type.stamp, { color: meta.tint }]}>
                      {at.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                    <Text style={[type.meta, { color: colors.inkFaint, fontSize: 9.5 }]}>
                      {at.toLocaleDateString([], { day: 'numeric', month: 'short' })}
                    </Text>
                  </LuggageTag>

                  <Stamp
                    label={meta.label}
                    tint={meta.tint}
                    rotate={i % 2 === 0 ? -8 : 7}
                    icon={<TravelIcon name={meta.icon} size={10} color={meta.tint} weight={2.2} />}
                  />
                </Row>

                <Txt variant="h3" style={{ marginTop: space(3.5), fontSize: 16 }}>
                  {event.title}
                </Txt>
                <Txt variant="small" color={colors.inkMuted} style={{ marginTop: 5 }}>
                  {event.detail}
                </Txt>

                {expanded && event.chain.length ? (
                  <Animated.View entering={FadeIn.duration(motion.quick)} style={styles.chain}>
                    <Eyebrow>Recorded reasoning</Eyebrow>
                    {event.chain.map((line, j) => (
                      <Row key={`${line}-${j}`} gap={space(2)} align="flex-start" style={{ marginTop: 7 }}>
                        <TravelIcon name="arrowRight" size={10} color={colors.inkFaint} weight={2} style={{ marginTop: 4 }} />
                        <Txt variant="small" color={colors.inkSoft} style={{ flex: 1 }}>
                          {line}
                        </Txt>
                      </Row>
                    ))}
                  </Animated.View>
                ) : event.chain.length ? (
                  <Row gap={5} style={{ marginTop: space(2.5) }}>
                    <Txt variant="meta" color={colors.indigo} style={{ fontFamily: fonts.bold }}>
                      {event.chain.length} detail{event.chain.length === 1 ? '' : 's'}
                    </Txt>
                    <TravelIcon name="chevron" size={11} color={colors.indigo} weight={2.2} />
                  </Row>
                ) : null}
              </PaperCard>
            </Pressable>
          </Reveal>
        );
      })}

      <PaperCard depth="flat" tinted={colors.haze} style={{ marginTop: space(4) }}>
        <Row gap={space(2.5)} align="flex-start">
          <TravelIcon name="recovery" size={15} color={colors.inkMuted} weight={1.7} />
          <View style={{ flex: 1 }}>
            <Eyebrow>Start over</Eyebrow>
            <Txt variant="small" color={colors.inkMuted} style={{ marginTop: 4, marginBottom: space(3.5) }}>
              Reset puts the journey back to the moment it was imported — healthy, un-disrupted, diary cleared.
            </Txt>
            <Row gap={space(2.5)}>
              <Button label="Refresh" variant="secondary" icon="recovery" onPress={() => void loadHistory()} style={{ flex: 1 }} />
              <Button label="Reset trip" variant="secondary" loading={loading.reset} onPress={() => void resetTrip()} style={{ flex: 1 }} />
            </Row>
          </View>
        </Row>
      </PaperCard>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  chain: {
    marginTop: space(3.5),
    padding: space(3.5),
    borderRadius: radius.md,
    backgroundColor: colors.haze,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.rule,
  },
});
