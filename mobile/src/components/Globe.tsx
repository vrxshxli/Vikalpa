/**
 * Interactive globe.
 *
 * A real orthographic projection — drag to rotate the earth, and the landmasses,
 * graticule, route arcs and event markers all reproject together. Styled as a
 * printed travel atlas rather than a mission-control display: paper ocean,
 * sand-coloured land, hairline meridians.
 *
 * Coastlines are deliberately coarse (a few dozen points per continent). At this
 * size more detail would read as noise, and it keeps the whole thing dependency
 * free.
 */
import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import Svg, { Circle, Defs, G, Path, RadialGradient, Stop } from 'react-native-svg';

import { colors } from '@/theme';
import { Eyebrow } from '@/components/primitives';

/* ------------------------------------------------------------------ */
/* Coarse coastlines, [lon, lat]                                       */
/* ------------------------------------------------------------------ */

type Ring = [number, number][];

const LAND: Ring[] = [
  // Africa
  [
    [-17, 15], [-16, 20], [-10, 26], [0, 31], [10, 33], [20, 32], [32, 31], [34, 28],
    [37, 22], [39, 15], [43, 11], [51, 12], [48, 5], [41, -1], [40, -10], [35, -18],
    [32, -25], [28, -33], [20, -34], [18, -33], [14, -23], [12, -16], [9, -5], [10, 3],
    [5, 5], [-3, 5], [-8, 4], [-13, 9],
  ],
  // Eurasia
  [
    [-10, 36], [-9, 43], [0, 49], [4, 52], [9, 54], [13, 55], [20, 55], [28, 60],
    [30, 62], [25, 66], [30, 70], [45, 68], [60, 70], [75, 73], [90, 76], [105, 77],
    [115, 73], [130, 71], [140, 72], [160, 69], [175, 66], [170, 60], [160, 57],
    [145, 55], [140, 50], [132, 45], [127, 38], [122, 31], [120, 25], [110, 20],
    [105, 10], [100, 6], [95, 15], [90, 22], [80, 15], [77, 8], [72, 20], [68, 24],
    [62, 25], [58, 22], [52, 18], [45, 13], [43, 12], [36, 28], [34, 31], [30, 31],
    [28, 36], [23, 36], [18, 40], [12, 38], [8, 44], [3, 42], [-2, 37], [-6, 36],
  ],
  // North America
  [
    [-168, 66], [-160, 71], [-140, 70], [-125, 70], [-110, 68], [-95, 68], [-85, 70],
    [-75, 68], [-65, 60], [-55, 52], [-60, 46], [-70, 42], [-75, 35], [-81, 26],
    [-84, 30], [-90, 29], [-97, 26], [-105, 20], [-97, 16], [-92, 15], [-87, 13],
    [-83, 9], [-80, 9], [-85, 15], [-95, 17], [-110, 24], [-117, 32], [-124, 40],
    [-124, 48], [-135, 57], [-150, 60], [-165, 60],
  ],
  // South America
  [
    [-81, -4], [-79, 2], [-75, 9], [-70, 12], [-62, 10], [-52, 5], [-50, 0], [-44, -2],
    [-38, -6], [-35, -8], [-39, -15], [-48, -25], [-53, -34], [-58, -38], [-62, -40],
    [-65, -45], [-68, -50], [-70, -55], [-75, -52], [-74, -45], [-73, -35], [-71, -25],
    [-70, -18], [-76, -14], [-81, -6],
  ],
  // Australia
  [
    [113, -22], [114, -27], [118, -34], [129, -32], [137, -35], [141, -38], [148, -38],
    [153, -28], [153, -25], [146, -19], [142, -11], [136, -12], [130, -11], [125, -14],
    [122, -18],
  ],
  // Greenland
  [
    [-45, 60], [-50, 66], [-55, 70], [-60, 76], [-50, 82], [-30, 83], [-20, 78],
    [-22, 70], [-32, 65], [-42, 60],
  ],
  // British Isles
  [[-10, 51], [-6, 55], [-5, 58], [-2, 58], [0, 53], [-3, 51], [-5, 50]],
  // Japan
  [[130, 31], [135, 34], [140, 38], [142, 43], [145, 44], [141, 41], [137, 36], [132, 33]],
  // Madagascar
  [[43, -12], [50, -15], [50, -25], [45, -25], [43, -18]],
  // New Zealand
  [[173, -35], [178, -38], [174, -42], [168, -46], [166, -45], [171, -41]],
];

