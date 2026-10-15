import { ApiError } from '../../../shared/api/client';
import { copy } from '../../../shared/lib/copy';
import { listingLimits, type ListingInput } from '../domain/models';

export type ListingErrors = Partial<Record<keyof ListingInput, string>>;

export const listingFields = Object.keys(
  listingLimits,
) as (keyof ListingInput)[];

// Counts characters the way the server counts them (code points, trimmed).
export function textLength(value: string) {
  return Array.from(value.trim()).length;
}

export function validateListing(input: ListingInput): ListingErrors {
  const errors: ListingErrors = {};
  for (const field of listingFields) {
    const { min, max } = listingLimits[field];
    const length = textLength(input[field]);
    if (length < min || length > max) {
      errors[field] =
        field === 'title'
          ? copy.listings.titleError(min, max)
          : copy.listings.tooLong(max);
    }
  }
  return errors;
}

// Keeps the 422 field errors that belong to the listing form.
// Other server messages stay in the form-level error banner.
export function listingFieldErrors(failure: unknown): ListingErrors {
  const errors: ListingErrors = {};
  if (!(failure instanceof ApiError) || failure.status !== 422) return errors;
  for (const field of listingFields) {
    const message = failure.fields[field];
    if (typeof message === 'string' && message) errors[field] = message;
  }
  return errors;
}

// A 404 means the listing closed after it was opened; the server message for
// 409 already tells apart a spent quota and an earlier application to the club.
export function applyErrorMessage(failure: unknown): string {
  if (failure instanceof ApiError && failure.status === 404) {
    return copy.listings.notFound;
  }
  return failure instanceof Error && failure.message
    ? failure.message
    : copy.form.unexpected;
}

// After 404 or 409 another attempt cannot succeed, so the apply button is hidden.
export function isFinalApplyError(failure: unknown) {
  return (
    failure instanceof ApiError &&
    (failure.status === 404 || failure.status === 409)
  );
}
