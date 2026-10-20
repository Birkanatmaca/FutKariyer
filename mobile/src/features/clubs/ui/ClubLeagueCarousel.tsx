import React, { useEffect, useRef, useState } from 'react';
import {
  AppState,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  CalendarDays,
  ChevronRight,
  MapPin,
  Trophy,
} from 'lucide-react-native';
import { useReducedMotion } from '../../../shared/lib/useReducedMotion';
import { copy } from '../../../shared/lib/copy';
import { colors, radius, space, type } from '../../../styles/tokens';
import {
  countdown,
  kickoffLabel,
  lastFixture,
  nextFixture,
  resultLetter,
  standingsWindow,
} from '../application/club-center';
import type {
  ClubCenterLeague,
  ClubMatchResult,
  ClubRecentFixture,
  ClubUpcomingFixture,
} from '../domain/models';
import { ClubCrest, rivalCrest } from './ClubCrest';

const text = copy.clubHome.match;
const pageHeight = 262;

const resultTone: Record<ClubMatchResult, string> = {
  win: colors.success,
  draw: colors.warning,
  loss: colors.danger,
};

// One card, three pages the club swipes through like the ad banner:
// the next match with a countdown, the table around the club, the last score.
export function ClubLeagueCarousel({
  league,
  clubName,
  avatarUri,
  onLeagues,
  now,
}: {
  league: ClubCenterLeague;
  clubName: string;
  avatarUri?: string;
  onLeagues(): void;
  // Fixed clock for tests; the card otherwise ticks every 30 seconds.
  now?: number;
}) {
  const scroll = useRef<ScrollView>(null),
    [width, setWidth] = useState(0),
    [selected, setSelected] = useState(0);
  const reduced = useReducedMotion();
  const clock = useClock(now);
  const pages = [
    <UpcomingPage
      key="upcoming"
      league={league}
      fixture={nextFixture(league)}
      clubName={clubName}
      avatarUri={avatarUri}
      now={clock}
    />,
    <StandingsPage key="standings" league={league} onLeagues={onLeagues} />,
    <LastPage
      key="last"
      league={league}
      fixture={lastFixture(league)}
      clubName={clubName}
      avatarUri={avatarUri}
    />,
  ];
  useEffect(() => {
    scroll.current?.scrollTo({ x: 0, animated: false });
    setSelected(0);
  }, [width]);
  function move(delta: number) {
    const next = Math.max(0, Math.min(pages.length - 1, selected + delta));
    scroll.current?.scrollTo({ x: next * width, animated: !reduced });
    setSelected(next);
  }
  return (
    <View
      testID="club-league-carousel"
      style={styles.frame}
      onLayout={event => setWidth(event.nativeEvent.layout.width)}
    >
      <ScrollView
        ref={scroll}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={event => {
          if (width)
            setSelected(
              Math.max(
                0,
                Math.min(
                  pages.length - 1,
                  Math.round(event.nativeEvent.contentOffset.x / width),
                ),
              ),
            );
        }}
      >
        {pages.map(page => (
          <View key={page.key} style={[styles.page, { width }]}>
            {page}
          </View>
        ))}
      </ScrollView>
      {/* The dots double as the screen-reader control for changing pages;
          the pages themselves stay readable, including the table link. */}
      <View
        style={styles.dots}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={text.carouselLabel}
        accessibilityValue={{
          text:
            [text.upcomingTitle, text.standingsTitle, text.lastTitle][
              selected
            ] +
            ', ' +
            text.page(selected + 1, pages.length),
        }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={event =>
          move(event.nativeEvent.actionName === 'increment' ? 1 : -1)
        }
      >
        {pages.map((page, index) => (
          <View
            key={page.key}
            style={[styles.dot, index === selected && styles.dotActive]}
          />
        ))}
      </View>
    </View>
  );
}

// The countdown refreshes while the app is open; a fixed clock wins in tests.
function useClock(fixed?: number) {
  const [now, setNow] = useState(() => fixed ?? Date.now());
  useEffect(() => {
    if (fixed !== undefined) return;
    const tick = () => setNow(Date.now());
    const timer = setInterval(tick, 30000);
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') tick();
    });
    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, [fixed]);
  return fixed ?? now;
}

