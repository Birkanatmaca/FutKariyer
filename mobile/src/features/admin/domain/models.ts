import type { PopupFormat } from '../../../shared/domain/popup-ads';
// Admin mode mirrors the web admin panel (frontend/) against /v1/admin.
// Every request carries the admin bearer token from the auth feature.

export type RequestMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';
export type AdminRequestOptions = {
  method?: RequestMethod;
  body?: unknown;
  formData?: FormData;
};
export type ImageSource = {
  uri: string;
  headers: Record<string, string>;
};
// The only way admin repositories reach the network. It adds the bearer
// token, refuses non-admin paths and ends the session on 401.
export interface AdminGateway {
  request<T>(path: string, options?: AdminRequestOptions): Promise<T>;
  imageSource(imageId: string): ImageSource | null;
}

export type Page<T> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

// Accounts (users and clubs)
export type AccountSection = 'users' | 'clubs';
export type ManagedRole = 'player' | 'coach' | 'club' | 'organizer' | 'admin';
export type FootballType = 'unknown' | 'amateur' | 'professional' | 'halisaha';
export type ManagedAccount = {
  id: string;
  fullName: string;
  email: string;
  username: string;
  role: ManagedRole;
  city: string;
  active: boolean;
  verified: boolean;
  createdAt: string;
  footballType: '' | FootballType;
  district: string;
  description: string;
  venueName: string;
  venueAddress: string;
  trainingGroundName: string;
  trainingGroundAddress: string;
  trainingSchedule: string;
};
export type CreatableRole = 'player' | 'coach' | 'club' | 'organizer';
export type AccountForm = {
  fullName: string;
  email: string;
  username: string;
  footballType: FootballType;
  district: string;
  description: string;
  venueName: string;
  venueAddress: string;
  trainingGroundName: string;
  trainingGroundAddress: string;
  trainingSchedule: string;
  password: string;
  role: CreatableRole;
  active: boolean;
  verified: boolean;
};

// Club overview (read only)
export type ClubOverviewFixture = {
  id: string;
  round: number;
  opponentName: string;
  isHome: boolean;
  kickoffAt: string | null;
  goalsFor: number | null;
  goalsAgainst: number | null;
  result: '' | 'win' | 'draw' | 'loss';
};
export type ClubOverview = {
  profile: {
    userId: string;
    name: string;
    footballType: FootballType;
    district: string;
    description: string;
    venueName: string;
    venueAddress: string;
    trainingGroundName: string;
    trainingGroundAddress: string;
    trainingSchedule: string;
    updatedAt: string;
  };
  email: string;
  active: boolean;
  news: {
    id: string;
    title: string;
    reviewStatus: 'pending' | 'approved' | 'rejected';
    published: boolean;
    createdAt: string;
  }[];
  applications: {
    id: string;
    playerName: string;
    status: 'pending' | 'accepted' | 'rejected';
    createdAt: string;
  }[];
  leagues: {
    leagueId: string;
    leagueName: string;
    season: string;
    status: 'active' | 'finished';
    teamCount: number;
    position: number;
    points: number;
    played: number;
    wins: number;
    draws: number;
    losses: number;
    goalDifference: number;
    upcoming: ClubOverviewFixture[];
    recent: ClubOverviewFixture[];
  }[];
};
export interface AccountsRepository {
  list(
    section: AccountSection,
    page: number,
    search: string,
  ): Promise<Page<ManagedAccount>>;
  get(section: AccountSection, id: string): Promise<ManagedAccount>;
  create(section: AccountSection, form: AccountForm): Promise<ManagedAccount>;
  update(
    section: AccountSection,
    id: string,
    form: AccountForm,
  ): Promise<ManagedAccount>;
  remove(section: AccountSection, id: string): Promise<void>;
  resetPassword(
    section: AccountSection,
    id: string,
    password: string,
  ): Promise<void>;
  clubOverview(id: string): Promise<ClubOverview>;
  // Pro membership for testing/support: grant adds 30 days (+3 rights for players), revoke ends it now.
  proStatus(id: string): Promise<AccountProStatus>;
  changePro(id: string, action: 'grant' | 'revoke'): Promise<AccountProStatus>;
}
export type AccountProStatus = {
  active: boolean;
  expiresAt: string | null;
  privateBrowsing: boolean;
  bonusCredits: number;
};

// Club and organizer applications
export type ApplicationStatus = 'pending' | 'approved' | 'rejected';
export type ApplicationDecision = 'approve' | 'reject';
export type AccountApplication = {
  userId: string;
  role: 'club' | 'organizer';
  fullName: string;
  contactName: string;
  username: string;
  email: string;
  phone: string;
  district: string;
  footballType: '' | 'amateur' | 'professional' | 'halisaha';
  note: string;
  status: ApplicationStatus;
  submittedAt: string;
  decidedAt: string | null;
  rejectionReason: string;
};
export interface ApplicationsRepository {
  list(status: ApplicationStatus): Promise<AccountApplication[]>;
  decide(
    userId: string,
    decision: ApplicationDecision,
    reason: string,
  ): Promise<AccountApplication>;
}

