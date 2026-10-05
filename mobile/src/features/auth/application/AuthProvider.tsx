import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type PropsWithChildren,
} from 'react';
import { ApiError } from '../../../shared/api/client';
import { copy } from '../../../shared/lib/copy';
import type {
  AuthRepository,
  AuthSession,
  LoginInput,
  RegisterInput,
  SavedSession,
  SessionStorage,
  User,
} from '../domain/models';

type AuthContextValue = {
  user: User | null;
  restoring: boolean;
  restoreError: string | null;
  retryRestore(): Promise<void>;
  signIn(input: LoginInput): Promise<void>;
  signUp(input: RegisterInput): Promise<void>;
  signOut(): Promise<void>;
};
const AuthContext = createContext<AuthContextValue | null>(null);
export function AuthProvider({
  children,
  repository,
  storage,
}: PropsWithChildren<{ repository: AuthRepository; storage: SessionStorage }>) {
  const [user, setUser] = useState<User | null>(null);
  const [saved, setSaved] = useState<SavedSession | null>(null);
  const [restoring, setRestoring] = useState(true);
  const [restoreError, setRestoreError] = useState<string | null>(null);
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
        return;
      }
      try {
        const account = await repository.me(local.token);
        setSaved(local);
        setUser(account);
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          await storage.clear();
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
  }, [repository, storage]);
  useEffect(() => {
    retryRestore();
  }, [retryRestore]);
  async function acceptSession(result: AuthSession) {
    try {
      await storage.save({
        token: result.token,
        expiresAt: result.expiresAt,
      });
    } catch {
      await repository.logout(result.token).catch(() => {});
      throw new ApiError(copy.form.sessionError);
    }
    setSaved({ token: result.token, expiresAt: result.expiresAt });
    setUser(result.user);
  }
  async function signIn(input: LoginInput) {
    try {
      await acceptSession(await repository.login(input));
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        throw new ApiError(copy.form.loginError, 401);
      }
      throw error;
    }
  }
  async function signUp(input: RegisterInput) {
    await acceptSession(await repository.register(input));
  }
  async function signOut() {
    if (saved) {
      try {
        await repository.logout(saved.token);
      } catch (error) {
        if (!(error instanceof ApiError && error.status === 401)) {
          throw error;
        }
      }
    }
    await storage.clear();
    setUser(null);
    setSaved(null);
  }
  return (
    <AuthContext.Provider
      value={{
        user,
        restoring,
        restoreError,
        retryRestore,
        signIn,
        signUp,
        signOut,
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