function PageHeader({ title, meta }: { title: string; meta?: string }) {
  return (
    <View style={styles.header}>
      <Text accessibilityRole="header" style={styles.eyebrow}>
        {title.toLocaleUpperCase('tr-TR')}
      </Text>
      {meta ? (
        <Text numberOfLines={1} style={styles.headerMeta}>
          {meta}
        </Text>
      ) : null}
    </View>
  );
}

function Side({
  name,
  uri,
  own,
}: {
  name: string;
  uri?: string;
  own: boolean;
}) {
  return (
    <View style={styles.side}>
      <ClubCrest name={name} uri={uri} own={own} />
      <Text
        numberOfLines={2}
        style={[styles.sideName, own && styles.sideNameOwn]}
      >
        {name}
      </Text>
    </View>
  );
}

function Meta({
  icon: Icon,
  children,
}: {
  icon: typeof CalendarDays;
  children: string;
}) {
  return (
    <View style={styles.meta}>
      <Icon size={13} color={colors.muted} />
      <Text numberOfLines={1} style={styles.metaText}>
        {children}
      </Text>
    </View>
  );
}

function Empty({ children }: { children: string }) {
  return (
    <View style={styles.empty}>
      <Trophy size={22} color={colors.muted} />
      <Text style={styles.emptyText}>{children}</Text>
    </View>
  );
}

// Home team on the left, as the federation's fixture writes it.
function sides(
  fixture: Pick<
    ClubUpcomingFixture,
    'isHome' | 'opponentName' | 'opponentId' | 'opponentAvatarVersion'
  >,
  clubName: string,
  avatarUri?: string,
) {
  const club = { name: clubName, uri: avatarUri, own: true };
  const rival = {
    name: fixture.opponentName,
    uri: rivalCrest(fixture),
    own: false,
  };
  return fixture.isHome ? [club, rival] : [rival, club];
}

function UpcomingPage({
  league,
  fixture,
  clubName,
  avatarUri,
  now,
}: {
  league: ClubCenterLeague;
  fixture: ClubUpcomingFixture | null;
  clubName: string;
  avatarUri?: string;
  now: number;
}) {
  if (!fixture) {
    return (
      <>
        <PageHeader title={text.upcomingTitle} meta={league.leagueName} />
        <Empty>{text.noUpcoming}</Empty>
      </>
    );
  }
  const [home, away] = sides(fixture, clubName, avatarUri);
  return (
    <>
      <PageHeader
        title={text.upcomingTitle}
        meta={
          text.week(fixture.round) +
          ' · ' +
          (fixture.isHome ? text.home : text.away)
        }
      />
      <View style={styles.teams}>
        <Side {...home} />
        <View style={styles.versus}>
          <Text style={styles.versusText}>{text.versus}</Text>
        </View>
        <Side {...away} />
      </View>
      <Countdown fixture={fixture} now={now} />
      <View style={styles.metas}>
        <Meta icon={CalendarDays}>{kickoffLabel(fixture)}</Meta>
        <Meta icon={MapPin}>{fixture.venue || text.venueUnknown}</Meta>
      </View>
    </>
  );
}

function Countdown({
  fixture,
  now,
}: {
  fixture: ClubUpcomingFixture;
  now: number;
}) {
  const left = countdown(fixture, now);
  if (left.kind === 'clock') {
    const units: [number, string][] = [
      [left.days, text.units.days],
      [left.hours, text.units.hours],
      [left.minutes, text.units.minutes],
    ];
    return (
      <View
        accessible
        accessibilityLabel={text.countdownLabel(
          left.days,
          left.hours,
          left.minutes,
        )}
        style={styles.clock}
      >
        {units.map(([value, unit]) => (
          <View key={unit} style={styles.clockBox}>
            <Text style={styles.clockValue}>
              {unit === text.units.days
                ? value
                : String(value).padStart(2, '0')}
            </Text>
            <Text style={styles.clockUnit}>{unit}</Text>
          </View>
        ))}
      </View>
    );
  }
  const label =
    left.kind === 'days'
      ? text.daysLeft(left.days)
      : left.kind === 'today'
      ? text.today
      : left.kind === 'started'
      ? text.started
      : text.dateUnknown;
  const highlight = left.kind === 'days' || left.kind === 'today';
  return (
    <View style={[styles.pill, highlight && styles.pillHighlight]}>
      <Text style={[styles.pillText, highlight && styles.pillTextHighlight]}>
        {label}
      </Text>
    </View>
  );
}

