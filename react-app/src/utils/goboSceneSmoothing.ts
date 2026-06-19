export interface GoboSceneChannelLike {
  name?: string;
  type?: string;
  dmxAddress?: number;
}

export interface GoboSceneFixtureLike {
  startAddress: number;
  channels: GoboSceneChannelLike[];
}

export interface GoboSceneTransitionChannels {
  wheel: Set<number>;
  rotation: Set<number>;
}

const GOBO_WHEEL_RELEASE_PROGRESS = 0.9;
const GOBO_ROTATION_RAMP_START = 0.45;

function normalize(value?: string): string {
  return (value || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
}

function channelText(channel: GoboSceneChannelLike): string {
  return `${normalize(channel.type)} ${normalize(channel.name)}`;
}

function channelDmxAddress(fixture: GoboSceneFixtureLike, channelIndex: number): number {
  const override = fixture.channels[channelIndex]?.dmxAddress;
  return typeof override === 'number' ? override - 1 : fixture.startAddress + channelIndex - 1;
}

function isGoboRotationChannel(channel: GoboSceneChannelLike): boolean {
  const text = channelText(channel);
  return (
    text.includes('gobo_rotation') ||
    text.includes('goborotation') ||
    text.includes('gobo_rotate') ||
    text.includes('gobo_spin') ||
    (text.includes('gobo') && (text.includes('rot') || text.includes('spin')))
  );
}

function isGoboWheelChannel(channel: GoboSceneChannelLike): boolean {
  const text = channelText(channel);
  if (isGoboRotationChannel(channel)) return false;
  return (
    text.includes('gobo') ||
    text.includes('pattern_selection') ||
    text.includes('pattern_option')
  );
}

function easeInOutSine(progress: number): number {
  return -(Math.cos(Math.PI * progress) - 1) / 2;
}

export function findGoboSceneTransitionChannels(
  fixtures: GoboSceneFixtureLike[]
): GoboSceneTransitionChannels {
  const wheel = new Set<number>();
  const rotation = new Set<number>();

  fixtures.forEach((fixture) => {
    fixture.channels.forEach((channel, channelIndex) => {
      const dmxAddress = channelDmxAddress(fixture, channelIndex);
      if (dmxAddress < 0 || dmxAddress >= 512) return;

      if (isGoboRotationChannel(channel)) {
        rotation.add(dmxAddress);
      } else if (isGoboWheelChannel(channel)) {
        wheel.add(dmxAddress);
      }
    });
  });

  return { wheel, rotation };
}

export function smoothGoboSceneTransitionValue(
  fromValue: number,
  toValue: number,
  progress: number,
  easedProgress: number,
  channel: number,
  channels: GoboSceneTransitionChannels
): number {
  if (channels.wheel.has(channel)) {
    return progress >= GOBO_WHEEL_RELEASE_PROGRESS ? toValue : fromValue;
  }

  if (channels.rotation.has(channel)) {
    if (progress <= GOBO_ROTATION_RAMP_START) return fromValue;
    const localProgress = Math.min(1, (progress - GOBO_ROTATION_RAMP_START) / (1 - GOBO_ROTATION_RAMP_START));
    const easedLocalProgress = easeInOutSine(localProgress);
    return Math.round(fromValue + (toValue - fromValue) * easedLocalProgress);
  }

  return Math.round(fromValue + (toValue - fromValue) * easedProgress);
}
