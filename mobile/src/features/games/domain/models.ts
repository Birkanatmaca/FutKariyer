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
  nextRole: 'shooter' | 'keeper' | '';
};
// Daily plays per game (17 Oct 2026, replaces hearts); they reset at
// midnight Istanbul time (nextResetAt).
export type PlayCount = { used: number; limit: number };
export type GameKey = 'footballGuess' | 'penalty' | 'headToHead';
export function playsLeft(count: PlayCount) {
  return Math.max(0, count.limit - count.used);
}
export type GameState = {
  plays: Record<GameKey, PlayCount>;
  nextResetAt: string;
  // A rating season is running: correct answers and goals earn points.
  ratingActive: boolean;
  serverTime: string;
  stats: {
    played: number;
    wins: number;
    bestScore: number;
    seasonPoints: number;
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
