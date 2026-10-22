import { ApiError } from '../../../shared/api/client';
import { copy } from '../../../shared/lib/copy';
import type { PlayerFootballType } from '../../../shared/domain/football';
import {
  tournamentLimits,
  type MatchInput,
  type TournamentFormat,
  type TournamentInput,
  type TournamentMatch,
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

// The match form keeps every value as typed. Kickoff is a local calendar day
// and a 24-hour time; both are given together or left empty.
export type MatchDraft = {
  round: string;
  homeEntryId: string;
  awayEntryId: string;
  kickoffDate: string;
  kickoffTime: string;
  venue: string;
  homeGoals: string;
  awayGoals: string;
};

export type MatchField = 'round' | 'teams' | 'kickoff' | 'venue' | 'score';
export type MatchErrors = Partial<Record<MatchField, string>>;

const pad = (value: number) => String(value).padStart(2, '0');

export function emptyMatchDraft(round = 1): MatchDraft {
  return {
    round: String(round),
    homeEntryId: '',
    awayEntryId: '',
    kickoffDate: '',
    kickoffTime: '',
    venue: '',
    homeGoals: '',
    awayGoals: '',
  };
}

// Shows a stored match in the device's local time.
export function matchDraftOf(match: TournamentMatch): MatchDraft {
  const at = match.kickoffAt ? new Date(match.kickoffAt) : null;
  return {
    round: String(match.round),
    homeEntryId: match.homeEntryId,
    awayEntryId: match.awayEntryId,
    kickoffDate: at
      ? at.getFullYear() +
        '-' +
        pad(at.getMonth() + 1) +
        '-' +
        pad(at.getDate())
      : '',
    kickoffTime: at ? pad(at.getHours()) + ':' + pad(at.getMinutes()) : '',
    venue: match.venue,
    homeGoals: match.homeGoals === null ? '' : String(match.homeGoals),
    awayGoals: match.awayGoals === null ? '' : String(match.awayGoals),
  };
}

const wholeNumber = (value: string) =>
  /^\d+$/.test(value.trim()) ? Number(value.trim()) : NaN;

export function isClockTime(value: string) {
  const match = /^(\d{2}):(\d{2})$/.exec(value.trim());
  return !!match && Number(match[1]) < 24 && Number(match[2]) < 60;
}

export function validateMatch(draft: MatchDraft): MatchErrors {
  const errors: MatchErrors = {};
  const limits = tournamentLimits;
  const round = wholeNumber(draft.round);
  if (!(round >= limits.round.min && round <= limits.round.max)) {
    errors.round = text.roundError(limits.round.min, limits.round.max);
  }
  if (!draft.homeEntryId || !draft.awayEntryId) {
    errors.teams = text.teamsError;
  } else if (draft.homeEntryId === draft.awayEntryId) {
    errors.teams = text.sameTeamError;
  }
  const date = draft.kickoffDate.trim();
  const time = draft.kickoffTime.trim();
  if (date || time) {
    if (!isCalendarDay(date) || !isClockTime(time)) {
      errors.kickoff = text.kickoffError;
    }
  }
  if (textLength(draft.venue) > limits.matchVenue) {
    errors.venue = text.tooLong(limits.matchVenue);
  }
  const home = draft.homeGoals.trim();
  const away = draft.awayGoals.trim();
  if (!home !== !away) {
    errors.score = text.scorePairError;
  } else if (home) {
    const goals = [wholeNumber(home), wholeNumber(away)];
    if (
      !goals.every(
        value => value >= limits.goals.min && value <= limits.goals.max,
      )
    ) {
      errors.score = text.scoreError(limits.goals.min, limits.goals.max);
    }
  }
  return errors;
}

// Call only after validateMatch returned no errors.
export function toMatchInput(draft: MatchDraft): MatchInput {
  const date = draft.kickoffDate.trim();
  let kickoffAt: string | null = null;
  if (date) {
    const [year, month, day] = date.split('-').map(Number);
    const [hour, minute] = draft.kickoffTime.trim().split(':').map(Number);
    kickoffAt = new Date(year, month - 1, day, hour, minute).toISOString();
  }
  const home = draft.homeGoals.trim();
  return {
    round: wholeNumber(draft.round),
    homeEntryId: draft.homeEntryId,
    awayEntryId: draft.awayEntryId,
    kickoffAt,
    venue: draft.venue,
    homeGoals: home ? wholeNumber(home) : null,
    awayGoals: home ? wholeNumber(draft.awayGoals) : null,
  };
}

// Keeps the 422 field errors that belong to the match form.
export function matchFieldErrors(failure: unknown): MatchErrors {
  const errors: MatchErrors = {};
  if (!(failure instanceof ApiError) || failure.status !== 422) return errors;
  for (const key of ['round', 'teams', 'venue', 'score'] as const) {
    const message = failure.fields[key];
    if (typeof message === 'string' && message) errors[key] = message;
  }
  const kickoff = failure.fields.kickoffAt;
  if (typeof kickoff === 'string' && kickoff) errors.kickoff = kickoff;
  return errors;
}

// Searches start at two letters, as the server requires.
export function isSearchQuery(value: string) {
  const length = textLength(value);
  return (
    length >= tournamentLimits.search.min &&
    length <= tournamentLimits.search.max
  );
}
