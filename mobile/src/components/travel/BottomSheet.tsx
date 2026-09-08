/**
 * BottomSheet — detail rises over the itinerary, never replaces it.
 *
 * Styled as a sheet of paper slid up from the bottom of the journal: torn top
 * edge, a grab handle, and the page still visible behind. Drag down or tap the
 * scrim to put it back.
 */
import React, { useEffect, type ReactNode } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, gutter, maxContent, motion, radius, space } from '@/theme';
import { Eyebrow, Row, Txt } from '@/components/primitives';
import { TravelIcon, type IconName } from '@/components/travel/TravelIcon';

export function BottomSheet({
  open,
  onClose,
  eyebrow,
  title,
  icon,
  children,
  footer,
  maxHeightRatio = 0.88,
}: {
  open: boolean;
  onClose: () => void;
  eyebrow?: string;
  title?: string;
  icon?: IconName;
  children: ReactNode;
  /** Pinned action area, outside the scroll. */
  footer?: ReactNode;
  maxHeightRatio?: number;
}) {
  const { height, width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const translateY = useSharedValue(0);
  const scrim = useSharedValue(0);

  useEffect(() => {
    if (open) {
      translateY.value = 0;
      scrim.value = withTiming(1, { duration: motion.quick });
    } else {
      scrim.value = 0;
    }
  }, [open, translateY, scrim]);

  const dismiss = () => {
    translateY.value = 0;
    onClose();
  };

  const drag = Gesture.Pan()
    .onUpdate((e) => {
      translateY.value = Math.max(0, e.translationY);
    })
    .onEnd((e) => {
      if (e.translationY > 120 || e.velocityY > 900) {
        translateY.value = withTiming(height, { duration: motion.quick }, () => runOnJS(dismiss)());
      } else {
        translateY.value = withSpring(0, motion.spring);
      }
    });

  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }));
  const scrimStyle = useAnimatedStyle(() => ({ opacity: scrim.value }));
  const pad = gutter(width);

  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={dismiss} statusBarTranslucent>
      {/* Android gestures need the modal's own tree rooted again. */}
      <GestureHandlerRootView style={styles.root}>
        <Animated.View style={[styles.scrim, scrimStyle]}>
          <Pressable style={styles.fill} onPress={dismiss} accessibilityRole="button" accessibilityLabel="Close" />
        </Animated.View>

        <GestureDetector gesture={drag}>
          <Animated.View
            style={[
              styles.sheet,
              { maxHeight: height * maxHeightRatio, paddingBottom: footer ? 0 : Math.max(insets.bottom, space(6)) },
              sheetStyle,
            ]}
          >
            <View style={styles.handle} />

            {eyebrow || title ? (
              <View style={[styles.head, { paddingHorizontal: pad }]}>
                <Row gap={space(3)} align="flex-start">
                  {icon ? (
                    <View style={styles.headIcon}>
                      <TravelIcon name={icon} size={18} color={colors.indigo} weight={1.7} />
                    </View>
                  ) : null}
                  <View style={{ flex: 1 }}>
                    {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
                    {title ? (
                      <Txt variant="h2" accessibilityRole="header" style={{ marginTop: eyebrow ? 3 : 0 }}>
                        {title}
                      </Txt>
                    ) : null}
                  </View>
                </Row>
              </View>
            ) : null}

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{
                paddingHorizontal: pad,
                paddingBottom: space(5),
                width: '100%',
                maxWidth: maxContent,
                alignSelf: 'center',
              }}
            >
              {children}
            </ScrollView>

            {footer ? (
              <View style={[styles.footer, { paddingHorizontal: pad, paddingBottom: Math.max(insets.bottom, space(4)) }]}>
                {footer}
              </View>
            ) : null}
          </Animated.View>
        </GestureDetector>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  fill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  scrim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.scrim },
  sheet: {
    backgroundColor: colors.mist,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingTop: space(2.5),
    borderTopWidth: 1,
    borderColor: colors.frost,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.ruleStrong,
    alignSelf: 'center',
    marginBottom: space(3),
  },
  head: { paddingBottom: space(4) },
  headIcon: {
    width: 34,
    height: 34,
    borderRadius: radius.sm,
    backgroundColor: colors.periSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.rule,
    paddingTop: space(3),
    backgroundColor: colors.mist,
  },
});
