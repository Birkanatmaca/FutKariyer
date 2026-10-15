import { copy } from '../../../shared/lib/copy';
import type { PickedImage } from '../domain/models';

// Browser preview: a hidden file input; the File is kept for the upload.
const files = new Map<string, File>();
export function pickContentImage(): Promise<PickedImage | null> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/jpeg,image/png';
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
        const uri = URL.createObjectURL(file);
        files.set(uri, file);
        resolve({ uri, name: file.name, mime: file.type, size: file.size });
      },
      { once: true },
    );
    try {
      input.click();
    } catch {
      cleanup();
      reject(new Error(copy.admin.content.pickFailed));
    }
  });
}
export function appendImage(form: FormData, image: PickedImage) {
  const file = files.get(image.uri);
  if (!file) throw new Error(copy.admin.content.pickFailed);
  form.append('image', file, image.name);
}
