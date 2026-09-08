/**
 * SCREENS 6 + 7 — Something changed, and what it breaks.
 *
 * The emotional centre. First the fact, stated plainly on a torn page. Then the
 * consequence, travelling down the dependency chain as a route string that
 * lights up hop by hop, with every affected booking openable for the reason.
 *
 * Deliberately not frightening: warm terracotta, not alarm red. "Something
 * happened, but we've got this."
 */
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { colors, fonts, motion, radius, space, statusStyle, useReducedMotion } from '@/theme';
import {
  Button,
  ChapterHeader,
  Divider,
  Empty,
  Eyebrow,
  Loading,
  Pill,
  Row,
  ScreenScaffold,
  SectionHeader,
  StatTile,
  StickyCTA,
  Txt,
} from '@/components/primitives';
import { PaperCard, Stamp, TapeStrip } from '@/components/travel/paper';
import { NodeSheet } from '@/components/travel/NodeSheet';
import { TravelIcon, kindIcon } from '@/components/travel/TravelIcon';
import { clock, durationLabel, shortDate, statusLabel, when } from '@/utils/format';
import * as haptic from '@/utils/haptics';
import { useTrip } from '@/state/store';
import type { NodeImpact, TripNode } from '@/types/domain';

/** A shockwave behind the disrupted booking. Plays three times, then stops. */
function Shock() {
  const reduced = useReducedMotion();
  const wave = useSharedValue(0);

  useEffect(() => {
    if (reduced) return;
    wave.value = withRepeat(
      withSequence(withTiming(1, { duration: 1500, easing: Easing.out(Easing.quad) }), withTiming(0, { duration: 0 })),
      3,
      false,
    );
  }, [wave, reduced]);

  const style = useAnimatedStyle(() => ({
    opacity: 0.2 * (1 - wave.value),
    transform: [{ scale: 0.9 + wave.value * 0.6 }],
  }));

  return <Animated.View pointerEvents="none" style={[styles.shock, style]} />;
}

