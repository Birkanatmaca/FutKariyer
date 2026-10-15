export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded';
export type PaymentPackage = {
  id: string;
  credits: 2 | 5 | 10;
  amountMinor: number;
  currency: string;
  active: boolean;
  sortOrder: number;
};
export type ProPlan = {
  id: string;
  days: number;
  bonusCredits: number;
  amountMinor: number;
  currency: string;
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
  updatePackage(
    id: string,
    amountMinor: number,
    active: boolean,
  ): Promise<PaymentPackage>;
  proPlan(): Promise<ProPlan>;
  updateProPlan(
    id: string,
    amountMinor: number,
    active: boolean,
  ): Promise<ProPlan>;
  list(
    status: PaymentStatus | 'all',
    page: number,
    search: string,
  ): Promise<PaymentPage>;
}
