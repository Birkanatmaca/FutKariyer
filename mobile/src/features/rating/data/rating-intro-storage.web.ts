import type { RatingIntroStorage } from '../domain/models';

// Browser preview keeps nothing on disk; the intro shows once per page load.
let seenSeason = '';
export const ratingIntroStorage: RatingIntroStorage = {
  async seen(seasonId) {
    return seenSeason === seasonId;
  },
  async markSeen(seasonId) {
    seenSeason = seasonId;
  },
};
