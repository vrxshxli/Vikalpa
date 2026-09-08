/**
 * SCREEN 4 — Trip home. Opening the traveller's journal.
 *
 * The pop-up itinerary is the centrepiece; everything above it is one glance:
 * what is next, how the trip is holding up, and the single alert that needs a
 * decision. No dashboard grid — the itinerary is the interface.
 */
import React, { useCallback, useState } from 'react';
import { RefreshControl, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { colors, motion, radius, space, statusStyle, type } from '@/theme';
import {
  Button,
  Eyebrow,
  Loading,
  Pill,
  Reveal,
  Row,
  ScreenScaffold,
  SectionHeader,
  StatTile,
  Txt,
} from '@/components/primitives';
import { LuggageTag, PaperCard, Stamp, TapeStrip } from '@/components/travel/paper';
import { ItineraryCanvas } from '@/components/travel/ItineraryCanvas';
import { NodeSheet } from '@/components/travel/NodeSheet';
import { TravelIcon, kindIcon } from '@/components/travel/TravelIcon';
import { clock, durationLabel, inr, minutesBetween, pluralise, shortDate } from '@/utils/format';
import { useTrip } from '@/state/store';
import type { TripNode } from '@/types/domain';

export function JourneySegment({
  onOpenRecovery,
  onOpenChanges,
  onOpenResilience,
  onInspectNode,
}: {
  onOpenRecovery: () => void;
  onOpenChanges: () => void;
  onOpenResilience: () => void;
  onInspectNode: (nodeId: string) => void;
}) {
  const overview = useTrip((s) => s.overview);
  const risks = useTrip((s) => s.risks);
  const signals = useTrip((s) => s.signals);
  const appliedPlan = useTrip((s) => s.appliedPlan);
  const phase = useTrip((s) => s.phase);
  const bootstrap = useTrip((s) => s.bootstrap);
  const triggerDisruption = useTrip((s) => s.triggerDisruption);
  const loading = useTrip((s) => s.loading);

  const [selected, setSelected] = useState<TripNode | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await bootstrap();
    setRefreshing(false);
  }, [bootstrap]);

  if (!overview) return <Loading label="Opening your journal" icon="luggage" />;

  const { trip } = overview;
  const pending = signals?.pending ?? null;
  const showPending = pending && phase === 'MONITORING';

  const changedIds = new Set(
    (appliedPlan?.changes ?? [])
      .filter((c) => c.changeType === 'MOVED' || c.changeType === 'REPLACED')
      .map((c) => c.nodeId),
  );

  const experiences = trip.nodes.filter((n) => n.kind === 'ACTIVITY');
  const broken = trip.nodes.filter((n) => ['MISSED', 'CANCELLED', 'DISRUPTED'].includes(n.status));

  /* What is next: the earliest booking that has not been completed. */
  const ordered = [...trip.nodes].sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
  const next = ordered.find((n) => n.status !== 'COMPLETED') ?? ordered[0];
  const nextTransport = ordered.find((n) => ['FLIGHT', 'TRAIN', 'BUS'].includes(n.kind) && n.status !== 'COMPLETED');

  return (
    <>
      <ScreenScaffold
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.indigo} />}
      >
        {/* ---------- the alert that needs a decision ---------- */}
        {showPending ? (
          <Animated.View entering={FadeInDown.duration(motion.settle)}>
            <PaperCard depth="held" accent={colors.coralInk} tinted={colors.coralSoft} style={{ marginBottom: space(5) }}>
              <TapeStrip width={72} rotate={-14} tint={colors.peachSoft} style={{ top: -9, left: 22 }} />
              <Row justify="space-between" align="flex-start">
                <Pill label="Just detected" fg={colors.coralInk} bg={colors.white} dot icon="warning" />
                <Txt variant="meta" color={colors.inkMuted}>
                  {clock(pending.detectedAt)}
                </Txt>
              </Row>
              <Txt variant="h2" accessibilityRole="header" style={{ marginTop: space(3) }}>
                {pending.headline}
              </Txt>
              <Txt variant="small" color={colors.inkSoft} style={{ marginTop: space(2) }}>
                {pending.detail}
              </Txt>
              <Button
                label="See what this affects"
                icon="route"
                size="large"
                loading={loading.disruption}
                onPress={() => void triggerDisruption(pending).then(onOpenRecovery)}
                style={{ marginTop: space(4) }}
              />
            </PaperCard>
          </Animated.View>
        ) : null}

        {/* ---------- recovered ---------- */}
        {phase === 'RECOVERED' && appliedPlan ? (
          <Animated.View entering={FadeInDown.duration(motion.settle)}>
            <PaperCard depth="held" accent={colors.indigo} tinted={colors.periSoft} folded style={{ marginBottom: space(5) }}>
              <Row justify="space-between" align="flex-start">
                <Pill label="Back on track" fg={colors.indigo} bg={colors.white} dot icon="shield" />
                <Stamp label="Recovered" tint={colors.indigo} fill={colors.white} rotate={8} />
              </Row>
              <Txt variant="h2" style={{ marginTop: space(3) }}>
                {appliedPlan.metrics.experiencesPreserved} of {appliedPlan.metrics.experiencesTotal} experiences saved
              </Txt>
              <Txt variant="small" color={colors.inkSoft} style={{ marginTop: space(2) }}>
                {appliedPlan.explanation}
              </Txt>
            </PaperCard>
          </Animated.View>
        ) : null}

        {/* ---------- what's next ---------- */}
        {next ? (
          <Reveal index={0}>
            <PaperCard depth="lifted" style={{ marginBottom: space(4) }}>
              <Row justify="space-between" align="flex-start">
                <View style={{ flex: 1, paddingRight: space(3) }}>
                  <Eyebrow color={colors.indigo}>Up next</Eyebrow>
                  <Row gap={space(2.5)} style={{ marginTop: space(2.5) }} align="flex-start">
                    <View style={styles.nextIcon}>
                      <TravelIcon
                        name={kindIcon[next.kind] ?? 'pin'}
                        size={19}
                        color={statusStyle(next.status).ink}
                        weight={1.7}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Txt variant="h3" numberOfLines={1}>
                        {next.title}
                      </Txt>
                      <Txt variant="meta" color={colors.inkMuted} style={{ marginTop: 2 }}>
                        {shortDate(next.start)} · {clock(next.start)} ·{' '}
                        {next.kind === 'HOTEL' ? 'check-in' : durationLabel(minutesBetween(next.start, next.end))}
                      </Txt>
                    </View>
                  </Row>
                </View>
                <LuggageTag edge={statusStyle(next.status).ink}>
                  <Text style={[type.clock, { color: colors.ink, fontSize: 17 }]}>{clock(next.start)}</Text>
                </LuggageTag>
              </Row>

              {nextTransport && nextTransport.id !== next.id ? (
                <>
                  <View style={styles.hairline} />
                  <Row gap={space(2)} align="center">
                    <TravelIcon name={kindIcon[nextTransport.kind] ?? 'plane'} size={12} color={colors.inkFaint} weight={1.8} />
                    <Txt variant="meta" color={colors.inkMuted} style={{ flex: 1 }} numberOfLines={1}>
                      Then {nextTransport.title} · {shortDate(nextTransport.start)} {clock(nextTransport.start)}
                    </Txt>
                  </Row>
                </>
              ) : null}
            </PaperCard>
          </Reveal>
        ) : null}

        {/* ---------- at a glance ---------- */}
        <Reveal index={1}>
          <Row gap={space(2)}>
            <StatTile
              label="Experiences"
              value={`${experiences.filter((n) => n.status === 'SAFE').length}/${experiences.length}`}
              hint="still on"
              tint={colors.indigo}
              icon="heart"
            />
            <StatTile
              label={broken.length ? 'Broken' : 'Risk points'}
              value={broken.length ? String(broken.length) : String(risks?.highCount ?? 0)}
              hint={broken.length ? 'bookings' : 'serious'}
              tint={broken.length ? colors.coralInk : colors.amberInk}
              icon={broken.length ? 'warning' : 'binoculars'}
            />
            <StatTile label="Trip value" value={inr(trip.totalCost)} hint={pluralise(trip.nodes.length, 'booking')} icon="ticket" />
          </Row>
        </Reveal>

        {/* ---------- quick ways in ---------- */}
        <Reveal index={2}>
          <Row gap={space(2.5)} style={{ marginTop: space(4) }}>
            <Button label="What changed?" variant="secondary" icon="clock" onPress={onOpenChanges} style={{ flex: 1 }} />
            <Button
              label="How steady?"
              variant="secondary"
              icon="shield"
              onPress={onOpenResilience}
              style={{ flex: 1 }}
            />
          </Row>
        </Reveal>

        {/* ---------- the itinerary itself ---------- */}
        <View style={{ marginTop: space(9) }}>
          <SectionHeader
            eyebrow="Your journey"
            title={`${trip.origin.city} → ${trip.destination.city}`}
            subtitle="Tap a booking to open it. Press and hold to see it in the model."
            right={
              <LuggageTag>
                <Text style={[type.stamp, { color: colors.inkMuted }]}>{pluralise(trip.nodes.length, 'stop').toUpperCase()}</Text>
              </LuggageTag>
            }
          />
          <ItineraryCanvas
            nodes={trip.nodes}
            onSelect={setSelected}
            onInspect={(node) => onInspectNode(node.id)}
            changedIds={changedIds}
          />
        </View>

        {/* ---------- what the world is doing ---------- */}
        {signals?.signals.length ? (
          <Reveal index={3}>
            <PaperCard depth="flat" tinted={colors.haze} onPress={onOpenChanges} accessibilityLabel="Open the live monitor">
              <Row justify="space-between">
                <Row gap={space(2.5)} style={{ flex: 1 }} align="flex-start">
                  <TravelIcon name="signal" size={15} color={colors.indigo} weight={1.7} />
                  <View style={{ flex: 1 }}>
                    <Eyebrow>World signals</Eyebrow>
                    <Txt variant="small" style={{ marginTop: 4 }}>
                      {signals.connected} of {signals.signals.length} live signals touch your itinerary
                    </Txt>
                  </View>
                </Row>
                <TravelIcon name="chevron" size={15} color={colors.inkFaint} weight={2} />
              </Row>
            </PaperCard>
          </Reveal>
        ) : null}
      </ScreenScaffold>

      <NodeSheet node={selected} onClose={() => setSelected(null)} />
    </>
  );
}

const styles = StyleSheet.create({
  nextIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    backgroundColor: colors.haze,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hairline: {
    height: StyleSheet.hairlineWidth * 2,
    backgroundColor: colors.rule,
    marginVertical: space(3.5),
  },
});
