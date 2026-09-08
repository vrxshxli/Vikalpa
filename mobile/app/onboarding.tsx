/**
 * Onboarding — three panels.
 *
 * Each panel is a clean scene photograph with the copy below it. Nothing is
 * drawn on top of the image: the diagrams and the icon badge that used to sit
 * over it were competing with the picture rather than adding to it.
 *
 * The sky follows the story: dawn while you are being introduced, overcast
 * when something breaks, dusk once there is a way through. Same mapping the
 * live masthead uses for trip phase.
 */
import React, { useRef, useState } from 'react';
import { Dimensions, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { router } from 'expo-router';

import { colors, motion, paper, radius, space } from '@/theme';
import { Button, Eyebrow, Row, Txt } from '@/components/primitives';
import { Scene, SceneBackdrop, type SceneVariant } from '@/components/scene/Scene';
import { VikalpaMark } from '@/components/brand/Logo';

const { width } = Dimensions.get('window');

const PANELS: {
  marker: string;
  title: string;
  body: string;
  scene: SceneVariant;
}[] = [
  {
    marker: 'Chapter one',
    title: 'Your trip is more than a booking.',
    body: 'Flights, transfers, stays and experiences hold each other up. VIKALPA reads your itinerary as one connected structure.',
    // First light — the trip has not started yet.
    scene: 'dawn',
  },
  {
    marker: 'Chapter three',
    title: 'When one thing changes, we know what happens next.',
    body: 'A delayed flight is not one problem. We trace it through every booking that depends on it, and tell you exactly what breaks.',
    // Weather closing in, calm rather than frightening.
    scene: 'storm',
  },
  {
    marker: 'Chapter four',
    title: 'VIKALPA finds another way.',
    body: 'Real alternatives, checked against travel time, opening hours, availability and your own priorities. Then ranked, and explained.',
    // Peaks above the cloud — the way through.
    scene: 'dusk',
  },
];

export default function Onboarding() {
  const [page, setPage] = useState(0);
  const scroller = useRef<ScrollView>(null);
  const last = page === PANELS.length - 1;

  const go = (next: number) => {
    setPage(next);
    scroller.current?.scrollTo({ x: next * width, animated: true });
  };

  return (
    <View style={styles.root}>
      {/* The page's own sky follows the panel you are on. */}
      <SceneBackdrop variant={PANELS[page]?.scene ?? 'dawn'} />

      <Row justify="space-between" style={styles.top}>
        <Row gap={6}>
          <VikalpaMark size={18} />
          <Eyebrow color={colors.indigo} style={{ letterSpacing: 2.2 }}>
            VIKALPA
          </Eyebrow>
        </Row>
        <Pressable
          onPress={() => router.replace('/login')}
          hitSlop={14}
          accessibilityRole="button"
          accessibilityLabel="Skip introduction"
        >
          <Eyebrow color={colors.inkMuted}>Skip</Eyebrow>
        </Pressable>
      </Row>

      <ScrollView
        ref={scroller}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / width))}
        style={{ flex: 1 }}
      >
        {PANELS.map((panel) => (
          <View key={panel.title} style={[styles.panel, { width }]}>
            {/* The image, and nothing over it. */}
            <Animated.View entering={FadeIn.delay(100).duration(motion.page)} style={styles.artFrame}>
              <Scene
                variant={panel.scene}
                width={860}
                overlay={false}
                style={styles.artScene}
                radiusStyle={{ borderRadius: radius.xl }}
              />
            </Animated.View>

            <Animated.View entering={FadeInDown.delay(190).duration(motion.page)}>
              <Eyebrow color={colors.indigo}>{panel.marker}</Eyebrow>
              <Txt variant="chapter" accessibilityRole="header" style={{ marginTop: space(3) }}>
                {panel.title}
              </Txt>
              <Txt variant="body" color={colors.inkMuted} style={{ marginTop: space(3.5) }}>
                {panel.body}
              </Txt>
            </Animated.View>
          </View>
        ))}
      </ScrollView>

      <View style={styles.bottom}>
        <Row gap={7} style={{ marginBottom: space(5) }}>
          {PANELS.map((_, i) => (
            <Pressable
              key={i}
              onPress={() => go(i)}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel={`Page ${i + 1}`}
            >
              <View style={[styles.dot, i === page && { width: 24, backgroundColor: colors.indigo }]} />
            </Pressable>
          ))}
        </Row>
        <Button
          label={last ? 'Start the journey' : 'Next'}
          icon={last ? 'plane' : 'arrowRight'}
          onPress={() => (last ? router.replace('/login') : go(page + 1))}
          size="large"
          style={{ alignSelf: 'stretch' }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.mist },
  top: { paddingHorizontal: space(6), paddingTop: space(14), paddingBottom: space(2) },
  panel: { paddingHorizontal: space(6), paddingTop: space(4), justifyContent: 'center', flex: 1 },
  /* Full content width now that it is the panel's hero, not a backdrop. */
  artFrame: {
    width: '100%',
    height: 244,
    borderRadius: radius.xl,
    overflow: 'hidden',
    backgroundColor: colors.periSoft,
    marginBottom: space(8),
    ...paper.lifted,
  },
  artScene: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  bottom: { paddingHorizontal: space(6), paddingBottom: space(12), alignItems: 'flex-start' },
  dot: { width: 7, height: 7, borderRadius: radius.pill, backgroundColor: colors.ruleStrong },
});
