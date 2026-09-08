/**
 * Create account — issuing the traveller a passport.
 */
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { router } from 'expo-router';

import { colors, fonts, motion, space } from '@/theme';
import { Button, Eyebrow, Row, Txt } from '@/components/primitives';
import { Field } from '@/components/Field';
import { SceneBackdrop } from '@/components/scene/Scene';
import { TravelIcon } from '@/components/travel/TravelIcon';

export default function Register() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const ready = name.trim().length > 1 && email.includes('@') && password.length >= 6;

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <SceneBackdrop variant="sea" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Animated.View entering={FadeInDown.duration(motion.settle)}>
          <Row gap={space(2.5)}>
            <TravelIcon name="stamp" size={20} color={colors.amberInk} weight={1.6} />
            <Eyebrow color={colors.indigo}>Create account</Eyebrow>
          </Row>
          <Txt variant="chapter" accessibilityRole="header" style={{ marginTop: space(4) }}>
            Start with one journey.
          </Txt>
          <Txt variant="body" color={colors.inkMuted} style={{ marginTop: space(2.5) }}>
            Bring in an itinerary and VIKALPA will watch it for you.
          </Txt>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(80).duration(motion.settle)} style={{ marginTop: space(10) }}>
          <Field label="Name" value={name} onChangeText={setName} placeholder="Your name" autoComplete="name" />
          <Field
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
          />
          <Field
            label="Password"
            value={password}
            onChangeText={setPassword}
            placeholder="At least 6 characters"
            secureTextEntry
            autoComplete="new-password"
          />
          <Button
            label="Create account"
            icon="passport"
            onPress={() => router.replace('/import')}
            disabled={!ready}
            size="large"
            style={{ marginTop: space(3) }}
          />
        </Animated.View>

        <Row justify="center" gap={7} style={{ marginTop: space(9) }}>
          <Txt variant="small" color={colors.inkMuted}>
            Already have an account?
          </Txt>
          <Pressable onPress={() => router.replace('/login')} hitSlop={12} accessibilityRole="button" accessibilityLabel="Sign in">
            <Txt variant="small" color={colors.indigo} style={{ fontFamily: fonts.bold }}>
              Sign in
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
});
