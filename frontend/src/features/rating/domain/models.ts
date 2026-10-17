export type SeasonStatus = 'draft' | 'upcoming' | 'active' | 'finished';
export type Prize = { place: 1 | 2 | 3; title: string };
export type Season = {
  id: string;
  title: string;
  description: string;
  startsAt: string;
  endsAt: string;
  prizes: Prize[];
  published: boolean;
  status: SeasonStatus;
  players: number;
};
export type SeasonDraft = {
  title: string;
  description: string;
  startsAt: string;
  endsAt: string;
  prizes: Prize[];
  published: boolean;
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
  active: boolean;
  target: number;
  points: number;
};
export interface RatingRepository {
  seasons(): Promise<Season[]>;
  create(draft: SeasonDraft): Promise<Season>;
  update(id: string, draft: SeasonDraft): Promise<Season>;
  remove(id: string): Promise<void>;
  leaderboard(id: string): Promise<Standing[]>;
  tasks(): Promise<RatingTask[]>;
  updateTask(task: RatingTask): Promise<RatingTask>;
}
