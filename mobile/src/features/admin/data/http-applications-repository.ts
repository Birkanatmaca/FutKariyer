import type {
  AccountApplication,
  AdminGateway,
  ApplicationsRepository,
} from '../domain/models';
import {
  isId,
  isListOf,
  isOneOf,
  isRecord,
  isText,
  isTimestamp,
  segment,
  unexpected,
} from './validators';

export function isAccountApplication(
  value: unknown,
): value is AccountApplication {
  return (
    isRecord(value) &&
    isId(value.userId) &&
    isOneOf(value.role, ['club', 'organizer']) &&
    isText(value.fullName) &&
    isText(value.contactName) &&
    isText(value.username) &&
    isText(value.email) &&
    isText(value.phone) &&
    isText(value.district) &&
    isOneOf(value.footballType, ['', 'amateur', 'professional', 'halisaha']) &&
    isText(value.note) &&
    isOneOf(value.status, ['pending', 'approved', 'rejected']) &&
    isTimestamp(value.submittedAt) &&
    (value.decidedAt === null || isTimestamp(value.decidedAt)) &&
    isText(value.rejectionReason)
  );
}

export function createApplicationsRepository(
  gateway: AdminGateway,
): ApplicationsRepository {
  return {
    async list(status) {
      const result = await gateway.request<unknown>(
        '/v1/admin/applications?status=' + status,
      );
      if (!isRecord(result) || !isListOf(result.items, isAccountApplication))
        unexpected();
      return result.items as AccountApplication[];
    },
    async decide(userId, decision, reason) {
      const result = await gateway.request<unknown>(
        '/v1/admin/applications/' + segment(userId),
        {
          method: 'PUT',
          body: decision === 'reject' ? { decision, reason } : { decision },
        },
      );
      if (!isRecord(result) || !isAccountApplication(result.application))
        unexpected();
      return result.application as AccountApplication;
    },
  };
}
