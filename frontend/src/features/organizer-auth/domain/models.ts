export type OrganizerAccount = {
  id: string;
  fullName: string;
  username: string;
  role: string;
};
export type OrganizerLoginInput = { identifier: string; password: string };
export interface OrganizerAuthRepository {
  login(input: OrganizerLoginInput): Promise<string>;
  me(): Promise<OrganizerAccount>;
  logout(): Promise<void>;
}

// Only organizer accounts may use the /organizasyon area; the server scopes
// every call to the signed-in organizer as well.
export function isOrganizer(account: OrganizerAccount | null) {
  return account?.role === 'organizer';
}
