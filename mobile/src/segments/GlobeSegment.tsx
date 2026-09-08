/**
 * SCREEN 23 — World intelligence.
 *
 * A printed atlas rather than a control room: paper ocean, cream landmasses,
 * hairline meridians, your route drawn as a dashed flight path. Drag to rotate
 * — it is a real orthographic projection, reprojected as you turn it.
 *
 * Supplementary by design. It gives spatial context to signals that already
 * appear in the monitor, and it always answers one question: does this matter
 * to MY journey?
 */
import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import { colors, gutter, mood, motion, severityMood, space } from '@/theme';
import {
  Button,
  ChapterHeader,
  Divider,
  Eyebrow,
  Loading,
  Pill,
  Row,
  RiskBadge,
  ScreenScaffold,
  Txt,
} from '@/components/primitives';
import { PaperCard, Stamp } from '@/components/travel/paper';
import { Globe, type GlobeMarker } from '@/components/Globe';
import { JourneyRibbon } from '@/components/travel/JourneyRibbon';
import { TravelIcon, signalIcon } from '@/components/travel/TravelIcon';
import { useTrip } from '@/state/store';

export function GlobeSegment({ onOpenMonitor }: { onOpenMonitor: () => void }) {
  const { width } = useWindowDimensions();
  const signals = useTrip((s) => s.signals);
  const trip = useTrip((s) => s.overview?.trip ?? null);
  const loadSignals = useTrip((s) => s.loadSignals);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (!signals) void loadSignals();
  }, [signals, loadSignals]);

  const markers: GlobeMarker[] = useMemo(
    () =>
      (signals?.signals ?? []).map((signal) => ({
        id: signal.id,
        lon: signal.place.lon,
        lat: signal.place.lat,
        label: signal.headline,
        tint: mood[severityMood[signal.severity]].ink,
        connected: signal.relatedNodeIds.length > 0,
      })),
    [signals],
  );

  /* The trip's own path: origin, then every inter-city arrival. */
  const route: [number, number][] = useMemo(() => {
    if (!trip) return [];
    const legs = trip.nodes
      .filter((n) => n.from && n.to && n.from.city !== n.to.city)
      .sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
    if (!legs.length) return [];
    const points: [number, number][] = [[legs[0].from!.lon, legs[0].from!.lat]];
    for (const leg of legs) points.push([leg.to!.lon, leg.to!.lat]);
    return points;
  }, [trip]);

  if (!signals || !trip) return <Loading label="Turning the globe" icon="globe" />;

  const selected = signals.signals.find((s) => s.id === selectedId) ?? null;
  const connected = signals.signals.filter((s) => s.relatedNodeIds.length > 0);
  const nodeName = (id: string) => trip.nodes.find((n) => n.id === id)?.title ?? id;
  const globeSize = Math.min(width - gutter(width) * 2 - space(8), 330);

  return (
    <ScreenScaffold>
      <ChapterHeader
        marker="Chapter nine · world intelligence"
        title="Your route, and the world around it."
        standfirst={`${connected.length} of ${signals.signals.length} events sit on your path. Drag the globe, then tap a marker.`}
        scene="sea"
      />

      <PaperCard depth="held" style={{ alignItems: 'center', paddingVertical: space(5) }} tinted={colors.haze}>
        <Globe size={globeSize} markers={markers} route={route} selectedId={selectedId} onSelect={setSelectedId} />

        <Row gap={space(4)} style={{ marginTop: space(5) }} wrap justify="center">
          <Row gap={6}>
            <View style={styles.keyDash} />
            <Eyebrow color={colors.inkMuted}>Your route</Eyebrow>
          </Row>
          <Row gap={6}>
            <View style={[styles.keyDot, { backgroundColor: colors.coralInk }]} />
            <Eyebrow color={colors.inkMuted}>On your trip</Eyebrow>
          </Row>
          <Row gap={6}>
            <View style={[styles.keyRing, { borderColor: colors.inkMuted }]} />
            <Eyebrow color={colors.inkMuted}>Background</Eyebrow>
          </Row>
        </Row>
      </PaperCard>

      {/* the route, legible without the globe */}
      {route.length ? (
        <PaperCard depth="flat" tinted={colors.haze} style={{ marginTop: space(4) }}>
          <Eyebrow>Your path</Eyebrow>
          <JourneyRibbon nodes={trip.nodes} variant="cities" orientation="horizontal" style={{ marginTop: space(3) }} />
        </PaperCard>
      ) : null}

      {selected ? (
        <Animated.View entering={FadeInDown.duration(motion.settle)} style={{ marginTop: space(4) }}>
          <PaperCard
            depth="lifted"
            accent={selected.relatedNodeIds.length ? mood[severityMood[selected.severity]].ink : colors.ruleStrong}
          >
            <Row justify="space-between" align="flex-start">
              <Row gap={space(3)} style={{ flex: 1, paddingRight: space(2) }} align="flex-start">
                <View
                  style={[styles.glyph, { backgroundColor: mood[severityMood[selected.severity]].fill }]}
                >
                  <TravelIcon
                    name={signalIcon[selected.kind] ?? 'signal'}
                    size={17}
                    color={mood[severityMood[selected.severity]].ink}
                    weight={1.7}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Eyebrow>{selected.kind.toLowerCase()}</Eyebrow>
                  <Txt variant="h3" style={{ marginTop: 4 }}>
                    {selected.headline}
                  </Txt>
                  <Row gap={5} style={{ marginTop: 3 }}>
                    <TravelIcon name="pin" size={10} color={colors.inkFaint} weight={1.9} />
                    <Txt variant="meta" color={colors.inkMuted}>
                      {selected.place.name}, {selected.place.country}
                    </Txt>
                  </Row>
                </View>
              </Row>
              <RiskBadge severity={selected.severity} />
            </Row>

            <Row style={{ marginTop: space(3.5) }}>
              {selected.relatedNodeIds.length ? (
                <Stamp
                  label="Connected to your trip"
                  tint={colors.coralInk}
                  fill={colors.coralSoft}
                  rotate={-5}
                  icon={<TravelIcon name="route" size={10} color={colors.coralInk} weight={2.2} />}
                />
              ) : (
                <Stamp label="Not on your trip" tint={colors.inkFaint} rotate={-4} />
              )}
            </Row>

            <Txt variant="small" color={colors.inkSoft} style={{ marginTop: space(3.5) }}>
              {selected.body}
            </Txt>

            <Divider dashed style={{ marginVertical: space(3.5) }} />

            <Row gap={space(2)} align="flex-start">
              <TravelIcon
                name="arrowRight"
                size={13}
                color={selected.relatedNodeIds.length ? mood[severityMood[selected.severity]].ink : colors.inkFaint}
                weight={2}
                style={{ marginTop: 3 }}
              />
              <View style={{ flex: 1 }}>
                <Eyebrow color={selected.relatedNodeIds.length ? mood[severityMood[selected.severity]].ink : colors.inkFaint}>
                  What this means for your trip
                </Eyebrow>
                <Txt variant="body" style={{ marginTop: space(1.5) }}>
                  {selected.tripImpact}
                </Txt>
              </View>
            </Row>

            {selected.relatedNodeIds.length ? (
              <Row gap={space(2)} wrap style={{ marginTop: space(3.5) }}>
                {selected.relatedNodeIds.map((id) => (
                  <Pill key={id} label={nodeName(id)} icon="pin" fg={colors.indigo} bg={colors.periSoft} />
                ))}
              </Row>
            ) : null}
          </PaperCard>
        </Animated.View>
      ) : (
        <Animated.View entering={FadeIn} style={{ marginTop: space(4) }}>
          <PaperCard depth="flat" tinted={colors.haze}>
            <Row gap={space(2.5)} align="flex-start">
              <TravelIcon name="binoculars" size={16} color={colors.inkMuted} weight={1.7} />
              <View style={{ flex: 1 }}>
                <Txt variant="small" color={colors.inkMuted}>
                  Tap a marker to read what it does to your itinerary. The globe is context — recovery works from the
                  monitor and your bookings, never from this map.
                </Txt>
                <Button
                  label="Go to the live monitor"
                  variant="secondary"
                  icon="signal"
                  onPress={onOpenMonitor}
                  style={{ marginTop: space(4), alignSelf: 'flex-start' }}
                />
              </View>
            </Row>
          </PaperCard>
        </Animated.View>
      )}
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  glyph: { width: 36, height: 36, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  keyDash: { width: 18, height: 0, borderTopWidth: 2, borderStyle: 'dashed', borderColor: colors.indigo },
  keyDot: { width: 10, height: 10, borderRadius: 5 },
  keyRing: { width: 9, height: 9, borderRadius: 5, borderWidth: 1.6 },
});
