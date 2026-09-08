/**
 * One booking, everything we know about it.
 *
 * The same sheet wherever you tap a node — canvas, digital twin, cascade,
 * ribbon — because it is the same object in the same trip. Laid out like the
 * back of a boarding pass: printed field rows, then why it is affected, then
 * what it holds up.
 */
import React from 'react';
import { View } from 'react-native';

import { colors, fonts, mood, severityMood, space, statusStyle } from '@/theme';
import { Divider, Eyebrow, Pill, RiskBadge, Row, StatusPill, Txt } from '@/components/primitives';
import { BottomSheet } from '@/components/travel/BottomSheet';
import { PaperCard, Stamp } from '@/components/travel/paper';
import { TravelIcon, kindIcon, riskIcon, signalIcon } from '@/components/travel/TravelIcon';
import { clock, durationLabel, inr, minutesBetween, statusLabel, when } from '@/utils/format';
import { useTrip } from '@/state/store';
import type { RiskPoint, RiskSignal, TripNode } from '@/types/domain';

/** Stable empty arrays — a selector returning `?? []` re-renders forever. */
const NO_RISKS: RiskPoint[] = [];
const NO_SIGNALS: RiskSignal[] = [];

export function NodeSheet({ node, onClose }: { node: TripNode | null; onClose: () => void }) {
  const cascade = useTrip((s) => s.cascade);
  const risksResponse = useTrip((s) => s.risks);
  const signalsResponse = useTrip((s) => s.signals);
  const trip = useTrip((s) => s.overview?.trip ?? null);

  const risks = risksResponse?.risks ?? NO_RISKS;
  const signals = signalsResponse?.signals ?? NO_SIGNALS;

  if (!node) {
    return (
      <BottomSheet open={false} onClose={onClose}>
        {null}
      </BottomSheet>
    );
  }

  const s = statusStyle(node.status);
  const impact = cascade?.impacts.find((i) => i.nodeId === node.id) ?? null;
  const nodeRisks = risks.filter((r) => r.nodeIds.includes(node.id));
  const nodeSignals = signals.filter((sig) => sig.relatedNodeIds.includes(node.id));
  const edgesIn = (trip?.edges ?? []).filter((e) => e.to === node.id);
  const edgesOut = (trip?.edges ?? []).filter((e) => e.from === node.id);
  const nameOf = (id: string) => trip?.nodes.find((n) => n.id === id)?.title ?? id;

  return (
    <BottomSheet
      open
      onClose={onClose}
      icon={kindIcon[node.kind] ?? 'pin'}
      eyebrow={node.kind === 'ACTIVITY' ? 'Experience' : node.kind.toLowerCase()}
      title={node.title}
    >
      <Row gap={space(2)} wrap style={{ marginBottom: space(4) }}>
        <StatusPill status={node.status} />
        <Pill
          label={node.priority === 'FIXED' ? 'Fixed booking' : statusLabel(node.priority)}
          icon={node.priority === 'MUST_DO' ? 'heart' : 'ticket'}
        />
        <Pill
          label={node.refundable ? `${node.refundPercent}% refundable` : 'Non-refundable'}
          fg={node.refundable ? colors.indigo : colors.coralInk}
          bg={node.refundable ? colors.periSoft : colors.coralSoft}
          icon={node.refundable ? 'recovery' : 'lock'}
        />
      </Row>

      {/* printed field rows */}
      <PaperCard depth="flat" tinted={colors.haze}>
        <Field label="Starts" value={when(node.start)} />
        <Field label={node.kind === 'HOTEL' ? 'Check-out' : 'Ends'} value={when(node.end)} />
        <Field
          label={node.kind === 'HOTEL' ? 'Stay' : 'Duration'}
          value={durationLabel(minutesBetween(node.start, node.end))}
        />
        {node.from && node.to ? <Field label="Route" value={`${node.from.name} → ${node.to.name}`} /> : null}
        {node.location ? <Field label="Where" value={`${node.location.name}, ${node.location.city}`} /> : null}
        {node.provider ? <Field label="Operator" value={node.provider} /> : null}
        {node.ref ? <Field label="Reference" value={node.ref} mono /> : null}
        <Field label="Cost" value={inr(node.cost)} last />
      </PaperCard>

      {node.openingHours ? (
        <PaperCard depth="flat" tinted={colors.haze} style={{ marginTop: space(3) }}>
          <Row gap={space(2.5)}>
            <TravelIcon name="clock" size={15} color={colors.inkMuted} weight={1.7} />
            <View style={{ flex: 1 }}>
              <Eyebrow>Opening hours</Eyebrow>
              <Txt variant="small" style={{ marginTop: 3 }}>
                {node.openingHours.open}–{node.openingHours.close}
                {node.openingHours.closedDays.length
                  ? ` · closed ${node.openingHours.closedDays.map(dayName).join(', ')}`
                  : ' · open daily'}
              </Txt>
            </View>
          </Row>
        </PaperCard>
      ) : null}

      {node.notes ? (
        <PaperCard depth="flat" tinted={colors.haze} style={{ marginTop: space(3) }}>
          <Eyebrow>Booking terms</Eyebrow>
          <Txt variant="small" color={colors.inkSoft} style={{ marginTop: 4 }}>
            {node.notes}
          </Txt>
        </PaperCard>
      ) : null}

      {/* why this is affected */}
      {impact && impact.status !== 'SAFE' ? (
        <PaperCard accent={s.ink} style={{ marginTop: space(3) }} tinted={s.fill}>
          <Row justify="space-between" align="flex-start">
            <Eyebrow color={s.ink}>Why this is affected</Eyebrow>
            <Stamp label={s.label} tint={s.ink} rotate={-6} />
          </Row>
          <Txt variant="small" style={{ marginTop: space(2.5) }}>
            {impact.reason}
          </Txt>

          {impact.chain.length > 1 ? (
            <View style={{ marginTop: space(4) }}>
              <Eyebrow>Chain of consequence</Eyebrow>
              {impact.chain.map((id, i) => (
                <Row key={id} gap={space(2)} style={{ marginTop: 6 }} align="flex-start">
                  <TravelIcon
                    name={i === 0 ? 'warning' : 'arrowDown'}
                    size={12}
                    color={i === 0 ? s.ink : colors.inkFaint}
                    weight={1.9}
                  />
                  <Txt variant="small" color={i === impact.chain.length - 1 ? colors.ink : colors.inkMuted} style={{ flex: 1 }}>
                    {nameOf(id)}
                  </Txt>
                </Row>
              ))}
            </View>
          ) : null}

          {impact.projectedStart && impact.delayMinutes !== 0 ? (
            <Txt variant="meta" color={colors.inkMuted} style={{ marginTop: space(3) }}>
              Projected start {clock(impact.projectedStart)} — {durationLabel(impact.delayMinutes)} later than booked.
            </Txt>
          ) : null}
        </PaperCard>
      ) : null}

      {/* what it holds up */}
      {edgesIn.length || edgesOut.length ? (
        <PaperCard depth="flat" tinted={colors.haze} style={{ marginTop: space(3) }}>
          <Eyebrow>What this depends on</Eyebrow>
          {edgesIn.map((edge) => (
            <Row key={edge.id} gap={space(2)} style={{ marginTop: 7 }} align="flex-start">
              <TravelIcon name="arrowRight" size={12} color={colors.inkFaint} weight={1.9} style={{ transform: [{ rotate: '180deg' }] }} />
              <Txt variant="small" color={colors.inkSoft} style={{ flex: 1 }}>
                Needs {nameOf(edge.from)} — {edge.label}
              </Txt>
            </Row>
          ))}
          {edgesOut.map((edge) => (
            <Row key={edge.id} gap={space(2)} style={{ marginTop: 7 }} align="flex-start">
              <TravelIcon name="arrowRight" size={12} color={colors.indigo} weight={1.9} />
              <Txt variant="small" color={colors.inkSoft} style={{ flex: 1 }}>
                Holds up {nameOf(edge.to)} — {edge.label}
              </Txt>
            </Row>
          ))}
        </PaperCard>
      ) : null}

      {nodeRisks.length ? (
        <View style={{ marginTop: space(4) }}>
          <Eyebrow style={{ marginBottom: space(2) }}>Risk on this booking</Eyebrow>
          {nodeRisks.map((risk) => (
            <PaperCard key={risk.id} depth="flat" tinted={colors.haze} style={{ marginBottom: space(2) }}>
              <Row justify="space-between" align="flex-start">
                <Txt variant="small" style={{ flex: 1, fontFamily: fonts.bold, paddingRight: space(2) }}>
                  {risk.title}
                </Txt>
                <RiskBadge severity={risk.severity} kind={riskIcon[risk.kind]} />
              </Row>
              <Txt variant="meta" color={colors.inkMuted} style={{ marginTop: 5 }}>
                {risk.whyItMatters}
              </Txt>
            </PaperCard>
          ))}
        </View>
      ) : null}

      {nodeSignals.length ? (
        <View style={{ marginTop: space(4) }}>
          <Eyebrow style={{ marginBottom: space(2) }}>Live signals touching this</Eyebrow>
          {nodeSignals.map((signal) => (
            <PaperCard
              key={signal.id}
              depth="flat"
              tinted={mood[severityMood[signal.severity]].fill}
              style={{ marginBottom: space(2) }}
            >
              <Row justify="space-between" align="flex-start">
                <Row gap={space(2)} style={{ flex: 1, paddingRight: space(2) }} align="flex-start">
                  <TravelIcon
                    name={signalIcon[signal.kind] ?? 'signal'}
                    size={14}
                    color={mood[severityMood[signal.severity]].ink}
                    weight={1.7}
                  />
                  <Txt variant="small" style={{ flex: 1, fontFamily: fonts.bold }}>
                    {signal.headline}
                  </Txt>
                </Row>
                <RiskBadge severity={signal.severity} />
              </Row>
              <Txt variant="meta" color={colors.inkMuted} style={{ marginTop: 5 }}>
                {signal.tripImpact}
              </Txt>
            </PaperCard>
          ))}
        </View>
      ) : null}
    </BottomSheet>
  );
}

function Field({ label, value, last, mono }: { label: string; value: string; last?: boolean; mono?: boolean }) {
  return (
    <View>
      <Row justify="space-between" style={{ paddingVertical: space(2) }} align="flex-start">
        <Txt variant="meta" color={colors.inkMuted}>
          {label}
        </Txt>
        <Txt
          variant={mono ? 'code' : 'small'}
          style={{ flex: 1, textAlign: 'right', paddingLeft: space(3) }}
          numberOfLines={2}
        >
          {value}
        </Txt>
      </Row>
      {!last ? <Divider /> : null}
    </View>
  );
}

function dayName(index: number): string {
  return ['Sundays', 'Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays'][index] ?? '';
}
