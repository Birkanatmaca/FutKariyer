// Error reports from the admin panel (20 Oct 2026): uncaught errors go to the
// server log as client.error lines, at most once a minute per message and
// 20 per page load. No account data or form content is sent.
const recent = new Map<string, number>();
let sent = 0;

export function reportError(error: unknown, fatal = false) {
  const failure =
    error instanceof Error ? error : new Error(String(error ?? 'unknown'));
  const key = failure.name + ':' + failure.message;
  const now = Date.now();
  if ((recent.get(key) ?? 0) > now - 60000 || sent >= 20) return;
  recent.set(key, now);
  sent++;
  fetch('/api/v1/client-errors', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      source: 'admin',
      message: (failure.name + ': ' + failure.message).slice(0, 500),
      stack: (failure.stack ?? '').slice(0, 4000),
      screen: window.location.pathname.slice(0, 80),
      fatal,
      appVersion: import.meta.env.MODE,
    }),
    keepalive: true,
  }).catch(() => {});
}

export function installErrorReporting() {
  window.addEventListener('error', event => reportError(event.error, true));
  window.addEventListener('unhandledrejection', event =>
    reportError(event.reason, false),
  );
}
