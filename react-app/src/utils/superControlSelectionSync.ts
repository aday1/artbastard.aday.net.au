export const SUPER_CONTROL_SYNC_CONTROLS = [
  'dimmer',
  'pan',
  'tilt',
  'red',
  'green',
  'blue',
  'color_wheel',
  'gobo',
  'shutter',
  'strobe',
  'lamp',
  'reset',
] as const;

export type SuperControlSyncControl = (typeof SUPER_CONTROL_SYNC_CONTROLS)[number];

export type SuperControlSyncChannels = Record<string, number>;

export function readSuperControlChannelValue(
  controlType: string,
  affectedChannels: SuperControlSyncChannels[],
  resolveChannel: (controlType: string, channels: SuperControlSyncChannels) => number | undefined,
  readDmx: (channel: number) => number
): number | undefined {
  for (const channels of affectedChannels) {
    const targetChannel = resolveChannel(controlType, channels);
    if (targetChannel !== undefined) {
      return readDmx(targetChannel);
    }
  }
  return undefined;
}

export function readSuperControlValuesFromSelection(
  affectedChannels: SuperControlSyncChannels[],
  resolveChannel: (controlType: string, channels: SuperControlSyncChannels) => number | undefined,
  readDmx: (channel: number) => number
): Partial<Record<SuperControlSyncControl, number>> {
  const values: Partial<Record<SuperControlSyncControl, number>> = {};

  SUPER_CONTROL_SYNC_CONTROLS.forEach((controlType) => {
    const value = readSuperControlChannelValue(
      controlType,
      affectedChannels,
      resolveChannel,
      readDmx
    );
    if (value !== undefined) {
      values[controlType] = value;
    }
  });

  return values;
}
