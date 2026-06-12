/**
 * Web Bluetooth BLE-MIDI transport for ROLI Lightpad / Seaboard Block.
 *
 * Wraps the standard Apple BLE-MIDI GATT service (UUID
 * 03B80E5A-EDE8-4B33-A751-6CE34EC4C700, characteristic
 * 7772E5DB-3868-4112-A1A9-F2669D106BF3) and exposes a fake MIDIInput/MIDIOutput
 * pair that the existing roliLightpad engine can consume unmodified.
 *
 * Why: on Windows, Chrome's Web MIDI does not enumerate BLE-MIDI ports
 * natively. Without this adapter the user has to run a desktop bridge
 * (MIDIBerry + loopMIDI). With it, the browser pairs the block directly.
 *
 * Reference: Apple "MIDI over Bluetooth Low Energy" (2015) — packet header is
 * (0x80 | timestampHi5), then per-message (0x80 | timestampLo7) + status + data.
 * SysEx spans packets without a per-message timestamp byte in continuation
 * packets, and the closing 0xF7 gets a fresh timestamp byte.
 */

const BLE_MIDI_SERVICE = '03b80e5a-ede8-4b33-a751-6ce34ec4c700';
const BLE_MIDI_CHARACTERISTIC = '7772e5db-3868-4112-a1a9-f2669d106bf3';

// Conservative MTU. The Web Bluetooth spec allows up to ~512 with negotiation,
// but Windows + Chrome typically caps at ~23 (20 payload). 20 is the safe
// universal default; we leave 2 bytes for header + per-message timestamp.
const DEFAULT_MTU_PAYLOAD = 20;

export type BleMidiMessageHandler = (bytes: Uint8Array) => void;

export interface VirtualMidiInput {
  id: string;
  name: string;
  manufacturer: string;
  type: 'input';
  onmidimessage: ((event: { data: Uint8Array }) => void) | null;
}

export interface VirtualMidiOutput {
  id: string;
  name: string;
  manufacturer: string;
  type: 'output';
  send(data: number[] | Uint8Array): void;
}

export interface PairedBleDevice {
  /** Stable id for engine.devices keying. */
  id: string;
  name: string;
  input: VirtualMidiInput;
  output: VirtualMidiOutput;
  /** Disconnect GATT and tear down notifications. Safe to call multiple times. */
  disconnect: () => void;
}

/**
 * Pack a single MIDI message (status + data bytes) into one or more BLE-MIDI
 * notification payloads no larger than `mtuPayload`. SysEx longer than the MTU
 * is split across continuation packets per the BLE-MIDI spec.
 */
export function packetizeMidiMessage(message: number[], mtuPayload = DEFAULT_MTU_PAYLOAD): Uint8Array[] {
  if (message.length === 0) return [];
  const ts = Date.now() & 0x1fff; // 13-bit timestamp
  const tsHi = (ts >> 7) & 0x3f;
  const tsLo = ts & 0x7f;
  const header = 0x80 | tsHi;
  const tsByte = 0x80 | tsLo;
  const isSysEx = message[0] === 0xf0;

  // Non-SysEx (note on/off, CC, etc.) is short — never split.
  if (!isSysEx) {
    const out = new Uint8Array(2 + message.length);
    out[0] = header;
    out[1] = tsByte;
    for (let i = 0; i < message.length; i++) out[2 + i] = message[i];
    return [out];
  }

  // SysEx. First packet: [header, tsByte, 0xF0, ...data up to MTU - 3].
  // Continuation packets: [header, ...data up to MTU - 1] — NO timestamp byte
  // on continuations (data bytes have bit 7 = 0; timestamp would conflict).
  // Final packet (containing 0xF7): re-introduce timestamp byte before 0xF7.
  const packets: Uint8Array[] = [];
  const body = message.slice(1, message.length - 1); // strip 0xF0 / 0xF7
  let pos = 0;
  let first = true;
  while (pos < body.length) {
    const reserved = first ? 3 : 1; // header + (ts + 0xF0) or just header
    const take = Math.min(body.length - pos, mtuPayload - reserved);
    const chunk = body.slice(pos, pos + take);
    const buf: number[] = [header];
    if (first) {
      buf.push(tsByte, 0xf0);
      first = false;
    }
    for (const b of chunk) buf.push(b);
    packets.push(new Uint8Array(buf));
    pos += take;
  }
  // Append the closing 0xF7 packet (with fresh timestamp byte).
  packets.push(new Uint8Array([header, tsByte, 0xf7]));
  return packets;
}

/**
 * Stateful parser for incoming BLE-MIDI notifications. The same parser
 * instance must be used for every notification on a given characteristic so
 * SysEx that spans packets is reassembled correctly.
 */
export class BleMidiParser {
  private sysExActive = false;
  private sysExBuf: number[] = [];

