// A photo or video picked on the device and a playable/viewable remote source.
// Shared by social posts and the player profile gallery.
export type MediaKind = 'image' | 'video';
export type SelectedMedia = {
  kind: MediaKind;
  uri: string;
  name: string;
  mime: string;
  size: number;
};
export type MediaSource = {
  uri: string;
  headers?: Record<string, string>;
  dispose?(): void;
};
