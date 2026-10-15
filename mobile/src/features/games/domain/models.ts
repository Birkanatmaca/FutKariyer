export const questionCount = 10;
export const passingScore = 7;
// hasCrest comes from the server; without a crest (or when it fails to
// load) the clue is drawn as a name badge with the club's initials.
export type GameClub = {
  id: string;
  name: string;
  hasCrest: boolean;
  logoUrl: string;
};
const legalForms = new Set([
  'FC',
  'CF',
  'AC',
  'AFC',
  'SC',
  'SK',
  'FK',
  'JK',
  'CD',
  'AS',
  'SL',
]);
// Two initials from the first two meaningful words ("Real Madrid" -> RM),
// or the first two letters of a single-word name ("Galatasaray" -> GA).
export function clubInitials(name: string): string {
  const words = name
    .replace(/[.,'’()&/-]/g, ' ')
    .split(/\s+/)
    .filter(w => w && !legalForms.has(w.toUpperCase()) && !/^\d+$/.test(w));
  const pick = words.length ? words : name.trim().split(/\s+/);
  const letters =
    pick.length >= 2
      ? Array.from(pick[0])[0] + Array.from(pick[1])[0]
      : Array.from(pick[0] ?? '')
          .slice(0, 2)
          .join('');
  return letters.toUpperCase() || '?';
}
export type GameOption = { id: string; name: string };
export type GameQuestion = {
  id: string;
  difficulty: 'easy' | 'medium' | 'hard';
  clubs: GameClub[];
  options: GameOption[];
};
export type GameFeedback = {
  questionId: string;
  selectedOptionId: string;
  correctOptionId: string;
  correctName: string;
  correct: boolean;
};
export type GameRun = {
  id: string;
  status: 'active' | 'finished';
  answered: number;
  score: number;
  passed: boolean;
  rewardGranted: boolean;
  question: GameQuestion | null;
  feedback: GameFeedback | null;
};
export type Side = 'left' | 'center' | 'right';
export type PenaltyKick = {
  role: 'shooter' | 'keeper';
  userSide: Side;
  cpuSide: Side;
  scored: boolean;
};
export type PenaltyMatch = {
  id: string;
  status: 'active' | 'finished';
  kicks: PenaltyKick[];
  goals: { user: number; cpu: number };
  winner: 'user' | 'cpu' | null;
  rewardGranted: boolean;
  nextRole: 'shooter' | 'keeper' | '';
};
export type GameState = {
  hearts: number;
  maxHearts: 3;
  nextHeartAt: string | null;
  serverTime: string;
  rewardEligible: boolean;
  stats: {
    played: number;
    wins: number;
    bestScore: number;
    earnedCredits: number;
  };
  run: GameRun | null;
  penalty: PenaltyMatch | null;
};
export interface GamesRepository {
  state(token: string): Promise<GameState>;
  start(token: string): Promise<GameState>;
  answer(
    token: string,
    runId: string,
    questionId: string,
    optionId: string,
  ): Promise<GameState>;
  penaltyStart(token: string): Promise<GameState>;
  penaltyKick(
    token: string,
    matchId: string,
    index: number,
    side: Side,
  ): Promise<GameState>;
}
