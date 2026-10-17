import { copy } from '../../../shared/lib/copy';
import type {
  RatingRepository,
  RatingTask,
  SeasonDraft,
} from '../domain/models';

export const ratingLimits = {
  titleMin: 2,
  titleMax: 80,
  descriptionMax: 500,
  prizeMax: 120,
  maxDays: 92,
  targetMax: 100,
  pointsMax: 1000,
} as const;

export function normalizeSeasonDraft(draft: SeasonDraft): SeasonDraft {
  return {
    ...draft,
    title: draft.title.trim(),
    description: draft.description.trim(),
    prizes: draft.prizes
      .map(prize => ({ place: prize.place, title: prize.title.trim() }))
      .filter(prize => prize.title),
  };
}

export function validateSeasonDraft(draft: SeasonDraft) {
  const fields: Record<string, string> = {};
  const text = copy.rating.errors;
  if (
    draft.title.length < ratingLimits.titleMin ||
    draft.title.length > ratingLimits.titleMax
  )
    fields.title = text.title;
  if (draft.description.length > ratingLimits.descriptionMax)
    fields.description = text.description;
  const start = Date.parse(draft.startsAt);
  const end = Date.parse(draft.endsAt);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start)
    fields.endsAt = text.dates;
  else if (end - start > ratingLimits.maxDays * 86400000)
    fields.endsAt = text.length;
  if (draft.prizes.some(prize => prize.title.length > ratingLimits.prizeMax))
    fields.prizes = text.prize;
  return fields;
}

export function validateTask(task: RatingTask) {
  const fields: Record<string, string> = {};
  if (
    !Number.isInteger(task.target) ||
    task.target < 1 ||
    task.target > ratingLimits.targetMax
  )
    fields.target = copy.rating.errors.target;
  if (
    !Number.isInteger(task.points) ||
    task.points < 1 ||
    task.points > ratingLimits.pointsMax
  )
    fields.points = copy.rating.errors.points;
  return fields;
}

export function createRatingService(repository: RatingRepository) {
  return {
    seasons: () => repository.seasons(),
    create: (draft: SeasonDraft) =>
      repository.create(normalizeSeasonDraft(draft)),
    update: (id: string, draft: SeasonDraft) =>
      repository.update(id, normalizeSeasonDraft(draft)),
    remove: (id: string) => repository.remove(id),
    leaderboard: (id: string) => repository.leaderboard(id),
    tasks: () => repository.tasks(),
    updateTask: (task: RatingTask) => repository.updateTask(task),
  };
}
export type RatingService = ReturnType<typeof createRatingService>;
