import type {
  FootballType,
  LicenseStatus,
} from '../../../shared/domain/football';

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
  footballType: FootballType;
  licenseStatus: LicenseStatus;
  updatedAt: string;
};

export type SavePlayerProfile = Omit<PlayerProfile, 'updatedAt'>;

export function isPlayerProfile(value: unknown): value is PlayerProfile {
  const candidate = value as PlayerProfile;
  return (
    !!candidate &&
    typeof candidate.position === 'string' &&
    ['', 'right', 'left', 'both'].includes(candidate.dominantFoot) &&
    Number.isInteger(candidate.experienceYears) &&
    candidate.experienceYears >= 0 &&
    candidate.experienceYears <= 60 &&
    typeof candidate.currentClub === 'string' &&
    ['seeking_team', 'open_to_offers', 'not_available'].includes(
      candidate.availability,
    ) &&
    typeof candidate.discoverable === 'boolean' &&
    ['unknown', 'amateur', 'professional', 'halisaha'].includes(
      candidate.footballType,
    ) &&
    ['unknown', 'licensed', 'unlicensed'].includes(candidate.licenseStatus) &&
    typeof candidate.updatedAt === 'string'
  );
}
