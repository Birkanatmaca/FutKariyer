import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Search } from 'lucide-react-native';
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

// Ligler landing: major leagues, TFF Ankara amateur leagues, then the
// admin-published Fut Career leagues, each as a swipeable row. The search
// button next to the logo opens the general search.
export function LeaguesHomeScreen({
  token,
  footballService,
  onOpenCompetition,
  onOpenAnkara,
  onOpenLeague,
  onSearch,
}: {
  token: string;
  footballService: FootballService;
  onOpenCompetition(competition: Competition): void;
  onOpenAnkara(): void;
  onOpenLeague(league: League): void;
  onSearch(): void;
}) {
  return (
    <Screen>
      <View style={styles.header}>
        <Brand />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={copy.leagues.searchOpen}
          onPress={onSearch}
          style={({ pressed }) => [styles.search, pressed && styles.pressed]}
        >
          <Search size={20} color={colors.brand} strokeWidth={2.2} />
        </Pressable>
      </View>
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
  title: {
    color: colors.text,
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '800',
    letterSpacing: -0.3,
    marginTop: space.sm,
  },
});
