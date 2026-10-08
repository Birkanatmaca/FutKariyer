import { ApiError, request } from '../../../shared/api/client';
import { isAccount } from '../../../shared/domain/account';
import { copy } from '../../../shared/lib/copy';
import type {
  AccountPage,
  AdminRepository,
  AdminSection,
  ManagedAccount,
} from '../domain/models';
function isManaged(value: unknown): value is ManagedAccount {
  return (
    isAccount(value) && typeof (value as ManagedAccount).district === 'string'
  );
}
function checked(value: unknown): ManagedAccount {
  if (!isManaged(value)) {
    throw new ApiError(copy.form.unexpected);
  }
  return value;
}
function path(section: AdminSection, id?: string) {
  return '/v1/admin/' + section + (id ? '/' + encodeURIComponent(id) : '');
}
export const adminRepository: AdminRepository = {
  async list(section, page, search) {
    const result = await request<AccountPage>(
      path(section) +
        '?page=' +
        page +
        '&pageSize=20&search=' +
        encodeURIComponent(search),
    );
    if (
      !result ||
      !Array.isArray(result.items) ||
      !result.items.every(isManaged) ||
      !Number.isInteger(result.page) ||
      result.page < 1 ||
      !Number.isInteger(result.pageSize) ||
      result.pageSize < 1 ||
      !Number.isInteger(result.total) ||
      result.total < 0 ||
      !Number.isInteger(result.totalPages) ||
      result.totalPages < 0
    ) {
      throw new ApiError(copy.form.unexpected);
    }
    return result;
  },
  async get(section, id) {
    return checked(
      (await request<{ account: unknown }>(path(section, id))).account,
    );
  },
  async create(section, form) {
    const { fullName, email, username, district, password, role } = form;
    return checked(
      (
        await request<{ account: unknown }>(path(section), {
          method: 'POST',
          body: {
            fullName,
            email,
            username,
            district,
            password,
            role,
          },
        })
      ).account,
    );
  },
  async update(section, id, form) {
    const { fullName, email, username, district, active } = form;
    return checked(
      (
        await request<{ account: unknown }>(path(section, id), {
          method: 'PUT',
          body: { fullName, email, username, district, active },
        })
      ).account,
    );
  },
  async remove(section, id) {
    await request<void>(path(section, id), { method: 'DELETE' });
  },
  async resetPassword(section, id, password) {
    await request<void>(path(section, id) + '/password', {
      method: 'PUT',
      body: { password },
    });
  },
};
