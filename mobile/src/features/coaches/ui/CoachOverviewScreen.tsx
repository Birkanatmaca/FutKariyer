import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { BadgeCheck, BriefcaseBusiness, Pencil } from 'lucide-react-native';
import { Screen } from '../../../shared/ui/Screen';
import { Avatar } from '../../../shared/ui/Avatar';
import { ProBadge } from '../../../shared/ui/ProBadge';
import { ErrorBanner } from '../../../shared/ui/ErrorBanner';
import { copy } from '../../../shared/lib/copy';
import { colors, radius, space, type } from '../../../styles/tokens';
import {
  isFullProfile,
  publicView,
  type CoachCard,
  type CoachRepository,
} from '../domain/models';
import { CoachFacts } from './CoachFacts';

export type CoachCounts = {
  views: number;
  followers: number;
  following: number;
};

// The coach's own Profil page, laid out like a player's: photo, real counts,
// name, the football details they chose to show and their posts.
export function CoachOverviewScreen({
  token,
  userId,
  service,
  fullName,
  avatarUri,
  verified,
  isPro,
  counts,
  onEdit,
  onEditCoach,
  posts,
}: {
  token: string;
  userId: string;
  service: CoachRepository;
  fullName: string;
  avatarUri?: string;
  verified: boolean;
  isPro: boolean;
  counts: CoachCounts | null;
  onEdit(): void;
  onEditCoach(): void;
  posts?: React.ReactNode;
}) {
  const [card, setCard] = useState<CoachCard | null>(null);
  const [error, setError] = useState('');
  useFocusEffect(
    useCallback(() => {
      let current = true;
      service
        .coachCard(token, userId)
        .then(value => {
          if (current) {
            setCard(value);
            setError('');
          }
        })
        .catch(failure => {
          if (current)
            setError(
              failure instanceof Error ? failure.message : copy.form.unexpected,
            );
        });
      return () => {
        current = false;
      };
    }, [service, token, userId]),
  );
  const stats: [string, number | undefined][] = [
    [copy.playerOverview.views, counts?.views],
    [copy.playerOverview.followers, counts?.followers],
    [copy.playerOverview.following, counts?.following],
  ];
  // The owner sees the page as others do: only the groups switched on.
  const view =
    card && isFullProfile(card.profile) ? publicView(card.profile) : null;
  return (
    <Screen>
      <View style={styles.top}>
        <View style={styles.ring}>
          <Avatar name={fullName} uri={avatarUri} size={84} />
        </View>
        <View style={styles.stats}>
          {stats.map(([label, value]) => (
            <View
              key={label}
              style={styles.stat}
              accessible
              accessibilityLabel={(value ?? '–') + ' ' + label}
            >
              <Text style={styles.statValue}>{value ?? '–'}</Text>
              <Text style={styles.statLabel}>{label}</Text>
            </View>
          ))}
        </View>
      </View>
      <View style={styles.identity}>
        <View style={styles.nameRow}>
          <Text accessibilityRole="header" style={styles.name}>
            {fullName}
          </Text>
          {verified ? (
            <BadgeCheck
              size={18}
              color={colors.accent}
              accessibilityLabel={copy.discover.verified}
            />
          ) : null}
          {isPro ? <ProBadge /> : null}
        </View>
        <Text style={styles.role}>{copy.coaches.role}</Text>
      </View>
      {error ? <ErrorBanner message={error} /> : null}
      {!card && !error ? (
        <ActivityIndicator color={colors.brand} />
      ) : card && view ? (
        <CoachFacts
          profile={view}
          clubs={view.showClubs ? card.clubs : []}
          emptyText={copy.coaches.nothingShown}
        />
      ) : null}
      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          onPress={onEdit}
          style={({ pressed }) => [styles.edit, pressed && styles.pressed]}
        >
          <Pencil size={16} color={colors.text} />
          <Text style={styles.editText}>{copy.playerOverview.edit}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={copy.coaches.editTitle}
          onPress={onEditCoach}
          style={({ pressed }) => [styles.square, pressed && styles.pressed]}
        >
          <BriefcaseBusiness size={18} color={colors.text} />
        </Pressable>
      </View>
      <Text style={styles.note}>{copy.coaches.hiddenNote}</Text>
      {posts ? (
        <View style={styles.posts}>
          <Text accessibilityRole="header" style={styles.postsTitle}>
            {copy.playerOverview.posts}
          </Text>
          {posts}
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', gap: space.lg },
  ring: {
    padding: 3,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: colors.brand,
  },
  stats: { flex: 1, flexDirection: 'row', gap: space.sm },
  stat: { flex: 1, alignItems: 'center', gap: space.xs },
  statValue: {
    ...type.number,
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  statLabel: { color: colors.secondary, fontSize: 12 },
  identity: { gap: space.xs },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: space.sm,
  },
  name: { color: colors.text, fontSize: 18, lineHeight: 24, fontWeight: '800' },
  role: { color: colors.secondary, fontSize: 13 },
  actions: { flexDirection: 'row', gap: space.sm },
  edit: {
    flex: 1,
    minHeight: 40,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.raised,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
  },
  editText: { color: colors.text, fontSize: 14, fontWeight: '600' },
  square: {
    width: 44,
    minHeight: 40,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.raised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { backgroundColor: colors.overlay },
  note: { ...type.caption, color: colors.muted },
  posts: { gap: space.md, marginTop: space.sm },
  postsTitle: { ...type.headline, color: colors.text },
});
