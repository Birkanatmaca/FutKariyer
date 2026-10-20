import { Platform } from 'react-native';
import { config } from '../lib/config';
import { copy } from '../lib/copy';
import { deviceName } from '../lib/device';

// Sent with every request; the server shows it on Active sessions.
const device = deviceName();

export class ApiError extends Error {
  constructor(
    message: string,
    public status = 0,
    public fields: Record<string, string> = {},
    public code = '',
    // The server's X-Request-ID: the same id is on the request's log lines.
    public requestId = '',
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
        'X-Device': device,
        'X-Client': Platform.OS,
        'X-App-Version': config.appVersion,
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
      const requestId = response.headers?.get?.('X-Request-ID') ?? '';
      const data = await response.json();
      const message = data.error?.message || copy.form.unexpected;
      throw new ApiError(
        // Server faults carry a short support code the team can find in
        // the logs when the user writes in.
        response.status >= 500 && requestId
          ? message + ' ' + copy.form.supportCode(requestId.slice(-8))
          : message,
        response.status,
        data.error?.fields || {},
        typeof data.error?.code === 'string' ? data.error.code : '',
        requestId,
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
