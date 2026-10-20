import { copy } from '../../../shared/lib/copy';

const text = copy.security.time;

// "az önce", "30 dk önce", "5 sa önce", "3 gün önce" for Active sessions.
export function lastSeenLabel(iso: string, now = Date.now()) {
  const minutes = Math.max(0, Math.floor((now - Date.parse(iso)) / 60000));
  if (minutes < 5) return text.now;
  if (minutes < 60) return text.minutes(minutes);
  if (minutes < 60 * 24) return text.hours(Math.floor(minutes / 60));
  return text.days(Math.floor(minutes / (60 * 24)));
}
