import { Socket } from 'socket.io';
import { log } from './logger';
import {
  DEFAULT_SESSION_ID,
  SessionArtNetConfig,
  attachSocketToSession,
  broadcastSessionsList,
  countClientsInSession,
  getArtNetConfig,
  listSessions,
  roomName,
} from './sessionManager';

export interface BridgeInfo {
  socketId: string;
  sessionId: string;
  bridgeId: string;
  version: string;
  caps: string[];
  lastSeen: number;
  latencyMs: number;
  artnetStatus: string;
  linkPeers: number;
  linkAvailable: boolean;
}

export interface BridgeClockPayload {
  bpm: number;
  beat: number;
  bar: number;
  isPlaying: boolean;
  source: string;
  linkPeers: number;
}

const bridgesBySession = new Map<string, BridgeInfo>();
const clockBySession = new Map<string, BridgeClockPayload>();
let dmxSeq = 0;
const clockStateListeners: Array<(sessionId: string, state: BridgeClockPayload) => void> = [];

export function hasActiveBridge(sessionId: string = DEFAULT_SESSION_ID): boolean {
  return bridgesBySession.has(sessionId);
}

export function getActiveBridge(sessionId: string = DEFAULT_SESSION_ID): BridgeInfo | null {
  const b = bridgesBySession.get(sessionId);
  return b ? { ...b } : null;
}

export function getBridgeClockState(sessionId: string = DEFAULT_SESSION_ID): BridgeClockPayload | null {
  const s = clockBySession.get(sessionId);
  return s ? { ...s } : null;
}

export function subscribeBridgeClock(
  listener: (sessionId: string, state: BridgeClockPayload) => void
): () => void {
  clockStateListeners.push(listener);
  return () => {
    const i = clockStateListeners.indexOf(listener);
    if (i >= 0) clockStateListeners.splice(i, 1);
  };
}

function notifyClockListeners(sessionId: string): void {
  const state = clockBySession.get(sessionId);
  if (!state) return;
  for (const l of clockStateListeners) {
    try {
      l(sessionId, state);
    } catch (err) {
      log('Bridge clock listener error', 'ERROR', { err });
    }
  }
}

function getBridgeSocket(sessionId: string): Socket | undefined {
  const bridge = bridgesBySession.get(sessionId);
  if (!bridge || !(global as any).io) return undefined;
  return (global as any).io.sockets.sockets.get(bridge.socketId);
}

function nextSeq(): number {
  dmxSeq += 1;
  return dmxSeq;
}

export function registerBridge(
  socket: Socket,
  meta: { bridgeId: string; sessionId: string; version?: string; caps?: string[] }
): void {
  const sessionId = meta.sessionId || DEFAULT_SESSION_ID;
  attachSocketToSession(socket, sessionId);

  const existing = bridgesBySession.get(sessionId);
  if (existing && existing.socketId !== socket.id) {
    log('Replacing bridge for session', 'SYSTEM', {
      sessionId,
      previous: existing.bridgeId,
      next: meta.bridgeId,
    });
  }

  const info: BridgeInfo = {
    socketId: socket.id,
    sessionId,
    bridgeId: meta.bridgeId,
    version: meta.version || 'unknown',
    caps: meta.caps || [],
    lastSeen: Date.now(),
    latencyMs: 0,
    artnetStatus: 'unknown',
    linkPeers: 0,
    linkAvailable: (meta.caps || []).includes('ableton-link'),
  };
  bridgesBySession.set(sessionId, info);
  (socket as any).data = {
    ...(socket as any).data,
    role: 'bridge',
    bridgeId: meta.bridgeId,
    sessionId,
  };
  broadcastBridgeStatus(sessionId);
  broadcastSessionsList();
  log('Bridge registered', 'SYSTEM', { bridgeId: meta.bridgeId, sessionId, socketId: socket.id });
}

export function unregisterBridge(socketId: string): void {
  for (const [sessionId, bridge] of bridgesBySession.entries()) {
    if (bridge.socketId === socketId) {
      log('Bridge disconnected', 'SYSTEM', { bridgeId: bridge.bridgeId, sessionId });
      bridgesBySession.delete(sessionId);
      clockBySession.delete(sessionId);
      broadcastBridgeStatus(sessionId);
      broadcastSessionsList();
      return;
    }
  }
}

