/**
 * SCREENS 18 + 19 — Emergency quick action, and manual disruption.
 *
 * Built for someone standing in an airport with a bag in one hand. Five huge
 * targets, then one question at a time, no typing. The answers assemble a real
 * Disruption and feed the same cascade engine the live monitor uses — this is
 * not a mock form.
 */
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { colors, fonts, radius, space, touch } from '@/theme';
import {
  ChapterHeader,
  Empty,
  Eyebrow,
  Loading,
  Pill,
  Row,
  ScreenScaffold,
  StickyCTA,
  Txt,
} from '@/components/primitives';
import { PaperCard, TravelTicket } from '@/components/travel/paper';
import { TravelIcon, kindIcon, type IconName } from '@/components/travel/TravelIcon';
import { statusLabel, when } from '@/utils/format';
import * as haptic from '@/utils/haptics';
import { useTrip } from '@/state/store';
import type { DisruptionType } from '@/types/domain';

const DELAYS = [
  { label: '1 hour', minutes: 60 },
  { label: '2 hours', minutes: 120 },
  { label: '6 hours', minutes: 360 },
  { label: '12 hours', minutes: 720 },
  { label: '24 hours', minutes: 1440 },
];

const TYPE_COPY: Partial<Record<DisruptionType, string>> = {
  FLIGHT_DELAYED: 'It is running late',
  FLIGHT_CANCELLED: 'It was cancelled',
  TRAIN_MISSED: 'I missed it',
  HOTEL_CANCELLED: 'The stay was cancelled',
  TRANSFER_FAILED: 'It never turned up',
  ACTIVITY_UNAVAILABLE: 'It is not running',
  SCHEDULE_CHANGED: 'The time changed',
  WEATHER: 'Weather has stopped it',
};

const ACTION_ICON: Record<string, IconName> = {
  'qa-transport': 'plane',
  'qa-hotel': 'hotel',
  'qa-transfer': 'transfer',
  'qa-weather': 'rain',
  'qa-plans': 'calendar',
};

type Step = 'WHAT' | 'WHICH' | 'HOW' | 'HOW_LONG';

