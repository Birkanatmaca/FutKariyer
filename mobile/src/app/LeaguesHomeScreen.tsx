import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  FootballLeaguesSection,
  type Competition,
  type FootballService,
} from '../features/football';
import { LeagueList, type League } from '../features/leagues';
import { PageHeader } from '../shared/ui/PageHeader';
import { Screen } from '../shared/ui/Screen';
import { copy } from '../shared/lib/copy';
import { colors, space } from '../styles/tokens';

// Ligler landing: major leagues, TFF Ankara amateur leagues, then the
// admin-published Fut Career leagues.
export function LeaguesHomeScreen({
  token,
  footballService,
  onOpenCompetition,
  onOpenAnkara,
  onOpenLeague,
}: {
  token: string;
  footballService: FootballService;
  onOpenCompetition(competition: Competition): void;
  onOpenAnkara(): void;
  onOpenLeague(league: League): void;
}) {
  return (
    <Screen>
      <PageHeader
        eyebrow={copy.leagues.eyebrow}
        title={copy.leagues.title}
        hint={copy.leagues.description}
      />
      <FootballLeaguesSection
        token={token}
        service={footballService}
        onOpenCompetition={onOpenCompetition}
        onOpenAnkara={onOpenAnkara}
      />
      <View style={styles.divider} />
      <Text accessibilityRole="header" style={styles.title}>
        {copy.footballData.futCareerTitle}
      </Text>
      <LeagueList onOpen={onOpenLeague} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  divider: { height: 1, backgroundColor: colors.border, marginTop: space.sm },
  title: {
    color: colors.text,
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
});
