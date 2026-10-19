import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  BadgeCheck,
  ChevronRight,
  Search,
  X,
} from 'lucide-react-native';
import { ErrorBanner } from '../../../shared/ui/ErrorBanner';
import { Floodlight } from '../../../shared/ui/Floodlight';
import { copy } from '../../../shared/lib/copy';
import { Avatar } from '../../../shared/ui/Avatar';
import { avatarUrl } from '../../../shared/lib/avatar';
import { colors, radius, space, type } from '../../../styles/tokens';
import type { AccountRole } from '../../auth';
import type {
  DiscoveryKind,
  DiscoveryProfile,
  DiscoveryQuery,
} from '../domain/models';
import type { DiscoveryService } from '../application/discovery-service';

const MIN_LENGTH = 2;

function query(kind: DiscoveryKind, search: string): DiscoveryQuery {
  return {
    kind,
    search,
    position: '',
    dominantFoot: '',
    availability: '',
    footballType: '',
    licenseStatus: '',
    page: 1,
  };
}

type Result = { kind: DiscoveryKind; profile: DiscoveryProfile };

// Keşfet (19 Oct 2026): a single search bar; results appear only once the
// user types. Players search players, clubs and coaches; other roles may only
// discover players, as the server allows.
export function DiscoverScreen({
  service,
  token,
  role,
  onOpen,
  onBack,
}: {
  service: DiscoveryService;
  token: string | null;
  role: AccountRole;
  onOpen(kind: DiscoveryKind, id: string): void;
  onBack?(): void;
}) {
  const text = copy.discover;
  const kinds: DiscoveryKind[] =
    role === 'player' ? ['players', 'clubs', 'coaches'] : ['players'];
  const [value, setValue] = useState('');
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const input = useRef<TextInput>(null);
  const kindKey = kinds.join(',');
  useEffect(() => {
    const timer = setTimeout(() => setSearch(value.trim()), 300);
    return () => clearTimeout(timer);
  }, [value]);
  useEffect(() => {
    let current = true;
    if (!token || search.length < MIN_LENGTH) {
      setResults([]);
      setLoading(false);
      setError('');
      return;
    }
    setLoading(true);
    setError('');
    Promise.allSettled(
      kindKey.split(',').map(kind =>
        service.list(token, query(kind as DiscoveryKind, search)).then(page =>
          page.items.map(profile => ({
            kind: kind as DiscoveryKind,
            profile,
          })),
        ),
      ),
    ).then(settled => {
      if (!current) return;
      const found = settled.flatMap(item =>
        item.status === 'fulfilled' ? item.value : [],
      );
      setResults(found);
      setError(
        !found.length && settled.every(item => item.status === 'rejected')
          ? text.searchError
          : '',
      );
      setLoading(false);
    });
    return () => {
      current = false;
    };
  }, [service, token, search, kindKey, text.searchError]);
  const searching = search.length >= MIN_LENGTH;
  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safe}>
      <Floodlight height={320} />
      <View style={styles.bar}>
        {onBack ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={copy.form.back}
            onPress={onBack}
            hitSlop={8}
            style={styles.back}
          >
            <ArrowLeft size={20} color={colors.text} />
          </Pressable>
        ) : null}
        <View style={styles.field}>
          <Search size={18} color={colors.muted} />
          <TextInput
            ref={input}
            autoFocus
            accessibilityLabel={text.title}
            placeholder={
              role === 'player' ? text.placeholderAll : text.placeholderPlayers
            }
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
              accessibilityLabel={text.clearSearch}
              onPress={() => {
                setValue('');
                input.current?.focus();
              }}
              hitSlop={8}
            >
              <X size={18} color={colors.muted} />
            </Pressable>
          ) : null}
        </View>
      </View>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={styles.content}
      >
        {!searching ? null : loading && !results.length ? (
          <ActivityIndicator color={colors.brand} style={styles.loader} />
        ) : error ? (
          <ErrorBanner message={error} />
        ) : !results.length ? (
          <Text style={styles.empty}>{text.noResults}</Text>
        ) : (
          results.map(({ kind, profile }) => (
            <ResultRow
              key={kind + profile.id}
              profile={profile}
              onPress={() => onOpen(kind, profile.id)}
            />
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function ResultRow({
  profile,
  onPress,
}: {
  profile: DiscoveryProfile;
  onPress(): void;
}) {
  const detail = [
    copy.roles[profile.role],
    profile.playerProfile?.position,
    profile.district,
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={profile.fullName + ', ' + detail}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <Avatar
        name={profile.fullName}
        uri={avatarUrl(profile.id, profile.avatarVersion)}
        size={44}
        square={profile.role === 'club'}
      />
      <View style={styles.rowBody}>
        <View style={styles.nameLine}>
          <Text numberOfLines={1} style={styles.name}>
            {profile.fullName}
          </Text>
          {profile.verified ? (
            <BadgeCheck size={15} color={colors.accent} />
          ) : null}
        </View>
        <Text numberOfLines={1} style={styles.detail}>
          {detail}
        </Text>
      </View>
      <ChevronRight size={18} color={colors.muted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    paddingBottom: space.md,
  },
  back: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.raised,
    borderWidth: 1,
    borderColor: colors.border,
  },
  field: {
    flex: 1,
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
  content: {
    paddingHorizontal: space.lg,
    paddingBottom: 160,
    gap: space.sm,
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center',
  },
  loader: { padding: space.xl },
  empty: {
    color: colors.muted,
    fontSize: 13,
    textAlign: 'center',
    paddingTop: space.xl,
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
  pressed: { opacity: 0.85 },
  rowBody: { flex: 1, gap: 2 },
  nameLine: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  name: { color: colors.text, fontSize: 15, fontWeight: '700', flexShrink: 1 },
  detail: { ...type.caption, color: colors.muted },
});
