export type AccountRole = 'player' | 'coach' | 'club' | 'organizer' | 'admin';
export type Account = {
  id: string;
  fullName: string;
  email: string;
  username: string;
  role: AccountRole;
  city: string;
  active: boolean;
  verified: boolean;
  createdAt: string;
};
export function isAccount(value: unknown): value is Account {
  const candidate = value as Account;
  return (
    !!candidate &&
    typeof candidate.id === 'string' &&
    typeof candidate.fullName === 'string' &&
    typeof candidate.email === 'string' &&
    typeof candidate.username === 'string' &&
    typeof candidate.city === 'string' &&
    typeof candidate.active === 'boolean' &&
    typeof candidate.verified === 'boolean' &&
    typeof candidate.createdAt === 'string' &&
    Number.isFinite(Date.parse(candidate.createdAt)) &&
    ['player', 'coach', 'club', 'organizer', 'admin'].includes(candidate.role)
  );
}
