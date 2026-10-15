import type {
  FootballType,
  PlayerFootballType,
} from '../../../shared/domain/football';
import type { TeamJoinRequest, TeamQuota } from '../../teams';

// Character limits mirror the server rules for club listings.
export const listingLimits = {
  title: { min: 2, max: 120 },
  position: { min: 0, max: 40 },
  description: { min: 0, max: 1000 },
} as const;

// A club can keep at most this many listings open at the same time.
export const maxOpenListings = 10;

export type ListingStatus = 'open' | 'closed';

export type Listing = {
  id: string;
  clubId: string;
  clubName: string;
  district: string;
  footballType: FootballType;
  title: string;
  position: string;
  description: string;
  status: ListingStatus;
  createdAt: string;
  closedAt: string | null;
  // Only present on the owning club's own list.
  applications?: number;
};

// An empty filter lists open listings of every football type.
export type ListingFilter = '' | PlayerFootballType;

export type ListingPage = {
  items: Listing[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type ListingInput = {
  title: string;
  position: string;
  description: string;
};

export type CreatedListing = { listing: Listing; notifiedPlayers: number };

// Applying to a listing is a normal team application and uses one right.
export type ListingApplication = {
  request: TeamJoinRequest;
  quota: TeamQuota;
};

export interface ListingsRepository {
  open(
    token: string,
    page: number,
    filter: ListingFilter,
  ): Promise<ListingPage>;
  detail(token: string, id: string): Promise<Listing>;
  apply(token: string, id: string): Promise<ListingApplication>;
  mine(token: string): Promise<Listing[]>;
  create(token: string, input: ListingInput): Promise<CreatedListing>;
  close(token: string, id: string): Promise<Listing>;
}
