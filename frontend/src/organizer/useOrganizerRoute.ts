import { useCallback, useEffect, useState } from 'react';

export type OrganizerRoute =
  | { kind: 'list' }
  | { kind: 'tournament'; id: string }
  | { kind: 'missing' };

const tournamentPath = /^\/organizasyon\/([0-9a-f]{32})\/?$/;

export function parseOrganizerPath(pathname: string): OrganizerRoute {
  if (pathname === '/organizasyon' || pathname === '/organizasyon/')
    return { kind: 'list' };
  const match = tournamentPath.exec(pathname);
  if (match) return { kind: 'tournament', id: match[1] };
  return { kind: 'missing' };
}

// history.pushState routing like the admin panel's useAdminRoute.
export function useOrganizerRoute() {
  const [route, setRoute] = useState<OrganizerRoute>(() =>
    parseOrganizerPath(window.location.pathname),
  );
  useEffect(() => {
    const update = () => setRoute(parseOrganizerPath(window.location.pathname));
    window.addEventListener('popstate', update);
    return () => window.removeEventListener('popstate', update);
  }, []);
  const openList = useCallback((replace = false) => {
    window.history[replace ? 'replaceState' : 'pushState'](
      null,
      '',
      '/organizasyon',
    );
    setRoute({ kind: 'list' });
    window.scrollTo(0, 0);
  }, []);
  const openTournament = useCallback((id: string) => {
    window.history.pushState(null, '', '/organizasyon/' + id);
    setRoute({ kind: 'tournament', id });
    window.scrollTo(0, 0);
  }, []);
  return { route, openList, openTournament };
}
