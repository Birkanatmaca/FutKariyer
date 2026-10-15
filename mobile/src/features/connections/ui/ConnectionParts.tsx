import React, { useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { BadgeCheck, Mail } from 'lucide-react-native';
import { copy } from '../../../shared/lib/copy';
import { ErrorBanner } from '../../../shared/ui/ErrorBanner';
import { colors, radius, space } from '../../../styles/tokens';
import type { Connection, ConnectionParty } from '../domain/models';

type Tone = 'primary' | 'secondary' | 'danger';

export function ActionButton({
  label,
  onPress,
  tone = 'secondary',
  loading,
  disabled,
}: {
  label: string;
  onPress(): void;
  tone?: Tone;
  loading?: boolean;
  disabled?: boolean;
}) {
  const foreground =
    tone === 'primary'
      ? colors.brandInk
      : tone === 'danger'
      ? colors.danger
      : colors.text;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{
        disabled: !!loading || !!disabled,
        busy: !!loading,
      }}
      disabled={loading || disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.action,
        tone === 'primary' && styles.primary,
        tone === 'danger' && styles.danger,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={foreground} />
      ) : (
        <Text style={[styles.actionText, { color: foreground }]}>{label}</Text>
      )}
    </Pressable>
  );
}

export function PartyHeader({ party }: { party: ConnectionParty }) {
  return (
    <View style={styles.party}>
      <Text style={styles.role}>
        {copy.roles[party.role]}
        {party.district ? ' · ' + party.district : ''}
      </Text>
      <Text style={styles.name}>{party.name}</Text>
      {party.verified ? (
        <View style={styles.badge}>
          <BadgeCheck size={15} color={colors.success} />
          <Text style={styles.verified}>{copy.discover.verified}</Text>
        </View>
      ) : null}
    </View>
  );
}

export function ConnectionMessage({ connection }: { connection: Connection }) {
  const date = new Date(
    connection.respondedAt ?? connection.createdAt,
  ).toLocaleDateString('tr-TR', { dateStyle: 'medium' });
  return (
    <View style={styles.messageBlock}>
      {connection.message ? (
        <Text style={styles.message}>{'“' + connection.message + '”'}</Text>
      ) : (
        <Text style={styles.noMessage}>{copy.connections.noMessage}</Text>
      )}
      <Text style={styles.date}>{date}</Text>
    </View>
  );
}

export function EmailContact({ email }: { email: string }) {
  const [error, setError] = useState('');
  async function open() {
    setError('');
    try {
      await Linking.openURL('mailto:' + email);
    } catch {
      setError(copy.connections.emailError);
    }
  }
  return (
    <View style={styles.contact}>
      <View style={styles.contactRow}>
        <Mail size={17} color={colors.brand} />
        <View style={styles.contactText}>
          <Text style={styles.contactLabel}>{copy.connections.email}</Text>
          {email ? (
            <Text selectable style={styles.email}>
              {email}
            </Text>
          ) : (
            <Text style={styles.noEmail}>{copy.connections.noEmail}</Text>
          )}
        </View>
      </View>
      {email ? (
        <ActionButton label={copy.connections.sendEmail} onPress={open} />
      ) : null}
      <ErrorBanner message={error} />
    </View>
  );
}

export const cardStyle = StyleSheet.create({
  card: {
    gap: space.md,
    padding: space.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  actions: { flexDirection: 'row', gap: space.sm },
});

const styles = StyleSheet.create({
  action: {
    flex: 1,
    minHeight: 44,
    paddingHorizontal: space.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.raised,
  },
  primary: { backgroundColor: colors.brand, borderColor: colors.brand },
  danger: { backgroundColor: colors.dangerWash, borderColor: colors.danger },
  pressed: { opacity: 0.82 },
  disabled: { opacity: 0.5 },
  actionText: { fontSize: 14, fontWeight: '700' },
  party: { gap: space.xs },
  role: { color: colors.secondary, fontSize: 12, fontWeight: '600' },
  name: { color: colors.text, fontSize: 16, fontWeight: '800' },
  badge: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  verified: { color: colors.success, fontSize: 12, fontWeight: '700' },
  messageBlock: { gap: space.xs },
  message: { color: colors.text, fontSize: 14, lineHeight: 21 },
  noMessage: { color: colors.muted, fontSize: 13, fontStyle: 'italic' },
  date: { color: colors.muted, fontSize: 11 },
  contact: { gap: space.md },
  contactRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  contactText: { flex: 1, gap: 2 },
  contactLabel: { color: colors.secondary, fontSize: 12, fontWeight: '600' },
  email: { color: colors.text, fontSize: 14, fontWeight: '700' },
  noEmail: { color: colors.muted, fontSize: 13 },
});
