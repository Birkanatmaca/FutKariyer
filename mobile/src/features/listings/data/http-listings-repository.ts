import { ApiError, request } from '../../../shared/api/client';
import { copy } from '../../../shared/lib/copy';
import { isTeamJoinRequest, isTeamQuota } from '../../teams';
import type {
  CreatedListing,
  Listing,
  ListingApplication,
  ListingPage,
  ListingsRepository,
} from '../domain/models';

const idPattern = /^[a-f0-9]{32}$/;
const footballTypes = ['unknown', 'amateur', 'professional', 'halisaha'];
const pageSize = 20;

const validId = (value: unknown) =>
  typeof value === 'string' && idPattern.test(value);
const validDate = (value: unknown) =>
  typeof value === 'string' && Number.isFinite(Date.parse(value));
const isCount = (value: unknown) =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0;

export function isListing(value: unknown): value is Listing {
  const item = value as Listing;
  return (
    !!item &&
    typeof item === 'object' &&
    validId(item.id) &&
    validId(item.clubId) &&
    [
      item.clubName,
      item.district,
      item.title,
      item.position,
      item.description,
    ].every(field => typeof field === 'string') &&
    footballTypes.includes(item.footballType) &&
    (item.status === 'open' || item.status === 'closed') &&
    validDate(item.createdAt) &&
    (item.closedAt === null || validDate(item.closedAt)) &&
    (item.applications === undefined || isCount(item.applications))
  );
}

const isOpenListing = (value: unknown): value is Listing =>
  isListing(value) && value.status === 'open';

const isOwnListing = (value: unknown): value is Listing =>
  isListing(value) && isCount(value.applications);

export function isListingPage(
  value: unknown,
  page: number,
): value is ListingPage {
  const result = value as ListingPage;
  return (
    !!result &&
    Array.isArray(result.items) &&
    result.items.every(isOpenListing) &&
    result.page === page &&
    result.pageSize === pageSize &&
    isCount(result.total) &&
    result.totalPages === Math.ceil(result.total / pageSize)
  );
}

function invalid(): never {
  throw new ApiError(copy.form.unexpected);
}

export const listingsRepository: ListingsRepository = {
  async open(token, page, filter) {
    const result = await request<unknown>(
      '/v1/listings?page=' +
        page +
        (filter ? '&footballType=' + encodeURIComponent(filter) : ''),
      { token },
    );
    if (!isListingPage(result, page)) invalid();
    return result;
  },
  async detail(token, id) {
    const result = await request<unknown>(
      '/v1/listings/' + encodeURIComponent(id),
      { token },
    );
    const listing = (result as { listing?: unknown } | null)?.listing;
    if (!isOpenListing(listing) || listing.id !== id) invalid();
    return listing;
  },
  async apply(token, id) {
    const result = await request<unknown>(
      '/v1/listings/' + encodeURIComponent(id) + '/apply',
      { method: 'POST', token },
    );
    const application = result as ListingApplication | null;
    if (
      !application ||
      !isTeamJoinRequest(application.request) ||
      !isTeamQuota(application.quota)
    )
      invalid();
    return application;
  },
  async mine(token) {
    const result = await request<unknown>('/v1/me/listings', { token });
    const items = (result as { items?: unknown } | null)?.items;
    if (!Array.isArray(items) || !items.every(isOwnListing)) invalid();
    return items;
  },
  async create(token, input) {
    const result = await request<unknown>('/v1/me/listings', {
      method: 'POST',
      token,
      body: input,
    });
    const created = result as CreatedListing | null;
    if (
      !created ||
      !isOpenListing(created.listing) ||
      !isCount(created.notifiedPlayers)
    )
      invalid();
    return created;
  },
  async close(token, id) {
    const result = await request<unknown>(
      '/v1/me/listings/' + encodeURIComponent(id) + '/close',
      { method: 'PUT', token },
    );
    const listing = (result as { listing?: unknown } | null)?.listing;
    if (!isListing(listing) || listing.id !== id || listing.status !== 'closed')
      invalid();
    return listing;
  },
};
