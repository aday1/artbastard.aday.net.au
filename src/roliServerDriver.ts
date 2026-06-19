import easymidi from 'easymidi';
import { Server } from 'socket.io';
import { log } from './logger';

const ROLI_GRID_COLS = 15;
const ROLI_GRID_ROWS = 15;
const LED_PIXEL_COUNT = ROLI_GRID_COLS * ROLI_GRID_ROWS;
const LED_BYTE_COUNT = LED_PIXEL_COUNT * 2;
const LED_DATA_OFFSET = 113;
const MAX_PACKET_SIZE = 200;
const PACKET_COUNTER_MAX = 0x03ff;
const HOST_DEVICE_INDEX = 0x00;
const SCREENSAVER_IDLE_MS = Math.max(1000, Math.min(600000, Number(process.env.ROLI_SERVER_SCREENSAVER_IDLE_MS) || 8000));
const SCREENSAVER_FRAME_MS = Math.max(40, Math.min(1000, Number(process.env.ROLI_SERVER_SCREENSAVER_FRAME_MS) || 140));
const TOUCH_TRAIL_POINTS = Math.max(8, Math.min(120, Number(process.env.ROLI_SERVER_TOUCH_TRAIL_POINTS) || 56));
const TOUCH_REPAINT_DELAY_MS = Math.max(40, Math.min(300, Number(process.env.ROLI_SERVER_TOUCH_REPAINT_DELAY_MS) || 85));
const DEFAULT_SINGLE_ROLI_ROLE = /^colou?r|wheel|strip$/i.test(process.env.ROLI_SERVER_ROLE || '') ? 'colour-wheel' : 'primary';
const LED_SEND_RETRY_MS = Math.max(1000, Math.min(60000, Number(process.env.ROLI_SERVER_LED_RETRY_MS) || 8000));
const LOG_TOUCH_MOVES = process.env.ROLI_SERVER_LOG_TOUCH_MOVES === '1';
type ServerRoliRole = 'primary' | 'colour-wheel';

interface ServerRoliDeviceStatus {
  deviceId: string;
  topologyIndex: number;
  topologySerial: string | null;
  role: ServerRoliRole;
  handshakeDone: boolean;
  touchCount: number;
  lastTouch: { x: number; y: number; z: number; phase: string; role: ServerRoliRole; topologyIndex: number } | null;
  lastEventAt: number | null;
  ledSendFailureCount: number;
  nextLedSendAttemptAt: number | null;
  lastLedSendErrorAt: number | null;
  lastError: string | null;
}

interface TopologyDeviceInfo {
  blockSerialNumber: string;
  topologyIndex: number;
  batteryLevel: number;
  batteryCharging: number;
}

interface TopologyConnectionInfo {
  deviceIndex1: number;
  portIndex1: number;
  deviceIndex2: number;
  portIndex2: number;
}

interface DeviceTopologyInfo {
  messageType: number;
  protocolVersion: number;
  deviceCount: number;
  connectionCount: number;
  devices: TopologyDeviceInfo[];
  connections: TopologyConnectionInfo[];
}

const BITMAP_LED_DUMP_1 =
  '02 01 00 30 5A 3E 47 0B 20 01 3A 00 10 71 01 12 4B 31 09 08 60 46 5F 25 11 40 05 02 28 61 01 17 54 11 40 10 36 78 21 12 6D 1C 30 5B 00 2E 28 63 00 23 6C 70 43 24 5A 39 60 32 01 28 09 41 0D 3E 28 24 10 1B 04 51 48 1A 0A 08 22 09 1B 2C 30 45 0D 2E 08 24 20 1B 1C 00 5B 6C 50 41 16 36 58 20 10 01 6D 50 40 2D 36 58 60 0B 01 6D 70 40 2D 3A 78 3F 00 0F 1C 78 4F 07 2E 28 78 08 19 04 52 06 15 01 48 24 00 21 64 10 48 1A 02 18 60 0C 01 4C 70 40 05 7C 3F 00 7F 0F 60 7F 03 78 7F 00 7E 1F 40 7F 07 70 7F 01 7C 3F 00 7F 0F 60 7F 03 78 7F 00 7E 1F 40 7F 07 70 7F 01 7C 3F 00 7F 0F 00';
const BITMAP_LED_DUMP_2 =
  '02 02 00 0C 5C 7F 07 70 7F 01 7C 3F 00 7F 0F 60 7F 03 78 7F 00 7E 1F 40 7F 07 70 7F 01 7C 3F 00 7F 0F 60 7F 03 78 7F 00 7E 1F 40 7F 07 70 7F 01 7C 3F 00 7F 0F 60 7F 03 78 7F 00 1E 19 00 4B';

export interface ServerRoliStatus {
  enabled: boolean;
  connected: boolean;
  inputName: string | null;
  outputName: string | null;
  handshakeDone: boolean;
  sysexRx: number;
  sysexTx: number;
  ackCount: number;
  touchCount: number;
  lastTouch: { x: number; y: number; z: number; phase: string; role?: ServerRoliRole; topologyIndex?: number } | null;
  lastError: string | null;
  lastEventAt: number | null;
  screensaverEnabled: boolean;
  screensaverActive: boolean;
  browserClientCount: number;
  lastBrowserSeenAt: number | null;
  ledSendFailureCount: number;
  nextLedSendAttemptAt: number | null;
  lastLedSendErrorAt: number | null;
  devices: ServerRoliDeviceStatus[];
}

interface ServerRoliPadState {
  deviceId: string;
  topologyIndex: number;
  topologySerial: string | null;
  role: ServerRoliRole;
  handshakeDone: boolean;
  packetCounter: number;
  prevLedData: Uint8Array;
  ledQueue: number[][];
  ledQueueActive: boolean;
  pendingLedData: Uint8Array | null;
  nextLedData: Uint8Array | null;
  nextLedForceFull: boolean;
  ackResolver: (() => void) | null;
  ackRejecter: ((error: Error) => void) | null;
  ackTimer: NodeJS.Timeout | null;
  pingTimer: NodeJS.Timeout | null;
  touchRepaintTimer: NodeJS.Timeout | null;
  touchCount: number;
  lastTouch: { x: number; y: number; z: number; phase: string; role: ServerRoliRole; topologyIndex: number } | null;
  lastError: string | null;
  lastEventAt: number | null;
  touchTrail: Array<{ x: number; y: number }>;
  isTouching: boolean;
  ledSendFailureCount: number;
  nextLedSendAttemptAt: number | null;
  lastLedSendErrorAt: number | null;
}

