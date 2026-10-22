import { ApiError } from './client';

// Bearer requests for the organizer web area (22 Oct 2026). Unlike the admin
// client it sends no cookies; the token comes from the organizer session and
// a 401 calls onUnauthorized so the app can drop the token and show sign-in.
type Options = { method?: 'GET' | 'POST' | 'PUT' | 'DELETE'; body?: unknown };
export type BearerMessages = {
  unexpected: string;
  network: string;
  timeout: string;
  supportCode(code: string): string;
};

export function createBearerClient({
  token,
  onUnauthorized,
  messages,
}: {
  token(): string | null;
  onUnauthorized(): void;
  messages: BearerMessages;
}) {
  return async function request<T>(
    path: string,
    options: Options = {},
  ): Promise<T> {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 12000);
    const current = token();
    const headers: Record<string, string> = {};
    if (options.body !== undefined)
      headers['Content-Type'] = 'application/json';
    if (current) headers.Authorization = 'Bearer ' + current;
    try {
      const response = await fetch('/api' + path, {
        method: options.method || 'GET',
        credentials: 'omit',
        headers,
        body:
          options.body === undefined ? undefined : JSON.stringify(options.body),
        signal: controller.signal,
      });
      // A wrong password on sign-in also answers 401; that is not a lost session.
      if (response.status === 401 && current) onUnauthorized();
      if (response.status === 204) return undefined as T;
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const requestId = response.headers.get('X-Request-ID') ?? '';
        const message = data?.error?.message || messages.unexpected;
        throw new ApiError(
          response.status >= 500 && requestId
            ? message + ' ' + messages.supportCode(requestId.slice(-8))
            : message,
          response.status,
          data?.error?.fields || {},
          requestId,
        );
      }
      return data as T;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(
        controller.signal.aborted ? messages.timeout : messages.network,
      );
    } finally {
      window.clearTimeout(timer);
    }
  };
}
export type BearerRequest = ReturnType<typeof createBearerClient>;
