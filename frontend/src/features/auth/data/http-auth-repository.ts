import { ApiError, request } from '../../../shared/api/client';
import { isAccount } from '../../../shared/domain/account';
import { copy } from '../../../shared/lib/copy';
import type {
  AdminUser,
  AuthRepository,
  TwoFactorChallenge,
} from '../domain/models';

function admin(value: unknown): AdminUser {
  if (!isAccount(value) || value.role !== 'admin' || !value.active) {
    throw new ApiError(copy.form.unexpected);
  }
  return value as AdminUser;
}
function challenge(value: unknown): TwoFactorChallenge {
  const item = value as TwoFactorChallenge;
  if (
    !item ||
    typeof item.challenge !== 'string' ||
    typeof item.setup !== 'boolean' ||
    (item.setup &&
      (typeof item.secret !== 'string' ||
        typeof item.otpauthUri !== 'string' ||
        !item.otpauthUri.startsWith('otpauth://totp/')))
  ) {
    throw new ApiError(copy.form.unexpected);
  }
  return item;
}
export const authRepository: AuthRepository = {
  async login(input) {
    const result = await request<{ user?: unknown; twoFactor?: unknown }>(
      '/v1/admin/auth/login',
      { method: 'POST', body: input },
    );
    if (result.twoFactor) {
      return { kind: 'twoFactor', challenge: challenge(result.twoFactor) };
    }
    return { kind: 'signedIn', user: admin(result.user) };
  },
  async verify(challengeToken, code) {
    const result = await request<{ user: unknown; recoveryCodes?: unknown }>(
      '/v1/admin/auth/2fa',
      { method: 'POST', body: { challenge: challengeToken, code } },
    );
    const codes = Array.isArray(result.recoveryCodes)
      ? result.recoveryCodes.filter(
          (item): item is string => typeof item === 'string',
        )
      : [];
    return { user: admin(result.user), recoveryCodes: codes };
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
