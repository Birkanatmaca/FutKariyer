import { copy } from '../lib/copy';

export class ApiError extends Error {
  constructor(
    message: string,
    public status = 0,
    public fields: Record<string, string> = {},
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
    const response = await fetch('/api' + path, {
      method: options.method || 'GET',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body:
        options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: controller.signal,
    });
    if (response.status === 401 && path !== '/v1/admin/auth/login') {
      window.dispatchEvent(new Event(sessionExpiredEvent));
    }
    if (response.status === 204) {
      return undefined as T;
    }
    const data = await response.json();
    if (!response.ok) {
      throw new ApiError(
        data.error?.message || copy.form.unexpected,
        response.status,
        data.error?.fields || {},
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
