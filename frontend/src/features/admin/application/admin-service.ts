import type {
  AccountForm,
  AdminRepository,
  AdminSection,
} from '../domain/models';
export function createAdminService(repository: AdminRepository) {
  return {
    list: (section: AdminSection, page: number, search: string) =>
      repository.list(section, page, search.trim()),
    get: (section: AdminSection, id: string) => repository.get(section, id),
    save(section: AdminSection, form: AccountForm, id?: string) {
      const normalized = {
        ...form,
        fullName: form.fullName.trim(),
        email: form.email.trim().toLowerCase(),
        username: form.username.trim().toLowerCase(),
        district: form.district.trim(),
      };
      return id
        ? repository.update(section, id, normalized)
        : repository.create(section, normalized);
    },
    remove: (section: AdminSection, id: string) =>
      repository.remove(section, id),
    resetPassword: (section: AdminSection, id: string, password: string) =>
      repository.resetPassword(section, id, password),
  };
}
export type AdminService = ReturnType<typeof createAdminService>;
