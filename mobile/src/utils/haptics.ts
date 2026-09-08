/**
 * Haptics, safely.
 *
 * expo-haptics rejects on platforms without a vibration motor (web, some
 * emulators). Feedback is a nicety, so every call is fire-and-forget and any
 * failure is swallowed rather than surfacing as an unhandled rejection.
 */
import * as Haptics from 'expo-haptics';

const swallow = (promise: Promise<unknown>) => {
  void promise.catch(() => undefined);
};

export const tap = () => swallow(Haptics.selectionAsync());

export const light = () => swallow(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));

export const medium = () => swallow(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));

export const heavy = () => swallow(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy));

export const success = () =>
  swallow(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));

export const warn = () =>
  swallow(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning));
