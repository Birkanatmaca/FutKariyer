export { AdminDashboardScreen } from './ui/AdminDashboardScreen';
export { AdminMoreScreen } from './ui/AdminMoreScreen';
export type { AdminDestination } from './ui/AdminMenu';
export { AccountsScreen } from './ui/accounts/AccountsScreen';
export { AccountEditorScreen } from './ui/accounts/AccountEditorScreen';
export { ClubOverviewScreen } from './ui/accounts/ClubOverviewScreen';
export { ApplicationsScreen } from './ui/applications/ApplicationsScreen';
export { ContentScreen, type ContentTab } from './ui/content/ContentScreen';
export { ContentEditorScreen } from './ui/content/ContentEditorScreen';
export { LeaguesScreen } from './ui/leagues/LeaguesScreen';
export { LeagueEditorScreen } from './ui/leagues/LeagueEditorScreen';
export { LeagueWorkspaceScreen } from './ui/leagues/LeagueWorkspaceScreen';
export { MatchEditorScreen } from './ui/leagues/MatchEditorScreen';
export { GiftsScreen as AdminGiftsScreen } from './ui/campaigns/GiftsScreen';
export { AnnouncementsScreen } from './ui/campaigns/AnnouncementsScreen';
export { PaymentsScreen as AdminPaymentsScreen } from './ui/payments/PaymentsScreen';
export { ReportsScreen } from './ui/reports/ReportsScreen';
export {
  createAdminServices,
  type AdminServices,
} from './application/admin-services';
// Adapters are exposed for the application composition root only.
export { createAdminGateway } from './data/admin-gateway';
export { createAdminRepositories } from './data/repositories';
export { pickContentImage } from './data/image-picker';
export type {
  AccountSection,
  ContentItem,
  ContentSection,
  League,
  LeagueMatch,
  LeagueTeam,
} from './domain/models';
