import { copy } from '../../../shared/lib/copy';
import type {
  AccountForm,
  AccountSection,
  AdminRepositories,
  AnnouncementDraft,
  ApplicationDecision,
  ApplicationStatus,
  ContentForm,
  ContentSection,
  GiftDraft,
  LeagueForm,
  MatchForm,
  PaymentFilter,
  PickedImage,
} from '../domain/models';
import {
  limits,
  normalizeAccountForm,
  normalizeAnnouncementDraft,
  normalizeGiftDraft,
} from './validation';

export function createAdminServices(
  repositories: AdminRepositories,
  pickImage: () => Promise<PickedImage | null>,
) {
  const {
    accounts,
    applications,
    content,
    leagues,
    gifts,
    announcements,
    payments,
  } = repositories;
  return {
    accounts: {
      list: (section: AccountSection, page: number, search: string) =>
        accounts.list(section, page, search.trim()),
      get: (section: AccountSection, id: string) => accounts.get(section, id),
      save: (section: AccountSection, form: AccountForm, id?: string) =>
        id
          ? accounts.update(section, id, normalizeAccountForm(form))
          : accounts.create(section, normalizeAccountForm(form)),
      remove: (section: AccountSection, id: string) =>
        accounts.remove(section, id),
      resetPassword: (section: AccountSection, id: string, password: string) =>
        accounts.resetPassword(section, id, password),
      clubOverview: (id: string) => accounts.clubOverview(id),
      proStatus: (id: string) => accounts.proStatus(id),
      grantPro: (id: string) => accounts.changePro(id, 'grant'),
      revokePro: (id: string) => accounts.changePro(id, 'revoke'),
    },
    applications: {
      list: (status: ApplicationStatus) => applications.list(status),
      countPending: async () => (await applications.list('pending')).length,
      decide: (userId: string, decision: ApplicationDecision, reason = '') =>
        applications.decide(
          userId,
          decision,
          decision === 'reject'
            ? reason.trim().slice(0, limits.rejectionReason)
            : '',
        ),
    },
    content: {
      list: (section: ContentSection, page: number) =>
        content.list(section, page),
      pendingReviews: () => content.pendingReviews(),
      review: (id: string, decision: ApplicationDecision) =>
        content.review(id, decision),
      save: (section: ContentSection, form: ContentForm, id?: string) =>
        content.save(
          section,
          {
            ...form,
            title: form.title.trim(),
            summary: form.summary.trim(),
            body: form.body.trim(),
          },
          id,
        ),
      remove: (section: ContentSection, id: string) =>
        content.remove(section, id),
      // Picks a JPEG or PNG and checks the size the server accepts. Library
      // assets without a reported size are left to the server check.
      async pickImage() {
        const image = await pickImage();
        if (!image) return null;
        if (
          !['image/jpeg', 'image/png'].includes(image.mime) ||
          image.size > limits.imageBytes
        )
          throw new Error(copy.admin.content.imageHint);
        return image;
      },
      upload: (image: PickedImage) => content.upload(image),
      imageSource: (imageId: string) => content.imageSource(imageId),
    },
    leagues: {
      list: (page: number) => leagues.list(page),
      detail: (id: string) => leagues.detail(id),
      save: (form: LeagueForm, id?: string) => leagues.save(form, id),
      remove: (id: string) => leagues.remove(id),
      clubs: (search: string, page: number) =>
        leagues.clubs(search.trim(), page),
      addTeam: (leagueId: string, clubId: string) =>
        leagues.addTeam(leagueId, clubId),
      removeTeam: (leagueId: string, teamId: string) =>
        leagues.removeTeam(leagueId, teamId),
      saveMatch: (leagueId: string, form: MatchForm, id?: string) =>
        leagues.saveMatch(leagueId, form, id),
      removeMatch: (leagueId: string, matchId: string) =>
        leagues.removeMatch(leagueId, matchId),
    },
    gifts: {
      list: () => gifts.list(),
      create: (draft: GiftDraft) => gifts.create(normalizeGiftDraft(draft)),
    },
    announcements: {
      list: () => announcements.list(),
      create: (draft: AnnouncementDraft) =>
        announcements.create(normalizeAnnouncementDraft(draft)),
    },
    payments: {
      packages: () => payments.packages(),
      updatePackage: (id: string, amountMinor: number, active: boolean) =>
        payments.updatePackage(id, amountMinor, active),
      proPlan: () => payments.proPlan(),
      updateProPlan: (id: string, amountMinor: number, active: boolean) =>
        payments.updateProPlan(id, amountMinor, active),
      list: (status: PaymentFilter, page: number, search: string) =>
        payments.list(status, page, search.trim()),
    },
  };
}
export type AdminServices = ReturnType<typeof createAdminServices>;
