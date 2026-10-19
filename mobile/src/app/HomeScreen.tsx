import React, { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Bell, Ticket } from 'lucide-react-native';
import {
  RightsBadge,
  createTeamsService,
  teamsRepository,
  useRightsBalance,
} from '../features/teams';
import { useAuth } from '../features/auth';
import {
  GiftIcon,
  GiftSheet,
  useGifts,
  type GiftsService,
} from '../features/gifts';
import {
  AdvertisementBanner,
  HomeNews,
  type ContentService,
} from '../features/content';
import type { DiscoveryService } from '../features/discovery';
import { Screen } from '../shared/ui/Screen';
import { HomeProfileCard } from './HomeProfileCard';
import {
  accountRepository,
  avatarUrl,
  useAccountProfile,
} from '../features/account';
import { HomeHeaderButton } from './HomeHeaderButton';
import { HomeQuickActions } from './HomeQuickActions';
import { Brand } from '../shared/ui/Brand';
import { Button } from '../shared/ui/Button';
import { ErrorBanner } from '../shared/ui/ErrorBanner';
import { useFocusedResource } from '../shared/lib/useFocusedResource';
import { copy } from '../shared/lib/copy';
import { colors, space } from '../styles/tokens';
const teamsService = createTeamsService(teamsRepository);
export function HomeScreen({
  contentService,
  discoveryService,
  giftsService,
  notificationsService,
  onProfile,
  onNews,
  onVisitors,
  onRights,
  onNotifications,
  onTeams,
  onLeagues,
  onDiscover,
  headerAction,
}: {
  contentService: ContentService;
  discoveryService: DiscoveryService;
  giftsService: GiftsService;
  notificationsService: { unreadCount(token: string): Promise<number> };
  onProfile(): void;
  onNews(): void;
  // The profile views metric opens the visitors screen.
  onVisitors?(): void;
  // Header shortcuts: team application rights and the notification center.
  onRights(): void;
  onNotifications(): void;
  // Quick actions under the news.
  onTeams(): void;
  onLeagues(): void;
  onDiscover(): void;
  // Replaces the team-rights shortcut, e.g. a coach's "Geçiş yap" button.
  headerAction?: React.ReactNode;
}) {
  const { user, token } = useAuth();
  const gifts = useGifts(giftsService, token);
  const [giftsOpen, setGiftsOpen] = useState(false);
  const insights = useFocusedResource(
    useCallback(
      () =>
        token
          ? discoveryService.insights(token)
          : Promise.reject(new Error(copy.playerProfile.sessionError)),
      [discoveryService, token],
    ),
  );
  // Team application rights belong to players only.
  const rights = useRightsBalance(
    teamsService,
    token,
    user?.role === 'player' && !headerAction,
  );
  const account = useAccountProfile(accountRepository, token);
  const unread = useFocusedResource(
    useCallback(
      () =>
        token
          ? notificationsService.unreadCount(token)
          : Promise.reject(new Error(copy.playerProfile.sessionError)),
      [notificationsService, token],
    ),
  );
  const unreadCount = unread.data ?? 0;
  // The home loop runs through every published story, not only the featured ones.
  const allNews = useFocusedResource(
    useCallback(
      () =>
        token
          ? contentService.news(token, 1)
          : Promise.reject(new Error(copy.playerProfile.sessionError)),
      [contentService, token],
    ),
  );
  const content = useFocusedResource(
    useCallback(
      () =>
        token
          ? contentService.home(token)
          : Promise.reject(new Error(copy.playerProfile.sessionError)),
      [contentService, token],
    ),
  );
  const displayName =
    user?.role === 'club' ? user.fullName : user?.fullName.split(' ')[0] || '';
  return (
    <View style={styles.root}>
      <Screen>
        <View style={styles.header}>
          <Brand mark={false} />
          <View style={styles.actions}>
            {headerAction ? (
              headerAction
            ) : user?.role !== 'player' ? null : rights !== null ? (
              <RightsBadge count={rights} onPress={onRights} />
            ) : (
              <HomeHeaderButton
                icon={Ticket}
                label={copy.home.rights}
                onPress={onRights}
              />
            )}
            <GiftIcon
              count={gifts.availableCount}
              onPress={() => {
                setGiftsOpen(true);
                gifts.refresh();
              }}
            />
            <HomeHeaderButton
              icon={Bell}
              label={copy.home.notifications}
              hint={unreadCount > 0 ? copy.home.unread(unreadCount) : undefined}
              count={unreadCount}
              onPress={onNotifications}
            />
          </View>
        </View>
        <HomeProfileCard
          name={displayName}
          initial={user?.fullName.charAt(0).toLocaleUpperCase('tr-TR') ?? ''}
          avatarUri={
            account.profile
              ? avatarUrl(account.profile.id, account.profile.avatarVersion)
              : undefined
          }
          insights={insights.data ?? undefined}
          loading={insights.loading}
          error={insights.error}
          onProfile={onProfile}
          onVisitors={onVisitors}
          onRetry={insights.retry}
        />
        {content.loading ? (
          <ActivityIndicator color={colors.brand} />
        ) : content.error ? (
          <>
            <ErrorBanner message={content.error} />
            <Button label={copy.form.retry} onPress={content.retry} />
          </>
        ) : (
          content.data && (
            <>
              {/* Empty sections are hidden instead of saying "will appear here". */}
              {content.data.advertisements.length ? (
                <AdvertisementBanner
                  items={content.data.advertisements}
                  imageUrl={contentService.imageUrl}
                />
              ) : null}
              {(allNews.data?.items ?? content.data.news).length ? (
                <HomeNews
                  items={allNews.data?.items ?? content.data.news}
                  imageUrl={contentService.imageUrl}
                  onNews={onNews}
                />
              ) : null}
            </>
          )
        )}
        <HomeQuickActions
          onTeams={onTeams}
          onLeagues={onLeagues}
          onDiscover={onDiscover}
        />
      </Screen>
      <GiftSheet
        visible={giftsOpen}
        onClose={() => setGiftsOpen(false)}
        items={gifts.items}
        availableCount={gifts.availableCount}
        loading={gifts.loading}
        claimingId={gifts.claimingId}
        notice={gifts.notice}
        error={gifts.error}
        onClaim={gifts.claim}
      />
    </View>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  actions: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
});
