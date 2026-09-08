/**
 * SCREEN 17 — What changed?
 *
 * A chronological feed of the trip's own edits, close to the itinerary rather
 * than buried in settings. Each entry expands into the causal chain, which is
 * the explainability layer in its most compact form:
 *
 *   Flight delay → arrival shifted → transfer missed → activity affected
 */
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { colors, fonts, motion, space, type } from '@/theme';
import {
  ChapterHeader,
  Empty,
  Eyebrow,
  Reveal,
  Row,
  ScreenScaffold,
  Txt,
} from '@/components/primitives';
import { PaperCard } from '@/components/travel/paper';
import { TravelIcon, type IconName } from '@/components/travel/TravelIcon';
import { useTrip } from '@/state/store';
import type { HistoryKind } from '@/types/domain';

const TONE: Record<HistoryKind, { tint: string; icon: IconName }> = {
  IMPORT: { tint: colors.inkMuted, icon: 'luggage' },
  RISK: { tint: colors.amberInk, icon: 'binoculars' },
  DETECTION: { tint: colors.coralInk, icon: 'warning' },
  CASCADE: { tint: colors.coralInk, icon: 'route' },
  GENERATION: { tint: colors.indigo, icon: 'compass' },
  RECOMMENDATION: { tint: colors.indigo, icon: 'spark' },
  SELECTION: { tint: colors.indigo, icon: 'check' },
  REBUILD: { tint: colors.indigo, icon: 'recovery' },
  PREFERENCE: { tint: colors.lilac, icon: 'passport' },
  SIMULATION: { tint: colors.sky, icon: 'spark' },
};

export function ChangedSegment() {
  const history = useTrip((s) => s.history);
  const [open, setOpen] = useState<string | null>(null);

  if (!history.length) {
    return (
      <ScreenScaffold>
        <Empty
          title="Nothing has changed"
          body="Your itinerary is exactly as you imported it."
          icon="sun"
        />
      </ScreenScaffold>
    );
  }

  return (
    <ScreenScaffold scene="storm">
      <ChapterHeader
        marker="Chapter seven · understand change"
        title="What changed?"
        standfirst="In order, most recent first. Tap any entry to follow the reasoning down the chain."
        scene="storm"
      />

      <View>
        {history.map((event, i) => {
          const tone = TONE[event.kind] ?? { tint: colors.inkMuted, icon: 'stamp' as IconName };
          const expanded = open === event.id;
          const at = new Date(event.at);

          return (
            <Reveal key={event.id} index={i}>
              <Pressable
                onPress={() => setOpen(expanded ? null : event.id)}
                accessibilityRole="button"
                accessibilityState={{ expanded }}
                accessibilityLabel={`${at.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}. ${event.title}`}
              >
                <Row gap={space(2.5)} align="flex-start">
                  {/* the printed time */}
                  <Text style={[type.code, styles.time]}>
                    {at.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </Text>

                  {/* the thread */}
                  <View style={styles.rail}>
                    <View style={[styles.dot, { borderColor: tone.tint, backgroundColor: i === 0 ? tone.tint : colors.mist }]} />
                    {i < history.length - 1 ? <View style={styles.line} /> : null}
                  </View>

                  <View style={{ flex: 1, paddingBottom: space(5) }}>
                    <Row gap={7} align="flex-start">
                      <TravelIcon name={tone.icon} size={13} color={tone.tint} weight={1.8} style={{ marginTop: 2 }} />
                      <Txt variant="h3" style={{ flex: 1, fontSize: 15 }}>
                        {event.title}
                      </Txt>
                    </Row>
                    <Txt variant="meta" color={colors.inkMuted} style={{ marginTop: 4 }}>
                      {event.detail}
                    </Txt>

                    {expanded && event.chain.length ? (
                      <Animated.View entering={FadeIn.duration(motion.quick)}>
                        <PaperCard depth="flat" tinted={colors.haze} style={{ marginTop: space(3) }}>
                          <Eyebrow>Why</Eyebrow>
                          {event.chain.map((line, j) => (
                            <Row key={`${line}-${j}`} gap={space(2)} align="flex-start" style={{ marginTop: 7 }}>
                              <TravelIcon
                                name={j === 0 ? 'warning' : 'arrowDown'}
                                size={11}
                                color={j === 0 ? tone.tint : colors.inkFaint}
                                weight={2}
                              />
                              <Txt variant="small" color={colors.inkSoft} style={{ flex: 1 }}>
                                {line}
                              </Txt>
                            </Row>
                          ))}
                        </PaperCard>
                      </Animated.View>
                    ) : event.chain.length ? (
                      <Row gap={5} style={{ marginTop: 6 }}>
                        <Txt variant="meta" color={colors.indigo} style={{ fontFamily: fonts.bold }}>
                          Why?
                        </Txt>
                        <TravelIcon name="chevron" size={10} color={colors.indigo} weight={2.2} />
                      </Row>
                    ) : null}
                  </View>
                </Row>
              </Pressable>
            </Reveal>
          );
        })}
      </View>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  time: { width: 42, color: colors.inkMuted, marginTop: 2 },
  rail: { width: 14, alignItems: 'center', alignSelf: 'stretch' },
  dot: { width: 11, height: 11, borderRadius: 6, borderWidth: 2, marginTop: 3 },
  line: { flex: 1, width: 1.5, backgroundColor: colors.rule, marginTop: 3, borderRadius: 1 },
});
