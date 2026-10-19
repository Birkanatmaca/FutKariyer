import type { SelectedMedia } from '../../../shared/domain/media';

// Personal details and the profile photo every account edits (19 Oct 2026).
// avatarVersion is 0 without a photo.
export type AccountProfile = {
  id: string;
  role: 'player' | 'club' | 'coach' | 'organizer';
  fullName: string;
  username: string;
  email: string;
  city: string;
  district: string;
  // YYYY-MM-DD or null.
  birthDate: string | null;
  bio: string;
  heightCm: number | null;
  weightKg: number | null;
  avatarVersion: number;
};
export type AccountDraft = {
  fullName: string;
  username: string;
  city: string;
  district: string;
  birthDate: string;
  bio: string;
  heightCm: number | null;
  weightKg: number | null;
};
export interface AccountRepository {
  get(token: string): Promise<AccountProfile>;
  save(token: string, draft: AccountDraft): Promise<AccountProfile>;
  pickPhoto(): Promise<SelectedMedia | null>;
  uploadAvatar(token: string, photo: SelectedMedia): Promise<AccountProfile>;
  removeAvatar(token: string): Promise<AccountProfile>;
}
export const accountLimits = {
  name: [2, 80],
  city: [2, 40],
  district: 60,
  bio: 300,
  height: [120, 230],
  weight: [35, 160],
} as const;
// "17.05.2004" <-> "2004-05-17"
export function toIsoDate(value: string): string | null {
  const match = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(value.trim());
  if (!match) return null;
  const [, d, m, y] = match;
  const iso = y + '-' + m.padStart(2, '0') + '-' + d.padStart(2, '0');
  const date = new Date(iso + 'T00:00:00Z');
  return Number.isFinite(date.getTime()) &&
    date.toISOString().slice(0, 10) === iso
    ? iso
    : null;
}
export function fromIsoDate(iso: string | null) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return d + '.' + m + '.' + y;
}
export function ageFrom(iso: string | null, now = new Date()) {
  if (!iso) return null;
  const [y, m, d] = iso.split('-').map(Number);
  let age = now.getFullYear() - y;
  if (now.getMonth() + 1 < m || (now.getMonth() + 1 === m && now.getDate() < d))
    age--;
  return age;
}
