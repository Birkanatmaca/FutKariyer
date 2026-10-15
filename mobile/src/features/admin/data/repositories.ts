import type { AdminGateway, AdminRepositories } from '../domain/models';
import { createAccountsRepository } from './http-accounts-repository';
import { createApplicationsRepository } from './http-applications-repository';
import { createContentRepository } from './http-content-repository';
import { createLeaguesRepository } from './http-leagues-repository';
import {
  createAnnouncementsRepository,
  createGiftsRepository,
} from './http-messaging-repositories';
import { createPaymentsRepository } from './http-payments-repository';
import { createReportsRepository } from './http-reports-repository';

export function createAdminRepositories(
  gateway: AdminGateway,
): AdminRepositories {
  return {
    accounts: createAccountsRepository(gateway),
    applications: createApplicationsRepository(gateway),
    content: createContentRepository(gateway),
    leagues: createLeaguesRepository(gateway),
    gifts: createGiftsRepository(gateway),
    announcements: createAnnouncementsRepository(gateway),
    payments: createPaymentsRepository(gateway),
    reports: createReportsRepository(gateway),
  };
}
