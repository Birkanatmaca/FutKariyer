import { apiUrl } from '../../../shared/api/client';
import type { MediaSource } from '../domain/models';

export async function mediaSource(
  token: string,
  path: string,
): Promise<MediaSource> {
  return { uri: apiUrl(path), headers: { Authorization: 'Bearer ' + token } };
}
