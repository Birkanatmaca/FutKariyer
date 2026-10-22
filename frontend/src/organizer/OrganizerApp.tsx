import { useState } from 'react';
import {
  OrganizerLoginScreen,
  organizerAuthRepository,
  useOrganizerSession,
} from '../features/organizer-auth';
import {
  TournamentWorkspace,
  TournamentsPanel,
  createTournamentService,
  tournamentRepository,
} from '../features/tournaments';
import { organizerCopy } from '../shared/lib/organizer-copy';
import { Brand } from '../shared/ui/Brand';
import { Button } from '../shared/ui/Button';
import { NavIcon } from '../shared/ui/NavIcon';
import { useOrganizerRoute } from './useOrganizerRoute';

const tournamentService = createTournamentService(tournamentRepository);

export function OrganizerApp() {
  const session = useOrganizerSession(organizerAuthRepository);
  const { route, openList, openTournament } = useOrganizerRoute();
  const [logoutBusy, setLogoutBusy] = useState(false);

  if (session.loading) {
    return (
      <main className="startup">
        <Brand />
        <p role="status">{organizerCopy.form.loading}</p>
      </main>
    );
  }
  if (!session.account) {
    return (
      <OrganizerLoginScreen
        onLogin={session.login}
        serviceError={session.error}
        notice={session.notice}
        onRetry={session.retry}
      />
    );
  }
  const account = session.account;
  async function logout() {
    if (logoutBusy) return;
    setLogoutBusy(true);
    try {
      await session.logout();
    } catch {
      // The token is dropped locally either way.
    } finally {
      setLogoutBusy(false);
    }
  }
  return (
    <div className="org-layout">
      <header className="org-topbar">
        <a
          href="/organizasyon"
          className="org-home"
          onClick={event => {
            event.preventDefault();
            openList();
          }}
        >
          <Brand />
          <span className="org-tag">{organizerCopy.shell.eyebrow}</span>
        </a>
        <div className="org-account">
          <span className="avatar">
            {account.fullName.slice(0, 1).toLocaleUpperCase('tr-TR')}
          </span>
          <span className="org-account-text">
            <strong>{account.fullName}</strong>
            <span>{organizerCopy.shell.account}</span>
          </span>
          <button
            type="button"
            className="icon-button"
            aria-label={organizerCopy.shell.logout}
            title={organizerCopy.shell.logout}
            disabled={logoutBusy}
            onClick={logout}
          >
            <NavIcon name="logout" />
          </button>
        </div>
      </header>
      {route.kind === 'tournament' ? (
        <TournamentWorkspace
          key={route.id}
          service={tournamentService}
          id={route.id}
          onBack={() => openList()}
        />
      ) : route.kind === 'list' ? (
        <TournamentsPanel service={tournamentService} onOpen={openTournament} />
      ) : (
        <main className="startup">
          <h1>{organizerCopy.shell.notFound}</h1>
          <Button onClick={() => openList(true)}>
            {organizerCopy.shell.backHome}
          </Button>
        </main>
      )}
    </div>
  );
}
