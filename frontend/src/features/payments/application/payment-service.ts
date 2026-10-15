import type { PaymentStatus, PaymentsRepository } from '../domain/models';

export function createPaymentService(repository: PaymentsRepository) {
  return {
    packages: () => repository.packages(),
    updatePackage: (id: string, amountMinor: number, active: boolean) =>
      repository.updatePackage(id, amountMinor, active),
    proPlan: () => repository.proPlan(),
    updateProPlan: (id: string, amountMinor: number, active: boolean) =>
      repository.updateProPlan(id, amountMinor, active),
    list: (status: PaymentStatus | 'all', page: number, search: string) =>
      repository.list(status, page, search.trim()),
  };
}
export type PaymentService = ReturnType<typeof createPaymentService>;
