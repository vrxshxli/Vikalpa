/**
 * RECOVER — the disruption-to-relief journey.
 *
 * Chapters: Impact → Options → Compare → Why → Before/after, plus the two ways
 * in (Report), the parts list (Inventory) and the concierge (Assistant).
 *
 * The rail auto-advances as the engine's phase changes, so accepting a plan or
 * generating a deck carries you forward without a navigation decision.
 */
import React, { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';

import { colors } from '@/theme';
import { JourneyHeader } from '@/components/travel/JourneyHeader';
import { ChapterRail, type Chapter } from '@/components/travel/ChapterRail';
import { ImpactSegment } from '@/segments/ImpactSegment';
import { OptionsSegment } from '@/segments/OptionsSegment';
import { CompareSegment } from '@/segments/CompareSegment';
import { WhySegment } from '@/segments/WhySegment';
import { PlanDetailSegment } from '@/segments/PlanDetailSegment';
import { ReportSegment } from '@/segments/ReportSegment';
import { AlternativesSegment } from '@/segments/AlternativesSegment';
import { AssistantSegment } from '@/segments/AssistantSegment';
import { useTrip } from '@/state/store';

export default function RecoverTab() {
  const phase = useTrip((s) => s.phase);
  const plans = useTrip((s) => s.plans);
  const generatePlans = useTrip((s) => s.generatePlans);
  const selectedPlanId = useTrip((s) => s.selectedPlanId);

  const [target, setTarget] = useState<string | undefined>(undefined);
  const [planId, setPlanId] = useState<string | null>(null);
  const lastPhase = useRef(phase);

  /* Follow the story: a new deck lands on the options, an accepted plan lands
     on the rebuilt trip. */
  useEffect(() => {
    if (lastPhase.current === phase) return;
    lastPhase.current = phase;
    if (phase === 'DISRUPTED') setTarget('impact');
    if (phase === 'CHOOSING') setTarget('options');
    if (phase === 'RECOVERED') setTarget('plan');
  }, [phase]);

  useEffect(() => {
    if (planId) return;
    const recommended = plans.find((p) => p.recommended) ?? plans[0];
    if (recommended) setPlanId(selectedPlanId ?? recommended.id);
  }, [plans, planId, selectedPlanId]);

  const openPlan = (id: string) => {
    setPlanId(id);
    setTarget('plan');
  };

  const chapters: Chapter[] = [
    {
      key: 'impact',
      label: 'Impact',
      icon: 'warning',
      urgent: phase === 'DISRUPTED',
      render: () => (
        <ImpactSegment
          onFindOptions={() => {
            setTarget('options');
            if (!plans.length) void generatePlans();
          }}
        />
      ),
    },
    { key: 'options', label: 'Options', icon: 'recovery', render: () => <OptionsSegment onOpenPlan={openPlan} /> },
    { key: 'compare', label: 'Compare', icon: 'compass', render: () => <CompareSegment onOpenPlan={openPlan} /> },
    { key: 'why', label: 'Why this', icon: 'spark', render: () => <WhySegment planId={planId} onPlanId={setPlanId} /> },
    {
      key: 'plan',
      label: phase === 'RECOVERED' ? 'Rebuilt' : 'Before / after',
      icon: 'ticket',
      render: () => <PlanDetailSegment planId={planId} onPlanId={setPlanId} />,
    },
    { key: 'report', label: 'Report', icon: 'warning', render: () => <ReportSegment onAnalysed={() => setTarget('impact')} /> },
    { key: 'inventory', label: 'Inventory', icon: 'luggage', render: () => <AlternativesSegment /> },
    {
      key: 'assistant',
      label: 'Concierge',
      icon: 'signal',
      render: () => <AssistantSegment onPlansReady={() => setTarget('options')} />,
    },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: colors.mist }}>
      <ChapterRail
        chapters={chapters}
        initialKey={target}
        onChapterChange={() => setTarget(undefined)}
        header={<JourneyHeader showRibbon={false} />}
      />
    </View>
  );
}
