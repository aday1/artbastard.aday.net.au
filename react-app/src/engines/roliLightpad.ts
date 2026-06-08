/**
 * Roli Lightpad Block engine (ArtBastard build).
 *
 * Adapted from Roliblocks-Remix/Macroverse engine. Provides:
 *  - Web MIDI + SysEx connection lifecycle
 *  - Touch parser (SysEx 0x11/0x13/0x15 -> normalized x,y,z,phase)
 *  - LED grid output via the BLOCKS DataChangeList protocol
 *  - 15x15 BGR565 pixel buffer composition helpers
 *
 * Pure module — no React. Wrap in `useRoliLightpad` for component use.
 */

export const ROLI_GRID_COLS = 15;
export const ROLI_GRID_ROWS = 15;

const DEVICE_INDEX = 0x00;
const LED_DATA_OFFSET = 113;
const LED_PIXEL_COUNT = ROLI_GRID_COLS * ROLI_GRID_ROWS;
const LED_BYTE_COUNT = LED_PIXEL_COUNT * 2;
const LED_SEND_INTERVAL_MS = 40;
const MAX_PACKET_SIZE = 200;
const PACKET_COUNTER_MAX = 0x03ff;

export type TouchPhase = 'start' | 'move' | 'end';

export interface RoliTouchEvent {
  x: number; // 0..1
  y: number; // 0..1 (raw — top-origin like the device)
  z: number; // 0..1 pressure (approximate)
  phase: TouchPhase;
}

export type RoliTouchCallback = (ev: RoliTouchEvent) => void;
export type RoliDeviceChangeCallback = (info: {
  connected: boolean;
  inputName: string | null;
  outputName: string | null;
}) => void;
export type RoliHandshakeCallback = (done: boolean) => void;

interface InternalState {
  midiAccess: WebMidi.MIDIAccess | null;
  input: WebMidi.MIDIInput | null;
  output: WebMidi.MIDIOutput | null;
  inputName: string | null;
  outputName: string | null;
  handshakeDone: boolean;
  packetCounter: number;
  prevLedData: Uint8Array;
  lastLedSend: number;
  ledFailCount: number;
  sysexBuf: number[];
  lastX: number;
  lastY: number;
  lastZ: number;
  needsFullRepaint: boolean;
  onTouch: RoliTouchCallback | null;
  onDevice: RoliDeviceChangeCallback | null;
  onHandshake: RoliHandshakeCallback | null;
}

const s: InternalState = {
  midiAccess: null,
  input: null,
  output: null,
  inputName: null,
  outputName: null,
  handshakeDone: false,
  packetCounter: 0,
  prevLedData: new Uint8Array(LED_BYTE_COUNT),
  lastLedSend: 0,
  ledFailCount: 0,
  sysexBuf: [],
  lastX: 0.5,
  lastY: 0.5,
  lastZ: 0,
  needsFullRepaint: false,
  onTouch: null,
  onDevice: null,
  onHandshake: null,
};

class Packed7BitBuilder {
  _data: number[] = [];
  _written = 0;
  _bits = 0;
  clone(): Packed7BitBuilder {
    const c = new Packed7BitBuilder();
    c._data = this._data.slice();
    c._written = this._written;
    c._bits = this._bits;
    return c;
  }
  size(): number {
    return this._written + (this._bits > 0 ? 1 : 0);
  }
  getData(): number[] {
    return this._data.slice(0, this.size());
  }
  writeBits(value: number, numBits: number): void {
    while (numBits > 0) {
      if (this._bits === 0) {
        if (numBits < 7) {
          this._data[this._written] = value & 0x7f;
          this._bits = numBits;
          return;
        }
        if (numBits === 7) {
          this._data[this._written++] = value & 0x7f;
          return;
        }
        this._data[this._written++] = value & 0x7f;
        value >>>= 7;
        numBits -= 7;
      } else {
        const todo = Math.min(7 - this._bits, numBits);
        this._data[this._written] =
          (this._data[this._written] || 0) | ((value & ((1 << todo) - 1)) << this._bits);
        value >>>= todo;
        numBits -= todo;
        this._bits += todo;
        if (this._bits === 7) {
          this._bits = 0;
          this._written++;
        }
      }
    }
  }
}

