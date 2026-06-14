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
  lastTouch: { x: number; y: number; z: number; phase: string } | null;
  lastError: string | null;
  lastEventAt: number | null;
  screensaverEnabled: boolean;
  screensaverActive: boolean;
  browserClientCount: number;
  lastBrowserSeenAt: number | null;
  touchTrail: Array<{ x: number; y: number }>;
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
};

function isRoliLikeName(name: string): boolean {
  const n = (name || '').toLowerCase();
  return n.includes('roli') || n.includes('lightpad') || n.includes('block') || n.includes('seaboard') || n.includes('holybell');
}

export function isServerRoliPort(name: string): boolean {
  return isRoliLikeName(name) && Boolean(state.inputName || state.outputName);
}

function parseDump(hex: string): number[] {
  return hex.trim().split(/\s+/).map((value) => parseInt(value, 16));
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

function sendSysEx(payload: number[], note: string): void {
  if (!state.output) throw new Error('No ROLI output port');
  const bytes = buildBlockSysEx(HOST_DEVICE_INDEX, payload);
  state.output.send('sysex', bytes);
  state.sysexTx += 1;
  state.lastEventAt = Date.now();
  log(`ROLI server tx ${note}`, 'MIDI', {
    bytes: payload.length,
    output: state.outputName,
    verboseOnly: note === 'ping'
  });
}

function waitForAck(timeoutMs = 900): Promise<void> {
  return new Promise((resolve, reject) => {
    if (state.ackTimer) clearTimeout(state.ackTimer);
    state.ackResolver = resolve;
    state.ackRejecter = reject;
    state.ackTimer = setTimeout(() => {
      state.ackResolver = null;
      state.ackRejecter = null;
      state.ackTimer = null;
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

function createScreensaverFrame(frame: number): Uint8ClampedArray {
  const pixels = new Uint8ClampedArray(LED_PIXEL_COUNT * 4);
  const t = frame / 9;
  const cx = (Math.sin(t / 7) + 1) * 0.5 * (ROLI_GRID_COLS - 1);
  const cy = (Math.cos(t / 9) + 1) * 0.5 * (ROLI_GRID_ROWS - 1);
  for (let y = 0; y < ROLI_GRID_ROWS; y++) {
    for (let x = 0; x < ROLI_GRID_COLS; x++) {
      const index = (y * ROLI_GRID_COLS + x) * 4;
      const wave = (Math.sin((x * 0.68) + t) + Math.cos((y * 0.58) - t * 0.82) + 2) / 4;
      const distance = Math.hypot(x - cx, y - cy);
      const pulse = Math.max(0, 1 - distance / 8);
      const hue = (t * 21 + x * 11 + y * 7) % 360;
      const brightness = Math.max(0.12, Math.min(0.95, wave * 0.52 + pulse * 0.42));
      const [red, green, blue] = hsvToRgb(hue, 0.9, brightness);
      pixels[index] = red;
      pixels[index + 1] = green;
      pixels[index + 2] = blue;
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

function createServerTouchFrame(cursor: { x: number; y: number; z: number; phase: string }): Uint8ClampedArray {
  const pixels = new Uint8ClampedArray(LED_PIXEL_COUNT * 4);
  for (let y = 0; y < ROLI_GRID_ROWS; y++) {
    for (let x = 0; x < ROLI_GRID_COLS; x++) {
      const index = (y * ROLI_GRID_COLS + x) * 4;
      const [red, green, blue] = makeColorStripPixel(x, y);
      pixels[index] = Math.round(red * 0.36);
      pixels[index + 1] = Math.round(green * 0.36);
      pixels[index + 2] = Math.round(blue * 0.36);
      pixels[index + 3] = 255;
    }
  }

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

  const drawLine = (from: { x: number; y: number }, to: { x: number; y: number }, color: [number, number, number, number]) => {
    let { x: x0, y: y0 } = toCell(from);
    const { x: x1, y: y1 } = toCell(to);
    const dx = Math.abs(x1 - x0);
    const sx = x0 < x1 ? 1 : -1;
    const dy = -Math.abs(y1 - y0);
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    while (true) {
      put(x0, y0, color);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  };

  const recentTrail = state.touchTrail.slice(-TOUCH_TRAIL_POINTS);
  for (let index = 1; index < recentTrail.length; index++) {
    const fade = index / Math.max(1, recentTrail.length - 1);
    drawLine(recentTrail[index - 1], recentTrail[index], [Math.round(130 + fade * 125), Math.round(15 + fade * 40), 0, 255]);
  }

  const cell = toCell(cursor);
  const dimCross: [number, number, number, number] = cursor.phase === 'end' ? [150, 30, 0, 255] : [255, 42, 0, 255];
  const hot: [number, number, number, number] = cursor.phase === 'end' ? [255, 90, 30, 255] : [255, 255, 255, 255];
  for (let x = 0; x < ROLI_GRID_COLS; x++) put(x, cell.y, dimCross);
  for (let y = 0; y < ROLI_GRID_ROWS; y++) put(cell.x, y, dimCross);
  for (let radius = 1; radius <= 3; radius++) {
    for (let y = -radius; y <= radius; y++) {
      for (let x = -radius; x <= radius; x++) {
        const dist = Math.hypot(x, y);
        if (Math.abs(dist - radius) <= 0.45) put(cell.x + x, cell.y + y, radius === 1 ? hot : dimCross);
      }
    }
  }
  put(cell.x, cell.y, [255, 255, 255, 255]);
  return pixels;
}

function shouldRunServerScreensaver(): boolean {
  return Boolean(
    state.screensaverEnabled &&
    state.input &&
    state.output &&
    state.handshakeDone &&
    state.browserClientCount === 0
  );
}

function startServerRoliScreensaver(reason = 'no-browser'): void {
  if (state.screensaverActive || !shouldRunServerScreensaver()) return;
  state.screensaverActive = true;
  state.screensaverFrame = 0;
  log('ROLI server screensaver started', 'MIDI', { reason, idleMs: SCREENSAVER_IDLE_MS, frameMs: SCREENSAVER_FRAME_MS });
  state.screensaverTimer = setInterval(() => {
    if (!shouldRunServerScreensaver()) {
      stopServerRoliScreensaver('browser-or-device-state-changed');
      return;
    }
    if (state.ledQueue.length > 0) return;
    sendLedData(rgbaFrameToLedData(createScreensaverFrame(state.screensaverFrame++)), false);
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
  log('ROLI server screensaver stopped', 'MIDI', { reason });
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
  const lastSeen = state.lastBrowserSeenAt || Date.now();
  if (Date.now() - lastSeen >= SCREENSAVER_IDLE_MS) {
    startServerRoliScreensaver('no-browser-clients');
  }
}

function ensureScreensaverMonitor(): void {
  if (state.screensaverMonitor) return;
  state.screensaverMonitor = setInterval(evaluateServerRoliScreensaver, 1000);
}

function emitTouch(x: number, y: number, z: number, phase: string): void {
  state.touchCount += 1;
  state.lastTouch = { x, y, z, phase };
  state.lastEventAt = Date.now();
  if (phase === 'start') state.touchTrail = [{ x, y }];
  else if (phase === 'move') {
    state.touchTrail.push({ x, y });
    if (state.touchTrail.length > TOUCH_TRAIL_POINTS) state.touchTrail.splice(0, state.touchTrail.length - TOUCH_TRAIL_POINTS);
  } else if (phase === 'end' && state.touchTrail.length === 0) {
    state.touchTrail = [{ x, y }];
  }

  stopServerRoliScreensaver('touch');
  sendLedData(rgbaFrameToLedData(createServerTouchFrame(state.lastTouch)), false);

  state.io?.emit('serverRoliTouch', { ...state.lastTouch, role: 'primary', sourceTransport: 'server', inputName: state.inputName, outputName: state.outputName });
  log(`ROLI server touch ${phase}`, 'MIDI', {
    source: state.inputName,
    x: Number(x.toFixed(3)),
    y: Number(y.toFixed(3)),
    z: Number(z.toFixed(3)),
    verboseOnly: phase === 'move'
  });
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
  let bitPos = 39;
  const firstType = read7BitBits(msgData, bitPos, 7);

  if (firstType === 0x02) {
    bitPos += 7;
    const counter = read7BitBits(msgData, bitPos, 10);
    state.ackCount += 1;
    log('ROLI server ack', 'MIDI', { counter, input: state.inputName, verboseOnly: true });
    if (state.ackResolver) {
      if (state.ackTimer) clearTimeout(state.ackTimer);
      const resolver = state.ackResolver;
      state.ackResolver = null;
      state.ackRejecter = null;
      state.ackTimer = null;
      resolver();
    } else if (state.ledQueue.length > 0) {
      sendNextLedPacket();
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
      emitTouch(x / 4095, y / 4095, state.lastTouch?.z ?? 0.5, 'move');
      return;
    }
    if (msgType === 0x13 || msgType === 0x15) {
      bitPos += 5 + 5;
      const x = read7BitBits(msgData, bitPos, 12);
      bitPos += 12;
      const y = read7BitBits(msgData, bitPos, 12);
      emitTouch(x / 4095, y / 4095, msgType === 0x13 ? 0.7 : 0, msgType === 0x13 ? 'start' : 'end');
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

function buildDataChangeMessages(newData: Uint8Array, oldData: Uint8Array): number[][] {
  const queued: number[][] = [];
  const startPacketIndex = state.packetCounter;
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
  state.packetCounter = (startPacketIndex + queued.length) & PACKET_COUNTER_MAX;
  return queued;
}

function sendNextLedPacket(): void {
  if (!state.output || state.ledQueue.length === 0) {
    if (state.pendingLedData) {
      state.prevLedData = state.pendingLedData;
      state.pendingLedData = null;
    }
    return;
  }
  const next = state.ledQueue.shift()!;
  state.output.send('sysex', buildBlockSysEx(HOST_DEVICE_INDEX, next));
  state.sysexTx += 1;
  state.lastEventAt = Date.now();
  log('ROLI server LED packet', 'MIDI', { remaining: state.ledQueue.length, bytes: next.length, output: state.outputName, verboseOnly: true });
}

function sendLedData(newLed: Uint8Array, forceFullFrame = false): boolean {
  if (!state.output || !state.handshakeDone) return false;
  if (state.ledQueue.length > 0) return false;
  let prev = state.prevLedData;
  if (forceFullFrame) {
    prev = new Uint8Array(LED_BYTE_COUNT);
    for (let index = 0; index < LED_BYTE_COUNT; index++) prev[index] = newLed[index] ^ 0xff;
  }
  state.ledQueue = buildDataChangeMessages(newLed, prev);
  state.pendingLedData = newLed;
  sendNextLedPacket();
  return true;
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

async function handshake(): Promise<void> {
  sendSysEx([0x01, 0x02, 0x00], 'endAPIMode');
  sendSysEx([0x01, 0x00, 0x00], 'beginAPIMode');
  await waitForAck();
  sendSysEx([0x01, 0x00, 0x00], 'beginAPIMode resend');
  await waitForAck();
  sendSysEx([0x01, 0x03, 0x00], 'ping');
  await waitForAck();
  sendSysEx([0x10, 0x02], 'config midiUseMPE');
  await waitForAck();
  sendSysEx([0x01, 0x03, 0x00], 'ping');
  await waitForAck();
  sendSysEx(parseDump(BITMAP_LED_DUMP_1), 'bitmap dump 1');
  sendSysEx(parseDump(BITMAP_LED_DUMP_2), 'bitmap dump 2');
  state.packetCounter = 3;
  await waitForAck(1200);
  sendSysEx([0x01, 0x05, 0x00], 'saveProgramAsDefault');
  await waitForAck();
  state.handshakeDone = true;
  state.lastError = null;
  state.prevLedData = new Uint8Array(LED_BYTE_COUNT);
  if (state.pingTimer) clearInterval(state.pingTimer);
  state.pingTimer = setInterval(() => {
    if (state.output && state.handshakeDone && state.ledQueue.length === 0) {
      try { sendSysEx([0x01, 0x03, 0x00], 'ping'); } catch {}
    }
  }, 500);
  log('ROLI server handshake complete', 'MIDI', { input: state.inputName, output: state.outputName });
  sendLedData(rgbaFrameToLedData(createTestFrame()), true);
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
    const claimedInputName = pair.inputName;
    const claimedOutputName = pair.outputName;
    void handshake().catch((error) => {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const failedInputName = state.inputName;
      const failedOutputName = state.outputName;
      state.handshakeDone = false;
      state.lastError = errorMessage;
      log('ROLI server handshake failed', 'ERROR', { error: state.lastError, input: failedInputName, output: failedOutputName });
      if (state.inputName === claimedInputName && state.outputName === claimedOutputName) {
        disconnectServerRoli();
        state.lastError = errorMessage;
        log('ROLI server released MIDI ports after failed handshake', 'MIDI', {
          input: failedInputName,
          output: failedOutputName,
        });
      }
      emitStatus();
    });
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
  state.ledQueue = [];
  state.pendingLedData = null;
  emitStatus();
}

export function sendServerRoliTestFrame(): boolean {
  stopServerRoliScreensaver('test-frame');
  return sendLedData(rgbaFrameToLedData(createTestFrame()), true);
}

export function serverRoliOwnsPort(portName: string): boolean {
  return Boolean(state.inputName === portName || state.outputName === portName);
}

export function getServerRoliStatus(): ServerRoliStatus {
  return {
    enabled: state.enabled,
    connected: Boolean(state.input && state.output),
    inputName: state.inputName,
    outputName: state.outputName,
    handshakeDone: state.handshakeDone,
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
  };
}
