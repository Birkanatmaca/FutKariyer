import { copy } from '../../../shared/lib/copy';
import type {
  AccountForm,
  AnnouncementDraft,
  GiftDraft,
  LeagueForm,
  LeagueMatch,
  MatchForm,
} from '../domain/models';

export type FieldErrors = Record<string, string>;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const text = copy.admin;

export const limits = {
  giftTitle: [2, 80],
  giftMessage: 500,
  giftValidity: [1, 365],
  announcementTitle: [2, 120],
  announcementBody: 500,
  email: 254,
  rejectionReason: 300,
  round: [1, 100],
  goals: 50,
  points: 10,
  imageBytes: 4 * 1024 * 1024,
} as const;

export function normalizeAccountForm(form: AccountForm): AccountForm {
  return {
    ...form,
    fullName: form.fullName.trim(),
    email: form.email.trim().toLowerCase(),
    username: form.username.trim().toLowerCase(),
    district: form.district.trim(),
    description: form.description.trim(),
    venueName: form.venueName.trim(),
    venueAddress: form.venueAddress.trim(),
    trainingGroundName: form.trainingGroundName.trim(),
    trainingGroundAddress: form.trainingGroundAddress.trim(),
    trainingSchedule: form.trainingSchedule.trim(),
  };
}

export function normalizeGiftDraft(draft: GiftDraft): GiftDraft {
  return {
    kind: draft.kind,
    title: draft.title.trim(),
    message: draft.message.trim(),
    audience: draft.audience,
    email: draft.audience === 'account' ? draft.email.trim() : '',
    validityDays: draft.validityDays,
  };
}
export function validateGiftDraft(input: GiftDraft): FieldErrors {
  const draft = normalizeGiftDraft(input);
  const fields: FieldErrors = {};
  const [titleMin, titleMax] = limits.giftTitle;
  if (draft.title.length < titleMin || draft.title.length > titleMax)
    fields.title = text.gifts.errors.title;
  if (draft.message.length > limits.giftMessage)
    fields.message = text.gifts.errors.message;
  if (
    draft.audience === 'account' &&
    (!emailPattern.test(draft.email) || draft.email.length > limits.email)
  )
    fields.email = text.gifts.errors.email;
  const [daysMin, daysMax] = limits.giftValidity;
  if (
    !Number.isInteger(draft.validityDays) ||
    draft.validityDays < daysMin ||
    draft.validityDays > daysMax
  )
    fields.validityDays = text.gifts.errors.validityDays;
  return fields;
}

export function normalizeAnnouncementDraft(
  draft: AnnouncementDraft,
): AnnouncementDraft {
  return {
    title: draft.title.trim(),
    body: draft.body.trim(),
    audience: draft.audience,
    email: draft.audience === 'account' ? draft.email.trim() : '',
  };
}
export function validateAnnouncementDraft(
  input: AnnouncementDraft,
): FieldErrors {
  const draft = normalizeAnnouncementDraft(input);
  const fields: FieldErrors = {};
  const [titleMin, titleMax] = limits.announcementTitle;
  if (draft.title.length < titleMin || draft.title.length > titleMax)
    fields.title = text.announcements.errors.title;
  if (draft.body.length < 1 || draft.body.length > limits.announcementBody)
    fields.body = text.announcements.errors.body;
  if (
    draft.audience === 'account' &&
    (!emailPattern.test(draft.email) || draft.email.length > limits.email)
  )
    fields.email = text.announcements.errors.email;
  return fields;
}

// Whole numbers typed into text fields; '' and partial input are rejected.
export function parseWhole(value: string): number | null {
  const trimmed = value.trim();
  return /^\d{1,6}$/.test(trimmed) ? Number(trimmed) : null;
}

export type LeagueDraft = Omit<
  LeagueForm,
  'winPoints' | 'drawPoints' | 'lossPoints'
> & { winPoints: string; drawPoints: string; lossPoints: string };
export function toLeagueForm(
  draft: LeagueDraft,
): { form: LeagueForm } | { fields: FieldErrors } {
  const fields: FieldErrors = {};
  const points = (key: 'winPoints' | 'drawPoints' | 'lossPoints') => {
    const value = parseWhole(draft[key]);
    if (value === null || value > limits.points) {
      fields[key] = text.leagues.errors.points;
      return 0;
    }
    return value;
  };
  const form: LeagueForm = {
    name: draft.name.trim(),
    season: draft.season.trim(),
    description: draft.description.trim(),
    status: draft.status,
    winPoints: points('winPoints'),
    drawPoints: points('drawPoints'),
    lossPoints: points('lossPoints'),
  };
  return Object.keys(fields).length ? { fields } : { form };
}

