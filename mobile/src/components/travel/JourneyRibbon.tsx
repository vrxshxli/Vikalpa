/**
 * JourneyRibbon — the trip, in miniature.
 *
 * The one component that appears on nearly every screen, so wherever you are
 * you can still see the whole journey. Two readings of the same data:
 *
 *   cities   MUMBAI ✈ DUBAI ✈ PARIS       (where am I going)
 *   bookings Flight ↓ Hotel ↓ Cruise      (what holds it together)
 *
 * Node colour always comes from booking status, so the ribbon doubles as a
 * health bar for the trip.
 */
import React, { memo, useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Line } from 'react-native-svg';

import { colors, radius, space, statusStyle, touch, type } from '@/theme';
import { TravelIcon, kindIcon } from '@/components/travel/TravelIcon';
import { clock, shortDate } from '@/utils/format';
import type { TripNode } from '@/types/domain';

/* ------------------------------------------------------------------ */
/* Route connector                                                    */
/* ------------------------------------------------------------------ */

/**
 * The dotted line between two stops, with the mode of travel sitting on it.
 * Solid when the leg is healthy, dashed-and-tinted when it is not.
 */
export const RouteConnector = memo(function RouteConnector({
  orientation = 'vertical',
  length = 34,
  tint = colors.ruleStrong,
  dashed = true,
  icon,
  iconTint,
}: {
  orientation?: 'vertical' | 'horizontal';
  length?: number;
  tint?: string;
  dashed?: boolean;
  icon?: React.ComponentProps<typeof TravelIcon>['name'];
  iconTint?: string;
}) {
  const vertical = orientation === 'vertical';
  const w = vertical ? 18 : length;
  const h = vertical ? length : 18;

  return (
    <View style={{ width: w, height: h, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={w} height={h}>
        <Line
          x1={vertical ? w / 2 : 0}
          y1={vertical ? 0 : h / 2}
          x2={vertical ? w / 2 : length}
          y2={vertical ? length : h / 2}
          stroke={tint}
          strokeWidth={1.6}
          strokeDasharray={dashed ? '2.5 3.5' : undefined}
          strokeLinecap="round"
        />
      </Svg>
      {icon ? (
        <View style={[styles.connectorIcon, { backgroundColor: colors.mist }]}>
          <TravelIcon name={icon} size={13} color={iconTint ?? tint} weight={1.6} />
        </View>
      ) : null}
    </View>
  );
});

/* ------------------------------------------------------------------ */
/* Ribbon                                                            */
/* ------------------------------------------------------------------ */

interface Stop {
  key: string;
  label: string;
  sub?: string;
  status: string;
  icon: React.ComponentProps<typeof TravelIcon>['name'];
  nodeId?: string;
}

/** Collapses the itinerary into inter-city hops. */
function cityStops(nodes: TripNode[]): Stop[] {
  const legs = nodes
    .filter((n) => n.from && n.to && n.from.city !== n.to.city)
    .sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
  if (!legs.length) return [];

  const stops: Stop[] = [
    {
      key: 'origin',
      label: legs[0].from!.city,
      sub: shortDate(legs[0].start),
      status: 'SAFE',
      icon: 'pin',
    },
  ];
  for (const leg of legs) {
    stops.push({
      key: leg.id,
      label: leg.to!.city,
      sub: shortDate(leg.end),
      status: leg.status,
      icon: kindIcon[leg.kind] ?? 'pin',
      nodeId: leg.id,
    });
  }
  return stops;
}

function bookingStops(nodes: TripNode[]): Stop[] {
  return [...nodes]
    .sort((a, b) => Date.parse(a.start) - Date.parse(b.start))
    .map((n) => ({
      key: n.id,
      label: n.title,
      sub: `${shortDate(n.start)} · ${clock(n.start)}`,
      status: n.status,
      icon: kindIcon[n.kind] ?? 'pin',
      nodeId: n.id,
    }));
}

export function JourneyRibbon({
  nodes,
  variant = 'cities',
  orientation = 'horizontal',
  onPressNode,
  activeNodeId,
  style,
  compact,
}: {
  nodes: TripNode[];
  variant?: 'cities' | 'bookings';
  orientation?: 'horizontal' | 'vertical';
  onPressNode?: (nodeId: string) => void;
  activeNodeId?: string | null;
  style?: StyleProp<ViewStyle>;
  compact?: boolean;
}) {
  const stops = useMemo(
    () => (variant === 'cities' ? cityStops(nodes) : bookingStops(nodes)),
    [nodes, variant],
  );

  if (!stops.length) return null;

  /* ---------------- horizontal ---------------- */
  if (orientation === 'horizontal') {
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={style}
        contentContainerStyle={styles.hRow}
        accessibilityLabel={`Journey: ${stops.map((s) => s.label).join(' to ')}`}
      >
        {stops.map((stop, i) => {
          const s = statusStyle(stop.status);
          const active = activeNodeId && stop.nodeId === activeNodeId;
          return (
            <React.Fragment key={stop.key}>
              {i > 0 ? (
                <RouteConnector
                  orientation="horizontal"
                  length={compact ? 26 : 38}
                  tint={s.ink}
                  dashed={stop.status !== 'SAFE'}
                  icon={stop.icon}
                  iconTint={s.ink}
                />
              ) : null}
              <Pressable
                disabled={!onPressNode || !stop.nodeId}
                onPress={() => stop.nodeId && onPressNode?.(stop.nodeId)}
                accessibilityRole={onPressNode ? 'button' : undefined}
                accessibilityLabel={`${stop.label}${stop.sub ? `, ${stop.sub}` : ''}`}
                style={styles.tapTarget}
              >
                <View style={styles.hStop}>
                  <View
                    style={[
                      styles.dot,
                      { borderColor: s.ink, backgroundColor: active ? s.ink : colors.cloud },
                    ]}
                  />
                  <Text style={[type.stamp, { color: active ? colors.ink : colors.inkSoft, marginTop: 5 }]} numberOfLines={1}>
                    {stop.label.toUpperCase()}
                  </Text>
                  {!compact && stop.sub ? (
                    <Text style={[type.meta, { color: colors.inkFaint, fontSize: 10.5 }]} numberOfLines={1}>
                      {stop.sub}
                    </Text>
                  ) : null}
                </View>
              </Pressable>
            </React.Fragment>
          );
        })}
      </ScrollView>
    );
  }

  /* ---------------- vertical ---------------- */
  return (
    <View style={style} accessibilityLabel={`Journey: ${stops.map((s) => s.label).join(', then ')}`}>
      {stops.map((stop, i) => {
        const s = statusStyle(stop.status);
        const active = activeNodeId && stop.nodeId === activeNodeId;
        return (
          <View key={stop.key}>
            {i > 0 ? (
              <View style={styles.vConnector}>
                <RouteConnector
                  orientation="vertical"
                  length={compact ? 22 : 32}
                  tint={s.ink}
                  dashed={stop.status !== 'SAFE'}
                  icon={stop.icon}
                  iconTint={s.ink}
                />
              </View>
            ) : null}
            <Pressable
              disabled={!onPressNode || !stop.nodeId}
              onPress={() => stop.nodeId && onPressNode?.(stop.nodeId)}
              accessibilityRole={onPressNode ? 'button' : undefined}
              accessibilityLabel={`${stop.label}${stop.sub ? `, ${stop.sub}` : ''}`}
              style={styles.tapTarget}
            >
              <View style={styles.vStop}>
                <View
                  style={[
                    styles.dot,
                    { borderColor: s.ink, backgroundColor: active ? s.ink : colors.cloud },
                  ]}
                />
                <View style={{ flex: 1 }}>
                  <Text style={[type.h3, { color: colors.ink, fontSize: 14.5 }]} numberOfLines={1}>
                    {stop.label}
                  </Text>
                  {stop.sub ? (
                    <Text style={[type.meta, { color: colors.inkFaint }]} numberOfLines={1}>
                      {stop.sub}
                    </Text>
                  ) : null}
                </View>
                {stop.status !== 'SAFE' ? (
                  <Text style={[type.stamp, { color: s.ink }]}>{s.label.toUpperCase()}</Text>
                ) : null}
              </View>
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  /* On the Pressable itself — a minimum on the child does not raise the
     button's own box, and the button is what a screen reader targets. */
  tapTarget: { minHeight: touch.min, justifyContent: 'center' },
  hRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: space(1) },
  hStop: { alignItems: 'center', justifyContent: 'center', minWidth: 62, maxWidth: 92, minHeight: 44, paddingVertical: 4 },
  vConnector: { paddingLeft: 5 },
  vStop: { flexDirection: 'row', alignItems: 'center', gap: space(3), minHeight: touch.min, paddingVertical: 2 },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
  },
  connectorIcon: {
    position: 'absolute',
    paddingHorizontal: 2.5,
    paddingVertical: 1.5,
    borderRadius: radius.xs,
  },
});
