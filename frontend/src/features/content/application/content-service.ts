import { copy } from '../../../shared/lib/copy';
import type {
  ContentRepository,
  ContentSection,
  ContentForm,
  ReviewDecision,
} from '../domain/models';
export function createContentService(repo: ContentRepository) {
  return {
    list: (section: ContentSection, page: number) => repo.list(section, page),
    listAll: (section: ContentSection) => repo.listAll(section),
    listPendingReviews: () => repo.pendingReviews(),
    review: (id: string, decision: ReviewDecision) => repo.review(id, decision),
    save: (section: ContentSection, form: ContentForm, id?: string) =>
      repo.save(
        section,
        {
          ...form,
          title: form.title.trim(),
          summary: form.summary.trim(),
          body: form.body.trim(),
        },
        id,
      ),
    remove: (section: ContentSection, id: string) => repo.remove(section, id),
    upload(file: File) {
      if (
        !['image/jpeg', 'image/png'].includes(file.type) ||
        file.size > 4 * 1024 * 1024 ||
        file.size === 0
      )
        throw new Error(copy.content.imageHint);
      return repo.upload(file);
    },
    imageUrl: repo.imageUrl,
  };
}
export type ContentService = ReturnType<typeof createContentService>;
