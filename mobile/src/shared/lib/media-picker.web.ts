import { copy } from './copy';
import type { MediaKind, SelectedMedia } from '../domain/media';

const files = new WeakMap<SelectedMedia, File>();
export function pickMedia(kind: MediaKind): Promise<SelectedMedia | null> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = kind === 'image' ? 'image/jpeg,image/png' : 'video/mp4';
    input.style.display = 'none';
    document.body.appendChild(input);
    const cleanup = () => input.remove();
    input.addEventListener(
      'cancel',
      () => {
        cleanup();
        resolve(null);
      },
      { once: true },
    );
    input.addEventListener(
      'change',
      () => {
        const file = input.files?.[0];
        cleanup();
        if (!file) {
          resolve(null);
          return;
        }
        const media: SelectedMedia = {
          kind,
          uri: URL.createObjectURL(file),
          name: file.name,
          mime: file.type,
          size: file.size,
        };
        files.set(media, file);
        resolve(media);
      },
      { once: true },
    );
    try {
      input.click();
    } catch {
      cleanup();
      reject(new Error(copy.media.pickingFailed));
    }
  });
}
export function appendMedia(form: FormData, media: SelectedMedia) {
  const file = files.get(media);
  if (!file) throw new Error(copy.media.pickingFailed);
  form.append('media', file, media.name);
}
export function releaseMedia(media: SelectedMedia) {
  URL.revokeObjectURL(media.uri);
  files.delete(media);
}