interface ServerRoliState {
  io: Server | null;
  input: any | null;
  output: any | null;
  inputName: string | null;
  outputName: string | null;
  enabled: boolean;
  handshakeDone: boolean;
  packetCounter: number;
  prevLedData: Uint8Array;
  ledQueue: number[][];
  pendingLedData: Uint8Array | null;
  pads: Map<number, ServerRoliPadState>;
  activeLedTopologyIndex: number | null;
  topologyTimer: NodeJS.Timeout | null;
  topologyHandshakeActive: boolean;
  ackResolver: (() => void) | null;
  ackRejecter: ((error: Error) => void) | null;
  ackTimer: NodeJS.Timeout | null;
  pingTimer: NodeJS.Timeout | null;
  sysexRx: number;
  sysexTx: number;
  ackCount: number;
  touchCount: number;
  lastTouch: { x: number; y: number; z: number; phase: string } | null;
  lastError: string | null;
  lastEventAt: number | null;
  screensaverEnabled: boolean;
  screensaverActive: boolean;
  screensaverFrame: number;
  screensaverTimer: NodeJS.Timeout | null;
  screensaverMonitor: NodeJS.Timeout | null;
  browserClientCount: number;
  lastBrowserSeenAt: number | null;
  touchTrail: Array<{ x: number; y: number }>;
  nextLedSendAttemptAt: number | null;
  ledSendFailureCount: number;
  lastLedSendErrorAt: number | null;
}

const state: ServerRoliState = {
  io: null,
  input: null,
  output: null,
  inputName: null,
  outputName: null,
  enabled: false,
  handshakeDone: false,
  packetCounter: 0,
  prevLedData: new Uint8Array(LED_BYTE_COUNT),
  ledQueue: [],
  pendingLedData: null,
  pads: new Map<number, ServerRoliPadState>(),
  activeLedTopologyIndex: null,
  topologyTimer: null,
  topologyHandshakeActive: false,
  ackResolver: null,
  ackRejecter: null,
  ackTimer: null,
  pingTimer: null,
  sysexRx: 0,
  sysexTx: 0,
  ackCount: 0,
  touchCount: 0,
  lastTouch: null,
  lastError: null,
  lastEventAt: null,
  screensaverEnabled: process.env.ROLI_SERVER_SCREENSAVER !== '0',
  screensaverActive: false,
  screensaverFrame: 0,
  screensaverTimer: null,
  screensaverMonitor: null,
  browserClientCount: 0,
  lastBrowserSeenAt: Date.now(),
  touchTrail: [],
  nextLedSendAttemptAt: null,
  ledSendFailureCount: 0,
  lastLedSendErrorAt: null,
};

function isRoliLikeName(name: string): boolean {
  const n = (name || '').toLowerCase();
  return n.includes('roli') || n.includes('lightpad') || n.includes('block') || n.includes('seaboard');
}

export function isServerRoliPort(name: string): boolean {
  return isRoliLikeName(name) && Boolean(state.inputName || state.outputName);
}

function parseDump(hex: string): number[] {
  return hex.trim().split(/\s+/).map((value) => parseInt(value, 16));
}

function createPadDeviceId(topologyIndex: number, serial?: string | null): string {
  const suffix = serial?.trim() || topologyIndex.toString(16).padStart(2, '0');
  return `${state.inputName || 'roli'}#${suffix}`;
}

function roleForTopologyPosition(position: number): ServerRoliRole {
  if (position === 0) return 'primary';
  if (position === 1) return 'colour-wheel';
  return position % 2 === 0 ? 'primary' : 'colour-wheel';
}

function createPad(topologyIndex: number, role: ServerRoliRole, serial: string | null = null): ServerRoliPadState {
  return {
    deviceId: createPadDeviceId(topologyIndex, serial),
    topologyIndex,
    topologySerial: serial,
    role,
    handshakeDone: false,
    packetCounter: 0,
    prevLedData: new Uint8Array(LED_BYTE_COUNT),
    ledQueue: [],
    ledQueueActive: false,
    pendingLedData: null,
    nextLedData: null,
    nextLedForceFull: false,
    ackResolver: null,
    ackRejecter: null,
    ackTimer: null,
    pingTimer: null,
    touchRepaintTimer: null,
    touchCount: 0,
    lastTouch: null,
    lastError: null,
    lastEventAt: null,
    touchTrail: [],
    isTouching: false,
    ledSendFailureCount: 0,
    nextLedSendAttemptAt: null,
    lastLedSendErrorAt: null,
  };
}

function ensurePad(topologyIndex: number, role: ServerRoliRole, serial: string | null = null): ServerRoliPadState {
  let pad = state.pads.get(topologyIndex);
  if (!pad) {
    pad = createPad(topologyIndex, role, serial);
    state.pads.set(topologyIndex, pad);
    return pad;
  }
  pad.role = role;
  pad.topologySerial = serial;
  pad.deviceId = createPadDeviceId(topologyIndex, serial);
  return pad;
}

function ensureFallbackPad(): ServerRoliPadState {
  return ensurePad(HOST_DEVICE_INDEX, DEFAULT_SINGLE_ROLI_ROLE, null);
}

function getPads(): ServerRoliPadState[] {
  return Array.from(state.pads.values()).sort((a, b) => a.topologyIndex - b.topologyIndex);
}

function findPadForPacket(topologyIndex: number): ServerRoliPadState {
  return state.pads.get(topologyIndex) || state.pads.get(HOST_DEVICE_INDEX) || ensureFallbackPad();
}

function clearPadTimers(pad: ServerRoliPadState): void {
  if (pad.ackTimer) clearTimeout(pad.ackTimer);
  if (pad.pingTimer) clearInterval(pad.pingTimer);
  if (pad.touchRepaintTimer) clearTimeout(pad.touchRepaintTimer);
  pad.ackTimer = null;
  pad.pingTimer = null;
  pad.touchRepaintTimer = null;
}

function clearPadLedQueue(pad: ServerRoliPadState): void {
  pad.ledQueue = [];
  pad.ledQueueActive = false;
  pad.pendingLedData = null;
  pad.nextLedData = null;
  pad.nextLedForceFull = false;
  if (state.activeLedTopologyIndex === pad.topologyIndex) state.activeLedTopologyIndex = null;
}

class Packed7BitBuilder {
  private data: number[] = [];
  private current = 0;
  private bits = 0;
  private written = 0;

  writeBits(value: number, width: number): void {
    let remaining = width;
    let input = value >>> 0;
    while (remaining > 0) {
      const available = 7 - this.bits;
      const take = Math.min(available, remaining);
      const mask = (1 << take) - 1;
      this.current |= (input & mask) << this.bits;
      this.bits += take;
      input >>>= take;
      remaining -= take;
      if (this.bits === 7) this.flush();
    }
  }

  size(): number {
    return this.written + (this.bits > 0 ? 1 : 0);
  }

  clone(): Packed7BitBuilder {
    const next = new Packed7BitBuilder();
    next.data = [...this.data];
    next.current = this.current;
    next.bits = this.bits;
    next.written = this.written;
    return next;
  }

  getData(): number[] {
    const next = this.clone();
    if (next.bits > 0) next.flush();
    return next.data;
  }

  private flush(): void {
    this.data.push(this.current & 0x7f);
    this.current = 0;
    this.bits = 0;
    this.written++;
  }
}

function buildBlockSysEx(deviceIndex: number, payload: number[]): number[] {
  const len = payload.length + 8;
  const data = new Array<number>(len).fill(0);
  data[0] = 0xf0;
  data[1] = 0x00;
  data[2] = 0x21;
  data[3] = 0x10;
  data[4] = 0x77;
  data[5] = deviceIndex & 0x7f;
  for (let index = 0; index < payload.length; index++) data[6 + index] = payload[index] & 0x7f;
  data[len - 1] = 0xf7;
  let checksum = (len - 8) & 0xff;
  for (let index = 6; index < len - 2; index++) {
    checksum = (checksum + checksum * 2 + data[index]) & 0xff;
  }
  data[len - 2] = checksum & 0x7f;
  return data;
}

