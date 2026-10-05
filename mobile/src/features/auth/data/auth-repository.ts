import { request, ApiError } from '../../../shared/api/client';
import { copy } from '../../../shared/lib/copy';
import type { AuthRepository, AuthSession, User } from '../domain/models';

function isUser(value: User): boolean {
  return (
    !!value &&
    typeof value.id === 'string' &&
    typeof value.fullName === 'string' &&
    typeof value.email === 'string' &&
    typeof value.city === 'string' &&
    typeof value.createdAt === 'string' &&
    Number.isFinite(Date.parse(value.createdAt)) &&
    ['player', 'coach', 'club'].includes(value.role)
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
  async me(token) {
    const data = await request<{ user: User }>('/v1/auth/me', { token });
    if (!isUser(data.user)) {
      throw new ApiError(copy.form.unexpected);
    }
    return data.user;
  },
  async logout(token) {
    await request<void>('/v1/auth/logout', { method: 'POST', token });
  },
};
