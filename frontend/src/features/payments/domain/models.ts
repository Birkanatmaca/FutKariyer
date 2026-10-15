export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded';
// App Store / Google Play product ids; '' means not sold in that store.
export type StoreProductIds = {
  appleProductId: string;
  googleProductId: string;
};
export type PaymentPackage = StoreProductIds & {
  id: string;
  credits: 2 | 5 | 10;
  // Reporting value; the store charges its own price.
  amountMinor: number;
  currency: string;
  active: boolean;
  sortOrder: number;
};
export type ProPlan = StoreProductIds & {
  id: string;
  days: number;
  bonusCredits: number;
  amountMinor: number;
  currency: string;
  active: boolean;
};
// Admin edit of a package or the Pro plan; both store ids are always sent.
export type CatalogUpdate = StoreProductIds & {
  amountMinor: number;
  active: boolean;
};
export type PaymentProduct = 'team_rights' | 'pro';
export type Payment = {
  id: string;
  product: PaymentProduct;
  playerId?: string;
  playerName: string;
  playerEmail: string;
  packageId?: string;
  packageCredits: 0 | 2 | 5 | 10;
  amountMinor: number;
  currency: string;
  provider: string;
  providerPaymentId?: string;
  status: PaymentStatus;
  createdAt: string;
  updatedAt: string;
  confirmedAt?: string;
};
export type PaymentSummary = {
  total: number;
  pending: number;
  paid: number;
  failed: number;
  refunded: number;
  collectedMinor: number;
  refundedMinor: number;
};
export type PaymentPage = {
  items: Payment[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  summary: PaymentSummary;
};
export interface PaymentsRepository {
  packages(): Promise<PaymentPackage[]>;
  updatePackage(id: string, update: CatalogUpdate): Promise<PaymentPackage>;
  proPlan(): Promise<ProPlan>;
  updateProPlan(id: string, update: CatalogUpdate): Promise<ProPlan>;
  list(
    status: PaymentStatus | 'all',
    page: number,
    search: string,
  ): Promise<PaymentPage>;
}
