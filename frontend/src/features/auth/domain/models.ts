import type { Account } from '../../../shared/domain/account';
export type AdminUser = Account & { role: 'admin' };
export type LoginInput = { identifier: string; password: string };
// The second sign-in step (20 Oct 2026). setup: the admin adds the key to an
// authenticator app first; the key and link are shown only then.
export type TwoFactorChallenge = {
  challenge: string;
  setup: boolean;
  secret?: string;
  otpauthUri?: string;
};
export type LoginOutcome =
  | { kind: 'signedIn'; user: AdminUser }
  | { kind: 'twoFactor'; challenge: TwoFactorChallenge };
// recoveryCodes is filled once, right after the authenticator is set up.
export type VerifyResult = { user: AdminUser; recoveryCodes: string[] };
export interface AuthRepository {
  login(input: LoginInput): Promise<LoginOutcome>;
  verify(challenge: string, code: string): Promise<VerifyResult>;
  me(): Promise<AdminUser>;
  logout(): Promise<void>;
}
