import { copy } from '../../../shared/lib/copy';
import type { MediaKind } from '../../../shared/domain/media';
import {
  galleryMediaProblem,
  type PlayerMediaItem,
  type PlayerMediaRepository,
} from '../domain/media';

export function createPlayerMediaService(repository: PlayerMediaRepository) {
  return {
    list: (token: string, ownerId: string) => repository.list(token, ownerId),
    // Pick → check → upload; resolves null when the picker is cancelled.
    async add(token: string, kind: MediaKind): Promise<PlayerMediaItem | null> {
      const media = await repository.pick(kind);
      if (!media) return null;
      try {
        const problem = galleryMediaProblem(media);
        if (problem)
          throw new Error(
            problem === 'image'
              ? copy.playerOverview.invalidPhoto
              : copy.playerOverview.invalidVideo,
          );
        return await repository.upload(token, media);
      } finally {
        repository.release(media);
      }
    },
    remove: (token: string, id: string) => repository.remove(token, id),
    source: (token: string, item: PlayerMediaItem) =>
      repository.source(token, item),
  };
}
export type PlayerMediaService = ReturnType<typeof createPlayerMediaService>;
