import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  ChevronRight,
  Shield,
  Trophy,
  UserRound,
  type LucideIcon,
} from 'lucide-react-native';
import { AuthFrame } from './AuthFrame';
import { copy } from '../../../shared/lib/copy';
import { colors, radius, space } from '../../../styles/tokens';
import type { AccountRole } from '../domain/models';

export type SignUpKind = Extract<AccountRole, 'player' | 'club' | 'organizer'>;
const options: {
  kind: SignUpKind;
  icon: LucideIcon;
  title: string;
  description: string;
}[] = [
  {
    kind: 'player',
    icon: UserRound,
    title: copy.accountType.player,
    description: copy.accountType.playerDescription,
  },
  {
    kind: 'club',
    icon: Shield,
    title: copy.accountType.club,
    description: copy.accountType.clubDescription,
  },
  {
    kind: 'organizer',
    icon: Trophy,
    title: copy.accountType.organizer,
    description: copy.accountType.organizerDescription,
  },
];

export function AccountTypeScreen({
  onBack,
  onSelect,
}: {
  onBack(): void;
  onSelect(kind: SignUpKind): void;
}) {
  return (
    <AuthFrame
      title={copy.accountType.title}
      description={copy.accountType.description}
      onBack={onBack}
      compact
    >
      <View style={styles.list}>
        <Text accessibilityRole="header" style={styles.heading}>
          {copy.accountType.heading}
        </Text>
        {options.map(({ kind, icon: Icon, title, description }) => (
          <Pressable
            key={kind}
            accessibilityRole="button"
            accessibilityLabel={title + ', ' + description}
            onPress={() => onSelect(kind)}
            style={({ pressed }) => [styles.card, pressed && styles.pressed]}
          >
            <View style={styles.icon}>
              <Icon size={20} color={colors.text} />
            </View>
            <View style={styles.body}>
              <Text style={styles.title}>{title}</Text>
              <Text style={styles.description}>{description}</Text>
            </View>
            <ChevronRight size={20} color={colors.muted} />
          </Pressable>
        ))}
      </View>
    </AuthFrame>
  );
}
const styles = StyleSheet.create({
  list: { gap: space.md },
  heading: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: -0.4,
    marginBottom: space.xs,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.lg,
    minHeight: 76,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  pressed: { borderColor: colors.brand },
  icon: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.raised,
  },
  body: { flex: 1, gap: space.xs },
  title: { color: colors.text, fontSize: 15, fontWeight: '700' },
  description: { color: colors.secondary, fontSize: 12, lineHeight: 18 },
});
