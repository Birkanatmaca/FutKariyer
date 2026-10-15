import type {
  CatalogUpdate,
  PaymentStatus,
  PaymentsRepository,
} from '../domain/models';
import { normalizeStoreProductIds } from './catalog-form';

export function createPaymentService(repository: PaymentsRepository) {
  return {
    packages: () => repository.packages(),
    updatePackage: (id: string, update: CatalogUpdate) =>
      repository.updatePackage(id, {
        ...update,
        ...normalizeStoreProductIds(update),
      }),
    proPlan: () => repository.proPlan(),
    updateProPlan: (id: string, update: CatalogUpdate) =>
      repository.updateProPlan(id, {
        ...update,
        ...normalizeStoreProductIds(update),
      }),
    list: (status: PaymentStatus | 'all', page: number, search: string) =>
      repository.list(status, page, search.trim()),
  };
}
export type PaymentService = ReturnType<typeof createPaymentService>;