export function updateBridgeHeartbeat(
  socketId: string,
  data: { artnetStatus?: string; linkPeers?: number }
): void {
  for (const bridge of bridgesBySession.values()) {
    if (bridge.socketId !== socketId) continue;
    bridge.lastSeen = Date.now();
    if (data.artnetStatus) bridge.artnetStatus = data.artnetStatus;
    if (typeof data.linkPeers === 'number') {
      bridge.linkPeers = data.linkPeers;
      bridge.linkAvailable = data.linkPeers >= 0;
    }
    return;
  }
}

export function setBridgeClockState(socketId: string, state: BridgeClockPayload): void {
  for (const bridge of bridgesBySession.values()) {
    if (bridge.socketId !== socketId) continue;
    clockBySession.set(bridge.sessionId, state);
    bridge.linkPeers = state.linkPeers ?? 0;
    bridge.linkAvailable = true;
    notifyClockListeners(bridge.sessionId);
    const io = (global as any).io;
    if (io) {
      io.to(roomName(bridge.sessionId)).emit('masterClockUpdate', {
        bpm: state.bpm,
        isPlaying: state.isPlaying,
        source: 'ableton-link',
        beat: state.beat,
        bar: state.bar,
        linkPeers: state.linkPeers,
        linkAvailable: true,
        sessionId: bridge.sessionId,
      });
    }
    return;
  }
}

export function fanOutDmxChannel(sessionId: string, channel: number, value: number): boolean {
  const sock = getBridgeSocket(sessionId);
  if (!sock) return false;
  sock.emit('bridge:dmx:batch', {
    updates: { [channel]: value },
    seq: nextSeq(),
    ts: Date.now(),
  });
  return true;
}

export function fanOutDmxBatch(sessionId: string, updates: Record<number, number>): boolean {
  const sock = getBridgeSocket(sessionId);
  if (!sock || Object.keys(updates).length === 0) return false;
  const payload: Record<string, number> = {};
  for (const [ch, val] of Object.entries(updates)) {
    payload[ch] = val;
  }
  sock.emit('bridge:dmx:batch', {
    updates: payload,
    seq: nextSeq(),
    ts: Date.now(),
  });
  return true;
}

export function fanOutFullUniverse(sessionId: string, channels: number[]): boolean {
  const sock = getBridgeSocket(sessionId);
  if (!sock) return false;
  sock.emit('bridge:dmx:set', {
    universe: 0,
    channels: channels.slice(0, 512),
    seq: nextSeq(),
    ts: Date.now(),
  });
  return true;
}

export function pushArtNetConfigToBridge(sessionId: string, config?: SessionArtNetConfig): void {
  const sock = getBridgeSocket(sessionId);
  if (!sock) return;
  const cfg = config || getArtNetConfig(sessionId);
  sock.emit('bridge:config:artnet', {
    ip: cfg.ip,
    port: cfg.port,
    net: cfg.net,
    subnet: cfg.subnet,
    universe: cfg.universe,
    base_refresh_interval: cfg.base_refresh_interval,
  });
  log('Pushed Art-Net config to bridge', 'SYSTEM', { sessionId, ip: cfg.ip });
}

export function requestBridgeClock(sessionId: string): void {
  getBridgeSocket(sessionId)?.emit('bridge:clock:request', { source: 'ableton-link' });
}

export function broadcastBridgeStatus(sessionId: string): void {
  const io = (global as any).io;
  if (!io) return;
  io.to(roomName(sessionId)).emit('bridge:registry', getBridgeStatusPayload(sessionId));
}

export function getBridgeStatusPayload(sessionId: string = DEFAULT_SESSION_ID) {
  const bridge = getActiveBridge(sessionId);
  return {
    sessionId,
    connected: !!bridge,
    bridge,
    clock: getBridgeClockState(sessionId),
    connectedClients: countClientsInSession(sessionId),
  };
}

export function getSessionsOverview() {
  const items = listSessions().map((s) => {
    const bridge = bridgesBySession.get(s.id);
    return {
      ...s,
      bridgeConnected: !!bridge,
      bridgeId: bridge?.bridgeId,
      clientCount: countClientsInSession(s.id),
    };
  });
  return { sessions: items, defaultSessionId: DEFAULT_SESSION_ID };
}
