import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  Building,
  ChevronRight,
  ClipboardCheck,
  CreditCard,
  Flag,
  Gift,
  Image as ImageIcon,
  ListChecks,
  Megaphone,
  Newspaper,
  Trophy,
  Users,
  type LucideIcon,
} from 'lucide-react-native';
import { copy } from '../../../shared/lib/copy';
import { colors, radius, space } from '../../../styles/tokens';

export type AdminDestination =
  | 'users'
  | 'clubs'
  | 'applications'
  | 'reports'
  | 'ads'
  | 'news'
  | 'reviews'
  | 'leagues'
  | 'gifts'
  | 'announcements'
  | 'payments';

const text = copy.admin.dashboard.links;
const entries: Record<
  AdminDestination,
  { title: string; hint: string; icon: LucideIcon }
> = {
  users: { title: text.users, hint: text.usersHint, icon: Users },
  clubs: { title: text.clubs, hint: text.clubsHint, icon: Building },
  applications: {
    title: text.applications,
    hint: text.applicationsHint,
    icon: ClipboardCheck,
  },
  reports: { title: text.reports, hint: text.reportsHint, icon: Flag },
  ads: { title: text.ads, hint: text.adsHint, icon: ImageIcon },
  news: { title: text.news, hint: text.newsHint, icon: Newspaper },
  reviews: { title: text.reviews, hint: text.reviewsHint, icon: ListChecks },
  leagues: { title: text.leagues, hint: text.leaguesHint, icon: Trophy },
  gifts: { title: text.gifts, hint: text.giftsHint, icon: Gift },
  announcements: {
    title: text.announcements,
    hint: text.announcementsHint,
    icon: Megaphone,
  },
  payments: { title: text.payments, hint: text.paymentsHint, icon: CreditCard },
};
const all = Object.keys(entries) as AdminDestination[];

// Menu rows in the style of the user "Diğer" menu.
export function AdminMenu({
  onOpen,
  only = all,
  badges = {},
}: {
  onOpen(destination: AdminDestination): void;
  only?: AdminDestination[];
  badges?: Partial<Record<AdminDestination, number | undefined>>;
}) {
  return (
    <View style={styles.menu}>
      {only.map(destination => {
        const { title, hint, icon: Icon } = entries[destination];
        const badge = badges[destination];
        return (
          <MenuRow
            key={destination}
            title={title}
            hint={hint}
            icon={Icon}
            badge={badge}
            onPress={() => onOpen(destination)}
          />
        );
      })}
    </View>
  );
}

export function MenuRow({
  title,
  hint,
  icon: Icon,
  badge,
  tone,
  onPress,
}: {
  title: string;
  hint: string;
  icon: LucideIcon;
  badge?: number;
  tone?: 'danger';
  onPress(): void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={badge ? title + ', ' + badge : title}
      accessibilityHint={hint}
      onPress={onPress}
      style={({ pressed }) => [styles.entry, pressed && styles.pressed]}
    >
      <View style={styles.icon}>
        <Icon
          size={22}
          color={tone === 'danger' ? colors.danger : colors.secondary}
        />
      </View>
      <View style={styles.text}>
        <Text
          style={[styles.title, tone === 'danger' && { color: colors.danger }]}
        >
          {title}
        </Text>
        <Text style={styles.hint}>{hint}</Text>
      </View>
      {badge ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge > 99 ? '99+' : badge}</Text>
        </View>
      ) : null}
      <ChevronRight size={18} color={colors.muted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  menu: { gap: space.md },
  entry: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 76,
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  pressed: { backgroundColor: colors.raised },
  icon: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.raised,
  },
  text: { flex: 1, gap: space.xs },
  title: { color: colors.text, fontSize: 16, fontWeight: '700' },
  hint: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  badge: {
    minWidth: 24,
    height: 24,
    paddingHorizontal: space.xs,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: colors.brand,
  },
  badgeText: { color: colors.brandInk, fontSize: 11, fontWeight: '800' },
});
