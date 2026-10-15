export type GiftKind = 'heart_one' | 'heart_full' | 'application_right';
export type GiftAudience = 'all' | 'account';
export type Gift = {
  id: string;
  kind: GiftKind;
  title: string;
  message: string;
  audience: GiftAudience;
  targetEmail: string | null;
  validityDays: number;
  createdAt: string;
  recipients: number;
  claimed: number;
};
export type GiftDraft = {
  kind: GiftKind;
  title: string;
  message: string;
  audience: GiftAudience;
  email: string;
  validityDays: number;
};
export type GiftCreated = Pick<
  Gift,
  'id' | 'kind' | 'title' | 'recipients' | 'validityDays'
>;
export interface GiftsRepository {
  list(): Promise<Gift[]>;
  create(draft: GiftDraft): Promise<GiftCreated>;
}
