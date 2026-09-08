/**
 * SCREEN 24 — What if? "Stress test your trip."
 *
 * Runs the real cascade engine against a throwaway copy, so the numbers are the
 * numbers you would actually get. Nothing is persisted and the live trip never
 * changes state — which is the point: you can rehearse a bad day without
 * living through one.
 */
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import { colors, radius, space, statusStyle } from '@/theme';
import {
  Button,
  ChapterHeader,
  Divider,
  Empty,
  Eyebrow,
  Loading,
  Pill,
  Row,
  ScreenScaffold,
  SectionHeader,
  StatTile,
  Txt,
} from '@/components/primitives';
import { PaperCard, Stamp } from '@/components/travel/paper';
import { TravelIcon, kindIcon, type IconName } from '@/components/travel/TravelIcon';
import * as haptic from '@/utils/haptics';
import { useTrip } from '@/state/store';

/** A glyph per scenario, so the deck reads at a glance. */
function scenarioIcon(id: string, headline: string): IconName {
  if (id.includes('cancel')) return 'cross';
  if (id.includes('weather') || /rain|wind/i.test(headline)) return 'rain';
  if (id.includes('h1')) return 'hotel';
  if (id.includes('t2') || /transfer/i.test(headline)) return 'transfer';
  if (/connection/i.test(headline)) return 'route';
  return 'plane';
}

