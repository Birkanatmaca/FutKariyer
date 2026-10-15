import { launchImageLibrary } from 'react-native-image-picker';
import { copy } from '../../../shared/lib/copy';
import type { MediaKind, SelectedMedia } from '../domain/models';

export async function pickMedia(
  kind: MediaKind,
): Promise<SelectedMedia | null> {
  const response = await launchImageLibrary({
    mediaType: kind === 'image' ? 'photo' : 'video',
    selectionLimit: 1,
    assetRepresentationMode: 'compatible',
    formatAsMp4: kind === 'video',
    restrictMimeTypes:
      kind === 'image' ? ['image/jpeg', 'image/png'] : ['video/mp4'],
  });
  if (response.didCancel) return null;
  const asset = response.assets?.[0];
  if (response.errorCode || !asset?.uri)
    throw new Error(copy.social.pickingFailed);
  return {
    kind,
    uri: asset.uri,
    name: asset.fileName || (kind === 'image' ? 'image.jpg' : 'video.mp4'),
    mime: asset.type || '',
    size: asset.fileSize || 0,
  };
}
export function appendMedia(form: FormData, media: SelectedMedia) {
  // React Native's FormData accepts a local URI, unlike browser FormData.
  form.append('media', {
    uri: media.uri,
    name: media.name,
    type: media.mime,
  } as unknown as Blob);
}
export function releaseMedia(_media: SelectedMedia) {}
