import type { LogsRepository } from '../domain/models';

export function createLogsService(repository: LogsRepository) {
  return {
    list: repository.list,
    get: repository.get,
    summary: repository.summary,
    settings: repository.settings,
    saveSettings: repository.saveSettings,
  };
}
export type LogsService = ReturnType<typeof createLogsService>;

// "3 g 4 sa", "5 sa 12 dk", "8 dk".
export function formatUptime(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (days > 0) return days + ' g ' + (hours % 24) + ' sa';
  if (hours > 0) return hours + ' sa ' + (minutes % 60) + ' dk';
  return Math.max(1, minutes) + ' dk';
}

export function formatTime(value: string) {
  return new Date(value).toLocaleString('tr-TR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}