  /**
   * Parse one notification value and return zero or more complete MIDI
   * messages (each as a Uint8Array starting with the status byte).
   */
  parse(packet: Uint8Array): Uint8Array[] {
    const out: Uint8Array[] = [];
    if (packet.length < 1) return out;
    // packet[0] is the timestamp-high header; discard (we don't need timing).
    let i = 1;
    let runningStatus = 0;

    while (i < packet.length) {
      const byte = packet[i];
      const isTimestamp = (byte & 0x80) !== 0;

      if (this.sysExActive) {
        if (isTimestamp) {
          // Either the closing 0xF7 (preceded by timestamp byte) or an
          // interrupting realtime/system message. Skip the timestamp and
          // inspect the next byte.
          if (i + 1 < packet.length && packet[i + 1] === 0xf7) {
            this.sysExBuf.push(0xf7);
            out.push(new Uint8Array(this.sysExBuf));
            this.sysExBuf = [];
            this.sysExActive = false;
            i += 2;
            continue;
          }
          // Spec-compliant interrupting realtime message — rare in ROLI
          // traffic. Skip the timestamp byte and let the loop handle the
          // status byte normally.
          i++;
          continue;
        }
        this.sysExBuf.push(byte);
        i++;
        continue;
      }

      // Not in SysEx. A status byte must be preceded by a timestamp byte.
      if (!isTimestamp) {
        // Running status: data byte with no preceding timestamp/status.
        // Skip (ROLI rarely uses this; we'd need to track prior status).
        i++;
        continue;
      }
      // Timestamp byte; advance to status.
      i++;
      if (i >= packet.length) break;
      const status = packet[i];
      i++;
      if (status === 0xf0) {
        this.sysExActive = true;
        this.sysExBuf = [0xf0];
        continue;
      }
      runningStatus = status;
      const dataLen = midiDataLength(status);
      if (i + dataLen > packet.length) break; // truncated
      const msg = new Uint8Array(1 + dataLen);
      msg[0] = status;
      for (let k = 0; k < dataLen; k++) msg[1 + k] = packet[i + k];
      out.push(msg);
      i += dataLen;
      void runningStatus;
    }
    return out;
  }
}

function midiDataLength(status: number): number {
  const type = status & 0xf0;
  switch (type) {
    case 0x80: case 0x90: case 0xa0: case 0xb0: case 0xe0: return 2;
    case 0xc0: case 0xd0: return 1;
    case 0xf0:
      // System common — most have 0 or 1 data byte; we conservatively assume 0.
      if (status === 0xf1 || status === 0xf3) return 1;
      if (status === 0xf2) return 2;
      return 0;
    default: return 0;
  }
}

/**
 * Prompts the user to pick a BLE-MIDI device (filtered to ROLI by name) and
 * returns a paired wrapper with virtual MIDIInput/MIDIOutput facets.
 *
 * Must be called from a user gesture (button click). Throws if the user
 * cancels or Web Bluetooth is unavailable.
 */
export async function pairRoliOverBluetooth(): Promise<PairedBleDevice> {
  const nav = navigator as Navigator & { bluetooth?: { requestDevice: (opts: any) => Promise<any> } };
  if (!nav.bluetooth?.requestDevice) {
    throw new Error('Web Bluetooth not supported in this browser.');
  }
  const device = await nav.bluetooth.requestDevice({
    // Filter on the standard BLE-MIDI service so the chooser only shows
    // compatible devices. Name filter falls back to "LIGHTPAD"/"ROLI" so
    // older firmware that doesn't advertise the service still appears.
    filters: [
      { services: [BLE_MIDI_SERVICE] },
      { namePrefix: 'LIGHTPAD' },
      { namePrefix: 'Lightpad' },
      { namePrefix: 'ROLI' },
      { namePrefix: 'Seaboard' },
    ],
    optionalServices: [BLE_MIDI_SERVICE],
  });
  if (!device.gatt) throw new Error('Paired device has no GATT server');
  const server = await device.gatt.connect();
  const service = await server.getPrimaryService(BLE_MIDI_SERVICE);
  const characteristic = await service.getCharacteristic(BLE_MIDI_CHARACTERISTIC);
  await characteristic.startNotifications();

  const id = `ble:${device.id || device.name || crypto.randomUUID()}`;
  const name = device.name || 'ROLI Bluetooth';
  const parser = new BleMidiParser();

  const input: VirtualMidiInput = {
    id,
    name,
    manufacturer: 'ROLI',
    type: 'input',
    onmidimessage: null,
  };

  characteristic.addEventListener('characteristicvaluechanged', (ev: Event) => {
    const target = ev.target as { value?: DataView };
    const dv = target.value;
    if (!dv) return;
    const bytes = new Uint8Array(dv.buffer, dv.byteOffset, dv.byteLength);
    const messages = parser.parse(bytes);
    if (!input.onmidimessage) return;
    for (const m of messages) input.onmidimessage({ data: m });
  });

  const output: VirtualMidiOutput = {
    id,
    name,
    manufacturer: 'ROLI',
    type: 'output',
    send(data) {
      const arr = Array.isArray(data) ? data : Array.from(data as Uint8Array);
      const packets = packetizeMidiMessage(arr);
      // Sequential writes with a microtask gap so the BLE stack doesn't
      // reject overlapping writes. writeValueWithoutResponse is preferred
      // (lower latency); fall back if unsupported.
      void (async () => {
        for (const p of packets) {
          try {
            if ('writeValueWithoutResponse' in characteristic) {
              await (characteristic as any).writeValueWithoutResponse(p);
            } else {
              await characteristic.writeValue(p);
            }
          } catch (err) {
            // Stop the burst on first error so we don't pile up rejections.
            console.warn('[roliBleTransport] write failed:', err);
            break;
          }
        }
      })();
    },
  };

  const disconnect = () => {
    try { characteristic.stopNotifications(); } catch { /* ignore */ }
    try { if (device.gatt?.connected) device.gatt.disconnect(); } catch { /* ignore */ }
  };

  device.addEventListener('gattserverdisconnected', () => {
    // Surface as a normal disconnect; the engine's state-change path will
    // notice on the next refreshAndAutoMap or via its own ping timeout.
    input.onmidimessage = null;
  });

  return { id, name, input, output, disconnect };
}
