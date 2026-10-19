export type FootballType = 'unknown' | 'amateur' | 'professional' | 'halisaha';
export type PlayerFootballType = Exclude<FootballType, 'unknown'>;
export type LicenseStatus = 'unknown' | 'licensed' | 'unlicensed';
export type DeclaredLicenseStatus = Exclude<LicenseStatus, 'unknown'>;
// A coach's declared licence (19 Oct 2026); unknown means not given yet.
export type CoachLicenseLevel =
  | 'unknown'
  | 'uefa_pro'
  | 'uefa_a'
  | 'uefa_b'
  | 'uefa_c'
  | 'grassroots'
  | 'none';
export type DeclaredCoachLicense = Exclude<CoachLicenseLevel, 'unknown'>;
// Sign-up asks for one of these; the coach profile editor also offers unknown.
export const declaredCoachLicenses: DeclaredCoachLicense[] = [
  'uefa_pro',
  'uefa_a',
  'uefa_b',
  'uefa_c',
  'grassroots',
  'none',
];
export const coachLicenseLevels: CoachLicenseLevel[] = [
  ...declaredCoachLicenses,
  'unknown',
];
