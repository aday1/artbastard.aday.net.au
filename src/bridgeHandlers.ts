import { Server, Socket } from 'socket.io';
import { verifyBridgeToken } from './bridgeAuth';
import {
  registerBridge,
  unregisterBridge,
  updateBridgeHeartbeat,
  setBridgeClockState,
  getBridgeStatusPayload,
  pushArtNetConfigToBridge,
  broadcastBridgeStatus,
} from './bridgeRegistry';
import { ensureSession, getArtNetConfig } from './sessionManager';
import { log } from './logger';

export function registerBridgeSocketMiddleware(io: Server): void {
  io.use((socket, next) => {
    const auth = socket.handshake.auth as { token?: string; role?: string; sessionId?: string };
    if (auth?.role === 'bridge') {
      const payload = verifyBridgeToken(auth.token || '');
      if (!payload) {
        return next(new Error('Invalid bridge token'));
      }
      ensureSession(payload.sessionId);
      (socket as any).data = {
        role: 'bridge',
        bridgeId: payload.bridgeId,
        sessionId: payload.sessionId,
      };
      return next();
    }
    (socket as any).data = { role: 'client' };
    next();
  });
}

export function attachBridgeSocketHandlers(io: Server, socket: Socket): void {
  const role = (socket as any).data?.role;
  if (role !== 'bridge') return;

  const bridgeId = (socket as any).data?.bridgeId as string;
  const sessionId = (socket as any).data?.sessionId as string;

  socket.on('bridge:hello', (payload: { bridgeId?: string; version?: string; caps?: string[]; sessionId?: string }) => {
    const sid = payload?.sessionId || sessionId;
    ensureSession(sid);
    registerBridge(socket, {
      bridgeId: payload?.bridgeId || bridgeId,
      sessionId: sid,
      version: payload?.version,
      caps: payload?.caps,
    });
    pushArtNetConfigToBridge(sid, getArtNetConfig(sid));
    socket.emit('bridge:paired', { ok: true, bridgeId: payload?.bridgeId || bridgeId, sessionId: sid });
    broadcastBridgeStatus(sid);
  });

  socket.on('bridge:heartbeat', (payload: { artnetStatus?: string; linkPeers?: number }) => {
    updateBridgeHeartbeat(socket.id, payload || {});
  });

  socket.on('bridge:clock:state', (state) => {
    if (!state || typeof state.bpm !== 'number') return;
    setBridgeClockState(socket.id, {
      bpm: state.bpm,
      beat: state.beat ?? 1,
      bar: state.bar ?? 1,
      isPlaying: !!state.isPlaying,
      source: state.source || 'ableton-link',
      linkPeers: state.linkPeers ?? 0,
    });
  });

  socket.on('bridge:status', () => {
    broadcastBridgeStatus(sessionId);
  });

  socket.on('disconnect', () => {
    unregisterBridge(socket.id);
  });
}
