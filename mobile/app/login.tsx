/**
 * Sign in — the inside cover of the journal.
 *
 * Authentication is not the product, so it stays a single ruled page and
 * "continue as guest" is a first-class path: the trip experience is never gated.
 */
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { router } from 'expo-router';

import { colors, fonts, motion, radius, space, touch } from '@/theme';
import { Button, Divider, Eyebrow, Row, Txt } from '@/components/primitives';
import { Field } from '@/components/Field';
import { SceneBackdrop } from '@/components/scene/Scene';
import { VikalpaMark } from '@/components/brand/Logo';
import { TravelIcon } from '@/components/travel/TravelIcon';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const ready = email.includes('@') && password.length >= 4;

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <SceneBackdrop variant="dusk" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Animated.View entering={FadeInDown.duration(motion.settle)}>
          <Row gap={space(2)}>
            <VikalpaMark size={30} />
            <Eyebrow color={colors.indigo} style={{ letterSpacing: 2.2 }}>
              VIKALPA
            </Eyebrow>
          </Row>
          <Txt variant="chapter" accessibilityRole="header" style={{ marginTop: space(4) }}>
            Welcome back.
          </Txt>
          <Txt variant="body" color={colors.inkMuted} style={{ marginTop: space(2.5) }}>
            Your journeys, and every way forward from them.
          </Txt>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(70).duration(motion.settle)} style={{ marginTop: space(10) }}>
          <Field
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
          />
          <Field
            label="Password"
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            secureTextEntry
            autoComplete="current-password"
          />

          <Button
            label="Continue"
            icon="arrowRight"
            onPress={() => router.replace('/import')}
            disabled={!ready}
            size="large"
            style={{ marginTop: space(3) }}
          />

          <Pressable
            onPress={() => router.replace('/import')}
            style={styles.guest}
            accessibilityRole="button"
            accessibilityLabel="Continue as guest"
          >
            <Row gap={7}>
              <TravelIcon name="ticket" size={14} color={colors.indigo} weight={1.8} />
              <Txt variant="small" color={colors.indigo} style={{ fontFamily: fonts.bold }}>
                Continue as guest
              </Txt>
            </Row>
          </Pressable>
        </Animated.View>

        <Row gap={space(3)} style={{ marginTop: space(9) }}>
          <Divider style={{ flex: 1 }} dashed />
          <Eyebrow>or</Eyebrow>
          <Divider style={{ flex: 1 }} dashed />
        </Row>

        <View style={{ gap: space(3), marginTop: space(6) }}>
          {(['Continue with Apple', 'Continue with Google'] as const).map((label) => (
            <View key={label} style={styles.social}>
              <Txt variant="small" color={colors.inkMuted}>
                {label}
              </Txt>
              <Eyebrow color={colors.inkFaint}>Soon</Eyebrow>
            </View>
          ))}
        </View>

        <Row justify="center" gap={7} style={{ marginTop: space(9) }}>
          <Txt variant="small" color={colors.inkMuted}>
            New here?
          </Txt>
          <Pressable onPress={() => router.push('/register')} hitSlop={12} accessibilityRole="button" accessibilityLabel="Create an account">
            <Txt variant="small" color={colors.indigo} style={{ fontFamily: fonts.bold }}>
              Create an account
            </Txt>
          </Pressable>
        </Row>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.mist },
  content: { padding: space(6), paddingTop: space(20), paddingBottom: space(12) },
  guest: { alignSelf: 'center', marginTop: space(5), minHeight: touch.min, justifyContent: 'center' },
  social: {
    minHeight: touch.min,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.rule,
    backgroundColor: colors.cloud,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space(2),
  },
});
