import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Eye, UserRound, Users } from 'lucide-react-native';
import { useAuth } from '../features/auth';
import {
  GiftIcon,
  GiftSheet,
  useGifts,
  type GiftsService,
} from '../features/gifts';
import {
  AdvertisementCarousel,
  HomeNews,
  type ContentService,
} from '../features/content';
import type { DiscoveryService } from '../features/discovery';
import { Screen } from '../shared/ui/Screen';
import { Brand } from '../shared/ui/Brand';
import { Button } from '../shared/ui/Button';
import { ErrorBanner } from '../shared/ui/ErrorBanner';
import { useFocusedResource } from '../shared/lib/useFocusedResource';
import { copy } from '../shared/lib/copy';
import { colors, radius, shadow, space, type } from '../styles/tokens';
export function HomeScreen({
  contentService,
  discoveryService,
  giftsService,
  onProfile,
  onNews,
  onVisitors,
}: {
  contentService: ContentService;
  discoveryService: DiscoveryService;
  giftsService: GiftsService;
  onProfile(): void;
  onNews(): void;
  // The profile views metric opens the visitors screen.
  onVisitors?(): void;
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
  const metrics = [
    {
      label: copy.home.views,
      value: insights.data?.profileViews,
      icon: Eye,
      onPress: onVisitors,
    },
    {
      label: copy.home.followers,
      value: insights.data?.followers,
      icon: Users,
      onPress: undefined,
    },
    {
      label: copy.home.following,
      value: insights.data?.following,
      icon: UserRound,
      onPress: undefined,
    },
  ];
  return (
    <View style={styles.root}>
      <Screen>
        <View style={styles.header}>
          <Brand />
          <GiftIcon
            count={gifts.availableCount}
            onPress={() => {
              setGiftsOpen(true);
              gifts.refresh();
            }}
          />
        </View>
        <View style={styles.welcome}>
          <View style={styles.welcomeGlow} pointerEvents="none" />
          <View style={styles.top}>
            <View style={styles.greeting}>
              <Text style={styles.eyebrow}>{copy.home.greeting}</Text>
              <Text accessibilityRole="header" style={styles.name}>
                {copy.home.welcome(displayName)}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={copy.home.profileButton}
              onPress={onProfile}
              style={styles.avatar}
            >
              <Text style={styles.initial}>
                {user?.fullName.charAt(0).toLocaleUpperCase('tr-TR')}
              </Text>
            </Pressable>
          </View>
          <Button
            label={copy.home.profileButton}
            secondary
            onPress={onProfile}
          />
        </View>
        <View style={styles.stats}>
          <Text style={styles.eyebrow}>{copy.home.stats}</Text>
          <View style={styles.metrics}>
            {metrics.map(({ label, value, icon: Icon, onPress }) => {
              const body = (
                <>
                  <View style={styles.metricIcon}>
                    <Icon size={16} color={colors.brand} />
                  </View>
                  <Text style={styles.value}>
                    {insights.loading
                      ? '—'
                      : value === undefined
                      ? '—'
                      : value.toLocaleString('tr-TR')}
                  </Text>
                  <Text style={styles.label}>{label}</Text>
                </>
              );
              return onPress ? (
                <Pressable
                  key={label}
                  accessibilityRole="button"
                  accessibilityLabel={label}
                  accessibilityHint={copy.home.viewsHint}
                  onPress={onPress}
                  style={({ pressed }) => [
                    styles.metric,
                    pressed && styles.metricPressed,
                  ]}
                >
                  {body}
                </Pressable>
              ) : (
                <View key={label} style={styles.metric}>
                  {body}
                </View>
              );
            })}
          </View>
          <ErrorBanner message={insights.error} />
          {insights.error && (
            <Button
              label={copy.form.retry}
              secondary
              onPress={insights.retry}
            />
          )}
        </View>
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
                <AdvertisementCarousel
                  items={content.data.advertisements}
                  imageUrl={contentService.imageUrl}
                />
              ) : null}
              {content.data.news.length ? (
                <HomeNews
                  items={content.data.news}
                  imageUrl={contentService.imageUrl}
                  onNews={onNews}
                />
              ) : null}
            </>
          )
        )}
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
  welcome: {
    padding: space.xl,
    gap: space.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: radius.lg,
    overflow: 'hidden',
    ...shadow.layer,
  },
  // A small floodlight inside the hero card, top right.
  welcomeGlow: {
    position: 'absolute',
    top: -80,
    right: -60,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: colors.brandWash,
  },
  top: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  greeting: { flex: 1, gap: space.sm },
  eyebrow: { ...type.eyebrow, color: colors.brand },
  name: { ...type.display, fontSize: 30, lineHeight: 36, color: colors.text },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.raised,
    borderWidth: 2,
    borderColor: colors.brand,
  },
  initial: { color: colors.brand, fontSize: 20, fontWeight: '800' },
  stats: { gap: space.md },
  metrics: { flexDirection: 'row', gap: space.sm },
  metric: {
    flex: 1,
    alignItems: 'flex-start',
    padding: space.lg,
    gap: space.sm,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  metricPressed: { backgroundColor: colors.raised },
  metricIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brandWash,
  },
  value: {
    ...type.number,
    color: colors.text,
    fontSize: 28,
    lineHeight: 32,
    fontWeight: '800',
    letterSpacing: -0.8,
  },
  label: { ...type.caption, color: colors.muted },
});
