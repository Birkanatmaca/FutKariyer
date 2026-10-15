import type { GiftsRepository } from '../domain/models';

export function createGiftsService(repository: GiftsRepository) {
  return {
    list: (token: string) => repository.list(token),
    claim: (token: string, id: string) => repository.claim(token, id),
  };
}
export type GiftsService = ReturnType<typeof createGiftsService>;
