/**
 * SCREEN 16 — Trip resilience. "How hard is your trip to break?"
 *
 * The engine scores this 0–100, but the traveller is never shown the number.
 * A number invites arguing with the arithmetic; a sentence invites doing
 * something. So the page leads with a sky and a plain statement of how the
 * trip feels, and the five measured components appear underneath as unlabelled
 * fills — the shape is readable, the digits are not there to be litigated.
 *
 * The score is still computed, still drives the band, and still orders the
 * suggestions. Nothing changed in the engine.
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { colors, radius, space } from '@/theme';
import {
  ChapterHeader,
  Eyebrow,
  Loading,
  MetricBar,
  Reveal,
  Row,
  ScreenScaffold,
  SectionHeader,
  Txt,
} from '@/components/primitives';
import { PaperCard, Stamp } from '@/components/travel/paper';
import { Scene, type SceneVariant } from '@/components/scene/Scene';
import { TravelIcon, type IconName } from '@/components/travel/TravelIcon';
import { useTrip } from '@/state/store';

/**
 * Band → the words the traveller actually reads. Deliberately about feeling
 * and action, never about magnitude.
 */
const BAND: Record<
  string,
  { headline: string; body: string; tint: string; scene: SceneVariant; icon: IconName }
> = {
  RESILIENT: {
    headline: 'Your trip looks calm.',
    body: 'This itinerary can absorb most single disruptions without costing you an experience.',
    tint: colors.mintInk,
    scene: 'dawn',
    icon: 'sun',
  },
  STABLE: {
    headline: 'Mostly settled.',
    body: 'There is reasonable room in most places. A long delay would still force a trade.',
    tint: colors.skyInk,
    scene: 'dawn',
    icon: 'cloud',
  },
  EXPOSED: {
    headline: 'A few things to watch.',
    body: 'Several handovers have no spare time. One delay and something has to be given up rather than absorbed.',
    tint: colors.amberInk,
    scene: 'mountain',
    icon: 'binoculars',
  },
  FRAGILE: {
    headline: 'This needs attention.',
    body: 'Almost nothing here has a fallback, so any change travels straight through the trip.',
    tint: colors.coralInk,
    scene: 'storm',
    icon: 'warning',
  },
};

const PARTS: Record<string, { label: string; hint: string; icon: IconName }> = {
  connectionBuffer: { label: 'Room between bookings', hint: 'Spare time at each handover', icon: 'clock' },
  weatherExposure: { label: 'Weather cover', hint: 'Outdoor plans with a fallback', icon: 'rain' },
  scheduleDensity: { label: 'Breathing room', hint: 'Headroom against your daily limit', icon: 'calendar' },
  transportFlexibility: { label: 'Other ways to travel', hint: 'Legs with a usable alternative', icon: 'route' },
  backupOptions: { label: 'Backup plans', hint: 'Alternate slots and flexible terms', icon: 'recovery' },
};

/** Three coarse steps, so a fill reads without a scale beside it. */
function toneFor(value: number) {
  if (value >= 70) return colors.mintInk;
  if (value >= 45) return colors.amberInk;
  return colors.coralInk;
}

export function ResilienceSegment() {
  const risks = useTrip((s) => s.risks);

  if (!risks) return <Loading label="Looking things over" icon="shield" />;

  const band = BAND[risks.resilience.band] ?? BAND.EXPOSED;
  const suggestions = risks.resilience.suggestions;

  return (
    <ScreenScaffold>
      <ChapterHeader marker="Chapter six · resilience" title="How steady is your trip?" scene={band.scene} />

      {/* the state, as a sky and a sentence */}
      <PaperCard depth="held" style={styles.hero}>
        <Scene variant={band.scene} height={168} width={900} overlay={false} style={styles.heroScene} />
        <View
          style={styles.heroBody}
          accessible
          accessibilityRole="text"
          accessibilityLabel={`${band.headline} ${band.body}`}
        >
          <Row gap={space(2.5)}>
            <View style={[styles.heroIcon, { backgroundColor: colors.cloud }]}>
              <TravelIcon name={band.icon} size={19} color={band.tint} weight={1.9} />
            </View>
            <Stamp label={risks.resilience.band} tint={band.tint} fill={colors.cloud} />
          </Row>
          <Txt variant="h1" style={{ marginTop: space(3.5) }}>
            {band.headline}
          </Txt>
          <Txt variant="small" color={colors.inkSoft} style={{ marginTop: space(2) }}>
            {band.body}
          </Txt>
        </View>
      </PaperCard>

      {/* the parts, without digits — the fill carries the reading */}
      <PaperCard depth="lifted" style={{ marginTop: space(4) }}>
        <Eyebrow>What that is made of</Eyebrow>
        <View style={{ marginTop: space(4) }}>
          {Object.entries(risks.resilience.breakdown).map(([key, value]) => {
            const part = PARTS[key] ?? { label: key, hint: '', icon: 'compass' as IconName };
            const v = value as number;
            return (
              <Row key={key} gap={space(2.5)} align="flex-start">
                <TravelIcon name={part.icon} size={14} color={toneFor(v)} weight={1.8} style={{ marginTop: 2 }} />
                <View style={{ flex: 1 }}>
                  <MetricBar label={part.label} value={v} showValue={false} tint={toneFor(v)} hint={part.hint} />
                </View>
              </Row>
            );
          })}
        </View>
      </PaperCard>

      {/* what to do about it */}
      {suggestions.length ? (
        <View style={{ marginTop: space(7) }}>
          <SectionHeader
            eyebrow="Make it steadier"
            title="A few things you could do"
            subtitle="Each one removes a specific weak point we found in your itinerary."
          />
          {suggestions.map((suggestion, i) => (
            <Reveal key={suggestion.id} index={i} style={{ marginBottom: space(3) }}>
              <PaperCard depth="lifted" accent={colors.peri}>
                <Row gap={space(3)} align="flex-start">
                  <View style={styles.stepIcon}>
                    <TravelIcon name="recovery" size={16} color={colors.indigo} weight={1.9} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Txt variant="h3" style={{ fontSize: 15 }}>
                      {suggestion.label}
                    </Txt>
                    <Txt variant="meta" color={colors.inkMuted} style={{ marginTop: 4 }}>
                      {suggestion.detail}
                    </Txt>
                  </View>
                </Row>
              </PaperCard>
            </Reveal>
          ))}
        </View>
      ) : null}

      <PaperCard depth="flat" tinted={colors.haze} style={{ marginTop: space(4) }}>
        <Txt variant="meta" color={colors.inkMuted}>
          These five parts are weighted by our own judgement, not by a validated model. They are shown separately so
          you can disagree with the weighting and still read the parts.
        </Txt>
      </PaperCard>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  hero: { padding: 0, overflow: 'hidden' },
  heroScene: { position: 'absolute', left: 0, right: 0, top: 0 },
  heroBody: {
    marginTop: 96,
    backgroundColor: colors.glassDeep,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: space(4.5),
  },
  heroIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.periSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
