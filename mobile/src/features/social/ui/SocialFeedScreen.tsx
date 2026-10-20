import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  FlatList,
  LayoutAnimation,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  UIManager,
  View,
} from 'react-native';
import {
  HeartHandshake,
  ImagePlus,
  PanelLeft,
  Users,
} from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../../../shared/ui/Button';
import { ErrorBanner } from '../../../shared/ui/ErrorBanner';
import { EmptyState } from '../../../shared/ui/EmptyState';
import { copy } from '../../../shared/lib/copy';
import { colors, radius, space } from '../../../styles/tokens';
import type { FeedScope } from '../domain/models';
import type { SocialService } from '../application/social-service';
import { useSocialList } from '../application/useSocialList';
import { SocialPostCard } from './SocialPostCard';
import { DeleteContentPrompt } from './DeleteContentPrompt';
import { useAuth } from '../../auth';
import { Wordmark } from '../../../shared/ui/Wordmark';
import { useReducedMotion } from '../../../shared/lib/useReducedMotion';
import {
  ModerationSheet,
  moderationService,
  type ModerationTarget,
} from '../../moderation';

// Posts appear ten at a time: the server page (20) is revealed in steps.
const STEP = 10;
if (Platform.OS === 'android') {
  UIManager.setLayoutAnimationEnabledExperimental?.(true);
}

