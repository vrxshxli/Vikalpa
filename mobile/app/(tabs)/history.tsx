/**
 * JOURNAL — the trip's own diary.
 *
 * Everything the engine did, dated and stamped, with the reasoning it recorded
 * at the time. One chapter, because this is one continuous record.
 */
import React from 'react';
import { View } from 'react-native';

import { colors } from '@/theme';
import { JourneyHeader } from '@/components/travel/JourneyHeader';
import { HistorySegment } from '@/segments/HistorySegment';

export default function HistoryTab() {
  return (
    <View style={{ flex: 1, backgroundColor: colors.mist }}>
      <JourneyHeader showRibbon={false} />
      <HistorySegment />
    </View>
  );
}
