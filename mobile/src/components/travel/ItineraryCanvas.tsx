/**
 * ItineraryCanvas — the itinerary as a physical object.
 *
 * This is the hero of the product. Every booking takes the form of the artefact
 * it actually is: flights and experiences are perforated tickets, stays are
 * folded sheets, transfers are slim slips. A route string runs down the page
 * with a pin at every stop, and days are marked with luggage tags.
 *
 * The same component renders the healthy trip, the disrupted trip and the
 * rebuilt trip — which is what makes recovery feel like the itinerary healing
 * rather than a different screen appearing.
 */
import React, { memo, useEffect } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { colors, fonts, motion, radius, space, statusStyle, touch, type, useReducedMotion } from '@/theme';
import { LuggageTag, PaperCard, Stamp, TapeStrip, TravelTicket } from '@/components/travel/paper';
import { TravelIcon, kindIcon } from '@/components/travel/TravelIcon';
import { Row, Txt } from '@/components/primitives';
import { clock, dayDate, durationLabel, inr, minutesBetween } from '@/utils/format';
import * as haptic from '@/utils/haptics';
import type { TripNode } from '@/types/domain';

/* ------------------------------------------------------------------ */
/* Risk breathing                                                     */
/* ------------------------------------------------------------------ */

/** A slow breath on anything at risk. Motion as an early warning, not alarm. */
function useBreath(active: boolean) {
  const reduced = useReducedMotion();
  const v = useSharedValue(0);

  useEffect(() => {
    if (!active || reduced) {
      v.value = withTiming(active && reduced ? 1 : 0, { duration: 0 });
      return;
    }
    v.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1350, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 1350, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      false,
    );
  }, [active, reduced, v]);

  return useAnimatedStyle(() => ({ opacity: 0.32 + v.value * 0.68 }));
}

/* ------------------------------------------------------------------ */
/* One booking                                                        */
/* ------------------------------------------------------------------ */

