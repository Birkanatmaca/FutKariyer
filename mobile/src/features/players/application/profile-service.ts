import type { PlayerProfileRepository } from '../domain/repository';
import type { SavePlayerProfile } from '../domain/profile';

export function createPlayerProfileService(
  repository: PlayerProfileRepository,
) {
  return {
    get(token: string) {
      return repository.get(token);
    },
    save(token: string, profile: SavePlayerProfile) {
      return repository.save(token, {
        ...profile,
        position: profile.position.trim(),
        currentClub: profile.currentClub.trim(),
      });
    },
  };
}
export type PlayerProfileService = ReturnType<
  typeof createPlayerProfileService
>;
