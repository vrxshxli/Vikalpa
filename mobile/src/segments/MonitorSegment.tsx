/**
 * SCREEN 5 — Live monitor.
 *
 * The rule this screen exists to enforce: never state a world fact without
 * saying what it does to *this* itinerary. Signals that touch a booking lead
 * and name it; signals that touch nothing are filed at the back and say so.
 */
import React, { useCallback, useState } from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { colors, fonts, mood, radius, severityMood, space, useReducedMotion } from '@/theme';
import {
  Button,
  ChapterHeader,
  Divider,
  Eyebrow,
  Loading,
  Pill,
  Reveal,
  RiskBadge,
  Row,
  ScreenScaffold,
  SectionHeader,
  Txt,
} from '@/components/primitives';
import { PaperCard, Stamp, TapeStrip } from '@/components/travel/paper';
import { NodeSheet } from '@/components/travel/NodeSheet';
import { TravelIcon, signalIcon } from '@/components/travel/TravelIcon';
import { RouteConnector } from '@/components/travel/JourneyRibbon';
import { clock, statusLabel } from '@/utils/format';
import { useTrip } from '@/state/store';
import type { RiskSignal, TripNode } from '@/types/domain';

function LiveMark() {
  const reduced = useReducedMotion();
  const pulse = useSharedValue(0);

  React.useEffect(() => {
    if (reduced) return;
    pulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1150, easing: Easing.out(Easing.quad) }),
        withTiming(0, { duration: 1150, easing: Easing.in(Easing.quad) }),
      ),
      -1,
      false,
    );
  }, [pulse, reduced]);

  const style = useAnimatedStyle(() => ({ opacity: 0.35 + pulse.value * 0.65 }));

  return (
    <Row gap={6}>
      <Animated.View style={[styles.liveDot, style]} />
      <Eyebrow color={colors.inkMuted}>Watching</Eyebrow>
    </Row>
  );
}

export function MonitorSegment({ onReport, onTraced }: { onReport: () => void; onTraced?: () => void }) {
  const signals = useTrip((s) => s.signals);
  const trip = useTrip((s) => s.overview?.trip ?? null);
  const loadSignals = useTrip((s) => s.loadSignals);
  const triggerDisruption = useTrip((s) => s.triggerDisruption);
  const phase = useTrip((s) => s.phase);
  const loading = useTrip((s) => s.loading);

  const [sheetNode, setSheetNode] = useState<TripNode | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await loadSignals();
    setRefreshing(false);
  }, [loadSignals]);

  if (!signals || !trip) return <Loading label="Reading the world" icon="signal" />;

  const connected = signals.signals.filter((s) => s.relatedNodeIds.length > 0);
  const background = signals.signals.filter((s) => s.relatedNodeIds.length === 0);
  const nodeFor = (id: string) => trip.nodes.find((n) => n.id === id) ?? null;
  const pending = signals.pending;

  return (
    <>
      <ScreenScaffold
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.indigo} />}
      >
        <ChapterHeader
          marker="Chapter two · live monitor"
          title="What the world is doing to your trip"
          standfirst={`${connected.length} of ${signals.signals.length} live signals touch a booking you hold.`}
          right={<LiveMark />}
        />

        {/* the one signal that needs a decision */}
        {pending && phase === 'MONITORING' ? (
          <Reveal>
            <View style={{ marginBottom: space(6) }}>
              <PaperCard accent={colors.coralInk} tinted={colors.coralSoft} depth="held">
                <TapeStrip width={70} rotate={-14} tint={colors.peachSoft} style={{ top: -9, left: 20 }} />
                <Row justify="space-between" align="flex-start">
                  <Pill label="Needs you" fg={colors.coralInk} bg={colors.white} dot icon="warning" />
                  <Txt variant="meta" color={colors.inkMuted}>
                    {statusLabel(pending.type)} · {clock(pending.detectedAt)}
                  </Txt>
                </Row>
                <Txt variant="h2" style={{ marginTop: space(3) }}>
                  {pending.headline}
                </Txt>
                <Txt variant="small" color={colors.inkSoft} style={{ marginTop: space(2) }}>
                  {pending.detail}
                </Txt>
                <Button
                  label="See what this affects"
                  icon="route"
                  onPress={() => void triggerDisruption(pending).then(() => onTraced?.())}
                  loading={loading.disruption}
                  size="large"
                  style={{ marginTop: space(4) }}
                />
              </PaperCard>
            </View>
          </Reveal>
        ) : null}

        {connected.map((signal, i) => (
          <SignalCard key={signal.id} signal={signal} index={i} nodeFor={nodeFor} onOpenNode={setSheetNode} />
        ))}

        {background.length ? (
          <View style={{ marginTop: space(6) }}>
            <SectionHeader
              eyebrow="Filed at the back"
              title="Watched, not connected"
              subtitle="Inside your monitored region and worth knowing, with no path to your itinerary."
            />
            {background.map((signal, i) => (
              <Reveal key={signal.id} index={i} style={{ marginBottom: space(2.5) }}>
                <PaperCard depth="flat" tinted={colors.haze}>
                  <Row justify="space-between" align="flex-start">
                    <Row gap={space(2.5)} style={{ flex: 1, paddingRight: space(2) }} align="flex-start">
                      <TravelIcon name={signalIcon[signal.kind] ?? 'signal'} size={14} color={colors.inkFaint} weight={1.7} />
                      <View style={{ flex: 1 }}>
                        <Txt variant="small" style={{ fontFamily: fonts.bold }} numberOfLines={2}>
                          {signal.headline}
                        </Txt>
                        <Txt variant="meta" color={colors.inkMuted} style={{ marginTop: 3 }}>
                          {signal.place.city} · {signal.tripImpact}
                        </Txt>
                      </View>
                    </Row>
                    <RiskBadge severity={signal.severity} />
                  </Row>
                </PaperCard>
              </Reveal>
            ))}
          </View>
        ) : null}

        <PaperCard depth="flat" tinted={colors.haze} style={{ marginTop: space(6) }}>
          <Row gap={space(2.5)} align="flex-start">
            <TravelIcon name="warning" size={16} color={colors.amberInk} weight={1.7} />
            <View style={{ flex: 1 }}>
              <Eyebrow>Something we missed?</Eyebrow>
              <Txt variant="small" color={colors.inkMuted} style={{ marginTop: 4, marginBottom: space(3.5) }}>
                Feeds are never complete. If something has changed and we have not seen it, tell us — the cascade runs
                exactly the same way.
              </Txt>
              <Button label="Report it yourself" variant="secondary" icon="ticket" onPress={onReport} />
            </View>
          </Row>
        </PaperCard>
      </ScreenScaffold>

      <NodeSheet node={sheetNode} onClose={() => setSheetNode(null)} />
    </>
  );
}

