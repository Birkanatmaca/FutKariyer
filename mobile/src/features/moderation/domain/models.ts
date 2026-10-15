// Reporting and blocking. Reports go to the administrator review queue;
// a block hides both accounts from each other's feed, replies and discovery.
export type ReportTargetKind = 'post' | 'reply' | 'user';
export const reportReasons = [
  'spam',
  'harassment',
  'inappropriate',
  'impersonation',
  'other',
] as const;
export type ReportReason = (typeof reportReasons)[number];
export const reportNoteLimit = 500;

// What the person opened the menu on; userId/name identify the author.
export type ModerationTarget = {
  kind: ReportTargetKind;
  id: string;
  userId: string;
  name: string;
};
export type BlockedUser = {
  id: string;
  fullName: string;
  role: 'player' | 'club' | 'coach' | 'organizer';
  createdAt: string;
};

export interface ModerationRepository {
  report(
    token: string,
    input: {
      targetKind: ReportTargetKind;
      targetId: string;
      reason: ReportReason;
      note: string;
    },
  ): Promise<void>;
  block(token: string, userId: string): Promise<void>;
  unblock(token: string, userId: string): Promise<void>;
  blocks(token: string): Promise<BlockedUser[]>;
}
