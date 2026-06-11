// Hardened wrapper around MIDIOutput.send.
// - Swallows hardware send errors but records them per-port.
// - Debounces toast notifications so a flapping port can't spam the UI.
// - After repeated rapid failures, marks the port "dead" so callers can skip it.

import { useStore } from '../store';

interface PortHealth {
  errors: number;
  lastErrorAt: number;
  lastToastAt: number;
  dead: boolean;
}

const TOAST_DEBOUNCE_MS = 5000;
const DEAD_AFTER_ERRORS = 5;
const DEAD_WINDOW_MS = 1000;

const portHealth = new WeakMap<WebMidi.MIDIOutput, PortHealth>();

function getHealth(out: WebMidi.MIDIOutput): PortHealth {
  let entry = portHealth.get(out);
  if (!entry) {
    entry = { errors: 0, lastErrorAt: 0, lastToastAt: 0, dead: false };
    portHealth.set(out, entry);
  }
  return entry;
}

export function isPortDead(out: WebMidi.MIDIOutput): boolean {
  return getHealth(out).dead;
}

export function resetPortHealth(out: WebMidi.MIDIOutput): void {
  portHealth.set(out, { errors: 0, lastErrorAt: 0, lastToastAt: 0, dead: false });
}

export function safeMidiSend(
  out: WebMidi.MIDIOutput,
  bytes: number[] | Uint8Array,
  label?: string
): boolean {
  const health = getHealth(out);
  if (health.dead) return false;
  try {
    out.send(bytes as number[]);
    return true;
  } catch (err) {
    const now = Date.now();
    if (now - health.lastErrorAt > DEAD_WINDOW_MS) {
      health.errors = 1;
    } else {
      health.errors += 1;
    }
    health.lastErrorAt = now;
    if (health.errors >= DEAD_AFTER_ERRORS) {
      health.dead = true;
      try {
        useStore.getState().addNotification({
          message: `MIDI port "${out.name ?? 'unknown'}" stopped responding${label ? ` (${label})` : ''}.`,
          type: 'error',
          priority: 'high',
        });
      } catch {}
      return false;
    }
    if (now - health.lastToastAt > TOAST_DEBOUNCE_MS) {
      health.lastToastAt = now;
      try {
        useStore.getState().addNotification({
          message: `MIDI send failed on "${out.name ?? 'unknown'}"${label ? ` (${label})` : ''}.`,
          type: 'warning',
          priority: 'low',
        });
      } catch {}
    }
    return false;
  }
}