/** A world signal, wired to the bookings it touches. */
function SignalCard({
  signal,
  index,
  nodeFor,
  onOpenNode,
}: {
  signal: RiskSignal;
  index: number;
  nodeFor: (id: string) => TripNode | null;
  onOpenNode: (node: TripNode) => void;
}) {
  const m = mood[severityMood[signal.severity]];

  return (
    <Reveal index={index} style={{ marginBottom: space(3) }}>
      <PaperCard accent={m.ink} tiltIndex={index}>
        <Row justify="space-between" align="flex-start">
          <Row gap={space(3)} style={{ flex: 1 }} align="flex-start">
            <View style={[styles.glyph, { backgroundColor: m.fill }]}>
              <TravelIcon name={signalIcon[signal.kind] ?? 'signal'} size={17} color={m.ink} weight={1.7} />
            </View>
            <View style={{ flex: 1 }}>
              <Row gap={space(2)}>
                <Eyebrow>{signal.kind.toLowerCase()}</Eyebrow>
                {signal.live ? <Pill label="Live" fg={colors.indigo} bg={colors.periSoft} dot /> : null}
              </Row>
              <Txt variant="h3" style={{ marginTop: 4 }}>
                {signal.headline}
              </Txt>
              <Row gap={5} style={{ marginTop: 3 }}>
                <TravelIcon name="pin" size={10} color={colors.inkFaint} weight={1.9} />
                <Txt variant="meta" color={colors.inkMuted}>
                  {signal.place.name} · {Math.round(signal.confidence * 100)}% confidence
                </Txt>
              </Row>
            </View>
          </Row>
          <RiskBadge severity={signal.severity} />
        </Row>

        <Txt variant="small" color={colors.inkSoft} style={{ marginTop: space(3.5) }}>
          {signal.body}
        </Txt>

        <Divider dashed style={{ marginVertical: space(3.5) }} />

        {/* the part that matters: what it does to this trip */}
        <Row gap={space(2)} align="flex-start">
          <TravelIcon name="arrowRight" size={13} color={m.ink} weight={2} style={{ marginTop: 3 }} />
          <View style={{ flex: 1 }}>
            <Eyebrow color={m.ink}>Impact on your trip</Eyebrow>
            <Txt variant="body" style={{ marginTop: space(1.5) }}>
              {signal.tripImpact}
            </Txt>
          </View>
        </Row>

        {/* wired to the actual bookings */}
        <View style={{ marginTop: space(3.5) }}>
          {signal.relatedNodeIds.map((id) => {
            const node = nodeFor(id);
            if (!node) return null;
            return (
              <Row key={id} gap={space(2)} style={{ marginTop: space(1.5) }}>
                <RouteConnector orientation="horizontal" length={18} tint={m.ink} dashed />
                <PaperCard
                  depth="flat"
                  tinted={colors.haze}
                  style={styles.wired}
                  onPress={() => onOpenNode(node)}
                  accessibilityLabel={`Open ${node.title}`}
                >
                  <Row gap={space(2)} justify="space-between">
                    <Txt variant="meta" color={colors.inkSoft} numberOfLines={1} style={{ flex: 1, fontFamily: fonts.bold }}>
                      {node.title}
                    </Txt>
                    <Stamp label={statusLabel(node.status)} tint={m.ink} rotate={0} />
                  </Row>
                </PaperCard>
              </Row>
            );
          })}
        </View>
      </PaperCard>
    </Reveal>
  );
}

const styles = StyleSheet.create({
  glyph: { width: 36, height: 36, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.indigo },
  wired: { flex: 1, paddingVertical: space(2), paddingHorizontal: space(2.5) },
});
