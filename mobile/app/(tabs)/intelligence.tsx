/**
 * INSIGHT — everything the engine understands about this trip.
 *
 * Chapters: the digital twin, the risk check, the resilience score, the
 * destination's season, the world around the route, and the stress test.
 */
import React, { useState } from 'react';
import { View } from 'react-native';

import { colors } from '@/theme';
import { JourneyHeader } from '@/components/travel/JourneyHeader';
import { ChapterRail, type Chapter } from '@/components/travel/ChapterRail';
import { TwinSegment } from '@/segments/TwinSegment';
import { RiskSegment } from '@/segments/RiskSegment';
import { ResilienceSegment } from '@/segments/ResilienceSegment';
import { SeasonalSegment } from '@/segments/SeasonalSegment';
import { GlobeSegment } from '@/segments/GlobeSegment';
import { WhatIfSegment } from '@/segments/WhatIfSegment';
import { useGoToTab } from '@/hooks/useGoToTab';

export default function IntelligenceTab() {
  const [target, setTarget] = useState<string | undefined>(undefined);
  const go = useGoToTab();

  const chapters: Chapter[] = [
    { key: 'twin', label: 'Digital twin', icon: 'route', render: () => <TwinSegment /> },
    { key: 'risk', label: 'Risk points', icon: 'binoculars', render: () => <RiskSegment /> },
    { key: 'resilience', label: 'Resilience', icon: 'shield', render: () => <ResilienceSegment /> },
    { key: 'season', label: 'Season', icon: 'cloud', render: () => <SeasonalSegment /> },
    { key: 'world', label: 'World', icon: 'globe', render: () => <GlobeSegment onOpenMonitor={() => go('journey')} /> },
    { key: 'whatif', label: 'What if', icon: 'spark', render: () => <WhatIfSegment onApplyForReal={() => go('recover')} /> },
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
