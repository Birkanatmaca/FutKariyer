import { config } from '../lib/config';
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
type RequestOptions = {
  method?: 'GET' | 'POST';
  body?: unknown;
  token?: string;
};
export async function request<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  if (
    !config.apiBaseUrl ||
    (!__DEV__ && !config.apiBaseUrl.startsWith('https://'))
  ) {
    throw new ApiError(copy.form.configError);
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.requestTimeout);
  try {
    const response = await fetch(config.apiBaseUrl + path, {
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(options.token ? { Authorization: 'Bearer ' + options.token } : {}),
      },
      body:
        options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: controller.signal,
    });
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
      controller.signal.aborted
        ? copy.form.timeoutError
        : copy.form.networkError,
    );
  } finally {
    clearTimeout(timer);
  }
}
