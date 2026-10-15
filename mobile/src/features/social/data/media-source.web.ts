import { requestBlob } from '../../../shared/api/client';
import type { MediaSource } from '../domain/models';

export async function mediaSource(
  token: string,
  path: string,
): Promise<MediaSource> {
  const blob = await requestBlob(path, { token, timeoutMs: 90000 });
  const uri = URL.createObjectURL(blob);
  return { uri, dispose: () => URL.revokeObjectURL(uri) };
}
