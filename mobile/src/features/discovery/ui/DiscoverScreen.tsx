import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Compass } from 'lucide-react-native';
import { Screen } from '../../../shared/ui/Screen';
import { EmptyState } from '../../../shared/ui/EmptyState';
import { PageHeader } from '../../../shared/ui/PageHeader';
import { copy } from '../../../shared/lib/copy';
import { colors, radius, space } from '../../../styles/tokens';
const sections = [
  copy.discover.players,
  copy.discover.clubs,
  copy.discover.coaches,
];
export function DiscoverScreen() {
  const [selected, setSelected] = useState(0);
  return (
    <Screen>
      <PageHeader
        eyebrow={copy.discover.eyebrow}
        title={copy.discover.title}
        description={copy.discover.description}
      />
      <View style={styles.segments}>
        {sections.map((label, index) => (
          <Pressable
            key={label}
            accessibilityRole="tab"
            accessibilityState={{ selected: selected === index }}
            onPress={() => setSelected(index)}
            style={[styles.segment, selected === index && styles.selected]}
          >
            <Text
              style={[
                styles.segmentText,
                selected === index && styles.selectedText,
              ]}
            >
              {label}
            </Text>
          </Pressable>
        ))}
      </View>
      <EmptyState
        icon={Compass}
        title={copy.discover.emptyTitle}
        body={copy.discover.emptyBody}
      />
    </Screen>
  );
}
const styles = StyleSheet.create({
  segments: {
    backgroundColor: colors.surface,
    padding: space.xs,
    flexDirection: 'row',
    borderRadius: radius.md,
    gap: space.xs,
  },
  segment: {
    flex: 1,
    borderRadius: radius.sm,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selected: {
    backgroundColor: colors.raised,
    borderBottomWidth: 2,
    borderBottomColor: colors.brand,
  },
  segmentText: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  selectedText: { color: colors.brand },
});
