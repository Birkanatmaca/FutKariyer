export type ConnectionRole = 'player' | 'club' | 'coach';
export type ConnectionStatus =
  | 'pending'
  | 'accepted'
  | 'declined'
  | 'cancelled';
export type ConnectionDirection = 'incoming' | 'outgoing';
export type ConnectionAction = 'accept' | 'decline' | 'cancel';
export type ConnectionState = 'none' | 'outgoing' | 'incoming' | 'connected';

export const connectionMessageLimit = 300;

export type ConnectionParty = {
  id: string;
  name: string;
  role: ConnectionRole;
  verified: boolean;
  district: string;
};

export type Connection = {
  id: string;
  status: ConnectionStatus;
  direction: ConnectionDirection;
  message: string;
  createdAt: string;
  respondedAt: string | null;
  other: ConnectionParty;
  // Only an accepted connection reveals the other party's email.
  contact: { email: string } | null;
};

export type ConnectionInbox = {
  incoming: Connection[];
  outgoing: Connection[];
  accepted: Connection[];
};

export type ConnectionWith = { state: ConnectionState; connectionId: string };

export type ConnectionViewer = { role: ConnectionRole; verified: boolean };

export interface ConnectionsRepository {
  list(token: string): Promise<ConnectionInbox>;
  send(
    token: string,
    recipientId: string,
    message: string,
  ): Promise<Connection>;
  respond(
    token: string,
    id: string,
    action: ConnectionAction,
  ): Promise<Connection>;
  with(token: string, userId: string): Promise<ConnectionWith>;
}

// Players reach clubs and coaches; verified clubs and coaches reach players.
// The server stays the authority; this only decides whether to offer the action.
export function canRequestConnection(
  viewer: ConnectionViewer,
  profileRole: ConnectionRole,
) {
  if (viewer.role === 'player')
    return profileRole === 'club' || profileRole === 'coach';
  return viewer.verified && profileRole === 'player';
}

// The server counts characters (runes), not UTF-16 units.
export function messageLength(message: string) {
  return Array.from(message).length;
}
