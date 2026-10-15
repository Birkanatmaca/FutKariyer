import { ApiError, request } from '../../../shared/api/client';
import { copy } from '../../../shared/lib/copy';
import type {
  AccountApplication,
  ApplicationDecision,
  ApplicationFootballType,
  ApplicationStatus,
  ApplicationsRepository,
} from '../domain/models';

const idPattern = /^[0-9a-f]{32}$/;
const statuses: ApplicationStatus[] = ['pending', 'approved', 'rejected'];
const footballTypes: ApplicationFootballType[] = [
  '',
  'amateur',
  'professional',
  'halisaha',
];
const validDate = (value: unknown) =>
  typeof value === 'string' && Number.isFinite(Date.parse(value));
const text = (value: unknown) => typeof value === 'string';

function validApplication(value: unknown): value is AccountApplication {
  const item = value as AccountApplication;
  return (
    !!item &&
    typeof item.userId === 'string' &&
    idPattern.test(item.userId) &&
    (item.role === 'club' || item.role === 'organizer') &&
    text(item.fullName) &&
    text(item.contactName) &&
    text(item.username) &&
    text(item.email) &&
    text(item.phone) &&
    text(item.district) &&
    footballTypes.includes(item.footballType) &&
    text(item.note) &&
    statuses.includes(item.status) &&
    validDate(item.submittedAt) &&
    (item.decidedAt === null || validDate(item.decidedAt)) &&
    text(item.rejectionReason)
  );
}

export const applicationsRepository: ApplicationsRepository = {
  async list(status: ApplicationStatus) {
    const result = await request<{ items: unknown }>(
      '/v1/admin/applications?status=' + status,
    );
    if (
      !result ||
      !Array.isArray(result.items) ||
      !result.items.every(validApplication)
    )
      throw new ApiError(copy.form.unexpected);
    return result.items;
  },
  async decide(userId: string, decision: ApplicationDecision, reason: string) {
    if (!idPattern.test(userId)) throw new ApiError(copy.form.unexpected);
    const result = await request<{ application: unknown }>(
      '/v1/admin/applications/' + userId,
      {
        method: 'PUT',
        body: decision === 'reject' ? { decision, reason } : { decision },
      },
    );
    if (!result || !validApplication(result.application))
      throw new ApiError(copy.form.unexpected);
    return result.application;
  },
};
