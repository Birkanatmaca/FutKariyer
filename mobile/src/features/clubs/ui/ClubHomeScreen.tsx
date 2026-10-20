import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useAuth, type StaffPermission } from '../../auth';
import { accountRepository, avatarUrl, useAccountProfile } from '../../account';
import type { ContentService } from '../../content';
import { Brand } from '../../../shared/ui/Brand';
import { Screen } from '../../../shared/ui/Screen';
import { space } from '../../../styles/tokens';
import type { ClubService } from '../application/club-service';
import { useClubCenter } from '../application/useClubCenter';
import { ClubNewsSection, ClubQuickActions } from './ClubHomeSections';
import { ClubCenterSection } from './ClubCenterSection';

// The club home (20 Oct 2026): Merhaba card, league card, news with two slim
// buttons, then the quick action tiles.
export function ClubHomeScreen({
  clubService,
  contentService,
  onProfile,
  onLinkTff,
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
  onProfile(): void;
  // Opens the TFF Ankara team picker.
  onLinkTff(): void;
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
  // The crest is the club account's profile photo.
  const account = useAccountProfile(accountRepository, token);
  const center = useClubCenter(clubService, token);
  return (
    <Screen>
      <Brand mark={false} />
      <View style={styles.sections}>
        <ClubCenterSection
          state={center}
          clubName={user?.fullName ?? ''}
          avatarUri={
            account.profile
              ? avatarUrl(account.profile.id, account.profile.avatarVersion) ||
                undefined
              : undefined
          }
          onProfile={allowed('profile', onProfile)}
          onApplications={allowed('applications', onTeamRequests)}
          onNews={allowed('news', onMyNews)}
          onLeagues={onLeagues}
          onLinkTff={allowed('profile', onLinkTff)}
        />
        <ClubNewsSection
          token={token}
          service={contentService}
          onNews={onNews}
          onCompose={allowed('news', onComposeNews)}
          onMine={allowed('news', onMyNews)}
        />
        <ClubQuickActions
          pendingApplications={center.center?.pendingApplications}
          onApplications={allowed('applications', onTeamRequests)}
          onDiscover={onDiscover}
          onSquad={allowed('squad', onSquad)}
          onListings={allowed('listings', onListings)}
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
