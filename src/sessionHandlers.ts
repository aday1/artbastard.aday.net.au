import { Server, Socket } from 'socket.io';
import {
  DEFAULT_SESSION_ID,
  attachSocketToSession,
  broadcastSessionsList,
  createSession,
  ensureSession,
  emitDmxStateRestored,
  getDmxChannels,
  getSession,
  getSocketSessionId,
} from './sessionManager';
import { broadcastBridgeStatus, getBridgeStatusPayload, getSessionsOverview } from './bridgeRegistry';
import { log } from './logger';

export function resolveClientSessionId(
  auth: { sessionId?: string } | undefined,
  fallback: string = DEFAULT_SESSION_ID
): string {
  const raw = auth?.sessionId;
  if (typeof raw === 'string' && raw.trim()) {
    return raw.trim().slice(0, 64);
  }
  return fallback;
}

export function attachClientSessionHandlers(io: Server, socket: Socket): void {
  const initialSessionId = resolveClientSessionId(socket.handshake.auth as { sessionId?: string });
  ensureSession(initialSessionId);
  attachSocketToSession(socket, initialSessionId);

  socket.emit('session:joined', {
    sessionId: initialSessionId,
    session: getSession(initialSessionId),
    dmxChannels: getDmxChannels(initialSessionId),
  });
  socket.emit('bridge:registry', getBridgeStatusPayload(initialSessionId));
  socket.emit('sessions:list', getSessionsOverview());

  socket.on('session:join', (payload: { sessionId?: string } | string) => {
    const sessionId =
      typeof payload === 'string'
        ? payload
        : payload?.sessionId;
    if (!sessionId || typeof sessionId !== 'string') {
      socket.emit('session:error', { message: 'sessionId required' });
      return;
    }
    const sid = sessionId.trim().slice(0, 64);
    ensureSession(sid);
    attachSocketToSession(socket, sid);
    socket.emit('session:joined', {
      sessionId: sid,
      session: getSession(sid),
      dmxChannels: getDmxChannels(sid),
    });
    socket.emit('bridge:registry', getBridgeStatusPayload(sid));
    broadcastSessionsList();
    log('Client switched session', 'SYSTEM', { socketId: socket.id, sessionId: sid });
  });

  socket.on('session:create', (payload: { name?: string }) => {
    const name = typeof payload?.name === 'string' ? payload.name : 'New session';
    const session = createSession(name);
    attachSocketToSession(socket, session.id);
    socket.emit('session:created', { session });
    socket.emit('session:joined', {
      sessionId: session.id,
      session,
      dmxChannels: getDmxChannels(session.id),
    });
    broadcastSessionsList();
    log('Session created via socket', 'SYSTEM', { sessionId: session.id, name: session.name });
  });

  socket.on('sessions:list', () => {
    socket.emit('sessions:list', getSessionsOverview());
  });
}

export function onClientDisconnect(socket: Socket): void {
  broadcastSessionsList();
  const sessionId = getSocketSessionId(socket);
  broadcastBridgeStatus(sessionId);
}

export function emitSessionDmxToSocket(socket: Socket, sessionId?: string): void {
  const sid = sessionId || getSocketSessionId(socket);
  emitDmxStateRestored(sid, getDmxChannels(sid));
}
