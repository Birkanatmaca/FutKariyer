import type {
  Entry,
  EntryStatus,
  Match,
  TournamentForm,
  TournamentStatus,
} from './models';

// Status moves the server allows: open -> closed -> finished, closed can
// reopen, and open or closed can be cancelled.
export type StatusAction = 'close' | 'reopen' | 'finish' | 'cancel';
export function statusActions(status: TournamentStatus): StatusAction[] {
  if (status === 'open') return ['close', 'cancel'];
  if (status === 'closed') return ['reopen', 'finish', 'cancel'];
  return [];
}
export function actionTarget(action: StatusAction): TournamentStatus {
  return action === 'close'
    ? 'closed'
    : action === 'reopen'
    ? 'open'
    : action === 'finish'
    ? 'finished'
    : 'cancelled';
}
// Fixture, scores, entries and invites change only while it is running.
export function isEditable(status: TournamentStatus) {
  return status === 'open' || status === 'closed';
}

export function groupRounds(matches: Match[]): [number, Match[]][] {
  const groups = new Map<number, Match[]>();
  for (const match of matches)
    groups.set(match.round, [...(groups.get(match.round) ?? []), match]);
  return [...groups.entries()].sort(([a], [b]) => a - b);
}

const entryOrder: Record<EntryStatus, number> = {
  pending: 0,
  invited: 1,
  accepted: 2,
  declined: 3,
  rejected: 4,
  withdrawn: 5,
};
export function sortEntries(entries: Entry[]): Entry[] {
  return [...entries].sort(
    (a, b) =>
      entryOrder[a.status] - entryOrder[b.status] ||
      a.clubName.localeCompare(b.clubName, 'tr'),
  );
}

// ISO time <-> the value of a datetime-local input, in the browser's zone.
export function toLocalInput(value: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}
export function fromLocalInput(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

// Both goals or neither; each 0-99.
export type Score =
  | { ok: true; homeGoals: number | null; awayGoals: number | null }
  | { ok: false; error: 'both' | 'range' };
export function parseScore(home: string, away: string): Score {
  const h = home.trim();
  const a = away.trim();
  if (h === '' && a === '')
    return { ok: true, homeGoals: null, awayGoals: null };
  if (h === '' || a === '') return { ok: false, error: 'both' };
  const homeGoals = Number(h);
  const awayGoals = Number(a);
  if (
    ![homeGoals, awayGoals].every(
      goal => Number.isInteger(goal) && goal >= 0 && goal <= 99,
    )
  )
    return { ok: false, error: 'range' };
  return { ok: true, homeGoals, awayGoals };
}

// Client-side checks that mirror the server; the server stays the authority.
export type FormProblem =
  | 'typesRequired'
  | 'capacityRange'
  | 'endBeforeStart'
  | 'deadlineAfterStart';
export function checkTournament(
  form: TournamentForm,
): Partial<Record<keyof TournamentForm, FormProblem>> {
  const problems: Partial<Record<keyof TournamentForm, FormProblem>> = {};
  if (form.eligibleTypes.length === 0) problems.eligibleTypes = 'typesRequired';
  if (
    !Number.isInteger(form.teamCapacity) ||
    form.teamCapacity < 2 ||
    form.teamCapacity > 128
  )
    problems.teamCapacity = 'capacityRange';
  if (form.startsOn && form.endsOn && form.endsOn < form.startsOn)
    problems.endsOn = 'endBeforeStart';
  if (
    form.startsOn &&
    form.applicationDeadline &&
    form.applicationDeadline > form.startsOn
  )
    problems.applicationDeadline = 'deadlineAfterStart';
  return problems;
}

// Today as YYYY-MM-DD in the browser's zone, for date input minimums.
export function today(now = new Date()): string {
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}
