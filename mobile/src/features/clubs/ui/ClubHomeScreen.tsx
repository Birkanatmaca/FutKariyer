import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useAuth } from '../../auth';
import type { ContentService } from '../../content';
import type { DiscoveryService } from '../../discovery';
import type { TeamsService } from '../../teams';
import { Brand } from '../../../shared/ui/Brand';
import { PageHeader } from '../../../shared/ui/PageHeader';
import { Screen } from '../../../shared/ui/Screen';
import { copy } from '../../../shared/lib/copy';
import { space } from '../../../styles/tokens';
import type { ClubService } from '../application/club-service';
import {
  ClubNewsSection,
  ClubPlayersSection,
  ClubProfileSection,
  ClubSquadSection,
  ClubTournamentsSection,
} from './ClubHomeSections';
import { ClubCenterSection } from './ClubCenterSection';

export function ClubHomeScreen({
  clubService,
  contentService,
  teamsService,
  discoveryService,
  onProfile,
  onLeagues,
  onTeamRequests,
  onNews,
  onComposeNews,
  onMyNews,
  onDiscover,
  onSquad,
  onListings,
  onTournaments,
  onTournamentEntries,
}: {
  clubService: ClubService;
  contentService: ContentService;
  teamsService: TeamsService;
  discoveryService: DiscoveryService;
  onProfile(): void;
  onLeagues(): void;
  onTeamRequests(): void;
  onNews(): void;
  onComposeNews(): void;
  onMyNews(): void;
  onDiscover(): void;
  onSquad(): void;
  onListings(): void;
  onTournaments(): void;
  onTournamentEntries(): void;
}) {
  const { user, token } = useAuth();
  return (
    <Screen>
      <Brand />
      <PageHeader
        eyebrow={copy.clubHome.eyebrow}
        title={copy.home.welcome(user?.fullName ?? '')}
      />
      <View style={styles.sections}>
        <ClubCenterSection
          token={token}
          service={clubService}
          onProfile={onProfile}
          onApplications={onTeamRequests}
          onNews={onMyNews}
          onLeagues={onLeagues}
        />
        <ClubProfileSection
          token={token}
          service={clubService}
          onEdit={onProfile}
        />
        <ClubNewsSection
          token={token}
          service={contentService}
          onNews={onNews}
          onCompose={onComposeNews}
          onMine={onMyNews}
        />
        <ClubPlayersSection
          token={token}
          teamsService={teamsService}
          discoveryService={discoveryService}
          onDiscover={onDiscover}
        />
        <ClubSquadSection onSquad={onSquad} onListings={onListings} />
        <ClubTournamentsSection
          onTournaments={onTournaments}
          onEntries={onTournamentEntries}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  sections: { gap: space.xxl },
});
