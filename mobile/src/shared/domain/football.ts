export type FootballType = 'unknown' | 'amateur' | 'professional' | 'halisaha';
export type PlayerFootballType = Exclude<FootballType, 'unknown'>;
export type LicenseStatus = 'unknown' | 'licensed' | 'unlicensed';
export type DeclaredLicenseStatus = Exclude<LicenseStatus, 'unknown'>;
