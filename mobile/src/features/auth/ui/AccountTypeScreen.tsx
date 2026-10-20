import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  ChevronRight,
  ClipboardList,
  Shield,
  Trophy,
  UserRound,
  type LucideIcon,
} from 'lucide-react-native';
import { AuthFrame } from './AuthFrame';
import { copy } from '../../../shared/lib/copy';
import { colors, radius, space, type } from '../../../styles/tokens';
import type { AccountRole } from '../domain/models';

// Players and coaches sign up at once; clubs and organizers apply.
export type SignUpKind = Extract<
  AccountRole,
  'player' | 'coach' | 'club' | 'organizer'
>;
type Option = {
  kind: SignUpKind;
  icon: LucideIcon;
  title: string;
  description: string;
};
const text = copy.accountType;
const instant: Option[] = [
  {
    kind: 'player',
    icon: UserRound,
    title: text.player,
    description: text.playerDescription,
  },
  {
    kind: 'coach',
    icon: ClipboardList,
    title: text.coach,
    description: text.coachDescription,
  },
];
const applied: Option[] = [
  {
    kind: 'club',
    icon: Shield,
    title: text.club,
    description: text.clubDescription,
  },
  {
    kind: 'organizer',
    icon: Trophy,
    title: text.organizer,
    description: text.organizerDescription,
  },
];

// Two groups: accounts that open at once as large tiles, and the ones that
// wait for admin approval as rows under their own note.
export function AccountTypeScreen({
  onBack,
  onInfo,
  onSelect,
}: {
  onBack(): void;
  onInfo?: () => void;
  onSelect(kind: SignUpKind): void;
}) {
  return (
    <AuthFrame
      title={text.title}
      description={text.description}
      onBack={onBack}
      onInfo={onInfo}
      step={1}
    >
      <View style={styles.group}>
        <Text accessibilityRole="header" style={styles.groupTitle}>
          {text.instantTitle}
        </Text>
        <View style={styles.tiles}>
          {instant.map(({ kind, icon: Icon, title, description }) => (
            <Pressable
              key={kind}
              accessibilityRole="button"
              accessibilityLabel={title + ', ' + description}
              onPress={() => onSelect(kind)}
              style={({ pressed }) => [styles.tile, pressed && styles.pressed]}
            >
              <View style={styles.badge}>
                <Icon size={24} color={colors.brand} strokeWidth={2} />
              </View>
              <View style={styles.tileBody}>
                <Text style={styles.tileTitle}>{title}</Text>
                <Text style={styles.description}>{description}</Text>
              </View>
              <View style={styles.go}>
                <ChevronRight size={18} color={colors.brandInk} />
              </View>
            </Pressable>
          ))}
        </View>
      </View>
      <View style={styles.group}>
        <View style={styles.groupHead}>
          <Text accessibilityRole="header" style={styles.groupTitle}>
            {text.applyTitle}
          </Text>
          <Text style={styles.groupHint}>{text.applyHint}</Text>
        </View>
        {applied.map(({ kind, icon: Icon, title, description }) => (
          <Pressable
            key={kind}
            accessibilityRole="button"
            accessibilityLabel={title + ', ' + description}
            onPress={() => onSelect(kind)}
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
          >
            <View style={styles.rowIcon}>
              <Icon size={20} color={colors.text} />
            </View>
            <View style={styles.rowBody}>
              <Text style={styles.rowTitle}>{title}</Text>
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
  group: { gap: space.md },
  groupHead: { gap: 2 },
  groupTitle: { color: colors.text, fontSize: 15, fontWeight: '800' },
  groupHint: { ...type.caption, color: colors.muted },
  tiles: { flexDirection: 'row', gap: space.md },
  tile: {
    flex: 1,
    minHeight: 176,
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.brandSoft,
    backgroundColor: colors.brandWash,
  },
  pressed: { borderColor: colors.brand },
  badge: {
    width: 48,
    height: 48,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brandSoft,
  },
  tileBody: { flex: 1, gap: space.xs },
  tileTitle: { color: colors.text, fontSize: 17, fontWeight: '800' },
  go: {
    alignSelf: 'flex-end',
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brand,
  },
  description: { color: colors.secondary, fontSize: 12, lineHeight: 18 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.lg,
    minHeight: 72,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.raised,
  },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.overlay,
  },
  rowBody: { flex: 1, gap: space.xs },
  rowTitle: { color: colors.text, fontSize: 15, fontWeight: '700' },
});
