import { ApiError, apiUrl, request } from '../../../shared/api/client';
import { copy } from '../../../shared/lib/copy';
import type { AdminGateway } from '../domain/models';

const imageIdPattern = /^[a-f0-9]{32}$/;

// Admin requests only ever go to /v1/admin with the admin bearer token. A 401
// means the 8 hour admin session expired or was revoked: the session is
// cleared and the app returns to the sign-in screen.
export function createAdminGateway(session: {
  token(): string | null;
  onUnauthorized(): void;
}): AdminGateway {
  return {
    async request<T>(
      path: string,
      options: {
        method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
        body?: unknown;
        formData?: FormData;
      } = {},
    ) {
      if (!path.startsWith('/v1/admin/')) {
        throw new ApiError(copy.form.unexpected);
      }
      const token = session.token();
      if (!token) {
        session.onUnauthorized();
        throw new ApiError(copy.admin.session.expired, 401);
      }
      try {
        return await request<T>(path, {
          method: options.method,
          body: options.body,
          formData: options.formData,
          token,
          // Uploads of up to 4 MiB need more time than JSON requests.
          timeoutMs: options.formData ? 60000 : undefined,
        });
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          session.onUnauthorized();
          throw new ApiError(copy.admin.session.expired, 401);
        }
        throw error;
      }
    },
    // Draft content images are served only to an admin session, so the image
    // request carries the same bearer header.
    imageSource(imageId: string) {
      const token = session.token();
      if (!token || !imageIdPattern.test(imageId)) return null;
      try {
        return {
          uri: apiUrl('/v1/admin/content/images/' + imageId),
          headers: { Authorization: 'Bearer ' + token },
        };
      } catch {
        return null;
      }
    },
  };
}
