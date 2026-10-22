import React, { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  CalendarDays,
  ChevronRight,
  Medal,
  Search,
  Trophy,
} from 'lucide-react-native';
import {
  FootballLeaguesSection,
  type Competition,
  type FootballService,
} from '../features/football';
import { LeagueRail, type League } from '../features/leagues';
import { Brand } from '../shared/ui/Brand';
import { Screen } from '../shared/ui/Screen';
import { copy } from '../shared/lib/copy';
import { colors, radius, space } from '../styles/tokens';

type Tab = 'mine' | 'leagues';
const tabs: { key: Tab; icon: typeof Trophy }[] = [
  { key: 'mine', icon: CalendarDays },
  { key: 'leagues', icon: Trophy },
];

// Ligler landing: major leagues, TFF Ankara amateur leagues, then the
// admin-published Fut Career leagues, each as a swipeable row. The search
// button next to the logo opens the general search. A club account (20 Oct
// 2026) opens on Maçlarım — its own league — with Ligler one tap away.
export function LeaguesHomeScreen({
  token,
  footballService,
  clubMatches,
  onOpenCompetition,
  onOpenAnkara,
  onOpenLeague,
  onSearch,
  onHalisaha,
}: {
  token: string;
  footballService: FootballService;
  // The club's Maçlarım page; only club accounts have it.
  clubMatches?: ReactNode;
  onOpenCompetition(competition: Competition): void;
  onOpenAnkara(): void;
  onOpenLeague(league: League): void;
  onSearch(): void;
  // Halı saha leagues and tournaments run by organizers (22 Oct 2026).
  onHalisaha(): void;
}) {
  const [tab, setTab] = useState<Tab>('mine');
  const showMine = !!clubMatches && tab === 'mine';
  return (
    <Screen>
      <View style={styles.header}>
        <Brand mark={false} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={copy.leagues.searchOpen}
          onPress={onSearch}
          style={({ pressed }) => [styles.search, pressed && styles.pressed]}
        >
          <Search size={20} color={colors.brand} strokeWidth={2.2} />
        </Pressable>
      </View>
      {clubMatches ? (
        <View style={styles.segments} accessibilityRole="tablist">
          {tabs.map(({ key, icon: Icon }) => {
            const selected = key === tab;
            return (
              <Pressable
                key={key}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                accessibilityHint={copy.clubMatches.tabHints[key]}
                onPress={() => setTab(key)}
                style={({ pressed }) => [
                  styles.segment,
                  selected && styles.segmentOn,
                  pressed && styles.pressed,
                ]}
              >
                <Icon
                  size={17}
                  color={selected ? colors.brand : colors.muted}
                />
                <Text
                  style={[styles.segmentText, selected && styles.segmentTextOn]}
                >
                  {copy.clubMatches.tabs[key]}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
      {showMine ? (
        clubMatches
      ) : (
        <>
          <FootballLeaguesSection
            token={token}
            service={footballService}
            onOpenCompetition={onOpenCompetition}
            onOpenAnkara={onOpenAnkara}
          />
          <Text accessibilityRole="header" style={styles.title}>
            {copy.footballData.futCareerTitle}
          </Text>
          <LeagueRail onOpen={onOpenLeague} />
          <Text accessibilityRole="header" style={styles.title}>
            {copy.tournaments.halisahaTitle}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={copy.tournaments.halisahaTitle}
            accessibilityHint={copy.tournaments.halisahaHint}
            onPress={onHalisaha}
            style={({ pressed }) => [
              styles.halisaha,
              pressed && styles.halisahaPressed,
            ]}
          >
            <View style={styles.halisahaIcon}>
              <Medal size={22} color={colors.brand} />
            </View>
            <View style={styles.halisahaText}>
              <Text style={styles.halisahaTitle}>
                {copy.tournaments.halisahaTitle}
              </Text>
              <Text style={styles.halisahaHint}>
                {copy.tournaments.halisahaHint}
              </Text>
            </View>
            <ChevronRight size={18} color={colors.muted} />
          </Pressable>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  search: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.raised,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pressed: { opacity: 0.82, transform: [{ scale: 0.97 }] },
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
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.transparent,
  },
  segmentOn: { backgroundColor: colors.overlay, borderColor: colors.brandSoft },
  segmentText: { color: colors.muted, fontSize: 14, fontWeight: '700' },
  segmentTextOn: { color: colors.text },
  title: {
    color: colors.text,
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '800',
    letterSpacing: -0.3,
    marginTop: space.sm,
  },
  halisaha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.surface,
  },
  halisahaPressed: { backgroundColor: colors.raised },
  halisahaIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brandWash,
  },
  halisahaText: { flex: 1, minWidth: 0, gap: 2 },
  halisahaTitle: { color: colors.text, fontSize: 15, fontWeight: '700' },
  halisahaHint: { color: colors.muted, fontSize: 12, lineHeight: 17 },
});
