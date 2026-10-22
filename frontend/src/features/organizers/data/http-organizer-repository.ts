import { ApiError, request } from '../../../shared/api/client';
import { copy } from '../../../shared/lib/copy';
import type {
  Organizer,
  OrganizerPage,
  OrganizerRepository,
} from '../domain/models';

function organizer(value: unknown): value is Organizer {
  const item = value as Organizer;
  return (
    !!item &&
    typeof item.id === 'string' &&
    /^[a-f0-9]{32}$/.test(item.id) &&
    typeof item.fullName === 'string' &&
    typeof item.username === 'string' &&
    typeof item.email === 'string' &&
    typeof item.active === 'boolean' &&
    typeof item.verified === 'boolean' &&
    Number.isSafeInteger(item.tournaments) &&
    typeof item.createdAt === 'string' &&
    Number.isFinite(Date.parse(item.createdAt))
  );
}
function page(value: unknown, current: number): value is OrganizerPage {
  const result = value as OrganizerPage;
  return (
    !!result &&
    Array.isArray(result.items) &&
    result.items.every(organizer) &&
    result.page === current &&
    Number.isSafeInteger(result.pageSize) &&
    Number.isSafeInteger(result.total) &&
    Number.isSafeInteger(result.totalPages)
  );
}
const root = '/v1/admin/organizers';

export const organizerRepository: OrganizerRepository = {
  async list(current) {
    const result = await request<unknown>(root + '?page=' + current);
    if (!page(result, current)) throw new ApiError(copy.form.unexpected);
    return result;
  },
  async create(form) {
    const result = await request<{ organizer: unknown }>(root, {
      method: 'POST',
      body: {
        fullName: form.fullName.trim(),
        username: form.username.trim(),
        email: form.email.trim(),
        password: form.password,
      },
    });
    if (!result || !organizer(result.organizer))
      throw new ApiError(copy.form.unexpected);
    return result.organizer;
  },
};
