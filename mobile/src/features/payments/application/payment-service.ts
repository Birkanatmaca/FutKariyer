import type { PaymentsRepository } from '../domain/models';

export function createPaymentsService(repository: PaymentsRepository) {
  return {
    packages: (token: string) => repository.packages(token),
    createOrder: (token: string, packageId: string) =>
      repository.createOrder(token, packageId),
  };
}
export type PaymentsService = ReturnType<typeof createPaymentsService>;
