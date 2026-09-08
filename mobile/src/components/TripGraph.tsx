/**
 * The digital twin — a miniature pop-up model of the trip.
 *
 * Bookings stand up off the page as little paper cards with printed shadows and
 * a fold line at the base; dependencies are route strings threaded between
 * them, carrying the mode of travel. Days are separated by page folds.
 *
 * Gestures: pinch to zoom, drag to pan, double-tap to reset, tap a card to open
 * it, long-press to trace its chain.
 */
import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Circle, G, Line, Path, Rect, Text as SvgText } from 'react-native-svg';

import { colors, fonts, motion, radius, space, statusStyle, useReducedMotion } from '@/theme';
import { Button, Eyebrow, Row } from '@/components/primitives';
import { TravelIcon, kindIcon } from '@/components/travel/TravelIcon';
import { clock } from '@/utils/format';
import * as haptic from '@/utils/haptics';
import type { TripEdge, TripNode } from '@/types/domain';

const AnimatedPath = Animated.createAnimatedComponent(Path);

const COL_W = 176;
const ROW_H = 112;
const CARD_W = 138;
const CARD_H = 66;
const PAD_X = 52;
const PAD_Y = 70;

interface Placed {
  node: TripNode;
  x: number;
  y: number;
  cx: number;
  cy: number;
}

/** Day columns across, order within the day down, with a hand-placed drift. */
function layout(nodes: TripNode[]) {
  const byDay = new Map<number, TripNode[]>();
  for (const node of [...nodes].sort((a, b) => Date.parse(a.start) - Date.parse(b.start))) {
    if (!byDay.has(node.day)) byDay.set(node.day, []);
    byDay.get(node.day)!.push(node);
  }
  const days = [...byDay.keys()].sort((a, b) => a - b);
  const placed: Placed[] = [];
  let maxRows = 1;

  days.forEach((day, col) => {
    const dayNodes = byDay.get(day)!;
    maxRows = Math.max(maxRows, dayNodes.length);
    dayNodes.forEach((node, row) => {
      const drift = col % 2 === 0 ? 0 : 24;
      const x = PAD_X + col * COL_W;
      const y = PAD_Y + row * ROW_H + drift;
      placed.push({ node, x, y, cx: x + CARD_W / 2, cy: y + CARD_H / 2 });
    });
  });

  return {
    placed,
    days,
    width: PAD_X * 2 + (days.length - 1) * COL_W + CARD_W,
    height: PAD_Y * 2 + (maxRows - 1) * ROW_H + CARD_H + 48,
  };
}

