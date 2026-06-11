// APC40 device-inquiry + Generic Mode (Mode 1) SysEx initialization.
//
// Why this matters: pressing Track Select on an APC40 in Ableton Live Mode
// emits CC messages that route to our device/track-control handlers and
// silently rewrite DMX — see useApc40Workflow.ts:516/541 ("Changed <role>
// on no selected fixtures"). Forcing Mode 1 makes the Track Select buttons
// emit Note 0x33 as our handler expects.

import { safeMidiSend } from './midiOutputGuard';

// Universal Device Inquiry (non-realtime, broadcast).
// F0 7E <device-id=7F> 06 01 F7
const DEVICE_INQUIRY: number[] = [0xf0, 0x7e, 0x7f, 0x06, 0x01, 0xf7];

// Akai APC40 mode-change SysEx.
// F0 47 <id=7F> 73 60 00 04 <mode> <vmaj> <vmin> <vbug> F7
// mode byte: 0x40 = Generic Mode (host owns LEDs, surface sends raw MIDI),
// 0x41 = Ableton Live Mode, 0x42 = Ableton Live Alternate Mode.
// We want Generic Mode so Track Select buttons reliably emit Note 0x33.
const SET_MODE_GENERIC: number[] = [
  0xf0, 0x47, 0x7f, 0x73, 0x60, 0x00, 0x04, 0x40, 0x09, 0x04, 0x01, 0xf7,
];

const APC40_NAME_RX = /\bapc\s*40\b/i;

export function isApc40Port(port: Pick<WebMidi.MIDIPort, 'name' | 'manufacturer'>): boolean {
  return APC40_NAME_RX.test(port.name || '') || APC40_NAME_RX.test(port.manufacturer || '');
}

export interface Apc40InitResult {
  inquirySent: boolean;
  modeSent: boolean;
}

export function initApc40(out: WebMidi.MIDIOutput): Apc40InitResult {
  const inquirySent = safeMidiSend(out, DEVICE_INQUIRY, 'device-inquiry');
  const modeSent = safeMidiSend(out, SET_MODE_GENERIC, 'set-generic-mode');
  return { inquirySent, modeSent };
}

// Decode a Device Inquiry Reply.
// F0 7E <ch> 06 02 <manuf> <fam_lsb> <fam_msb> <model_lsb> <model_msb> <ver...> F7
export interface DeviceInquiryReply {
  manufacturerId: number;
  familyLsb: number;
  familyMsb: number;
  modelLsb: number;
  modelMsb: number;
}

export function parseDeviceInquiryReply(bytes: Uint8Array | number[]): DeviceInquiryReply | null {
  const data = bytes instanceof Uint8Array ? bytes : Uint8Array.from(bytes);
  if (data.length < 11) return null;
  if (data[0] !== 0xf0 || data[1] !== 0x7e || data[3] !== 0x06 || data[4] !== 0x02) return null;
  return {
    manufacturerId: data[5],
    familyLsb: data[6],
    familyMsb: data[7],
    modelLsb: data[8],
    modelMsb: data[9],
  };
}

export function isApc40InquiryReply(reply: DeviceInquiryReply): boolean {
  // Akai = 0x47, APC40 family = 0x73 (LSB).
  return reply.manufacturerId === 0x47 && reply.familyLsb === 0x73;
}
