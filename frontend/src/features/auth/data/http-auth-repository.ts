import { ApiError, request } from '../../../shared/api/client';
import { isAccount } from '../../../shared/domain/account';
import { copy } from '../../../shared/lib/copy';
import type { AdminUser, AuthRepository } from '../domain/models';

function admin(value: unknown): AdminUser {
  if (!isAccount(value) || value.role !== 'admin' || !value.active) {
    throw new ApiError(copy.form.unexpected);
  }
  return value as AdminUser;
}
export const authRepository: AuthRepository = {
  async login(input) {
    const result = await request<{ user: unknown }>('/v1/admin/auth/login', {
      method: 'POST',
      body: input,
    });
    return admin(result.user);
  },
  async me() {
    const result = await request<{ user: unknown }>('/v1/admin/auth/me');
    return admin(result.user);
  },
  async logout() {
    try {
      await request<void>('/v1/admin/auth/logout', { method: 'POST' });
    } catch (error) {
      if (!(error instanceof ApiError && error.status === 401)) {
        throw error;
      }
    }
  },
};