function sendSysExToDeviceIndex(deviceIndex: number, payload: number[], note: string, pad?: ServerRoliPadState): void {
  if (!state.output) throw new Error('No ROLI output port');
  const bytes = buildBlockSysEx(deviceIndex, payload);
  state.output.send('sysex', bytes);
  state.sysexTx += 1;
  state.lastEventAt = Date.now();
  if (pad) pad.lastEventAt = state.lastEventAt;
  log(`ROLI server tx ${note}`, 'MIDI', {
    bytes: payload.length,
    output: state.outputName,
    topologyIndex: deviceIndex,
    role: pad?.role,
    verboseOnly: note === 'ping'
  });
}

function sendSysExToPad(pad: ServerRoliPadState, payload: number[], note: string): void {
  sendSysExToDeviceIndex(pad.topologyIndex, payload, note, pad);
}

function sendSysExToHost(payload: number[], note: string): void {
  sendSysExToDeviceIndex(HOST_DEVICE_INDEX, payload, note);
}

function waitForAck(pad: ServerRoliPadState, timeoutMs = 900): Promise<void> {
  return new Promise((resolve, reject) => {
    if (pad.ackTimer) clearTimeout(pad.ackTimer);
    pad.ackResolver = resolve;
    pad.ackRejecter = reject;
    pad.ackTimer = setTimeout(() => {
      pad.ackResolver = null;
      pad.ackRejecter = null;
      pad.ackTimer = null;
      reject(new Error('ROLI ack timeout'));
    }, timeoutMs);
  });
}

function read7BitBits(data: Uint8Array, bitPos: number, numBits: number): number {
  let value = 0;
  let read = 0;
  while (read < numBits) {
    const byteIndex = Math.floor((bitPos + read) / 7);
    const bitInByte = (bitPos + read) % 7;
    const available = 7 - bitInByte;
    const toRead = Math.min(numBits - read, available);
    value |= ((data[byteIndex] >>> bitInByte) & ((1 << toRead) - 1)) << read;
    read += toRead;
  }
  return value;
}

function readAscii7(data: Uint8Array, bitPos: number, length: number): { value: string; next: number } {
  let value = '';
  let pos = bitPos;
  for (let index = 0; index < length; index++) {
    value += String.fromCharCode(read7BitBits(data, pos, 7));
    pos += 7;
  }
  return { value, next: pos };
}

function parseTopologyMessage(msgData: Uint8Array): DeviceTopologyInfo | null {
  let pos = 39;
  const messageType = read7BitBits(msgData, pos, 7);
  pos += 7;
  if (messageType !== 0x01) return null;

  const protocolVersion = read7BitBits(msgData, pos, 8);
  pos += 8;
  const deviceCount = read7BitBits(msgData, pos, 7);
  pos += 7;
  const connectionCount = read7BitBits(msgData, pos, 8);
  pos += 8;

  const devices: TopologyDeviceInfo[] = [];
  for (let index = 0; index < deviceCount; index++) {
    const serial = readAscii7(msgData, pos, 16);
    pos = serial.next;
    const topologyIndex = read7BitBits(msgData, pos, 7);
    pos += 7;
    const batteryLevel = read7BitBits(msgData, pos, 5);
    pos += 5;
    const batteryCharging = read7BitBits(msgData, pos, 1);
    pos += 1;
    devices.push({ blockSerialNumber: serial.value, topologyIndex, batteryLevel, batteryCharging });
  }

  const connections: TopologyConnectionInfo[] = [];
  for (let index = 0; index < connectionCount; index++) {
    const deviceIndex1 = read7BitBits(msgData, pos, 7);
    pos += 7;
    const portIndex1 = read7BitBits(msgData, pos, 5);
    pos += 5;
    const deviceIndex2 = read7BitBits(msgData, pos, 7);
    pos += 7;
    const portIndex2 = read7BitBits(msgData, pos, 5);
    pos += 5;
    connections.push({ deviceIndex1, portIndex1, deviceIndex2, portIndex2 });
  }

  return { messageType, protocolVersion, deviceCount, connectionCount, devices, connections };
}

function requestTopology(): void {
  if (!state.output) return;
  sendSysExToHost([0x01, 0x01, 0x00], 'request topology');
}

function ensureTopologyPads(topology: DeviceTopologyInfo): void {
  if (!topology.devices.length) return;
  if (state.topologyTimer) {
    clearTimeout(state.topologyTimer);
    state.topologyTimer = null;
  }

  const activeIndexes = new Set<number>();
  const sortedDevices = [...topology.devices].sort((a, b) => a.topologyIndex - b.topologyIndex);
  sortedDevices.forEach((topologyDevice, position) => {
    const role = sortedDevices.length === 1 ? DEFAULT_SINGLE_ROLI_ROLE : roleForTopologyPosition(position);
    const pad = ensurePad(topologyDevice.topologyIndex, role, topologyDevice.blockSerialNumber);
    activeIndexes.add(pad.topologyIndex);
  });

  for (const pad of getPads()) {
    if (activeIndexes.has(pad.topologyIndex)) continue;
    clearPadTimers(pad);
    clearPadLedQueue(pad);
    state.pads.delete(pad.topologyIndex);
  }

  log('ROLI server topology detected', 'MIDI', {
    deviceCount: topology.deviceCount,
    connectionCount: topology.connectionCount,
    pads: getPads().map((pad) => ({ topologyIndex: pad.topologyIndex, role: pad.role, serial: pad.topologySerial })),
  });
  startTopologyHandshakes();
  emitStatus();
}

function startTopologyHandshakes(): void {
  if (state.topologyHandshakeActive) return;
  state.topologyHandshakeActive = true;
  void (async () => {
    try {
      for (const pad of getPads()) {
        if (pad.handshakeDone || pad.ackResolver) continue;
        try {
          await handshakePad(pad);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          pad.handshakeDone = false;
          pad.lastError = errorMessage;
          state.handshakeDone = getPads().some((candidate) => candidate.handshakeDone);
          state.lastError = errorMessage;
          log('ROLI server pad handshake failed', 'ERROR', {
            error: errorMessage,
            input: state.inputName,
            output: state.outputName,
            topologyIndex: pad.topologyIndex,
            role: pad.role,
          });
          emitStatus();
        }
      }
    } finally {
      state.topologyHandshakeActive = false;
      emitStatus();
    }
  })();
}

function startPadHandshake(pad: ServerRoliPadState): void {
  void handshakePad(pad).catch((error) => {
    const errorMessage = error instanceof Error ? error.message : String(error);
    pad.handshakeDone = false;
    pad.lastError = errorMessage;
    state.handshakeDone = getPads().some((candidate) => candidate.handshakeDone);
    state.lastError = errorMessage;
    log('ROLI server pad handshake failed', 'ERROR', {
      error: errorMessage,
      input: state.inputName,
      output: state.outputName,
      topologyIndex: pad.topologyIndex,
      role: pad.role,
    });
    emitStatus();
  });
}

