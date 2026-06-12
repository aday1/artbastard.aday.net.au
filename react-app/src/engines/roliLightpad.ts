/**
 * Roli Lightpad Block engine (ArtBastard build, multi-device).
 *
 * Adapted from Roliblocks-Remix/Macroverse. Supports an arbitrary number of
 * connected ROLI Lightpad Blocks, each with its own handshake state, LED diff
 * buffer, touch state, and assigned role ("primary" for the XY pad, "colour-
 * wheel" for the second block, etc.).
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

const ROLE_STORAGE_KEY = 'roli-device-roles';

export type TouchPhase = 'start' | 'move' | 'end';
export type RoliRole = 'primary' | 'colour-wheel';

export interface RoliTouchEvent {
  x: number; // 0..1
  y: number; // 0..1 (raw — top-origin like the device)
  z: number; // 0..1 pressure (approximate)
  phase: TouchPhase;
  deviceId: string;
  role: RoliRole;
}

export interface RoliDeviceInfo {
  deviceId: string;
  inputName: string | null;
  outputName: string | null;
  handshakeDone: boolean;
  role: RoliRole;
}

export type RoliTouchCallback = (ev: RoliTouchEvent) => void;
export type RoliDeviceChangeCallback = (devices: RoliDeviceInfo[]) => void;
export type RoliHandshakeCallback = (deviceId: string, done: boolean) => void;

interface DeviceState {
  deviceId: string; // == output name (canonical), or input name if no output
  input: WebMidi.MIDIInput | null;
  output: WebMidi.MIDIOutput | null;
  inputName: string | null;
  outputName: string | null;
  role: RoliRole;
  handshakeDone: boolean;
  packetCounter: number;
  prevLedData: Uint8Array;
  lastLedSend: number;
  ledFailCount: number;
  sysexBuf: number[];
  lastX: number;
  lastY: number;
  lastZ: number;
  isTouching: boolean;
  needsFullRepaint: boolean;
}

interface EngineState {
  midiAccess: WebMidi.MIDIAccess | null;
  devices: Map<string, DeviceState>;
  onTouch: RoliTouchCallback | null;
  onDevice: RoliDeviceChangeCallback | null;
  onHandshake: RoliHandshakeCallback | null;
}

const engine: EngineState = {
  midiAccess: null,
  devices: new Map(),
  onTouch: null,
  onDevice: null,
  onHandshake: null,
};

function loadRoleAssignments(): Record<string, RoliRole> {
  if (typeof localStorage === 'undefined') return {};
  try {
    const raw = localStorage.getItem(ROLE_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' && parsed != null ? parsed : {};
  } catch {
    return {};
  }
}

function saveRoleAssignments(map: Record<string, RoliRole>): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(ROLE_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // ignore
  }
}

function newDeviceState(deviceId: string, role: RoliRole): DeviceState {
  return {
    deviceId,
    input: null,
    output: null,
    inputName: null,
    outputName: null,
    role,
    handshakeDone: false,
    packetCounter: 0,
    prevLedData: new Uint8Array(LED_BYTE_COUNT),
    lastLedSend: 0,
    ledFailCount: 0,
    sysexBuf: [],
    lastX: 0.5,
    lastY: 0.5,
    lastZ: 0,
    isTouching: false,
    needsFullRepaint: false,
  };
}

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

function sendSysExTo(dev: DeviceState, payload: number[]): void {
  if (!dev.output) return;
  try {
    dev.output.send(buildBlockSysEx(DEVICE_INDEX, payload));
  } catch {
    dev.ledFailCount++;
  }
}

type LedRgba = [number, number, number, number];

function clamp01(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(1, v));
}

function clampByte(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(255, Math.round(v)));
}

export function rgbaToBgr565(r: number, g: number, b: number, a: number): number {
  const af = a / 255;
  const r5 = ((r * af) >> 3) & 0x1f;
  const g6 = ((g * af) >> 2) & 0x3f;
  const b5 = ((b * af) >> 3) & 0x1f;
  return (b5 << 11) | (g6 << 5) | r5;
}

export function rgbaFrameToRoliLedData(pixels: Uint8ClampedArray | Uint8Array): Uint8Array {
  if (pixels.length < LED_PIXEL_COUNT * 4) {
    throw new RangeError(`Roli LED frame needs ${LED_PIXEL_COUNT * 4} RGBA bytes`);
  }
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
  return newLed;
}

export function sampleRgbaToLedFrame(
  source: Uint8ClampedArray | Uint8Array,
  width: number,
  height: number,
  opts: { flipY?: boolean; exposure?: number } = {}
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(LED_PIXEL_COUNT * 4);
  const w = Math.max(0, Math.floor(width));
  const h = Math.max(0, Math.floor(height));
  if (w < 1 || h < 1 || source.length < w * h * 4) return out;

  const exposure = Number.isFinite(opts.exposure) ? opts.exposure ?? 1 : 1;
  for (let gy = 0; gy < ROLI_GRID_ROWS; gy++) {
    const y0 = Math.floor((gy * h) / ROLI_GRID_ROWS);
    const y1 = Math.max(y0 + 1, Math.floor(((gy + 1) * h) / ROLI_GRID_ROWS));
    for (let gx = 0; gx < ROLI_GRID_COLS; gx++) {
      const x0 = Math.floor((gx * w) / ROLI_GRID_COLS);
      const x1 = Math.max(x0 + 1, Math.floor(((gx + 1) * w) / ROLI_GRID_COLS));
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      let count = 0;
      for (let y = y0; y < Math.min(y1, h); y++) {
        const sy = opts.flipY ? h - 1 - y : y;
        for (let x = x0; x < Math.min(x1, w); x++) {
          const idx = (sy * w + x) * 4;
          r += source[idx];
          g += source[idx + 1];
          b += source[idx + 2];
          a += source[idx + 3];
          count++;
        }
      }
      if (count < 1) continue;
      const outIdx = (gy * ROLI_GRID_COLS + gx) * 4;
      out[outIdx] = clampByte((r / count) * exposure);
      out[outIdx + 1] = clampByte((g / count) * exposure);
      out[outIdx + 2] = clampByte((b / count) * exposure);
      out[outIdx + 3] = clampByte(a / count);
    }
  }
  return out;
}

function buildDataChangeMessages(
  dev: DeviceState,
  newData: Uint8Array,
  oldData: Uint8Array
): number[][] {
  const b = new Packed7BitBuilder();
  const queued: number[][] = [];
  let pktIdx = dev.packetCounter;

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
  dev.packetCounter = pktIdx;
  return queued;
}

const BITMAP_LED_DUMP_1 =
  '02 01 00 30 5A 3E 47 0B 20 01 3A 00 10 71 01 12 4B 31 09 08 60 46 5F 25 11 40 05 02 28 61 01 17 54 11 40 10 36 78 21 12 6D 1C 30 5B 00 2E 28 63 00 23 6C 70 43 24 5A 39 60 32 01 28 09 41 0D 3E 28 24 10 1B 04 51 48 1A 0A 08 22 09 1B 2C 30 45 0D 2E 08 24 20 1B 1C 00 5B 6C 50 41 16 36 58 20 10 01 6D 50 40 2D 36 58 60 0B 01 6D 70 40 2D 3A 78 3F 00 0F 1C 78 4F 07 2E 28 78 08 19 04 52 06 15 01 48 24 00 21 64 10 48 1A 02 18 60 0C 01 4C 70 40 05 7C 3F 00 7F 0F 60 7F 03 78 7F 00 7E 1F 40 7F 07 70 7F 01 7C 3F 00 7F 0F 60 7F 03 78 7F 00 7E 1F 40 7F 07 70 7F 01 7C 3F 00 7F 0F 00';
const BITMAP_LED_DUMP_2 =
  '02 02 00 0C 5C 7F 07 70 7F 01 7C 3F 00 7F 0F 60 7F 03 78 7F 00 7E 1F 40 7F 07 70 7F 01 7C 3F 00 7F 0F 60 7F 03 78 7F 00 7E 1F 40 7F 07 70 7F 01 7C 3F 00 7F 0F 60 7F 03 78 7F 00 7E 1F 40 7F 07 70 7F 01 7C 3F 00 7F 0F 60 7F 03 78 7F 00 1E 19 00 4B';

function parseDump(hex: string): number[] {
  return hex.trim().split(/\s+/).map((h) => parseInt(h, 16));
}

function doHandshake(dev: DeviceState): void {
  if (!dev.output) return;
  sendSysExTo(dev, [0x01, 0x02, 0x00]);
  sendSysExTo(dev, [0x01, 0x00, 0x00]);
  setTimeout(() => {
    sendSysExTo(dev, [0x01, 0x00, 0x00]);
    sendSysExTo(dev, [0x01, 0x03, 0x00]);
    sendSysExTo(dev, [0x10, 0x02]);
    setTimeout(() => {
      sendSysExTo(dev, [0x01, 0x03, 0x00]);
      sendSysExTo(dev, parseDump(BITMAP_LED_DUMP_1));
      sendSysExTo(dev, parseDump(BITMAP_LED_DUMP_2));
      setTimeout(() => {
        sendSysExTo(dev, [0x01, 0x05, 0x00]);
        dev.handshakeDone = true;
        dev.packetCounter = 1;
        dev.prevLedData = new Uint8Array(LED_BYTE_COUNT);
        dev.needsFullRepaint = true;
        engine.onHandshake?.(dev.deviceId, true);
        notifyDeviceChange();
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

function emitTouch(dev: DeviceState, x: number, y: number, z: number, phase: TouchPhase): void {
  dev.lastX = x;
  dev.lastY = y;
  dev.lastZ = z;
  if (phase === 'start') dev.isTouching = true;
  else if (phase === 'end') {
    dev.isTouching = false;
    dev.lastZ = 0;
  }
  engine.onTouch?.({ x, y, z, phase, deviceId: dev.deviceId, role: dev.role });
}

function parseRoliTouchSysex(dev: DeviceState, data: Uint8Array): void {
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
      if (!dev.isTouching) return;
      emitTouch(dev, x / 4095, y / 4095, dev.lastZ || 0.5, 'move');
      return;
    }
    if (msgType === 0x13 || msgType === 0x15) {
      bitPos += 5 + 5;
      const x = read7BitBits(msgData, bitPos, 12);
      bitPos += 12;
      const y = read7BitBits(msgData, bitPos, 12);
      bitPos += 8;
      if (msgType === 0x13) bitPos += 24;
      emitTouch(dev, x / 4095, y / 4095, msgType === 0x13 ? 0.7 : 0, msgType === 0x13 ? 'start' : 'end');
      return;
    }
    break;
  }
}

function makeOnMidiMessage(dev: DeviceState): (e: WebMidi.MIDIMessageEvent) => void {
  return (event: WebMidi.MIDIMessageEvent) => {
    const d = event.data;
    if (!d || d.length < 1) return;

    if (d[0] === 0xf0) {
      dev.sysexBuf = Array.from(d);
    } else if (dev.sysexBuf.length > 0) {
      dev.sysexBuf.push(...Array.from(d as unknown as number[]));
    }
    if (dev.sysexBuf.length > 0 && dev.sysexBuf[dev.sysexBuf.length - 1] === 0xf7) {
      const full = new Uint8Array(dev.sysexBuf);
      if (
        full.length >= 8 &&
        full[1] === 0x00 &&
        full[2] === 0x21 &&
        full[3] === 0x10 &&
        full[4] === 0x77
      ) {
        parseRoliTouchSysex(dev, full);
      }
      dev.sysexBuf = [];
      return;
    }

    if (d[0] !== 0xf0 && dev.sysexBuf.length === 0) {
      const cmd = d[0] >> 4;
      if (cmd === 0x09 && d.length >= 3 && d[2] > 0) {
        emitTouch(dev, dev.lastX, dev.lastY, d[2] / 127, 'start');
      } else if (cmd === 0x08 && d.length >= 3) {
        emitTouch(dev, dev.lastX, dev.lastY, 0, 'end');
      } else if (cmd === 0x0b && d.length >= 3 && d[1] === 74 && dev.isTouching) {
        emitTouch(dev, dev.lastX, d[2] / 127, dev.lastZ, 'move');
      } else if (cmd === 0x0e && d.length >= 3 && dev.isTouching) {
        const bend = (d[2] * 128 + d[1]) / 16383;
        emitTouch(dev, bend, dev.lastY, dev.lastZ, 'move');
      } else if (cmd === 0x0d && d.length >= 2 && dev.isTouching) {
        emitTouch(dev, dev.lastX, dev.lastY, d[1] / 127, 'move');
      }
    }
  };
}

export function isRoliblockLike(name: string): boolean {
  const n = (name || '').toLowerCase();
  return (
    n.includes('roli') || n.includes('lightpad') || n.includes('block') || n.includes('seaboard')
  );
}

function notifyDeviceChange(): void {
  engine.onDevice?.(getRoliDevices());
}

function assignRoleForNewDevice(deviceId: string): RoliRole {
  const stored = loadRoleAssignments();
  if (stored[deviceId] === 'primary' || stored[deviceId] === 'colour-wheel') {
    return stored[deviceId];
  }
  // First device gets primary, second gets colour-wheel, beyond that → primary.
  const rolesInUse = new Set<RoliRole>();
  engine.devices.forEach((d) => rolesInUse.add(d.role));
  if (!rolesInUse.has('primary')) return 'primary';
  if (!rolesInUse.has('colour-wheel')) return 'colour-wheel';
  return 'primary';
}

function persistRole(deviceId: string, role: RoliRole): void {
  const stored = loadRoleAssignments();
  stored[deviceId] = role;
  saveRoleAssignments(stored);
}

function refreshAndAutoMap(): void {
  if (!engine.midiAccess) return;

  // Collect every ROLI input + output the browser is offering right now.
  const inputs: WebMidi.MIDIInput[] = [];
  const outputs: WebMidi.MIDIOutput[] = [];
  engine.midiAccess.inputs.forEach((inp) => {
    if (isRoliblockLike(inp.name || '')) inputs.push(inp);
  });
  engine.midiAccess.outputs.forEach((out) => {
    if (isRoliblockLike(out.name || '')) outputs.push(out);
  });

  // Canonical device id = output port name (the LED target). Fall back to
  // input name for input-only enumerations. Pair input + output by exact name
  // match first, then by trimmed name (Windows sometimes appends/strips spaces).
  const matchedOutputs = new Set<WebMidi.MIDIOutput>();
  const newIds = new Set<string>();

  for (const out of outputs) {
    const outName = out.name || '';
    const id = outName.trim() || `roli-${matchedOutputs.size}`;
    newIds.add(id);
    matchedOutputs.add(out);

    let dev = engine.devices.get(id);
    if (!dev) {
      const role = assignRoleForNewDevice(id);
      dev = newDeviceState(id, role);
      engine.devices.set(id, dev);
      persistRole(id, role);
    }

    if (dev.output !== out) {
      dev.output = out;
      dev.outputName = outName;
      dev.handshakeDone = false;
      dev.ledFailCount = 0;
      doHandshake(dev);
    }

    // Pair this device with the input whose name matches best.
    const matchedInput =
      inputs.find((i) => (i.name || '').trim() === id) ||
      inputs.find((i) => isRoliblockLike(i.name || '') && !engine.devices.has((i.name || '').trim())) ||
      inputs[outputs.indexOf(out)] ||
      null;
    if (matchedInput && dev.input !== matchedInput) {
      if (dev.input) dev.input.onmidimessage = null;
      dev.input = matchedInput;
      dev.inputName = matchedInput.name || null;
      matchedInput.onmidimessage = makeOnMidiMessage(dev);
    }
  }

  // Input-only devices (no LED output but still a touch source)
  for (const inp of inputs) {
    const inName = (inp.name || '').trim();
    if (!inName) continue;
    if (newIds.has(inName)) continue;
    let dev = engine.devices.get(inName);
    if (!dev) {
      const role = assignRoleForNewDevice(inName);
      dev = newDeviceState(inName, role);
      engine.devices.set(inName, dev);
      persistRole(inName, role);
    }
    newIds.add(inName);
    if (dev.input !== inp) {
      if (dev.input) dev.input.onmidimessage = null;
      dev.input = inp;
      dev.inputName = inp.name || null;
      inp.onmidimessage = makeOnMidiMessage(dev);
    }
  }

  // Drop devices that vanished from the MIDI list.
  for (const id of Array.from(engine.devices.keys())) {
    if (!newIds.has(id)) {
      const dev = engine.devices.get(id);
      if (dev?.input) dev.input.onmidimessage = null;
      engine.devices.delete(id);
    }
  }

  notifyDeviceChange();
}

export async function connectRoliLightpad(): Promise<boolean> {
  if (engine.midiAccess) {
    refreshAndAutoMap();
    return engine.devices.size > 0;
  }
  if (typeof navigator === 'undefined' || !navigator.requestMIDIAccess) return false;
  try {
    engine.midiAccess = await navigator.requestMIDIAccess({ sysex: true });
    engine.midiAccess.onstatechange = () => refreshAndAutoMap();
    refreshAndAutoMap();
    return engine.devices.size > 0;
  } catch {
    return false;
  }
}

export function disconnectRoliLightpad(): void {
  engine.devices.forEach((dev) => {
    if (dev.input) dev.input.onmidimessage = null;
  });
  engine.devices.clear();
  if (engine.midiAccess) engine.midiAccess.onstatechange = null;
  engine.midiAccess = null;
  engine.onTouch = null;
  engine.onDevice = null;
  engine.onHandshake = null;
}

export function setOnTouch(cb: RoliTouchCallback | null): void {
  engine.onTouch = cb;
}

export function setOnDeviceChange(cb: RoliDeviceChangeCallback | null): void {
  engine.onDevice = cb;
}

export function setOnHandshakeDone(cb: RoliHandshakeCallback | null): void {
  engine.onHandshake = cb;
}

export function getRoliDevices(): RoliDeviceInfo[] {
  return Array.from(engine.devices.values()).map((d) => ({
    deviceId: d.deviceId,
    inputName: d.inputName,
    outputName: d.outputName,
    handshakeDone: d.handshakeDone,
    role: d.role,
  }));
}

/**
 * Legacy single-device shim. Returns info about the primary device, or the
 * first device if there is no primary yet.
 */
