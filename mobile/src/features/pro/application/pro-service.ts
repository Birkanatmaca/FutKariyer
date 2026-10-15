import type { ProRepository } from '../domain/models';

export function createProService(repository: ProRepository) {
  return {
    status: (token: string) => repository.status(token),
    setPrivateBrowsing: (token: string, on: boolean) =>
      repository.setPrivateBrowsing(token, on),
    offer: (token: string) => repository.offer(token),
    visitors: (token: string) => repository.visitors(token),
  };
}
export type ProService = ReturnType<typeof createProService>;
