import { ApiError, request } from '../../../shared/api/client';
import { copy } from '../../../shared/lib/copy';
import type {
  Connection,
  ConnectionInbox,
  ConnectionState,
  ConnectionWith,
  ConnectionsRepository,
} from '../domain/models';

const statuses = ['pending', 'accepted', 'declined', 'cancelled'];
const directions = ['incoming', 'outgoing'];
const roles = ['player', 'club', 'coach'];
const states: ConnectionState[] = ['none', 'outgoing', 'incoming', 'connected'];

const connectionId = (v: unknown) =>
  typeof v === 'string' && /^[a-f0-9]{32}$/.test(v);
const text = (v: unknown) => typeof v === 'string';
const date = (v: unknown) =>
  typeof v === 'string' && Number.isFinite(Date.parse(v));

function party(v: unknown) {
  const p = v as Connection['other'];
  return (
    !!p &&
    typeof p.id === 'string' &&
    !!p.id &&
    typeof p.name === 'string' &&
    roles.includes(p.role) &&
    typeof p.verified === 'boolean' &&
    text(p.district)
  );
}

function contact(c: Connection) {
  if (c.status !== 'accepted') return c.contact === null;
  return (
    !!c.contact &&
    typeof c.contact.email === 'string' &&
    // Club accounts may have no email; an empty address is valid.
    (c.contact.email === '' || c.contact.email.includes('@'))
  );
}

export function isConnection(v: unknown): v is Connection {
  const c = v as Connection;
  return (
    !!c &&
    connectionId(c.id) &&
    statuses.includes(c.status) &&
    directions.includes(c.direction) &&
    text(c.message) &&
    date(c.createdAt) &&
    (c.respondedAt === null || date(c.respondedAt)) &&
    party(c.other) &&
    contact(c)
  );
}

const list = (
  v: unknown,
  match: (c: Connection) => boolean,
): v is Connection[] =>
  Array.isArray(v) && v.every(c => isConnection(c) && match(c));

function inbox(v: unknown): ConnectionInbox {
  const body = v as ConnectionInbox;
  if (
    !body ||
    !list(
      body.incoming,
      c => c.status === 'pending' && c.direction === 'incoming',
    ) ||
    !list(
      body.outgoing,
      c => c.status === 'pending' && c.direction === 'outgoing',
    ) ||
    !list(body.accepted, c => c.status === 'accepted')
  )
    throw new ApiError(copy.form.unexpected);
  return {
    incoming: body.incoming,
    outgoing: body.outgoing,
    accepted: body.accepted,
  };
}

function single(v: unknown): Connection {
  const body = v as { connection: unknown };
  if (!body || !isConnection(body.connection))
    throw new ApiError(copy.form.unexpected);
  return body.connection;
}

function withState(v: unknown): ConnectionWith {
  const body = v as ConnectionWith;
  if (
    !body ||
    !states.includes(body.state) ||
    (body.state === 'none'
      ? body.connectionId !== ''
      : !connectionId(body.connectionId))
  )
    throw new ApiError(copy.form.unexpected);
  return { state: body.state, connectionId: body.connectionId };
}

const path = '/v1/connections';

export const connectionsRepository: ConnectionsRepository = {
  async list(token) {
    return inbox(await request<unknown>(path, { token }));
  },
  async send(token, recipientId, message) {
    const connection = single(
      await request<unknown>(path, {
        token,
        method: 'POST',
        body: { recipientId, message },
      }),
    );
    if (connection.direction !== 'outgoing' || connection.status !== 'pending')
      throw new ApiError(copy.form.unexpected);
    return connection;
  },
  async respond(token, id, action) {
    return single(
      await request<unknown>(path + '/' + encodeURIComponent(id), {
        token,
        method: 'PUT',
        body: { action },
      }),
    );
  },
  async with(token, userId) {
    return withState(
      await request<unknown>(path + '/with/' + encodeURIComponent(userId), {
        token,
      }),
    );
  },
};
