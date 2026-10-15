import type { PaymentsRepository } from '../domain/models';

export function createPaymentsService(repository: PaymentsRepository) {
  return {
    packages: (token: string) => repository.packages(token),
  };
}
export type PaymentsService = ReturnType<typeof createPaymentsService>;