function StandingsPage({
  league,
  onLeagues,
}: {
  league: ClubCenterLeague;
  onLeagues(): void;
}) {
  const rows = standingsWindow(league.standings);
  const t = text.table;
  return (
    <>
      <PageHeader title={text.standingsTitle} meta={league.leagueName} />
      <View style={styles.table}>
        <View style={styles.row}>
          <Text style={[styles.th, styles.colPos]}>{t.position}</Text>
          <Text style={[styles.th, styles.colTeam]}>
            {t.team.toLocaleUpperCase('tr-TR')}
          </Text>
          <Text style={[styles.th, styles.colNum]}>{t.played}</Text>
          <Text style={[styles.th, styles.colNum]}>{t.difference}</Text>
          <Text style={[styles.th, styles.colNum]}>{t.points}</Text>
        </View>
        {rows.map(row => (
          <View
            key={row.position + row.teamName}
            style={[styles.row, styles.bodyRow, row.own && styles.ownRow]}
          >
            <Text style={[styles.td, styles.colPos, row.own && styles.ownText]}>
              {row.position}
            </Text>
            <Text
              numberOfLines={1}
              style={[styles.td, styles.colTeam, row.own && styles.ownText]}
            >
              {row.teamName}
            </Text>
            <Text style={[styles.td, styles.colNum]}>{row.played}</Text>
            <Text style={[styles.td, styles.colNum]}>
              {row.goalDifference > 0
                ? '+' + row.goalDifference
                : row.goalDifference}
            </Text>
            <Text
              style={[
                styles.td,
                styles.colNum,
                styles.points,
                row.own && styles.ownText,
              ]}
            >
              {row.points}
            </Text>
          </View>
        ))}
      </View>
      <View style={styles.tableFoot}>
        <Text numberOfLines={1} style={styles.source}>
          {league.source === 'tff' ? text.tffSource : ''}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={text.standingsTitle + ': ' + text.fullTable}
          onPress={onLeagues}
          hitSlop={8}
          style={({ pressed }) => [styles.link, pressed && styles.pressed]}
        >
          <Text style={styles.linkText}>{text.fullTable}</Text>
          <ChevronRight size={14} color={colors.brand} />
        </Pressable>
      </View>
    </>
  );
}

