import { useEffect, useState } from 'react';
import {
  createAuthService,
  authRepository,
  useAdminAuth,
  LoginScreen,
} from '../features/auth';
import {
  createAdminService,
  adminRepository,
  AdminPanel,
} from '../features/admin';
import { Brand } from '../shared/ui/Brand';
import { Button } from '../shared/ui/Button';
import { copy } from '../shared/lib/copy';
import { useAdminRoute } from './useAdminRoute';
const authService = createAuthService(authRepository);
const adminService = createAdminService(adminRepository);

export function App() {
  const auth = useAdminAuth(authService);
  const { route, navigate } = useAdminRoute();
  const [logoutBusy, setLogoutBusy] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);
  useEffect(() => {
    if (auth.user && route === 'login') {
      navigate('users', true);
    }
    if (
      !auth.loading &&
      !auth.user &&
      route !== 'missing' &&
      route !== 'login'
    ) {
      navigate('login', true);
    }
  }, [auth.user, auth.loading, route, navigate]);
  async function logout() {
    if (logoutBusy) {
      return;
    }
    setLogoutBusy(true);
    setLogoutError(null);
    try {
      await auth.logout();
      navigate('login', true);
    } catch (failure) {
      setLogoutError(
        failure instanceof Error ? failure.message : copy.form.unexpected,
      );
    } finally {
      setLogoutBusy(false);
    }
  }
  if (route === 'missing') {
    return (
      <main className="startup">
        <Brand />
        <h1>{copy.notFound.title}</h1>
        <Button onClick={() => navigate('login')}>{copy.notFound.back}</Button>
      </main>
    );
  }
  if (auth.loading) {
    return (
      <main className="startup">
        <Brand />
        <p role="status">{copy.form.loading}</p>
      </main>
    );
  }
  if (!auth.user) {
    return (
      <LoginScreen
        onLogin={auth.login}
        serviceError={auth.error}
        onRetry={auth.retry}
      />
    );
  }
  return (
    <AdminPanel
      key={auth.user.id}
      service={adminService}
      section={route === 'clubs' ? 'clubs' : 'users'}
      onSection={navigate}
      user={auth.user}
      onLogout={logout}
      logoutBusy={logoutBusy}
      logoutError={logoutError}
    />
  );
}
