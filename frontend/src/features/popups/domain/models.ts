// Popup ads (19 Oct 2026): one image over the app when it opens. The server
// takes the format from the image's exact size and rejects any other size.
export type PopupFormat = 'square' | 'portrait' | 'story';
export const popupSizes: Record<
  PopupFormat,
  { width: number; height: number }
> = {
  square: { width: 1080, height: 1080 },
  portrait: { width: 1080, height: 1350 },
  story: { width: 1080, height: 1920 },
};
export const popupFormats = Object.keys(popupSizes) as PopupFormat[];
export function formatForSize(width: number, height: number) {
  return (
    popupFormats.find(
      format =>
        popupSizes[format].width === width &&
        popupSizes[format].height === height,
    ) ?? null
  );
}
// Minutes between two showings to one account, and the most showings.
export const popupLimits = {
  interval: { min: 1, max: 43200 },
  views: { min: 1, max: 100 },
};
export type Popup = {
  id: string;
  title: string;
  imageId: string;
  format: PopupFormat;
  active: boolean;
  intervalMinutes: number;
  maxViews: number;
  // When the popup may be shown; null leaves that side open.
  startsAt: string | null;
  endsAt: string | null;
  views: number;
  viewers: number;
  createdAt: string;
  updatedAt: string;
};
export type PopupPage = {
  items: Popup[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};
export type PopupForm = {
  title: string;
  imageId: string;
  active: boolean;
  intervalMinutes: number;
  maxViews: number;
  startsAt: string | null;
  endsAt: string | null;
};
export interface PopupRepository {
  list(page: number): Promise<PopupPage>;
  listAll(): Promise<Popup[]>;
  save(form: PopupForm, id?: string): Promise<Popup>;
  remove(id: string): Promise<void>;
}
// Image upload and preview come from the content feature's image store.
export interface PopupImages {
  upload(file: File): Promise<string>;
  imageUrl(id: string): string;
}
