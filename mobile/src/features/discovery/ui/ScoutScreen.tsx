import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Search, Star, X } from 'lucide-react-native';
import { Avatar } from '../../../shared/ui/Avatar';
import { Brand } from '../../../shared/ui/Brand';
import { Button } from '../../../shared/ui/Button';
import { EmptyState } from '../../../shared/ui/EmptyState';
import { ErrorBanner } from '../../../shared/ui/ErrorBanner';
import { PageHeader } from '../../../shared/ui/PageHeader';
import { Screen } from '../../../shared/ui/Screen';
import { avatarUrl } from '../../../shared/lib/avatar';
import { copy } from '../../../shared/lib/copy';
import { colors, radius, space, type } from '../../../styles/tokens';
import type { DominantFoot } from '../../players';
import type { DiscoveryService } from '../application/discovery-service';
import { useWatchlist } from '../application/useWatchlist';
import type { DiscoveryProfile, DiscoveryQuery } from '../domain/models';

const text = copy.scout;
type Tab = 'discover' | 'watchlist';
const feet: Exclude<DominantFoot, ''>[] = ['right', 'left', 'both'];

// Keşif (20 Oct 2026): a coach's scouting page in the Saha hub. Keşfet lists
// every player in discovery at once and narrows by name, position, foot and
// "takım arıyor"; a star keeps a player in İzleme listem.
export function ScoutScreen({
  service,
  token,
  onOpen,
}: {
  service: DiscoveryService;
  token: string | null;
  onOpen(id: string): void;
}) {
  const [tab, setTab] = useState<Tab>('discover');
  const watchlist = useWatchlist(service, token);
  return (
    <Screen>
      <Brand mark={false} />
      <PageHeader eyebrow={text.eyebrow} title={text.title} />
      <View style={styles.segments} accessibilityRole="tablist">
        {(['discover', 'watchlist'] as const).map(key => {
          const selected = key === tab;
          const label =
            key === 'watchlist' && watchlist.items.length
              ? text.watchlistCount(watchlist.items.length)
              : text.tabs[key];
          return (
            <Pressable
              key={key}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              onPress={() => setTab(key)}
              style={[styles.segment, selected && styles.segmentOn]}
            >
              {key === 'watchlist' ? (
                <Star
                  size={15}
                  color={selected ? colors.brand : colors.muted}
                  fill={selected ? colors.brand : 'transparent'}
                />
              ) : (
                <Search
                  size={15}
                  color={selected ? colors.brand : colors.muted}
                />
              )}
              <Text
                numberOfLines={1}
                style={[styles.segmentText, selected && styles.segmentTextOn]}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {watchlist.error ? <ErrorBanner message={watchlist.error} /> : null}
      {tab === 'discover' ? (
        <Discover
          service={service}
          token={token}
          watched={watchlist.watched}
          onStar={watchlist.toggle}
          onOpen={onOpen}
        />
      ) : !watchlist.loaded ? (
        <ActivityIndicator color={colors.brand} style={styles.loader} />
      ) : watchlist.items.length ? (
        <View style={styles.list}>
          {watchlist.items.map(profile => (
            <PlayerRow
              key={profile.id}
              profile={profile}
              watched
              onStar={() => watchlist.toggle(profile)}
              onOpen={() => onOpen(profile.id)}
            />
          ))}
        </View>
      ) : (
        <EmptyState icon={Star} title={text.emptyTitle} body={text.emptyBody} />
      )}
    </Screen>
  );
}

function Discover({
  service,
  token,
  watched,
  onStar,
  onOpen,
}: {
  service: DiscoveryService;
  token: string | null;
  watched(id: string): boolean;
  onStar(profile: DiscoveryProfile): void;
  onOpen(id: string): void;
}) {
  const [value, setValue] = useState('');
  const [search, setSearch] = useState('');
  const [position, setPosition] = useState('');
  const [foot, setFoot] = useState<DominantFoot>('');
  const [seeking, setSeeking] = useState(false);
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<DiscoveryProfile[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  // A new filter starts again from the first page.
  function narrow<T>(set: (next: T) => void) {
    return (next: T) => {
      set(next);
      setPage(1);
    };
  }
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(value.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [value]);
  const pickPosition = narrow(setPosition);
  const pickFoot = narrow(setFoot);
  const pickSeeking = narrow(setSeeking);
  useEffect(() => {
    if (!token) return;
    let current = true;
    const query: DiscoveryQuery = {
      kind: 'players',
      search,
      position,
      dominantFoot: foot,
      availability: seeking ? 'seeking_team' : '',
      footballType: '',
      licenseStatus: '',
      page,
    };
    setLoading(true);
    setError('');
    service
      .list(token, query)
      .then(result => {
        if (!current) return;
        setItems(list =>
          page === 1 ? result.items : [...list, ...result.items],
        );
        setTotal(result.total);
        setPages(result.totalPages);
        setLoading(false);
      })
      .catch(failure => {
        if (!current) return;
        setError(
          failure instanceof Error ? failure.message : copy.form.unexpected,
        );
        setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [service, token, search, position, foot, seeking, page]);
  return (
    <View style={styles.list}>
      <View style={styles.field}>
        <Search size={18} color={colors.muted} />
        <TextInput
          accessibilityLabel={text.search}
          placeholder={text.search}
          placeholderTextColor={colors.muted}
          value={value}
          onChangeText={setValue}
          autoCorrect={false}
          autoCapitalize="words"
          returnKeyType="search"
          style={styles.input}
        />
        {value ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={copy.discover.clearSearch}
            onPress={() => setValue('')}
            hitSlop={8}
          >
            <X size={18} color={colors.muted} />
          </Pressable>
        ) : null}
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
      >
        <Chip
          label={text.allPositions}
          selected={!position}
          onPress={() => pickPosition('')}
        />
        {text.positions.map(name => (
          <Chip
            key={name}
            label={name}
            selected={position === name}
            onPress={() => pickPosition(position === name ? '' : name)}
          />
        ))}
      </ScrollView>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
      >
        <Chip
          label={text.seeking}
          selected={seeking}
          onPress={() => pickSeeking(!seeking)}
        />
        {feet.map(key => (
          <Chip
            key={key}
            label={text.feet[key]}
            selected={foot === key}
            onPress={() => pickFoot(foot === key ? '' : key)}
          />
        ))}
      </ScrollView>
      {error ? (
        <ErrorBanner message={error} />
      ) : loading && page === 1 ? (
        <ActivityIndicator color={colors.brand} style={styles.loader} />
      ) : items.length ? (
        <>
          <Text style={styles.count}>{text.results(total)}</Text>
          {items.map(profile => (
            <PlayerRow
              key={profile.id}
              profile={profile}
              watched={watched(profile.id)}
              onStar={() => onStar(profile)}
              onOpen={() => onOpen(profile.id)}
            />
          ))}
          {page < pages ? (
            <Button
              label={text.more}
              secondary
              compact
              loading={loading}
              onPress={() => setPage(page + 1)}
            />
          ) : null}
        </>
      ) : (
        <Text style={styles.empty}>{text.noResults}</Text>
      )}
    </View>
  );
}

function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress(): void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.chip, selected && styles.chipOn]}
    >
      <Text style={[styles.chipText, selected && styles.chipTextOn]}>
        {label}
      </Text>
    </Pressable>
  );
}

export function PlayerRow({
  profile,
  watched,
  onStar,
  onOpen,
}: {
  profile: DiscoveryProfile;
  watched: boolean;
  onStar(): void;
  onOpen(): void;
}) {
  const player = profile.playerProfile;
  const footLabel =
    player?.dominantFoot && player.dominantFoot in text.feet
      ? text.feet[player.dominantFoot as keyof typeof text.feet]
      : '';
  const detail = [player?.position, footLabel, profile.district]
    .filter(Boolean)
    .join(' · ');
  const availability =
    player && player.availability !== 'not_available'
      ? text.availability[player.availability]
      : '';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={profile.fullName + ', ' + detail}
      onPress={onOpen}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <Avatar
        name={profile.fullName}
        uri={avatarUrl(profile.id, profile.avatarVersion)}
        size={46}
      />
      <View style={styles.rowBody}>
        <Text numberOfLines={1} style={styles.name}>
          {profile.fullName}
        </Text>
        <Text numberOfLines={1} style={styles.detail}>
          {detail}
        </Text>
        {availability ? (
          <Text
            style={[
              styles.tag,
              player?.availability === 'seeking_team' && styles.tagHot,
            ]}
          >
            {availability}
          </Text>
        ) : null}
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={watched ? text.unwatch : text.watch}
        accessibilityState={{ selected: watched }}
        onPress={onStar}
        hitSlop={8}
        style={({ pressed }) => [
          styles.star,
          watched && styles.starOn,
          pressed && styles.pressed,
        ]}
      >
        <Star
          size={18}
          color={watched ? colors.brandInk : colors.muted}
          fill={watched ? colors.brandInk : 'transparent'}
        />
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  segments: {
    flexDirection: 'row',
    padding: space.xs,
    gap: space.xs,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  segment: {
    flex: 1,
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xs,
    borderRadius: radius.pill,
    paddingHorizontal: space.xs,
  },
  segmentOn: { backgroundColor: colors.overlay },
  segmentText: {
    ...type.caption,
    fontSize: 13,
    color: colors.muted,
    fontWeight: '700',
  },
  segmentTextOn: { color: colors.text },
  loader: { padding: space.xl },
  list: { gap: space.sm },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    minHeight: 48,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  input: { flex: 1, color: colors.text, fontSize: 15, paddingVertical: 0 },
  chips: { gap: space.sm, paddingVertical: 2 },
  chip: {
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipOn: { borderColor: colors.brand, backgroundColor: colors.brandWash },
  chipText: { ...type.caption, color: colors.secondary, fontWeight: '700' },
  chipTextOn: { color: colors.brand },
  count: { ...type.caption, color: colors.muted, marginTop: space.xs },
  empty: {
    ...type.body,
    color: colors.muted,
    textAlign: 'center',
    paddingVertical: space.xl,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  pressed: { opacity: 0.8 },
  rowBody: { flex: 1, gap: 2 },
  name: { ...type.body, color: colors.text, fontWeight: '700' },
  detail: { ...type.caption, color: colors.muted },
  tag: {
    ...type.caption,
    alignSelf: 'flex-start',
    marginTop: 2,
    paddingHorizontal: space.sm,
    paddingVertical: 1,
    borderRadius: radius.pill,
    overflow: 'hidden',
    fontSize: 11,
    fontWeight: '700',
    color: colors.accent,
    backgroundColor: colors.accentWash,
  },
  tagHot: { color: colors.brand, backgroundColor: colors.brandWash },
  star: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.raised,
  },
  starOn: { backgroundColor: colors.brand, borderColor: colors.brand },
});
