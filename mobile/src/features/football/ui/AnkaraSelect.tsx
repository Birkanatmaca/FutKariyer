import React, { useEffect, useRef, type PropsWithChildren } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Check, ChevronDown, Lock, type LucideIcon } from 'lucide-react-native';
import { copy } from '../../../shared/lib/copy';
import { useReducedMotion } from '../../../shared/lib/useReducedMotion';
import { colors, radius, space, type } from '../../../styles/tokens';

const text = copy.footballData;
// Long lists (a season can have 17+ leagues) scroll inside the field.
const listMaxHeight = 320;

// One numbered step of the season → league → group selection. The list opens
// inline beneath the field; a locked step waits for the previous one.
export function AnkaraSelect({
  step,
  label,
  value,
  open,
  locked = false,
  busy = false,
  onToggle,
  accessory,
  children,
}: PropsWithChildren<{
  step: number;
  label: string;
  value: string | null;
  open: boolean;
  // The previous step has no value yet.
  locked?: boolean;
  // A new selection is loading.
  busy?: boolean;
  onToggle(): void;
  // A small control shown beside the field, e.g. the previous-season jump.
  accessory?: React.ReactNode;
}>) {
  // Read once per field: the list mounts on open, before an async read
  // of the setting could finish.
  const reduced = useReducedMotion();
  const disabled = locked || busy;
  const expanded = open && !disabled;
  return (
    <View style={styles.step}>
      <View style={styles.fieldRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={text.selectStep(step, label, value)}
          accessibilityHint={locked ? text.selectLocked : undefined}
          accessibilityState={{ expanded, disabled }}
          aria-expanded={expanded}
          disabled={disabled}
          onPress={onToggle}
          style={({ pressed }) => [
            styles.field,
            expanded && styles.fieldOpen,
            locked && styles.locked,
            pressed && styles.pressed,
          ]}
        >
          <View style={[styles.badge, value && !locked && styles.badgeDone]}>
            <Text
              style={[styles.badgeText, value && !locked && styles.badgeInk]}
            >
              {step}
            </Text>
          </View>
          <View style={styles.fieldText}>
            <Text style={styles.label}>{label.toLocaleUpperCase('tr-TR')}</Text>
            <Text
              numberOfLines={1}
              style={[styles.value, !value && styles.placeholder]}
            >
              {value ?? text.selectPlaceholder}
            </Text>
          </View>
          {busy && !locked ? (
            <ActivityIndicator size="small" color={colors.brand} />
          ) : locked ? (
            <Lock size={16} color={colors.muted} />
          ) : (
            <Chevron open={expanded} reduced={reduced} />
          )}
        </Pressable>
        {accessory}
      </View>
      {expanded ? <SelectList reduced={reduced}>{children}</SelectList> : null}
    </View>
  );
}

function Chevron({ open, reduced }: { open: boolean; reduced: boolean }) {
  const turn = useRef(new Animated.Value(open ? 1 : 0)).current;
  useEffect(() => {
    if (reduced) {
      turn.setValue(open ? 1 : 0);
      return;
    }
    Animated.timing(turn, {
      toValue: open ? 1 : 0,
      duration: 160,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [open, reduced, turn]);
  const rotate = turn.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });
  return (
    <Animated.View style={{ transform: [{ rotate }] }}>
      <ChevronDown size={18} color={open ? colors.brand : colors.secondary} />
    </Animated.View>
  );
}

// Fades and drops in; with reduced motion it simply appears.
function SelectList({
  reduced,
  children,
}: PropsWithChildren<{ reduced: boolean }>) {
  const show = useRef(new Animated.Value(reduced ? 1 : 0)).current;
  useEffect(() => {
    if (reduced) {
      show.setValue(1);
      return;
    }
    Animated.timing(show, {
      toValue: 1,
      duration: 180,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [reduced, show]);
  const translateY = show.interpolate({
    inputRange: [0, 1],
    outputRange: [-6, 0],
  });
  return (
    <Animated.View
      style={[styles.list, { opacity: show, transform: [{ translateY }] }]}
    >
      <ScrollView
        nestedScrollEnabled
        style={styles.scroll}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator
      >
        {children}
      </ScrollView>
    </Animated.View>
  );
}

export function SelectOption({
  label,
  selected,
  tone,
  onPress,
}: {
  label: string;
  selected: boolean;
  // League family colour dot.
  tone?: string;
  onPress(): void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.option,
        selected && styles.optionSelected,
        pressed && styles.pressed,
      ]}
    >
      {tone ? <View style={[styles.dot, { backgroundColor: tone }]} /> : null}
      <Text
        numberOfLines={2}
        style={[styles.optionText, selected && styles.optionTextSelected]}
      >
        {label}
      </Text>
      {selected ? <Check size={17} color={colors.brand} /> : null}
    </Pressable>
  );
}

// Family header inside the league list, e.g. "AMATÖR".
export function SelectSection({
  label,
  icon: Icon,
  tone,
}: {
  label: string;
  icon: LucideIcon;
  tone: string;
}) {
  return (
    <View accessibilityRole="header" style={styles.section}>
      <Icon size={13} color={tone} />
      <Text style={[styles.sectionText, { color: tone }]}>
        {label.toLocaleUpperCase('tr-TR')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  step: { gap: space.sm },
  fieldRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  field: {
    flex: 1,
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.surface,
  },
  fieldOpen: { borderColor: colors.brandSoft, backgroundColor: colors.raised },
  locked: { opacity: 0.45 },
  pressed: { opacity: 0.85 },
  badge: {
    width: 26,
    height: 26,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.raised,
  },
  badgeDone: { backgroundColor: colors.brand, borderColor: colors.brand },
  badgeText: {
    ...type.number,
    color: colors.secondary,
    fontSize: 12,
    fontWeight: '800',
  },
  badgeInk: { color: colors.brandInk },
  fieldText: { flex: 1, minWidth: 0, gap: 2 },
  label: { ...type.eyebrow, fontSize: 10, color: colors.muted },
  value: { color: colors.text, fontSize: 15, fontWeight: '700' },
  placeholder: { color: colors.muted, fontWeight: '600' },
  list: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.raised,
    overflow: 'hidden',
  },
  scroll: { maxHeight: listMaxHeight },
  listContent: { padding: space.xs },
  option: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.sm,
  },
  optionSelected: { backgroundColor: colors.brandWash },
  dot: { width: 7, height: 7, borderRadius: 4 },
  optionText: {
    flex: 1,
    color: colors.secondary,
    fontSize: 14,
    fontWeight: '600',
  },
  optionTextSelected: { color: colors.brand, fontWeight: '800' },
  section: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    paddingHorizontal: space.md,
    paddingTop: space.md,
    paddingBottom: space.xs,
  },
  sectionText: { ...type.eyebrow, fontSize: 10, letterSpacing: 1.2 },
});
