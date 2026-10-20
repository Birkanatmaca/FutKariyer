import { request, ApiError } from '../../../shared/api/client';
import { copy } from '../../../shared/lib/copy';
import {
  staffPermissions,
  type AccountApplicationResult,
  type AdminChallenge,
  type AdminSession,
  type AdminUser,
  type AuthRepository,
  type AuthSession,
  type Delegate,
  type SessionInfo,
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
    (value.emailVerified === undefined ||
      typeof value.emailVerified === 'boolean') &&
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
  async forgotPassword(email) {
    await request<unknown>('/v1/auth/password/forgot', {
      method: 'POST',
      body: { email },
    });
  },
  async resetPassword(input) {
    return session(
      await request<AuthSession>('/v1/auth/password/reset', {
        method: 'POST',
        body: input,
      }),
    );
  },
  async verifyEmail(token, code) {
    const data = await request<{ user: User }>('/v1/auth/email/verify', {
      method: 'POST',
      token,
      body: { code },
    });
    if (!isUser(data.user)) {
      throw new ApiError(copy.form.unexpected);
    }
    return data.user;
  },
  async resendVerification(token) {
    await request<unknown>('/v1/auth/email/resend', { method: 'POST', token });
  },
  async changePassword(token, currentPassword, newPassword) {
    await request<void>('/v1/me/password', {
      method: 'PUT',
      token,
      body: { currentPassword, newPassword },
    });
  },
  async sessions(token) {
    const data = await request<{ sessions: SessionInfo[] }>('/v1/me/sessions', {
      token,
    });
    if (!data || !Array.isArray(data.sessions)) {
      throw new ApiError(copy.form.unexpected);
    }
    return data.sessions.filter(
      item =>
        !!item &&
        typeof item.id === 'string' &&
        typeof item.device === 'string' &&
        typeof item.lastSeenAt === 'string' &&
        typeof item.createdAt === 'string' &&
        typeof item.current === 'boolean',
    );
  },
  async endSession(token, id) {
    await request<void>('/v1/me/sessions/' + encodeURIComponent(id), {
      method: 'DELETE',
      token,
    });
  },
  async endOtherSessions(token) {
    await request<void>('/v1/me/sessions', { method: 'DELETE', token });
  },
  // Admin accounts get a bearer token for the /v1/admin API only.
  async adminLogin(input) {
    const data = await request<AdminSession & { twoFactor?: AdminChallenge }>(
      '/v1/admin/auth/token',
      {
        method: 'POST',
        body: { identifier: input.identifier, password: input.password },
      },
    );
    if (data?.twoFactor) {
      const item = data.twoFactor;
      if (
        typeof item.challenge !== 'string' ||
        typeof item.setup !== 'boolean' ||
        (item.setup &&
          (typeof item.secret !== 'string' ||
            typeof item.otpauthUri !== 'string' ||
            !item.otpauthUri.startsWith('otpauth://totp/')))
      ) {
        throw new ApiError(copy.form.unexpected);
      }
      return { kind: 'twoFactor', challenge: item };
    }
    return { kind: 'session', session: adminSession(data) };
  },
  async adminVerify(challenge, code) {
    const data = await request<AdminSession & { recoveryCodes?: unknown }>(
      '/v1/admin/auth/token/2fa',
      { method: 'POST', body: { challenge, code: code.replace(/\s/g, '') } },
    );
    const codes = Array.isArray(data?.recoveryCodes)
      ? data.recoveryCodes.filter(
          (item): item is string => typeof item === 'string',
        )
      : [];
    return { session: adminSession(data), recoveryCodes: codes };
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
