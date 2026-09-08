/**
 * SCREEN 2 — Digital twin.
 *
 * The itinerary becomes a miniature paper model you can pick up: pinch, drag,
 * tap a card. The point is recognition — "this is my trip, and I can see what
 * holds it together".
 */
import React, { useEffect, useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';

import { colors, gutter, space } from '@/theme';
import { Loading, Row, StatTile, Txt } from '@/components/primitives';
import { TripGraph } from '@/components/TripGraph';
import { NodeSheet } from '@/components/travel/NodeSheet';
import { TravelIcon } from '@/components/travel/TravelIcon';
import { useTrip } from '@/state/store';
import type { TripNode } from '@/types/domain';

export function TwinSegment() {
  const { width } = useWindowDimensions();
  const trip = useTrip((s) => s.overview?.trip ?? null);
  const cascade = useTrip((s) => s.cascade);
  const selectedNodeId = useTrip((s) => s.selectedNodeId);
  const selectNode = useTrip((s) => s.selectNode);
  const loadGraph = useTrip((s) => s.loadGraph);
  const graph = useTrip((s) => s.graph);

  const [sheetNode, setSheetNode] = useState<TripNode | null>(null);

  useEffect(() => {
    if (!graph) void loadGraph();
  }, [graph, loadGraph]);

  if (!trip) return <Loading label="Building the model" icon="route" />;

  /* Cascade order drives the ripple that travels the route strings. */
  const rippleOrder = cascade
    ? [...cascade.impacts]
        .filter((i) => i.status !== 'SAFE')
        .sort((a, b) => a.hops - b.hops)
        .map((i) => i.nodeId)
    : undefined;

  const unwell = trip.nodes.filter((n) => n.status !== 'SAFE' && n.status !== 'COMPLETED').length;

  return (
    <View style={styles.root}>
      <View style={[styles.intro, { paddingHorizontal: gutter(width) }]}>
        <Row gap={space(2)}>
          <StatTile label="Bookings" value={String(trip.nodes.length)} icon="ticket" />
          <StatTile label="Dependencies" value={String(trip.edges.length)} icon="route" />
          <StatTile
            label={unwell ? 'Not healthy' : 'All healthy'}
            value={unwell ? String(unwell) : 'None'}
            tint={unwell ? colors.coralInk : colors.indigo}
            icon={unwell ? 'warning' : 'shield'}
          />
        </Row>
        <Row gap={7} style={{ marginTop: space(3) }}>
          <TravelIcon name="compass" size={12} color={colors.inkFaint} weight={1.8} />
          <Txt variant="meta" color={colors.inkMuted} style={{ flex: 1 }}>
            Pinch to zoom · drag to pan · double-tap to recentre · tap a card to open it
          </Txt>
        </Row>
      </View>

      <TripGraph
        nodes={trip.nodes}
        edges={trip.edges}
        selectedId={selectedNodeId}
        onSelect={(node) => {
          selectNode(node.id);
          setSheetNode(node);
        }}
        onInspect={(node) => {
          selectNode(node.id);
          setSheetNode(node);
        }}
        rippleOrder={rippleOrder}
        rippleKey={cascade?.computedAt}
      />

      <NodeSheet node={sheetNode} onClose={() => setSheetNode(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.mist },
  intro: { paddingTop: space(4), paddingBottom: space(3) },
});
