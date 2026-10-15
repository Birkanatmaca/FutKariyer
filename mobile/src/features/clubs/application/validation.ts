import { copy } from '../../../shared/lib/copy';
import {
  clubArticleLimits,
  clubProfileLimits,
  type ClubArticleInput,
  type ClubProfileInput,
} from '../domain/models';

export type FormErrors = Record<string, string>;

// Counts characters the way the form counters and the limits are shown to the user.
export function textLength(value: string) {
  return Array.from(value.trim()).length;
}

export const clubProfileFields = Object.keys(
  clubProfileLimits,
) as (keyof ClubProfileInput)[];

export const clubArticleFields = Object.keys(
  clubArticleLimits,
) as (keyof ClubArticleInput)[];

export function validateClubProfile(input: ClubProfileInput): FormErrors {
  const errors: FormErrors = {};
  for (const field of clubProfileFields) {
    const max = clubProfileLimits[field];
    if (textLength(input[field]) > max) {
      errors[field] = copy.clubProfile.tooLong(max);
    }
  }
  return errors;
}

export function validateClubArticle(input: ClubArticleInput): FormErrors {
  const errors: FormErrors = {};
  for (const field of clubArticleFields) {
    const { min, max } = clubArticleLimits[field];
    const length = textLength(input[field]);
    if (length < min || length > max) {
      errors[field] = copy.clubNews.lengthError(min, max);
    }
  }
  return errors;
}

// Keeps only the server field errors that belong to a known form field.
// Other server messages stay in the form-level error banner.
export function mapServerFields(
  fields: Record<string, string> | undefined,
  known: readonly string[],
): FormErrors {
  const errors: FormErrors = {};
  for (const [key, message] of Object.entries(fields ?? {})) {
    if (known.includes(key) && typeof message === 'string') {
      errors[key] = message;
    }
  }
  return errors;
}
