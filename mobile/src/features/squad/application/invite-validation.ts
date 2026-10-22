import { copy } from '../../../shared/lib/copy';
import { squadInviteLimits } from '../domain/models';

const length = (value: string) => Array.from(value.trim()).length;

// Player search starts at two letters, as the server requires.
export function isInviteSearch(value: string) {
  const count = length(value);
  return (
    count >= squadInviteLimits.search.min &&
    count <= squadInviteLimits.search.max
  );
}

// Returns the error for a too long invitation message, or ''.
export function inviteMessageError(message: string) {
  return length(message) > squadInviteLimits.message
    ? copy.squad.tooLong(squadInviteLimits.message)
    : '';
}
