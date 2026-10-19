import { request, ApiError } from '../../../shared/api/client';
import { copy } from '../../../shared/lib/copy';
import {
  staffPermissions,
  type AccountApplicationResult,
  type AdminSession,
  type AdminUser,
  type AuthRepository,
  type AuthSession,
  type Delegate,
  type User,
} from '../domain/models';

function isDelegate(value: Delegate | undefined): boolean {
  return (
    value === undefined ||
    (!!value &&
      typeof value.coachId === 'string' &&
      typeof value.coachName === 'string' &&
      Array.isArray(value.permissions) &&
      value.permissions.every(item => staffPermissions.includes(item)))
  );
}

function isUser(value: User): boolean {
  return (
    !!value &&
    typeof value.id === 'string' &&
    typeof value.fullName === 'string' &&
    typeof value.email === 'string' &&
    typeof value.username === 'string' &&
    typeof value.active === 'boolean' &&
    typeof value.verified === 'boolean' &&
    typeof value.city === 'string' &&
    typeof value.createdAt === 'string' &&
    Number.isFinite(Date.parse(value.createdAt)) &&
    ['player', 'coach', 'club', 'organizer'].includes(value.role) &&
    isDelegate(value.delegate) &&
    (value.delegate === undefined || value.role === 'club')
  );
}
function session(value: AuthSession): AuthSession {
  if (
    !value ||
    typeof value.token !== 'string' ||
    value.token.length !== 43 ||
    typeof value.expiresAt !== 'string' ||
    !Number.isFinite(Date.parse(value.expiresAt)) ||
    !isUser(value.user)
  ) {
    throw new ApiError(copy.form.unexpected);
  }
  return value;
}
function isAdminUser(value: AdminUser): boolean {
  return (
    !!value &&
    typeof value.id === 'string' &&
    value.id.length > 0 &&
    typeof value.fullName === 'string' &&
    typeof value.email === 'string' &&
    typeof value.username === 'string' &&
    value.role === 'admin'
  );
}
function adminSession(value: AdminSession): AdminSession {
  if (
    !value ||
    typeof value.token !== 'string' ||
    value.token.length !== 43 ||
    typeof value.expiresAt !== 'string' ||
    !Number.isFinite(Date.parse(value.expiresAt)) ||
    !isAdminUser(value.user)
  ) {
    throw new ApiError(copy.form.unexpected);
  }
  const { id, fullName, email, username } = value.user;
  return {
    token: value.token,
    expiresAt: value.expiresAt,
    user: { id, fullName, email, username, role: 'admin' },
  };
}
export const authRepository: AuthRepository = {
  async login(input) {
    return session(
      await request<AuthSession>('/v1/auth/login', {
        method: 'POST',
        body: input,
      }),
    );
  },
  async register(input) {
    return session(
      await request<AuthSession>('/v1/auth/register', {
        method: 'POST',
        body: input,
      }),
    );
  },
  async apply(input) {
    const data = await request<AccountApplicationResult>(
      '/v1/auth/applications',
      { method: 'POST', body: input },
    );
    if (data?.status !== 'pending') {
      throw new ApiError(copy.form.unexpected);
    }
    return data;
  },
  async me(token) {
    const data = await request<{ user: User }>('/v1/auth/me', { token });
    if (!isUser(data.user)) {
      throw new ApiError(copy.form.unexpected);
    }
    return data.user;
  },
  async deleteAccount(token, password) {
    await request<void>('/v1/auth/account', {
      method: 'DELETE',
      token,
      body: { password },
    });
  },
  async logout(token) {
    await request<void>('/v1/auth/logout', { method: 'POST', token });
  },
  async switchToClub(token, clubId) {
    return session(
      await request<AuthSession>('/v1/auth/switch', {
        method: 'POST',
        token,
        body: { clubId },
      }),
    );
  },
  // Admin accounts get a bearer token for the /v1/admin API only.
  async adminLogin(input) {
    return adminSession(
      await request<AdminSession>('/v1/admin/auth/token', {
        method: 'POST',
        body: { identifier: input.identifier, password: input.password },
      }),
    );
  },
  async adminMe(token) {
    const data = await request<{ user: AdminUser }>('/v1/admin/auth/me', {
      token,
    });
    if (!data || !isAdminUser(data.user)) {
      throw new ApiError(copy.form.unexpected);
    }
    const { id, fullName, email, username } = data.user;
    return { id, fullName, email, username, role: 'admin' };
  },
  async adminLogout(token) {
    await request<void>('/v1/admin/auth/logout', { method: 'POST', token });
  },
};
