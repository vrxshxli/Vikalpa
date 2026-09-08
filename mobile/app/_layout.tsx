import React, { useCallback, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Stack } from 'expo-router';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import {
  Baloo2_400Regular,
  Baloo2_500Medium,
  Baloo2_600SemiBold,
  Baloo2_700Bold,
} from '@expo-google-fonts/baloo-2';

import { colors } from '@/theme';
import { useTrip } from '@/state/store';

/**
 * Hold the native splash until the rounded type is ready. The whole identity
 * rests on these faces, so a flash of the system font would be the first thing
 * a traveller saw. `useFonts` rather than the (otherwise preferred) config
 * plugin, because the plugin embeds at build time and would not work in Expo Go.
 */
void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const bootstrap = useTrip((s) => s.bootstrap);

  const [fontsLoaded, fontError] = useFonts({
    Baloo2_400Regular,
    Baloo2_500Medium,
    Baloo2_600SemiBold,
    Baloo2_700Bold,
  });

  // One trip, fetched once at the root. Every screen reads the same state.
  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  const onReady = useCallback(() => {
    void SplashScreen.hideAsync();
  }, []);

  // A font that fails to load must not leave the traveller on a blank screen —
  // fall through to the system face and carry on.
  const ready = fontsLoaded || !!fontError;
  if (!ready) return <View style={styles.root} />;

  return (
    <GestureHandlerRootView style={styles.root} onLayout={onReady}>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.mist },
            // One continuous space, so screens dissolve rather than shove.
            animation: 'fade',
          }}
        >
          <Stack.Screen name="index" options={{ animation: 'none' }} />
          <Stack.Screen name="onboarding" />
          <Stack.Screen name="login" />
          <Stack.Screen name="register" />
          <Stack.Screen name="import" />
          <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
        </Stack>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.mist },
});
