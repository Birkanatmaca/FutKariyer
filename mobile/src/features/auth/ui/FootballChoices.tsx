import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  Check,
  IdCard,
  LandPlot,
  Shirt,
  Trophy,
  type LucideIcon,
} from 'lucide-react-native';
import { copy } from '../../../shared/lib/copy';
import {
  declaredCoachLicenses,
  type DeclaredCoachLicense,
  type PlayerFootballType,
} from '../../../shared/domain/football';
import { colors, radius, space, type } from '../../../styles/tokens';

const types: { value: PlayerFootballType; icon: LucideIcon }[] = [
  { value: 'amateur', icon: Shirt },
  { value: 'professional', icon: Trophy },
  { value: 'halisaha', icon: LandPlot },
];

// Three equal tiles for the football type: icon plus a one-word label.
export function FootballTypePicker({
  value,
  error,
  disabled,
  onChange,
}: {
  value: PlayerFootballType | '';
  error?: string;
  disabled: boolean;
  onChange(value: PlayerFootballType): void;
}) {
  const text = copy.signUp;
  return (
    <View style={styles.section}>
      <Text style={styles.label}>{text.footballType}</Text>
      <View style={styles.tiles} accessibilityRole="radiogroup">
        {types.map(({ value: option, icon: Icon }) => {
          const selected = value === option;
          return (
            <Pressable
              key={option}
              accessibilityRole="radio"
              accessibilityLabel={copy.football.types[option]}
              accessibilityState={{ checked: selected, disabled }}
              disabled={disabled}
              onPress={() => onChange(option)}
              style={({ pressed }) => [
                styles.tile,
                selected && styles.tileOn,
                pressed && styles.pressed,
              ]}
            >
              <View style={[styles.icon, selected && styles.iconOn]}>
                <Icon
                  size={20}
                  color={selected ? colors.brand : colors.secondary}
                  strokeWidth={2}
                />
              </View>
              <Text style={[styles.tileText, selected && styles.tileTextOn]}>
                {text.types[option]}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

// One checkbox row: checked means an active license, unchecked means none.
export function LicenseCheck({
  checked,
  disabled,
  onChange,
}: {
  checked: boolean;
  disabled: boolean;
  onChange(checked: boolean): void;
}) {
  const text = copy.signUp;
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={text.license}
      accessibilityHint={text.licenseHint}
      accessibilityState={{ checked, disabled }}
      disabled={disabled}
      onPress={() => onChange(!checked)}
      style={({ pressed }) => [
        styles.license,
        checked && styles.tileOn,
        pressed && styles.pressed,
      ]}
    >
      <View style={[styles.icon, checked && styles.iconOn]}>
        <IdCard
          size={20}
          color={checked ? colors.brand : colors.secondary}
          strokeWidth={2}
        />
      </View>
      <View style={styles.licenseBody}>
        <Text style={styles.licenseTitle}>{text.license}</Text>
        <Text style={styles.licenseHint}>{text.licenseHint}</Text>
      </View>
      <View style={[styles.box, checked && styles.boxOn]}>
        {checked ? (
          <Check size={14} color={colors.brandInk} strokeWidth={3} />
        ) : null}
      </View>
    </Pressable>
  );
}

// A coach picks the licence level they hold; "Lisans yok" is an answer too.
export function CoachLicensePicker({
  value,
  error,
  disabled,
  onChange,
}: {
  value: DeclaredCoachLicense | '';
  error?: string;
  disabled: boolean;
  onChange(value: DeclaredCoachLicense): void;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.label}>{copy.signUp.coachLicense}</Text>
      <View style={styles.pills} accessibilityRole="radiogroup">
        {declaredCoachLicenses.map(option => {
          const selected = value === option;
          const label = copy.coaches.licenses[option];
          return (
            <Pressable
              key={option}
              accessibilityRole="radio"
              accessibilityLabel={label}
              accessibilityState={{ checked: selected, disabled }}
              disabled={disabled}
              onPress={() => onChange(option)}
              style={({ pressed }) => [
                styles.pill,
                selected && styles.tileOn,
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.tileText, selected && styles.tileTextOn]}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: space.sm },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  pill: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  label: { color: colors.secondary, fontSize: 13, fontWeight: '600' },
  tiles: { flexDirection: 'row', gap: space.sm },
  tile: {
    flex: 1,
    alignItems: 'center',
    gap: space.sm,
    paddingVertical: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  tileOn: { borderColor: colors.brand, backgroundColor: colors.brandWash },
  pressed: { opacity: 0.8 },
  icon: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.raised,
  },
  iconOn: { backgroundColor: colors.brandSoft },
  tileText: { ...type.caption, fontSize: 13, color: colors.secondary },
  tileTextOn: { color: colors.text, fontWeight: '700' },
  error: { color: colors.danger, fontSize: 12 },
  license: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  licenseBody: { flex: 1, gap: 2 },
  licenseTitle: { color: colors.text, fontSize: 14, fontWeight: '700' },
  licenseHint: { ...type.caption, color: colors.muted, lineHeight: 17 },
  box: {
    width: 24,
    height: 24,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxOn: { backgroundColor: colors.brand, borderColor: colors.brand },
});