export const ItineraryNode = memo(function ItineraryNode({
  node,
  index = 0,
  onPress,
  onInspect,
  changed,
  compact,
}: {
  node: TripNode;
  index?: number;
  onPress?: () => void;
  onInspect?: () => void;
  /** Marks a booking the active recovery plan moved. */
  changed?: boolean;
  compact?: boolean;
}) {
  const s = statusStyle(node.status);
  const atRisk = node.status === 'AT_RISK' || node.status === 'AFFECTED';
  const broken = node.status === 'MISSED' || node.status === 'CANCELLED' || node.status === 'DISRUPTED';
  const breath = useBreath(atRisk);
  const duration = minutesBetween(node.start, node.end);
  const icon = kindIcon[node.kind] ?? 'pin';

  const where =
    node.from && node.to
      ? `${node.from.code ?? node.from.city} → ${node.to.code ?? node.to.city}`
      : (node.location?.name ?? '');

  const press = () => {
    if (!onPress) return;
    haptic.tap();
    onPress();
  };
  const hold = () => {
    if (!onInspect) return;
    haptic.medium();
    onInspect();
  };

  /* --- the body, shared by every artefact type --- */
  const body = (
    <View>
      <Row justify="space-between" align="flex-start">
        <View style={{ flex: 1, paddingRight: space(2) }}>
          <Row gap={7}>
            <TravelIcon
              name={icon}
              size={15}
              color={s.ink}
              weight={1.7}
              badge={broken ? 'warning' : atRisk ? 'clock' : undefined}
              badgeBackground={s.ink}
            />
            <Text style={[type.stamp, { color: colors.inkFaint }]}>
              {node.kind === 'ACTIVITY' ? 'EXPERIENCE' : node.kind}
            </Text>
            {node.priority === 'MUST_DO' ? (
              <Pill label="Must do" />
            ) : null}
          </Row>

          <Txt variant="h3" style={{ marginTop: 5 }} numberOfLines={1}>
            {node.title}
          </Txt>
          {!compact && node.subtitle ? (
            <Txt variant="meta" color={colors.inkMuted} style={{ marginTop: 2 }} numberOfLines={1}>
              {node.subtitle}
            </Txt>
          ) : null}
        </View>
      </Row>

      {!compact ? (
        <Row justify="space-between" style={{ marginTop: space(3) }}>
          <Row gap={5} style={{ flex: 1 }}>
            <TravelIcon name="pin" size={11} color={colors.inkFaint} weight={1.8} />
            <Txt variant="meta" color={colors.inkMuted} numberOfLines={1} style={{ flex: 1 }}>
              {where}
            </Txt>
          </Row>
          <Row gap={space(2)}>
            <Text style={[type.code, { color: colors.inkMuted }]}>{inr(node.cost)}</Text>
            {node.status !== 'SAFE' ? <Stamp label={s.label} tint={s.ink} rotate={-4} /> : null}
          </Row>
        </Row>
      ) : null}
    </View>
  );

  /* --- the stub: time on the tear-off half of a ticket --- */
  const stub = (
    <View style={{ alignItems: 'center' }}>
      <Text style={[type.clock, { color: colors.ink }]}>{clock(node.start)}</Text>
      <Text style={[type.stamp, { color: colors.inkFaint, fontSize: 8.5, marginTop: 2 }]}>
        {node.kind === 'HOTEL' ? 'CHECK-IN' : durationLabel(duration).toUpperCase()}
      </Text>
      {node.ref ? (
        <Text style={[type.code, { color: colors.inkFaint, fontSize: 9, marginTop: 4 }]} numberOfLines={1}>
          {node.ref}
        </Text>
      ) : null}
    </View>
  );

  const wrap = (child: React.ReactNode) => (
    <Animated.View layout={LinearTransition.springify().damping(motion.springSoft.damping)}>
      <Pressable
        onPress={press}
        onLongPress={hold}
        delayLongPress={280}
        accessibilityRole="button"
        accessibilityLabel={`${node.title}, ${node.kind.toLowerCase()}, ${clock(node.start)}, ${s.label}`}
        accessibilityHint={onInspect ? 'Double tap for detail, press and hold to trace dependencies' : undefined}
        // The minimum lives on the Pressable, not its child: the button's own
        // box is what a screen reader and a thumb actually target.
        style={({ pressed }) => [styles.tapTarget, pressed ? { opacity: 0.72 } : null]}
      >
        <View>
          {atRisk ? (
            <Animated.View
              style={[styles.breathEdge, { backgroundColor: s.ink }, breath]}
              pointerEvents="none"
            />
          ) : null}
          {child}
          {changed ? (
            <>
              <TapeStrip width={54} rotate={-16} tint={colors.amberSoft} style={{ top: -8, right: 14 }} />
              <Stamp label="Moved" tint={colors.amberInk} rotate={8} style={styles.movedStamp} />
            </>
          ) : null}
        </View>
      </Pressable>
    </Animated.View>
  );

  /* Transfers are slips of paper, not tickets. */
  if (node.kind === 'TRANSFER') {
    return wrap(
      <PaperCard depth="flat" accent={s.ink} style={styles.slip} tinted={colors.haze}>
        <Row justify="space-between" align="center">
          <Row gap={space(2.5)} style={{ flex: 1 }}>
            <TravelIcon name="transfer" size={15} color={s.ink} weight={1.7} />
            <View style={{ flex: 1 }}>
              <Txt variant="small" style={{ fontFamily: fonts.bold }} numberOfLines={1}>
                {node.title}
              </Txt>
              <Txt variant="meta" color={colors.inkFaint} numberOfLines={1}>
                {where}
              </Txt>
            </View>
          </Row>
          <Row gap={space(2)}>
            <Text style={[type.code, { color: colors.inkSoft }]}>{clock(node.start)}</Text>
            {node.status !== 'SAFE' ? <Stamp label={s.label} tint={s.ink} rotate={-3} /> : null}
          </Row>
        </Row>
      </PaperCard>,
    );
  }

  /* Stays are folded sheets. */
  if (node.kind === 'HOTEL') {
    return wrap(
      <PaperCard depth="lifted" accent={s.ink} folded tiltIndex={index}>
        {body}
      </PaperCard>,
    );
  }

  /* Flights and experiences are perforated tickets. */
  return wrap(
    <TravelTicket accent={s.ink} stub={stub} tiltIndex={index} depth="lifted">
      {body}
    </TravelTicket>,
  );
});