export function ImpactSegment({ onFindOptions }: { onFindOptions: () => void }) {
  const overview = useTrip((s) => s.overview);
  const cascade = useTrip((s) => s.cascade);
  const narrative = useTrip((s) => s.cascadeNarrative);
  const signals = useTrip((s) => s.signals);
  const phase = useTrip((s) => s.phase);
  const loading = useTrip((s) => s.loading);
  const triggerDisruption = useTrip((s) => s.triggerDisruption);
  const reduced = useReducedMotion();

  const [open, setOpen] = useState<string | null>(null);
  const [sheetNode, setSheetNode] = useState<TripNode | null>(null);
  const reveal = useSharedValue(0);

  useEffect(() => {
    if (!cascade) return;
    reveal.value = 0;
    reveal.value = reduced
      ? withTiming(1, { duration: 0 })
      : withDelay(260, withTiming(1, { duration: 1500, easing: Easing.out(Easing.cubic) }));
    haptic.warn();
  }, [cascade?.computedAt, reveal, reduced]);

  if (!overview) return <Loading />;

  /* ---------------- nothing wrong yet ---------------- */
  if (!cascade) {
    const pending = signals?.pending ?? null;
    return (
      <ScreenScaffold>
        <ChapterHeader
          marker="Chapter three"
          title="Nothing has broken."
          standfirst="When something does, this page shows you exactly what it costs — before you have to decide anything."
          scene="storm"
        />
        {pending ? (
          <PaperCard accent={colors.coralInk} tinted={colors.coralSoft}>
            <Pill label="Waiting on you" fg={colors.coralInk} bg={colors.white} dot icon="warning" />
            <Txt variant="h2" style={{ marginTop: space(3) }}>
              {pending.headline}
            </Txt>
            <Txt variant="small" color={colors.inkSoft} style={{ marginTop: space(2) }}>
              {pending.detail}
            </Txt>
            <Button
              label="Run the impact analysis"
              icon="route"
              onPress={() => void triggerDisruption(pending)}
              loading={loading.disruption}
              size="large"
              style={{ marginTop: space(5) }}
            />
          </PaperCard>
        ) : (
          <Empty
            title="Your trip is quiet"
            body="Report something from the Report chapter, or stress-test it under What if."
            icon="sun"
          />
        )}
      </ScreenScaffold>
    );
  }

  const { disruption, impacts } = cascade;
  const source = impacts.find((i) => i.nodeId === disruption.nodeId);
  const affected = impacts
    .filter((i) => i.nodeId !== disruption.nodeId && i.status !== 'SAFE' && i.status !== 'COMPLETED')
    .sort((a, b) => a.hops - b.hops);
  const safe = impacts.filter((i) => i.status === 'SAFE');
  const nodeFor = (id: string) => overview.trip.nodes.find((n) => n.id === id) ?? null;
  const chain = [source, ...affected].filter(Boolean) as NodeImpact[];

  return (
    <>
      <ScreenScaffold scene="storm" footer={
        <StickyCTA
          label="Find another way"
          icon="recovery"
          onPress={() => {
            haptic.heavy();
            onFindOptions();
          }}
          loading={phase === 'PLANNING'}
          note={`${cascade.downstreamCount} ${cascade.downstreamCount === 1 ? 'booking' : 'bookings'} downstream need a decision`}
          secondary={{ label: "I'll handle it later", onPress: onFindOptions }}
        />
      }>
        {/* ---------- SCREEN 6: the alert ---------- */}
        <Animated.View entering={reduced ? undefined : FadeInDown.duration(motion.settle)}>
          <Eyebrow color={colors.coralInk}>Chapter three · something changed</Eyebrow>

          <View style={styles.alertWrap}>
            <Shock />
            <PaperCard depth="held" accent={colors.coralInk} style={{ marginTop: space(3) }}>
              <TapeStrip width={76} rotate={-13} tint={colors.peachSoft} style={{ top: -9, left: 24 }} />

              <Row justify="space-between" align="flex-start">
                <Pill label={statusLabel(disruption.type)} fg={colors.coralInk} bg={colors.coralSoft} dot icon="warning" />
                <Txt variant="meta" color={colors.inkFaint}>
                  {disruption.source === 'LIVE_MONITOR' ? 'Live monitor' : statusLabel(disruption.source)} ·{' '}
                  {clock(disruption.detectedAt)}
                </Txt>
              </Row>

              <Txt variant="h1" accessibilityRole="header" style={{ marginTop: space(4) }}>
                {disruption.headline}
              </Txt>

              {/* was → now, printed like a reissued ticket */}
              {source ? (
                <Row gap={space(3)} align="center" style={{ marginTop: space(4.5) }}>
                  <View style={styles.slot}>
                    <Eyebrow color={colors.inkFaint}>Was</Eyebrow>
                    <Txt
                      variant="h3"
                      color={colors.inkMuted}
                      style={{ marginTop: 3, textDecorationLine: 'line-through', fontSize: 15 }}
                    >
                      {shortDate(source.originalStart)} · {clock(source.originalStart)}
                    </Txt>
                  </View>
                  <TravelIcon name="arrowRight" size={16} color={colors.inkFaint} weight={2} />
                  <View style={[styles.slot, { backgroundColor: colors.coralSoft }]}>
                    <Eyebrow color={colors.coralInk}>Now</Eyebrow>
                    <Txt variant="h3" color={colors.coralInk} style={{ marginTop: 3, fontSize: 15 }}>
                      {source.projectedStart
                        ? `${shortDate(source.projectedStart)} · ${clock(source.projectedStart)}`
                        : 'Cancelled'}
                    </Txt>
                  </View>
                </Row>
              ) : null}

              <Txt variant="small" color={colors.inkSoft} style={{ marginTop: space(4) }}>
                {disruption.detail}
              </Txt>
            </PaperCard>
          </View>
        </Animated.View>

        {/* ---------- headline consequence ---------- */}
        <Animated.View entering={reduced ? undefined : FadeInDown.delay(150).duration(motion.settle)}>
          <Row gap={space(2)} style={{ marginTop: space(5) }}>
            <StatTile
              label="Downstream"
              value={String(cascade.downstreamCount)}
              hint="bookings hit"
              tint={colors.coralInk}
              icon="route"
            />
            <StatTile
              label="Experiences lost"
              value={String(cascade.lostExperiences.length)}
              hint={cascade.lostExperiences.length ? cascade.lostExperiences[0] : 'none'}
              tint={cascade.lostExperiences.length ? colors.coralInk : colors.indigo}
              icon="heart"
            />
            <StatTile label="Untouched" value={String(safe.length)} hint="still fine" tint={colors.indigo} icon="check" />
          </Row>
        </Animated.View>

        <Animated.View entering={reduced ? undefined : FadeIn.delay(280).duration(motion.page)}>
          <PaperCard depth="flat" tinted={colors.haze} style={{ marginTop: space(4) }}>
            <Row gap={space(2.5)} align="flex-start">
              <TravelIcon name="spark" size={15} color={colors.amberInk} weight={1.7} />
              <View style={{ flex: 1 }}>
                <Eyebrow>What this means</Eyebrow>
                <Txt variant="body" style={{ marginTop: space(1.5) }}>
                  {narrative || cascade.summary}
                </Txt>
              </View>
            </Row>
          </PaperCard>
        </Animated.View>

        {/* ---------- SCREEN 7: the cascade ---------- */}
        <View style={{ marginTop: space(9) }}>
          <SectionHeader
            eyebrow="The chain"
            title={`1 change → ${cascade.downstreamCount} ${cascade.downstreamCount === 1 ? 'consequence' : 'consequences'}`}
            subtitle="Tap any booking to see why it is affected and what it was waiting on."
          />

          {chain.map((impact, i) => (
            <ChainLink
              key={impact.nodeId}
              impact={impact}
              index={i}
              total={chain.length}
              reveal={reveal}
              open={open === impact.nodeId}
              onToggle={() => {
                haptic.tap();
                setOpen(open === impact.nodeId ? null : impact.nodeId);
              }}
              onOpenNode={() => setSheetNode(nodeFor(impact.nodeId))}
              nameOf={(id) => nodeFor(id)?.title ?? id}
            />
          ))}

          {safe.length ? (
            <PaperCard depth="flat" tinted={colors.periSoft} style={{ marginTop: space(4) }}>
              <Row justify="space-between">
                <Row gap={7}>
                  <TravelIcon name="shield" size={14} color={colors.indigo} weight={1.8} />
                  <Eyebrow color={colors.indigo}>Safe</Eyebrow>
                </Row>
                <Txt variant="meta" color={colors.inkMuted}>
                  {safe.length} bookings
                </Txt>
              </Row>
              <Row gap={space(2)} wrap style={{ marginTop: space(3) }}>
                {safe.map((s) => (
                  <Pill key={s.nodeId} label={s.title} fg={colors.indigo} bg={colors.white} icon={kindIcon[s.kind]} />
                ))}
              </Row>
            </PaperCard>
          ) : null}
        </View>
      </ScreenScaffold>

      <NodeSheet node={sheetNode} onClose={() => setSheetNode(null)} />
    </>
  );
}