// Content: advertisements, news and the club news review queue
export type ContentSection = 'ads' | 'news';
export type ReviewStatus = 'pending' | 'approved' | 'rejected';
export type Advertisement = {
  id: string;
  title: string;
  imageId: string;
  active: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};
export type Article = {
  id: string;
  title: string;
  summary: string;
  body: string;
  imageId: string;
  published: boolean;
  showOnHome: boolean;
  // Club-written articles only; absent or '' for admin-written articles.
  reviewStatus?: ReviewStatus | '';
  authorName?: string;
  createdAt: string;
  updatedAt: string;
};
export type ContentItem = Advertisement | Article;
export type ContentForm = {
  title: string;
  imageId: string;
  active: boolean;
  sortOrder: number;
  summary: string;
  body: string;
  published: boolean;
  showOnHome: boolean;
};
export type PickedImage = {
  uri: string;
  name: string;
  mime: string;
  size: number;
  // Pixel size when the picker reports it; popup ads need an exact size.
  width?: number;
  height?: number;
};
// Popup ads opened over the app at launch (19 Oct 2026); the server takes
// the format from the image size.
export type { PopupFormat };
export type PopupAd = {
  id: string;
  title: string;
  imageId: string;
  format: PopupFormat;
  active: boolean;
  intervalMinutes: number;
  maxViews: number;
  views: number;
  viewers: number;
  createdAt: string;
  updatedAt: string;
};
export type PopupForm = {
  title: string;
  imageId: string;
  active: boolean;
  intervalMinutes: number;
  maxViews: number;
};
export interface PopupsRepository {
  list(page: number): Promise<Page<PopupAd>>;
  save(form: PopupForm, id?: string): Promise<void>;
  remove(id: string): Promise<void>;
}
export interface ContentRepository {
  list(section: ContentSection, page: number): Promise<Page<ContentItem>>;
  save(section: ContentSection, form: ContentForm, id?: string): Promise<void>;
  remove(section: ContentSection, id: string): Promise<void>;
  pendingReviews(): Promise<Article[]>;
  review(id: string, decision: ApplicationDecision): Promise<void>;
  upload(image: PickedImage): Promise<string>;
  imageSource(imageId: string): ImageSource | null;
}

// Fut Career leagues
export type LeagueStatus = 'draft' | 'active' | 'finished';
export type League = {
  id: string;
  name: string;
  season: string;
  description: string;
  status: LeagueStatus;
  winPoints: number;
  drawPoints: number;
  lossPoints: number;
  createdAt: string;
  updatedAt: string;
};
export type LeagueForm = Omit<League, 'id' | 'createdAt' | 'updatedAt'>;
export type ClubOption = { id: string; fullName: string };
export type LeagueTeam = {
  id: string;
  clubId: string;
  name: string;
  district: string;
};
export type LeagueMatch = {
  id: string;
  round: number;
  homeTeamId: string;
  awayTeamId: string;
  homeName: string;
  awayName: string;
  kickoffAt: string | null;
  homeGoals: number | null;
  awayGoals: number | null;
};
export type Standing = {
  position: number;
  teamId: string;
  clubId: string;
  teamName: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
};
export type LeagueStatistics = {
  teamCount: number;
  matchCount: number;
  playedMatches: number;
  scheduledMatches: number;
  totalGoals: number;
  averageGoals: number;
  homeWins: number;
  draws: number;
  awayWins: number;
};
export type LeagueDetail = {
  league: League;
  teams: LeagueTeam[];
  matches: LeagueMatch[];
  standings: Standing[];
  statistics: LeagueStatistics;
};
export type MatchForm = {
  round: number;
  homeTeamId: string;
  awayTeamId: string;
  kickoffAt: string | null;
  homeGoals: number | null;
  awayGoals: number | null;
};
export interface LeaguesRepository {
  list(page: number): Promise<Page<League>>;
  detail(id: string): Promise<LeagueDetail>;
  save(form: LeagueForm, id?: string): Promise<League>;
  remove(id: string): Promise<void>;
  clubs(search: string, page: number): Promise<Page<ClubOption>>;
  addTeam(leagueId: string, clubId: string): Promise<void>;
  removeTeam(leagueId: string, teamId: string): Promise<void>;
  saveMatch(leagueId: string, form: MatchForm, id?: string): Promise<void>;
  removeMatch(leagueId: string, matchId: string): Promise<void>;
}