function buildBlockSysEx(deviceIndex: number, payload: number[]): Uint8Array {
  const len = payload.length + 8;
  const d = new Uint8Array(len);
  d[0] = 0xf0;
  d[1] = 0x00;
  d[2] = 0x21;
  d[3] = 0x10;
  d[4] = 0x77;
  d[5] = deviceIndex & 0x7f;
  for (let i = 0; i < payload.length; i++) d[6 + i] = payload[i] & 0x7f;
  d[len - 1] = 0xf7;
  let ck = (len - 8) & 0xff;
  for (let i = 6; i < len - 2; i++) {
    ck = (ck + ck * 2 + d[i]) & 0xff;
  }
  d[len - 2] = ck & 0x7f;
  return d;
}

function sendSysEx(payload: number[]): void {
  if (!s.output) return;
  try {
    s.output.send(buildBlockSysEx(DEVICE_INDEX, payload));
  } catch {
    s.ledFailCount++;
  }
}

function rgbaToBgr565(r: number, g: number, b: number, a: number): number {
  const af = a / 255;
  const r5 = ((r * af) >> 3) & 0x1f;
  const g6 = ((g * af) >> 2) & 0x3f;
  const b5 = ((b * af) >> 3) & 0x1f;
  return (b5 << 11) | (g6 << 5) | r5;
}

function buildDataChangeMessages(newData: Uint8Array, oldData: Uint8Array): number[][] {
  const b = new Packed7BitBuilder();
  const queued: number[][] = [];
  let pktIdx = s.packetCounter;

  function initPacket(): void {
    b._data = [];
    b._written = 0;
    b._bits = 0;
    b.writeBits(0x02, 7);
    b.writeBits(pktIdx & PACKET_COUNTER_MAX, 16);
  }

  function flushPacket(endOfChanges: boolean): void {
    const fin = b.clone();
    fin.writeBits(endOfChanges ? 1 : 0, 3);
    queued.push(fin.getData());
    pktIdx++;
    if (!endOfChanges) initPacket();
  }

  function skipBytes(count: number): void {
    while (count > 0) {
      if (b.size() >= MAX_PACKET_SIZE - 3) {
        flushPacket(false);
        appendSkipToOffset();
      }
      if (count > 15) {
        const chunk = Math.min(255, count);
        b.writeBits(3, 3);
        b.writeBits(chunk, 8);
        count -= chunk;
      } else {
        b.writeBits(2, 3);
        b.writeBits(count, 4);
        count = 0;
      }
    }
  }

  let currentOffset = 0;
  function appendSkipToOffset(): void {
    skipBytes(LED_DATA_OFFSET + currentOffset);
  }

  initPacket();
  skipBytes(LED_DATA_OFFSET);

  let i = 0;
  while (i < LED_BYTE_COUNT) {
    if (newData[i] === oldData[i]) {
      i++;
      currentOffset = i;
      continue;
    }
    let runEnd = i;
    while (runEnd < LED_BYTE_COUNT && newData[runEnd] !== oldData[runEnd]) runEnd++;
    const seq = newData.subarray(i, runEnd);
    if (i > currentOffset) skipBytes(i - currentOffset);
    let written = 0;
    while (written < seq.length) {
      const avail = MAX_PACKET_SIZE - b.size();
      if (avail < 4) {
        currentOffset = i + written;
        flushPacket(false);
        appendSkipToOffset();
      }
      let chunk = Math.min(seq.length - written, Math.floor((MAX_PACKET_SIZE - b.size() - 1) * 7 / 9));
      if (chunk < 1) chunk = 1;
      b.writeBits(4, 3);
      for (let j = 0; j < chunk; j++) {
        b.writeBits(seq[written + j], 8);
        b.writeBits(j < chunk - 1 ? 1 : 0, 1);
      }
      written += chunk;
    }
    i = runEnd;
    currentOffset = i;
  }

  flushPacket(true);
  s.packetCounter = pktIdx;
  return queued;
}

