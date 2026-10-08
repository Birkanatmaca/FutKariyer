import type { PlayerProfile, SavePlayerProfile } from './profile';

export interface PlayerProfileRepository {
  get(token: string): Promise<PlayerProfile>;
  save(token: string, profile: SavePlayerProfile): Promise<PlayerProfile>;
}
