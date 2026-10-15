export type ContentSection = 'ads' | 'news';
export type Advertisement = {
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
export type Article = {
  id: string;
  title: string;
  summary: string;
  body: string;
  imageId: string;
  published: boolean;
  showOnHome: boolean;
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
export type ContentForm = {
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
  save(section: ContentSection, form: ContentForm, id?: string): Promise<void>;
  remove(section: ContentSection, id: string): Promise<void>;
  review(id: string, decision: ReviewDecision): Promise<void>;
  pendingReviews(): Promise<Article[]>;
  upload(file: File): Promise<string>;
  imageUrl(id: string): string;
}
