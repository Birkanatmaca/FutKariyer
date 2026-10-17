// Global rating (17 Oct 2026): monthly seasons set up by the administrator,
// prizes for the top three, points from games and tasks.
export type SeasonStatus = 'upcoming' | 'active' | 'finished';
export type Prize = { place: 1 | 2 | 3; title: string };
export type RatingSeason = {
  id: string;
  title: string;
  description: string;
  startsAt: string;
  endsAt: string;
  prizes: Prize[];
  status: SeasonStatus;
};
export type Standing = {
  rank: number;
  userId: string;
  fullName: string;
  role: 'player' | 'club' | 'coach';
  points: number;
};
export type TaskKind =
  | 'play_games'
  | 'share_post'
  | 'follow_accounts'
  | 'h2h_streak';
export type RatingTask = {
  kind: TaskKind;
  target: number;
  points: number;
  progress: number;
  claimed: boolean;
};
export type RatingBoard = {
  season: RatingSeason | null;
  serverTime: string;
  leaderboard: Standing[];
  // rank 0: no points yet this season.
  me: { rank: number; points: number } | null;
  tasks: RatingTask[];
};
export interface RatingRepository {
  board(token: string): Promise<RatingBoard>;
  claim(token: string, kind: TaskKind): Promise<RatingBoard>;
}
export interface RatingIntroStorage {
  seen(seasonId: string): Promise<boolean>;
  markSeen(seasonId: string): Promise<void>;
}
// The moment the countdown runs to: the start of an upcoming season, else its end.
export function countdownTarget(season: RatingSeason) {
  return season.status === 'upcoming' ? season.startsAt : season.endsAt;
}
export function splitDuration(seconds: number) {
  const s = Math.max(0, Math.floor(seconds));
  return {
    days: Math.floor(s / 86400),
    hours: Math.floor((s % 86400) / 3600),
    minutes: Math.floor((s % 3600) / 60),
    seconds: s % 60,
  };
}
