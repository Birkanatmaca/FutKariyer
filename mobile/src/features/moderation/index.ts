import { createModerationService } from './application/moderation-service';
import { moderationRepository } from './data/http-moderation-repository';

export { ModerationSheet } from './ui/ModerationSheet';
export { BlockedUsersScreen } from './ui/BlockedUsersScreen';
export type { ModerationService } from './application/moderation-service';
export type { ModerationTarget } from './domain/models';
export { createModerationService } from './application/moderation-service';
export const moderationService = createModerationService(moderationRepository);
