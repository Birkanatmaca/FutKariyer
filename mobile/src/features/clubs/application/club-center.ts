import { copy } from '../../../shared/lib/copy';
import type {
  ClubCenter,
  ClubCenterLeague,
  ClubMatchResult,
  ClubRecentFixture,
  ClubUpcomingFixture,
} from '../domain/models';

// The checklist is shown only while the profile is incomplete.
export function completenessView(center: ClubCenter) {
  const percent = Math.min(100, Math.max(0, center.completenessPercent));
  const complete = percent >= 100;
  return {
    percent,
    complete,
    missing: complete ? [] : center.missingFields,
  };
}

export function recentResults(
  league: ClubCenterLeague,
  count = 3,
): ClubRecentFixture[] {
  return league.recent.slice(0, count);
}

export function nextFixture(
  league: ClubCenterLeague,
): ClubUpcomingFixture | null {
  return league.upcoming[0] ?? null;
}

export function resultLetter(result: ClubMatchResult) {
  return copy.clubHome.resultLabel[result];
}

export function kickoffLabel(kickoffAt: string | null) {
  if (!kickoffAt) return copy.clubHome.kickoffUnknown;
  return new Date(kickoffAt).toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}
