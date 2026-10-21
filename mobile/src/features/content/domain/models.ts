import {
  popupFormats,
  type PopupFormat,
} from '../../../shared/domain/popup-ads';
// Home advertisements are image-only: the server supplies just the picture,
// shown in one fixed-size rectangle. Titles stay an admin-side label.
// displaySeconds is how long the admin wants each item on screen in the
// rotating slot (3–30); older servers omit it and the slot's default applies.
export type Advertisement = {
  id: string;
  imageId: string;
  displaySeconds?: number;
};
export function displayMs(
  item: { displaySeconds?: number } | undefined,
  fallback: number,
) {
  const seconds = item?.displaySeconds;
  return typeof seconds === 'number' &&
    Number.isInteger(seconds) &&
    seconds >= 3 &&
    seconds <= 30
    ? seconds * 1000
    : fallback;
}
// Single source for the ad slot size; admins upload images at this ratio.
export const advertisementImage = { width: 1200, height: 600 } as const;
export const advertisementAspectRatio =
  advertisementImage.width / advertisementImage.height;
export type Article = {
  id: string;
  title: string;
  summary: string;
  body: string;
  imageId: string;
  published: boolean;
  showOnHome: boolean;
  displaySeconds?: number;
  createdAt: string;
  updatedAt: string;
};
export { popupFormats, type PopupFormat };
export type HomeContent = { advertisements: Advertisement[]; news: Article[] };
// Popup ads (19 Oct 2026) open over the app at launch; the formats and their
// image sizes are shared with the admin screens.
export type PopupAd = { id: string; imageId: string; format: PopupFormat };
export type NewsPage = {
  items: Article[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};
export interface ContentRepository {
  home(token: string): Promise<HomeContent>;
  news(token: string, page: number): Promise<NewsPage>;
  article(token: string, id: string): Promise<Article>;
  // The popup due for this account now, or null; the server keeps count.
  popup(token: string): Promise<PopupAd | null>;
  popupViewed(token: string, id: string): Promise<void>;
  imageUrl(id: string): string;
}
