import { copy } from '../../../shared/lib/copy';
import {
  formatForSize,
  type PopupForm,
  type PopupFormat,
  type PopupImages,
  type PopupRepository,
} from '../domain/models';

// Reads the image's pixel size in the browser so a wrong size is caught
// before upload; the server checks it again.
function imageSize(file: File) {
  return new Promise<{ width: number; height: number }>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      resolve({ width: image.naturalWidth, height: image.naturalHeight });
      URL.revokeObjectURL(url);
    };
    image.onerror = () => {
      reject(new Error(copy.popups.sizeError));
      URL.revokeObjectURL(url);
    };
    image.src = url;
  });
}

export function createPopupService(repo: PopupRepository, images: PopupImages) {
  return {
    list: (page: number) => repo.list(page),
    listAll: () => repo.listAll(),
    save: (form: PopupForm, id?: string) =>
      repo.save({ ...form, title: form.title.trim() }, id),
    remove: (id: string) => repo.remove(id),
    // The format the file would get, or an error naming the accepted sizes.
    async check(file: File): Promise<PopupFormat> {
      if (!['image/jpeg', 'image/png'].includes(file.type))
        throw new Error(copy.popups.sizeError);
      const { width, height } = await imageSize(file);
      const format = formatForSize(width, height);
      if (!format) throw new Error(copy.popups.wrongSize(width, height));
      return format;
    },
    upload: (file: File) => images.upload(file),
    imageUrl: (id: string) => images.imageUrl(id),
  };
}
export type PopupService = ReturnType<typeof createPopupService>;
