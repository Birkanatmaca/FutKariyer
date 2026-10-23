import { copy } from '../../../shared/lib/copy';
import { maxMessageLength, type MessagesRepository } from '../domain/models';

export function createMessagesService(repository: MessagesRepository) {
  return {
    inbox: (token: string) => repository.inbox(token),
    thread: (token: string, partnerId: string, cursor = '') =>
      repository.thread(token, partnerId, cursor),
    send: (token: string, partnerId: string, body: string) => {
      const text = body.trim();
      if (!text || Array.from(text).length > maxMessageLength)
        throw new Error(copy.messages.lengthError);
      return repository.send(token, partnerId, text);
    },
    markRead: (token: string, partnerId: string) =>
      repository.markRead(token, partnerId),
  };
}
export type MessagesService = ReturnType<typeof createMessagesService>;
