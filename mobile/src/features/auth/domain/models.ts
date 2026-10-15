// Organizer accounts are opened by the admin and sign in with a username.
export type AccountRole = 'player' | 'coach' | 'club' | 'organizer';
import type {
  DeclaredLicenseStatus,
  PlayerFootballType,
} from '../../../shared/domain/football';
export type User = {
  id: string;
  fullName: string;
  email: string;
  username: string;
  active: boolean;
  verified: boolean;
  role: AccountRole;
  city: string;
  createdAt: string;
};
export type AuthSession = { token: string; expiresAt: string; user: User };
// Admin accounts sign in from the same screen but receive a separate session
// for the /v1/admin API; the two kinds of token are never interchangeable.
export type SessionKind = 'user' | 'admin';
export type AdminUser = {
  id: string;
  fullName: string;
  email: string;
  username: string;
  role: 'admin';
};
export type AdminSession = {
  token: string;
  expiresAt: string;
  user: AdminUser;
};
// Sessions saved before admin mode existed have no kind and are user sessions.
export type SavedSession = {
  token: string;
  expiresAt: string;
  kind?: SessionKind;
};
export interface SessionStorage {
  get(): Promise<SavedSession | null>;
  save(value: SavedSession): Promise<void>;
  clear(): Promise<void>;
}
export type LoginInput = { identifier: string; password: string };
export type RegisterInput = {
  email: string;
  password: string;
  fullName: string;
  role: AccountRole;
  footballType: PlayerFootballType;
  licenseStatus: DeclaredLicenseStatus;
};
// Club and organizer accounts apply here and wait for admin approval.
export type ApplicationRole = Extract<AccountRole, 'club' | 'organizer'>;
export type AccountApplicationInput = {
  role: ApplicationRole;
  fullName: string;
  contactName: string;
  username: string;
  email: string;
  password: string;
  phone?: string;
  district?: string;
  footballType?: PlayerFootballType;
  note?: string;
};
export type AccountApplicationResult = { status: 'pending' };
export interface AuthRepository {
  login(input: LoginInput): Promise<AuthSession>;
  register(input: RegisterInput): Promise<AuthSession>;
  apply(input: AccountApplicationInput): Promise<AccountApplicationResult>;
  me(token: string): Promise<User>;
  logout(token: string): Promise<void>;
  adminLogin(input: LoginInput): Promise<AdminSession>;
  adminMe(token: string): Promise<AdminUser>;
  adminLogout(token: string): Promise<void>;
}
