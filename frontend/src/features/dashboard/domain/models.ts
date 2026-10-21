// Ana sayfa (21 Oct 2026): one summary of every panel section for a window.
export const dashboardWindows = [7, 30, 90] as const;
export type DashboardWindow = (typeof dashboardWindows)[number];
export type DashboardDay = {
  date: string;
  players: number;
  coaches: number;
  clubs: number;
  posts: number;
  replies: number;
  likes: number;
  gamePlays: number;
  revenueMinor: number;
  orders: number;
  errors: number;
  warnings: number;
};
export type DashboardSlice = { key: string; value: number };
export type Dashboard = {
  days: number;
  generatedAt: string;
  kpis: {
    users: number;
    newUsers: number;
    newUsersPrev: number;
    active24h: number;
    active7d: number;
    proMembers: number;
    revenueMinor: number;
    revenuePrevMinor: number;
    paidOrders: number;
    posts: number;
    postsPrev: number;
    gamePlays: number;
  };
  daily: DashboardDay[];
  roles: DashboardSlice[];
  footballTypes: DashboardSlice[];
  positions: DashboardSlice[];
  games: DashboardSlice[];
  modules: {
    users: {
      total: number;
      players: number;
      coaches: number;
      clubs: number;
      organizers: number;
      verified: number;
      suspended: number;
    };
    clubs: {
      total: number;
      verified: number;
      tffLinked: number;
      withStaff: number;
      squadPlayers: number;
    };
    applications: { pending: number; approved: number; rejected: number };
    teamRequests: { pending: number; accepted: number };
    reports: { open: number; resolved: number };
    news: { published: number; pendingReview: number; new: number };
    ads: { active: number; total: number };
    popups: { active: number; views: number };
    announcements: { sent: number; total: number };
    leagues: {
      active: number;
      teams: number;
      upcomingMatches: number;
      playedMatches: number;
    };
    rating: {
      season: string;
      endsAt: string | null;
      participants: number;
      points: number;
    };
    payments: {
      revenueMinor: number;
      paid: number;
      refunded: number;
      pending: number;
      pro: number;
    };
    gifts: { sent: number; claimed: number };
    audit: { actions: number; adminLogins: number };
    logs: { errors: number; warnings: number; security: number };
    social: { posts: number; replies: number; likes: number; follows: number };
    connections: { pending: number; accepted: number };
    tournaments: { open: number; entries: number };
  };
  recentUsers: {
    id: string;
    fullName: string;
    role: string;
    createdAt: string;
  }[];
  recentActions: {
    at: string;
    action: string;
    actorName: string;
    actorType: string;
  }[];
};
export interface DashboardRepository {
  load(days: DashboardWindow): Promise<Dashboard>;
}