/* ------------------------------------------------------------------ */
/* Orthographic projection                                             */
/* ------------------------------------------------------------------ */

const RAD = Math.PI / 180;

interface Rotation {
  lon: number;
  lat: number;
}

function project(
  lon: number,
  lat: number,
  rotation: Rotation,
  r: number,
  cx: number,
  cy: number,
): { x: number; y: number; visible: boolean } {
  const p = lat * RAD;
  const l = (lon - rotation.lon) * RAD;
  const p0 = rotation.lat * RAD;
  const cosc = Math.sin(p0) * Math.sin(p) + Math.cos(p0) * Math.cos(p) * Math.cos(l);
  return {
    x: cx + r * Math.cos(p) * Math.sin(l),
    y: cy - r * (Math.cos(p0) * Math.sin(p) - Math.sin(p0) * Math.cos(p) * Math.cos(l)),
    visible: cosc >= 0,
  };
}

/** Projects a ring, breaking it into the runs that face the viewer. */
function ringToPaths(ring: Ring, rotation: Rotation, r: number, cx: number, cy: number): string[] {
  const paths: string[] = [];
  let current: string[] = [];
  const closed = [...ring, ring[0]];

  for (const [lon, lat] of closed) {
    const p = project(lon, lat, rotation, r, cx, cy);
    if (p.visible) {
      current.push(`${current.length === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`);
    } else if (current.length > 1) {
      paths.push(current.join(' '));
      current = [];
    } else {
      current = [];
    }
  }
  if (current.length > 1) paths.push(current.join(' '));
  return paths;
}

/** Great-circle samples between two points, for route arcs. */
function greatCircle(a: [number, number], b: [number, number], steps = 48): Ring {
  const [lon1, lat1] = [a[0] * RAD, a[1] * RAD];
  const [lon2, lat2] = [b[0] * RAD, b[1] * RAD];
  const d =
    2 *
    Math.asin(
      Math.sqrt(
        Math.sin((lat2 - lat1) / 2) ** 2 +
          Math.cos(lat1) * Math.cos(lat2) * Math.sin((lon2 - lon1) / 2) ** 2,
      ),
    );
  if (d === 0) return [a, b];
  const out: Ring = [];
  for (let i = 0; i <= steps; i += 1) {
    const f = i / steps;
    const A = Math.sin((1 - f) * d) / Math.sin(d);
    const B = Math.sin(f * d) / Math.sin(d);
    const x = A * Math.cos(lat1) * Math.cos(lon1) + B * Math.cos(lat2) * Math.cos(lon2);
    const y = A * Math.cos(lat1) * Math.sin(lon1) + B * Math.cos(lat2) * Math.sin(lon2);
    const z = A * Math.sin(lat1) + B * Math.sin(lat2);
    out.push([Math.atan2(y, x) / RAD, Math.atan2(z, Math.sqrt(x * x + y * y)) / RAD]);
  }
  return out;
}

function graticule(): Ring[] {
  const rings: Ring[] = [];
  for (let lat = -60; lat <= 60; lat += 30) {
    const ring: Ring = [];
    for (let lon = -180; lon <= 180; lon += 10) ring.push([lon, lat]);
    rings.push(ring);
  }
  for (let lon = -180; lon < 180; lon += 30) {
    const ring: Ring = [];
    for (let lat = -80; lat <= 80; lat += 10) ring.push([lon, lat]);
    rings.push(ring);
  }
  return rings;
}

const GRATICULE = graticule();

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export interface GlobeMarker {
  id: string;
  lon: number;
  lat: number;
  label: string;
  tint: string;
  /** Marks a marker connected to the trip — drawn larger with a halo. */
  connected: boolean;
}

