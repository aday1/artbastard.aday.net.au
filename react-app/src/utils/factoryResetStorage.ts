export const FACTORY_RESET_LOCAL_STORAGE_KEYS = [
  'dmxChannelRanges',
  'artbastard-channelRanges',
  'dmxChannelTicksOnlyOverrides',
  'dmxChannelAuxFullFaderOverrides',
  'artbastard-strobe-safety-enabled-v1',
  'artbastard-strobe-safety-enabled-v2',
  'artbastard-default-config',
  'superControlLayouts',
  'artbastard.superControl.panelLayout.v8',
  'artbastard.superControl.localMidiMappings.v1',
  'artbastard.superControl.pathSlots.v1',
  'artbastard-supercontrol-midi-mappings-v1',
  'artbastard-auto-scene-settings',
  'superControlOscAddresses',
  'artbastard-superControlOscAddresses',
  'artbastard-fixtures',
  'fixtureTemplates',
  'fixtureManufacturers',
  'dmxChannelNames',
  'artbastard-channelNames',
  'dmxChannelColors',
  'artbastard-channelColors',
  'pinnedChannels',
  'artbastard-pinnedChannels',
  'dmxFaderOrientation',
  'dmxChannelsPerRow',
  'envelopeAutomation',
  'envelopeSpeedMidiMapping',
  'roli-autoplay-on-release',
  'artbastard-session-id',
  'artbastard-super-control-preferences-v1',
  'artbastard-super-control-preferences-v2',
];

export const SUPER_CONTROL_FACTORY_RESET_KEYS = [
  'dmxChannelRanges',
  'artbastard-channelRanges',
  'dmxChannelTicksOnlyOverrides',
  'dmxChannelAuxFullFaderOverrides',
  'artbastard-strobe-safety-enabled-v1',
  'artbastard-strobe-safety-enabled-v2',
  'artbastard-default-config',
  'superControlLayouts',
  'artbastard.superControl.panelLayout.v8',
  'artbastard.superControl.localMidiMappings.v1',
  'artbastard.superControl.pathSlots.v1',
  'artbastard-supercontrol-midi-mappings-v1',
  'artbastard-auto-scene-settings',
  'superControlOscAddresses',
  'artbastard-superControlOscAddresses',
  'dmxFaderOrientation',
  'dmxChannelsPerRow',
  'envelopeAutomation',
  'envelopeSpeedMidiMapping',
  'roli-autoplay-on-release',
  'artbastard-super-control-preferences-v1',
  'artbastard-super-control-preferences-v2',
];

export function createFactoryDefaultChannelRanges() {
  return new Array(512).fill(null).map(() => ({ min: 0, max: 255 }));
}

export function clearSuperControlFactoryResetStorage() {
  SUPER_CONTROL_FACTORY_RESET_KEYS.forEach((key) => {
    try {
      localStorage.removeItem(key);
    } catch {
      // Keep clearing the remaining keys.
    }
  });
}

export function clearFactoryResetBrowserStorage() {
  try {
    localStorage.clear();
  } catch (error) {
    console.warn('localStorage.clear failed; clearing known ArtBastard keys instead', error);
    FACTORY_RESET_LOCAL_STORAGE_KEYS.forEach((key) => {
      try {
        localStorage.removeItem(key);
      } catch {
        // Keep clearing the remaining keys.
      }
    });
  }

  try {
    sessionStorage.clear();
  } catch (error) {
    console.warn('sessionStorage.clear failed during factory reset', error);
  }
}