/** One hop of the chain, lighting up as the wave reaches its depth. */
function ChainLink({
  impact,
  index,
  total,
  reveal,
  open,
  onToggle,
  onOpenNode,
  nameOf,
}: {
  impact: NodeImpact;
  index: number;
  total: number;
  reveal: SharedValue<number>;
  open: boolean;
  onToggle: () => void;
  onOpenNode: () => void;
  nameOf: (id: string) => string;
}) {
  const s = statusStyle(impact.status);
  const at = index / Math.max(1, total - 1);

  const style = useAnimatedStyle(() => {
    const local = Math.min(1, Math.max(0, (reveal.value - at * 0.72) / 0.28));
    return { opacity: 0.22 + local * 0.78, transform: [{ translateX: (1 - local) * 16 }] };
  });

  return (
    <Animated.View style={style}>
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`${impact.title}, ${s.label}. ${open ? 'Collapse' : 'Expand'} to see why`}
      >
        {({ pressed }) => (
          <View style={[styles.link, pressed && { opacity: 0.75 }]}>
            {/* the route string */}
            <View style={styles.rail}>
              <View style={[styles.railDot, { backgroundColor: s.ink }]} />
              {index < total - 1 ? <View style={[styles.railLine, { backgroundColor: s.ink }]} /> : null}
            </View>

            <View style={{ flex: 1, paddingBottom: space(5) }}>
              <Row justify="space-between" align="flex-start">
                <Row gap={space(2.5)} style={{ flex: 1, paddingRight: space(2) }} align="flex-start">
                  <TravelIcon
                    name={kindIcon[impact.kind] ?? 'pin'}
                    size={15}
                    color={s.ink}
                    weight={1.7}
                    badge={index === 0 ? 'warning' : undefined}
                    badgeBackground={s.ink}
                  />
                  <View style={{ flex: 1 }}>
                    <Txt variant="h3" style={{ fontSize: 15.5 }} numberOfLines={1}>
                      {impact.title}
                    </Txt>
                    <Txt variant="meta" color={colors.inkMuted} style={{ marginTop: 2 }}>
                      {index === 0
                        ? 'Where it started'
                        : `${impact.hops} ${impact.hops === 1 ? 'step' : 'steps'} downstream`}
                    </Txt>
                  </View>
                </Row>
                <Stamp label={s.label} tint={s.ink} rotate={-5} />
              </Row>

              {open ? (
                <Animated.View entering={FadeInDown.duration(motion.quick)} style={[styles.reason, { backgroundColor: s.fill }]}>
                  <Txt variant="small" color={colors.inkSoft}>
                    {impact.reason}
                  </Txt>

                  {impact.chain.length > 1 ? (
                    <>
                      <Divider dashed style={{ marginVertical: space(3) }} />
                      <Eyebrow>Chain</Eyebrow>
                      {impact.chain.map((id, j) => (
                        <Row key={id} gap={space(2)} style={{ marginTop: 6 }} align="flex-start">
                          <TravelIcon
                            name={j === 0 ? 'warning' : 'arrowDown'}
                            size={11}
                            color={j === 0 ? s.ink : colors.inkFaint}
                            weight={2}
                          />
                          <Txt variant="small" color={j === impact.chain.length - 1 ? colors.ink : colors.inkMuted} style={{ flex: 1 }}>
                            {nameOf(id)}
                          </Txt>
                        </Row>
                      ))}
                    </>
                  ) : null}

                  {impact.delayMinutes !== 0 && impact.projectedStart ? (
                    <Txt variant="meta" color={colors.inkMuted} style={{ marginTop: space(3) }}>
                      {when(impact.originalStart)} → {when(impact.projectedStart)} · {durationLabel(impact.delayMinutes)} later
                    </Txt>
                  ) : null}

                  <Pressable onPress={onOpenNode} hitSlop={10} style={{ marginTop: space(3) }} accessibilityRole="button">
                    <Row gap={6}>
                      <Txt variant="meta" color={colors.indigo} style={{ fontFamily: fonts.bold }}>
                        Open this booking
                      </Txt>
                      <TravelIcon name="arrowRight" size={11} color={colors.indigo} weight={2.2} />
                    </Row>
                  </Pressable>
                </Animated.View>
              ) : (
                <Row gap={5} style={{ marginTop: 7 }}>
                  <Txt variant="meta" color={colors.indigo} style={{ fontFamily: fonts.bold }}>
                    Why is this affected?
                  </Txt>
                  <TravelIcon name="chevron" size={11} color={colors.indigo} weight={2.2} />
                </Row>
              )}
            </View>
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  alertWrap: { position: 'relative' },
  shock: {
    position: 'absolute',
    left: '18%',
    top: '22%',
    width: 170,
    height: 170,
    borderRadius: 90,
    backgroundColor: colors.coralInk,
  },
  slot: { flex: 1, backgroundColor: colors.haze, borderRadius: radius.sm, padding: space(2.5) },
  link: { flexDirection: 'row', gap: space(3) },
  rail: { width: 14, alignItems: 'center' },
  railDot: { width: 11, height: 11, borderRadius: 6, marginTop: 5 },
  railLine: { flex: 1, width: 2, opacity: 0.26, marginTop: 4, borderRadius: 1 },
  reason: { marginTop: space(3), padding: space(3.5), borderRadius: radius.md },
});
