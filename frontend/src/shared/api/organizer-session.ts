import { organizerCopy } from '../lib/organizer-copy';
import { createBearerClient } from './bearer-client';

// The organizer web area's session (22 Oct 2026): the bearer token lives in
// sessionStorage so a reload keeps the session and closing the tab ends it.
// When storage is unavailable (private mode, blocked site data) it is kept in
// memory for this page only.
const key = 'futcareer.organizer.token';
let memory: string | null = null;

export const organizerToken = {
  get(): string | null {
    try {
      return window.sessionStorage.getItem(key) ?? memory;
    } catch {
      return memory;
    }
  },
  set(token: string) {
    memory = token;
    try {
      window.sessionStorage.setItem(key, token);
    } catch {
      // Memory only.
    }
  },
  clear() {
    memory = null;
    try {
      window.sessionStorage.removeItem(key);
    } catch {
      // Nothing stored.
    }
  },
};

export const organizerSessionExpiredEvent =
  'futcareer:organizer-session-expired';

export const organizerRequest = createBearerClient({
  token: organizerToken.get,
  onUnauthorized() {
    organizerToken.clear();
    window.dispatchEvent(new Event(organizerSessionExpiredEvent));
  },
  messages: organizerCopy.form,
});
