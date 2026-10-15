import type {
  ReportAction,
  ReportsRepository,
  ReportTab,
} from '../domain/models';

export function createReportsService(repository: ReportsRepository) {
  return {
    list: (tab: ReportTab, page = 1) => repository.list(tab, page),
    countOpen: async () => (await repository.list('open', 1)).total,
    resolve: (id: string, action: ReportAction) =>
      repository.resolve(id, action),
  };
}
export type ReportsService = ReturnType<typeof createReportsService>;
