import React from 'react';
import {
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import { colors, radius, space, type } from '../../../styles/tokens';

// Building blocks shared by the coach and staff screens.
export function Section({
  title,
  hint,
  children,
  style,
}: React.PropsWithChildren<{
  title: string;
  hint?: string;
  style?: ViewStyle;
}>) {
  return (
    <View style={[styles.section, style]}>
      <View style={styles.intro}>
        <Text accessibilityRole="header" style={styles.title}>
          {title}
        </Text>
        {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      </View>
      {children}
    </View>
  );
}

export function Chip({
  label,
  selected,
  onPress,
  disabled,
  multi = false,
}: {
  label: string;
  selected: boolean;
  onPress(): void;
  disabled?: boolean;
  multi?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole={multi ? 'checkbox' : 'radio'}
      accessibilityState={{ checked: selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        selected && styles.chipSelected,
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
        {label}
      </Text>
    </Pressable>
  );
}

export function Chips({ children }: React.PropsWithChildren) {
  return <View style={styles.chips}>{children}</View>;
}

export function Label({ children }: React.PropsWithChildren) {
  return <Text style={styles.label}>{children}</Text>;
}

export function ToggleRow({
  label,
  hint,
  value,
  onChange,
  disabled,
}: {
  label: string;
  hint?: string;
  value: boolean;
  onChange(value: boolean): void;
  disabled?: boolean;
}) {
  // The whole row flips the switch; the Switch stays the accessible element.
  return (
    <Pressable
      accessible={false}
      disabled={disabled}
      onPress={() => onChange(!value)}
      style={styles.toggle}
    >
      <View style={styles.toggleCopy}>
        <Text style={styles.toggleLabel}>{label}</Text>
        {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      </View>
      <Switch
        accessibilityLabel={label}
        value={value}
        disabled={disabled}
        onValueChange={onChange}
        trackColor={{ false: colors.border, true: colors.brand }}
        thumbColor={value ? colors.brandInk : colors.text}
      />
    </Pressable>
  );
}

// A small rounded tag, e.g. a permission on a staff card.
export function Tag({ label, strong }: { label: string; strong?: boolean }) {
  return <Text style={[styles.tag, strong && styles.tagStrong]}>{label}</Text>;
}

const styles = StyleSheet.create({
  section: {
    padding: space.xl,
    gap: space.lg,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.lg,
  },
  intro: { gap: space.xs },
  title: { ...type.headline, fontSize: 15, color: colors.text },
  hint: { ...type.caption, color: colors.secondary, lineHeight: 18 },
  label: { color: colors.secondary, fontSize: 12, fontWeight: '600' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: {
    minHeight: 44,
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
    paddingHorizontal: space.lg,
  },
  chipSelected: {
    backgroundColor: colors.brandWash,
    borderColor: colors.brand,
  },
  chipText: { color: colors.secondary, fontSize: 12, fontWeight: '600' },
  chipTextSelected: { color: colors.brand },
  pressed: { opacity: 0.8 },
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: colors.raised,
  },
  toggleCopy: { flex: 1, gap: 2 },
  toggleLabel: { color: colors.text, fontSize: 14, fontWeight: '600' },
  tag: {
    ...type.caption,
    fontSize: 11,
    color: colors.secondary,
    backgroundColor: colors.raised,
    borderRadius: radius.pill,
    paddingHorizontal: space.sm,
    paddingVertical: 2,
    overflow: 'hidden',
  },
  tagStrong: { color: colors.brand, backgroundColor: colors.brandWash },
});
