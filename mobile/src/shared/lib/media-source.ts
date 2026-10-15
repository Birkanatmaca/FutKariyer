import { apiUrl } from '../api/client';
import type { MediaSource } from '../domain/media';

export async function mediaSource(
  token: string,
  path: string,
): Promise<MediaSource> {
  return { uri: apiUrl(path), headers: { Authorization: 'Bearer ' + token } };
}
