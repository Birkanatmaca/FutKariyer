export function formatDate(value: string) {
  return new Date(value).toLocaleDateString('tr-TR');
}

export function formatDateTime(value: string) {
  return new Date(value).toLocaleString('tr-TR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function scoreText(
  goalsFor: number | null,
  goalsAgainst: number | null,
) {
  return goalsFor === null || goalsAgainst === null
    ? ''
    : goalsFor + '-' + goalsAgainst;
}

export function signedNumber(value: number) {
  return value > 0 ? '+' + value : String(value);
}