/** Route string between two cards — a soft S-curve, never a straight wire. */
function thread(from: Placed, to: Placed): string {
  const x1 = from.x + CARD_W;
  const y1 = from.cy;
  const x2 = to.x;
  const y2 = to.cy;

  if (x2 <= x1) {
    const bow = 30;
    return `M ${from.cx} ${from.y + CARD_H} C ${from.cx + bow} ${from.y + CARD_H + 26}, ${to.cx - bow} ${to.y - 26}, ${to.cx} ${to.y}`;
  }
  const dx = Math.max(30, (x2 - x1) * 0.55);
  return `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
}

const threadLength = (from: Placed, to: Placed) => Math.hypot(to.cx - from.cx, to.cy - from.cy) * 1.18;

function truncate(v: string, max: number) {
  return v.length > max ? `${v.slice(0, max - 1)}…` : v;
}

export function TripGraph({
  nodes,
  edges,
  selectedId,
  onSelect,
  onInspect,
  /** Node ids in cascade order — drives the ripple along the strings. */
  rippleOrder,
  rippleKey,
}: {
  nodes: TripNode[];
  edges: TripEdge[];
  selectedId?: string | null;
  onSelect?: (node: TripNode) => void;
  onInspect?: (node: TripNode) => void;
  rippleOrder?: string[];
  rippleKey?: string | number;
}) {
  const reduced = useReducedMotion();
  const { placed, width, height, days } = useMemo(() => layout(nodes), [nodes]);
  const byId = useMemo(() => new Map(placed.map((p) => [p.node.id, p])), [placed]);

  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const savedTx = useSharedValue(0);
  const savedTy = useSharedValue(0);
  const ripple = useSharedValue(0);

  React.useEffect(() => {
    if (!rippleOrder?.length || reduced) {
      ripple.value = 0;
      return;
    }
    ripple.value = 0;
    ripple.value = withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.cubic) });
  }, [rippleKey, rippleOrder, ripple, reduced]);

  const pinch = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = Math.min(2.4, Math.max(0.5, savedScale.value * e.scale));
    })
    .onEnd(() => {
      savedScale.value = scale.value;
    });

  const pan = Gesture.Pan()
    .averageTouches(true)
    .onUpdate((e) => {
      tx.value = savedTx.value + e.translationX;
      ty.value = savedTy.value + e.translationY;
    })
    .onEnd(() => {
      savedTx.value = tx.value;
      savedTy.value = ty.value;
    });

  const reset = () => {
    scale.value = withSpring(1, motion.spring);
    tx.value = withSpring(0, motion.spring);
    ty.value = withSpring(0, motion.spring);
    savedScale.value = 1;
    savedTx.value = 0;
    savedTy.value = 0;
  };

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      runOnJS(reset)();
      runOnJS(haptic.tap)();
    });

  const canvas = useAnimatedStyle(() => ({
    transform: [
      { perspective: 1100 },
      { translateX: tx.value },
      { translateY: ty.value },
      { scale: scale.value },
    ],
  }));

  const rippleAt = (id: string) => {
    const i = rippleOrder?.indexOf(id) ?? -1;
    return i < 0 ? null : i / Math.max(1, (rippleOrder?.length ?? 1) - 1);
  };

  return (
    <View style={styles.root}>
      <GestureDetector gesture={Gesture.Simultaneous(pinch, pan, doubleTap)}>
        <View style={styles.viewport} collapsable={false}>
          <Animated.View style={[{ width, height }, canvas]}>
            <Svg width={width} height={height}>
              {/* page folds between days */}
              {days.map((day, col) => (
                <G key={`fold-${day}`}>
                  <Line
                    x1={PAD_X + col * COL_W - 22}
                    y1={26}
                    x2={PAD_X + col * COL_W - 22}
                    y2={height - 26}
                    stroke={colors.rule}
                    strokeWidth={1}
                    strokeDasharray="2 7"
                  />
                  <SvgText
                    x={PAD_X + col * COL_W - 14}
                    y={38}
                    fill={colors.inkFaint}
                    fontSize={9.5}
                    fontFamily={fonts.display}
                    letterSpacing={1.4}
                  >
                    {`DAY ${String(day).padStart(2, '0')}`}
                  </SvgText>
                </G>
              ))}

              {/* route strings */}
              {edges.map((edge) => {
                const from = byId.get(edge.from);
                const to = byId.get(edge.to);
                if (!from || !to) return null;
                const d = thread(from, to);
                const fromStatus = statusStyle(from.node.status);
                const broken = ['MISSED', 'CANCELLED', 'DISRUPTED'].includes(from.node.status);
                const lit = selectedId === edge.from || selectedId === edge.to;
                const soft = edge.type === 'SAME_DAY' || edge.type === 'SEQUENCE';

                return (
                  <React.Fragment key={edge.id}>
                    <Path
                      d={d}
                      stroke={broken ? colors.coralInk : lit ? colors.indigo : colors.ruleStrong}
                      strokeWidth={lit ? 2.4 : 1.7}
                      strokeOpacity={broken ? 0.8 : lit ? 1 : 0.62}
                      fill="none"
                      strokeLinecap="round"
                      strokeDasharray={soft ? '5 6' : undefined}
                    />
                    {rippleOrder?.includes(edge.to) && !reduced ? (
                      <RippleSpark
                        d={d}
                        length={threadLength(from, to)}
                        progress={ripple}
                        at={rippleAt(edge.to) ?? 0}
                      />
                    ) : null}
                    {/* mode of travel, printed on the string */}
                    {!soft ? (
                      <Circle
                        cx={(from.x + CARD_W + to.x) / 2}
                        cy={(from.cy + to.cy) / 2}
                        r={3}
                        fill={broken ? colors.coralInk : fromStatus.ink}
                        opacity={0.55}
                      />
                    ) : null}
                  </React.Fragment>
                );
              })}

              {/* standing paper cards */}
              {placed.map((p) => {
                const s = statusStyle(p.node.status);
                const active = selectedId === p.node.id;
                const off = p.node.status !== 'SAFE' && p.node.status !== 'COMPLETED';

                return (
                  <G key={p.node.id}>
                    {/* printed shadow — what makes it read as standing up */}
                    <Rect
                      x={p.x + 1}
                      y={p.y + 4}
                      width={CARD_W}
                      height={CARD_H}
                      rx={16}
                      fill={colors.shadowTint}
                      opacity={0.07}
                    />
                    {off ? (
                      <Rect x={p.x - 5} y={p.y - 5} width={CARD_W + 10} height={CARD_H + 10} rx={22} fill={s.ink} opacity={0.13} />
                    ) : null}

                    <Rect
                      x={p.x}
                      y={p.y}
                      width={CARD_W}
                      height={CARD_H}
                      rx={16}
                      fill={colors.cloud}
                      stroke={active ? colors.indigo : s.ink}
                      strokeWidth={active ? 2 : 1.2}
                      strokeOpacity={active ? 1 : 0.7}
                    />
                    {/* accent edge + base fold */}
                    <Rect x={p.x} y={p.y + 10} width={4} height={CARD_H - 20} rx={2} fill={s.ink} />

                    <SvgText x={p.x + 13} y={p.y + 20} fill={colors.inkFaint} fontSize={8.5} fontFamily={fonts.display} letterSpacing={1.1}>
                      {p.node.kind === 'ACTIVITY' ? 'EXPERIENCE' : p.node.kind}
                    </SvgText>
                    <SvgText x={p.x + CARD_W - 13} y={p.y + 20} fill={colors.inkSoft} fontSize={10} fontFamily={fonts.display} textAnchor="end">
                      {clock(p.node.start)}
                    </SvgText>
                    <SvgText x={p.x + 13} y={p.y + 40} fill={colors.ink} fontSize={11.5} fontFamily={fonts.medium}>
                      {truncate(p.node.title, 17)}
                    </SvgText>
                    <SvgText x={p.x + 13} y={p.y + 55} fill={colors.inkMuted} fontSize={9.5} fontFamily={fonts.text}>
                      {truncate(
                        p.node.from && p.node.to
                          ? `${p.node.from.code ?? p.node.from.city} → ${p.node.to.code ?? p.node.to.city}`
                          : (p.node.location?.name ?? ''),
                        20,
                      )}
                    </SvgText>
                  </G>
                );
              })}
            </Svg>

            {/* transparent hit targets over the drawn cards */}
            {placed.map((p) => (
              <TapTarget
                key={`hit-${p.node.id}`}
                x={p.x}
                y={p.y}
                label={`${p.node.title}, ${clock(p.node.start)}`}
                onPress={() => {
                  haptic.tap();
                  onSelect?.(p.node);
                }}
                onLongPress={() => {
                  haptic.medium();
                  onInspect?.(p.node);
                }}
              />
            ))}
          </Animated.View>
        </View>
      </GestureDetector>

      <View style={styles.hud} pointerEvents="box-none">
        <Row gap={space(2.5)} wrap>
          {(
            [
              ['On track', colors.indigo],
              ['At risk', colors.amberInk],
              ['Broken', colors.coralInk],
            ] as const
          ).map(([label, tint]) => (
            <Row key={label} gap={5}>
              <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: tint }} />
              <Eyebrow color={colors.inkMuted}>{label}</Eyebrow>
            </Row>
          ))}
        </Row>
        <Button label="Recentre" variant="ghost" icon="compass" onPress={reset} style={styles.resetBtn} />
      </View>
    </View>
  );
}

/** A bright dash travelling the string as the cascade reaches that booking. */
function RippleSpark({
  d,
  length,
  progress,
  at,
}: {
  d: string;
  length: number;
  progress: SharedValue<number>;
  at: number;
}) {
  const dash = Math.max(18, length * 0.22);
  const props = useAnimatedProps(() => {
    const window = 0.34;
    const local = (progress.value - at * (1 - window)) / window;
    const clamped = Math.min(1, Math.max(0, local));
    return {
      opacity: local > 0 && local < 1 ? 1 - Math.abs(local - 0.5) * 1.4 : 0,
      strokeDashoffset: (1 - clamped) * (length + dash) - dash,
    };
  });

  return (
    <AnimatedPath
      d={d}
      stroke={colors.coralInk}
      strokeWidth={3}
      fill="none"
      strokeLinecap="round"
      strokeDasharray={`${dash} ${length + dash}`}
      animatedProps={props}
    />
  );
}

function TapTarget({
  x,
  y,
  label,
  onPress,
  onLongPress,
}: {
  x: number;
  y: number;
  label: string;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const tap = Gesture.Tap().onEnd((_e, ok) => {
    if (ok) runOnJS(onPress)();
  });
  const long = Gesture.LongPress()
    .minDuration(300)
    .onEnd((_e, ok) => {
      if (ok) runOnJS(onLongPress)();
    });

  return (
    <GestureDetector gesture={Gesture.Exclusive(long, tap)}>
      <View
        style={[styles.hit, { left: x, top: y }]}
        accessible
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint="Double tap to open, press and hold to trace dependencies"
      />
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.haze },
  viewport: { flex: 1, overflow: 'hidden' },
  hit: { position: 'absolute', width: CARD_W, height: CARD_H },
  hud: {
    position: 'absolute',
    left: space(4),
    right: space(4),
    bottom: space(4),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.cloud,
    borderRadius: radius.pill,
    paddingLeft: space(4),
    paddingRight: space(1.5),
    paddingVertical: space(1.5),
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.frost,
    shadowColor: colors.shadowTint,
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 4,
  },
  resetBtn: { minHeight: 44, paddingHorizontal: space(3) },
});