export function ReportSegment({ onAnalysed }: { onAnalysed: () => void }) {
  const catalogue = useTrip((s) => s.catalogue);
  const loadCatalogue = useTrip((s) => s.loadCatalogue);
  const trip = useTrip((s) => s.overview?.trip ?? null);
  const triggerDisruption = useTrip((s) => s.triggerDisruption);
  const loading = useTrip((s) => s.loading);

  const [step, setStep] = useState<Step>('WHAT');
  const [actionId, setActionId] = useState<string | null>(null);
  const [nodeId, setNodeId] = useState<string | null>(null);
  const [type, setType] = useState<DisruptionType | null>(null);
  const [minutes, setMinutes] = useState<number | null>(null);

  useEffect(() => {
    if (!catalogue) void loadCatalogue();
  }, [catalogue, loadCatalogue]);

  if (!catalogue || !trip) return <Loading label="Loading your bookings" icon="luggage" />;

  const action = catalogue.quickActions.find((a) => a.id === actionId) ?? null;
  const candidates = action ? trip.nodes.filter((n) => action.kinds.includes(n.kind)) : [];
  const node = trip.nodes.find((n) => n.id === nodeId) ?? null;
  const needsDuration = type === 'FLIGHT_DELAYED' || type === 'SCHEDULE_CHANGED';

  const reset = () => {
    setStep('WHAT');
    setActionId(null);
    setNodeId(null);
    setType(null);
    setMinutes(null);
  };

  const submit = async () => {
    if (!node || !type) return;
    haptic.heavy();
    const delayMinutes = needsDuration ? (minutes ?? 120) : 0;
    await triggerDisruption({
      nodeId: node.id,
      type,
      delayMinutes,
      headline: headlineFor(node.title, type, delayMinutes),
      detail: detailFor(node.title, type, delayMinutes),
      source: 'MANUAL',
      detectedAt: new Date().toISOString(),
    });
    reset();
    onAnalysed();
  };

  const canSubmit = Boolean(node && type && (!needsDuration || minutes));

  return (
    <ScreenScaffold
      footer={
        canSubmit ? (
          <StickyCTA
            label="Analyse impact"
            icon="route"
            onPress={() => void submit()}
            loading={loading.disruption}
            note="Runs the same cascade the live monitor uses."
          />
        ) : undefined
      }
    >
      <ChapterHeader
        marker="Chapter seven · emergency"
        title={step === 'WHAT' ? 'Something went wrong?' : 'Tell us what changed.'}
        standfirst={step === 'WHAT' ? 'Tap the closest one. We will work out what it costs you.' : undefined}
        scene="storm"
      />

      {/* where we are, and a way back */}
      {actionId ? (
        <Row justify="space-between" style={{ marginBottom: space(5) }}>
          <Row gap={space(2)}>
            {(['WHAT', 'WHICH', 'HOW', ...(needsDuration ? (['HOW_LONG'] as Step[]) : [])] as Step[]).map((s, i) => (
              <View key={s} style={[styles.crumb, step === s && { backgroundColor: colors.indigo }]}>
                <Txt variant="meta" color={step === s ? colors.mist : colors.inkMuted} style={{ fontSize: 10.5 }}>
                  {i + 1}
                </Txt>
              </View>
            ))}
          </Row>
          <Pressable onPress={reset} hitSlop={12} accessibilityRole="button" accessibilityLabel="Start over">
            <Row gap={5}>
              <TravelIcon name="recovery" size={12} color={colors.indigo} weight={2} />
              <Txt variant="meta" color={colors.indigo} style={{ fontFamily: fonts.bold }}>
                Start over
              </Txt>
            </Row>
          </Pressable>
        </Row>
      ) : null}

      {/* ---------- step 1: the big five ---------- */}
      {step === 'WHAT' ? (
        <View style={{ gap: space(3) }}>
          {catalogue.quickActions.map((quick, i) => (
            <Animated.View key={quick.id} entering={FadeInDown.delay(i * 50).duration(260)}>
              <Pressable
                onPress={() => {
                  haptic.medium();
                  setActionId(quick.id);
                  setStep('WHICH');
                }}
                accessibilityRole="button"
                accessibilityLabel={quick.label}
                style={({ pressed }) => (pressed ? { opacity: 0.7, transform: [{ scale: 0.995 }] } : undefined)}
              >
                <PaperCard depth="lifted" style={styles.big} accent={colors.coralInk}>
                  <Row gap={space(4)}>
                    <View style={styles.bigIcon}>
                      <TravelIcon
                        name={ACTION_ICON[quick.id] ?? 'warning'}
                        size={26}
                        color={colors.coralInk}
                        weight={1.6}
                        badge="warning"
                        badgeBackground={colors.coralInk}
                      />
                    </View>
                    <Txt variant="h2" style={{ flex: 1, fontSize: 20 }}>
                      {quick.label}
                    </Txt>
                    <TravelIcon name="chevron" size={18} color={colors.inkFaint} weight={2} />
                  </Row>
                </PaperCard>
              </Pressable>
            </Animated.View>
          ))}
        </View>
      ) : null}

      {/* ---------- step 2: which booking ---------- */}
      {step === 'WHICH' && action ? (
        <Animated.View entering={FadeInDown.duration(260)}>
          <Eyebrow color={colors.indigo}>{action.prompt}</Eyebrow>
          <View style={{ marginTop: space(3), gap: space(2.5) }}>
            {candidates.length === 0 ? (
              <Empty title="Nothing matches" body="No booking of that kind is left in your itinerary." icon="luggage" />
            ) : (
              candidates.map((candidate, i) => (
                <Animated.View key={candidate.id} entering={FadeInDown.delay(i * 40).duration(240)}>
                  <TravelTicket
                    accent={colors.indigo}
                    depth="lifted"
                    stubWidth={44}
                    onPress={() => {
                      haptic.tap();
                      setNodeId(candidate.id);
                      setStep('HOW');
                    }}
                    accessibilityLabel={`${candidate.title}, ${when(candidate.start)}`}
                    stub={<TravelIcon name="chevron" size={15} color={colors.inkFaint} weight={2} />}
                  >
                    <Row gap={space(3)}>
                      <TravelIcon name={kindIcon[candidate.kind] ?? 'pin'} size={17} color={colors.indigo} weight={1.7} />
                      <View style={{ flex: 1 }}>
                        <Txt variant="h3" style={{ fontSize: 15 }} numberOfLines={1}>
                          {candidate.title}
                        </Txt>
                        <Txt variant="meta" color={colors.inkMuted} style={{ marginTop: 2 }}>
                          {when(candidate.start)}
                          {candidate.ref ? ` · ${candidate.ref}` : ''}
                        </Txt>
                      </View>
                    </Row>
                  </TravelTicket>
                </Animated.View>
              ))
            )}
          </View>
        </Animated.View>
      ) : null}

      {/* ---------- step 3: what exactly ---------- */}
      {step === 'HOW' && action && node ? (
        <Animated.View entering={FadeInDown.duration(260)}>
          <PaperCard depth="flat" tinted={colors.haze} style={{ marginBottom: space(4) }}>
            <Eyebrow>The booking</Eyebrow>
            <Txt variant="h3" style={{ marginTop: 3 }}>
              {node.title}
            </Txt>
            <Txt variant="meta" color={colors.inkMuted} style={{ marginTop: 2 }}>
              {when(node.start)}
            </Txt>
          </PaperCard>

          <Eyebrow color={colors.indigo}>What happened?</Eyebrow>
          <View style={{ marginTop: space(3), gap: space(2.5) }}>
            {action.types.map((t) => (
              <Pressable
                key={t}
                onPress={() => {
                  haptic.tap();
                  setType(t);
                  if (t === 'FLIGHT_DELAYED' || t === 'SCHEDULE_CHANGED') setStep('HOW_LONG');
                }}
                accessibilityRole="radio"
                accessibilityState={{ selected: type === t }}
                accessibilityLabel={TYPE_COPY[t] ?? statusLabel(t)}
              >
                <View style={[styles.option, type === t && { borderColor: colors.indigo, backgroundColor: colors.periSoft }]}>
                  <Txt variant="h3" style={{ fontSize: 15.5, flex: 1 }}>
                    {TYPE_COPY[t] ?? statusLabel(t)}
                  </Txt>
                  {type === t ? <TravelIcon name="check" size={15} color={colors.indigo} weight={2.8} /> : null}
                </View>
              </Pressable>
            ))}
          </View>
        </Animated.View>
      ) : null}

      {/* ---------- step 4: how late ---------- */}
      {step === 'HOW_LONG' && node ? (
        <Animated.View entering={FadeInDown.duration(260)}>
          <Eyebrow color={colors.indigo}>How late?</Eyebrow>
          <Row gap={space(2.5)} wrap style={{ marginTop: space(3) }}>
            {DELAYS.map((choice) => (
              <Pressable
                key={choice.minutes}
                onPress={() => {
                  haptic.tap();
                  setMinutes(choice.minutes);
                }}
                accessibilityRole="radio"
                accessibilityState={{ selected: minutes === choice.minutes }}
                accessibilityLabel={choice.label}
              >
                <View style={[styles.delay, minutes === choice.minutes && { borderColor: colors.indigo, backgroundColor: colors.indigo }]}>
                  <Txt variant="h3" color={minutes === choice.minutes ? colors.mist : colors.ink} style={{ fontSize: 15 }}>
                    {choice.label}
                  </Txt>
                </View>
              </Pressable>
            ))}
          </Row>

          <PaperCard depth="flat" tinted={colors.haze} style={{ marginTop: space(5) }}>
            <Eyebrow>You are reporting</Eyebrow>
            <Txt variant="body" style={{ marginTop: space(2) }}>
              {node.title} — {(TYPE_COPY[type!] ?? '').toLowerCase()}
              {minutes ? ` by ${DELAYS.find((d) => d.minutes === minutes)?.label}` : ''}.
            </Txt>
            <Row gap={space(2)} wrap style={{ marginTop: space(3) }}>
              <Pill label="Feeds the cascade engine" icon="route" fg={colors.indigo} bg={colors.periSoft} />
            </Row>
          </PaperCard>
        </Animated.View>
      ) : null}
    </ScreenScaffold>
  );
}

