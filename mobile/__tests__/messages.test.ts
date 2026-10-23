import { request } from '../src/shared/api/client';
import { messagesRepository } from '../src/features/messages/data/http-messages-repository';
import { createMessagesService } from '../src/features/messages/application/messages-service';

jest.mock('../src/shared/api/client', () => ({
  ...jest.requireActual('../src/shared/api/client'),
  request: jest.fn(),
}));

const id = 'a'.repeat(32);
const partner = {
  id,
  fullName: 'Barışspor',
  role: 'club',
  verified: true,
  avatarVersion: 0,
};
const message = {
  id: 'b'.repeat(32),
  body: 'Antrenman 20:00',
  mine: false,
  createdAt: '2026-10-23T10:00:00Z',
};
const service = createMessagesService(messagesRepository);
beforeEach(() => jest.clearAllMocks());

test('the inbox and a thread are validated at the API boundary', async () => {
  (request as jest.Mock).mockResolvedValueOnce({
    items: [
      {
        partner,
        lastMessage: message,
        updatedAt: message.createdAt,
        unread: 1,
        canSend: true,
      },
    ],
    unread: 1,
  });
  await expect(service.inbox('t')).resolves.toMatchObject({ unread: 1 });
  (request as jest.Mock).mockResolvedValueOnce({
    partner,
    canSend: false,
    items: [message],
    nextCursor: '',
    partnerReadAt: null,
  });
  await expect(service.thread('t', id)).resolves.toMatchObject({
    canSend: false,
  });
  expect(request).toHaveBeenLastCalledWith(
    '/v1/me/conversations/' + id + '/messages?cursor=',
    { token: 't' },
  );
  (request as jest.Mock).mockResolvedValueOnce({ items: [{ partner }] });
  await expect(service.inbox('t')).rejects.toThrow();
});

test('messages are trimmed and limited before sending', async () => {
  expect(() => service.send('t', id, '   ')).toThrow();
  expect(() => service.send('t', id, 'x'.repeat(1001))).toThrow();
  (request as jest.Mock).mockResolvedValueOnce({
    message: { ...message, mine: true },
  });
  await service.send('t', id, '  Merhaba  ');
  expect(request).toHaveBeenCalledWith(
    '/v1/me/conversations/' + id + '/messages',
    { method: 'POST', token: 't', body: { body: 'Merhaba' } },
  );
});
