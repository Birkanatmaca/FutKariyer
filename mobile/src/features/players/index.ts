export { PlayerProfileScreen } from './ui/PlayerProfileScreen';
export { PlayerOverviewScreen } from './ui/PlayerOverviewScreen';
export { PlayerProfileContent } from './ui/PlayerProfileContent';
export type { ProfileCounts } from './ui/PlayerProfileHeader';
export type { ProfilePostsSlot } from './ui/PlayerMediaGallery';
export { createPlayerProfileService } from './application/profile-service';
export { playerProfileRepository } from './data/http-profile-repository';
export type {
  PlayerProfile,
  DominantFoot,
  PlayerAvailability,
} from './domain/profile';
export { isPlayerProfile } from './domain/profile';
export type { PlayerMediaService } from './application/media-service';
import { createPlayerMediaService } from './application/media-service';
import { playerMediaRepository } from './data/http-media-repository';
// Composed once; screens receive it as a prop.
export const playerMediaService = createPlayerMediaService(
  playerMediaRepository,
);
