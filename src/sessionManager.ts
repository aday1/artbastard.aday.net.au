import { Server, Socket } from 'socket.io';
import { log } from './logger';

export const DEFAULT_SESSION_ID = 'default';

export interface SessionArtNetConfig {
  ip: string;
  port: number;
  net: number;
  subnet: number;
  universe: number;
  base_refresh_interval: number;
}

export interface SessionRecord {
  id: string;
  name: string;
  createdAt: string;
  dmxChannels: number[];
  artNetConfig: SessionArtNetConfig;
}

export interface SessionListItem {
  id: string;
  name: string;
  createdAt: string;
  clientCount: number;
  bridgeConnected: boolean;
  bridgeId?: string;
}

const sessions = new Map<string, SessionRecord>();

const DEFAULT_ARTNET: SessionArtNetConfig = {
  ip: '192.168.1.199',
  port: 6454,
  net: 0,
  subnet: 0,
  universe: 0,
  base_refresh_interval: 1000,
};

function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return base || 'session';
}

function uniqueId(base: string): string {
  let id = base;
  let n = 2;
  while (sessions.has(id)) {
    id = `${base}-${n}`;
    n++;
  }
  return id;
}

export function initSessions(): void {
  if (!sessions.has(DEFAULT_SESSION_ID)) {
    sessions.set(DEFAULT_SESSION_ID, {
      id: DEFAULT_SESSION_ID,
      name: 'Default',
      createdAt: new Date().toISOString(),
      dmxChannels: new Array(512).fill(0),
      artNetConfig: { ...DEFAULT_ARTNET },
    });
  }
}

export function ensureSession(sessionId: string, name?: string): SessionRecord {
  initSessions();
  let session = sessions.get(sessionId);
  if (!session) {
    session = {
      id: sessionId,
      name: name || sessionId,
      createdAt: new Date().toISOString(),
      dmxChannels: new Array(512).fill(0),
      artNetConfig: { ...DEFAULT_ARTNET },
    };
    sessions.set(sessionId, session);
  }
  return session;
}

export function createSession(name: string): SessionRecord {
  initSessions();
  const id = uniqueId(slugify(name));
  const session: SessionRecord = {
    id,
    name: name.trim() || id,
    createdAt: new Date().toISOString(),
    dmxChannels: new Array(512).fill(0),
    artNetConfig: { ...DEFAULT_ARTNET },
  };
  sessions.set(id, session);
  log('Session created', 'SYSTEM', { sessionId: id, name: session.name });
  return session;
}

export function listSessions(): SessionListItem[] {
  initSessions();
  const io = (global as any).io as Server | undefined;
  return Array.from(sessions.values()).map((s) => ({
    id: s.id,
    name: s.name,
    createdAt: s.createdAt,
    clientCount: io ? countClientsInSession(s.id) : 0,
    bridgeConnected: false,
    bridgeId: undefined,
  }));
}

export function getSession(sessionId: string): SessionRecord | null {
  initSessions();
  return sessions.get(sessionId) || null;
}

export function getDmxChannels(sessionId: string): number[] {
  return ensureSession(sessionId).dmxChannels;
}

export function getArtNetConfig(sessionId: string): SessionArtNetConfig {
  return ensureSession(sessionId).artNetConfig;
}

export function setArtNetConfig(sessionId: string, partial: Partial<SessionArtNetConfig>): SessionArtNetConfig {
  const session = ensureSession(sessionId);
  session.artNetConfig = { ...session.artNetConfig, ...partial };
  return session.artNetConfig;
}

export function setDmxChannels(sessionId: string, channels: number[]): void {
  const session = ensureSession(sessionId);
  for (let i = 0; i < 512 && i < channels.length; i++) {
    session.dmxChannels[i] = Math.max(0, Math.min(255, channels[i] || 0));
  }
}

export function roomName(sessionId: string): string {
  return `session:${sessionId}`;
}

export function countClientsInSession(sessionId: string): number {
  const io = (global as any).io as Server | undefined;
  if (!io) return 0;
  const room = io.sockets.adapter.rooms.get(roomName(sessionId));
  if (!room) return 0;
  let count = 0;
  for (const socketId of room) {
    const sock = io.sockets.sockets.get(socketId);
    if (sock && (sock as any).data?.role !== 'bridge') count++;
  }
  return count;
}

export function attachSocketToSession(socket: Socket, sessionId: string): SessionRecord {
  const session = ensureSession(sessionId);
  const prev = (socket as any).data?.sessionId as string | undefined;
  if (prev && prev !== sessionId) {
    socket.leave(roomName(prev));
  }
  (socket as any).data = {
    ...(socket as any).data,
    sessionId,
  };
  socket.join(roomName(sessionId));
  log('Socket joined session', 'SYSTEM', { socketId: socket.id, sessionId, role: (socket as any).data?.role });
  return session;
}

export function getSocketSessionId(socket: Socket): string {
  return ((socket as any).data?.sessionId as string) || DEFAULT_SESSION_ID;
}

export function emitDmxUpdate(sessionId: string, channel: number, value: number, io?: Server): void {
  const broadcastIo = io || ((global as any).io as Server | undefined);
  if (!broadcastIo) return;
  broadcastIo.to(roomName(sessionId)).emit('dmxUpdate', { channel, value, sessionId });
}

export function emitDmxStateRestored(sessionId: string, dmxChannels: number[], io?: Server): void {
  const broadcastIo = io || ((global as any).io as Server | undefined);
  if (!broadcastIo) return;
  broadcastIo.to(roomName(sessionId)).emit('dmxStateRestored', { dmxChannels, sessionId });
}

export function broadcastSessionsList(): void {
  const io = (global as any).io as Server | undefined;
  if (!io) return;
  // Enriched list (bridge counts) is sent from bridgeRegistry.getSessionsOverview via sessionHandlers
  try {
    const { getSessionsOverview } = require('./bridgeRegistry') as {
      getSessionsOverview: () => { sessions: SessionListItem[]; defaultSessionId: string };
    };
    io.emit('sessions:list', getSessionsOverview());
  } catch {
    io.emit('sessions:list', { sessions: listSessions(), defaultSessionId: DEFAULT_SESSION_ID });
  }
}
