export type AccountRole = 'player' | 'coach' | 'club';
export type User = {
  id: string;
  fullName: string;
  email: string;
  role: AccountRole;
  city: string;
  createdAt: string;
};
export type AuthSession = { token: string; expiresAt: string; user: User };
export type SavedSession = { token: string; expiresAt: string };
export interface SessionStorage {
  get(): Promise<SavedSession | null>;
  save(value: SavedSession): Promise<void>;
  clear(): Promise<void>;
}
export type LoginInput = { email: string; password: string };
export type RegisterInput = LoginInput & {
  fullName: string;
  role: AccountRole;
  adultConfirmed: boolean;
};
export interface AuthRepository {
  login(input: LoginInput): Promise<AuthSession>;
  register(input: RegisterInput): Promise<AuthSession>;
  me(token: string): Promise<User>;
  logout(token: string): Promise<void>;
}
