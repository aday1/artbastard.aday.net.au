// Keep browser-only and server-connected APC40s in the same unbanked mode.
import { safeMidiSend } from './midiOutputGuard';
import { APC40_DEVICE_INQUIRY, APC40_MODE_2_SYSEX } from '../../../src/apc40Protocol';

const APC40_NAME_RX = /\bapc\s*40\b/i;

export function isApc40Port(port: Pick<WebMidi.MIDIPort, 'name' | 'manufacturer'>): boolean {
  return APC40_NAME_RX.test(port.name || '') || APC40_NAME_RX.test(port.manufacturer || '');
}

export interface Apc40InitResult {
  inquirySent: boolean;
  modeSent: boolean;
}

export function initApc40(out: WebMidi.MIDIOutput): Apc40InitResult {
  const inquirySent = safeMidiSend(out, [...APC40_DEVICE_INQUIRY], 'device-inquiry');
  const modeSent = safeMidiSend(out, [...APC40_MODE_2_SYSEX], 'set-unbanked-mode-2');
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