export function Globe({
  size,
  markers,
  route,
  selectedId,
  onSelect,
}: {
  size: number;
  markers: GlobeMarker[];
  /** Ordered waypoints of the trip, [lon, lat]. */
  route: [number, number][];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
}) {
  const r = size / 2 - 6;
  const cx = size / 2;
  const cy = size / 2;

  // Start looking at the middle of the demo route.
  const [rotation, setRotation] = useState<Rotation>({ lon: 40, lat: 22 });
  const [start, setStart] = useState<Rotation>({ lon: 40, lat: 22 });

  const pan = Gesture.Pan()
    .onBegin(() => {
      runOnJS(setStart)(rotation);
    })
    .onUpdate((e) => {
      // Path geometry is recomputed in JS, so rotation lives in React state.
      runOnJS(setRotation)({
        lon: start.lon - e.translationX * 0.32,
        lat: Math.max(-75, Math.min(75, start.lat + e.translationY * 0.28)),
      });
    });

  const landPaths = useMemo(
    () => LAND.flatMap((ring) => ringToPaths(ring, rotation, r, cx, cy)),
    [rotation, r, cx, cy],
  );

  const gridPaths = useMemo(
    () => GRATICULE.flatMap((ring) => ringToPaths(ring, rotation, r, cx, cy)),
    [rotation, r, cx, cy],
  );

  const routePaths = useMemo(() => {
    const legs: string[] = [];
    for (let i = 0; i < route.length - 1; i += 1) {
      legs.push(...ringToPaths(greatCircle(route[i], route[i + 1]), rotation, r, cx, cy));
    }
    return legs;
  }, [route, rotation, r, cx, cy]);

  const placedMarkers = useMemo(
    () =>
      markers
        .map((m) => ({ marker: m, point: project(m.lon, m.lat, rotation, r, cx, cy) }))
        .filter((m) => m.point.visible),
    [markers, rotation, r, cx, cy],
  );

  return (
    <View style={{ width: size, height: size }}>
      <GestureDetector gesture={pan}>
        <View collapsable={false}>
          <Svg width={size} height={size}>
            <Defs>
              <RadialGradient id="ocean" cx="35%" cy="30%" r="80%">
                <Stop offset="0" stopColor="#F3F7FF" />
                <Stop offset="0.7" stopColor="#DCE8FA" />
                <Stop offset="1" stopColor="#C3D2F2" />
              </RadialGradient>
            </Defs>

            <Circle cx={cx} cy={cy} r={r} fill="url(#ocean)" stroke={colors.periMid} strokeWidth={1.4} />

            <G opacity={0.5}>
              {gridPaths.map((d, i) => (
                <Path key={`g-${i}`} d={d} stroke={colors.periMid} strokeWidth={0.6} fill="none" opacity={0.7} />
              ))}
            </G>

            {landPaths.map((d, i) => (
              <Path
                key={`l-${i}`}
                d={d}
                fill={colors.periSoft}
                stroke={colors.lilac}
                strokeWidth={0.9}
                strokeLinejoin="round"
              />
            ))}

            {routePaths.map((d, i) => (
              <Path
                key={`r-${i}`}
                d={d}
                stroke={colors.indigo}
                strokeWidth={2}
                fill="none"
                strokeLinecap="round"
                strokeDasharray="5 4"
              />
            ))}

            {placedMarkers.map(({ marker, point }) => (
              <G key={marker.id}>
                {marker.connected ? (
                  <Circle cx={point.x} cy={point.y} r={12} fill={marker.tint} opacity={0.16} />
                ) : null}
                <Circle
                  cx={point.x}
                  cy={point.y}
                  r={marker.connected ? 5.5 : 3.5}
                  fill={selectedId === marker.id ? marker.tint : colors.cloud}
                  stroke={marker.tint}
                  strokeWidth={marker.connected ? 2.2 : 1.6}
                />
              </G>
            ))}
          </Svg>

          {/* Hit targets, so a marker can be tapped without fighting the pan. */}
          {placedMarkers.map(({ marker, point }) => (
            <Pressable
              key={`hit-${marker.id}`}
              onPress={() => onSelect?.(marker.id)}
              hitSlop={6}
              style={[styles.hit, { left: point.x - 16, top: point.y - 16 }]}
            />
          ))}
        </View>
      </GestureDetector>

      <View style={styles.hint} pointerEvents="none">
        <Eyebrow color={colors.inkFaint}>Drag to rotate</Eyebrow>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hit: { position: 'absolute', width: 32, height: 32, borderRadius: 16 },
  hint: { position: 'absolute', bottom: 0, alignSelf: 'center' },
});
