import { copy } from '../../../shared/lib/copy';
import { relativeTime } from '../domain/visitors';

export const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

export function formatRelative(iso: string, now = new Date()) {
  const value = relativeTime(iso, now);
  return value.unit === 'now'
    ? copy.visitors.time.now
    : copy.visitors.time[value.unit](value.value);
}
