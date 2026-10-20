// Owns SysEx-enabled MIDIAccess for the APC40 lifecycle.
// On output appearance (or first call), sends device inquiry + Mode 2 SysEx
// and listens for inquiry replies to confirm the controller is an APC40.

import { useEffect, useRef } from 'react';
import { useStore } from '../store';
import {
  initApc40,
  isApc40Port,
  parseDeviceInquiryReply,
  isApc40InquiryReply,
} from '../midi/apc40Init';
import { debugLog } from '../utils/debugLog';
import { resetPortHealth } from '../midi/midiOutputGuard';
import { notifyApc40LedDirty } from '../midi/apc40LedRuntime';

export function useApc40Health() {
  const addNotification = useStore((s) => s.addNotification);
  const accessRef = useRef<WebMidi.MIDIAccess | null>(null);

  useEffect(() => {
    let cancelled = false;
    const cleanups: Array<() => void> = [];
    const initialized = new Map<string, WebMidi.MIDIOutput>();
    const observedOutputs = new Map<string, WebMidi.MIDIOutput>();
    const wired = new Map<WebMidi.MIDIInput, () => void>();
    const inquired = new Set<WebMidi.MIDIInput>();

    const handleSysex = (ev: WebMidi.MIDIMessageEvent, input: WebMidi.MIDIInput) => {
      const reply = parseDeviceInquiryReply(ev.data);
      if (!reply) return;
      if (!isApc40InquiryReply(reply)) return;
      if (inquired.has(input)) return;
      inquired.add(input);
      const portName = input.name ?? 'apc40';
      debugLog.log(
        `[APC40-HEALTH] inquiry reply from "${portName}": family=0x${reply.familyLsb.toString(16)} model=0x${reply.modelLsb.toString(16)}`,
      );
      try {
        addNotification({
          // Inquiry establishes identity, not acknowledgement of a mode change.
          message: `APC40 identified — ${portName}`,
          type: 'success',
          priority: 'normal',
        });
      } catch {}
    };

    const wireInputs = (access: WebMidi.MIDIAccess) => {
      for (const [input, cleanup] of wired) {
        if (input.state === 'disconnected' || access.inputs.get(input.id) !== input) {
          cleanup();
          wired.delete(input);
          inquired.delete(input);
        }
      }
      access.inputs.forEach((input) => {
        if (!isApc40Port(input) || input.state === 'disconnected' || wired.has(input)) return;
        const listener = (ev: WebMidi.MIDIMessageEvent) => handleSysex(ev, input);
        input.addEventListener('midimessage', listener as EventListener);
        wired.set(input, () =>
          input.removeEventListener('midimessage', listener as EventListener),
        );
      });
    };

    const initOutputs = (access: WebMidi.MIDIAccess) => {
      for (const [id, out] of observedOutputs) {
        if (out.state === 'disconnected' || access.outputs.get(id) !== out) {
          initialized.delete(id);
          observedOutputs.delete(id);
          resetPortHealth(out);
        }
      }
      access.outputs.forEach((out) => {
        if (!isApc40Port(out) || out.state === 'disconnected') return;
        observedOutputs.set(out.id, out);
        const name = out.name ?? 'apc40';
        if (initialized.get(out.id) === out) return;
        const result = initApc40(out);
        if (result.modeSent) {
          initialized.set(out.id, out);
          notifyApc40LedDirty('port-refresh');
        }
        debugLog.log(
          `[APC40-HEALTH] init "${name}": inquiry=${result.inquirySent} mode=${result.modeSent}`,
        );
      });
    };

    const refresh = (access: WebMidi.MIDIAccess) => {
      wireInputs(access);
      initOutputs(access);
    };

    const start = async () => {
      try {
        if (!navigator.requestMIDIAccess) return;
        const access = await navigator.requestMIDIAccess({ sysex: true });
        if (cancelled) return;
        accessRef.current = access;
        refresh(access);
        const onStateChange = () => refresh(access);
        access.addEventListener('statechange', onStateChange);
        cleanups.push(() => access.removeEventListener('statechange', onStateChange));
      } catch (err) {
        debugLog.log('[APC40-HEALTH] SysEx MIDI access failed:', err);
        try {
          addNotification({
            message: 'APC40 browser SysEx unavailable — browser-only controllers may remain in banked Generic Mode.',
            type: 'warning',
            priority: 'normal',
          });
        } catch {}
      }
    };
    void start();
    return () => {
      cancelled = true;
      cleanups.forEach((fn) => {
        try {
          fn();
        } catch {}
      });
      wired.forEach((cleanup) => cleanup());
      wired.clear();
      initialized.clear();
      observedOutputs.clear();
      inquired.clear();
    };
  }, [addNotification]);
}
