import type { Account } from '../../../shared/domain/account';
export type AdminSection = 'users' | 'clubs';
export type ManagedAccount = Account & { district: string };
export type AccountPage = {
  items: ManagedAccount[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};
export type AccountForm = {
  fullName: string;
  email: string;
  username: string;
  district: string;
  password: string;
  role: 'player' | 'coach' | 'club';
  active: boolean;
};
export interface AdminRepository {
  list(
    section: AdminSection,
    page: number,
    search: string,
  ): Promise<AccountPage>;
  get(section: AdminSection, id: string): Promise<ManagedAccount>;
  create(section: AdminSection, form: AccountForm): Promise<ManagedAccount>;
  update(
    section: AdminSection,
    id: string,
    form: AccountForm,
  ): Promise<ManagedAccount>;
  remove(section: AdminSection, id: string): Promise<void>;
  resetPassword(
    section: AdminSection,
    id: string,
    password: string,
  ): Promise<void>;
}
