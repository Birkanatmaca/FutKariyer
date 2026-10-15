import type { GamesRepository, Side } from '../domain/models';
export function createGamesService(repository: GamesRepository) {
  return {
    state: (token: string) => repository.state(token),
    start: (token: string) => repository.start(token),
    answer: (
      token: string,
      runId: string,
      questionId: string,
      optionId: string,
    ) => repository.answer(token, runId, questionId, optionId),
    penaltyStart: (token: string) => repository.penaltyStart(token),
    penaltyKick: (token: string, matchId: string, index: number, side: Side) =>
      repository.penaltyKick(token, matchId, index, side),
  };
}
export type GamesService = ReturnType<typeof createGamesService>;