function emitStatus(): void {
  state.io?.emit('serverRoliStatus', getServerRoliStatus());
}

function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
  const c = v * s;
  const hp = ((h % 360) + 360) % 360 / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  const m = v - c;
  let red = 0;
  let green = 0;
  let blue = 0;
  if (hp < 1) [red, green, blue] = [c, x, 0];
  else if (hp < 2) [red, green, blue] = [x, c, 0];
  else if (hp < 3) [red, green, blue] = [0, c, x];
  else if (hp < 4) [red, green, blue] = [0, x, c];
  else if (hp < 5) [red, green, blue] = [x, 0, c];
  else [red, green, blue] = [c, 0, x];
  return [
    Math.round((red + m) * 255),
    Math.round((green + m) * 255),
    Math.round((blue + m) * 255),
  ];
}

function createPrimaryIdleFrame(frame: number, cursor?: { x: number; y: number } | null): Uint8ClampedArray {
  const pixels = new Uint8ClampedArray(LED_PIXEL_COUNT * 4);
  const t = frame / 10;
  const cx = cursor ? Math.max(0, Math.min(1, cursor.x)) * (ROLI_GRID_COLS - 1) : (Math.sin(t / 5) + 1) * 0.5 * (ROLI_GRID_COLS - 1);
  const cy = cursor ? Math.max(0, Math.min(1, cursor.y)) * (ROLI_GRID_ROWS - 1) : (Math.cos(t / 7) + 1) * 0.5 * (ROLI_GRID_ROWS - 1);
  for (let y = 0; y < ROLI_GRID_ROWS; y++) {
    for (let x = 0; x < ROLI_GRID_COLS; x++) {
      const index = (y * ROLI_GRID_COLS + x) * 4;
      const distance = Math.hypot(x - cx, y - cy);
      const lineGlow = x === Math.round(cx) || y === Math.round(cy) ? 0.26 : 0;
      const pulse = Math.max(0, 1 - distance / 7) * 0.34;
      const wave = (Math.sin((x * 0.45) + t) + Math.cos((y * 0.42) - t) + 2) / 4;
      const red = Math.round(12 + wave * 12 + pulse * 90 + lineGlow * 120);
      pixels[index] = red;
      pixels[index + 1] = Math.round(pulse * 24);
      pixels[index + 2] = 0;
      pixels[index + 3] = 255;
    }
  }
  return pixels;
}

function makeColorStripPixel(x: number, y: number): [number, number, number] {
  const hue = (x / Math.max(1, ROLI_GRID_COLS - 1)) * 330;
  const value = Math.max(0.1, 1 - y / Math.max(1, ROLI_GRID_ROWS - 1));
  return hsvToRgb(hue, 0.95, value);
}

function drawCursorOnFrame(pixels: Uint8ClampedArray, cursor: { x: number; y: number }, color: [number, number, number, number]): void {
  const cell = {
    x: Math.round(Math.max(0, Math.min(1, cursor.x)) * (ROLI_GRID_COLS - 1)),
    y: Math.round(Math.max(0, Math.min(1, cursor.y)) * (ROLI_GRID_ROWS - 1)),
  };
  const put = (x: number, y: number, rgba: [number, number, number, number]) => {
    if (x < 0 || y < 0 || x >= ROLI_GRID_COLS || y >= ROLI_GRID_ROWS) return;
    const index = (y * ROLI_GRID_COLS + x) * 4;
    pixels[index] = Math.max(pixels[index], rgba[0]);
    pixels[index + 1] = Math.max(pixels[index + 1], rgba[1]);
    pixels[index + 2] = Math.max(pixels[index + 2], rgba[2]);
    pixels[index + 3] = Math.max(pixels[index + 3], rgba[3]);
  };
  for (let offset = -1; offset <= 1; offset++) {
    put(cell.x + offset, cell.y, color);
    put(cell.x, cell.y + offset, color);
  }
  for (let radius = 2; radius <= 3; radius++) {
    for (let y = -radius; y <= radius; y++) {
      for (let x = -radius; x <= radius; x++) {
        if (Math.abs(Math.hypot(x, y) - radius) <= 0.45) {
          put(cell.x + x, cell.y + y, [Math.round(color[0] * 0.65), Math.round(color[1] * 0.65), Math.round(color[2] * 0.65), 255]);
        }
      }
    }
  }
  put(cell.x, cell.y, [255, 255, 255, 255]);
}

function createColourWheelFrame(frame: number, cursor?: { x: number; y: number; phase?: string } | null): Uint8ClampedArray {
  const pixels = new Uint8ClampedArray(LED_PIXEL_COUNT * 4);
  const shimmerColumn = Math.floor((frame / 3) % ROLI_GRID_COLS);
  for (let y = 0; y < ROLI_GRID_ROWS; y++) {
    for (let x = 0; x < ROLI_GRID_COLS; x++) {
      const index = (y * ROLI_GRID_COLS + x) * 4;
      const [red, green, blue] = makeColorStripPixel(x, y);
      const shimmer = x === shimmerColumn ? 1.08 : 0.82;
      pixels[index] = Math.min(255, Math.round(red * shimmer));
      pixels[index + 1] = Math.min(255, Math.round(green * shimmer));
      pixels[index + 2] = Math.min(255, Math.round(blue * shimmer));
      pixels[index + 3] = 255;
    }
  }
  if (cursor) drawCursorOnFrame(pixels, cursor, cursor.phase === 'end' ? [255, 210, 180, 255] : [255, 255, 255, 255]);
  return pixels;
}

function createServerTouchFrame(pad: ServerRoliPadState, cursor: { x: number; y: number; z: number; phase: string }): Uint8ClampedArray {
  if (pad.role === 'colour-wheel') return createColourWheelFrame(pad.touchCount, cursor);

  const pixels = createPrimaryIdleFrame(pad.touchCount, cursor);

  const put = (x: number, y: number, color: [number, number, number, number]) => {
    if (x < 0 || y < 0 || x >= ROLI_GRID_COLS || y >= ROLI_GRID_ROWS) return;
    const index = (y * ROLI_GRID_COLS + x) * 4;
    pixels[index] = Math.max(pixels[index], color[0]);
    pixels[index + 1] = Math.max(pixels[index + 1], color[1]);
    pixels[index + 2] = Math.max(pixels[index + 2], color[2]);
    pixels[index + 3] = Math.max(pixels[index + 3], color[3]);
  };

  const toCell = (point: { x: number; y: number }) => ({
    x: Math.round(Math.max(0, Math.min(1, point.x)) * (ROLI_GRID_COLS - 1)),
    y: Math.round(Math.max(0, Math.min(1, point.y)) * (ROLI_GRID_ROWS - 1)),
  });

  const cell = toCell(cursor);
  const dimCross: [number, number, number, number] = cursor.phase === 'end' ? [170, 22, 0, 255] : [240, 20, 0, 255];
  const hot: [number, number, number, number] = cursor.phase === 'end' ? [255, 90, 30, 255] : [255, 255, 255, 255];
  for (let x = 0; x < ROLI_GRID_COLS; x++) put(x, cell.y, dimCross);
  for (let y = 0; y < ROLI_GRID_ROWS; y++) put(cell.x, y, dimCross);
  for (let radius = 2; radius <= 4; radius += 2) {
    for (let y = -radius; y <= radius; y++) {
      for (let x = -radius; x <= radius; x++) {
        const dist = Math.hypot(x, y);
        if (Math.abs(dist - radius) <= 0.45) put(cell.x + x, cell.y + y, dimCross);
      }
    }
  }
  for (let offset = -1; offset <= 1; offset++) {
    put(cell.x + offset, cell.y, hot);
    put(cell.x, cell.y + offset, hot);
  }
  put(cell.x, cell.y, [255, 255, 255, 255]);
  return pixels;
}

