import React, { type PropsWithChildren } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  Shapes,
  Shield,
  Sprout,
  Swords,
  Venus,
  type LucideIcon,
} from 'lucide-react-native';
import { copy } from '../../../shared/lib/copy';
import { colors, radius, space, type } from '../../../styles/tokens';
import { ankaraLeagueGroup, type AnkaraLeagueGroup } from '../domain/rules';

const text = copy.footballData;

// Each league family keeps one colour and icon across chips and match tags,
// so the families become recognisable without reading.
export const leagueGroupTone: Record<AnkaraLeagueGroup, string> = {
  amateur: colors.brand,
  youth: colors.info,
  girls: colors.accent,
  playoff: colors.warning,
  other: colors.secondary,
};
export const leagueGroupIcon: Record<AnkaraLeagueGroup, LucideIcon> = {
  amateur: Shield,
  youth: Sprout,
  girls: Venus,
  playoff: Swords,
  other: Shapes,
};

export function Chip({
  label,
  selected = false,
  disabled = false,
  icon: Icon,
  tone,
  count,
  accessibilityLabel,
  accessibilityHint,
  onPress,
}: {
  label: string;
  selected?: boolean;
  disabled?: boolean;
  icon?: LucideIcon;
  // A small colour dot before the label.
  tone?: string;
  // A small number after the label.
  count?: number;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  onPress(): void;
}) {
  const ink = selected ? colors.brandInk : colors.secondary;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={() => {
        if (!selected) onPress();
      }}
      style={({ pressed }) => [
        styles.chip,
        selected && styles.selected,
        disabled && !selected && styles.disabled,
        pressed && styles.pressed,
      ]}
    >
      {tone && !selected ? (
        <View style={[styles.dot, { backgroundColor: tone }]} />
      ) : null}
      {Icon ? <Icon size={15} color={selected ? ink : tone ?? ink} /> : null}
      <Text
        numberOfLines={1}
        style={[styles.label, selected && styles.selectedLabel]}
      >
        {label}
      </Text>
      {count !== undefined ? (
        <Text style={[styles.count, selected && styles.selectedLabel]}>
          {count}
        </Text>
      ) : null}
    </Pressable>
  );
}

// One line of chips that scrolls sideways.
export function ChipRow({
  label,
  children,
}: PropsWithChildren<{ label?: string }>) {
  return (
    <ScrollView
      horizontal
      accessibilityLabel={label}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      {children}
    </ScrollView>
  );
}

// The league of a bulletin match, coloured by its family.
export function LeagueTag({ league }: { league: string }) {
  const tone = leagueGroupTone[ankaraLeagueGroup(league)];
  return (
    <View style={styles.tag}>
      <View style={[styles.dot, { backgroundColor: tone }]} />
      <Text numberOfLines={1} style={[styles.tagText, { color: tone }]}>
        {league}
      </Text>
    </View>
  );
}

export function leagueGroupLabel(group: AnkaraLeagueGroup) {
  return text.leagueGroups[group];
}

const styles = StyleSheet.create({
  row: { gap: space.sm, paddingVertical: space.xs, paddingRight: space.lg },
  chip: {
    minHeight: 38,
    maxWidth: 280,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs + 2,
  },
  selected: { backgroundColor: colors.brand, borderColor: colors.brand },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.82 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  label: {
    color: colors.secondary,
    fontSize: 13,
    fontWeight: '700',
    flexShrink: 1,
  },
  selectedLabel: { color: colors.brandInk },
  count: {
    ...type.number,
    color: colors.muted,
    fontSize: 12,
    fontWeight: '800',
  },
  tag: {
    alignSelf: 'flex-start',
    maxWidth: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    paddingHorizontal: space.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: colors.raised,
  },
  tagText: { fontSize: 11, fontWeight: '700', flexShrink: 1 },
});
