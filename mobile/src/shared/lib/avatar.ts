import { apiUrl } from '../api/client';

// Public profile photo URL; empty without a photo. The version busts the
// image cache after a new upload.
export function avatarUrl(userId: string, version: number | undefined) {
  return version && version > 0
    ? apiUrl('/v1/users/' + userId + '/avatar?v=' + version)
    : '';
}