function scheduleServerTouchRepaint(pad: ServerRoliPadState): void {
  const touchCount = pad.touchCount;
  if (pad.touchRepaintTimer) clearTimeout(pad.touchRepaintTimer);
  pad.touchRepaintTimer = setTimeout(() => {
    pad.touchRepaintTimer = null;
    if (!pad.lastTouch || pad.touchCount !== touchCount) return;
    sendLedDataForPad(pad, rgbaFrameToLedData(createServerTouchFrame(pad, pad.lastTouch)), true);
  }, TOUCH_REPAINT_DELAY_MS);
}

function shouldRunServerScreensaver(): boolean {
  const readyPads = getPads().filter((pad) => pad.handshakeDone);
  if (!state.screensaverEnabled || !state.input || !state.output || readyPads.length === 0 || state.browserClientCount !== 0) return false;
  const latestPadActivityAt = readyPads.reduce((latest, pad) => Math.max(latest, pad.lastEventAt || 0), 0);
  const latestActivityAt = Math.max(state.lastBrowserSeenAt || 0, state.lastEventAt || 0, latestPadActivityAt);
  return Date.now() - latestActivityAt >= SCREENSAVER_IDLE_MS;
}

function startServerRoliScreensaver(reason = 'no-browser'): void {
  if (state.screensaverActive || !shouldRunServerScreensaver()) return;
  state.screensaverActive = true;
  state.screensaverFrame = 0;
  log('ROLI server screensaver started', 'MIDI', { reason, idleMs: SCREENSAVER_IDLE_MS, frameMs: SCREENSAVER_FRAME_MS, verboseOnly: reason === 'no-browser-clients' });
  state.screensaverTimer = setInterval(() => {
    if (!shouldRunServerScreensaver()) {
      stopServerRoliScreensaver('browser-or-device-state-changed');
      return;
    }
    const frame = state.screensaverFrame++;
    for (const pad of getPads()) {
      if (!pad.handshakeDone || pad.ledQueueActive || pad.ledQueue.length > 0) continue;
      const pixels = pad.role === 'colour-wheel'
        ? createColourWheelFrame(frame, pad.lastTouch)
        : createPrimaryIdleFrame(frame, pad.lastTouch);
      sendLedDataForPad(pad, rgbaFrameToLedData(pixels), false);
    }
  }, SCREENSAVER_FRAME_MS);
  emitStatus();
}

function stopServerRoliScreensaver(reason = 'manual'): void {
  if (state.screensaverTimer) {
    clearInterval(state.screensaverTimer);
    state.screensaverTimer = null;
  }
  if (!state.screensaverActive) return;
  state.screensaverActive = false;
  log('ROLI server screensaver stopped', 'MIDI', { reason, verboseOnly: reason === 'touch' });
  emitStatus();
}

function evaluateServerRoliScreensaver(): void {
  if (!state.screensaverEnabled) {
    stopServerRoliScreensaver('disabled');
    return;
  }
  if (!shouldRunServerScreensaver()) {
    stopServerRoliScreensaver('not-idle');
    return;
  }
  const latestPadActivityAt = getPads().reduce((latest, pad) => Math.max(latest, pad.lastEventAt || 0), 0);
  const lastSeen = Math.max(state.lastBrowserSeenAt || 0, state.lastEventAt || 0, latestPadActivityAt) || Date.now();
  if (Date.now() - lastSeen >= SCREENSAVER_IDLE_MS) {
    startServerRoliScreensaver('no-browser-clients');
  }
}

function ensureScreensaverMonitor(): void {
  if (state.screensaverMonitor) return;
  state.screensaverMonitor = setInterval(evaluateServerRoliScreensaver, 1000);
}

function emitTouch(pad: ServerRoliPadState, x: number, y: number, z: number, phase: string): void {
  state.touchCount += 1;
  pad.touchCount += 1;
  pad.lastTouch = { x, y, z, phase, role: pad.role, topologyIndex: pad.topologyIndex };
  state.lastTouch = pad.lastTouch;
  const now = Date.now();
  state.lastEventAt = now;
  pad.lastEventAt = now;
  if (phase === 'start') {
    pad.isTouching = true;
    pad.touchTrail = [{ x, y }];
  }
  else if (phase === 'move') {
    pad.touchTrail.push({ x, y });
    if (pad.touchTrail.length > TOUCH_TRAIL_POINTS) pad.touchTrail.splice(0, pad.touchTrail.length - TOUCH_TRAIL_POINTS);
  } else if (phase === 'end') {
    pad.isTouching = false;
    if (pad.touchTrail.length === 0) pad.touchTrail = [{ x, y }];
  }

  stopServerRoliScreensaver('touch');
  sendLedDataForPad(pad, rgbaFrameToLedData(createServerTouchFrame(pad, pad.lastTouch)), true);
  scheduleServerTouchRepaint(pad);

  state.io?.emit('serverRoliTouch', {
    ...pad.lastTouch,
    deviceId: pad.deviceId,
    role: pad.role,
    sourceTransport: 'server',
    inputName: state.inputName,
    outputName: state.outputName,
  });
  if (phase !== 'move' || LOG_TOUCH_MOVES) {
    log(`ROLI server touch ${phase}`, 'MIDI', {
      source: state.inputName,
      topologyIndex: pad.topologyIndex,
      role: pad.role,
      x: Number(x.toFixed(3)),
      y: Number(y.toFixed(3)),
      z: Number(z.toFixed(3)),
      verboseOnly: phase === 'move'
    });
  }
}

export function setServerRoliBrowserClientCount(count: number): void {
  const nextCount = Math.max(0, Math.floor(Number(count) || 0));
  state.browserClientCount = nextCount;
  if (nextCount > 0) {
    state.lastBrowserSeenAt = Date.now();
    stopServerRoliScreensaver('browser-connected');
  }
  evaluateServerRoliScreensaver();
  emitStatus();
}

