import { config } from '../lib/config';
import { copy } from '../lib/copy';

export class ApiError extends Error {
  constructor(
    message: string,
    public status = 0,
    public fields: Record<string, string> = {},
    public code = '',
  ) {
    super(message);
    this.name = 'ApiError';
  }
}
type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  formData?: FormData;
  timeoutMs?: number;
  token?: string;
};
export function apiUrl(path: string) {
  if (
    !config.apiBaseUrl ||
    (!__DEV__ &&
      !config.allowInsecureApi &&
      !config.apiBaseUrl.startsWith('https://'))
  ) {
    throw new ApiError(copy.form.configError);
  }
  return config.apiBaseUrl + path;
}
async function perform<T>(
  path: string,
  options: RequestOptions,
  decode: (response: Response) => Promise<T>,
): Promise<T> {
  const url = apiUrl(path);
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    options.timeoutMs ?? config.requestTimeout,
  );
  try {
    const response = await fetch(url, {
      method: options.method || 'GET',
      headers: {
        ...(!options.formData ? { 'Content-Type': 'application/json' } : {}),
        ...(options.token ? { Authorization: 'Bearer ' + options.token } : {}),
      },
      body:
        options.formData ??
        (options.body === undefined ? undefined : JSON.stringify(options.body)),
      signal: controller.signal,
    });
    if (response.status === 204) {
      return undefined as T;
    }
    if (!response.ok) {
      const data = await response.json();
      throw new ApiError(
        data.error?.message || copy.form.unexpected,
        response.status,
        data.error?.fields || {},
        typeof data.error?.code === 'string' ? data.error.code : '',
      );
    }
    return await decode(response);
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
export function request<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  return perform(path, options, response => response.json() as Promise<T>);
}
export function requestBlob(
  path: string,
  options: RequestOptions = {},
): Promise<Blob> {
  return perform(path, options, response => response.blob());
}
