/**
 * SCREEN 1 — Import itinerary. "Let's build your journey."
 *
 * Not an upload form. The page starts as a blank itinerary with empty slots,
 * and fills in as the parser recognises each booking — so the traveller watches
 * their journey being assembled rather than watching a spinner.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, LinearTransition } from 'react-native-reanimated';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';

import { colors, fonts, motion, radius, space, touch, type } from '@/theme';
import { ChapterHeader, Eyebrow, Pill, Row, StickyCTA, Txt } from '@/components/primitives';
import { LuggageTag, PaperCard, PopUpCard, Stamp, TravelTicket } from '@/components/travel/paper';
import { TravelIcon, kindIcon, type IconName } from '@/components/travel/TravelIcon';
import { SceneBackdrop } from '@/components/scene/Scene';
import { JourneyRibbon } from '@/components/travel/JourneyRibbon';
import * as haptic from '@/utils/haptics';
import { useTrip } from '@/state/store';

type Mode = 'BLANK' | 'READING' | 'READY';

const SOURCES: { id: string; title: string; body: string; icon: IconName; enabled: boolean }[] = [
  { id: 'PDF', title: 'Upload a PDF', body: 'Airline or agency confirmation', icon: 'passport', enabled: true },
  { id: 'SCREENSHOT', title: 'Upload a screenshot', body: 'A booking email or app screen', icon: 'camera', enabled: true },
  { id: 'CONNECTED_ACCOUNT', title: 'Connect bookings', body: 'Sync from your inbox', icon: 'signal', enabled: false },
];

/** The empty itinerary the page opens on — slots waiting to be filled. */
const SLOTS: { icon: IconName; label: string }[] = [
  { icon: 'plane', label: 'Flight' },
  { icon: 'transfer', label: 'Transfer' },
  { icon: 'hotel', label: 'Stay' },
  { icon: 'ticket', label: 'Experience' },
  { icon: 'plane', label: 'Return' },
];

