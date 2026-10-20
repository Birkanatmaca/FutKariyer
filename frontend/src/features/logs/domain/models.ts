// Sistem logları (20 Oct 2026): the server's kept log lines, their summary
// and the settings that decide what is written and kept.
export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
export type LogEntry = {
  id: number;
  at: string;
  level: LogLevel;
  event: string;
  requestId: string;
  method: string;
  route: string;
  status: number;
  durationMs: number;
  userId: string;
  accountType: string;
  ip: string;
  client: string;
  appVersion: string;
  version: string;
  security: boolean;
  message: string;
  attrs: Record<string, unknown>;
};
export type LogPage = { items: LogEntry[]; total: number; page: number };
export type LogSummary = {
  since: string;
  errors: number;
  warnings: number;
  security: number;
  clientErrors: number;
  slow: number;
  topEvents: { event: string; count: number; last: string }[];
  slowRoutes: { route: string; count: number; maxMs: number; errors: number }[];
  timeline: { at: string; errors: number; warnings: number }[];
  live: {
    version: string;
    uptimeSeconds: number;
    requests: number;
    serverErrors: number;
    level: string;
    dropped: number;
  };
};
export type LogSettings = {
  level: 'debug' | 'info' | 'warn' | 'error';
  storeRequests: boolean;
  requestDays: number;
  problemDays: number;
  securityDays: number;
  updatedAt: string;
  updatedBy: string;
};
export const logKinds = [
  '',
  'errors',
  'warnings',
  'security',
  'client',
  'slow',
  'requests',
] as const;
export type LogKind = (typeof logKinds)[number];
export const logWindows = [1, 6, 24, 168, 720] as const;
export type LogWindow = (typeof logWindows)[number];
export const logPageSize = 50;
export type LogQuery = {
  kind: LogKind;
  search: string;
  userId: string;
  hours: LogWindow;
  page: number;
};
export interface LogsRepository {
  list(query: LogQuery): Promise<LogPage>;
  get(id: number): Promise<LogEntry>;
  summary(hours: LogWindow): Promise<LogSummary>;
  settings(): Promise<LogSettings>;
  saveSettings(settings: LogSettings): Promise<LogSettings>;
}