const BITMAP_LED_DUMP_1 =
  '02 01 00 30 5A 3E 47 0B 20 01 3A 00 10 71 01 12 4B 31 09 08 60 46 5F 25 11 40 05 02 28 61 01 17 54 11 40 10 36 78 21 12 6D 1C 30 5B 00 2E 28 63 00 23 6C 70 43 24 5A 39 60 32 01 28 09 41 0D 3E 28 24 10 1B 04 51 48 1A 0A 08 22 09 1B 2C 30 45 0D 2E 08 24 20 1B 1C 00 5B 6C 50 41 16 36 58 20 10 01 6D 50 40 2D 36 58 60 0B 01 6D 70 40 2D 3A 78 3F 00 0F 1C 78 4F 07 2E 28 78 08 19 04 52 06 15 01 48 24 00 21 64 10 48 1A 02 18 60 0C 01 4C 70 40 05 7C 3F 00 7F 0F 60 7F 03 78 7F 00 7E 1F 40 7F 07 70 7F 01 7C 3F 00 7F 0F 60 7F 03 78 7F 00 7E 1F 40 7F 07 70 7F 01 7C 3F 00 7F 0F 00';
const BITMAP_LED_DUMP_2 =
  '02 02 00 0C 5C 7F 07 70 7F 01 7C 3F 00 7F 0F 60 7F 03 78 7F 00 7E 1F 40 7F 07 70 7F 01 7C 3F 00 7F 0F 60 7F 03 78 7F 00 7E 1F 40 7F 07 70 7F 01 7C 3F 00 7F 0F 60 7F 03 78 7F 00 7E 1F 40 7F 07 70 7F 01 7C 3F 00 7F 0F 60 7F 03 78 7F 00 1E 19 00 4B';

function parseDump(hex: string): number[] {
  return hex.trim().split(/\s+/).map((h) => parseInt(h, 16));
}

function doHandshake(): void {
  if (!s.output) return;
  sendSysEx([0x01, 0x02, 0x00]);
  sendSysEx([0x01, 0x00, 0x00]);
  setTimeout(() => {
    sendSysEx([0x01, 0x00, 0x00]);
    sendSysEx([0x01, 0x03, 0x00]);
    sendSysEx([0x10, 0x02]);
    setTimeout(() => {
      sendSysEx([0x01, 0x03, 0x00]);
      sendSysEx(parseDump(BITMAP_LED_DUMP_1));
      sendSysEx(parseDump(BITMAP_LED_DUMP_2));
      setTimeout(() => {
        sendSysEx([0x01, 0x05, 0x00]);
        s.handshakeDone = true;
        s.packetCounter = 1;
        s.prevLedData = new Uint8Array(LED_BYTE_COUNT);
        // The handshake's BITMAP_LED_DUMP_1/2 leaves a junk pattern on the
        // grid. Force the next sendLedFrame to encode every pixel so the
        // first user frame wipes that pattern in one shot.
        s.needsFullRepaint = true;
        s.onHandshake?.(true);
      }, 100);
    }, 100);
  }, 100);
}

function read7BitBits(data: Uint8Array, bitPos: number, numBits: number): number {
  let v = 0;
  let read = 0;
  while (read < numBits) {
    const byteIdx = Math.floor((bitPos + read) / 7);
    const bitInByte = (bitPos + read) % 7;
    const avail = 7 - bitInByte;
    const toRead = Math.min(numBits - read, avail);
    v |= ((data[byteIdx] >>> bitInByte) & ((1 << toRead) - 1)) << read;
    read += toRead;
  }
  return v;
}

