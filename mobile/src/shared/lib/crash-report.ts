import { apiUrl } from '../api/client';
import { config } from './config';

// Error reports (20 Oct 2026): JavaScript errors the app could not handle go
// to the server log as client.error lines (POST /v1/client-errors), with the
// screen and app version. No account data, token or form content is sent.
// Native crashes need a crash SDK and are not covered here.

let currentScreen = '';
const recent = new Map<string, number>();
let sent = 0;
const maxPerSession = 20;

export function setCurrentScreen(name: string | undefined) {
  currentScreen = name ?? '';
}

export type ErrorReport = {
  error: unknown;
  fatal: boolean;
  // React's component stack for render errors.
  componentStack?: string;
};

export function reportError({ error, fatal, componentStack }: ErrorReport) {
  const failure =
    error instanceof Error ? error : new Error(String(error ?? 'unknown'));
  const key = failure.name + ':' + failure.message;
  const now = Date.now();
  // The same error at most once a minute, and a ceiling per app run.
  if ((recent.get(key) ?? 0) > now - 60000 || sent >= maxPerSession) return;
  recent.set(key, now);
  sent++;
  const stack = [failure.stack ?? '', componentStack ?? '']
    .filter(Boolean)
    .join('\n--\n');
  const candidate = (failure as unknown as { requestId?: unknown }).requestId;
  const requestId = typeof candidate === 'string' ? candidate : undefined;
  let url: string;
  try {
    url = apiUrl('/v1/client-errors');
  } catch {
    return;
  }
  fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      source: 'mobile',
      message: (failure.name + ': ' + failure.message).slice(0, 500),
      stack: stack.slice(0, 4000),
      screen: currentScreen,
      fatal,
      appVersion: config.appVersion,
      requestId,
    }),
  }).catch(() => {});
}

type GlobalHandler = (error: unknown, isFatal?: boolean) => void;
type ErrorUtilsShape = {
  getGlobalHandler(): GlobalHandler;
  setGlobalHandler(handler: GlobalHandler): void;
};

// Reports uncaught JavaScript errors, then lets React Native handle them as
// before (red box in development, crash in release).
export function installCrashReporting() {
  const errorUtils = (globalThis as { ErrorUtils?: ErrorUtilsShape })
    .ErrorUtils;
  if (!errorUtils || __DEV__) return;
  const previous = errorUtils.getGlobalHandler();
  errorUtils.setGlobalHandler((error, isFatal) => {
    reportError({ error, fatal: !!isFatal });
    previous(error, isFatal);
  });
}

// Test helper: forget what was sent.
export function resetCrashReporting() {
  recent.clear();
  sent = 0;
  currentScreen = '';
}