function LastPage({
  league,
  fixture,
  clubName,
  avatarUri,
}: {
  league: ClubCenterLeague;
  fixture: ClubRecentFixture | null;
  clubName: string;
  avatarUri?: string;
}) {
  if (!fixture) {
    return (
      <>
        <PageHeader title={text.lastTitle} meta={league.leagueName} />
        <Empty>{text.noRecent}</Empty>
      </>
    );
  }
  const [home, away] = sides(fixture, clubName, avatarUri);
  const [homeGoals, awayGoals] = fixture.isHome
    ? [fixture.goalsFor, fixture.goalsAgainst]
    : [fixture.goalsAgainst, fixture.goalsFor];
  const tone = resultTone[fixture.result];
  return (
    <>
      <PageHeader title={text.lastTitle} meta={text.week(fixture.round)} />
      <View style={styles.teams}>
        <Side {...home} />
        <View style={styles.score}>
          <Text
            accessibilityLabel={
              home.name + ' ' + homeGoals + ', ' + away.name + ' ' + awayGoals
            }
            style={styles.scoreText}
          >
            {homeGoals} - {awayGoals}
          </Text>
          <View style={[styles.result, { borderColor: tone }]}>
            <Text style={[styles.resultText, { color: tone }]}>
              {copy.clubHome.resultName[fixture.result]}
            </Text>
          </View>
        </View>
        <Side {...away} />
      </View>
      <View style={styles.metas}>
        <Meta icon={CalendarDays}>{kickoffLabel(fixture)}</Meta>
        <Meta icon={MapPin}>{fixture.venue || text.venueUnknown}</Meta>
      </View>
      <View style={styles.form}>
        <Text style={styles.formTitle}>{text.formTitle}</Text>
        {league.recent.map(match => (
          <View
            key={match.id}
            accessible
            accessibilityLabel={
              copy.clubHome.resultName[match.result] +
              ', ' +
              match.goalsFor +
              '-' +
              match.goalsAgainst +
              ' ' +
              match.opponentName
            }
            style={[styles.badge, { borderColor: resultTone[match.result] }]}
          >
            <Text
              style={[styles.badgeText, { color: resultTone[match.result] }]}
            >
              {resultLetter(match.result)} {match.goalsFor}-{match.goalsAgainst}
            </Text>
          </View>
        ))}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  frame: {
    width: '100%',
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.surface,
  },
  page: {
    height: pageHeight,
    padding: space.lg,
    gap: space.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
  },
  eyebrow: { ...type.eyebrow, color: colors.brand },
  headerMeta: {
    ...type.caption,
    flexShrink: 1,
    color: colors.secondary,
    textAlign: 'right',
  },
  teams: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: space.sm,
  },
  side: { flex: 1, alignItems: 'center', gap: space.sm },
  sideName: {
    ...type.caption,
    color: colors.secondary,
    fontWeight: '700',
    textAlign: 'center',
  },
  sideNameOwn: { color: colors.text },
  versus: {
    marginTop: 14,
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
    borderRadius: radius.pill,
    backgroundColor: colors.overlay,
  },
  versusText: { ...type.eyebrow, color: colors.muted },
  clock: { flexDirection: 'row', justifyContent: 'center', gap: space.sm },
  clockBox: {
    minWidth: 64,
    alignItems: 'center',
    paddingVertical: space.xs,
    borderRadius: radius.md,
    backgroundColor: colors.raised,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  clockValue: {
    ...type.number,
    color: colors.text,
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '800',
  },
  clockUnit: { ...type.caption, fontSize: 10, color: colors.muted },
  pill: {
    alignSelf: 'center',
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.raised,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  pillHighlight: {
    backgroundColor: colors.brandWash,
    borderColor: colors.brand,
  },
  pillText: { ...type.caption, color: colors.secondary, fontWeight: '700' },
  pillTextHighlight: { color: colors.brand },
  metas: { gap: space.xs },
  meta: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  metaText: { ...type.caption, flexShrink: 1, color: colors.muted },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
  },
  emptyText: { ...type.body, color: colors.muted, textAlign: 'center' },
  table: { gap: 2 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.sm,
    gap: space.sm,
  },
  bodyRow: { minHeight: 28, borderRadius: radius.sm },
  ownRow: { backgroundColor: colors.brandWash },
  th: { ...type.eyebrow, fontSize: 9, color: colors.muted },
  td: { ...type.caption, ...type.number, color: colors.secondary },
  ownText: { color: colors.brand, fontWeight: '800' },
  colPos: { width: 20 },
  colTeam: { flex: 1 },
  colNum: { width: 28, textAlign: 'right' },
  points: { color: colors.text, fontWeight: '800' },
  tableFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.sm,
    marginTop: 'auto',
  },
  source: { ...type.caption, fontSize: 10, flexShrink: 1, color: colors.muted },
  link: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  pressed: { opacity: 0.75 },
  linkText: { ...type.caption, color: colors.brand, fontWeight: '700' },
  score: { alignItems: 'center', gap: space.sm, paddingTop: space.xs },
  scoreText: {
    ...type.number,
    color: colors.text,
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '800',
    letterSpacing: -1,
  },
  result: {
    paddingHorizontal: space.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  resultText: { ...type.caption, fontSize: 11, fontWeight: '800' },
  form: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  formTitle: { ...type.caption, color: colors.muted, marginRight: 'auto' },
  badge: {
    paddingHorizontal: space.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
    borderWidth: 1,
  },
  badgeText: { ...type.number, fontSize: 11, fontWeight: '800' },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: space.xs,
    paddingBottom: space.md,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.overlay,
  },
  dotActive: { width: 16, backgroundColor: colors.brand },
});
