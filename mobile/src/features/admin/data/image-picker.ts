import { launchImageLibrary } from 'react-native-image-picker';
import { copy } from '../../../shared/lib/copy';
import type { PickedImage } from '../domain/models';

// Content images: one JPEG or PNG from the library (server limit 4 MiB).
export async function pickContentImage(): Promise<PickedImage | null> {
  const response = await launchImageLibrary({
    mediaType: 'photo',
    selectionLimit: 1,
    assetRepresentationMode: 'compatible',
    restrictMimeTypes: ['image/jpeg', 'image/png'],
  });
  if (response.didCancel) return null;
  const asset = response.assets?.[0];
  if (response.errorCode || !asset?.uri)
    throw new Error(copy.admin.content.pickFailed);
  return {
    uri: asset.uri,
    name: asset.fileName || 'image.jpg',
    mime: asset.type || '',
    size: asset.fileSize || 0,
  };
}
export function appendImage(form: FormData, image: PickedImage) {
  // React Native's FormData accepts a local URI, unlike browser FormData.
  form.append('image', {
    uri: image.uri,
    name: image.name,
    type: image.mime,
  } as unknown as Blob);
}
