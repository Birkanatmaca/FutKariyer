import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { CalendarDays, MapPin, Search, X } from 'lucide-react-native';
import { copy } from '../../../shared/lib/copy';
import { colors, radius, shadow, space, type } from '../../../styles/tokens';
import type { FootballError } from '../application/useFootballResource';
import type {
  AnkaraBulletin,
  AnkaraBulletinMatch,
  AnkaraVenue,
} from '../domain/models';
import {
  ankaraLeagueGroup,
  bulletinDayLabel,
  countMatches,
  defaultBulletinDay,
  filterBulletinDay,
} from '../domain/rules';
import { Chip, ChipRow, LeagueTag, leagueGroupTone } from './AnkaraChips';
import { ErrorBlock, LoadingBlock, UpdatedLabel } from './FootballStates';
import { EmptyState } from '../../../shared/ui/EmptyState';

const text = copy.footballData;

export const dayLabel = (date: string) =>
  bulletinDayLabel(date, text.weekdaysShort);

export function AnkaraWeekTab({
  data,
  error,
  loading,
  retry,
  now = new Date(),
}: {
  data: AnkaraBulletin | null;
  error: FootballError | null;
  loading: boolean;
  retry(): void;
  now?: Date;
}) {
  if (loading && !data) return <LoadingBlock />;
  if (error) return <ErrorBlock error={error} onRetry={retry} />;
  if (!data) return null;
  if (!data.days.length)
    return (
      <EmptyState
        icon={CalendarDays}
        title={text.weekEmpty}
        body={text.weekEmptyHint}
      />
    );
  return (
    <>
      {loading ? (
        <ActivityIndicator
          accessibilityLabel={text.loading}
          color={colors.brand}
        />
      ) : null}
      <WeekContent data={data} now={now} />
    </>
  );
}

function WeekContent({ data, now }: { data: AnkaraBulletin; now: Date }) {
  const [today] = useState(now);
  const [day, setDay] = useState(() => defaultBulletinDay(data.days, today));
  const [league, setLeague] = useState('');
  const [query, setQuery] = useState('');
  // A refreshed bulletin may drop the selected day or league.
  useEffect(() => {
    setDay(current =>
      current < data.days.length
        ? current
        : defaultBulletinDay(data.days, today),
    );
    setLeague(current => (data.leagues.includes(current) ? current : ''));
  }, [data, today]);
  const venues = useMemo(
    () => filterBulletinDay(data.days[day], { league, query }),
    [data, day, league, query],
  );
  const total = countMatches(venues);
  return (
    <>
      <ChipRow>
        {data.days.map((item, index) => {
          const label = dayLabel(item.date);
          const count = countMatches(item.venues);
          return (
            <Chip
              key={item.date + index}
              label={label}
              count={count}
              accessibilityLabel={text.dayTab(item.date, count)}
              selected={index === day}
              onPress={() => setDay(index)}
            />
          );
        })}
      </ChipRow>
      <Summary matches={total} venues={venues.length} />
      {data.leagues.length > 1 ? (
        <ChipRow>
          <Chip
            label={text.all}
            selected={league === ''}
            onPress={() => setLeague('')}
          />
          {data.leagues.map(name => (
            <Chip
              key={name}
              label={name}
              tone={leagueGroupTone[ankaraLeagueGroup(name)]}
              accessibilityLabel={text.leagueFilter(name)}
              selected={league === name}
              onPress={() => setLeague(name)}
            />
          ))}
        </ChipRow>
      ) : null}
      <SearchField value={query} onChange={setQuery} />
      {venues.length ? (
        <View style={styles.venues}>
          {venues.map((venue, index) => (
            <VenueCard key={venue.name + index} venue={venue} />
          ))}
        </View>
      ) : (
        <EmptyState icon={Search} title={text.filterEmpty} />
      )}
      <UpdatedLabel at={data.updatedAt} />
    </>
  );
}

function Summary({ matches, venues }: { matches: number; venues: number }) {
  return (
    <View
      style={styles.summary}
      accessible
      accessibilityLabel={text.weekSummary(matches, venues)}
    >
      <View style={styles.summaryGlow} pointerEvents="none" />
      <View style={styles.stat}>
        <Text style={styles.bigNumber}>{matches}</Text>
        <Text style={styles.unit}>{text.matchesUnit}</Text>
      </View>
      <View style={styles.statDivider} />
      <View style={styles.stat}>
        <Text style={[styles.bigNumber, styles.secondNumber]}>{venues}</Text>
        <Text style={styles.unit}>{text.venuesUnit}</Text>
      </View>
    </View>
  );
}

