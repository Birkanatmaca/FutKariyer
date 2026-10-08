import type { Account } from '../../../shared/domain/account';
export type AdminUser = Account & { role: 'admin' };
export type LoginInput = { identifier: string; password: string };
export interface AuthRepository {
  login(input: LoginInput): Promise<AdminUser>;
  me(): Promise<AdminUser>;
  logout(): Promise<void>;
}
