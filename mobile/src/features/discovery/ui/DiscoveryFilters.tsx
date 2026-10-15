import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Button } from '../../../shared/ui/Button';
import { Field } from '../../../shared/ui/Field';
import { copy } from '../../../shared/lib/copy';
import { colors, radius, space } from '../../../styles/tokens';
import type { DiscoveryQuery } from '../domain/models';
export function DiscoveryFilters({
  value,
  onChange,
  expanded,
  onToggle,
  onApply,
  onClear,
}: {
  value: DiscoveryQuery;
  onChange(value: DiscoveryQuery): void;
  expanded: boolean;
  onToggle(): void;
  onApply(): void;
  onClear(): void;
}) {
  return (
    <View style={styles.panel}>
      <Field
        label={copy.discover.search}
        value={value.search}
        maxLength={100}
        placeholder={copy.discover.searchPlaceholder}
        returnKeyType="search"
        onSubmitEditing={onApply}
        onChangeText={search => onChange({ ...value, search })}
      />
      {value.kind === 'players' && (
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded }}
          onPress={onToggle}
          style={styles.toggle}
        >
          <Text style={styles.label}>
            {expanded ? copy.discover.hideFilters : copy.discover.filters}
          </Text>
          <Text style={styles.label}>{expanded ? '−' : '+'}</Text>
        </Pressable>
      )}
      {value.kind === 'players' && expanded && (
        <>
          <Field
            label={copy.playerProfile.position}
            value={value.position}
            maxLength={40}
            placeholder={copy.playerProfile.positionPlaceholder}
            onChangeText={position => onChange({ ...value, position })}
          />
          <Text style={styles.label}>{copy.playerProfile.foot}</Text>
          <View style={styles.choices}>
            {(['', 'right', 'left', 'both'] as const).map(foot => (
              <Option
                key={foot}
                selected={value.dominantFoot === foot}
                label={foot ? copy.playerProfile.feet[foot] : copy.discover.all}
                onPress={() => onChange({ ...value, dominantFoot: foot })}
              />
            ))}
          </View>
          <Text style={styles.label}>{copy.discover.availability}</Text>
          <View style={styles.choices}>
            {(
              ['', 'seeking_team', 'open_to_offers', 'not_available'] as const
            ).map(availability => (
              <Option
                key={availability}
                selected={value.availability === availability}
                label={
                  availability
                    ? copy.playerProfile.availabilities[availability]
                    : copy.discover.all
                }
                onPress={() => onChange({ ...value, availability })}
              />
            ))}
          </View>
          <Text style={styles.label}>{copy.discover.footballType}</Text>
          <View style={styles.choices}>
            {(['', 'amateur', 'professional', 'halisaha'] as const).map(
              type => (
                <Option
                  key={type || 'all'}
                  selected={value.footballType === type}
                  label={type ? copy.football.types[type] : copy.discover.all}
                  onPress={() => onChange({ ...value, footballType: type })}
                />
              ),
            )}
          </View>
          <Text style={styles.label}>{copy.discover.licenseStatus}</Text>
          <View style={styles.choices}>
            {(['', 'licensed', 'unlicensed'] as const).map(status => (
              <Option
                key={status || 'all'}
                selected={value.licenseStatus === status}
                label={
                  status
                    ? copy.football.licenseStatuses[status]
                    : copy.discover.all
                }
                onPress={() => onChange({ ...value, licenseStatus: status })}
              />
            ))}
          </View>
        </>
      )}
      <Button label={copy.discover.apply} onPress={onApply} />
      <Pressable
        accessibilityRole="button"
        onPress={onClear}
        style={styles.clear}
      >
        <Text style={styles.helper}>{copy.discover.clear}</Text>
      </Pressable>
    </View>
  );
}
function Option({
  selected,
  label,
  onPress,
}: {
  selected: boolean;
  label: string;
  onPress(): void;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      style={[styles.choice, selected && styles.selected]}
    >
      <Text style={[styles.helper, selected && styles.selectedText]}>
        {label}
      </Text>
    </Pressable>
  );
}
const styles = StyleSheet.create({
  panel: {
    gap: space.md,
    padding: space.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  toggle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 44,
  },
  label: { color: colors.secondary, fontSize: 13, fontWeight: '600' },
  helper: { color: colors.secondary, fontSize: 12 },
  clear: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  choice: {
    minHeight: 44,
    paddingHorizontal: space.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    justifyContent: 'center',
  },
  selected: { backgroundColor: colors.brandWash, borderColor: colors.brand },
  selectedText: { color: colors.brand },
});