function parseRoliSysEx(bytes: number[]): void {
  if (bytes.length < 8 || bytes[0] !== 0xf0 || bytes[1] !== 0x00 || bytes[2] !== 0x21 || bytes[3] !== 0x10 || bytes[4] !== 0x77) return;
  state.sysexRx += 1;
  state.lastEventAt = Date.now();
  const data = new Uint8Array(bytes);
  const msgData = data.subarray(5, data.length - 2);
  const packetDeviceIndex = msgData[0] & 0x3f;
  let bitPos = 39;
  const firstType = read7BitBits(msgData, bitPos, 7);

  if (firstType === 0x01) {
    const topology = parseTopologyMessage(msgData);
    if (topology) ensureTopologyPads(topology);
    return;
  }

  const pad = findPadForPacket(packetDeviceIndex);

  if (firstType === 0x02) {
    bitPos += 7;
    const counter = read7BitBits(msgData, bitPos, 10);
    state.ackCount += 1;
    log('ROLI server ack', 'MIDI', { counter, input: state.inputName, topologyIndex: pad.topologyIndex, role: pad.role, verboseOnly: true });
    if (pad.ackResolver) {
      if (pad.ackTimer) clearTimeout(pad.ackTimer);
      const resolver = pad.ackResolver;
      pad.ackResolver = null;
      pad.ackRejecter = null;
      pad.ackTimer = null;
      resolver();
    } else if (pad.ledQueueActive || pad.ledQueue.length > 0) {
      pad.ledQueueActive = false;
      sendNextLedPacket(pad);
    }
    emitStatus();
    return;
  }

  while (bitPos + 7 <= msgData.length * 7) {
    const msgType = read7BitBits(msgData, bitPos, 7);
    bitPos += 7;
    if (msgType === 0x11) {
      bitPos += 5 + 5;
      const x = read7BitBits(msgData, bitPos, 12);
      bitPos += 12;
      const y = read7BitBits(msgData, bitPos, 12);
      bitPos += 12 + 8;
      if (!pad.isTouching) return;
      emitTouch(pad, x / 4095, y / 4095, pad.lastTouch?.z ?? 0.5, 'move');
      return;
    }
    if (msgType === 0x13 || msgType === 0x15) {
      bitPos += 5 + 5;
      const x = read7BitBits(msgData, bitPos, 12);
      bitPos += 12;
      const y = read7BitBits(msgData, bitPos, 12);
      bitPos += 8;
      if (msgType === 0x13) bitPos += 24;
      emitTouch(pad, x / 4095, y / 4095, msgType === 0x13 ? 0.7 : 0, msgType === 0x13 ? 'start' : 'end');
      return;
    }
    break;
  }
}

function rgbaToBgr565(r: number, g: number, b: number, a: number): number {
  const alpha = a / 255;
  const red = ((r * alpha) >> 3) & 0x1f;
  const green = ((g * alpha) >> 2) & 0x3f;
  const blue = ((b * alpha) >> 3) & 0x1f;
  return (blue << 11) | (green << 5) | red;
}

function rgbaFrameToLedData(pixels: Uint8Array | Uint8ClampedArray): Uint8Array {
  const data = new Uint8Array(LED_BYTE_COUNT);
  for (let index = 0; index < LED_PIXEL_COUNT; index++) {
    const c16 = rgbaToBgr565(pixels[index * 4], pixels[index * 4 + 1], pixels[index * 4 + 2], pixels[index * 4 + 3]);
    data[index * 2] = c16 & 0xff;
    data[index * 2 + 1] = (c16 >> 8) & 0xff;
  }
  return data;
}

function buildDataChangeMessages(pad: ServerRoliPadState, newData: Uint8Array, oldData: Uint8Array): number[][] {
  const queued: number[][] = [];
  const startPacketIndex = pad.packetCounter;
  let packetIndex = startPacketIndex;
  let builder = new Packed7BitBuilder();

  const initPacket = () => {
    builder = new Packed7BitBuilder();
    builder.writeBits(0x02, 7);
    builder.writeBits(packetIndex & PACKET_COUNTER_MAX, 16);
  };
  const queueDataAndCreateNewPacket = (skipBase: number) => {
    const finalized = builder.clone();
    finalized.writeBits(0, 3);
    queued.push(finalized.getData());
    packetIndex++;
    initPacket();
    appendSkipBytes(skipBase, skipBase);
  };
  const queueIfNeeded = (startIndex: number, sizeToAdd: number) => {
    const available = MAX_PACKET_SIZE - builder.size();
    if (available < sizeToAdd) {
      queueDataAndCreateNewPacket(startIndex);
      return MAX_PACKET_SIZE;
    }
    return available;
  };
  function appendSkipBytes(startIndex: number, skipCount: number): number {
    let absoluteIndex = startIndex;
    let remaining = skipCount;
    while (remaining > 0) {
      queueIfNeeded(absoluteIndex, 3);
      if (remaining > 255) {
        builder.writeBits(3, 3);
        builder.writeBits(255, 8);
        absoluteIndex += 255;
        remaining -= 255;
      } else if (remaining > 15) {
        builder.writeBits(3, 3);
        builder.writeBits(remaining, 8);
        absoluteIndex += remaining;
        remaining = 0;
      } else {
        builder.writeBits(2, 3);
        builder.writeBits(remaining, 4);
        absoluteIndex += remaining;
        remaining = 0;
      }
    }
    return absoluteIndex;
  }
  function appendSetSequenceOfBytes(startIndex: number, byteSequence: Uint8Array): number {
    let bytesWritten = 0;
    let absoluteIndex = startIndex;
    while (bytesWritten < byteSequence.length) {
      const bytesRemaining = byteSequence.length - bytesWritten;
      const packetSizeToAdd = Math.ceil(3 / 8 + bytesRemaining * (9 / 7));
      const availablePacketSize = MAX_PACKET_SIZE - builder.size();
      let bytesToAdd = bytesRemaining;
      if (availablePacketSize < packetSizeToAdd) bytesToAdd = Math.floor((availablePacketSize - 3 / 8) / (9 / 7));
      if (bytesToAdd < 1) {
        queueDataAndCreateNewPacket(absoluteIndex);
        continue;
      }
      builder.writeBits(4, 3);
      for (let index = 0; index < bytesToAdd; index++) {
        const sourceIndex = bytesWritten + index;
        builder.writeBits(byteSequence[sourceIndex], 8);
        builder.writeBits(index < bytesToAdd - 1 && sourceIndex < byteSequence.length - 1 ? 1 : 0, 1);
      }
      bytesWritten += bytesToAdd;
      absoluteIndex += bytesToAdd;
      if (availablePacketSize < packetSizeToAdd) queueDataAndCreateNewPacket(absoluteIndex);
    }
    return absoluteIndex;
  }

  initPacket();
  let count = LED_DATA_OFFSET;
  let isSkipping = true;
  let index = 0;
  while (index < LED_BYTE_COUNT) {
    let toPos = index;
    while (toPos < LED_BYTE_COUNT && ((isSkipping && newData[toPos] === oldData[toPos]) || (!isSkipping && newData[toPos] !== oldData[toPos]))) {
      toPos++;
      count++;
    }
    if (isSkipping && toPos < LED_BYTE_COUNT) appendSkipBytes(LED_DATA_OFFSET + index, count);
    else if (!isSkipping) appendSetSequenceOfBytes(LED_DATA_OFFSET + index, newData.subarray(index, toPos));
    isSkipping = !isSkipping;
    index = toPos;
    count = 0;
  }
  const finalized = builder.clone();
  finalized.writeBits(1, 3);
  queued.push(finalized.getData());
  pad.packetCounter = (startPacketIndex + queued.length) & PACKET_COUNTER_MAX;
  return queued;
}

