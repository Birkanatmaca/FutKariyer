import { ApiError } from '../../../shared/api/client';
import {
  organizerRequest,
  organizerToken,
} from '../../../shared/api/organizer-session';
import { organizerCopy } from '../../../shared/lib/organizer-copy';
import type {
  OrganizerAccount,
  OrganizerAuthRepository,
} from '../domain/models';

function account(value: unknown): value is OrganizerAccount {
  const item = value as OrganizerAccount;
  return (
    !!item &&
    typeof item.id === 'string' &&
    typeof item.fullName === 'string' &&
    typeof item.username === 'string' &&
    typeof item.role === 'string'
  );
}

export const organizerAuthRepository: OrganizerAuthRepository = {
  async login(input) {
    const result = await organizerRequest<{ token?: unknown }>(
      '/v1/auth/login',
      {
        method: 'POST',
        body: {
          identifier: input.identifier.trim(),
          password: input.password,
          device: 'Web organizasyon',
        },
      },
    );
    if (!result || typeof result.token !== 'string' || !result.token)
      throw new ApiError(organizerCopy.form.unexpected);
    organizerToken.set(result.token);
    return result.token;
  },
  async me() {
    const result = await organizerRequest<{ user?: unknown }>('/v1/auth/me');
    if (!result || !account(result.user))
      throw new ApiError(organizerCopy.form.unexpected);
    return result.user;
  },
  async logout() {
    try {
      if (organizerToken.get())
        await organizerRequest<void>('/v1/auth/logout', { method: 'POST' });
    } finally {
      organizerToken.clear();
    }
  },
};
