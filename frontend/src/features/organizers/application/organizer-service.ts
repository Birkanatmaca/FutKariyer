import type { OrganizerForm, OrganizerRepository } from '../domain/models';

export function createOrganizerService(repository: OrganizerRepository) {
  return {
    list: (page: number) => repository.list(page),
    create: (form: OrganizerForm) => repository.create(form),
  };
}
export type OrganizerService = ReturnType<typeof createOrganizerService>;