function flushNextPendingPadFrame(exceptTopologyIndex?: number): boolean {
  for (const pad of getPads()) {
    if (pad.topologyIndex === exceptTopologyIndex) continue;
    if (!pad.nextLedData || !pad.handshakeDone) continue;
    const nextLedData = pad.nextLedData;
    const forceFullFrame = pad.nextLedForceFull;
    pad.nextLedData = null;
    pad.nextLedForceFull = false;
    return sendLedDataForPad(pad, nextLedData, forceFullFrame);
  }
  return false;
}

function sendNextLedPacket(pad: ServerRoliPadState): void {
  if (!state.output || !pad.handshakeDone) {
    clearPadLedQueue(pad);
    return;
  }

  if (pad.ledQueue.length === 0) {
    pad.ledQueueActive = false;
    if (pad.pendingLedData) {
      pad.prevLedData = pad.pendingLedData;
      pad.pendingLedData = null;
    }
    if (state.activeLedTopologyIndex === pad.topologyIndex) state.activeLedTopologyIndex = null;
    if (pad.nextLedData) {
      const nextLedData = pad.nextLedData;
      const forceFullFrame = pad.nextLedForceFull;
      pad.nextLedData = null;
      pad.nextLedForceFull = false;
      sendLedDataForPad(pad, nextLedData, forceFullFrame);
      return;
    }
    flushNextPendingPadFrame(pad.topologyIndex);
    return;
  }

  if (pad.nextLedSendAttemptAt && Date.now() < pad.nextLedSendAttemptAt) return;
  if (state.activeLedTopologyIndex !== null && state.activeLedTopologyIndex !== pad.topologyIndex) return;

  const next = pad.ledQueue.shift()!;
  try {
    state.output.send('sysex', buildBlockSysEx(pad.topologyIndex, next));
    pad.ledQueueActive = true;
    state.activeLedTopologyIndex = pad.topologyIndex;
    state.sysexTx += 1;
    state.lastEventAt = Date.now();
    pad.lastEventAt = state.lastEventAt;
    pad.ledSendFailureCount = 0;
    pad.nextLedSendAttemptAt = null;
    log('ROLI server LED packet', 'MIDI', { remaining: pad.ledQueue.length, bytes: next.length, output: state.outputName, topologyIndex: pad.topologyIndex, role: pad.role, verboseOnly: true });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    pad.lastError = `ROLI LED send failed: ${errorMessage}`;
    state.lastError = pad.lastError;
    pad.ledSendFailureCount += 1;
    pad.nextLedSendAttemptAt = Date.now() + LED_SEND_RETRY_MS;
    pad.lastLedSendErrorAt = Date.now();
    clearPadLedQueue(pad);
    stopServerRoliScreensaver('led-send-error');
    log('ROLI server LED send failed; pausing LED output', 'WARN', {
      error: errorMessage,
      output: state.outputName,
      topologyIndex: pad.topologyIndex,
      role: pad.role,
      retryMs: LED_SEND_RETRY_MS,
      failureCount: pad.ledSendFailureCount,
    });
    emitStatus();
  }
}

function sendLedDataForPad(pad: ServerRoliPadState, newLed: Uint8Array, forceFullFrame = false): boolean {
  if (!state.output || !pad.handshakeDone) return false;
  if (pad.nextLedSendAttemptAt && Date.now() < pad.nextLedSendAttemptAt) return false;
  if (pad.ledQueueActive || pad.ledQueue.length > 0 || (state.activeLedTopologyIndex !== null && state.activeLedTopologyIndex !== pad.topologyIndex)) {
    pad.nextLedData = newLed;
    pad.nextLedForceFull = pad.nextLedForceFull || forceFullFrame;
    return true;
  }

  let prev = pad.prevLedData;
  if (forceFullFrame) {
    prev = new Uint8Array(LED_BYTE_COUNT);
    for (let index = 0; index < LED_BYTE_COUNT; index++) prev[index] = newLed[index] ^ 0xff;
  }
  pad.ledQueue = buildDataChangeMessages(pad, newLed, prev);
  pad.pendingLedData = newLed;
  sendNextLedPacket(pad);
  return pad.ledQueue.length > 0 || pad.pendingLedData !== newLed || !pad.lastError?.startsWith('ROLI LED send failed:');
}

function sendLedData(newLed: Uint8Array, forceFullFrame = false, role: ServerRoliRole = 'primary'): boolean {
  const pad = getPads().find((candidate) => candidate.role === role) || getPads()[0] || ensureFallbackPad();
  return sendLedDataForPad(pad, newLed, forceFullFrame);
}

function createTestFrame(): Uint8ClampedArray {
  const pixels = new Uint8ClampedArray(LED_PIXEL_COUNT * 4);
  for (let y = 0; y < ROLI_GRID_ROWS; y++) {
    for (let x = 0; x < ROLI_GRID_COLS; x++) {
      const index = (y * ROLI_GRID_COLS + x) * 4;
      pixels[index] = Math.round((x / (ROLI_GRID_COLS - 1)) * 255);
      pixels[index + 1] = Math.round((y / (ROLI_GRID_ROWS - 1)) * 255);
      pixels[index + 2] = 180;
      pixels[index + 3] = 255;
    }
  }
  return pixels;
}

async function handshakePad(pad: ServerRoliPadState): Promise<void> {
  clearPadLedQueue(pad);
  if (pad.pingTimer) clearInterval(pad.pingTimer);
  pad.pingTimer = null;
  pad.handshakeDone = false;
  pad.lastError = null;
  sendSysExToPad(pad, [0x01, 0x02, 0x00], 'endAPIMode');
  sendSysExToPad(pad, [0x01, 0x00, 0x00], 'beginAPIMode');
  await waitForAck(pad);
  sendSysExToPad(pad, [0x01, 0x00, 0x00], 'beginAPIMode resend');
  await waitForAck(pad);
  sendSysExToPad(pad, [0x01, 0x03, 0x00], 'ping');
  await waitForAck(pad);
  sendSysExToPad(pad, [0x10, 0x02], 'config midiUseMPE');
  await waitForAck(pad);
  sendSysExToPad(pad, [0x01, 0x03, 0x00], 'ping');
  await waitForAck(pad);
  sendSysExToPad(pad, parseDump(BITMAP_LED_DUMP_1), 'bitmap dump 1');
  sendSysExToPad(pad, parseDump(BITMAP_LED_DUMP_2), 'bitmap dump 2');
  pad.packetCounter = 3;
  await waitForAck(pad, 1200);
  sendSysExToPad(pad, [0x01, 0x05, 0x00], 'saveProgramAsDefault');
  await waitForAck(pad);
  pad.handshakeDone = true;
  state.lastError = null;
  state.handshakeDone = getPads().some((candidate) => candidate.handshakeDone);
  pad.prevLedData = new Uint8Array(LED_BYTE_COUNT);
  if (pad.pingTimer) clearInterval(pad.pingTimer);
  pad.pingTimer = setInterval(() => {
    if (state.output && pad.handshakeDone && !pad.ledQueueActive && pad.ledQueue.length === 0) {
      try { sendSysExToPad(pad, [0x01, 0x03, 0x00], 'ping'); } catch {}
    }
  }, 500);
  log('ROLI server handshake complete', 'MIDI', { input: state.inputName, output: state.outputName, topologyIndex: pad.topologyIndex, role: pad.role });
  const initialFrame = pad.role === 'colour-wheel'
    ? createColourWheelFrame(0, null)
    : createServerTouchFrame(pad, pad.lastTouch || { x: 0.5, y: 0.5, z: 0, phase: 'end', role: pad.role, topologyIndex: pad.topologyIndex });
  sendLedDataForPad(pad, rgbaFrameToLedData(initialFrame), true);
  evaluateServerRoliScreensaver();
  emitStatus();
}

