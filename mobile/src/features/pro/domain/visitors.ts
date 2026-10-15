import type { RoleCounts, VisitorRole, VisitorTotals } from './models';

export type WeeklyHeadline =
  | { kind: 'role'; role: VisitorRole; count: number }
  | { kind: 'total'; count: number }
  | { kind: 'none' };

// Clubs and coaches lead the summary because they matter most to a player.
const headlineOrder: VisitorRole[] = ['club', 'coach', 'organizer', 'player'];

// "Bu hafta 3 kulüp profiline baktı": the most relevant visible role of the week,
// falling back to the total when only hidden (private) visitors came by.
export function weeklyHeadline(week: VisitorTotals): WeeklyHeadline {
  if (week.visitors === 0) return { kind: 'none' };
  for (const role of headlineOrder) {
    if (week.byRole[role] > 0)
      return { kind: 'role', role, count: week.byRole[role] };
  }
  return { kind: 'total', count: week.visitors };
}

export function roleBreakdown(
  counts: RoleCounts,
): { role: VisitorRole | 'hidden'; count: number }[] {
  return (['club', 'coach', 'player', 'organizer', 'hidden'] as const)
    .map(role => ({ role, count: counts[role] }))
    .filter(item => item.count > 0);
}

export type RelativeTime =
  | { unit: 'now' }
  | { unit: 'minutes' | 'hours' | 'days'; value: number };

export function relativeTime(iso: string, now: Date): RelativeTime {
  const minutes = Math.max(
    0,
    Math.floor((now.getTime() - Date.parse(iso)) / 60000),
  );
  if (minutes < 1) return { unit: 'now' };
  if (minutes < 60) return { unit: 'minutes', value: minutes };
  if (minutes < 24 * 60)
    return { unit: 'hours', value: Math.floor(minutes / 60) };
  return { unit: 'days', value: Math.floor(minutes / (24 * 60)) };
}

export function visitorKind(
  role: VisitorRole,
): 'players' | 'clubs' | 'coaches' | null {
  if (role === 'player') return 'players';
  if (role === 'club') return 'clubs';
  if (role === 'coach') return 'coaches';
  return null;
}