export function getRoliStatus(): {
  connected: boolean;
  inputName: string | null;
  outputName: string | null;
  handshakeDone: boolean;
} {
  const devices = getRoliDevices();
  const primary = devices.find((d) => d.role === 'primary') ?? devices[0];
  return {
    connected: devices.length > 0,
    inputName: primary?.inputName ?? null,
    outputName: primary?.outputName ?? null,
    handshakeDone: primary?.handshakeDone ?? false,
  };
}

export function setRoliDeviceRole(deviceId: string, role: RoliRole): void {
  const dev = engine.devices.get(deviceId);
  if (!dev) return;
  dev.role = role;
  persistRole(deviceId, role);
  notifyDeviceChange();
}

function pickDevice(opts?: { role?: RoliRole; deviceId?: string }): DeviceState | null {
  if (!opts) {
    // Default: primary (back-compat with the old single-device API).
    for (const d of engine.devices.values()) if (d.role === 'primary') return d;
    return engine.devices.values().next().value ?? null;
  }
  if (opts.deviceId) return engine.devices.get(opts.deviceId) ?? null;
  if (opts.role) {
    for (const d of engine.devices.values()) if (d.role === opts.role) return d;
  }
  return null;
}

function sendRawLedFrame(dev: DeviceState, newLed: Uint8Array): boolean {
  if (!dev.output || !dev.handshakeDone) return false;
  if (dev.ledFailCount > 20) return false;
  const now = Date.now();
  if (now - dev.lastLedSend < LED_SEND_INTERVAL_MS) return false;
  dev.lastLedSend = now;

  let prevForDiff = dev.prevLedData;
  if (dev.needsFullRepaint) {
    prevForDiff = new Uint8Array(LED_BYTE_COUNT);
    for (let i = 0; i < LED_BYTE_COUNT; i++) prevForDiff[i] = newLed[i] ^ 0xff;
    dev.needsFullRepaint = false;
  }
  const messages = buildDataChangeMessages(dev, newLed, prevForDiff);
  for (const msg of messages) {
    try {
      dev.output.send(buildBlockSysEx(DEVICE_INDEX, msg));
    } catch {
      dev.ledFailCount++;
      return false;
    }
  }
  dev.ledFailCount = 0;
  dev.prevLedData = newLed;
  return true;
}

