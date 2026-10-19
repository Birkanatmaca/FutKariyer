import { ApiError, request } from '../../../shared/api/client';
import { copy } from '../../../shared/lib/copy';
import { pickMedia } from '../../../shared/lib/media-picker';
import type { AccountProfile, AccountRepository } from '../domain/models';

const id = (v: unknown) => typeof v === 'string' && /^[a-f0-9]{32}$/.test(v);
const optionalInt = (v: unknown) =>
  v === null || (typeof v === 'number' && Number.isSafeInteger(v) && v > 0);

function valid(v: unknown): v is AccountProfile {
  const p = v as AccountProfile;
  return (
    !!p &&
    id(p.id) &&
    ['player', 'club', 'coach', 'organizer'].includes(p.role) &&
    [p.fullName, p.username, p.email, p.city, p.district, p.bio].every(
      value => typeof value === 'string',
    ) &&
    (p.birthDate === null ||
      (typeof p.birthDate === 'string' &&
        /^\d{4}-\d{2}-\d{2}$/.test(p.birthDate))) &&
    optionalInt(p.heightCm) &&
    optionalInt(p.weightKg) &&
    Number.isSafeInteger(p.avatarVersion) &&
    p.avatarVersion >= 0
  );
}
function checked(result: { profile?: unknown } | undefined) {
  if (!result || !valid(result.profile))
    throw new ApiError(copy.form.unexpected);
  return result.profile;
}

export const accountRepository: AccountRepository = {
  async get(token) {
    return checked(await request('/v1/me/profile', { token }));
  },
  async save(token, draft) {
    return checked(
      await request('/v1/me/profile', { token, method: 'PUT', body: draft }),
    );
  },
  pickPhoto: () => pickMedia('image'),
  async uploadAvatar(token, photo) {
    const formData = new FormData();
    formData.append('avatar', {
      uri: photo.uri,
      name: photo.name,
      type: photo.mime,
    } as unknown as Blob);
    return checked(
      await request('/v1/me/avatar', {
        token,
        method: 'PUT',
        formData,
        timeoutMs: 60000,
      }),
    );
  },
  async removeAvatar(token) {
    return checked(await request('/v1/me/avatar', { token, method: 'DELETE' }));
  },
};

export { avatarUrl } from '../../../shared/lib/avatar';
