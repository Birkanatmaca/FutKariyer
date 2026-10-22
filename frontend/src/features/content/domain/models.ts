export type ContentSection = 'ads' | 'news';
// When an item is live and how long it stays on screen in the app's
// carousel (21 Oct 2026). A null start or end leaves that side open.
export type Schedule = {
  displaySeconds: number;
  startsAt: string | null;
  endsAt: string | null;
};
export const displaySecondsRange = { min: 3, max: 30 } as const;
export const defaultSeconds = { ads: 5, news: 6 } as const;
export const advertisementSize = { width: 1200, height: 600 } as const;
export type Advertisement = Schedule & {
  id: string;
  title: string;
  imageId: string;
  active: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};
export type ReviewStatus = 'pending' | 'approved' | 'rejected';
export type ReviewDecision = 'approve' | 'reject';
export type Article = Schedule & {
  id: string;
  title: string;
  summary: string;
  body: string;
  imageId: string;
  published: boolean;
  showOnHome: boolean;
  /** Priority in the app's lists and home loop, lower first. */
  sortOrder: number;
  /** Club-written articles only; absent or '' for admin-written articles. */
  reviewStatus?: ReviewStatus;
  authorName?: string;
  createdAt: string;
  updatedAt: string;
};
export type ContentItem = Advertisement | Article;
export type ContentPage = {
  items: ContentItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};
export type ContentForm = Schedule & {
  title: string;
  imageId: string;
  active: boolean;
  sortOrder: number;
  summary: string;
  body: string;
  published: boolean;
  showOnHome: boolean;
};
export interface ContentRepository {
  list(section: ContentSection, page: number): Promise<ContentPage>;
  listAll(section: ContentSection): Promise<ContentItem[]>;
  save(section: ContentSection, form: ContentForm, id?: string): Promise<void>;
  remove(section: ContentSection, id: string): Promise<void>;
  review(id: string, decision: ReviewDecision): Promise<void>;
  pendingReviews(): Promise<Article[]>;
  upload(file: File): Promise<string>;
  imageUrl(id: string): string;
}
