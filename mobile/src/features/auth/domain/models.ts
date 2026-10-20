// Organizer accounts are opened by the admin and sign in with a username.
export type AccountRole = 'player' | 'coach' | 'club' | 'organizer';
import type {
  DeclaredCoachLicense,
  DeclaredLicenseStatus,
  PlayerFootballType,
} from '../../../shared/domain/football';
// Club sections a club opens to a staff coach who switches into it.
export type StaffPermission =
  | 'applications'
  | 'squad'
  | 'listings'
  | 'news'
  | 'tournaments'
  | 'profile'
  | 'social';
export const staffPermissions: StaffPermission[] = [
  'applications',
  'squad',
  'listings',
  'news',
  'tournaments',
  'profile',
  'social',
];
// Set while a coach runs a club account after "Geçiş yap".
export type Delegate = {
  coachId: string;
  coachName: string;
  permissions: StaffPermission[];
};
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
  // False only for a self sign-up that still has to enter its emailed code
  // (20 Oct 2026); older servers leave it out.
  emailVerified?: boolean;
  delegate?: Delegate;
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
// Players and (since 19 Oct 2026) coaches open their own accounts. Players say
// whether they hold a licence, coaches which licence level they hold.
export type SignUpRole = Extract<AccountRole, 'player' | 'coach'>;
type RegisterBase = {
  email: string;
  password: string;
  fullName: string;
  footballType: PlayerFootballType;
};
export type RegisterInput =
  | (RegisterBase & { role: 'player'; licenseStatus: DeclaredLicenseStatus })
  | (RegisterBase & { role: 'coach'; licenseLevel: DeclaredCoachLicense });
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
export type ResetPasswordInput = {
  email: string;
  code: string;
  password: string;
};
// One signed-in device on the Active sessions screen.
export type SessionInfo = {
  id: string;
  device: string;
  createdAt: string;
  lastSeenAt: string;
  current: boolean;
  // A club session a coach opened on that device.
  club: boolean;
};
export interface AuthRepository {
  login(input: LoginInput): Promise<AuthSession>;
  register(input: RegisterInput): Promise<AuthSession>;
  apply(input: AccountApplicationInput): Promise<AccountApplicationResult>;
  me(token: string): Promise<User>;
  logout(token: string): Promise<void>;
  // Permanently removes the signed-in mobile account; needs its password.
  deleteAccount(token: string, password: string): Promise<void>;
  adminLogin(input: LoginInput): Promise<AdminSession>;
  adminMe(token: string): Promise<AdminUser>;
  adminLogout(token: string): Promise<void>;
  // A staff coach opens a session for a club that authorized them.
  switchToClub(token: string, clubId: string): Promise<AuthSession>;
  // Account security (20 Oct 2026).
  forgotPassword(email: string): Promise<void>;
  resetPassword(input: ResetPasswordInput): Promise<AuthSession>;
  verifyEmail(token: string, code: string): Promise<User>;
  resendVerification(token: string): Promise<void>;
  changePassword(
    token: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void>;
  sessions(token: string): Promise<SessionInfo[]>;
  endSession(token: string, id: string): Promise<void>;
  endOtherSessions(token: string): Promise<void>;
}