function emitTouch(x: number, y: number, z: number, phase: TouchPhase): void {
  s.lastX = x;
  s.lastY = y;
  s.lastZ = z;
  s.onTouch?.({ x, y, z, phase });
}

function parseRoliTouchSysex(data: Uint8Array): void {
  if (data.length < 8) return;
  const msgData = data.subarray(5, data.length - 2);
  let bitPos = 39;
  while (bitPos + 7 <= msgData.length * 7) {
    const msgType = read7BitBits(msgData, bitPos, 7);
    bitPos += 7;
    if (msgType === 0x11) {
      bitPos += 5 + 5;
      const x = read7BitBits(msgData, bitPos, 12);
      bitPos += 12;
      const y = read7BitBits(msgData, bitPos, 12);
      bitPos += 12 + 8;
      emitTouch(x / 4095, y / 4095, s.lastZ || 0.5, 'move');
      return;
    }
    if (msgType === 0x13 || msgType === 0x15) {
      bitPos += 5 + 5;
      const x = read7BitBits(msgData, bitPos, 12);
      bitPos += 12;
      const y = read7BitBits(msgData, bitPos, 12);
      bitPos += 8;
      if (msgType === 0x13) bitPos += 24;
      emitTouch(x / 4095, y / 4095, msgType === 0x13 ? 0.7 : 0, msgType === 0x13 ? 'start' : 'end');
      return;
    }
    break;
  }
}

function onMidiMessage(event: WebMidi.MIDIMessageEvent): void {
  const d = event.data;
  if (!d || d.length < 1) return;

  if (d[0] === 0xf0) {
    s.sysexBuf = Array.from(d);
  } else if (s.sysexBuf.length > 0) {
    s.sysexBuf.push(...Array.from(d as unknown as number[]));
  }
  if (s.sysexBuf.length > 0 && s.sysexBuf[s.sysexBuf.length - 1] === 0xf7) {
    const full = new Uint8Array(s.sysexBuf);
    if (
      full.length >= 8 &&
      full[1] === 0x00 &&
      full[2] === 0x21 &&
      full[3] === 0x10 &&
      full[4] === 0x77
    ) {
      parseRoliTouchSysex(full);
    }
    s.sysexBuf = [];
    return;
  }

  // MPE fallback for Lightpad firmwares that emit MIDI rather than touch SysEx.
  if (d[0] !== 0xf0 && s.sysexBuf.length === 0) {
    const cmd = d[0] >> 4;
    if (cmd === 0x09 && d.length >= 3 && d[2] > 0) {
      emitTouch(s.lastX, s.lastY, d[2] / 127, 'start');
    } else if (cmd === 0x08 && d.length >= 3) {
      emitTouch(s.lastX, s.lastY, 0, 'end');
    } else if (cmd === 0x0b && d.length >= 3 && d[1] === 74) {
      emitTouch(s.lastX, d[2] / 127, s.lastZ, 'move');
    } else if (cmd === 0x0e && d.length >= 3) {
      const bend = (d[2] * 128 + d[1]) / 16383;
      emitTouch(bend, s.lastY, s.lastZ, 'move');
    } else if (cmd === 0x0d && d.length >= 2) {
      emitTouch(s.lastX, s.lastY, d[1] / 127, 'move');
    }
  }
}

export function isRoliblockLike(name: string): boolean {
  const n = (name || '').toLowerCase();
  return (
    n.includes('roli') || n.includes('lightpad') || n.includes('block') || n.includes('seaboard')
  );
}