export default function Import() {
  const runImport = useTrip((s) => s.runImport);
  const parse = useTrip((s) => s.parse);
  const overview = useTrip((s) => s.overview);

  const [mode, setMode] = useState<Mode>('BLANK');
  const [fileName, setFileName] = useState<string | null>(null);
  const [stageIndex, setStageIndex] = useState(0);
  /** How many recognised bookings have landed on the sheet so far. */
  const [filled, setFilled] = useState(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const stages = parse?.stages ?? [];
  const recognised = parse?.recognised ?? [];

  /** Walks the engine's own parse stages, filling the sheet as it goes. */
  const play = useCallback((list: { key: string; weight: number }[], count: number) => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    const total = 3000;
    let elapsed = 0;

    list.forEach((stage, i) => {
      elapsed += stage.weight * total;
      timers.current.push(
        setTimeout(() => {
          setStageIndex(i + 1);
          haptic.tap();
        }, elapsed),
      );
    });

    // Bookings drop onto the sheet across the back half of the read.
    for (let i = 0; i < count; i += 1) {
      timers.current.push(setTimeout(() => setFilled(i + 1), total * 0.42 + (i * total * 0.5) / Math.max(1, count)));
    }

    timers.current.push(
      setTimeout(() => {
        setMode('READY');
        haptic.success();
      }, elapsed + 380),
    );
  }, []);

  const begin = async (source: (typeof SOURCES)[number]) => {
    if (!source.enabled) return;
    haptic.medium();

    let picked: string | null = null;
    try {
      if (source.id === 'PDF') {
        const result = await DocumentPicker.getDocumentAsync({ type: 'application/pdf', copyToCacheDirectory: false });
        if (result.canceled) return;
        picked = result.assets?.[0]?.name ?? 'itinerary.pdf';
      } else if (source.id === 'SCREENSHOT') {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
          picked = 'screenshot.png';
        } else {
          const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.5 });
          if (result.canceled) return;
          picked = result.assets?.[0]?.fileName ?? 'screenshot.png';
        }
      } else {
        picked = 'itinerary.pdf';
      }
    } catch {
      // Picker unavailable (simulator, web) — carry on with the demo document.
      picked = source.id === 'SCREENSHOT' ? 'screenshot.png' : 'itinerary.pdf';
    }

    setFileName(picked);
    setStageIndex(0);
    setFilled(0);
    setMode('READING');

    await runImport(source.id, picked ?? undefined);
    const state = useTrip.getState().parse;
    play(state?.stages ?? [], state?.recognised.length ?? 0);
  };

  /* ---------------- the blank journal ---------------- */
  if (mode === 'BLANK') {
    return (
      <View style={styles.root}>
        <SceneBackdrop variant="dawn" />
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <ChapterHeader
            marker="Chapter one · start the journey"
            title="Let's build your journey."
            standfirst="Give us the itinerary you already have. We will read it, work out what depends on what, and start watching it for you."
            scene="dawn"
          />

          {/* the empty sheet */}
          <PaperCard depth="lifted" folded style={{ marginBottom: space(7) }}>
            <Row justify="space-between" style={{ marginBottom: space(4) }}>
              <LuggageTag>
                <Text style={[type.stamp, { color: colors.inkMuted }]}>YOUR JOURNEY</Text>
              </LuggageTag>
              <Stamp label="Empty" tint={colors.inkFaint} rotate={6} />
            </Row>

            {SLOTS.map((slot, i) => (
              <View key={`${slot.label}-${i}`}>
                <View style={styles.slot}>
                  <View style={styles.slotIcon}>
                    <TravelIcon name={slot.icon} size={15} color={colors.inkFaint} weight={1.4} />
                  </View>
                  <View style={styles.slotLine} />
                  <Eyebrow color={colors.inkFaint}>{slot.label}</Eyebrow>
                </View>
                {i < SLOTS.length - 1 ? <View style={styles.slotConnector} /> : null}
              </View>
            ))}
          </PaperCard>

          <Eyebrow style={{ marginBottom: space(3) }}>Bring it in from</Eyebrow>
          <View style={{ gap: space(3) }}>
            {SOURCES.map((source, i) => (
              <PopUpCard
                key={source.id}
                index={i}
                depth="lifted"
                onPress={() => void begin(source)}
                accessibilityLabel={`${source.title}. ${source.body}`}
                style={!source.enabled ? { opacity: 0.6 } : undefined}
              >
                <Row gap={space(3.5)}>
                  <View style={styles.sourceIcon}>
                    <TravelIcon name={source.icon} size={20} color={colors.indigo} weight={1.6} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Txt variant="h3">{source.title}</Txt>
                    <Txt variant="meta" color={colors.inkMuted} style={{ marginTop: 3 }}>
                      {source.body}
                    </Txt>
                  </View>
                  {source.enabled ? (
                    <TravelIcon name="chevron" size={16} color={colors.inkFaint} weight={2} />
                  ) : (
                    <Pill label="Soon" />
                  )}
                </Row>
              </PopUpCard>
            ))}
          </View>

          <Pressable
            onPress={() => void begin({ ...SOURCES[0], id: 'DEMO' })}
            style={styles.demo}
            accessibilityRole="button"
            accessibilityLabel="Use the demo itinerary"
          >
            <Row gap={7}>
              <TravelIcon name="spark" size={14} color={colors.indigo} weight={1.8} />
              <Txt variant="small" color={colors.indigo} style={{ fontFamily: fonts.bold }}>
                Use the demo itinerary
              </Txt>
            </Row>
          </Pressable>
        </ScrollView>
      </View>
    );
  }

  /* ---------------- reading the document ---------------- */
  if (mode === 'READING') {
    return (
      <View style={styles.root}>
        <SceneBackdrop variant="dawn" />
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Animated.View entering={FadeIn.duration(motion.settle)}>
            <Eyebrow color={colors.indigo}>Reading</Eyebrow>
            <Txt variant="h1" accessibilityRole="header" style={{ marginTop: space(2) }}>
              {fileName ?? 'Your itinerary'}
            </Txt>
          </Animated.View>

          {/* the sheet filling in */}
          <PaperCard depth="lifted" style={{ marginTop: space(6) }}>
            <Row justify="space-between" style={{ marginBottom: space(4) }}>
              <LuggageTag edge={colors.indigo}>
                <Text style={[type.stamp, { color: colors.indigo }]}>ASSEMBLING</Text>
              </LuggageTag>
              <Text style={[type.code, { color: colors.inkMuted }]}>
                {filled}/{recognised.length || SLOTS.length}
              </Text>
            </Row>

            <View style={{ gap: space(2) }}>
              {(recognised.length ? recognised : SLOTS.map((s) => ({ kind: 'FLIGHT', title: s.label }))).map(
                (item, i) => {
                  const on = i < filled;
                  return (
                    <Animated.View key={`${item.title}-${i}`} layout={LinearTransition.springify()}>
                      {on ? (
                        <Animated.View entering={FadeInDown.duration(motion.quick)}>
                          <Row gap={space(2.5)} style={styles.filledRow}>
                            <TravelIcon name={kindIcon[item.kind] ?? 'pin'} size={14} color={colors.indigo} weight={1.7} />
                            <Txt variant="small" numberOfLines={1} style={{ flex: 1, fontFamily: fonts.bold }}>
                              {item.title}
                            </Txt>
                            <TravelIcon name="check" size={13} color={colors.indigo} weight={2.6} />
                          </Row>
                        </Animated.View>
                      ) : (
                        <View style={styles.pendingRow}>
                          <View style={styles.slotLine} />
                        </View>
                      )}
                    </Animated.View>
                  );
                },
              )}
            </View>
          </PaperCard>

          {/* what the parser is doing */}
          <View style={{ marginTop: space(6), gap: space(3.5) }}>
            {stages.map((stage, i) => {
              const state = i < stageIndex ? 'done' : i === stageIndex ? 'active' : 'waiting';
              return (
                <Row key={stage.key} gap={space(3)} align="flex-start">
                  <View
                    style={[
                      styles.stageMark,
                      state === 'done' && { backgroundColor: colors.indigo, borderColor: colors.indigo },
                      state === 'active' && { borderColor: colors.indigo, borderWidth: 2.5 },
                    ]}
                  >
                    {state === 'done' ? <TravelIcon name="check" size={10} color={colors.mist} weight={3} /> : null}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Txt variant="h3" color={state === 'waiting' ? colors.inkFaint : colors.ink} style={{ fontSize: 15 }}>
                      {stage.label}
                    </Txt>
                    {state !== 'waiting' ? (
                      <Txt variant="meta" color={colors.inkMuted} style={{ marginTop: 2 }}>
                        {stage.detail}
                      </Txt>
                    ) : null}
                  </View>
                </Row>
              );
            })}
          </View>
        </ScrollView>
      </View>
    );
  }

  /* ---------------- ready ---------------- */
  return (
    <View style={styles.root}>
      <SceneBackdrop variant="dawn" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Animated.View entering={FadeInDown.duration(motion.page)}>
          <Stamp label="Journey built" tint={colors.indigo} fill={colors.periSoft} rotate={-5} icon={<TravelIcon name="check" size={11} color={colors.indigo} weight={2.6} />} />
          <Txt variant="hero" accessibilityRole="header" style={{ marginTop: space(4) }}>
            Your journey is ready.
          </Txt>
          <Txt variant="body" color={colors.inkMuted} style={{ marginTop: space(3) }}>
            {parse?.summary}
          </Txt>
        </Animated.View>

        {overview ? (
          <PopUpCard index={0} depth="lifted" folded style={{ marginTop: space(6) }}>
            <Eyebrow>Your journey</Eyebrow>
            <Txt variant="h2" style={{ marginTop: space(2) }}>
              {overview.trip.origin.city} → {overview.trip.destination.city}
            </Txt>
            <Txt variant="meta" color={colors.inkMuted} style={{ marginTop: 3 }}>
              {overview.subhead}
            </Txt>
            <JourneyRibbon nodes={overview.trip.nodes} variant="cities" orientation="horizontal" style={{ marginTop: space(4) }} />
          </PopUpCard>
        ) : null}

        <View style={{ marginTop: space(6) }}>
          <Eyebrow style={{ marginBottom: space(3) }}>Recognised bookings</Eyebrow>
          <View style={{ gap: space(2) }}>
            {recognised.map((item, i) => (
              <Animated.View key={`${item.title}-${i}`} entering={FadeInDown.delay(i * 35).duration(motion.quick)}>
                {/* No confidence figure and no confidence-tinted edge. The
                    parser's number is a fixed per-kind rule rather than a real
                    measurement, so showing it — as a percentage or as an
                    unexplained amber edge — would claim more than we know. */}
                <TravelTicket accent={colors.peri} depth="flat">
                  <Row gap={space(2.5)}>
                    <TravelIcon name={kindIcon[item.kind] ?? 'pin'} size={14} color={colors.inkMuted} weight={1.7} />
                    <Txt variant="small" numberOfLines={1} style={{ flex: 1 }}>
                      {item.title}
                    </Txt>
                    <TravelIcon name="check" size={13} color={colors.indigo} weight={2.6} />
                  </Row>
                </TravelTicket>
              </Animated.View>
            ))}
          </View>
        </View>
      </ScrollView>

      <StickyCTA
        label="Build my trip"
        icon="compass"
        onPress={() => router.replace('/journey')}
        note="Next: your trip becomes a digital twin we can monitor."
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.mist },
  content: { padding: space(6), paddingTop: space(18), paddingBottom: space(14) },
  slot: { flexDirection: 'row', alignItems: 'center', gap: space(3), minHeight: 40 },
  slotIcon: {
    width: 30,
    height: 30,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.ruleStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slotLine: { flex: 1, borderBottomWidth: 1, borderStyle: 'dashed', borderColor: colors.ruleStrong, opacity: 0.8 },
  slotConnector: { width: 1, height: 14, marginLeft: 15, backgroundColor: colors.rule },
  filledRow: {
    backgroundColor: colors.periSoft,
    borderRadius: radius.sm,
    paddingHorizontal: space(2.5),
    paddingVertical: space(2.5),
  },
  pendingRow: { paddingVertical: space(3.5), justifyContent: 'center' },
  sourceIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.periSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  demo: { marginTop: space(7), alignSelf: 'center', minHeight: touch.min, justifyContent: 'center' },
  stageMark: {
    width: 19,
    height: 19,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.ruleStrong,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
});
