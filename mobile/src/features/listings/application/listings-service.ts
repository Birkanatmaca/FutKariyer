import { ApiError } from '../../../shared/api/client';
import type {
  ListingFilter,
  ListingInput,
  ListingsRepository,
} from '../domain/models';

const trimInput = (input: ListingInput): ListingInput => ({
  title: input.title.trim(),
  position: input.position.trim(),
  description: input.description.trim(),
});

export function createListingsService(repository: ListingsRepository) {
  return {
    open: (token: string, page: number, filter: ListingFilter) =>
      repository.open(token, page, filter),
    detail: (token: string, id: string) => repository.detail(token, id),
    // Resolves to null when the listing is closed or never existed, e.g. when
    // an opportunity notification came from an admin announcement.
    findOpen: async (token: string, id: string) => {
      try {
        return await repository.detail(token, id);
      } catch (failure) {
        if (failure instanceof ApiError && failure.status === 404) return null;
        throw failure;
      }
    },
    apply: (token: string, id: string) => repository.apply(token, id),
    mine: (token: string) => repository.mine(token),
    create: (token: string, input: ListingInput) =>
      repository.create(token, trimInput(input)),
    close: (token: string, id: string) => repository.close(token, id),
  };
}

export type ListingsService = ReturnType<typeof createListingsService>;