// Gifts
export type GiftKind = 'heart_one' | 'heart_full' | 'application_right';
export type GiftAudience = 'all' | 'account';
export type Gift = {
  id: string;
  kind: GiftKind;
  title: string;
  message: string;
  audience: GiftAudience;
  targetEmail: string | null;
  validityDays: number;
  createdAt: string;
  recipients: number;
  claimed: number;
};
export type GiftDraft = {
  kind: GiftKind;
  title: string;
  message: string;
  audience: GiftAudience;
  email: string;
  validityDays: number;
};
export type GiftCreated = Pick<
  Gift,
  'id' | 'kind' | 'title' | 'recipients' | 'validityDays'
>;
export interface GiftsRepository {
  list(): Promise<Gift[]>;
  create(draft: GiftDraft): Promise<GiftCreated>;
}

// Opportunity announcements (create only; never edited or deleted)
export type AnnouncementAudience =
  | 'all'
  | 'player'
  | 'club'
  | 'coach'
  | 'account';
export type Announcement = {
  id: string;
  kind: 'opportunity';
  title: string;
  body: string;
  audience: AnnouncementAudience;
  targetEmail: string;
  createdAt: string;
  recipients: number;
};
export type AnnouncementDraft = {
  title: string;
  body: string;
  audience: AnnouncementAudience;
  email: string;
};
export interface AnnouncementsRepository {
  list(): Promise<Announcement[]>;
  create(draft: AnnouncementDraft): Promise<Announcement>;
}

// Payments
export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded';
export type PaymentFilter = PaymentStatus | 'all';
// App Store / Google Play product ids; '' means not sold in that store.
export type StoreProductIds = {
  appleProductId: string;
  googleProductId: string;
};
export type PaymentPackage = StoreProductIds & {
  id: string;
  credits: 2 | 5 | 10;
  // Reporting value; the store charges its own price.
  amountMinor: number;
  currency: string;
  active: boolean;
  sortOrder: number;
};
export type PaymentProduct = 'team_rights' | 'pro';
export type ProPlan = StoreProductIds & {
  id: string;
  days: number;
  bonusCredits: number;
  amountMinor: number;
  currency: string;
  active: boolean;
};
export type Payment = {
  id: string;
  product: PaymentProduct;
  playerId?: string;
  playerName: string;
  playerEmail: string;
  packageId?: string;
  // 0 for Pro orders.
  packageCredits: 0 | 2 | 5 | 10;
  amountMinor: number;
  currency: string;
  provider: string;
  providerPaymentId?: string;
  status: PaymentStatus;
  createdAt: string;
  updatedAt: string;
  confirmedAt?: string;
};
// Admin edit of a package or the Pro plan; both store ids are always sent.
export type CatalogUpdate = StoreProductIds & {
  amountMinor: number;
  active: boolean;
};
export type PaymentSummary = {
  total: number;
  pending: number;
  paid: number;
  failed: number;
  refunded: number;
  collectedMinor: number;
  refundedMinor: number;
};
export type PaymentPage = Page<Payment> & { summary: PaymentSummary };
export interface PaymentsRepository {
  packages(): Promise<PaymentPackage[]>;
  updatePackage(id: string, update: CatalogUpdate): Promise<PaymentPackage>;
  proPlan(): Promise<ProPlan>;
  updateProPlan(id: string, update: CatalogUpdate): Promise<ProPlan>;
  list(
    status: PaymentFilter,
    page: number,
    search: string,
  ): Promise<PaymentPage>;
}

// Content reports (moderation review queue). Open reports come oldest first,
// resolved ones newest first. Resolving one closes every open report about
// the same target on the server.
export type ReportQueue = 'open' | 'resolved';
export type ReportTargetKind = 'post' | 'reply' | 'user';
export type ReportReason =
  | 'spam'
  | 'harassment'
  | 'inappropriate'
  | 'impersonation'
  | 'other';
export type ReportStatus = 'open' | 'dismissed' | 'removed' | 'suspended';
export type ReportAction = 'dismiss' | 'remove' | 'suspend';
export type ContentReport = {
  id: string;
  targetKind: ReportTargetKind;
  targetId: string;
  // Absent when the target account no longer exists.
  targetUserId?: string;
  targetName: string;
  // '' when the target account no longer exists.
  targetRole: string;
  excerpt: string;
  reason: ReportReason;
  note: string;
  reporterName: string;
  status: ReportStatus;
  createdAt: string;
  resolvedAt?: string;
  // Open reports about the same target.
  targetReports: number;
};
export interface ReportsRepository {
  list(queue: ReportQueue, page: number): Promise<Page<ContentReport>>;
  resolve(id: string, action: ReportAction): Promise<ContentReport>;
}

export type AdminRepositories = {
  accounts: AccountsRepository;
  applications: ApplicationsRepository;
  content: ContentRepository;
  popups: PopupsRepository;
  leagues: LeaguesRepository;
  gifts: GiftsRepository;
  announcements: AnnouncementsRepository;
  payments: PaymentsRepository;
  reports: ReportsRepository;
};
