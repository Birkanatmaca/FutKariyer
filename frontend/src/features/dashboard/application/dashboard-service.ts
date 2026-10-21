import type { DashboardRepository, DashboardWindow } from '../domain/models';

export function createDashboardService(repository: DashboardRepository) {
  return { load: (days: DashboardWindow) => repository.load(days) };
}
export type DashboardService = ReturnType<typeof createDashboardService>;

const money = new Intl.NumberFormat('tr-TR', {
  style: 'currency',
  currency: 'TRY',
  maximumFractionDigits: 0,
});
const number = new Intl.NumberFormat('tr-TR');

export const formatMoney = (minor: number) => money.format(minor / 100);
export const formatNumber = (n: number) => number.format(n);

// Change against the previous window: +12 %, −5 %; null when there is
// nothing to compare with.
export function change(current: number, previous: number): number | null {
  if (previous <= 0) return current > 0 ? null : 0;
  return Math.round(((current - previous) / previous) * 100);
}

export function shortDate(iso: string) {
  const [, month, day] = iso.split('-');
  return day + '.' + month;
}
