import {
  reportNoteLimit,
  type ModerationRepository,
  type ModerationTarget,
  type ReportReason,
} from '../domain/models';

const idPattern = /^[a-f0-9]{32}$/;

export function createModerationService(repository: ModerationRepository) {
  return {
    report(
      token: string,
      target: ModerationTarget,
      reason: ReportReason,
      note: string,
    ) {
      const trimmed = note.trim();
      if (!idPattern.test(target.id) || trimmed.length > reportNoteLimit)
        return Promise.reject(new Error('invalid report'));
      return repository.report(token, {
        targetKind: target.kind,
        targetId: target.id,
        reason,
        note: trimmed,
      });
    },
    block: (token: string, userId: string) => repository.block(token, userId),
    unblock: (token: string, userId: string) =>
      repository.unblock(token, userId),
    blocks: (token: string) => repository.blocks(token),
  };
}
export type ModerationService = ReturnType<typeof createModerationService>;
