import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  ArrowLeft,
  ChevronRight,
  MapPin,
  Search,
  Shield,
  Trophy,
  UserRound,
  type LucideIcon,
} from 'lucide-react-native';
import type { Competition, FootballService } from '../features/football';
import type { League } from '../features/leagues';
import { createLeagueService, leagueRepository } from '../features/leagues';
import { createTeamsService, teamsRepository } from '../features/teams';
import type { DiscoveryService } from '../features/discovery';
import { Screen } from '../shared/ui/Screen';
import { RemoteLogo } from '../shared/ui/RemoteLogo';
import { copy } from '../shared/lib/copy';
import { colors, radius, space, type } from '../styles/tokens';
import {
  matchesSearch,
  minSearchLength,
  normalizeSearch,
} from './leagueSearch';

const leagueService = createLeagueService(leagueRepository);
const teamsService = createTeamsService(teamsRepository);
const PER_GROUP = 5;

type Row = {
  key: string;
  title: string;
  subtitle: string;
  icon: LucideIcon;
  logoUrl?: string;
  onPress(): void;
};

// General search from the Ligler header: leagues (major, Ankara and Fut
// Career) are matched on the device, teams and players through their own
// searchable lists. Every result opens its own page.
export function LeaguesSearchScreen({
  token,
  footballService,
  discoveryService,
  onBack,
  onOpenCompetition,
  onOpenAnkara,
  onOpenLeague,
  onOpenTeam,
  onOpenPlayer,
}: {
  token: string;
  footballService: FootballService;
  discoveryService: DiscoveryService;
  onBack(): void;
  onOpenCompetition(competition: Competition): void;
  onOpenAnkara(): void;
  onOpenLeague(league: League): void;
  onOpenTeam(id: string): void;
  onOpenPlayer(id: string): void;
}) {
  const [text, setText] = useState('');
  const [query, setQuery] = useState('');
  const [rows, setRows] = useState<{ title: string; rows: Row[] }[]>([]);
  const [busy, setBusy] = useState(false);
  // Inline callbacks change every render; keep them out of the search effect.
  const open = useRef({
    onOpenCompetition,
    onOpenAnkara,
    onOpenLeague,
    onOpenTeam,
    onOpenPlayer,
  });
  open.current = {
    onOpenCompetition,
    onOpenAnkara,
    onOpenLeague,
    onOpenTeam,
    onOpenPlayer,
  };
  const catalog = useRef<{
    competitions: Competition[];
    ankara: string;
    leagues: League[];
  } | null>(null);
  useEffect(() => {
    const timer = setTimeout(() => setQuery(normalizeSearch(text)), 300);
    return () => clearTimeout(timer);
  }, [text]);
  useEffect(() => {
    let current = true;
    if (query.length < minSearchLength) {
      setRows([]);
      setBusy(false);
      return;
    }
    setBusy(true);
    async function run() {
      if (!catalog.current) {
        const [competitions, leagues] = await Promise.all([
          footballService.competitions(token).catch(() => null),
          leagueService.list(token, 1).catch(() => null),
        ]);
        catalog.current = {
          competitions: competitions
            ? [...competitions.competitions, ...competitions.cups]
            : [],
          ankara: competitions?.ankara.name ?? copy.footballData.ankaraTitle,
          leagues: leagues?.items ?? [],
        };
      }
      const [teams, players] = await Promise.all([
        teamsService.list(token, 1, query).catch(() => null),
        discoveryService
          .list(token, {
            kind: 'players',
            search: query,
            position: '',
            dominantFoot: '',
            availability: '',
            footballType: '',
            licenseStatus: '',
            page: 1,
          })
          .catch(() => null),
      ]);
      const known = catalog.current;
      const leagueRows: Row[] = [
        ...known.competitions
          .filter(item => matchesSearch(query, item.name, item.country))
          .map(item => ({
            key: 'c-' + item.slug,
            title: item.name,
            subtitle: item.country,
            icon: Trophy,
            logoUrl: item.logoUrl,
            onPress: () => open.current.onOpenCompetition(item),
          })),
        ...(matchesSearch(query, known.ankara, 'ankara amatör tff')
          ? [
              {
                key: 'ankara',
                title: known.ankara,
                subtitle: copy.footballData.ankaraSourceDefault,
                icon: MapPin,
                onPress: () => open.current.onOpenAnkara(),
              },
            ]
          : []),
        ...known.leagues
          .filter(item => matchesSearch(query, item.name, item.season))
          .map(item => ({
            key: 'l-' + item.id,
            title: item.name,
            subtitle: item.season,
            icon: Trophy,
            onPress: () => open.current.onOpenLeague(item),
          })),
      ].slice(0, PER_GROUP);
      const teamRows: Row[] = (teams?.items ?? [])
        .slice(0, PER_GROUP)
        .map(item => ({
          key: 't-' + item.id,
          title: item.name,
          subtitle: item.district,
          icon: Shield,
          onPress: () => open.current.onOpenTeam(item.id),
        }));
      const playerRows: Row[] = (players?.items ?? [])
        .slice(0, PER_GROUP)
        .map(item => ({
          key: 'p-' + item.id,
          title: item.fullName,
          subtitle: item.playerProfile?.position || item.district,
          icon: UserRound,
          onPress: () => open.current.onOpenPlayer(item.id),
        }));
      if (!current) return;
      setRows(
        [
          { title: copy.leagues.searchLeagues, rows: leagueRows },
          { title: copy.leagues.searchTeams, rows: teamRows },
          { title: copy.leagues.searchPlayers, rows: playerRows },
        ].filter(group => group.rows.length),
      );
      setBusy(false);
    }
    run().catch(() => {
      if (current) setBusy(false);
    });
    return () => {
      current = false;
    };
  }, [query, token, footballService, discoveryService]);
  const searching = query.length >= minSearchLength;
  return (
    <Screen>
      <View style={styles.bar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={copy.leagues.searchBack}
          onPress={onBack}
          hitSlop={8}
          style={styles.back}
        >
          <ArrowLeft size={20} color={colors.text} />
        </Pressable>
        <View style={styles.field}>
          <Search size={18} color={colors.muted} />
          <TextInput
            autoFocus
            accessibilityLabel={copy.leagues.searchPlaceholder}
            placeholder={copy.leagues.searchPlaceholder}
            placeholderTextColor={colors.muted}
            value={text}
            onChangeText={setText}
            autoCorrect={false}
            returnKeyType="search"
            style={styles.input}
          />
        </View>
      </View>
      {!searching ? (
        <Text style={styles.hint}>{copy.leagues.searchHint}</Text>
      ) : busy && !rows.length ? (
        <ActivityIndicator color={colors.brand} />
      ) : !rows.length ? (
        <Text style={styles.hint}>{copy.leagues.searchNone}</Text>
      ) : (
        rows.map(group => (
          <View key={group.title} style={styles.group}>
            <Text accessibilityRole="header" style={styles.groupTitle}>
              {group.title}
            </Text>
            {group.rows.map(row => (
              <ResultRow key={row.key} row={row} />
            ))}
          </View>
        ))
      )}
    </Screen>
  );
}

function ResultRow({ row }: { row: Row }) {
  const Icon = row.icon;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={row.title + (row.subtitle ? ', ' + row.subtitle : '')}
      onPress={row.onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View style={styles.rowIcon}>
        {row.logoUrl ? (
          <RemoteLogo uri={row.logoUrl} name={row.title} size={26} />
        ) : (
          <Icon size={20} color={colors.brand} />
        )}
      </View>
      <View style={styles.rowBody}>
        <Text numberOfLines={1} style={styles.rowTitle}>
          {row.title}
        </Text>
        {row.subtitle ? (
          <Text numberOfLines={1} style={styles.rowSub}>
            {row.subtitle}
          </Text>
        ) : null}
      </View>
      <ChevronRight size={18} color={colors.muted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
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
  hint: { color: colors.muted, fontSize: 13, textAlign: 'center' },
  group: { gap: space.sm },
  groupTitle: { color: colors.text, fontSize: 17, fontWeight: '800' },
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
  rowIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.raised,
  },
  rowBody: { flex: 1, minWidth: 0, gap: 2 },
  rowTitle: { color: colors.text, fontSize: 15, fontWeight: '700' },
  rowSub: { ...type.caption, color: colors.muted },
});
