import { createContext, useContext, useMemo } from 'react';
import type { ImageURISource } from 'react-native';
import { apiUrl } from '../api/client';

// Profile photo URL; empty without a photo. The version busts the image cache
// after a new upload. The server only serves photos to signed-in accounts
// that are not blocked either way (20 Oct 2026).
export function avatarUrl(userId: string, version: number | undefined) {
  return version && version > 0
    ? apiUrl('/v1/users/' + userId + '/avatar?v=' + version)
    : '';
}

// The signed-in user's bearer token for photo requests; AuthProvider sets it.
const AvatarTokenContext = createContext<string | null>(null);
export const AvatarTokenProvider = AvatarTokenContext.Provider;

// The image source for a photo URL, carrying the session token.
export function useAvatarSource(uri?: string): ImageURISource | undefined {
  const token = useContext(AvatarTokenContext);
  return useMemo(() => {
    if (!uri) return undefined;
    return token
      ? { uri, headers: { Authorization: 'Bearer ' + token } }
      : { uri };
  }, [uri, token]);
}