function choosePortPair(inputName?: string, outputName?: string): { inputName: string; outputName: string } | null {
  const inputs = easymidi.getInputs();
  const outputs = easymidi.getOutputs();
  const selectedInput = inputName || process.env.ROLI_SERVER_INPUT || inputs.find(isRoliLikeName) || null;
  if (!selectedInput) return null;
  const inputBase = selectedInput.toLowerCase();
  const selectedOutput = outputName || process.env.ROLI_SERVER_OUTPUT || outputs.find((name) => name.toLowerCase() === inputBase) || outputs.find(isRoliLikeName) || null;
  if (!selectedOutput) return null;
  return { inputName: selectedInput, outputName: selectedOutput };
}

export async function connectServerRoli(io: Server, inputName?: string, outputName?: string): Promise<ServerRoliStatus> {
  disconnectServerRoli();
  state.io = io;
  state.enabled = true;
  const pair = choosePortPair(inputName, outputName);
  if (!pair) {
    state.lastError = 'No ROLI-like MIDI input/output pair found';
    log('ROLI server auto-connect skipped', 'MIDI', { error: state.lastError });
    emitStatus();
    return getServerRoliStatus();
  }
  try {
    state.input = new (easymidi as any).Input(pair.inputName);
    state.output = new (easymidi as any).Output(pair.outputName);
    state.inputName = pair.inputName;
    state.outputName = pair.outputName;
    state.input.on('sysex', (msg: { bytes?: number[] }) => parseRoliSysEx(msg.bytes || []));
    state.input.on('message', (msg: any) => {
      if (msg?._type !== 'sysex') log('ROLI server MIDI message', 'MIDI', { source: pair.inputName, type: msg?._type });
    });
    log('ROLI server claimed MIDI ports', 'MIDI', pair);
    emitStatus();
    try { requestTopology(); } catch (error) { log('ROLI server topology request failed', 'WARN', { error: error instanceof Error ? error.message : String(error) }); }
    if (state.topologyTimer) clearTimeout(state.topologyTimer);
    state.topologyTimer = setTimeout(() => {
      state.topologyTimer = null;
      if (getPads().length > 0) return;
      const pad = ensureFallbackPad();
      log('ROLI server topology probe timed out; using single-pad fallback', 'MIDI', { topologyIndex: pad.topologyIndex, role: pad.role });
      startPadHandshake(pad);
      emitStatus();
    }, 900);
  } catch (error) {
    state.lastError = error instanceof Error ? error.message : String(error);
    log('ROLI server connect failed', 'ERROR', { error: state.lastError, input: pair.inputName, output: pair.outputName });
    disconnectServerRoli();
  }
  return getServerRoliStatus();
}

export function initializeServerRoli(io: Server): void {
  state.io = io;
  ensureScreensaverMonitor();
  void connectServerRoli(io);
}

export function disconnectServerRoli(): void {
  stopServerRoliScreensaver('disconnect');
  if (state.pingTimer) clearInterval(state.pingTimer);
  if (state.ackTimer) clearTimeout(state.ackTimer);
  if (state.topologyTimer) clearTimeout(state.topologyTimer);
  for (const pad of getPads()) {
    clearPadTimers(pad);
    clearPadLedQueue(pad);
  }
  try { state.input?.close(); } catch {}
  try { state.output?.close(); } catch {}
  state.input = null;
  state.output = null;
  state.inputName = null;
  state.outputName = null;
  state.handshakeDone = false;
  state.ackResolver = null;
  state.ackRejecter = null;
  state.ackTimer = null;
  state.pingTimer = null;
  state.topologyTimer = null;
  state.topologyHandshakeActive = false;
  state.ledQueue = [];
  state.pendingLedData = null;
  state.nextLedSendAttemptAt = null;
  state.activeLedTopologyIndex = null;
  state.pads.clear();
  emitStatus();
}

export function sendServerRoliTestFrame(): boolean {
  stopServerRoliScreensaver('test-frame');
  const pads = getPads().filter((pad) => pad.handshakeDone);
  if (pads.length === 0) return sendLedData(rgbaFrameToLedData(createTestFrame()), true);
  let sent = false;
  for (const pad of pads) {
    const frame = pad.role === 'colour-wheel' ? createColourWheelFrame(0, null) : createTestFrame();
    sent = sendLedDataForPad(pad, rgbaFrameToLedData(frame), true) || sent;
  }
  return sent;
}

export function serverRoliOwnsPort(portName: string): boolean {
  return Boolean(state.inputName === portName || state.outputName === portName);
}

export function getServerRoliStatus(): ServerRoliStatus {
  const pads = getPads();
  const readyPads = pads.filter((pad) => pad.handshakeDone);
  const nextLedSendAttemptAt = pads
    .map((pad) => pad.nextLedSendAttemptAt)
    .filter((value): value is number => typeof value === 'number')
    .sort((a, b) => a - b)[0] ?? null;
  const lastLedSendErrorAt = pads.reduce<number | null>((latest, pad) => {
    if (!pad.lastLedSendErrorAt) return latest;
    return Math.max(latest || 0, pad.lastLedSendErrorAt);
  }, null);
  return {
    enabled: state.enabled,
    connected: Boolean(state.input && state.output),
    inputName: state.inputName,
    outputName: state.outputName,
    handshakeDone: readyPads.length > 0,
    sysexRx: state.sysexRx,
    sysexTx: state.sysexTx,
    ackCount: state.ackCount,
    touchCount: state.touchCount,
    lastTouch: state.lastTouch,
    lastError: state.lastError,
    lastEventAt: state.lastEventAt,
    screensaverEnabled: state.screensaverEnabled,
    screensaverActive: state.screensaverActive,
    browserClientCount: state.browserClientCount,
    lastBrowserSeenAt: state.lastBrowserSeenAt,
    ledSendFailureCount: pads.reduce((count, pad) => count + pad.ledSendFailureCount, 0),
    nextLedSendAttemptAt,
    lastLedSendErrorAt,
    devices: pads.map((pad) => ({
      deviceId: pad.deviceId,
      topologyIndex: pad.topologyIndex,
      topologySerial: pad.topologySerial,
      role: pad.role,
      handshakeDone: pad.handshakeDone,
      touchCount: pad.touchCount,
      lastTouch: pad.lastTouch,
      lastEventAt: pad.lastEventAt,
      ledSendFailureCount: pad.ledSendFailureCount,
      nextLedSendAttemptAt: pad.nextLedSendAttemptAt,
      lastLedSendErrorAt: pad.lastLedSendErrorAt,
      lastError: pad.lastError,
    })),
  };
}
