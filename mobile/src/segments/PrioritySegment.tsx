/**
 * SCREEN 15 — Activity priority. "What matters most?"
 *
 * Three physical zones on the page, and experiences are admission tickets you
 * drag between them. The paper lifts under your finger and drops into the band
 * you release it over.
 *
 * Not decoration: MUST DO is a hard constraint (a plan dropping one is thrown
 * out), IMPORTANT is a scored penalty, OPTIONAL is fair game.
 */
import React, { useMemo, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  LinearTransition,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { colors, motion, radius, space, type } from '@/theme';
import {
  ChapterHeader,
  Eyebrow,
  Loading,
  Pill,
  Row,
  ScreenScaffold,
  StickyCTA,
  Txt,
} from '@/components/primitives';
import { PaperCard, Perforation } from '@/components/travel/paper';
import { TravelIcon, type IconName } from '@/components/travel/TravelIcon';
import { clock, inr, shortDate } from '@/utils/format';
import * as haptic from '@/utils/haptics';
import { useTrip } from '@/state/store';
import type { Priority, TripNode } from '@/types/domain';

const BANDS: { key: Priority; label: string; blurb: string; tint: string; fill: string; icon: IconName }[] = [
  {
    key: 'MUST_DO',
    label: 'Must do',
    blurb: 'A plan that drops this is rejected outright',
    tint: colors.coralInk,
    fill: colors.coralSoft,
    icon: 'heart',
  },
  {
    key: 'IMPORTANT',
    label: 'Important',
    blurb: 'Kept unless nothing else will fit',
    tint: colors.amberInk,
    fill: colors.amberSoft,
    icon: 'spark',
  },
  {
    key: 'OPTIONAL',
    label: 'Optional',
    blurb: 'First to be traded away',
    tint: colors.inkMuted,
    fill: colors.haze,
    icon: 'camera',
  },
];

interface BandBox {
  key: Priority;
  y: number;
  height: number;
}

export function PrioritySegment() {
  const trip = useTrip((s) => s.overview?.trip ?? null);
  const savePriorities = useTrip((s) => s.savePriorities);
  const loading = useTrip((s) => s.loading);

  const [draft, setDraft] = useState<Record<string, Priority> | null>(null);
  const [boxes, setBoxes] = useState<BandBox[]>([]);

  const activities = useMemo(() => (trip?.nodes ?? []).filter((n) => n.kind === 'ACTIVITY'), [trip]);

  if (!trip) return <Loading label="Laying out your tickets" icon="ticket" />;

  const priorityOf = (node: TripNode): Priority => draft?.[node.id] ?? node.priority;
  const dirty = Boolean(draft && activities.some((a) => draft[a.id] && draft[a.id] !== a.priority));

  const move = (nodeId: string, priority: Priority) => {
    setDraft((prev) => ({ ...(prev ?? {}), [nodeId]: priority }));
    haptic.light();
  };

  const measure = (key: Priority) => (e: LayoutChangeEvent) => {
    const { y, height } = e.nativeEvent.layout;
    setBoxes((prev) => [...prev.filter((b) => b.key !== key), { key, y, height }]);
  };

  const bandAt = (pageY: number): Priority | null =>
    boxes.find((b) => pageY >= b.y && pageY <= b.y + b.height)?.key ?? null;

  return (
    <ScreenScaffold
      footer={
        dirty ? (
          <StickyCTA
            label="Save priorities"
            icon="check"
            loading={loading.priorities}
            onPress={() => {
              const payload = activities
                .filter((a) => draft?.[a.id] && draft[a.id] !== a.priority)
                .map((a) => ({ nodeId: a.id, priority: draft![a.id] }));
              void savePriorities(payload).then(() => setDraft(null));
            }}
            note="The recovery engine reads these as constraints."
            secondary={{ label: 'Discard changes', onPress: () => setDraft(null) }}
          />
        ) : undefined
      }
    >
      <ChapterHeader
        marker="Chapter six · what matters"
        title="What must survive?"
        standfirst="Drag a ticket into a band, or tap it to cycle. Press and hold to pick it up."
        scene="dusk"
      />

      {BANDS.map((band) => {
        const members = activities.filter((a) => priorityOf(a) === band.key);
        return (
          <View key={band.key} onLayout={measure(band.key)} style={{ marginBottom: space(5) }}>
            <Row justify="space-between" style={{ marginBottom: space(2) }}>
              <Row gap={space(2)}>
                <TravelIcon name={band.icon} size={14} color={band.tint} weight={1.8} />
                <Eyebrow color={band.tint}>{band.label}</Eyebrow>
              </Row>
              <Text style={[type.code, { color: colors.inkFaint }]}>
                {members.length} {members.length === 1 ? 'ticket' : 'tickets'}
              </Text>
            </Row>
            <Txt variant="meta" color={colors.inkMuted} style={{ marginBottom: space(2.5) }}>
              {band.blurb}
            </Txt>

            <View style={[styles.band, { borderColor: band.tint, backgroundColor: band.fill }]}>
              {members.length === 0 ? (
                <Row gap={space(2)} style={{ paddingVertical: space(3) }}>
                  <TravelIcon name="arrowDown" size={13} color={colors.inkFaint} weight={1.8} />
                  <Txt variant="meta" color={colors.inkFaint}>
                    Nothing here — drop a ticket in.
                  </Txt>
                </Row>
              ) : (
                members.map((node, i) => (
                  <DraggableTicket
                    key={node.id}
                    node={node}
                    tint={band.tint}
                    pageBg={band.fill}
                    index={i}
                    onDrop={(pageY) => {
                      const target = bandAt(pageY);
                      if (target && target !== band.key) move(node.id, target);
                    }}
                    onCycle={() => {
                      const order: Priority[] = ['MUST_DO', 'IMPORTANT', 'OPTIONAL'];
                      move(node.id, order[(order.indexOf(band.key) + 1) % order.length]);
                    }}
                  />
                ))
              )}
            </View>
          </View>
        );
      })}

      <PaperCard depth="flat" tinted={colors.haze}>
        <Row gap={space(2.5)} align="flex-start">
          <TravelIcon name="compass" size={15} color={colors.indigo} weight={1.7} />
          <Txt variant="small" color={colors.inkMuted} style={{ flex: 1 }}>
            The engine reads these three bands differently. Must-do is a hard rule — you will never be offered a plan
            that drops one. Important costs a plan points. Optional is what gets traded first when nothing else fits.
          </Txt>
        </Row>
      </PaperCard>
    </ScreenScaffold>
  );
}

/** An admission ticket that lifts like paper when you pick it up. */
function DraggableTicket({
  node,
  tint,
  pageBg,
  index,
  onDrop,
  onCycle,
}: {
  node: TripNode;
  tint: string;
  pageBg: string;
  index: number;
  onDrop: (pageY: number) => void;
  onCycle: () => void;
}) {
  const ty = useSharedValue(0);
  const tx = useSharedValue(0);
  const lift = useSharedValue(0);

  const pan = Gesture.Pan()
    .activateAfterLongPress(170)
    .onStart(() => {
      lift.value = withTiming(1, { duration: motion.tap });
    })
    .onUpdate((e) => {
      ty.value = e.translationY;
      tx.value = e.translationX * 0.22;
    })
    .onEnd((e) => {
      runOnJS(onDrop)(e.absoluteY);
      ty.value = withSpring(0, motion.spring);
      tx.value = withSpring(0, motion.spring);
      lift.value = withTiming(0, { duration: motion.quick });
    });

  const tap = Gesture.Tap().onEnd((_e, ok) => {
    if (ok) runOnJS(onCycle)();
  });

  const style = useAnimatedStyle(() => ({
    transform: [
      { perspective: 700 },
      { translateX: tx.value },
      { translateY: ty.value },
      { scale: 1 + lift.value * 0.035 },
      { rotateZ: `${lift.value * -1.4}deg` },
    ],
    shadowOpacity: 0.06 + lift.value * 0.2,
    shadowRadius: 8 + lift.value * 18,
    zIndex: lift.value > 0 ? 30 : 1,
  }));

  return (
    <GestureDetector gesture={Gesture.Exclusive(pan, tap)}>
      <Animated.View
        layout={LinearTransition.springify().damping(motion.springSoft.damping)}
        style={[styles.ticketWrap, style]}
        accessible
        accessibilityRole="button"
        accessibilityLabel={`${node.title}. ${shortDate(node.start)} at ${clock(node.start)}`}
        accessibilityHint="Double tap to change band, press and hold to drag"
      >
        <View style={styles.ticket}>
          <View style={[styles.ticketEdge, { backgroundColor: tint }]} />
          <View style={{ flex: 1, padding: space(3) }}>
            <Txt variant="h3" style={{ fontSize: 14.5 }} numberOfLines={1}>
              {node.title}
            </Txt>
            <Row gap={space(2)} style={{ marginTop: 3 }} wrap>
              <Txt variant="meta" color={colors.inkMuted}>
                {shortDate(node.start)} · {clock(node.start)}
              </Txt>
              <Txt variant="meta" color={colors.inkFaint}>
                {inr(node.cost)}
              </Txt>
              {node.weatherSensitive ? <Pill label="Weather" fg={colors.amberInk} bg={colors.amberSoft} icon="rain" /> : null}
              {!node.refundable ? <Pill label="Non-refundable" fg={colors.coralInk} bg={colors.coralSoft} icon="lock" /> : null}
            </Row>
          </View>
          <Perforation vertical length={64} bg={pageBg} />
          <View style={styles.stub}>
            <TravelIcon name="ticket" size={15} color={tint} weight={1.7} />
          </View>
        </View>
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  band: {
    borderRadius: radius.md,
    borderWidth: 1.4,
    borderStyle: 'dashed',
    padding: space(2),
    gap: space(2),
  },
  ticketWrap: {
    shadowColor: colors.shadowTint,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  ticket: {
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: colors.cloud,
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.frost,
    overflow: 'hidden',
    minHeight: 64,
  },
  ticketEdge: { width: 4 },
  stub: { width: 42, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.haze },
});
