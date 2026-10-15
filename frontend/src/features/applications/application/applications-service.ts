import type {
  ApplicationDecision,
  ApplicationStatus,
  ApplicationsRepository,
} from '../domain/models';

export const applicationLimits = { reasonMax: 300 } as const;

export function createApplicationService(repository: ApplicationsRepository) {
  return {
    list: (status: ApplicationStatus) => repository.list(status),
    countPending: async () => (await repository.list('pending')).length,
    decide: (userId: string, decision: ApplicationDecision, reason = '') =>
      repository.decide(
        userId,
        decision,
        decision === 'reject'
          ? reason.trim().slice(0, applicationLimits.reasonMax)
          : '',
      ),
  };
}
export type ApplicationService = ReturnType<typeof createApplicationService>;
