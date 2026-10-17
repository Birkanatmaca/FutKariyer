// Turkish-aware, case-insensitive "contains" used by the league search.
export function normalizeSearch(value: string) {
  return value.trim().toLocaleLowerCase('tr-TR');
}
export function matchesSearch(query: string, ...fields: string[]) {
  const needle = normalizeSearch(query);
  return (
    needle.length > 0 &&
    fields.some(field => normalizeSearch(field).includes(needle))
  );
}
export const minSearchLength = 2;
