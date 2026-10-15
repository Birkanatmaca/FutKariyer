import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  BadgeCheck,
  ChevronRight,
  Lock,
  Medal,
  Shield,
  UserRound,
  VenetianMask,
} from 'lucide-react-native';
import { ProBadge } from '../../../shared/ui/ProBadge';
import { copy } from '../../../shared/lib/copy';
import { colors, radius, space } from '../../../styles/tokens';
import type { VisitorRole, VisitorRow } from '../domain/models';
import { formatRelative } from './format';

const roleIcons = {
  player: UserRound,
  club: Shield,
  coach: UserRound,
  organizer: Medal,
} as const;

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(word => Array.from(word)[0])
    .join('')
    .toLocaleUpperCase('tr-TR');
}

export function VisitorRowCard({
  row,
  now,
  onOpen,
}: {
  row: VisitorRow;
  now: Date;
  onOpen?(): void;
}) {
  const when = formatRelative(row.lastVisitedAt, now);
  if (row.kind !== 'visitor') {
    // Anonymous rows: no name or photo, only a role icon (when visible), time and public district.
    const role: VisitorRole | null = row.kind === 'obscured' ? row.role : null;
    const Icon = role ? roleIcons[role] : VenetianMask;
    const title = role
      ? copy.visitors.obscured(copy.visitors.roleNouns[role])
      : copy.visitors.privateRow;
    const district = row.kind === 'obscured' ? row.district : undefined;
    return (
      <View
        accessible
        accessibilityLabel={[title, when, district].filter(Boolean).join(', ')}
        accessibilityHint={copy.visitors.locked}
        style={styles.card}
      >
        <View style={[styles.avatar, styles.hiddenAvatar]}>
          <Icon size={20} color={colors.muted} />
        </View>
        <View style={styles.body}>
          <View style={styles.nameRow}>
            <View style={styles.redaction} />
            <Lock size={13} color={colors.muted} />
          </View>
          <Text style={styles.meta}>
            {[title, district, when].filter(Boolean).join(' · ')}
          </Text>
        </View>
      </View>
    );
  }
  const visitor = row.visitor;
  const content = (
    <>
      <View style={styles.avatar}>
        <Text style={styles.initials}>{initials(visitor.fullName)}</Text>
      </View>
      <View style={styles.body}>
        <View style={styles.nameRow}>
          <Text numberOfLines={1} style={styles.name}>
            {visitor.fullName}
          </Text>
          {visitor.verified ? (
            <BadgeCheck
              accessibilityLabel={copy.social.verified}
              size={15}
              color={colors.accent}
            />
          ) : null}
          {visitor.isPro ? <ProBadge /> : null}
        </View>
        <Text numberOfLines={1} style={styles.meta}>
          {[
            copy.roles[visitor.role],
            visitor.club || visitor.district,
            when,
            copy.visitors.visits(row.visitCount),
          ]
            .filter(Boolean)
            .join(' · ')}
        </Text>
        {visitor.private ? (
          <Text style={styles.private}>{copy.visitors.browsedPrivately}</Text>
        ) : null}
      </View>
      {onOpen ? <ChevronRight size={18} color={colors.muted} /> : null}
    </>
  );
  return onOpen ? (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={copy.visitors.open(visitor.fullName)}
      onPress={onOpen}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      {content}
    </Pressable>
  ) : (
    <View style={styles.card}>{content}</View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.surface,
  },
  pressed: { backgroundColor: colors.raised },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brandWash,
    borderWidth: 1,
    borderColor: colors.brandSoft,
  },
  hiddenAvatar: {
    backgroundColor: colors.raised,
    borderColor: colors.border,
  },
  initials: { color: colors.brand, fontSize: 15, fontWeight: '800' },
  body: { flex: 1, minWidth: 0, gap: space.xs },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  name: { flexShrink: 1, color: colors.text, fontSize: 15, fontWeight: '700' },
  // Stands in for the hidden name; no text is rendered underneath.
  redaction: {
    width: 120,
    height: 12,
    borderRadius: radius.pill,
    backgroundColor: colors.overlay,
  },
  meta: { color: colors.secondary, fontSize: 12, lineHeight: 17 },
  private: { color: colors.accent, fontSize: 11, fontWeight: '700' },
});