export function SocialFeedScreen({
  token,
  service,
  publishedAt,
  onOpen,
  onCompose,
  requestCount = 0,
  requestsLoadedAt = 0,
  onRequests,
  onMenu,
}: {
  token: string;
  service: SocialService;
  publishedAt?: number;
  onOpen(id: string): void;
  onCompose(): void;
  // Header shortcuts (moved here from Diğer › Futbol ağı, 19 Oct 2026):
  // requests on the right; the left button opens the app's side panel.
  requestCount?: number;
  // Changes on each fresh count; a pending count shows a one-second hint.
  requestsLoadedAt?: number;
  // Absent for a coach running a club account: the club's requests stay private.
  onRequests?: () => void;
  onMenu(): void;
}) {
  // Oyunlar left this screen for its own hub page on 19 Oct 2026.
  const [scope, setScope] = useState<FeedScope>('explore');
  const { user } = useAuth();
  const [visible, setVisible] = useState(STEP);
  const [revealing, setRevealing] = useState(false);
  const [tabsShown, setTabsShown] = useState(true);
  const lastOffset = useRef(0);
  const feed = useSocialList(
    useCallback(
      (cursor: string) => service.feed(token, cursor, scope),
      [service, token, scope],
    ),
  );
  const [busy, setBusy] = useState('');
  const [deleting, setDeleting] = useState('');
  const [moderating, setModerating] = useState<ModerationTarget | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  useEffect(() => {
    setVisible(STEP);
    setTabsShown(true);
    lastOffset.current = 0;
  }, [scope]);
  useEffect(() => {
    if (publishedAt) {
      setScope('explore');
      setNotice(copy.social.published);
    }
  }, [publishedAt]);
  async function like(id: string, liked: boolean) {
    if (busy) return;
    setBusy(id);
    setError('');
    try {
      feed.replace(await service.like(token, id, !liked));
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : copy.form.unexpected,
      );
    } finally {
      setBusy('');
    }
  }
  async function follow(id: string, following: boolean) {
    if (busy) return;
    setBusy(id);
    setError('');
    try {
      const value = await service.follow(token, id, !following);
      feed.update(item =>
        item.author.id === id
          ? { ...item, author: { ...item.author, following: value } }
          : item,
      );
      if (scope === 'following' && !value) await feed.refresh();
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : copy.form.unexpected,
      );
    } finally {
      setBusy('');
    }
  }
  async function remove() {
    if (!deleting || busy) return;
    setBusy(deleting);
    setError('');
    try {
      await service.deletePost(token, deleting);
      feed.remove(deleting);
      setNotice(copy.social.deleted);
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : copy.form.unexpected,
      );
    } finally {
      setBusy('');
      setDeleting('');
    }
  }
  // Scrolling down (content moving up) tucks the tabs away; scrolling back
  // up, or being at the top, brings them back.
  function onScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const offset = Math.max(0, event.nativeEvent.contentOffset.y);
    const delta = offset - lastOffset.current;
    if (offset <= 8 || delta < -12) {
      if (!tabsShown) {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setTabsShown(true);
      }
      lastOffset.current = offset;
    } else if (delta > 12 && offset > 60) {
      if (tabsShown) {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setTabsShown(false);
      }
      lastOffset.current = offset;
    }
  }
  function showMore() {
    if (revealing) return;
    if (visible < feed.items.length) {
      setRevealing(true);
      setTimeout(() => {
        setVisible(value => value + STEP);
        setRevealing(false);
      }, 450);
    } else if (feed.hasMore && !feed.loadingMore) {
      setRevealing(true);
      feed.loadMore();
    }
  }
  useEffect(() => {
    // New server items arrived while waiting at the end of the list.
    if (revealing && !feed.loadingMore && visible < feed.items.length) {
      setVisible(value => value + STEP);
      setRevealing(false);
    } else if (revealing && !feed.loadingMore && !feed.hasMore) {
      setRevealing(false);
    }
  }, [revealing, feed.loadingMore, feed.items.length, feed.hasMore, visible]);
  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safe}>
      <View style={styles.brand}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={copy.social.sidebar.open}
          onPress={onMenu}
          hitSlop={6}
          style={styles.headerButton}
        >
          <PanelLeft size={20} color={colors.text} />
        </Pressable>
        <View
          accessible
          accessibilityRole="header"
          accessibilityLabel={copy.brand}
        >
          <Wordmark height={26} />
        </View>
        {onRequests ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={copy.social.requests}
            accessibilityHint={
              requestCount ? copy.social.requestsBadge(requestCount) : undefined
            }
            onPress={onRequests}
            hitSlop={6}
            style={styles.headerButton}
          >
            <HeartHandshake size={20} color={colors.text} />
            {requestCount > 0 ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>
                  {requestCount > 99 ? '99+' : requestCount}
                </Text>
              </View>
            ) : null}
          </Pressable>
        ) : (
          <View style={styles.headerButton} />
        )}
        {onRequests ? (
          <RequestsHint count={requestCount} loadedAt={requestsLoadedAt} />
        ) : null}
      </View>

      {tabsShown ? (
        <View style={styles.tabs}>
          {(['explore', 'following'] as const).map(value => (
            <Pressable
              key={value}
              accessibilityRole="tab"
              accessibilityState={{
                selected: scope === value,
                disabled: !!busy,
              }}
              aria-selected={scope === value}
              disabled={!!busy}
              onPress={() => {
                setScope(value);
                setError('');
                setNotice('');
              }}
              style={styles.tab}
            >
              <Text
                style={[styles.tabText, scope === value && styles.selectedText]}
              >
                {value === 'explore'
                  ? copy.social.explore
                  : copy.social.following}
              </Text>
              <View
                style={[
                  styles.indicator,
                  scope === value && styles.selectedIndicator,
                ]}
              />
            </Pressable>
          ))}
        </View>
      ) : null}
      <FlatList
        key={scope}
        data={feed.items.slice(0, visible)}
        onScroll={onScroll}
        scrollEventThrottle={16}
        onEndReached={showMore}
        onEndReachedThreshold={0.4}
        ItemSeparatorComponent={Separator}
        keyExtractor={item => item.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={feed.refreshing && !feed.loading}
            onRefresh={() => {
              if (!busy) feed.refresh();
            }}
            tintColor={colors.brand}
            colors={[colors.brand]}
          />
        }
        ListHeaderComponent={
          <View style={styles.messages}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={copy.social.compose}
              onPress={onCompose}
              style={({ pressed }) => [
                styles.composer,
                pressed && styles.composerPressed,
              ]}
            >
              <View style={styles.composerAvatar}>
                <Text style={styles.composerInitial}>
                  {Array.from(
                    user?.fullName.trim() ?? '',
                  )[0]?.toLocaleUpperCase('tr-TR') ?? ''}
                </Text>
              </View>
              <Text style={styles.composerText}>
                {copy.social.composePrompt}
              </Text>
              <ImagePlus size={20} color={colors.brand} />
            </Pressable>
            {notice ? (
              <Text accessibilityRole="alert" style={styles.notice}>
                {notice}
              </Text>
            ) : null}
            {error || feed.error ? (
              <ErrorBanner message={error || feed.error} />
            ) : null}
            {feed.error ? (
              <Button
                label={copy.form.retry}
                secondary
                onPress={() => feed.refresh()}
              />
            ) : null}
          </View>
        }
        renderItem={({ item }) => (
          <SocialPostCard
            framed
            item={item}
            token={token}
            service={service}
            busy={!!busy}
            onLike={() => like(item.id, item.liked)}
            onReplies={() => onOpen(item.id)}
            onFollow={() => follow(item.author.id, item.author.following)}
            onDelete={() => setDeleting(item.id)}
            onMore={() =>
              setModerating({
                kind: 'post',
                id: item.id,
                userId: item.author.id,
                name: item.author.fullName,
              })
            }
          />
        )}
        ListEmptyComponent={
          feed.loading ? (
            <ActivityIndicator color={colors.brand} style={styles.loader} />
          ) : !feed.error ? (
            <View>
              <EmptyState
                icon={Users}
                title={
                  scope === 'following'
                    ? copy.social.followingEmptyTitle
                    : copy.social.emptyTitle
                }
                body={
                  scope === 'following'
                    ? copy.social.followingEmptyBody
                    : copy.social.emptyBody
                }
              />
              {scope === 'following' ? (
                <Button
                  label={copy.social.goExplore}
                  secondary
                  onPress={() => setScope('explore')}
                />
              ) : null}
            </View>
          ) : null
        }
        ListFooterComponent={
          feed.items.length && (revealing || feed.loadingMore) ? (
            <View style={styles.more}>
              <ActivityIndicator color={colors.brand} />
              <Text style={styles.loadingText}>{copy.social.loadingMore}</Text>
            </View>
          ) : null
        }
      />
      <DeleteContentPrompt
        visible={!!deleting}
        busy={!!busy}
        onCancel={() => setDeleting('')}
        onConfirm={() => remove()}
      />
      <ModerationSheet
        target={moderating}
        token={token}
        service={moderationService}
        onClose={() => setModerating(null)}
        onBlocked={() => feed.refresh()}
      />
    </SafeAreaView>
  );
}
// A small bubble under the requests button that says how many requests are
// waiting, shown for about a second each time a fresh count arrives.
function RequestsHint({
  count,
  loadedAt,
}: {
  count: number;
  loadedAt: number;
}) {
  const show = useRef(new Animated.Value(0)).current;
  const reduced = useReducedMotion();
  useEffect(() => {
    if (!loadedAt || count <= 0) return;
    show.setValue(0);
    const step = reduced ? 0 : 180;
    const animation = Animated.sequence([
      Animated.timing(show, {
        toValue: 1,
        duration: step,
        useNativeDriver: true,
      }),
      Animated.delay(1000),
      Animated.timing(show, {
        toValue: 0,
        duration: step,
        useNativeDriver: true,
      }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [count, loadedAt, reduced, show]);
  if (count <= 0) return null;
  return (
    <Animated.View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.hint,
        {
          opacity: show,
          transform: [
            {
              translateY: show.interpolate({
                inputRange: [0, 1],
                outputRange: [-6, 0],
              }),
            },
          ],
        },
      ]}
    >
      <View style={styles.hintArrow} />
      <View style={styles.hintBubble}>
        <Text style={styles.hintText}>{copy.social.requestsHint(count)}</Text>
      </View>
    </Animated.View>
  );
}

function Separator() {
  return <View style={styles.separator} />;
}
const styles = StyleSheet.create({
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.raised,
    borderWidth: 1,
    borderColor: colors.border,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    paddingHorizontal: space.xs,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brand,
  },
  badgeText: { color: colors.brandInk, fontSize: 10, fontWeight: '800' },
  hint: {
    position: 'absolute',
    right: space.xl - space.sm,
    top: '100%',
    alignItems: 'flex-end',
    zIndex: 10,
  },
  hintArrow: {
    width: 12,
    height: 12,
    marginRight: 14,
    marginBottom: -6,
    transform: [{ rotate: '45deg' }],
    backgroundColor: colors.brand,
  },
  hintBubble: {
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.brand,
  },
  hintText: { color: colors.brandInk, fontSize: 12, fontWeight: '800' },
  brand: {
    zIndex: 5,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: space.xl,
    paddingTop: space.md,
    paddingBottom: space.md,
  },
  separator: { height: space.md },
  loadingText: { color: colors.muted, fontSize: 12 },
  safe: { flex: 1, backgroundColor: colors.bg },
  tabs: {
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: space.lg,
  },
  tab: {
    flex: 1,
    minHeight: 62,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: space.sm,
    gap: space.md,
  },
  tabText: { color: colors.muted, fontSize: 13, fontWeight: '700' },
  selectedText: { color: colors.text },
  indicator: {
    width: 48,
    height: 3,
    borderRadius: radius.pill,
    backgroundColor: colors.transparent,
  },
  selectedIndicator: { backgroundColor: colors.brand },
  content: {
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    paddingBottom: 150,
    flexGrow: 1,
  },
  messages: { gap: space.md, paddingBottom: space.md },
  composer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  composerPressed: { opacity: 0.85 },
  composerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.raised,
  },
  composerInitial: { color: colors.text, fontSize: 15, fontWeight: '800' },
  composerText: { flex: 1, color: colors.muted, fontSize: 14 },
  notice: { color: colors.success, fontSize: 12, paddingTop: space.lg },
  loader: { padding: space.xl },
  more: { paddingTop: space.xl, alignItems: 'center', gap: space.sm },
});