function refreshAndAutoMap(): void {
  if (!s.midiAccess) return;
  let chosenInput: WebMidi.MIDIInput | null = null;
  let chosenOutput: WebMidi.MIDIOutput | null = null;
  s.midiAccess.inputs.forEach((inp) => {
    if (!chosenInput && isRoliblockLike(inp.name || '')) chosenInput = inp;
  });
  s.midiAccess.outputs.forEach((out) => {
    if (!chosenOutput && isRoliblockLike(out.name || '')) chosenOutput = out;
  });

  if (chosenInput && chosenInput !== s.input) {
    if (s.input) s.input.onmidimessage = null;
    s.input = chosenInput;
    s.inputName = chosenInput.name || null;
    chosenInput.onmidimessage = onMidiMessage;
  } else if (!chosenInput && s.input) {
    s.input.onmidimessage = null;
    s.input = null;
    s.inputName = null;
  }

  if (chosenOutput && chosenOutput !== s.output) {
    s.output = chosenOutput;
    s.outputName = chosenOutput.name || null;
    s.handshakeDone = false;
    s.onHandshake?.(false);
    s.ledFailCount = 0;
    doHandshake();
  } else if (!chosenOutput && s.output) {
    s.output = null;
    s.outputName = null;
    s.handshakeDone = false;
    s.onHandshake?.(false);
  }

  s.onDevice?.({
    connected: !!(s.input || s.output),
    inputName: s.inputName,
    outputName: s.outputName,
  });
}

export async function connectRoliLightpad(): Promise<boolean> {
  if (s.midiAccess) {
    refreshAndAutoMap();
    return !!(s.input || s.output);
  }
  if (typeof navigator === 'undefined' || !navigator.requestMIDIAccess) return false;
  try {
    s.midiAccess = await navigator.requestMIDIAccess({ sysex: true });
    s.midiAccess.onstatechange = () => refreshAndAutoMap();
    refreshAndAutoMap();
    return !!(s.input || s.output);
  } catch {
    return false;
  }
}

export function disconnectRoliLightpad(): void {
  if (s.input) s.input.onmidimessage = null;
  if (s.midiAccess) s.midiAccess.onstatechange = null;
  s.input = null;
  s.output = null;
  s.inputName = null;
  s.outputName = null;
  s.handshakeDone = false;
  s.midiAccess = null;
  s.sysexBuf = [];
  s.onTouch = null;
  s.onDevice = null;
}

export function setOnTouch(cb: RoliTouchCallback | null): void {
  s.onTouch = cb;
}

export function setOnDeviceChange(cb: RoliDeviceChangeCallback | null): void {
  s.onDevice = cb;
}

export function setOnHandshakeDone(cb: RoliHandshakeCallback | null): void {
  s.onHandshake = cb;
}

export function getRoliStatus(): { connected: boolean; inputName: string | null; outputName: string | null; handshakeDone: boolean } {
  return {
    connected: !!(s.input || s.output),
    inputName: s.inputName,
    outputName: s.outputName,
    handshakeDone: s.handshakeDone,
  };
}

/**
 * Send a 15x15 RGBA pixel buffer to the Lightpad LEDs.
 * `pixels` must be ROLI_GRID_COLS * ROLI_GRID_ROWS * 4 bytes (RGBA).
 * Throttled to LED_SEND_INTERVAL_MS — call frequently; older frames are dropped.
 */
