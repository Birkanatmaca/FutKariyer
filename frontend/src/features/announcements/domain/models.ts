export type AnnouncementKind = 'opportunity';
export type AnnouncementAudience =
  | 'all'
  | 'player'
  | 'club'
  | 'coach'
  | 'account';

export type Announcement = {
  id: string;
  kind: AnnouncementKind;
  title: string;
  body: string;
  audience: AnnouncementAudience;
  targetEmail: string;
  createdAt: string;
  recipients: number;
};

export type AnnouncementDraft = {
  title: string;
  body: string;
  audience: AnnouncementAudience;
  email: string;
};

export interface AnnouncementsRepository {
  list(): Promise<Announcement[]>;
  create(draft: AnnouncementDraft): Promise<Announcement>;
}
