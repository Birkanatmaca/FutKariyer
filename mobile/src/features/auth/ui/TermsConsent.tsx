import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Check } from 'lucide-react-native';
import { copy } from '../../../shared/lib/copy';
import { openLegal, type LegalPage } from '../../../shared/lib/legal';
import { colors, radius, space } from '../../../styles/tokens';

const links: { page: LegalPage; label: string }[] = [
  { page: 'terms', label: copy.legal.terms },
  { page: 'kvkk', label: copy.legal.kvkk },
  { page: 'privacy', label: copy.legal.privacy },
];

// Required consent on sign-up and club application (23 Oct 2026); the texts
// open from the server's legal pages.
export function TermsConsent({
  checked,
  disabled,
  error,
  onChange,
}: {
  checked: boolean;
  disabled: boolean;
  error?: string;
  onChange(checked: boolean): void;
}) {
  return (
    <View style={styles.root}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityLabel={copy.legal.consent}
        accessibilityState={{ checked, disabled }}
        disabled={disabled}
        onPress={() => onChange(!checked)}
        style={({ pressed }) => [
          styles.row,
          error ? styles.rowError : null,
          pressed && styles.pressed,
        ]}
      >
        <View style={[styles.box, checked && styles.boxOn]}>
          {checked ? (
            <Check size={14} color={colors.brandInk} strokeWidth={3} />
          ) : null}
        </View>
        <Text style={styles.text}>{copy.legal.consent}</Text>
      </Pressable>
      <View style={styles.links}>
        {links.map(({ page, label }) => (
          <Pressable
            key={page}
            accessibilityRole="link"
            onPress={() => openLegal(page).catch(() => undefined)}
            hitSlop={6}
          >
            <Text style={styles.link}>{label}</Text>
          </Pressable>
        ))}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: space.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  rowError: { borderColor: colors.danger },
  pressed: { opacity: 0.8 },
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
  text: { flex: 1, color: colors.text, fontSize: 13, lineHeight: 19 },
  links: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  link: {
    color: colors.brand,
    fontSize: 12,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  error: { color: colors.danger, fontSize: 12 },
});
