import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Compass, MapPin } from 'lucide-react-native';
import { Screen } from '../../../shared/ui/Screen';
import { EmptyState } from '../../../shared/ui/EmptyState';
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
      <View style={styles.top}>
        <Text style={styles.eyebrow}>{copy.discover.eyebrow}</Text>
        <View style={styles.location}>
          <MapPin size={13} color={colors.brand} />
          <Text style={styles.city}>Ankara</Text>
        </View>
      </View>
      <Text style={styles.title}>{copy.discover.title}</Text>
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
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.sm,
  },
  eyebrow: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.5,
    color: colors.muted,
    flexShrink: 1,
  },
  location: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    backgroundColor: colors.brandWash,
  },
  city: { color: colors.brand, fontSize: 11, fontWeight: '600' },
  title: {
    fontSize: 35,
    lineHeight: 41,
    letterSpacing: -1.2,
    color: colors.text,
    fontWeight: '800',
  },
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
  selected: { backgroundColor: colors.raised },
  segmentText: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  selectedText: { color: colors.text },
});
