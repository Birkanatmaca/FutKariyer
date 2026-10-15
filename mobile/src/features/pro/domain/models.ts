// Pro membership: 30 days per purchase, +3 team application rights per period
// for players, "who viewed your profile" and private browsing. Pro status is
// always evaluated by the server; the client only renders what it receives.
export type ProStatus = {
  active: boolean;
  expiresAt: string | null;
  privateBrowsing: boolean;
  bonusCredits: number;
};
export type ProState = { pro: ProStatus; eligible: boolean };
export type ProPlan = {
  id: string;
  days: number;
  bonusCredits: number;
  amountMinor: number;
  currency: 'TRY';
  active: boolean;
};
export type ProOffer = { plan: ProPlan; checkoutEnabled: boolean };
export type ProCheckout = {
  orderId: string;
  status: 'pending';
  provider: string;
  providerPaymentId: string;
  checkoutUrl: string;
};

export type VisitorRole = 'player' | 'club' | 'coach' | 'organizer';
export type VisitorIdentity = {
  id: string;
  fullName: string;
  role: VisitorRole;
  verified: boolean;
  isPro: boolean;
  club: string;
  district: string;
  footballType: 'unknown' | 'amateur' | 'professional' | 'halisaha';
  canOpen: boolean;
  // A Pro owner sees that this visitor browsed privately.
  private: boolean;
};
// "visitor" rows carry an identity; "obscured" and "private" rows never do.
export type VisitorRow =
  | {
      key: string;
      kind: 'visitor';
      lastVisitedAt: string;
      visitCount: number;
      visitor: VisitorIdentity;
    }
  | {
      key: string;
      kind: 'obscured';
      lastVisitedAt: string;
      role: VisitorRole;
      district?: string;
    }
  | { key: string; kind: 'private'; lastVisitedAt: string };
export type RoleCounts = Record<VisitorRole | 'hidden', number>;
export type VisitorTotals = {
  visitors: number;
  visits: number;
  byRole: RoleCounts;
};
export type ProfileVisitors = {
  isPro: boolean;
  windowDays: number;
  summary: { window: VisitorTotals; week: VisitorTotals };
  items: VisitorRow[];
};

export interface ProRepository {
  status(token: string): Promise<ProState>;
  setPrivateBrowsing(token: string, on: boolean): Promise<ProStatus>;
  offer(token: string): Promise<ProOffer>;
  checkout(token: string, planId: string): Promise<ProCheckout>;
  visitors(token: string): Promise<ProfileVisitors>;
}
