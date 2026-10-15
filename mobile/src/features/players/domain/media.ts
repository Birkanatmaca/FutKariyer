import type {
  MediaKind,
  MediaSource,
  SelectedMedia,
} from '../../../shared/domain/media';

// The athlete's profile gallery: photos and videos stored by the server and
// shown to whoever may open the profile (discovery rules and blocks apply).
export type PlayerMediaItem = {
  id: string;
  ownerId: string;
  kind: MediaKind;
  mime: string;
  size: number;
  width: number;
  height: number;
  createdAt: string;
};
export type GalleryLimits = { photos: number; videos: number };
export type PlayerGallery = { items: PlayerMediaItem[]; limits: GalleryLimits };

export const maxGalleryImageBytes = 4 * 1024 * 1024;
export const maxGalleryVideoBytes = 30 * 1024 * 1024;

export interface PlayerMediaRepository {
  list(token: string, ownerId: string): Promise<PlayerGallery>;
  pick(kind: MediaKind): Promise<SelectedMedia | null>;
  release(media: SelectedMedia): void;
  upload(token: string, media: SelectedMedia): Promise<PlayerMediaItem>;
  remove(token: string, id: string): Promise<void>;
  source(token: string, item: PlayerMediaItem): Promise<MediaSource>;
}

// Client-side check before a long upload; the server validates again.
export function galleryMediaProblem(
  media: SelectedMedia,
): 'image' | 'video' | null {
  const image = media.kind === 'image';
  const allowed = image ? ['image/jpeg', 'image/png'] : ['video/mp4'];
  const limit = image ? maxGalleryImageBytes : maxGalleryVideoBytes;
  if (
    !media.uri ||
    !Number.isSafeInteger(media.size) ||
    media.size < 1 ||
    media.size > limit ||
    !allowed.includes(media.mime)
  )
    return media.kind;
  return null;
}
