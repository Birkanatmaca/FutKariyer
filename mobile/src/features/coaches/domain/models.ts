import type { StaffPermission } from '../../auth';
import {
  coachLicenseLevels,
  type CoachLicenseLevel,
  type FootballType,
} from '../../../shared/domain/football';

// Coach accounts and club technical staff (19 Oct 2026). The licence levels
// are shared with sign-up, which asks a new coach for one.
export type LicenseLevel = CoachLicenseLevel;
export const licenseLevels = coachLicenseLevels;
// Specialties double as the role a club gives a coach on its staff.
export type CoachSpecialty =
  | 'head_coach'
  | 'assistant'
  | 'goalkeeper'
  | 'fitness'
  | 'youth'
  | 'analyst';
export const coachSpecialties: CoachSpecialty[] = [
  'head_coach',
  'assistant',
  'goalkeeper',
  'fitness',
  'youth',
  'analyst',
];
export type CoachAvailability =
  | 'seeking_team'
  | 'open_to_offers'
  | 'not_available';
export const coachAvailabilities: CoachAvailability[] = [
  'seeking_team',
  'open_to_offers',
  'not_available',
];
export const maxPastClubs = 10;

// Which groups the coach shows on the public profile; clubs see everything.
export type CoachVisibility = {
  license: boolean;
  experience: boolean;
  football: boolean;
  clubs: boolean;
};
export type CoachProfile = {
  licenseLevel: LicenseLevel;
  specialties: CoachSpecialty[];
  experienceYears: number;
  footballType: FootballType;
  availability: CoachAvailability;
  pastClubs: string[];
  visibility: CoachVisibility;
};
// What a viewer may see: hidden groups are missing.
export type PublicCoachProfile = Partial<Omit<CoachProfile, 'visibility'>> & {
  showClubs: boolean;
};

export type Person = {
  id: string;
  fullName: string;
  verified: boolean;
  district: string;
  avatarVersion: number;
};
export type StaffStatus = 'invited' | 'active';
export type StaffMember = {
  coach: Person;
  status: StaffStatus;
  role: CoachSpecialty;
  permissions: StaffPermission[];
  invitedAt: string;
  joinedAt: string | null;
  profile: CoachProfile;
};
export type CoachMembership = {
  club: Person;
  status: StaffStatus;
  role: CoachSpecialty;
  permissions: StaffPermission[];
  invitedAt: string;
  joinedAt: string | null;
};
export type StaffCandidate = { coach: Person; profile: CoachProfile };
export type ClubCard = { club: Person; role: CoachSpecialty };
export type StaffCard = { coach: Person; role: CoachSpecialty };
export type CoachCard = {
  profile: CoachProfile | PublicCoachProfile;
  clubs: ClubCard[];
  // True for clubs and the coach themself.
  full: boolean;
};
export type StaffGrant = {
  role: CoachSpecialty;
  permissions: StaffPermission[];
};
export type StaffList = { staff: StaffMember[]; limit: number };

export interface CoachRepository {
  profile(token: string): Promise<CoachProfile>;
  saveProfile(token: string, profile: CoachProfile): Promise<CoachProfile>;
  staff(token: string): Promise<StaffList>;
  candidates(token: string, query: string): Promise<StaffCandidate[]>;
  invite(token: string, coachId: string, grant: StaffGrant): Promise<StaffList>;
  update(token: string, coachId: string, grant: StaffGrant): Promise<StaffList>;
  remove(token: string, coachId: string): Promise<void>;
  memberships(token: string): Promise<CoachMembership[]>;
  respond(
    token: string,
    clubId: string,
    accept: boolean,
  ): Promise<CoachMembership[]>;
  leave(token: string, clubId: string): Promise<void>;
  clubStaff(token: string, clubId: string): Promise<StaffCard[]>;
  coachCard(token: string, coachId: string): Promise<CoachCard>;
}

export function emptyCoachProfile(): CoachProfile {
  return {
    licenseLevel: 'unknown',
    specialties: [],
    experienceYears: 0,
    footballType: 'unknown',
    availability: 'not_available',
    pastClubs: [],
    visibility: {
      license: false,
      experience: false,
      football: false,
      clubs: false,
    },
  };
}

// How others see a coach: only the groups the coach turned on.
export function publicView(profile: CoachProfile): PublicCoachProfile {
  const view: PublicCoachProfile = { showClubs: profile.visibility.clubs };
  if (profile.visibility.license) view.licenseLevel = profile.licenseLevel;
  if (profile.visibility.experience) {
    view.specialties = profile.specialties;
    view.experienceYears = profile.experienceYears;
  }
  if (profile.visibility.football) {
    view.footballType = profile.footballType;
    view.availability = profile.availability;
  }
  if (profile.visibility.clubs) view.pastClubs = profile.pastClubs;
  return view;
}

export function isFullProfile(
  profile: CoachProfile | PublicCoachProfile,
): profile is CoachProfile {
  return 'visibility' in profile;
}
