import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useAuth, type StaffPermission } from '../../auth';
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
  // A coach running the club account only gets shortcuts to the sections the
  // club gave them; the server rejects the rest anyway.
  const can = (section: StaffPermission) =>
    !user?.delegate || user.delegate.permissions.includes(section);
  const allowed = (section: StaffPermission, action: () => void) =>
    can(section) ? action : undefined;
  return (
    <Screen>
      <Brand mark={false} />
      <PageHeader
        eyebrow={copy.clubHome.eyebrow}
        title={copy.home.welcome(user?.fullName ?? '')}
      />
      <View style={styles.sections}>
        <ClubCenterSection
          token={token}
          service={clubService}
          onProfile={allowed('profile', onProfile)}
          onApplications={allowed('applications', onTeamRequests)}
          onNews={allowed('news', onMyNews)}
          onLeagues={onLeagues}
        />
        <ClubProfileSection
          token={token}
          service={clubService}
          onEdit={allowed('profile', onProfile)}
        />
        <ClubNewsSection
          token={token}
          service={contentService}
          onNews={onNews}
          onCompose={allowed('news', onComposeNews)}
          onMine={allowed('news', onMyNews)}
        />
        <ClubPlayersSection
          token={token}
          teamsService={teamsService}
          discoveryService={discoveryService}
          applications={can('applications')}
          onDiscover={onDiscover}
        />
        <ClubSquadSection
          onSquad={allowed('squad', onSquad)}
          onListings={allowed('listings', onListings)}
        />
        <ClubTournamentsSection
          onTournaments={onTournaments}
          onEntries={allowed('tournaments', onTournamentEntries)}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  sections: { gap: space.xxl },
});
