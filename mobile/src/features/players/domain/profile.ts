export type DominantFoot = '' | 'right' | 'left' | 'both';
export type PlayerAvailability =
  | 'seeking_team'
  | 'open_to_offers'
  | 'not_available';

export type PlayerProfile = {
  position: string;
  dominantFoot: DominantFoot;
  experienceYears: number;
  currentClub: string;
  availability: PlayerAvailability;
  discoverable: boolean;
  updatedAt: string;
};

export type SavePlayerProfile = Omit<PlayerProfile, 'updatedAt'>;
