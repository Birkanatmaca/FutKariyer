import type {
  HeadToHeadPick,
  HeadToHeadRepository,
} from '../domain/head-to-head';
export function createHeadToHeadService(repository: HeadToHeadRepository) {
  return {
    record: (token: string) => repository.record(token),
    start: (token: string) => repository.start(token),
    answer: (
      token: string,
      runId: string,
      roundId: string,
      pick: HeadToHeadPick,
    ) => repository.answer(token, runId, roundId, pick),
  };
}
export type HeadToHeadService = ReturnType<typeof createHeadToHeadService>;
