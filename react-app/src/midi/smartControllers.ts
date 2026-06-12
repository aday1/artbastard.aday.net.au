// Smart Controllers: dedupes physical hardware controllers (APC40, ROLI
// Lightpad, etc.) that the OS exposes as both Server MIDI (RtMidi/WinMM via
// backend) and Browser MIDI (Web MIDI in Chrome/Edge). One physical box →
// one row, with both transports as options, and a stable per-session tag.
//
// On Windows the two transports cannot share the same device — Chrome's
// Web MIDI claims it exclusively the moment requestMIDIAccess resolves, so
// the user has to pick a side per device. The Smart Controllers card surfaces
// that choice directly.

import { bucketFor, stripPortSuffix } from './midiInterfaceGrouping';
import {
  detectTemplateForMidiInterface,
  MidiControllerTemplateId,
} from '../components/midi/midiControllerTemplates';

export interface SmartController {
  // Short stable session tag: 'ROLI-A', 'APC-A', 'ROLI-B', etc. Used in the
  // UI as the user-facing nickname for the physical device.
  tag: string;
  // Detected template if any (drives the Apply Template button).
  templateId: MidiControllerTemplateId | null;
  // Stripped base name without OS suffixes ('ROLI Lightpad BLOCK', not
  // 'ROLI Lightpad BLOCK 1').
  baseName: string;
  // The server-side port name (as seen by the backend / RtMidi). Undefined
  // if this physical unit only appears in Browser MIDI.
  serverPort?: string;
  // The browser-side MIDIInput. Undefined if this physical unit only
  // appears in Server MIDI (e.g. browser hasn't been granted access).
  browserInput?: WebMidi.MIDIInput;
  isConnectedServer: boolean;
  isConnectedBrowser: boolean;
}

// Pick a short prefix from a base name. Looks for known controller families
// first; falls back to the first whitespace-separated word uppercased.
const TAG_PREFIX_RULES: Array<{ test: (n: string) => boolean; prefix: string }> = [
  { test: (n) => n.includes('apc40'), prefix: 'APC40' },
  { test: (n) => n.includes('apc mini'), prefix: 'APCMINI' },
  { test: (n) => n.includes('apc key'), prefix: 'APCKEY' },
  { test: (n) => n.includes('apc'), prefix: 'APC' },
  { test: (n) => n.includes('lightpad') || n.includes('roli'), prefix: 'ROLI' },
  { test: (n) => n.includes('seaboard'), prefix: 'SEABOARD' },
  { test: (n) => n.includes('launchpad'), prefix: 'LP' },
  { test: (n) => n.includes('launchkey'), prefix: 'LK' },
  { test: (n) => n.includes('launch control'), prefix: 'LC' },
  { test: (n) => n.includes('push'), prefix: 'PUSH' },
  { test: (n) => n.includes('x-touch') || n.includes('xtouch'), prefix: 'XTOUCH' },
  { test: (n) => n.includes('midi fighter'), prefix: 'MF' },
  { test: (n) => n.includes('nanokey'), prefix: 'NK' },
  { test: (n) => n.includes('nanopad'), prefix: 'NP' },
  { test: (n) => n.includes('nanokontrol'), prefix: 'NKTRL' },
  { test: (n) => n.includes('maschine'), prefix: 'MASCHINE' },
  { test: (n) => n.includes('keylab'), prefix: 'KEYLAB' },
  { test: (n) => n.includes('mpk'), prefix: 'MPK' },
  { test: (n) => n.includes('mpd'), prefix: 'MPD' },
];

export function tagPrefixFor(baseName: string): string {
  const lower = baseName.toLowerCase();
  for (const rule of TAG_PREFIX_RULES) {
    if (rule.test(lower)) return rule.prefix;
  }
  // Fallback: first word uppercased, alphanumeric only, max 8 chars.
  const first = baseName.trim().split(/\s+/)[0] || 'CTRL';
  return first.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 8) || 'CTRL';
}

export function buildSmartControllers(
  midiInterfaces: string[],
  activeInterfaces: string[],
  browserInputs: WebMidi.MIDIInput[],
  activeBrowserInputs: string[],
): SmartController[] {
  // Bucket by stripped base name. A given physical unit may appear once
  // per transport, so we collect ALL server ports and ALL browser inputs
  // that share a base name, then pair them positionally.
  type Bucket = { server: string[]; browser: WebMidi.MIDIInput[] };
  const byBase = new Map<string, Bucket>();

  const addToBucket = (base: string, kind: 'server' | 'browser', value: string | WebMidi.MIDIInput) => {
    const key = base.toLowerCase();
    const existing = byBase.get(key) || { server: [], browser: [] };
    if (kind === 'server') existing.server.push(value as string);
    else existing.browser.push(value as WebMidi.MIDIInput);
    byBase.set(key, existing);
  };

  for (const port of midiInterfaces) {
    if (!port || bucketFor(port) !== 'hardware') continue;
    addToBucket(stripPortSuffix(port), 'server', port);
  }
  for (const input of browserInputs) {
    const name = input.name || '';
    if (!name || bucketFor(name) !== 'hardware') continue;
    addToBucket(stripPortSuffix(name), 'browser', input);
  }

  // Stable order: alphabetical by base name, then per-bucket sort so the
  // letters A/B/C come out the same on every render.
  const bases = Array.from(byBase.entries()).sort(([a], [b]) => a.localeCompare(b));

  const out: SmartController[] = [];
  for (const [, bucket] of bases) {
    bucket.server.sort((a, b) => a.localeCompare(b));
    bucket.browser.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    const count = Math.max(bucket.server.length, bucket.browser.length);
    for (let i = 0; i < count; i++) {
      const serverPort = bucket.server[i];
      const browserInput = bucket.browser[i];
      const baseName = stripPortSuffix(serverPort || browserInput?.name || '');
      const letter = String.fromCharCode(65 + i); // A, B, C, ...
      const prefix = tagPrefixFor(baseName);
      const templateId = detectTemplateForMidiInterface(baseName);
      out.push({
        tag: `${prefix}-${letter}`,
        templateId,
        baseName,
        serverPort,
        browserInput,
        isConnectedServer: !!serverPort && activeInterfaces.includes(serverPort),
        isConnectedBrowser: !!browserInput && activeBrowserInputs.includes(browserInput.id),
      });
    }
  }
  return out;
}