/**
 * Send a 15x15 RGBA pixel buffer to the chosen Lightpad's LEDs. Defaults to
 * the primary device. Pass `{ role: 'colour-wheel' }` or `{ deviceId }` to
 * target a specific block.
 */
export function sendLedFrame(
  pixels: Uint8ClampedArray | Uint8Array,
  opts?: { role?: RoliRole; deviceId?: string }
): boolean {
  if (pixels.length < LED_PIXEL_COUNT * 4) return false;
  const dev = pickDevice(opts);
  if (!dev) return false;
  return sendRawLedFrame(dev, rgbaFrameToRoliLedData(pixels));
}

/**
 * Blank the LEDs on a target device. Bypasses the throttle so touch-end
 * releases are visually instantaneous.
 */
export function clearLeds(opts?: { role?: RoliRole; deviceId?: string }): boolean {
  const dev = pickDevice(opts);
  if (!dev || !dev.output || !dev.handshakeDone) return false;
  dev.lastLedSend = 0;
  const blank = new Uint8Array(LED_BYTE_COUNT);
  return sendRawLedFrame(dev, blank);
}

/**
 * Helper: build a 15x15 RGBA frame from a normalized path (0..1 coords) plus a
 * bright cursor dot. Kept for back-compat; prefer `composeFrameFromCanvas`.
 */