/** Tiny inline pill — local so ItineraryNode has no circular import. */
function Pill({ label }: { label: string }) {
  return (
    <View style={styles.mustDo}>
      <Text style={[type.stamp, { color: colors.coralInk, fontSize: 8.5 }]}>{label.toUpperCase()}</Text>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* The canvas                                                         */
/* ------------------------------------------------------------------ */

export function ItineraryCanvas({
  nodes,
  onSelect,
  onInspect,
  changedIds,
  compact,
  style,
}: {
  nodes: TripNode[];
  onSelect?: (node: TripNode) => void;
  onInspect?: (node: TripNode) => void;
  changedIds?: Set<string>;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const ordered = [...nodes].sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
  const days = new Map<number, TripNode[]>();
  for (const node of ordered) {
    if (!days.has(node.day)) days.set(node.day, []);
    days.get(node.day)!.push(node);
  }

  let running = 0;

  return (
    <View style={style}>
      {[...days.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([day, dayNodes], dayIndex) => {
          const broken = dayNodes.some((n) => ['MISSED', 'CANCELLED', 'DISRUPTED'].includes(n.status));
          const shaken = dayNodes.some((n) => ['AT_RISK', 'AFFECTED'].includes(n.status));
          const tint = broken ? colors.coralInk : shaken ? colors.amberInk : colors.indigo;

          return (
            <Animated.View
              key={day}
              layout={LinearTransition.springify().damping(motion.springSoft.damping)}
              style={styles.day}
            >
              {/* day marker */}
              <Row justify="space-between" style={{ marginBottom: space(3) }}>
                <LuggageTag tint={colors.haze} edge={tint}>
                  <Text style={[type.stamp, { color: tint }]}>{`DAY ${String(day).padStart(2, '0')}`}</Text>
                  <Text style={[type.meta, { color: colors.inkFaint, fontSize: 10 }]}>
                    {dayDate(dayNodes[0].start)}
                  </Text>
                </LuggageTag>
                <Text style={[type.stamp, { color: colors.inkFaint }]}>
                  {`${dayNodes.length} ${dayNodes.length === 1 ? 'STOP' : 'STOPS'}${broken ? ' · DISRUPTED' : shaken ? ' · AT RISK' : ''}`}
                </Text>
              </Row>

              {/* route string + the day's artefacts */}
              <View style={styles.spineRow}>
                <View style={styles.spineCol}>
                  <View style={[styles.spine, { backgroundColor: tint }]} />
                  <View style={[styles.spinePin, { borderColor: tint }]} />
                  {dayIndex > 0 ? <View style={[styles.spineCapTop, { backgroundColor: tint }]} /> : null}
                </View>

                <View style={{ flex: 1, gap: space(3) }}>
                  {dayNodes.map((node) => {
                    const i = running;
                    running += 1;
                    return (
                      <ItineraryNode
                        key={node.id}
                        node={node}
                        index={i}
                        compact={compact}
                        onPress={onSelect ? () => onSelect(node) : undefined}
                        onInspect={onInspect ? () => onInspect(node) : undefined}
                        changed={changedIds?.has(node.id)}
                      />
                    );
                  })}
                </View>
              </View>
            </Animated.View>
          );
        })}
    </View>
  );
}

const styles = StyleSheet.create({
  tapTarget: { minHeight: touch.min, justifyContent: 'center' },
  day: { marginBottom: space(7) },
  spineRow: { flexDirection: 'row' },
  spineCol: { width: 22, alignItems: 'center' },
  spine: { width: 2, flex: 1, opacity: 0.22, borderRadius: 1 },
  spinePin: {
    position: 'absolute',
    top: 16,
    width: 9,
    height: 9,
    borderRadius: 5,
    borderWidth: 2,
    backgroundColor: colors.mist,
  },
  spineCapTop: { position: 'absolute', top: 0, width: 6, height: 2, opacity: 0.3 },
  slip: { paddingVertical: space(2.5), paddingHorizontal: space(3) },
  breathEdge: {
    position: 'absolute',
    left: -3,
    top: 6,
    bottom: 6,
    width: 3,
    borderRadius: 2,
  },
  movedStamp: { position: 'absolute', right: 8, bottom: -6, backgroundColor: colors.mist },
  mustDo: {
    backgroundColor: colors.coralSoft,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: radius.xs,
  },
});
