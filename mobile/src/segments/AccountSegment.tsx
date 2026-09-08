/**
 * Account and diagnostics — the inside back cover.
 *
 * Small on purpose. It exists mainly so the engine is inspectable during a
 * demo: which trip is loaded, whether the API is live, and which reader is
 * handling natural language.
 */
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';

import { colors, fonts, radius, space, type } from '@/theme';
import {
  Button,
  ChapterHeader,
  Divider,
  Eyebrow,
  Pill,
  Row,
  ScreenScaffold,
  Txt,
} from '@/components/primitives';
import { LuggageTag, PaperCard, Stamp } from '@/components/travel/paper';
import { TravelIcon } from '@/components/travel/TravelIcon';
import { API_BASE, api } from '@/api/client';
import { inr } from '@/utils/format';
import { useTrip } from '@/state/store';

export function AccountSegment() {
  const overview = useTrip((s) => s.overview);
  const connection = useTrip((s) => s.connection);
  const resetTrip = useTrip((s) => s.resetTrip);
  const loading = useTrip((s) => s.loading);
  const error = useTrip((s) => s.error);

  const [model, setModel] = useState<string | null>(null);

  useEffect(() => {
    void api.health().then((h) => setModel(h.languageModel));
  }, []);

  const live = connection === 'LIVE';

  return (
    <ScreenScaffold>
      <ChapterHeader marker="Inside back cover" title="You and this device" scene="night" />

      <PaperCard depth="lifted">
        <Row justify="space-between" align="center">
          <Row gap={space(3)}>
            <View style={styles.avatar}>
              <TravelIcon name="passport" size={18} color={colors.indigo} weight={1.7} />
            </View>
            <View>
              <Eyebrow>Signed in as</Eyebrow>
              <Txt variant="h3" style={{ marginTop: 3 }}>
                Guest
              </Txt>
            </View>
          </Row>
          <Button label="Sign out" variant="secondary" onPress={() => router.replace('/login')} />
        </Row>
      </PaperCard>

      {overview ? (
        <PaperCard depth="lifted" folded style={{ marginTop: space(4) }}>
          <Row justify="space-between" align="flex-start">
            <View style={{ flex: 1 }}>
              <Eyebrow>Current journey</Eyebrow>
              <Txt variant="h3" style={{ marginTop: 4 }}>
                {overview.trip.title}
              </Txt>
              <Txt variant="meta" color={colors.inkMuted} style={{ marginTop: 3 }}>
                {overview.subhead} · {overview.trip.nodes.length} bookings · {inr(overview.trip.totalCost)}
              </Txt>
            </View>
            <Stamp
              label={overview.status.replace('_', ' ')}
              tint={
                overview.status === 'RECOVERED' || overview.status === 'ON_TRACK' ? colors.indigo : colors.coralInk
              }
              rotate={-7}
            />
          </Row>
        </PaperCard>
      ) : null}

      {/* engine diagnostics */}
      <PaperCard depth="flat" tinted={colors.haze} style={{ marginTop: space(4) }}>
        <Eyebrow>Engine</Eyebrow>
        <View style={{ marginTop: space(3), gap: space(2.5) }}>
          <Row justify="space-between">
            <Row gap={7}>
              <TravelIcon name="signal" size={13} color={live ? colors.indigo : colors.amberInk} weight={1.8} />
              <Txt variant="small" color={colors.inkSoft}>
                API
              </Txt>
            </Row>
            <Pill
              label={live ? 'Live' : connection === 'OFFLINE' ? 'Saved copy' : 'Connecting'}
              fg={live ? colors.indigo : colors.amberInk}
              bg={live ? colors.periSoft : colors.amberSoft}
              dot
            />
          </Row>
          <Divider />
          <Row justify="space-between">
            <Txt variant="small" color={colors.inkSoft}>
              Endpoint
            </Txt>
            <Text style={[type.code, { color: colors.inkMuted }]}>{API_BASE}</Text>
          </Row>
          <Divider />
          <Row justify="space-between">
            <Txt variant="small" color={colors.inkSoft}>
              Language reader
            </Txt>
            <Text style={[type.code, { color: colors.inkMuted }]}>{model ?? '…'}</Text>
          </Row>
        </View>

        {connection === 'OFFLINE' ? (
          <Txt variant="meta" color={colors.inkMuted} style={{ marginTop: space(4) }}>
            The API is unreachable, so screens are reading a precomputed engine snapshot. Everything you see is real
            engine output — it just will not respond to new input until the server is back.
          </Txt>
        ) : null}

        {error ? (
          <Txt variant="meta" color={colors.coralInk} style={{ marginTop: space(3) }}>
            Last error: {error}
          </Txt>
        ) : null}
      </PaperCard>

      <PaperCard depth="lifted" style={{ marginTop: space(4) }}>
        <Eyebrow>Start over</Eyebrow>
        <Txt variant="small" color={colors.inkMuted} style={{ marginTop: 4, marginBottom: space(4) }}>
          Reset returns the journey to the moment it was imported: healthy, un-disrupted, diary cleared.
        </Txt>
        <Row gap={space(2.5)}>
          <Button label="Re-import" variant="secondary" icon="luggage" onPress={() => router.push('/import')} style={{ flex: 1 }} />
          <Button label="Reset trip" icon="recovery" loading={loading.reset} onPress={() => void resetTrip()} style={{ flex: 1 }} />
        </Row>
      </PaperCard>

      {/* colophon */}
      <PaperCard depth="flat" tinted={colors.haze} style={{ marginTop: space(4) }} folded>
        <Row justify="space-between" align="flex-start">
          <LuggageTag edge={colors.indigo}>
            <Text style={[type.stamp, { color: colors.indigo, letterSpacing: 2 }]}>VIKALPA</Text>
          </LuggageTag>
          <TravelIcon name="compass" size={22} color={colors.periMid} weight={1.4} />
        </Row>
        <Txt variant="h3" style={{ marginTop: space(3.5), fontFamily: fonts.text }}>
          हर सफ़र का एक और रास्ता।
        </Txt>
        <Txt variant="small" color={colors.inkMuted} style={{ marginTop: 5 }}>
          When plans change, find another way.
        </Txt>
        <Divider dashed style={{ marginVertical: space(4) }} />
        <Txt variant="meta" color={colors.inkFaint}>
          Demo inventory throughout. Prices and availability are seeded to make a specific scenario legible, not live
          market data.
        </Txt>
      </PaperCard>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  avatar: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    backgroundColor: colors.periSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
