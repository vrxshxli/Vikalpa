/**
 * ChapterRail — horizontal paging between the layers of one subject.
 *
 * Replaces a tab bar with something closer to the edge of a notebook: each
 * layer is a chapter of the same itinerary, and the marker slides along a
 * printed rule as you swipe. Vertical scrolling stays inside a chapter, so the
 * two axes never fight.
 */
import React, { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';

import { colors, space, type } from '@/theme';
import { TravelIcon, type IconName } from '@/components/travel/TravelIcon';
import * as haptic from '@/utils/haptics';

export interface Chapter {
  key: string;
  label: string;
  icon?: IconName;
  /** Draws attention to a chapter that needs the traveller right now. */
  urgent?: boolean;
  render: () => ReactNode;
}

const TAB_W = 112;

export function ChapterRail({
  chapters,
  initialKey,
  onChapterChange,
  header,
}: {
  chapters: Chapter[];
  initialKey?: string;
  onChapterChange?: (key: string, index: number) => void;
  header?: ReactNode;
}) {
  const { width } = useWindowDimensions();
  const pager = useRef<ScrollView>(null);
  const rail = useRef<ScrollView>(null);
  const scrollX = useSharedValue(0);

  const [index, setIndex] = useState(() => {
    const found = initialKey ? chapters.findIndex((c) => c.key === initialKey) : 0;
    return found >= 0 ? found : 0;
  });

  const onScroll = useAnimatedScrollHandler({
    onScroll: (e) => {
      scrollX.value = e.contentOffset.x;
    },
  });

  const centreRail = useCallback(
    (i: number) => {
      rail.current?.scrollTo({ x: Math.max(0, i * TAB_W - width / 2 + TAB_W / 2), animated: true });
    },
    [width],
  );

  const goto = useCallback(
    (next: number, animated = true) => {
      pager.current?.scrollTo({ x: next * width, animated });
      centreRail(next);
    },
    [centreRail, width],
  );

  /* An external jump — "find recovery options" deep-links a chapter. */
  useEffect(() => {
    if (!initialKey) return;
    const target = chapters.findIndex((c) => c.key === initialKey);
    if (target < 0 || target === index) return;
    setIndex(target);
    requestAnimationFrame(() => goto(target, false));
  }, [initialKey, chapters, goto, index]);

  const marker = useAnimatedStyle(() => {
    if (chapters.length < 2) return { transform: [{ translateX: 0 }] };
    return {
      transform: [
        {
          translateX: interpolate(
            scrollX.value,
            chapters.map((_, i) => i * width),
            chapters.map((_, i) => i * TAB_W),
          ),
        },
      ],
    };
  });

  return (
    <View style={styles.root}>
      {header}

      <View style={styles.railWrap}>
        <ScrollView
          ref={rail}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: space(5) }}
        >
          <View>
            <View style={{ flexDirection: 'row' }}>
              {chapters.map((chapter, i) => {
                const on = i === index;
                return (
                  <Pressable
                    key={chapter.key}
                    style={styles.tab}
                    onPress={() => {
                      haptic.tap();
                      setIndex(i);
                      goto(i);
                      onChapterChange?.(chapter.key, i);
                    }}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: on }}
                    accessibilityLabel={chapter.label}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      {chapter.icon ? (
                        <TravelIcon
                          name={chapter.icon}
                          size={13}
                          color={on ? colors.ink : colors.inkFaint}
                          weight={1.7}
                        />
                      ) : null}
                      <Text style={[type.stamp, { color: on ? colors.ink : colors.inkFaint }]} numberOfLines={1}>
                        {chapter.label.toUpperCase()}
                      </Text>
                      {chapter.urgent ? <View style={styles.urgentDot} /> : null}
                    </View>
                  </Pressable>
                );
              })}
            </View>
            <View style={styles.railTrack}>
              <Animated.View style={[styles.marker, marker]} />
            </View>
          </View>
        </ScrollView>
      </View>

      <Animated.ScrollView
        ref={pager as never}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        onMomentumScrollEnd={(e) => {
          const next = Math.round(e.nativeEvent.contentOffset.x / width);
          if (next === index) return;
          setIndex(next);
          centreRail(next);
          onChapterChange?.(chapters[next]?.key ?? '', next);
        }}
        style={{ flex: 1 }}
      >
        {chapters.map((chapter, i) => (
          <View key={chapter.key} style={{ width }}>
            {/* Neighbours stay mounted so a swipe never reveals a blank page. */}
            {Math.abs(i - index) <= 1 ? chapter.render() : null}
          </View>
        ))}
      </Animated.ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.mist },
  railWrap: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.rule,
    backgroundColor: colors.mist,
  },
  tab: { width: TAB_W, minHeight: 44, justifyContent: 'center', paddingRight: space(3) },
  railTrack: { height: 2 },
  marker: { width: TAB_W - 30, height: 2, borderRadius: 1, backgroundColor: colors.indigo },
  urgentDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.coralInk },
});