// Match kickoff is typed as a local date (GG.AA.YYYY) and time (SS:DD).
export type MatchDraft = {
  round: string;
  homeTeamId: string;
  awayTeamId: string;
  date: string;
  time: string;
  homeGoals: string;
  awayGoals: string;
};
function pad(value: number) {
  return String(value).padStart(2, '0');
}
export function matchDraft(
  match: LeagueMatch | undefined,
  teamIds: string[],
): MatchDraft {
  const kickoff = match?.kickoffAt ? new Date(match.kickoffAt) : null;
  const valid = kickoff && Number.isFinite(kickoff.getTime());
  return {
    round: String(match?.round ?? 1),
    homeTeamId: match?.homeTeamId ?? teamIds[0] ?? '',
    awayTeamId: match?.awayTeamId ?? teamIds[1] ?? '',
    date: valid
      ? pad(kickoff.getDate()) +
        '.' +
        pad(kickoff.getMonth() + 1) +
        '.' +
        kickoff.getFullYear()
      : '',
    time: valid
      ? pad(kickoff.getHours()) + ':' + pad(kickoff.getMinutes())
      : '',
    homeGoals: match?.homeGoals == null ? '' : String(match.homeGoals),
    awayGoals: match?.awayGoals == null ? '' : String(match.awayGoals),
  };
}
function parseKickoff(
  date: string,
  time: string,
  fields: FieldErrors,
): string | null {
  const day = date.trim();
  const clock = time.trim();
  if (!day && !clock) return null;
  const d = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(day);
  const t = /^(\d{1,2}):(\d{2})$/.exec(clock);
  if (!d) fields.date = text.leagues.errors.date;
  if (!t) fields.time = text.leagues.errors.time;
  if (!d || !t) return null;
  const [dd, mm, yyyy] = [Number(d[1]), Number(d[2]), Number(d[3])];
  const [hh, min] = [Number(t[1]), Number(t[2])];
  const value = new Date(yyyy, mm - 1, dd, hh, min);
  if (
    value.getFullYear() !== yyyy ||
    value.getMonth() !== mm - 1 ||
    value.getDate() !== dd
  ) {
    fields.date = text.leagues.errors.date;
    return null;
  }
  if (hh > 23 || min > 59) {
    fields.time = text.leagues.errors.time;
    return null;
  }
  return value.toISOString();
}
export function toMatchForm(
  draft: MatchDraft,
): { form: MatchForm } | { fields: FieldErrors } {
  const fields: FieldErrors = {};
  const round = parseWhole(draft.round);
  const [roundMin, roundMax] = limits.round;
  if (round === null || round < roundMin || round > roundMax)
    fields.round = text.leagues.errors.round;
  if (!draft.homeTeamId) fields.homeTeamId = text.leagues.errors.team;
  if (!draft.awayTeamId) fields.awayTeamId = text.leagues.errors.team;
  if (draft.homeTeamId && draft.homeTeamId === draft.awayTeamId)
    fields.awayTeamId = text.leagues.errors.sameTeam;
  const kickoffAt = parseKickoff(draft.date, draft.time, fields);
  const homeEmpty = !draft.homeGoals.trim();
  const awayEmpty = !draft.awayGoals.trim();
  let homeGoals: number | null = null;
  let awayGoals: number | null = null;
  if (homeEmpty !== awayEmpty) {
    fields[homeEmpty ? 'homeGoals' : 'awayGoals'] =
      text.leagues.errors.bothScores;
  } else if (!homeEmpty) {
    homeGoals = parseWhole(draft.homeGoals);
    awayGoals = parseWhole(draft.awayGoals);
    if (homeGoals === null || homeGoals > limits.goals)
      fields.homeGoals = text.leagues.errors.goals;
    if (awayGoals === null || awayGoals > limits.goals)
      fields.awayGoals = text.leagues.errors.goals;
  }
  if (Object.keys(fields).length) return { fields };
  return {
    form: {
      round: round as number,
      homeTeamId: draft.homeTeamId,
      awayTeamId: draft.awayTeamId,
      kickoffAt,
      homeGoals,
      awayGoals,
    },
  };
}

// Package prices are typed in lira ("150" or "149,90"); at least 1 TL.
export function parsePrice(value: string): number | null {
  const normalized = value.trim().replace(',', '.');
  if (!/^\d{1,7}(\.\d{1,2})?$/.test(normalized)) return null;
  const minor = Math.round(Number(normalized) * 100);
  return minor >= 100 ? minor : null;
}
export function priceText(amountMinor: number) {
  return (amountMinor / 100).toFixed(2).replace('.', ',');
}
