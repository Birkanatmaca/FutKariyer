import { ApiError } from '../../../shared/api/client';
import { copy } from '../../../shared/lib/copy';
import type { Page } from '../domain/models';

// Defensive checks for /v1/admin responses. A payload that does not match the
// contract is rejected as a generic error instead of reaching the screens.
export type Unknown = Record<string, unknown>;
export const idPattern = /^[a-f0-9]{32}$/;
export function isRecord(value: unknown): value is Unknown {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
export function isText(value: unknown): value is string {
  return typeof value === 'string';
}
export function isId(value: unknown): value is string {
  return typeof value === 'string' && idPattern.test(value);
}
export function isCount(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}
export function isTimestamp(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}
export function isOneOf<T extends string>(
  value: unknown,
  options: readonly T[],
): value is T {
  return (
    typeof value === 'string' && (options as readonly string[]).includes(value)
  );
}
export function isListOf<T>(
  value: unknown,
  valid: (item: unknown) => item is T,
): value is T[] {
  return Array.isArray(value) && value.every(valid);
}
// Server pages. When `current` is given the server must answer for the
// requested page; when `size` is given the page size and page count must match
// it exactly (the web panel applies the same checks per endpoint).
export function isPage<T>(
  value: unknown,
  valid: (item: unknown) => item is T,
  current?: number,
  size?: number,
): value is Page<T> {
  if (!isRecord(value) || !isListOf(value.items, valid)) return false;
  const { page, pageSize, total, totalPages } = value;
  return (
    Number.isSafeInteger(page) &&
    (page as number) >= 1 &&
    (current === undefined || page === current) &&
    Number.isSafeInteger(pageSize) &&
    (pageSize as number) >= 1 &&
    (size === undefined || pageSize === size) &&
    (value.items as unknown[]).length <= (pageSize as number) &&
    isCount(total) &&
    isCount(totalPages) &&
    (size === undefined ||
      totalPages === Math.ceil((total as number) / (pageSize as number)))
  );
}
export function unexpected(): never {
  throw new ApiError(copy.form.unexpected);
}
export function segment(id: string) {
  if (!idPattern.test(id)) unexpected();
  return id;
}
