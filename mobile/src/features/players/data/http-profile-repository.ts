import { ApiError, request } from '../../../shared/api/client';
import { copy } from '../../../shared/lib/copy';
import type { PlayerProfileRepository } from '../domain/repository';
import type {
  DominantFoot,
  PlayerAvailability,
  PlayerProfile,
  SavePlayerProfile,
} from '../domain/profile';

function isProfile(value: unknown): value is PlayerProfile {
  const candidate = value as PlayerProfile;
  return (
    !!candidate &&
    typeof candidate.position === 'string' &&
    ['', 'right', 'left', 'both'].includes(candidate.dominantFoot) &&
    Number.isInteger(candidate.experienceYears) &&
    typeof candidate.currentClub === 'string' &&
    ['seeking_team', 'open_to_offers', 'not_available'].includes(
      candidate.availability,
    ) &&
    typeof candidate.discoverable === 'boolean' &&
    typeof candidate.updatedAt === 'string'
  );
}

function profile(value: unknown): PlayerProfile {
  if (!isProfile(value)) {
    throw new ApiError(copy.form.unexpected);
  }
  return value;
}

export const playerProfileRepository: PlayerProfileRepository = {
  async get(token) {
    const result = await request<{ profile: PlayerProfile }>(
      '/v1/players/me/profile',
      { token },
    );
    return profile(result.profile);
  },
  async save(token, value: SavePlayerProfile) {
    const result = await request<{ profile: PlayerProfile }>(
      '/v1/players/me/profile',
      {
        method: 'PUT',
        token,
        body: {
          ...value,
          dominantFoot: value.dominantFoot as DominantFoot,
          availability: value.availability as PlayerAvailability,
        },
      },
    );
    return profile(result.profile);
  },
};
