// Kafa Kafaya: the server owns the values and the winner. A round only carries
// what is shown before the pick; values arrive with the answer.
export type HeadToHeadPick = 'left' | 'right';
export const headToHeadMetrics = [
  'points',
  'goalsFor',
  'goalsAgainst',
  'rank',
  'won',
  'goalDiff',
] as const;
export type HeadToHeadMetric = (typeof headToHeadMetrics)[number];
export type HeadToHeadTeam = { name: string; logoUrl: string };
export type HeadToHeadRound = {
  id: string;
  league: { name: string; logoUrl: string };
  question: { metric: HeadToHeadMetric; label: string };
  left: HeadToHeadTeam;
  right: HeadToHeadTeam;
};
export type HeadToHeadRecord = { best: number; plays: number };
export type HeadToHeadRun = {
  id: string;
  streak: number;
  best: number;
  plays: number;
  round: HeadToHeadRound;
};
export type HeadToHeadResult = {
  roundId: string;
  pick: HeadToHeadPick;
  correct: boolean;
  values: { left: number; right: number };
  streak: number;
  best: number;
  gameOver: boolean;
  nextRound: HeadToHeadRound | null;
};
export interface HeadToHeadRepository {
  record(token: string): Promise<HeadToHeadRecord>;
  start(token: string): Promise<HeadToHeadRun>;
  answer(
    token: string,
    runId: string,
    roundId: string,
    pick: HeadToHeadPick,
  ): Promise<HeadToHeadResult>;
}
