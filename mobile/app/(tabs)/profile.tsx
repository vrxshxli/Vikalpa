/**
 * YOU — the constraints the engine optimises against.
 *
 * Chapters: preferences, the crew, what matters most, boundaries, and the
 * inside back cover. Nothing on these pages is decoration; every control feeds
 * the ranker or the validator.
 */
import React from 'react';
import { View } from 'react-native';

import { colors } from '@/theme';
import { JourneyHeader } from '@/components/travel/JourneyHeader';
import { ChapterRail, type Chapter } from '@/components/travel/ChapterRail';
import { PreferencesSegment } from '@/segments/PreferencesSegment';
import { GroupSegment } from '@/segments/GroupSegment';
import { PrioritySegment } from '@/segments/PrioritySegment';
import { SafetySegment } from '@/segments/SafetySegment';
import { AccountSegment } from '@/segments/AccountSegment';

const CHAPTERS: Chapter[] = [
  { key: 'preferences', label: 'Preferences', icon: 'passport', render: () => <PreferencesSegment /> },
  { key: 'crew', label: 'Your crew', icon: 'luggage', render: () => <GroupSegment /> },
  { key: 'priorities', label: 'What matters', icon: 'heart', render: () => <PrioritySegment /> },
  { key: 'safety', label: 'Boundaries', icon: 'shield', render: () => <SafetySegment /> },
  { key: 'account', label: 'Account', icon: 'stamp', render: () => <AccountSegment /> },
];

export default function ProfileTab() {
  return (
    <View style={{ flex: 1, backgroundColor: colors.mist }}>
      <ChapterRail chapters={CHAPTERS} header={<JourneyHeader showRibbon={false} />} />
    </View>
  );
}