export function composeLedFrame(opts: {
  path?: Array<{ x: number; y: number }>;
  cursor?: { x: number; y: number } | null;
  trailColor?: LedRgba;
  cursorColor?: LedRgba;
  bgColor?: LedRgba;
}): Uint8ClampedArray {
  const pixels = new Uint8ClampedArray(LED_PIXEL_COUNT * 4);
  const bg = opts.bgColor ?? [0, 0, 0, 0];
  for (let i = 0; i < LED_PIXEL_COUNT; i++) {
    pixels[i * 4] = bg[0];
    pixels[i * 4 + 1] = bg[1];
    pixels[i * 4 + 2] = bg[2];
    pixels[i * 4 + 3] = bg[3];
  }
  const trail = opts.trailColor ?? [110, 40, 210, 255];
  const cursorC = opts.cursorColor ?? [255, 120, 255, 255];

  const toCell = (nx: number, ny: number) => ({
    x: Math.round(clamp01(nx) * (ROLI_GRID_COLS - 1)),
    y: Math.round(clamp01(ny) * (ROLI_GRID_ROWS - 1)),
  });
  const putCell = (x: number, y: number, color: LedRgba) => {
    if (x < 0 || y < 0 || x >= ROLI_GRID_COLS || y >= ROLI_GRID_ROWS) return;
    const idx = (y * ROLI_GRID_COLS + x) * 4;
    pixels[idx] = Math.max(pixels[idx], color[0]);
    pixels[idx + 1] = Math.max(pixels[idx + 1], color[1]);
    pixels[idx + 2] = Math.max(pixels[idx + 2], color[2]);
    pixels[idx + 3] = Math.max(pixels[idx + 3], color[3]);
  };
  const plot = (nx: number, ny: number, color: LedRgba) => {
    const cell = toCell(nx, ny);
    putCell(cell.x, cell.y, color);
  };
  const line = (a: { x: number; y: number }, b: { x: number; y: number }, color: LedRgba) => {
    let { x: x0, y: y0 } = toCell(a.x, a.y);
    const { x: x1, y: y1 } = toCell(b.x, b.y);
    const dx = Math.abs(x1 - x0);
    const sx = x0 < x1 ? 1 : -1;
    const dy = -Math.abs(y1 - y0);
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    while (true) {
      putCell(x0, y0, color);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x0 += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y0 += sy;
      }
    }
  };

  if (opts.path && opts.path.length > 0) {
    if (opts.path.length === 1) {
      plot(opts.path[0].x, opts.path[0].y, trail);
    } else {
      for (let i = 1; i < opts.path.length; i++) line(opts.path[i - 1], opts.path[i], trail);
    }
  }
  if (opts.cursor) {
    const { x, y } = opts.cursor;
    const cursorCell = toCell(x, y);
    const halo: LedRgba = [
      Math.round(cursorC[0] / 2),
      Math.round(cursorC[1] / 2),
      Math.round(cursorC[2] / 2),
      Math.round(cursorC[3] / 2),
    ];
    putCell(cursorCell.x + 1, cursorCell.y, halo);
    putCell(cursorCell.x - 1, cursorCell.y, halo);
    putCell(cursorCell.x, cursorCell.y + 1, halo);
    putCell(cursorCell.x, cursorCell.y - 1, halo);
    putCell(cursorCell.x, cursorCell.y, cursorC);
  }
  return pixels;
}

