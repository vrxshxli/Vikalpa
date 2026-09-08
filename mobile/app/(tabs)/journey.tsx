/**
 * JOURNEY — the live trip.
 *
 * Chapters: the journal itself, the live monitor watching it, and the feed of
 * what has changed. Same trip, three distances from it.
 */
import React, { useState } from 'react';
import { View } from 'react-native';

import { colors } from '@/theme';
import { JourneyHeader } from '@/components/travel/JourneyHeader';
import { ChapterRail, type Chapter } from '@/components/travel/ChapterRail';
import { JourneySegment } from '@/segments/JourneySegment';
import { MonitorSegment } from '@/segments/MonitorSegment';
import { ChangedSegment } from '@/segments/ChangedSegment';
import { useGoToTab } from '@/hooks/useGoToTab';
import { useTrip } from '@/state/store';

export default function JourneyTab() {
  const [target, setTarget] = useState<string | undefined>(undefined);
  const selectNode = useTrip((s) => s.selectNode);
  const phase = useTrip((s) => s.phase);
  const go = useGoToTab();

  const inspect = (nodeId: string) => {
    selectNode(nodeId);
    go('intelligence');
  };

  const chapters: Chapter[] = [
    {
      key: 'journal',
      label: 'Journal',
      icon: 'map',
      render: () => (
        <JourneySegment
          onOpenRecovery={() => go('recover')}
          onOpenChanges={() => setTarget('changed')}
          onOpenResilience={() => go('intelligence')}
          onInspectNode={inspect}
        />
      ),
    },
    {
      key: 'monitor',
      label: 'Live monitor',
      icon: 'signal',
      urgent: phase === 'MONITORING',
      render: () => <MonitorSegment onReport={() => go('recover')} onTraced={() => go('recover')} />,
    },
    { key: 'changed', label: 'What changed', icon: 'clock', render: () => <ChangedSegment /> },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: colors.mist }}>
      <ChapterRail
        chapters={chapters}
        initialKey={target}
        onChapterChange={() => setTarget(undefined)}
        header={
          <JourneyHeader
            onPressStatus={
              phase === 'DISRUPTED' || phase === 'CHOOSING' || phase === 'PLANNING' ? () => go('recover') : undefined
            }
            onPressNode={inspect}
          />
        }
      />
    </View>
  );
}
