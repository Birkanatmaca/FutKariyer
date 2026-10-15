export type GiftKind = 'heart_one' | 'heart_full' | 'application_right';
export type GiftStatus = 'available' | 'claimed' | 'expired';
export type Gift = {
  id: string;
  kind: GiftKind;
  title: string;
  message: string;
  status: GiftStatus;
  createdAt: string;
  expiresAt: string;
  claimedAt: string | null;
};
export type GiftInbox = {
  items: Gift[];
  availableCount: number;
  serverTime: string;
};
export type GiftClaim = GiftInbox & {
  result: 'claimed' | 'already_claimed';
};
export interface GiftsRepository {
  list(token: string): Promise<GiftInbox>;
  claim(token: string, id: string): Promise<GiftClaim>;
}
