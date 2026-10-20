import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';
import { AppState } from 'react-native';
import { ApiError } from '../../../shared/api/client';
import { AvatarTokenProvider } from '../../../shared/lib/avatar';
import { copy } from '../../../shared/lib/copy';
import type {
  AccountApplicationInput,
  AdminUser,
  AuthRepository,
  Delegate,
  LoginInput,
  RegisterInput,
  ResetPasswordInput,
  SavedSession,
  SessionInfo,
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
  // Club staff switch (19 Oct 2026): while a coach runs a club account, user
  // is the club with a delegate and coach is the coach's own account.
  delegate: Delegate | null;
  coach: User | null;
  switchToClub(clubId: string): Promise<void>;
  switchBack(): Promise<void>;
  // Account security (20 Oct 2026).
  forgotPassword(email: string): Promise<void>;
  // Sets the new password and signs this device in.
  resetPassword(input: ResetPasswordInput): Promise<void>;
  verifyEmail(code: string): Promise<void>;
  resendVerification(): Promise<void>;
  // Other devices are signed out; this one stays.
  changePassword(currentPassword: string, newPassword: string): Promise<void>;
  sessions(): Promise<SessionInfo[]>;
  endSession(id: string): Promise<void>;
  endOtherSessions(): Promise<void>;
};
type Home = { saved: SavedSession; user: User };
type Current =
  | { kind: 'user'; saved: SavedSession; user: User }
  | { kind: 'admin'; saved: SavedSession; admin: AdminUser };
const AuthContext = createContext<AuthContextValue | null>(null);
export function AuthProvider({
  children,
  repository,
  storage,
  clubStorage,
}: PropsWithChildren<{
  repository: AuthRepository;
  storage: SessionStorage;
  // Holds the club session a staff coach switched into.
  clubStorage?: SessionStorage;
}>) {
  const [current, setCurrentState] = useState<Current | null>(null);
  // The coach's own session while they run a club account.
  const [home, setHome] = useState<Home | null>(null);
  // Mirrors the state so an expiry callback can tell which session is active.
  const currentRef = useRef<Current | null>(null);
  const setCurrent = useCallback((value: Current | null) => {
    currentRef.current = value;
    setCurrentState(value);
  }, []);
  const [restoring, setRestoring] = useState(true);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [sessionNotice, setSessionNotice] = useState<string | null>(null);
  // A coach who closed the app inside a club account returns to it, unless
  // the club has since taken the permission back.
  const restoreClub = useCallback(
    async (coach: Home) => {
      const club = await clubStorage?.get().catch(() => null);
      if (!club) return;
      try {
        if (Date.parse(club.expiresAt) <= Date.now())
          throw new ApiError('', 401);
        const user = await repository.me(club.token);
        if (user.delegate?.coachId !== coach.user.id)
          throw new ApiError('', 401);
        setHome(coach);
        setCurrent({ kind: 'user', saved: club, user });
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          await clubStorage?.clear().catch(() => {});
        }
      }
    },
    [clubStorage, repository, setCurrent],
  );
  // A club session never outlives the coach's own session on this device:
  // once that is gone, the stored club session is closed and forgotten.
  const dropClub = useCallback(async () => {
    const club = await clubStorage?.get().catch(() => null);
    if (!club) return;
    await repository.logout(club.token).catch(() => {});
    await clubStorage?.clear().catch(() => {});
  }, [clubStorage, repository]);
  const retryRestore = useCallback(async () => {
    setRestoring(true);
    setRestoreError(null);
    try {
      const local = await storage.get();
      if (!local) {
        await dropClub();
        return;
      }
      if (Date.parse(local.expiresAt) <= Date.now()) {
        await storage.clear();
        await dropClub();
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
          if (user.role === 'coach') {
            await restoreClub({ saved: local, user });
          }
        }
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          await storage.clear();
          await dropClub();
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
  }, [repository, storage, setCurrent, restoreClub, dropClub]);
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
  async function forgotPassword(email: string) {
    await repository.forgotPassword(email.trim());
  }
  async function resetPassword(input: ResetPasswordInput) {
    await acceptUser(await repository.resetPassword(input));
  }
  // Security actions belong to the account's own session, never a club one.
  function ownToken() {
    const signedIn = currentRef.current;
    if (signedIn?.kind !== 'user' || home) {
      throw new ApiError(copy.form.unexpected);
    }
    return signedIn.saved.token;
  }
  async function verifyEmail(code: string) {
    const token = ownToken();
    const user = await repository.verifyEmail(token, code.trim());
    const signedIn = currentRef.current;
    if (signedIn?.kind === 'user' && signedIn.saved.token === token) {
      setCurrent({ ...signedIn, user });
    }
  }
  async function resendVerification() {
    await repository.resendVerification(ownToken());
  }
  async function changePassword(currentPassword: string, newPassword: string) {
    await repository.changePassword(ownToken(), currentPassword, newPassword);
  }
  async function sessions() {
    return repository.sessions(ownToken());
  }
  async function endSession(id: string) {
    await repository.endSession(ownToken(), id);
  }
  async function endOtherSessions() {
    await repository.endOtherSessions(ownToken());
  }
  async function signOut() {
    if (home) {
      await switchBack();
    }
    const signedIn = home
      ? { kind: 'user' as const, saved: home.saved }
      : current;
    if (signedIn) {
      try {
        await (signedIn.kind === 'admin'
          ? repository.adminLogout(signedIn.saved.token)
          : repository.logout(signedIn.saved.token));
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
    // The club account is never deleted from a switched session.
    if (current?.kind !== 'user' || home) return;
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
  async function switchToClub(clubId: string) {
    if (current?.kind !== 'user' || home || current.user.role !== 'coach') {
      return;
    }
    const result = await repository.switchToClub(current.saved.token, clubId);
    const saved = {
      token: result.token,
      expiresAt: result.expiresAt,
      kind: 'user' as SessionKind,
    };
    try {
      await clubStorage?.save(saved);
    } catch {
      await repository.logout(saved.token).catch(() => {});
      throw new ApiError(copy.form.sessionError);
    }
    setHome({ saved: current.saved, user: current.user });
    setCurrent({ kind: 'user', saved, user: result.user });
  }
  async function switchBack() {
    if (!home) return;
    const club = currentRef.current;
    if (club?.kind === 'user') {
      await repository.logout(club.saved.token).catch(() => {});
    }
    await clubStorage?.clear().catch(() => {});
    setCurrent({ kind: 'user', saved: home.saved, user: home.user });
    setHome(null);
  }
  // Back in the foreground, a club session the club has revoked ends and the
  // coach lands in their own account.
  useEffect(() => {
    if (!home) return;
    const subscription = AppState.addEventListener('change', state => {
      const club = currentRef.current;
      if (state !== 'active' || club?.kind !== 'user') return;
      repository.me(club.saved.token).catch(error => {
        if (error instanceof ApiError && error.status === 401) {
          clubStorage?.clear().catch(() => {});
          setCurrent({ kind: 'user', saved: home.saved, user: home.user });
          setHome(null);
        }
      });
    });
    return () => subscription.remove();
  }, [home, repository, clubStorage, setCurrent]);
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
        delegate:
          current?.kind === 'user' ? current.user.delegate ?? null : null,
        coach: home?.user ?? null,
        switchToClub,
        switchBack,
        forgotPassword,
        resetPassword,
        verifyEmail,
        resendVerification,
        changePassword,
        sessions,
        endSession,
        endOtherSessions,
      }}
    >
      <AvatarTokenProvider
        value={current?.kind === 'user' ? current.saved.token : null}
      >
        {children}
      </AvatarTokenProvider>
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
