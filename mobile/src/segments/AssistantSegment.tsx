/**
 * SCREEN 25 — Recovery assistant. "What matters to you?"
 *
 * A concierge writing in the margin of the itinerary, not a chat clone. You say
 * what matters; it shows you the constraints it heard as stamped readings, then
 * hands them to the engine.
 *
 * The boundary is the whole point and it is stated on the page: the language
 * model reads intent only. It cannot propose a plan, move a booking, or write
 * the justification — the deterministic engine validates and ranks, exactly as
 * it does everywhere else. A model that cannot invent an itinerary cannot
 * hallucinate one.
 */
import React, { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import { colors, gutter, motion, radius, space, touch, type } from '@/theme';
import {
  Button,
  ChapterHeader,
  Divider,
  Eyebrow,
  Row,
  Txt,
} from '@/components/primitives';
import { PaperCard, Stamp } from '@/components/travel/paper';
import { TravelIcon } from '@/components/travel/TravelIcon';
import { DoodleField } from '@/components/travel/Doodles';
import { api, type AssistantResponse } from '@/api/client';
import * as haptic from '@/utils/haptics';
import { useTrip } from '@/state/store';

const PROMPTS = [
  "I don't care about extra cost. I just don't want to miss the cruise.",
  'Cheapest option please, we are on a tight budget.',
  'No late-night arrivals — someone needs step-free access.',
  'Happy to drop the food walk if it saves money.',
  'Get us home as fast as possible.',
];

interface Turn {
  id: string;
  role: 'YOU' | 'ENGINE';
  text: string;
  readings?: { label: string; value: string }[];
  planCount?: number;
  recommendation?: string | null;
  source?: 'RULES' | 'LLM';
}

export function AssistantSegment({ onPlansReady }: { onPlansReady: () => void }) {
  const tripId = useTrip((s) => s.tripId);
  const refreshTrip = useTrip((s) => s.refreshTrip);
  const generatePlans = useTrip((s) => s.generatePlans);
  const cascade = useTrip((s) => s.cascade);

  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([
    {
      id: 'seed',
      role: 'ENGINE',
      text: cascade
        ? 'Tell me what matters and I will re-rank the recovery plans against it. Name an experience you refuse to lose, a budget limit, or a time you will not travel after.'
        : 'Tell me what matters on this trip and I will hold it as a constraint for when something does go wrong.',
    },
  ]);
  const scroller = useRef<ScrollView>(null);

  const send = async (message: string) => {
    const trimmed = message.trim();
    if (!trimmed || busy) return;
    haptic.light();
    setText('');
    setBusy(true);
    setTurns((prev) => [...prev, { id: `u-${Date.now()}`, role: 'YOU', text: trimmed }]);
    requestAnimationFrame(() => scroller.current?.scrollToEnd({ animated: true }));

    let response: AssistantResponse | null = null;
    try {
      response = await api.assistant(tripId, trimmed);
    } catch {
      response = null;
    }

    if (!response) {
      setTurns((prev) => [
        ...prev,
        { id: `s-${Date.now()}`, role: 'ENGINE', text: 'I could not reach the engine to re-rank anything.' },
      ]);
      setBusy(false);
      return;
    }

    setTurns((prev) => [
      ...prev,
      {
        id: `s-${Date.now()}`,
        role: 'ENGINE',
        text: response!.intent.reply,
        readings: response!.intent.readings,
        planCount: response!.planCount,
        recommendation: response!.recommendation,
        source: response!.intent.source,
      },
    ]);

    /* The engine holds new weights — pull the re-ranked deck through the store. */
    await refreshTrip();
    if (cascade) await generatePlans();
    setBusy(false);
    requestAnimationFrame(() => scroller.current?.scrollToEnd({ animated: true }));
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.mist }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <DoodleField opacity={0.04} density={0.5} />

      <ScrollView
        ref={scroller}
        contentContainerStyle={{ padding: gutter(360), paddingBottom: space(6) }}
        showsVerticalScrollIndicator={false}
      >
        <ChapterHeader
          marker="Chapter ten · your concierge"
          title="What matters to you?"
          standfirst="Plain language in, optimizer constraints out."
          scene="dusk"
        />

        {/* the boundary, stated up front */}
        <PaperCard depth="flat" tinted={colors.haze} style={{ marginBottom: space(5) }}>
          <Row gap={space(2.5)} align="flex-start">
            <TravelIcon name="lock" size={15} color={colors.inkMuted} weight={1.7} />
            <View style={{ flex: 1 }}>
              <Eyebrow>Where the line is</Eyebrow>
              <Txt variant="small" color={colors.inkSoft} style={{ marginTop: space(2) }}>
                The language model only reads your intent. It cannot invent a recovery plan, move a booking, or write
                the reason under a recommendation — the deterministic engine validates travel time, opening hours,
                availability and your constraints, then ranks what survived.
              </Txt>
            </View>
          </Row>
        </PaperCard>

        {turns.map((turn, i) => (
          <Animated.View key={turn.id} entering={FadeInDown.delay(i === 0 ? 0 : 40).duration(motion.settle)}>
            {turn.role === 'YOU' ? (
              <View style={styles.you}>
                <Txt variant="body" color={colors.mist}>
                  {turn.text}
                </Txt>
              </View>
            ) : (
              <PaperCard depth="lifted" style={styles.engine} accent={colors.indigo}>
                <Txt variant="body">{turn.text}</Txt>

                {/* the constraints, stamped */}
                {turn.readings?.length ? (
                  <View style={{ marginTop: space(4) }}>
                    <Eyebrow>Understood as</Eyebrow>
                    <View style={{ marginTop: space(2.5), gap: space(2) }}>
                      {turn.readings.map((reading) => (
                        <Row key={reading.label} justify="space-between" align="center">
                          <Txt variant="small" color={colors.inkSoft} style={{ flex: 1, paddingRight: space(3) }}>
                            {reading.label}
                          </Txt>
                          <Stamp label={reading.value} tint={colors.indigo} rotate={-3} />
                        </Row>
                      ))}
                    </View>
                  </View>
                ) : null}

                {turn.planCount ? (
                  <View style={{ marginTop: space(4) }}>
                    <Divider dashed style={{ marginBottom: space(3) }} />
                    <Row gap={7}>
                      <TravelIcon name="recovery" size={14} color={colors.indigo} weight={1.8} />
                      <Eyebrow color={colors.indigo}>
                        {turn.planCount} plan{turn.planCount === 1 ? '' : 's'} re-ranked
                      </Eyebrow>
                    </Row>
                    {turn.recommendation ? (
                      <Txt variant="small" color={colors.inkSoft} style={{ marginTop: space(2.5) }}>
                        {turn.recommendation}
                      </Txt>
                    ) : null}
                    <Button
                      label="See the plans"
                      variant="secondary"
                      icon="arrowRight"
                      onPress={onPlansReady}
                      style={{ marginTop: space(3.5), alignSelf: 'flex-start' }}
                    />
                  </View>
                ) : null}

                {turn.source ? (
                  <Txt variant="meta" color={colors.inkFaint} style={{ marginTop: space(3) }}>
                    Intent read by {turn.source === 'LLM' ? 'Claude' : 'the local rule reader'}
                  </Txt>
                ) : null}
              </PaperCard>
            )}
          </Animated.View>
        ))}

        {busy ? (
          <Animated.View entering={FadeIn}>
            <PaperCard depth="flat" style={styles.engine} tinted={colors.haze}>
              <Row gap={space(2.5)}>
                <TravelIcon name="compass" size={14} color={colors.inkFaint} weight={1.7} />
                <Txt variant="small" color={colors.inkMuted}>
                  Reading that, then re-running the planner…
                </Txt>
              </Row>
            </PaperCard>
          </Animated.View>
        ) : null}

        {/* suggested phrasings, as torn slips */}
        <View style={{ marginTop: space(5) }}>
          <Eyebrow>Try saying</Eyebrow>
          <View style={{ marginTop: space(3), gap: space(2.5) }}>
            {PROMPTS.map((prompt, i) => (
              <Pressable
                key={prompt}
                onPress={() => void send(prompt)}
                accessibilityRole="button"
                accessibilityLabel={prompt}
                style={({ pressed }) => (pressed ? { opacity: 0.7 } : undefined)}
              >
                <View style={[styles.slip, { transform: [{ rotate: `${i % 2 === 0 ? -0.5 : 0.6}deg` }] }]}>
                  <Txt variant="small" color={colors.inkSoft} style={{ flex: 1 }}>
                    “{prompt}”
                  </Txt>
                  <TravelIcon name="arrowRight" size={13} color={colors.indigo} weight={2} />
                </View>
              </Pressable>
            ))}
          </View>
        </View>
      </ScrollView>

      <View style={styles.composer}>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="What matters most?"
          placeholderTextColor={colors.inkFaint}
          style={styles.input}
          multiline
          accessibilityLabel="Tell the assistant what matters"
          onSubmitEditing={() => void send(text)}
        />
        <Button label="Send" icon="arrowRight" onPress={() => void send(text)} disabled={!text.trim()} loading={busy} style={styles.send} />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  you: {
    alignSelf: 'flex-end',
    maxWidth: '86%',
    backgroundColor: colors.indigo,
    borderRadius: radius.lg,
    borderBottomRightRadius: radius.xs,
    padding: space(3.5),
    marginBottom: space(3),
  },
  engine: {
    alignSelf: 'flex-start',
    maxWidth: '95%',
    borderBottomLeftRadius: radius.xs,
    marginBottom: space(3),
  },
  slip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(2.5),
    backgroundColor: colors.cloud,
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.frost,
    paddingHorizontal: space(3),
    paddingVertical: space(3),
    minHeight: touch.min,
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: space(2.5),
    padding: space(4),
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.rule,
    backgroundColor: colors.mist,
  },
  input: {
    flex: 1,
    ...type.body,
    color: colors.ink,
    maxHeight: 112,
    minHeight: touch.min,
    paddingHorizontal: space(4),
    paddingTop: space(3),
    paddingBottom: space(3),
    backgroundColor: colors.cloud,
    borderRadius: radius.lg,
    borderWidth: 1.1,
    borderColor: colors.ruleStrong,
  },
  send: { paddingHorizontal: space(5) },
});
