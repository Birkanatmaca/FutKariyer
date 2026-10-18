import type { AccountRole } from '../../auth';
import type {
  FootballType,
  LicenseStatus,
} from '../../../shared/domain/football';

export const maxPostLength = 500;
export const maxImageBytes = 4 * 1024 * 1024;
export const maxVideoBytes = 30 * 1024 * 1024;
export type FeedScope = 'explore' | 'following';
// Profile post lists: every post, or only the media posts shown on the profile.
export type UserPostsFilter = 'all' | 'media';
import type {
  MediaKind,
  MediaSource,
  SelectedMedia,
} from '../../../shared/domain/media';
export type {
  MediaKind,
  MediaSource,
  SelectedMedia,
} from '../../../shared/domain/media';
export type SocialMedia = {
  kind: MediaKind;
  mime: string;
  size: number;
  width: number;
  height: number;
};

export type SocialAuthor = {
  id: string;
  fullName: string;
  role: AccountRole;
  verified: boolean;
  isPro?: boolean;
  following: boolean;
  footballType?: FootballType;
  licenseStatus?: LicenseStatus;
};
export type SocialPost = {
  id: string;
  author: SocialAuthor;
  body: string;
  createdAt: string;
  media: SocialMedia | null;
  likeCount: number;
  replyCount: number;
  liked: boolean;
  owned: boolean;
  // A media post the author also lists in their profile gallery tabs.
  showOnProfile?: boolean;
};
export type SocialReply = {
  id: string;
  postId: string;
  author: SocialAuthor;
  body: string;
  createdAt: string;
  owned: boolean;
};
export type SocialPage<T> = { items: T[]; nextCursor: string };
export interface SocialRepository {
  feed(
    token: string,
    cursor: string,
    scope: FeedScope,
  ): Promise<SocialPage<SocialPost>>;
  post(token: string, id: string): Promise<SocialPost>;
  userPosts(
    token: string,
    userId: string,
    cursor: string,
    filter: UserPostsFilter,
  ): Promise<SocialPage<SocialPost>>;
  createPost(
    token: string,
    body: string,
    media?: SelectedMedia,
    showOnProfile?: boolean,
  ): Promise<SocialPost>;
  follow(token: string, id: string, following: boolean): Promise<boolean>;
  pickMedia(kind: MediaKind): Promise<SelectedMedia | null>;
  releaseMedia(media: SelectedMedia): void;
  mediaSource(token: string, id: string): Promise<MediaSource>;
  deletePost(token: string, id: string): Promise<void>;
  like(token: string, id: string, liked: boolean): Promise<SocialPost>;
  replies(
    token: string,
    id: string,
    cursor: string,
  ): Promise<SocialPage<SocialReply>>;
  createReply(token: string, id: string, body: string): Promise<SocialReply>;
  deleteReply(token: string, postId: string, id: string): Promise<void>;
}
