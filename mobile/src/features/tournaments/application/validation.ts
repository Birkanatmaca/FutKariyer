import { ApiError } from '../../../shared/api/client';
import { copy } from '../../../shared/lib/copy';
import type { PlayerFootballType } from '../../../shared/domain/football';
import {
  tournamentLimits,
  type TournamentFormat,
  type TournamentInput,
} from '../domain/models';

const text = copy.tournaments;

// The create form keeps every value as typed; numbers and choices are checked
// before the input is built.
export type TournamentDraft = {
  name: string;
  format: TournamentFormat | '';
  eligibleTypes: PlayerFootballType[];
  district: string;
  venue: string;
  description: string;
  startsOn: string;
  endsOn: string;
  applicationDeadline: string;
  teamCapacity: string;
};

export type TournamentField = keyof TournamentDraft;
export type TournamentErrors = Partial<Record<TournamentField, string>>;

export const tournamentFields: TournamentField[] = [
  'name',
  'format',
  'eligibleTypes',
  'district',
  'venue',
  'description',
  'startsOn',
  'endsOn',
  'applicationDeadline',
  'teamCapacity',
];

export const emptyTournamentDraft: TournamentDraft = {
  name: '',
  format: '',
  eligibleTypes: [],
  district: '',
  venue: '',
  description: '',
  startsOn: '',
  endsOn: '',
  applicationDeadline: '',
  teamCapacity: '',
};

// Counts characters the way the server counts them (code points, trimmed).
export function textLength(value: string) {
  return Array.from(value.trim()).length;
}

// Accepts an existing calendar day written as YYYY-MM-DD.
export function isCalendarDay(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return false;
  const [year, month, day] = match.slice(1).map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function capacity(value: string) {
  return /^\d+$/.test(value.trim()) ? Number(value.trim()) : NaN;
}

// Checks the form shape; the server still decides on past dates.
export function validateTournament(draft: TournamentDraft): TournamentErrors {
  const errors: TournamentErrors = {};
  const limits = tournamentLimits;
  const name = textLength(draft.name);
  if (name < limits.name.min || name > limits.name.max) {
    errors.name = text.nameError(limits.name.min, limits.name.max);
  }
  if (!draft.format) errors.format = text.formatError;
  if (!draft.eligibleTypes.length) errors.eligibleTypes = text.typesError;
  for (const key of ['district', 'venue', 'description'] as const) {
    if (textLength(draft[key]) > limits[key].max) {
      errors[key] = text.tooLong(limits[key].max);
    }
  }
  for (const key of ['startsOn', 'endsOn', 'applicationDeadline'] as const) {
    if (!isCalendarDay(draft[key])) errors[key] = text.dayError;
  }
  const startsOn = draft.startsOn.trim();
  if (!errors.startsOn && !errors.endsOn && draft.endsOn.trim() < startsOn) {
    errors.endsOn = text.endsError;
  }
  if (
    !errors.startsOn &&
    !errors.applicationDeadline &&
    draft.applicationDeadline.trim() > startsOn
  ) {
    errors.applicationDeadline = text.deadlineError;
  }
  const teams = capacity(draft.teamCapacity);
  if (
    !Number.isInteger(teams) ||
    teams < limits.capacity.min ||
    teams > limits.capacity.max
  ) {
    errors.teamCapacity = text.capacityError(
      limits.capacity.min,
      limits.capacity.max,
    );
  }
  return errors;
}

// Call only after validateTournament returned no errors.
export function toTournamentInput(draft: TournamentDraft): TournamentInput {
  return {
    name: draft.name,
    format: draft.format as TournamentFormat,
    eligibleTypes: draft.eligibleTypes,
    district: draft.district,
    venue: draft.venue,
    description: draft.description,
    startsOn: draft.startsOn,
    endsOn: draft.endsOn,
    applicationDeadline: draft.applicationDeadline,
    teamCapacity: capacity(draft.teamCapacity),
  };
}

// Keeps the 422 field errors that belong to the create form.
export function tournamentFieldErrors(failure: unknown): TournamentErrors {
  const errors: TournamentErrors = {};
  if (!(failure instanceof ApiError) || failure.status !== 422) return errors;
  for (const key of tournamentFields) {
    const message = failure.fields[key];
    if (typeof message === 'string' && message) errors[key] = message;
  }
  return errors;
}

// The server answers 403 when the organizer account is not verified yet.
export function createErrorMessage(failure: unknown) {
  if (failure instanceof ApiError && failure.status === 403) {
    return text.verificationRequired;
  }
  return failure instanceof Error && failure.message
    ? failure.message
    : copy.form.unexpected;
}

// Adds or removes a player; a full roster ignores new players.
export function toggleRosterPlayer(selected: string[], id: string) {
  if (selected.includes(id)) return selected.filter(item => item !== id);
  if (selected.length >= tournamentLimits.roster) return selected;
  return [...selected, id];
}

// After 409 (closed, not eligible, duplicate) another attempt cannot succeed.
export function isFinalEntryError(failure: unknown) {
  return failure instanceof ApiError && failure.status === 409;
}

export function errorMessage(failure: unknown) {
  return failure instanceof Error && failure.message
    ? failure.message
    : copy.form.unexpected;
}
