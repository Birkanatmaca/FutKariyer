import type {
  DiscoveryKind,
  DiscoveryQuery,
  DiscoveryRepository,
} from '../domain/models';
export function createDiscoveryService(repository: DiscoveryRepository) {
  return {
    insights: (token: string) => repository.insights(token),
    follow: (
      token: string,
      kind: DiscoveryKind,
      id: string,
      following: boolean,
    ) => repository.follow(token, kind, id, following),
    list(token: string, query: DiscoveryQuery) {
      return repository.list(token, {
        ...query,
        search: query.search.trim(),
        position: query.kind === 'players' ? query.position.trim() : '',
        dominantFoot: query.kind === 'players' ? query.dominantFoot : '',
        availability: query.kind === 'players' ? query.availability : '',
        footballType: query.kind === 'players' ? query.footballType : '',
        licenseStatus: query.kind === 'players' ? query.licenseStatus : '',
      });
    },
    get: (token: string, kind: DiscoveryKind, id: string) =>
      repository.get(token, kind, id),
  };
}
export type DiscoveryService = ReturnType<typeof createDiscoveryService>;
