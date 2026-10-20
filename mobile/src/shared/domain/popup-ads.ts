// Popup ads (19 Oct 2026): the admin's image size decides the format, and the
// server accepts only these sizes.
export type PopupFormat = 'square' | 'portrait' | 'story';
export const popupFormats: Record<
  PopupFormat,
  { width: number; height: number }
> = {
  square: { width: 1080, height: 1080 },
  portrait: { width: 1080, height: 1350 },
  story: { width: 1080, height: 1920 },
};
