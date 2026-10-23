import { ApiError, request } from '../../../shared/api/client';
import { copy } from '../../../shared/lib/copy';
import type {
  ChatMessage,
  Conversation,
  Inbox,
  MessagePartner,
  MessagesRepository,
  Thread,
} from '../domain/models';

const idValid = (value: unknown) =>
  typeof value === 'string' && /^[a-f0-9]{32}$/.test(value);
const dateValid = (value: unknown) =>
  typeof value === 'string' && Number.isFinite(Date.parse(value));
const countValid = (value: unknown) =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;

function partnerValid(value: unknown): value is MessagePartner {
  const p = value as MessagePartner;
  return (
    !!p &&
    idValid(p.id) &&
    typeof p.fullName === 'string' &&
    ['player', 'club', 'coach', 'organizer'].includes(p.role) &&
    typeof p.verified === 'boolean' &&
    countValid(p.avatarVersion)
  );
}
function messageValid(value: unknown): value is ChatMessage {
  const m = value as ChatMessage;
  return (
    !!m &&
    idValid(m.id) &&
    typeof m.body === 'string' &&
    typeof m.mine === 'boolean' &&
    dateValid(m.createdAt)
  );
}
function conversationValid(value: unknown): value is Conversation {
  const c = value as Conversation;
  return (
    !!c &&
    partnerValid(c.partner) &&
    (c.lastMessage === null || messageValid(c.lastMessage)) &&
    dateValid(c.updatedAt) &&
    countValid(c.unread) &&
    typeof c.canSend === 'boolean'
  );
}
function invalid(): never {
  throw new ApiError(copy.form.unexpected);
}
const path = (partnerId: string) =>
  '/v1/me/conversations/' + encodeURIComponent(partnerId);

export const messagesRepository: MessagesRepository = {
  async inbox(token) {
    const result = await request<Inbox>('/v1/me/conversations', { token });
    if (
      !result ||
      !Array.isArray(result.items) ||
      !result.items.every(conversationValid) ||
      !countValid(result.unread)
    )
      invalid();
    return result;
  },
  async thread(token, partnerId, cursor) {
    const result = await request<Thread>(
      path(partnerId) + '/messages?cursor=' + encodeURIComponent(cursor),
      { token },
    );
    if (
      !result ||
      !partnerValid(result.partner) ||
      typeof result.canSend !== 'boolean' ||
      !Array.isArray(result.items) ||
      !result.items.every(messageValid) ||
      typeof result.nextCursor !== 'string' ||
      !(result.partnerReadAt === null || dateValid(result.partnerReadAt))
    )
      invalid();
    return result;
  },
  async send(token, partnerId, body) {
    const result = await request<{ message: unknown }>(
      path(partnerId) + '/messages',
      { method: 'POST', token, body: { body } },
    );
    if (!result || !messageValid(result.message)) invalid();
    return result.message;
  },
  async markRead(token, partnerId) {
    await request<void>(path(partnerId) + '/read', { method: 'PUT', token });
  },
};
