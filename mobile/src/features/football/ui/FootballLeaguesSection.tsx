import React, { useCallback } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { ArrowRight, CalendarDays, MapPin } from 'lucide-react-native';
import { copy } from '../../../shared/lib/copy';
import { colors, radius, shadow, space, type } from '../../../styles/tokens';
import type { FootballService } from '../application/football-service';
import { useFootballResource } from '../application/useFootballResource';
import type { Competition } from '../domain/models';
import {
  competitionCardWidth,
  countMatches,
  gridColumns,
} from '../domain/rules';
import { ErrorBlock, LoadingBlock, SectionTitle } from './FootballStates';
import { RemoteLogo } from '../../../shared/ui/RemoteLogo';

const text = copy.footballData;

// Rows of three with flexible cards, so the grid holds three per row whatever
// padding the parent screen adds; the computed width only sizes the logo.
function rows<T>(items: T[]): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += gridColumns) {
    out.push(items.slice(i, i + gridColumns));
  }
  return out;
}

export function FootballLeaguesSection({
  token,
  service,
  onOpenCompetition,
  onOpenAnkara,
}: {
  token: string;
  service: FootballService;
  onOpenCompetition(competition: Competition): void;
  onOpenAnkara(): void;
}) {
  const load = useCallback(() => service.competitions(token), [service, token]);
  const { data, error, loading, retry } = useFootballResource(load);
  const { width } = useWindowDimensions();
  const cardWidth = competitionCardWidth(width, space.md, space.xl);
  // The bulletin is cached on the server; a failure just hides the badge.
  const loadBulletin = useCallback(
    () => service.ankaraBulletin(token),
    [service, token],
  );
  const bulletin = useFootballResource(loadBulletin);
  const weekMatches = bulletin.data
    ? bulletin.data.days.reduce((sum, day) => sum + countMatches(day.venues), 0)
    : 0;
  return (
    <>
      <SectionTitle
        title={text.majorTitle}
        description={text.majorDescription}
      />
      {loading ? (
        <LoadingBlock label={text.competitionsLoading} />
      ) : error ? (
        <ErrorBlock error={error} onRetry={retry} />
      ) : data ? (
        <CompetitionGrid
          items={data.competitions}
          width={cardWidth}
          onOpen={onOpenCompetition}
        />
      ) : null}
      {data && data.cups.length ? (
        <>
          <SectionTitle
            title={text.cupsTitle}
            description={text.cupsDescription}
          />
          <CompetitionGrid
            items={data.cups}
            width={cardWidth}
            onOpen={onOpenCompetition}
          />
        </>
      ) : null}
      <AnkaraCard
        title={data?.ankara.name || text.ankaraTitle}
        source={data?.ankara.source || text.ankaraSourceDefault}
        weekMatches={weekMatches}
        onPress={onOpenAnkara}
      />
    </>
  );
}

function CompetitionGrid({
  items,
  width,
  onOpen,
}: {
  items: Competition[];
  width: number;
  onOpen(competition: Competition): void;
}) {
  return (
    <View style={styles.grid}>
      {rows(items).map(row => (
        <View key={row[0].slug} style={styles.row}>
          {row.map(item => (
            <CompetitionCard
              key={item.slug}
              competition={item}
              width={width}
              onPress={() => onOpen(item)}
            />
          ))}
          {Array.from({ length: gridColumns - row.length }, (_, i) => (
            <View key={'spacer' + i} style={styles.spacer} />
          ))}
        </View>
      ))}
    </View>
  );
}

function CompetitionCard({
  competition,
  width,
  onPress,
}: {
  competition: Competition;
  width: number;
  onPress(): void;
}) {
  const logo = Math.max(28, Math.min(40, Math.round(width * 0.34)));
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={text.openCompetition(competition.name)}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.cardGlow} pointerEvents="none" />
      <View style={[styles.badge, { width: logo + 22, height: logo + 22 }]}>
        <RemoteLogo
          uri={competition.logoUrl}
          name={competition.name}
          size={logo}
        />
      </View>
      <Text numberOfLines={2} style={styles.cardName}>
        {competition.name}
      </Text>
      <Text numberOfLines={1} style={styles.cardCountry}>
        {competition.country}
      </Text>
    </Pressable>
  );
}

function AnkaraCard({
  title,
  source,
  weekMatches,
  onPress,
}: {
  title: string;
  source: string;
  weekMatches: number;
  onPress(): void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        weekMatches > 0
          ? text.openAnkara + ', ' + text.weekBadge(weekMatches)
          : text.openAnkara
      }
      accessibilityHint={text.ankaraDescription}
      onPress={onPress}
      style={({ pressed }) => [styles.wide, pressed && styles.pressed]}
    >
      <View style={styles.wideIcon}>
        <MapPin size={22} color={colors.brand} />
      </View>
      <View style={styles.wideContent}>
        <Text style={styles.wideTitle}>{title}</Text>
        <Text style={styles.source}>{source}</Text>
        {weekMatches > 0 ? (
          <View style={styles.weekBadge}>
            <CalendarDays size={13} color={colors.brandInk} />
            <Text style={styles.weekBadgeText}>
              {text.matchCount(weekMatches)}
            </Text>
          </View>
        ) : null}
      </View>
      <ArrowRight size={19} color={colors.muted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  grid: { gap: space.md },
  row: { flexDirection: 'row', gap: space.md },
  spacer: { flex: 1 },
  card: {
    flex: 1,
    minWidth: 0,
    minHeight: 136,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderColor: colors.hairline,
    borderWidth: 1,
    paddingHorizontal: space.sm,
    paddingTop: space.lg,
    paddingBottom: space.md,
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: space.xs,
    overflow: 'hidden',
  },
  // A floodlight cone over each badge.
  cardGlow: {
    position: 'absolute',
    top: -40,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.brandWash,
  },
  // League logos are often dark; a lit badge keeps them readable on the night background.
  badge: {
    borderRadius: radius.pill,
    backgroundColor: colors.text,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.brandSoft,
    ...shadow.glow,
    shadowOpacity: 0.2,
  },
  cardName: {
    color: colors.text,
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '800',
    letterSpacing: -0.2,
    textAlign: 'center',
    marginTop: space.sm,
  },
  cardCountry: {
    ...type.caption,
    fontSize: 11,
    color: colors.muted,
    textAlign: 'center',
  },
  wide: {
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderColor: colors.hairline,
    borderWidth: 1,
    padding: space.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    overflow: 'hidden',
  },
  wideIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.pill,
    backgroundColor: colors.brandWash,
    borderWidth: 1,
    borderColor: colors.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wideContent: { flex: 1, minWidth: 0, gap: space.xs },
  wideTitle: { ...type.headline, color: colors.text },
  source: { ...type.caption, fontSize: 11, color: colors.muted },
  weekBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    marginTop: space.xs,
    paddingHorizontal: space.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
    backgroundColor: colors.brand,
  },
  weekBadgeText: {
    ...type.number,
    color: colors.brandInk,
    fontSize: 12,
    fontWeight: '800',
  },
  pressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
});
