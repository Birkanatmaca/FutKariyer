import { useCallback, useEffect, useState } from 'react';
type Route = 'login' | 'users' | 'clubs' | 'missing';
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
  return 'missing';
}
export function useAdminRoute() {
  const [route, setRoute] = useState<Route>(currentRoute);
  const navigate = useCallback(
    (next: Exclude<Route, 'missing'>, replace = false) => {
      const path = '/securityadmin' + (next === 'login' ? '' : '/' + next);
      window.history[replace ? 'replaceState' : 'pushState'](null, '', path);
      setRoute(next);
    },
    [],
  );
  useEffect(() => {
    const update = () => setRoute(currentRoute());
    window.addEventListener('popstate', update);
    return () => window.removeEventListener('popstate', update);
  }, []);
  return { route, navigate };
}
