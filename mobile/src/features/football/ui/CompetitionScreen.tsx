import React, { useCallback, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BackLink } from '../../../shared/ui/BackLink';
import { copy } from '../../../shared/lib/copy';
import { colors, radius, space } from '../../../styles/tokens';
import type { FootballService } from '../application/football-service';
import {
  useFocusedInterval,
  useFootballResource,
} from '../application/useFootballResource';
import type {
  Competition,
  CompetitionStats,
  LiveScores,
  Results,
  Standings,
} from '../domain/models';
import { isCup } from '../domain/rules';
import { FixtureCard, ResultList } from './ResultList';
import {
  EmptyBlock,
  ErrorBlock,
  LoadingBlock,
  UpdatedLabel,
} from './FootballStates';
import { RemoteLogo } from '../../../shared/ui/RemoteLogo';
import { StandingsTable } from './StandingsTable';
import { TopPlayersList } from './TopPlayersList';

const text = copy.footballData;
// The server caches today's matches for 30 seconds.
export const livePollMs = 30_000;
export type CompetitionTab = 'standings' | 'live' | 'stats';
const tabs: CompetitionTab[] = ['standings', 'live', 'stats'];
type TabData =
  | { tab: 'standings'; value: Standings }
  | { tab: 'stats'; value: CompetitionStats };
type Resource<T> = ReturnType<typeof useFootballResource<T>>;