export function WhatIfSegment({ onApplyForReal }: { onApplyForReal: () => void }) {
  const scenarios = useTrip((s) => s.scenarios);
  const loadScenarios = useTrip((s) => s.loadScenarios);
  const simulate = useTrip((s) => s.simulate);
  const simulation = useTrip((s) => s.simulation);
  const clearSimulation = useTrip((s) => s.clearSimulation);
  const triggerDisruption = useTrip((s) => s.triggerDisruption);
  const loading = useTrip((s) => s.loading);
  const trip = useTrip((s) => s.overview?.trip ?? null);

  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    if (!scenarios.length) void loadScenarios();
  }, [scenarios.length, loadScenarios]);

  if (!trip) return <Loading label="Loading the twin" icon="route" />;

  const run = (scenarioId: string) => {
    haptic.medium();
    setActiveId(scenarioId);
    void simulate({ scenarioId });
  };

  const reset = () => {
    setActiveId(null);
    clearSimulation();
  };

  return (
    <ScreenScaffold>
      <ChapterHeader
        marker="Chapter ten · test the future"
        title="Stress test your trip."
        standfirst="Each card runs the real cascade engine against a copy of your itinerary. Nothing here changes your actual trip."
        scene="night"
      />

      {scenarios.length === 0 ? (
        <Empty title="No scenarios available" body="The scenario catalogue could not be loaded." icon="signal" />
      ) : (
        <View style={{ gap: space(2.5) }}>
          {scenarios.map((scenario, i) => {
            const on = activeId === scenario.id;
            return (
              <Animated.View key={scenario.id} entering={FadeInDown.delay(i * 35).duration(240)}>
                <Pressable
                  onPress={() => run(scenario.id)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={`Simulate: ${scenario.label}`}
                >
                  <PaperCard
                    depth={on ? 'held' : 'flat'}
                    tinted={on ? colors.amberSoft : colors.cloud}
                    accent={on ? colors.amberInk : colors.ruleStrong}
                    tiltIndex={i}
                  >
                    <Row gap={space(3)}>
                      <View style={[styles.scenarioIcon, { backgroundColor: on ? colors.white : colors.haze }]}>
                        <TravelIcon
                          name={scenarioIcon(scenario.id, scenario.label)}
                          size={17}
                          color={on ? colors.amberInk : colors.inkMuted}
                          weight={1.7}
                          badge="warning"
                          badgeBackground={on ? colors.amberInk : colors.inkFaint}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Txt variant="h3" style={{ fontSize: 15 }}>
                          {scenario.label}
                        </Txt>
                        <Txt variant="meta" color={colors.inkMuted} style={{ marginTop: 2 }} numberOfLines={2}>
                          {scenario.detail}
                        </Txt>
                      </View>
                      {on ? (
                        <Stamp label="Running" tint={colors.amberInk} rotate={-6} />
                      ) : (
                        <TravelIcon name="chevron" size={15} color={colors.inkFaint} weight={2} />
                      )}
                    </Row>
                  </PaperCard>
                </Pressable>
              </Animated.View>
            );
          })}
        </View>
      )}

      {loading.simulate ? <Loading label="Propagating" icon="route" /> : null}

      {simulation && !loading.simulate ? (
        <Animated.View entering={FadeInDown.duration(320)} style={{ marginTop: space(7) }}>
          <PaperCard depth="held" accent={colors.amberInk} tinted={colors.amberSoft} folded>
            <Row justify="space-between" align="flex-start">
              <Pill label="Simulation only" fg={colors.amberInk} bg={colors.white} dot icon="spark" />
              <Stamp label="Not applied" tint={colors.inkFaint} rotate={8} />
            </Row>
            <Txt variant="h2" style={{ marginTop: space(3) }}>
              {simulation.scenario.label}
            </Txt>
            <Txt variant="small" color={colors.inkSoft} style={{ marginTop: space(2) }}>
              {simulation.scenario.detail}
            </Txt>
          </PaperCard>

          <Row gap={space(2)} style={{ marginTop: space(4) }}>
            <StatTile
              label="Downstream"
              value={String(simulation.cascade.downstreamCount)}
              hint="bookings hit"
              tint={simulation.cascade.downstreamCount ? colors.coralInk : colors.indigo}
              icon="route"
            />
            <StatTile
              label="Experiences lost"
              value={String(simulation.cascade.lostExperiences.length)}
              tint={simulation.cascade.lostExperiences.length ? colors.coralInk : colors.indigo}
              icon="heart"
            />
            <StatTile
              label="Recoverable"
              value={simulation.recoverable ? 'Yes' : 'No'}
              hint={`${simulation.planCount} candidates`}
              tint={simulation.recoverable ? colors.indigo : colors.coralInk}
              icon="shield"
            />
          </Row>

          <PaperCard depth="flat" tinted={colors.haze} style={{ marginTop: space(4) }}>
            <Row gap={space(2.5)} align="flex-start">
              <TravelIcon name="binoculars" size={15} color={colors.indigo} weight={1.7} />
              <View style={{ flex: 1 }}>
                <Eyebrow>What would happen</Eyebrow>
                <Txt variant="body" style={{ marginTop: space(1.5) }}>
                  {simulation.narrative}
                </Txt>
              </View>
            </Row>
          </PaperCard>

          {/* the ripple, read out one hop at a time */}
          <View style={{ marginTop: space(6) }}>
            <SectionHeader eyebrow="The chain" title="How it would travel" />
            {simulation.ripple.map((step, i) => {
              const s = statusStyle(step.status);
              return (
                <Animated.View key={step.nodeId} entering={FadeIn.delay(160 + i * 190).duration(300)}>
                  <Row gap={space(3)} align="flex-start">
                    <View style={styles.rail}>
                      <View style={[styles.dot, { backgroundColor: s.ink }]} />
                      {i < simulation.ripple.length - 1 ? <View style={[styles.line, { backgroundColor: s.ink }]} /> : null}
                    </View>
                    <View style={{ flex: 1, paddingBottom: space(4) }}>
                      <Row justify="space-between" align="flex-start">
                        <Row gap={space(2)} style={{ flex: 1, paddingRight: space(2) }}>
                          <TravelIcon name={kindIcon[step.title.includes('→') ? 'FLIGHT' : 'ACTIVITY'] ?? 'pin'} size={13} color={s.ink} weight={1.7} />
                          <Txt variant="h3" style={{ fontSize: 14.5, flex: 1 }} numberOfLines={1}>
                            {step.title}
                          </Txt>
                        </Row>
                        <Stamp label={s.label} tint={s.ink} rotate={-4} />
                      </Row>
                      <Txt variant="meta" color={colors.inkMuted} style={{ marginTop: 4 }}>
                        {step.reason}
                      </Txt>
                    </View>
                  </Row>
                </Animated.View>
              );
            })}
          </View>

          {simulation.bestPlanSummary ? (
            <PaperCard depth="flat" accent={colors.indigo} tinted={colors.periSoft} style={{ marginTop: space(2) }}>
              <Row gap={space(2.5)} align="flex-start">
                <TravelIcon name="recovery" size={15} color={colors.indigo} weight={1.7} />
                <View style={{ flex: 1 }}>
                  <Eyebrow color={colors.indigo}>Best available recovery</Eyebrow>
                  <Txt variant="body" style={{ marginTop: space(1.5) }}>
                    {simulation.bestPlanSummary}
                  </Txt>
                </View>
              </Row>
            </PaperCard>
          ) : null}

          <Divider dashed style={{ marginVertical: space(6) }} />

          <Row gap={space(2.5)}>
            <Button label="Reset" variant="secondary" icon="recovery" onPress={reset} style={{ flex: 1 }} />
            <Button
              label="This really happened"
              icon="warning"
              loading={loading.disruption}
              onPress={() => {
                void triggerDisruption({
                  ...simulation.scenario.disruption,
                  id: '',
                  source: 'MANUAL',
                  detectedAt: new Date().toISOString(),
                }).then(() => {
                  reset();
                  onApplyForReal();
                });
              }}
              style={{ flex: 1.7 }}
            />
          </Row>
        </Animated.View>
      ) : null}
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  scenarioIcon: { width: 38, height: 38, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  rail: { width: 14, alignItems: 'center', alignSelf: 'stretch' },
  dot: { width: 11, height: 11, borderRadius: 6, marginTop: 4 },
  line: { flex: 1, width: 2, opacity: 0.24, marginTop: 4, borderRadius: 1 },
});