function headlineFor(title: string, type: DisruptionType, minutes: number): string {
  switch (type) {
    case 'FLIGHT_DELAYED':
      return `${title} delayed by ${minutes >= 60 ? `${Math.round(minutes / 60)} hour${minutes >= 120 ? 's' : ''}` : `${minutes} minutes`}`;
    case 'FLIGHT_CANCELLED':
      return `${title} cancelled`;
    case 'HOTEL_CANCELLED':
      return `${title} cancelled your room`;
    case 'TRANSFER_FAILED':
      return `${title} never arrived`;
    case 'ACTIVITY_UNAVAILABLE':
      return `${title} is not running`;
    case 'WEATHER':
      return `Weather has stopped ${title}`;
    case 'TRAIN_MISSED':
      return `You missed ${title}`;
    default:
      return `${title} changed`;
  }
}

function detailFor(title: string, type: DisruptionType, minutes: number): string {
  if (type === 'FLIGHT_DELAYED' || type === 'SCHEDULE_CHANGED') {
    return `You reported ${title} running ${Math.round(minutes / 60)}h late. We have re-timed everything downstream of it.`;
  }
  return `You reported ${title} as unavailable. We have traced what depended on it.`;
}

const styles = StyleSheet.create({
  crumb: {
    width: 24,
    height: 24,
    borderRadius: radius.xs,
    backgroundColor: colors.haze,
    alignItems: 'center',
    justifyContent: 'center',
  },
  big: { minHeight: touch.hero + 16, justifyContent: 'center' },
  bigIcon: {
    width: 50,
    height: 50,
    borderRadius: radius.md,
    backgroundColor: colors.coralSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  option: {
    minHeight: touch.comfortable,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space(4),
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.rule,
    backgroundColor: colors.cloud,
  },
  delay: {
    minHeight: touch.min,
    justifyContent: 'center',
    paddingHorizontal: space(4),
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.ruleStrong,
    backgroundColor: colors.cloud,
  },
});