let _scratchCanvas: HTMLCanvasElement | null = null;
let _scratchCtx: CanvasRenderingContext2D | null = null;

export function sampleCanvasToLedFrame(canvas: HTMLCanvasElement): Uint8ClampedArray {
  if (typeof document === 'undefined') return new Uint8ClampedArray(LED_PIXEL_COUNT * 4);
  if (!_scratchCanvas) {
    _scratchCanvas = document.createElement('canvas');
    _scratchCanvas.width = ROLI_GRID_COLS;
    _scratchCanvas.height = ROLI_GRID_ROWS;
    _scratchCtx = _scratchCanvas.getContext('2d');
    if (_scratchCtx) {
      _scratchCtx.imageSmoothingEnabled = true;
      _scratchCtx.imageSmoothingQuality = 'high';
    }
  }
  if (!_scratchCtx || canvas.width < 1 || canvas.height < 1) {
    return new Uint8ClampedArray(LED_PIXEL_COUNT * 4);
  }
  _scratchCtx.clearRect(0, 0, ROLI_GRID_COLS, ROLI_GRID_ROWS);
  _scratchCtx.drawImage(canvas, 0, 0, canvas.width, canvas.height, 0, 0, ROLI_GRID_COLS, ROLI_GRID_ROWS);
  return _scratchCtx.getImageData(0, 0, ROLI_GRID_COLS, ROLI_GRID_ROWS).data;
}