export function CompetitionScreen({
  token,
  service,
  competition,
  onBack,
  initialTab = 'standings',
  source = text.majorSourceDefault,
}: {
  token: string;
  service: FootballService;
  competition: Competition;
  onBack(): void;
  initialTab?: CompetitionTab;
  source?: string;
}) {
  const [tab, setTab] = useState<CompetitionTab>(initialTab);
  const isLive = tab === 'live';
  const { slug } = competition;
  const loadTab = useCallback(async (): Promise<TabData> => {
    if (tab === 'stats')
      return { tab, value: await service.stats(token, slug) };
    return { tab: 'standings', value: await service.standings(token, slug) };
  }, [service, token, slug, tab]);
  const loadLive = useCallback(
    () => service.live(token, slug),
    [service, token, slug],
  );
  const loadResults = useCallback(
    () => service.results(token, slug),
    [service, token, slug],
  );
  // Standings and stats are cached for long on the server; they load on
  // focus or pull. The live tab polls today's matches while it is visible.
  const resource = useFootballResource(loadTab, { enabled: !isLive });
  const live = useFootballResource(loadLive, { enabled: isLive });
  const results = useFootballResource(loadResults, { enabled: isLive });
  useFocusedInterval(live.poll, livePollMs, isLive);
  const refreshing = isLive
    ? live.refreshing || results.refreshing
    : resource.refreshing;
  const liveRefresh = live.refresh;
  const resultsRefresh = results.refresh;
  const tabRefresh = resource.refresh;
  const onRefresh = useCallback(() => {
    if (isLive) {
      liveRefresh();
      resultsRefresh();
    } else tabRefresh();
  }, [isLive, liveRefresh, resultsRefresh, tabRefresh]);
  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safe}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.brand}
            colors={[colors.brand]}
          />
        }
      >
        <BackLink label={text.back} onPress={onBack} />
        <View style={styles.header}>
          <View style={styles.logoBadge}>
            <RemoteLogo
              uri={competition.logoUrl}
              name={competition.name}
              size={44}
            />
          </View>
          <View style={styles.headerText}>
            <Text style={styles.eyebrow}>
              {(isCup(competition.slug) ? text.cupEyebrow : text.eyebrow) +
                ' · ' +
                competition.country.toLocaleUpperCase('tr-TR')}
            </Text>
            <Text accessibilityRole="header" style={styles.title}>
              {competition.name}
            </Text>
            <Text style={styles.source}>{text.source(source)}</Text>
          </View>
        </View>
        <View style={styles.tabs} accessibilityRole="tablist">
          {tabs.map(value => (
            <Pressable
              key={value}
              accessibilityRole="tab"
              accessibilityState={{ selected: tab === value }}
              aria-selected={tab === value}
              onPress={() => setTab(value)}
              style={styles.tab}
            >
              <Text
                style={[styles.tabText, tab === value && styles.selectedText]}
              >
                {text.tabs[value]}
              </Text>
              <View
                style={[
                  styles.indicator,
                  tab === value && styles.selectedIndicator,
                ]}
              />
            </Pressable>
          ))}
        </View>
        {isLive ? (
          <LiveTab live={live} results={results} />
        ) : resource.loading && !resource.data ? (
          <LoadingBlock />
        ) : resource.error ? (
          <ErrorBlock error={resource.error} onRetry={resource.retry} />
        ) : resource.data && resource.data.tab === tab ? (
          <TabContent data={resource.data} />
        ) : (
          <LoadingBlock />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Meta({ label, at }: { label?: string; at: string }) {
  return (
    <View style={styles.meta}>
      {label ? <Text style={styles.season}>{label}</Text> : <View />}
      <UpdatedLabel at={at} />
    </View>
  );
}

function LiveTab({
  live,
  results,
}: {
  live: Resource<LiveScores>;
  results: Resource<Results>;
}) {
  return (
    <>
      <View style={styles.section}>
        <Text accessibilityRole="header" style={styles.heading}>
          {text.todayHeading}
        </Text>
        {live.loading && !live.data ? (
          <LoadingBlock />
        ) : live.error ? (
          <ErrorBlock error={live.error} onRetry={live.retry} />
        ) : live.data ? (
          <>
            <Meta at={live.data.updatedAt} />
            {live.data.items.length ? (
              <FixtureCard items={live.data.items} />
            ) : (
              <Text style={styles.empty}>{text.liveEmpty}</Text>
            )}
          </>
        ) : null}
      </View>
      <View style={styles.section}>
        <Text accessibilityRole="header" style={styles.heading}>
          {text.resultsHeading}
        </Text>
        {results.loading && !results.data ? (
          <LoadingBlock />
        ) : results.error ? (
          <ErrorBlock error={results.error} onRetry={results.retry} />
        ) : results.data ? (
          <>
            <Meta label={results.data.season} at={results.data.updatedAt} />
            {results.data.items.length ? (
              <ResultList items={results.data.items} />
            ) : (
              <Text style={styles.empty}>{text.resultsEmpty}</Text>
            )}
          </>
        ) : null}
      </View>
    </>
  );
}

function TabContent({ data }: { data: TabData }) {
  const meta = <Meta label={data.value.season} at={data.value.updatedAt} />;
  if (data.tab === 'standings')
    return data.value.rows.length ? (
      <>
        {meta}
        <StandingsTable rows={data.value.rows} />
      </>
    ) : (
      <EmptyBlock body={text.standingsEmpty} />
    );
  return data.value.topScorers.length || data.value.topAssists.length ? (
    <>
      {meta}
      <TopPlayersList
        title={text.topScorers}
        unit={text.goals}
        players={data.value.topScorers}
      />
      <TopPlayersList
        title={text.topAssists}
        unit={text.assists}
        players={data.value.topAssists}
      />
    </>
  ) : (
    <EmptyBlock body={text.statsEmpty} />
  );
}

const styles = StyleSheet.create({
  // Same lit badge as the league cards, so dark league logos stay readable.
  logoBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.text,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.brandSoft,
  },
  safe: { flex: 1, backgroundColor: colors.bg },
  content: {
    padding: space.lg,
    gap: space.lg,
    paddingBottom: 120,
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center',
    flexGrow: 1,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  headerText: { flex: 1, minWidth: 0, gap: space.xs },
  eyebrow: {
    color: colors.muted,
    fontSize: 10,
    letterSpacing: 1.6,
    fontWeight: '700',
  },
  title: {
    color: colors.text,
    fontSize: 26,
    lineHeight: 32,
    letterSpacing: -0.6,
    fontWeight: '800',
  },
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tab: {
    flex: 1,
    minHeight: 48,
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: space.sm,
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
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.sm,
  },
  season: { color: colors.brand, fontSize: 12, fontWeight: '700' },
  source: { color: colors.muted, fontSize: 11 },
  section: { gap: space.md },
  heading: { color: colors.text, fontSize: 15, fontWeight: '800' },
  empty: { color: colors.secondary, fontSize: 12, lineHeight: 18 },
});