function SearchField({
  value,
  onChange,
}: {
  value: string;
  onChange(value: string): void;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={[styles.search, focused && styles.searchFocused]}>
      <Search size={17} color={focused ? colors.brand : colors.muted} />
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={text.searchTeam}
        placeholderTextColor={colors.muted}
        accessibilityLabel={text.searchTeam}
        autoCorrect={false}
        autoCapitalize="none"
        returnKeyType="search"
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={styles.input}
      />
      {value ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={text.clearSearch}
          hitSlop={8}
          onPress={() => onChange('')}
          style={styles.clear}
        >
          <X size={14} color={colors.text} />
        </Pressable>
      ) : null}
    </View>
  );
}

function VenueCard({ venue }: { venue: AnkaraVenue }) {
  return (
    <View style={styles.venue}>
      <View
        style={styles.venueHead}
        accessible
        accessibilityRole="header"
        accessibilityLabel={text.venueLabel(venue.name, venue.matches.length)}
      >
        <View style={styles.pin}>
          <MapPin size={16} color={colors.brand} />
        </View>
        <Text numberOfLines={2} style={styles.venueName}>
          {venue.name}
        </Text>
        <Text style={styles.venueCount}>{venue.matches.length}</Text>
      </View>
      {venue.matches.map((match, index) => (
        <MatchRow
          key={index + match.time + match.home}
          match={match}
          first={index === 0}
        />
      ))}
    </View>
  );
}

function MatchRow({
  match,
  first,
}: {
  match: AnkaraBulletinMatch;
  first: boolean;
}) {
  return (
    <View
      style={[styles.match, !first && styles.matchDivider]}
      accessible
      accessibilityLabel={text.bulletinMatch(
        match.time,
        match.home,
        match.away,
        match.league,
      )}
    >
      <View style={styles.time}>
        <Text style={styles.timeText}>{match.time || '—'}</Text>
      </View>
      <View style={styles.matchBody}>
        <Text numberOfLines={2} style={styles.team}>
          {match.home}
        </Text>
        <Text numberOfLines={2} style={styles.team}>
          {match.away}
        </Text>
        {match.league ? <LeagueTag league={match.league} /> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xl,
    paddingVertical: space.lg,
    paddingHorizontal: space.xl,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
    overflow: 'hidden',
  },
  summaryGlow: {
    position: 'absolute',
    left: -30,
    top: -60,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: colors.brandWash,
  },
  stat: { flexDirection: 'row', alignItems: 'baseline', gap: space.sm },
  bigNumber: {
    ...type.display,
    ...type.number,
    fontSize: 44,
    lineHeight: 48,
    color: colors.brand,
  },
  secondNumber: { fontSize: 28, lineHeight: 34, color: colors.text },
  unit: { ...type.headline, color: colors.secondary },
  statDivider: {
    width: 1,
    alignSelf: 'stretch',
    backgroundColor: colors.border,
  },
  search: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.surface,
  },
  searchFocused: { borderColor: colors.brand },
  input: { flex: 1, color: colors.text, fontSize: 14, paddingVertical: 10 },
  clear: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
  },
  venues: { gap: space.md },
  venue: {
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
    paddingHorizontal: space.lg,
    paddingTop: space.lg,
    paddingBottom: space.sm,
    ...shadow.layer,
    shadowOpacity: 0.25,
  },
  venueHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingBottom: space.md,
  },
  pin: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.brandWash,
    borderWidth: 1,
    borderColor: colors.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  venueName: { ...type.headline, fontSize: 15, flex: 1, color: colors.text },
  venueCount: {
    ...type.number,
    minWidth: 28,
    textAlign: 'center',
    paddingHorizontal: space.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
    overflow: 'hidden',
    backgroundColor: colors.raised,
    color: colors.secondary,
    fontSize: 12,
    fontWeight: '800',
  },
  match: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.md,
    paddingVertical: space.md,
  },
  matchDivider: { borderTopWidth: 1, borderTopColor: colors.hairline },
  time: {
    minWidth: 58,
    paddingVertical: space.xs + 2,
    paddingHorizontal: space.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.raised,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  timeText: {
    ...type.number,
    color: colors.text,
    fontSize: 13,
    fontWeight: '800',
  },
  matchBody: { flex: 1, minWidth: 0, gap: 3 },
  team: { color: colors.text, fontSize: 14, lineHeight: 19, fontWeight: '700' },
});
