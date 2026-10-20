import type {
  DominantFoot,
  PlayerAvailability,
  PlayerProfile,
} from '../../players';
import type {
  LicenseStatus,
  PlayerFootballType,
} from '../../../shared/domain/football';
export type DiscoveryKind = 'players' | 'clubs' | 'coaches';
export type DiscoveryProfile = {
  id: string;
  fullName: string;
  role: 'player' | 'club' | 'coach';
  verified: boolean;
  // Server-evaluated Pro membership; shown as the PRO pill.
  isPro?: boolean;
  // 0 without a profile photo (older servers omit it).
  avatarVersion?: number;
  district: string;
  playerProfile: PlayerProfile | null;
  isFollowing: boolean;
};
export type ProfileInsights = {
  profileViews: number;
  followers: number;
  following: number;
};
export type DiscoveryQuery = {
  kind: DiscoveryKind;
  search: string;
  position: string;
  dominantFoot: DominantFoot;
  availability: PlayerAvailability | '';
  footballType: PlayerFootballType | '';
  licenseStatus: Exclude<LicenseStatus, 'unknown'> | '';
  page: number;
};
export type DiscoveryPage = {
  items: DiscoveryProfile[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};
export interface DiscoveryRepository {
  insights(token: string): Promise<ProfileInsights>;
  follow(
    token: string,
    kind: DiscoveryKind,
    id: string,
    following: boolean,
  ): Promise<void>;
  list(token: string, query: DiscoveryQuery): Promise<DiscoveryPage>;
  get(
    token: string,
    kind: DiscoveryKind,
    id: string,
  ): Promise<DiscoveryProfile>;
  // İzleme listesi (20 Oct 2026): a verified coach's starred players.
  watchlist(token: string): Promise<DiscoveryProfile[]>;
  watch(token: string, playerId: string, on: boolean): Promise<void>;
}
