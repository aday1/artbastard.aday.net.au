// Owns SysEx-enabled MIDIAccess for the APC40 lifecycle.
// On output appearance (or first call), sends device inquiry + Mode 1 SysEx
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

export function useApc40Health() {
  const addNotification = useStore((s) => s.addNotification);
  const accessRef = useRef<WebMidi.MIDIAccess | null>(null);
  const initedRef = useRef<Set<string>>(new Set());
  const inquiredRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    const cleanups: Array<() => void> = [];

    const handleSysex = (ev: WebMidi.MIDIMessageEvent, portName: string) => {
      const reply = parseDeviceInquiryReply(ev.data);
      if (!reply) return;
      if (!isApc40InquiryReply(reply)) return;
      if (inquiredRef.current.has(portName)) return;
      inquiredRef.current.add(portName);
      debugLog.log(
        `[APC40-HEALTH] inquiry reply from "${portName}": family=0x${reply.familyLsb.toString(16)} model=0x${reply.modelLsb.toString(16)}`,
      );
      try {
        addNotification({
          message: `APC40 ready (Generic Mode) — ${portName}`,
          type: 'success',
          priority: 'normal',
        });
      } catch {}
    };

    const wireInputs = (access: WebMidi.MIDIAccess) => {
      access.inputs.forEach((input) => {
        if (!isApc40Port(input)) return;
        const name = input.name ?? 'apc40';
        const listener = (ev: WebMidi.MIDIMessageEvent) => handleSysex(ev, name);
        input.addEventListener('midimessage', listener as EventListener);
        cleanups.push(() =>
          input.removeEventListener('midimessage', listener as EventListener),
        );
      });
    };

    const initOutputs = (access: WebMidi.MIDIAccess) => {
      access.outputs.forEach((out) => {
        if (!isApc40Port(out)) return;
        const name = out.name ?? 'apc40';
        if (initedRef.current.has(name)) return;
        initedRef.current.add(name);
        const result = initApc40(out);
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
            message: 'APC40 SysEx access denied — controller may stay in Ableton Mode.',
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
      initedRef.current.clear();
      inquiredRef.current.clear();
    };
  }, [addNotification]);
}