export function composeFrameFromCanvas(
  canvas: HTMLCanvasElement | null,
  opts: {
    cursor?: { x: number; y: number } | null;
    cursorColor?: LedRgba;
    crosshair?: boolean;
    crosshairColor?: LedRgba;
  } = {}
): Uint8ClampedArray {
  const sampled = canvas
    ? sampleCanvasToLedFrame(canvas)
    : new Uint8ClampedArray(LED_PIXEL_COUNT * 4);
  const out = new Uint8ClampedArray(sampled);

  const cursorColor: LedRgba = opts.cursorColor ?? [255, 120, 255, 255];
  const crossColor: LedRgba = opts.crosshairColor ?? [60, 180, 255, 180];

  const set = (x: number, y: number, c: LedRgba, brighten = false) => {
    if (x < 0 || y < 0 || x >= ROLI_GRID_COLS || y >= ROLI_GRID_ROWS) return;
    const idx = (y * ROLI_GRID_COLS + x) * 4;
    if (brighten) {
      out[idx] = Math.max(out[idx], c[0]);
      out[idx + 1] = Math.max(out[idx + 1], c[1]);
      out[idx + 2] = Math.max(out[idx + 2], c[2]);
      out[idx + 3] = Math.max(out[idx + 3], c[3]);
    } else {
      out[idx] = c[0];
      out[idx + 1] = c[1];
      out[idx + 2] = c[2];
      out[idx + 3] = c[3];
    }
  };

  if (opts.crosshair && opts.cursor) {
    const cx = Math.round(clamp01(opts.cursor.x) * (ROLI_GRID_COLS - 1));
    const cy = Math.round(clamp01(opts.cursor.y) * (ROLI_GRID_ROWS - 1));
    for (let x = 0; x < ROLI_GRID_COLS; x++) set(x, cy, crossColor, true);
    for (let y = 0; y < ROLI_GRID_ROWS; y++) set(cx, y, crossColor, true);
  }

  if (opts.cursor) {
    const cx = Math.round(clamp01(opts.cursor.x) * (ROLI_GRID_COLS - 1));
    const cy = Math.round(clamp01(opts.cursor.y) * (ROLI_GRID_ROWS - 1));
    set(cx, cy, cursorColor);
  }

  return out;
}
