import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';
import { ApiError } from '../../../shared/api/client';
import { copy } from '../../../shared/lib/copy';
import type {
  AccountApplicationInput,
  AdminUser,
  AuthRepository,
  LoginInput,
  RegisterInput,
  SavedSession,
  SessionKind,
  SessionStorage,
  User,
} from '../domain/models';

type AuthContextValue = {
  // Mobile (player, coach, club, organizer) account; null in admin mode.
  user: User | null;
  // Token for the /v1 user API. It is null in admin mode so user screens can
  // never send an admin token.
  token: string | null;
  // Admin mode: the admin account and its bearer token for /v1/admin only.
  admin: AdminUser | null;
  adminToken: string | null;
  // Shown on the sign-in screen after an admin session expired.
  sessionNotice: string | null;
  restoring: boolean;
  restoreError: string | null;
  retryRestore(): Promise<void>;
  signIn(input: LoginInput): Promise<void>;
  signUp(input: RegisterInput): Promise<void>;
  // Applications never create a session; the account waits for approval.
  apply(input: AccountApplicationInput): Promise<void>;
  signOut(): Promise<void>;
  deleteAccount(password: string): Promise<void>;
  // Called when an admin endpoint answers 401 (expired or revoked session).
  expireAdminSession(): Promise<void>;
};
type Current =
  | { kind: 'user'; saved: SavedSession; user: User }
  | { kind: 'admin'; saved: SavedSession; admin: AdminUser };
const AuthContext = createContext<AuthContextValue | null>(null);
export function AuthProvider({
  children,
  repository,
  storage,
}: PropsWithChildren<{ repository: AuthRepository; storage: SessionStorage }>) {
  const [current, setCurrentState] = useState<Current | null>(null);
  // Mirrors the state so an expiry callback can tell which session is active.
  const currentRef = useRef<Current | null>(null);
  const setCurrent = useCallback((value: Current | null) => {
    currentRef.current = value;
    setCurrentState(value);
  }, []);
  const [restoring, setRestoring] = useState(true);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [sessionNotice, setSessionNotice] = useState<string | null>(null);
  const retryRestore = useCallback(async () => {
    setRestoring(true);
    setRestoreError(null);
    try {
      const local = await storage.get();
      if (!local) {
        return;
      }
      if (Date.parse(local.expiresAt) <= Date.now()) {
        await storage.clear();
        if (local.kind === 'admin') {
          setSessionNotice(copy.admin.session.expired);
        }
        return;
      }
      try {
        if (local.kind === 'admin') {
          const admin = await repository.adminMe(local.token);
          setCurrent({ kind: 'admin', saved: local, admin });
        } else {
          const user = await repository.me(local.token);
          setCurrent({ kind: 'user', saved: local, user });
        }
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          await storage.clear();
          if (local.kind === 'admin') {
            setSessionNotice(copy.admin.session.expired);
          }
        } else {
          throw error;
        }
      }
    } catch (error) {
      setRestoreError(
        error instanceof ApiError ? error.message : copy.form.sessionError,
      );
    } finally {
      setRestoring(false);
    }
  }, [repository, storage, setCurrent]);
  useEffect(() => {
    retryRestore();
  }, [retryRestore]);
  async function persist(saved: SavedSession) {
    try {
      await storage.save(saved);
    } catch {
      await (saved.kind === 'admin'
        ? repository.adminLogout(saved.token)
        : repository.logout(saved.token)
      ).catch(() => {});
      throw new ApiError(copy.form.sessionError);
    }
  }
  async function acceptUser(result: {
    token: string;
    expiresAt: string;
    user: User;
  }) {
    const saved = {
      token: result.token,
      expiresAt: result.expiresAt,
      kind: 'user' as SessionKind,
    };
    await persist(saved);
    setSessionNotice(null);
    setCurrent({ kind: 'user', saved, user: result.user });
  }
  async function signIn(input: LoginInput) {
    try {
      try {
        await acceptUser(await repository.login(input));
      } catch (error) {
        // Admin accounts are refused by the mobile login; the same credentials
        // open an admin session from the admin token endpoint instead.
        if (
          !(
            error instanceof ApiError &&
            error.status === 403 &&
            error.code === 'wrong_portal'
          )
        ) {
          throw error;
        }
        const result = await repository.adminLogin(input);
        const saved = {
          token: result.token,
          expiresAt: result.expiresAt,
          kind: 'admin' as SessionKind,
        };
        await persist(saved);
        setSessionNotice(null);
        setCurrent({ kind: 'admin', saved, admin: result.user });
      }
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        throw new ApiError(copy.form.loginError, 401);
      }
      throw error;
    }
  }
  async function signUp(input: RegisterInput) {
    await acceptUser(await repository.register(input));
  }
  async function apply(input: AccountApplicationInput) {
    await repository.apply(input);
  }
  async function signOut() {
    if (current) {
      try {
        await (current.kind === 'admin'
          ? repository.adminLogout(current.saved.token)
          : repository.logout(current.saved.token));
      } catch (error) {
        if (!(error instanceof ApiError && error.status === 401)) {
          throw error;
        }
      }
    }
    await storage.clear();
    setCurrent(null);
  }
  async function deleteAccount(password: string) {
    if (current?.kind !== 'user') return;
    await repository.deleteAccount(current.saved.token, password);
    await storage.clear().catch(() => {});
    setCurrent(null);
    setSessionNotice(copy.account.deleted);
  }
  const expireAdminSession = useCallback(async () => {
    if (currentRef.current?.kind !== 'admin') {
      return;
    }
    setCurrent(null);
    setSessionNotice(copy.admin.session.expired);
    await storage.clear().catch(() => {});
  }, [storage, setCurrent]);
  return (
    <AuthContext.Provider
      value={{
        user: current?.kind === 'user' ? current.user : null,
        token: current?.kind === 'user' ? current.saved.token : null,
        admin: current?.kind === 'admin' ? current.admin : null,
        adminToken: current?.kind === 'admin' ? current.saved.token : null,
        sessionNotice,
        restoring,
        restoreError,
        retryRestore,
        signIn,
        signUp,
        apply,
        signOut,
        deleteAccount,
        expireAdminSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error('AuthProvider missing');
  }
  return value;
}
