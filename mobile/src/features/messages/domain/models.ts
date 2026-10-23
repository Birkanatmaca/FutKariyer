import type { AccountRole } from '../../auth';

// One-to-one messages (23 Oct 2026): accepted connections, and a club with
// its squad players, can write to each other.
export const maxMessageLength = 1000;

export type MessagePartner = {
  id: string;
  fullName: string;
  role: AccountRole;
  verified: boolean;
  avatarVersion: number;
};
export type ChatMessage = {
  id: string;
  body: string;
  mine: boolean;
  createdAt: string;
};
export type Conversation = {
  partner: MessagePartner;
  lastMessage: ChatMessage | null;
  updatedAt: string;
  unread: number;
  canSend: boolean;
};
export type Inbox = { items: Conversation[]; unread: number };
export type Thread = {
  partner: MessagePartner;
  canSend: boolean;
  items: ChatMessage[];
  nextCursor: string;
  partnerReadAt: string | null;
};

export interface MessagesRepository {
  inbox(token: string): Promise<Inbox>;
  thread(token: string, partnerId: string, cursor: string): Promise<Thread>;
  send(token: string, partnerId: string, body: string): Promise<ChatMessage>;
  markRead(token: string, partnerId: string): Promise<void>;
}