export function sendLedFrame(pixels: Uint8ClampedArray | Uint8Array): boolean {
  if (!s.output || !s.handshakeDone) return false;
  if (s.ledFailCount > 20) return false;
  const now = Date.now();
  if (now - s.lastLedSend < LED_SEND_INTERVAL_MS) return false;
  s.lastLedSend = now;

  if (pixels.length < LED_PIXEL_COUNT * 4) return false;
  const newLed = new Uint8Array(LED_BYTE_COUNT);
  for (let i = 0; i < LED_PIXEL_COUNT; i++) {
    const r = pixels[i * 4];
    const g = pixels[i * 4 + 1];
    const b = pixels[i * 4 + 2];
    const a = pixels[i * 4 + 3];
    const c16 = rgbaToBgr565(r, g, b, a);
    newLed[i * 2] = c16 & 0xff;
    newLed[i * 2 + 1] = (c16 >> 8) & 0xff;
  }

  // After handshake (or any reconnect) the device's LED state is the dump
  // pattern, not zeros. Force every byte to look different from prev so the
  // diff encoder emits a full frame and wipes the pattern.
  let prevForDiff = s.prevLedData;
  if (s.needsFullRepaint) {
    prevForDiff = new Uint8Array(LED_BYTE_COUNT);
    for (let i = 0; i < LED_BYTE_COUNT; i++) prevForDiff[i] = newLed[i] ^ 0xff;
    s.needsFullRepaint = false;
  }
  const messages = buildDataChangeMessages(newLed, prevForDiff);
  for (const msg of messages) {
    try {
      s.output.send(buildBlockSysEx(DEVICE_INDEX, msg));
    } catch {
      s.ledFailCount++;
      return false;
    }
  }
  s.ledFailCount = 0;
  s.prevLedData = newLed;
  return true;
}

/**
 * Helper: build a 15x15 RGBA frame from a normalized path (0..1 coords) plus a
 * bright cursor dot. Trail pixels use `trailColor`, cursor uses `cursorColor`.
 */
export function composeLedFrame(opts: {
  path?: Array<{ x: number; y: number }>;
  cursor?: { x: number; y: number } | null;
  trailColor?: [number, number, number, number];
  cursorColor?: [number, number, number, number];
  bgColor?: [number, number, number, number];
}): Uint8ClampedArray {
  const pixels = new Uint8ClampedArray(LED_PIXEL_COUNT * 4);
  const bg = opts.bgColor ?? [0, 0, 0, 0];
  for (let i = 0; i < LED_PIXEL_COUNT; i++) {
    pixels[i * 4] = bg[0];
    pixels[i * 4 + 1] = bg[1];
    pixels[i * 4 + 2] = bg[2];
    pixels[i * 4 + 3] = bg[3];
  }
  // Bright trail so a single-pixel path is actually readable on the 15x15
  // BGR565 grid (the old [60,20,80,160] quantised down to ~r5=4 / b5=12 — a
  // hint at best). [110,40,210,255] keeps the violet identity but lights up.
  const trail = opts.trailColor ?? [110, 40, 210, 255];
  const cursorC = opts.cursorColor ?? [255, 120, 255, 255];

  const plot = (nx: number, ny: number, color: [number, number, number, number]) => {
    const cx = Math.max(0, Math.min(ROLI_GRID_COLS - 1, Math.round(nx * (ROLI_GRID_COLS - 1))));
    const cy = Math.max(0, Math.min(ROLI_GRID_ROWS - 1, Math.round(ny * (ROLI_GRID_ROWS - 1))));
    const idx = (cy * ROLI_GRID_COLS + cx) * 4;
    pixels[idx] = color[0];
    pixels[idx + 1] = color[1];
    pixels[idx + 2] = color[2];
    pixels[idx + 3] = color[3];
  };

  if (opts.path && opts.path.length > 0) {
    for (const p of opts.path) plot(p.x, p.y, trail);
  }
  if (opts.cursor) {
    const { x, y } = opts.cursor;
    plot(x, y, cursorC);
    // simple 4-neighbour halo at half brightness
    const halo: [number, number, number, number] = [
      Math.round(cursorC[0] / 2),
      Math.round(cursorC[1] / 2),
      Math.round(cursorC[2] / 2),
      Math.round(cursorC[3] / 2),
    ];
    plot(x + 1 / (ROLI_GRID_COLS - 1), y, halo);
    plot(x - 1 / (ROLI_GRID_COLS - 1), y, halo);
    plot(x, y + 1 / (ROLI_GRID_ROWS - 1), halo);
    plot(x, y - 1 / (ROLI_GRID_ROWS - 1), halo);
  }
  return pixels;
}
