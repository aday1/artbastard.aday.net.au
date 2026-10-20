// APC40 MK1 Communications Protocol rev 1, pp. 6–8.
// Mode 0 (0x40) banks Device controls and sends their eight stored values on
// Track Select. Mode 2 is unbanked, all buttons are momentary, and the host
// owns the LEDs. Both server MIDI and Web MIDI must select the same mode.
export const APC40_MODE_2_SYSEX = [
  0xf0, 0x47, 0x7f, 0x73, 0x60, 0x00, 0x04, 0x42, 0x09, 0x04, 0x01, 0xf7,
];

export const APC40_DEVICE_INQUIRY = [0xf0, 0x7e, 0x00, 0x06, 0x01, 0xf7];
