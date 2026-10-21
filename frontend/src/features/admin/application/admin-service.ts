import type {
  AccountForm,
  AccountQuery,
  AdminRepository,
  AdminSection,
  ProAction,
} from '../domain/models';
export function createAdminService(repository: AdminRepository) {
  return {
    list: (section: AdminSection, query: AccountQuery) =>
      repository.list(section, { ...query, search: query.search.trim() }),
    stats: (section: AdminSection) => repository.stats(section),
    get: (section: AdminSection, id: string) => repository.get(section, id),
    clubOverview: (id: string) => repository.clubOverview(id),
    // Accounts sign up themselves (21 Oct 2026); the panel only edits them.
    save(section: AdminSection, form: AccountForm, id: string) {
      const normalized = {
        ...form,
        fullName: form.fullName.trim(),
        email: form.email.trim().toLowerCase(),
        username: form.username.trim().toLowerCase(),
        district: form.district.trim(),
        description: form.description.trim(),
        venueName: form.venueName.trim(),
        venueAddress: form.venueAddress.trim(),
        trainingGroundName: form.trainingGroundName.trim(),
        trainingGroundAddress: form.trainingGroundAddress.trim(),
        trainingSchedule: form.trainingSchedule.trim(),
      };
      return repository.update(section, id, normalized);
    },
    remove: (section: AdminSection, id: string) =>
      repository.remove(section, id),
    resetPassword: (section: AdminSection, id: string, password: string) =>
      repository.resetPassword(section, id, password),
    proStatus: (id: string) => repository.proStatus(id),
    changePro: (id: string, action: ProAction) =>
      repository.changePro(id, action),
  };
}
export type AdminService = ReturnType<typeof createAdminService>;
