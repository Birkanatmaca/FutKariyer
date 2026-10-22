// Display helpers shared by the organizer screens.
export function dayLabel(value: string) {
  const date = new Date(value + 'T00:00:00');
  if (!Number.isFinite(date.getTime())) return value;
  return date.toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}
export function kickoffLabel(value: string | null) {
  if (!value) return null;
  return new Date(value).toLocaleString('tr-TR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}
export function initial(name: string) {
  return name.slice(0, 1).toLocaleUpperCase('tr-TR');
}
