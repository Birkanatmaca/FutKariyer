import { ApiError } from '../../../shared/api/client';
import { copy } from '../../../shared/lib/copy';
import {
  connectionMessageLimit,
  messageLength,
  type ConnectionAction,
  type ConnectionsRepository,
} from '../domain/models';

export const actionNotices: Record<ConnectionAction, string> = {
  accept: copy.connections.acceptedNotice,
  decline: copy.connections.declinedNotice,
  cancel: copy.connections.cancelledNotice,
};

export function createConnectionsService(repository: ConnectionsRepository) {
  return {
    list: (token: string) => repository.list(token),
    with: (token: string, userId: string) => repository.with(token, userId),
    respond: (token: string, id: string, action: ConnectionAction) =>
      repository.respond(token, id, action),
    send(token: string, recipientId: string, message: string) {
      const value = message.trim();
      if (messageLength(value) > connectionMessageLimit)
        return Promise.reject(
          new ApiError(copy.connections.messageTooLong, 422, {
            message: copy.connections.messageTooLong,
          }),
        );
      return repository.send(token, recipientId, value);
    },
  };
}
export type ConnectionsService = ReturnType<typeof createConnectionsService>;
