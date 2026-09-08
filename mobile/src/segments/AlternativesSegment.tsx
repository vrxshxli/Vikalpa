/**
 * SCREEN 20 — Alternatives explorer.
 *
 * "Other ways to keep your trip moving." The raw building blocks the recovery
 * planner searches over, each drawn as the ticket it would become. Not a
 * booking marketplace — an explorer of recovery parts.
 *
 * Options that cannot seat the party are shown as blocked, with the reason.
 * That is the validator's own reasoning, made visible.
 */
import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import { colors, fonts, space, type } from '@/theme';
import {
  ChapterHeader,
  Chip,
  Divider,
  Empty,
  Eyebrow,
  Loading,
  Pill,
  Reveal,
  Row,
  ScreenScaffold,
  Txt,
} from '@/components/primitives';
import { LuggageTag, PaperCard, Stamp, TravelTicket } from '@/components/travel/paper';
import { TravelIcon, kindIcon } from '@/components/travel/TravelIcon';
import { clock, durationLabel, inr, shortDate, when } from '@/utils/format';
import { useTrip } from '@/state/store';

type Tab = 'TRANSPORT' | 'STAYS' | 'SLOTS';

export function AlternativesSegment() {
  const alternatives = useTrip((s) => s.alternatives);
  const loadAlternatives = useTrip((s) => s.loadAlternatives);
  const [tab, setTab] = useState<Tab>('TRANSPORT');

  useEffect(() => {
    if (!alternatives) void loadAlternatives();
  }, [alternatives, loadAlternatives]);

  if (!alternatives) return <Loading label="Checking what's available" icon="luggage" />;

  const counts = {
    TRANSPORT: alternatives.transport.length,
    STAYS: alternatives.stays.length,
    SLOTS: alternatives.slots.length,
  };
  const empty = counts.TRANSPORT + counts.STAYS + counts.SLOTS === 0;

  return (
    <ScreenScaffold>
      <ChapterHeader
        marker="Chapter eight · explore recovery"
        title="Other ways to keep moving."
        standfirst={`Seeded demo inventory for a party of ${alternatives.party}. The planner draws only from this list — it never invents an option.`}
        scene="sea"
      />

      {empty ? (
        <Empty
          title="Inventory unavailable"
          body="The engine is unreachable, so the parts list could not be loaded. The recovery plans are still readable from the saved copy."
          icon="signal"
        />
      ) : (
        <>
          <Row gap={space(2)} wrap style={{ marginBottom: space(5) }}>
            <Chip label={`Transport ${counts.TRANSPORT}`} icon="plane" active={tab === 'TRANSPORT'} onPress={() => setTab('TRANSPORT')} />
            <Chip label={`Stays ${counts.STAYS}`} icon="hotel" active={tab === 'STAYS'} onPress={() => setTab('STAYS')} />
            <Chip label={`Slots ${counts.SLOTS}`} icon="ticket" active={tab === 'SLOTS'} onPress={() => setTab('SLOTS')} />
          </Row>

          {/* ---------- transport ---------- */}
          {tab === 'TRANSPORT'
            ? alternatives.transport.map((option, i) => (
                <Reveal key={option.id} index={i} style={{ marginBottom: space(3) }}>
                  <TravelTicket
                    accent={option.available ? colors.indigo : colors.coralInk}
                    depth="lifted"
                    tiltIndex={i}
                    stubWidth={78}
                    stub={
                      <View style={{ alignItems: 'center' }}>
                        <Text style={[type.clock, { color: colors.ink }]}>{clock(option.depart)}</Text>
                        <Text style={[type.stamp, { color: colors.inkFaint, fontSize: 8.5, marginTop: 2 }]}>
                          {shortDate(option.depart).toUpperCase()}
                        </Text>
                        <Text style={[type.code, { color: colors.inkFaint, fontSize: 9, marginTop: 5 }]}>
                          {option.ref}
                        </Text>
                      </View>
                    }
                    style={!option.available ? { opacity: 0.78 } : undefined}
                  >
                    <Row justify="space-between" align="flex-start">
                      <View style={{ flex: 1, paddingRight: space(2) }}>
                        <Row gap={6}>
                          <TravelIcon name={kindIcon[option.kind] ?? 'plane'} size={13} color={colors.inkMuted} weight={1.7} />
                          <Eyebrow>replaces {option.replaces}</Eyebrow>
                        </Row>
                        <Txt variant="h3" style={{ marginTop: 5 }}>
                          {option.provider}
                        </Txt>
                        <Txt variant="meta" color={colors.inkMuted} style={{ marginTop: 2 }}>
                          {option.from.code ?? option.from.city} → {option.to.code ?? option.to.city} ·{' '}
                          {durationLabel(option.durationMinutes)}
                        </Txt>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Txt variant="h3">{inr(option.price)}</Txt>
                        <Txt
                          variant="meta"
                          color={option.priceDelta > 0 ? colors.coralInk : colors.indigo}
                          style={{ marginTop: 2 }}
                        >
                          {inr(option.priceDelta, { sign: true })}
                        </Txt>
                      </View>
                    </Row>

                    <Divider dashed style={{ marginVertical: space(3) }} />

                    <Row gap={space(2)} wrap>
                      <Pill
                        label={option.availability}
                        fg={option.available ? colors.indigo : colors.coralInk}
                        bg={option.available ? colors.periSoft : colors.coralSoft}
                        icon={option.available ? 'check' : 'cross'}
                      />
                      {option.verifiedOperator ? <Pill label="Verified" icon="shield" fg={colors.indigo} bg={colors.periSoft} /> : null}
                      <Pill
                        label={option.refundable ? 'Refundable' : 'Non-refundable'}
                        icon={option.refundable ? 'recovery' : 'lock'}
                        fg={option.refundable ? colors.inkSoft : colors.amberInk}
                        bg={option.refundable ? colors.haze : colors.amberSoft}
                      />
                    </Row>

                    <Txt variant="meta" color={colors.inkMuted} style={{ marginTop: space(3) }}>
                      Refund on what you hold: {option.refundImpact}
                    </Txt>
                    {option.notes ? (
                      <Txt variant="meta" color={colors.inkFaint} style={{ marginTop: 4 }}>
                        {option.notes}
                      </Txt>
                    ) : null}

                    {!option.available ? (
                      <Row gap={space(2)} style={{ marginTop: space(3) }} align="flex-start">
                        <TravelIcon name="cross" size={12} color={colors.coralInk} weight={2.4} style={{ marginTop: 2 }} />
                        <Txt variant="meta" color={colors.coralInk} style={{ flex: 1, fontFamily: fonts.bold }}>
                          The validator rejects any plan using this — it cannot seat your party.
                        </Txt>
                      </Row>
                    ) : null}
                  </TravelTicket>
                </Reveal>
              ))
            : null}

          {/* ---------- stays ---------- */}
          {tab === 'STAYS'
            ? alternatives.stays.map((option, i) => (
                <Reveal key={option.id} index={i} style={{ marginBottom: space(3) }}>
                  <PaperCard depth="lifted" tiltIndex={i} folded accent={colors.indigo}>
                    <Row justify="space-between" align="flex-start">
                      <View style={{ flex: 1, paddingRight: space(2) }}>
                        <Row gap={6}>
                          <TravelIcon name="hotel" size={13} color={colors.inkMuted} weight={1.7} />
                          <Eyebrow>replaces {option.replaces}</Eyebrow>
                        </Row>
                        <Txt variant="h3" style={{ marginTop: 5 }}>
                          {option.name}
                        </Txt>
                        <Row gap={5} style={{ marginTop: 3 }}>
                          <TravelIcon name="pin" size={10} color={colors.inkFaint} weight={1.9} />
                          <Txt variant="meta" color={colors.inkMuted}>
                            {option.location.name} · rated {option.rating.toFixed(1)}
                          </Txt>
                        </Row>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Txt variant="h3">{inr(option.pricePerNight)}</Txt>
                        <Txt variant="meta" color={colors.inkFaint}>
                          per night
                        </Txt>
                      </View>
                    </Row>

                    <Row gap={space(2)} wrap style={{ marginTop: space(3.5) }}>
                      <LuggageTag>
                        <Text style={[type.stamp, { color: colors.inkSoft }]}>IN {option.checkInFrom}</Text>
                      </LuggageTag>
                      <LuggageTag>
                        <Text style={[type.stamp, { color: colors.inkSoft }]}>OUT {option.checkOutBy}</Text>
                      </LuggageTag>
                      <Pill
                        label={option.refundImpact}
                        icon={option.refundable ? 'recovery' : 'lock'}
                        fg={option.refundable ? colors.indigo : colors.amberInk}
                        bg={option.refundable ? colors.periSoft : colors.amberSoft}
                      />
                      {option.nearEmergencyFacilities ? <Pill label="Near medical" icon="heart" fg={colors.indigo} bg={colors.periSoft} /> : null}
                    </Row>
                  </PaperCard>
                </Reveal>
              ))
            : null}

          {/* ---------- activity slots ---------- */}
          {tab === 'SLOTS'
            ? alternatives.slots.map((slot, i) => (
                <Reveal key={`${slot.nodeId}-${slot.start}`} index={i} style={{ marginBottom: space(2.5) }}>
                  <TravelTicket
                    accent={slot.current ? colors.indigo : slot.available ? colors.indigo : colors.coralInk}
                    depth="flat"
                    stubWidth={62}
                    stub={
                      <View style={{ alignItems: 'center' }}>
                        <Text style={[type.clock, { color: colors.ink, fontSize: 16 }]}>{clock(slot.start)}</Text>
                        <Text style={[type.stamp, { color: colors.inkFaint, fontSize: 8, marginTop: 2 }]}>
                          {shortDate(slot.start).toUpperCase()}
                        </Text>
                      </View>
                    }
                  >
                    <Row justify="space-between" align="flex-start">
                      <View style={{ flex: 1, paddingRight: space(2) }}>
                        <Txt variant="h3" style={{ fontSize: 14.5 }} numberOfLines={1}>
                          {slot.title}
                        </Txt>
                        <Txt variant="meta" color={colors.inkMuted} style={{ marginTop: 2 }}>
                          {when(slot.start)} – {clock(slot.end)}
                        </Txt>
                      </View>
                      <View style={{ alignItems: 'flex-end', gap: 5 }}>
                        <Txt variant="small" style={{ fontFamily: fonts.bold }}>
                          {inr(slot.price)}
                        </Txt>
                        {slot.current ? (
                          <Stamp label="Booked" tint={colors.indigo} rotate={-5} />
                        ) : (
                          <Pill
                            label={slot.availability}
                            fg={slot.available ? colors.indigo : colors.coralInk}
                            bg={slot.available ? colors.periSoft : colors.coralSoft}
                          />
                        )}
                      </View>
                    </Row>
                  </TravelTicket>
                </Reveal>
              ))
            : null}
        </>
      )}

      <PaperCard depth="flat" tinted={colors.haze} style={{ marginTop: space(4) }}>
        <Row gap={space(2.5)} align="flex-start">
          <TravelIcon name="warning" size={14} color={colors.inkFaint} weight={1.7} />
          <Txt variant="meta" color={colors.inkMuted} style={{ flex: 1 }}>
            Demo inventory. Prices and availability are seeded to make a specific scenario legible — not live market
            data.
          </Txt>
        </Row>
      </PaperCard>
    </ScreenScaffold>
  );
}
