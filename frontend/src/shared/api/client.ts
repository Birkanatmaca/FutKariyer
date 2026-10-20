import { copy } from '../lib/copy';

export class ApiError extends Error {
  constructor(
    message: string,
    public status = 0,
    public fields: Record<string, string> = {},
    // The server's X-Request-ID: the same id is on the request's log lines.
    public requestId = '',
  ) {
    super(message);
    this.name = 'ApiError';
  }
}
export const sessionExpiredEvent = 'futcareer:session-expired';
type Options = { method?: 'GET' | 'POST' | 'PUT' | 'DELETE'; body?: unknown };
export async function request<T>(
  path: string,
  options: Options = {},
): Promise<T> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 12000);
  try {
    const multipart = options.body instanceof FormData;
    const response = await fetch('/api' + path, {
      method: options.method || 'GET',
      credentials: 'same-origin',
      headers: multipart ? undefined : { 'Content-Type': 'application/json' },
      body:
        options.body === undefined
          ? undefined
          : multipart
          ? (options.body as FormData)
          : JSON.stringify(options.body),
      signal: controller.signal,
    });
    // Sign-in steps answer 401 for wrong or expired input, not a lost session.
    if (
      response.status === 401 &&
      path !== '/v1/admin/auth/login' &&
      path !== '/v1/admin/auth/2fa'
    ) {
      window.dispatchEvent(new Event(sessionExpiredEvent));
    }
    if (response.status === 204) {
      return undefined as T;
    }
    const data = await response.json();
    if (!response.ok) {
      const requestId = response.headers.get('X-Request-ID') ?? '';
      const message = data.error?.message || copy.form.unexpected;
      throw new ApiError(
        response.status >= 500 && requestId
          ? message + ' ' + copy.form.supportCode(requestId.slice(-8))
          : message,
        response.status,
        data.error?.fields || {},
        requestId,
      );
    }
    return data as T;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(
      controller.signal.aborted ? copy.form.timeout : copy.form.network,
    );
  } finally {
    window.clearTimeout(timer);
  }
}
