export type TeamRequestPackage = {
  id: string;
  credits: 2 | 5 | 10;
  amountMinor: number;
  currency: 'TRY';
  active: boolean;
  sortOrder: number;
};
export type PaymentCatalog = {
  items: TeamRequestPackage[];
  checkoutEnabled: boolean;
};
export type CheckoutOrder = {
  orderId: string;
  status: 'pending';
  provider: string;
  providerPaymentId: string;
  checkoutUrl: string;
};
export interface PaymentsRepository {
  packages(token: string): Promise<PaymentCatalog>;
  createOrder(token: string, packageId: string): Promise<CheckoutOrder>;
}
