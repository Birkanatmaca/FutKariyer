export type Organizer = {
  id: string;
  fullName: string;
  username: string;
  email: string;
  active: boolean;
  verified: boolean;
  tournaments: number;
  createdAt: string;
};
export type OrganizerPage = {
  items: Organizer[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};
export type OrganizerForm = {
  fullName: string;
  username: string;
  email: string;
  password: string;
};
export interface OrganizerRepository {
  list(page: number): Promise<OrganizerPage>;
  create(form: OrganizerForm): Promise<Organizer>;
}
