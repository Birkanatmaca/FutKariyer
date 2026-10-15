import { useCallback, useEffect, useState } from 'react';
export type PanelSection =
  | 'users'
  | 'clubs'
  | 'applications'
  | 'reports'
  | 'ads'
  | 'news'
  | 'leagues'
  | 'payments'
  | 'gifts'
  | 'announcements';
type Route = 'login' | PanelSection | 'club-overview' | 'missing';
type Location = { route: Route; clubId: string | null };
const clubOverviewPath = /^\/securityadmin\/clubs\/([0-9a-f]{32})$/;
function currentRoute(): Route {
  const path = window.location.pathname.replace(/\/$/, '');
  if (path === '' || path === '/securityadmin') {
    return 'login';
  }
  if (path === '/securityadmin/users') {
    return 'users';
  }
  if (path === '/securityadmin/clubs') {
    return 'clubs';
  }
  if (path === '/securityadmin/applications') return 'applications';
  if (path === '/securityadmin/reports') return 'reports';
  if (path === '/securityadmin/ads') return 'ads';
  if (path === '/securityadmin/news') return 'news';
  if (path === '/securityadmin/leagues') return 'leagues';
  if (path === '/securityadmin/payments') return 'payments';
  if (path === '/securityadmin/gifts') return 'gifts';
  if (path === '/securityadmin/announcements') return 'announcements';
  return 'missing';
}
function currentLocation(): Location {
  const path = window.location.pathname.replace(/\/$/, '');
  const match = clubOverviewPath.exec(path);
  if (match) {
    return { route: 'club-overview', clubId: match[1] };
  }
  return { route: currentRoute(), clubId: null };
}
export function useAdminRoute() {
  const [location, setLocation] = useState<Location>(currentLocation);
  const navigate = useCallback(
    (next: Exclude<Route, 'missing' | 'club-overview'>, replace = false) => {
      const path = '/securityadmin' + (next === 'login' ? '' : '/' + next);
      window.history[replace ? 'replaceState' : 'pushState'](null, '', path);
      setLocation({ route: next, clubId: null });
    },
    [],
  );
  const openClubOverview = useCallback((id: string) => {
    window.history.pushState(null, '', '/securityadmin/clubs/' + id);
    setLocation({ route: 'club-overview', clubId: id });
  }, []);
  useEffect(() => {
    const update = () => setLocation(currentLocation());
    window.addEventListener('popstate', update);
    return () => window.removeEventListener('popstate', update);
  }, []);
  return {
    route: location.route,
    clubId: location.clubId,
    navigate,
    openClubOverview,
  };
}
