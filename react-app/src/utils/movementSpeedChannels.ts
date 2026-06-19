export interface MovementSpeedChannelLike {
  name?: string;
  type?: string;
  dmxAddress?: number;
  ranges?: Array<{ min: number; max: number; description: string }>;
}

export interface MovementSpeedFixtureLike {
  name?: string;
  startAddress: number;
  channels: MovementSpeedChannelLike[];
}

export interface MovementSpeedFixtureTarget {
  fixture: MovementSpeedFixtureLike;
}

export interface MovementSpeedTarget {
  dmxAddress: number;
  fixtureName: string;
  channelName: string;
  min: number;
  max: number;
  inverted: boolean;
}

function normalize(value?: string): string {
  return (value || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
}

function channelText(channel: MovementSpeedChannelLike): string {
  return [
    channel.name,
    channel.type,
    ...(channel.ranges || []).map((range) => range.description),
  ].filter(Boolean).join(' ').toLowerCase();
}

function hasPanTilt(fixture: MovementSpeedFixtureLike): boolean {
  return fixture.channels.some((channel) => {
    const type = normalize(channel.type);
    const name = normalize(channel.name);
    return type === 'pan' || type === 'tilt' || name === 'pan' || name === 'tilt';
  });
}

function isSpeedChannel(channel: MovementSpeedChannelLike): boolean {
  const type = normalize(channel.type);
  return type === 'speed' || type === 'rate' || type === 'movement_speed';
}

function isMovementSpeedChannel(channel: MovementSpeedChannelLike, fixture: MovementSpeedFixtureLike): boolean {
  if (!isSpeedChannel(channel) || !hasPanTilt(fixture)) return false;
  const text = channelText(channel);
  const movementHint = /\b(pan|tilt|movement|motor|xy|scan)\b/.test(text);
  const excludedHint = /\b(colou?r|gobo|prism|iris|focus|zoom|effect|pattern|draw|twinkle|strobe|shutter|dimmer|lamp|reset)\b/.test(text);
  return movementHint || !excludedHint;
}

function speedRange(channel: MovementSpeedChannelLike): { min: number; max: number } {
  if (!channel.ranges || channel.ranges.length === 0) return { min: 0, max: 255 };
  const mins = channel.ranges.map((range) => range.min);
  const maxes = channel.ranges.map((range) => range.max);
  return {
    min: Math.max(0, Math.min(255, Math.min(...mins))),
    max: Math.max(0, Math.min(255, Math.max(...maxes))),
  };
}

export function movementSpeedDmxAddress(fixture: MovementSpeedFixtureLike, channelIndex: number): number {
  const override = fixture.channels[channelIndex]?.dmxAddress;
  return typeof override === 'number' ? override - 1 : fixture.startAddress + channelIndex - 1;
}

export function shouldInvertMovementSpeedChannel(channel: MovementSpeedChannelLike): boolean {
  const text = channelText(channel);
  if (/slow.{0,12}fast/.test(text)) return false;
  if (/fast.{0,12}slow/.test(text)) return true;
  return true;
}

export function findMovementSpeedTargets(affectedFixtures: MovementSpeedFixtureTarget[]): MovementSpeedTarget[] {
  const targets: MovementSpeedTarget[] = [];
  affectedFixtures.forEach(({ fixture }) => {
    fixture.channels.forEach((channel, channelIndex) => {
      if (!isMovementSpeedChannel(channel, fixture)) return;
      const dmxAddress = movementSpeedDmxAddress(fixture, channelIndex);
      if (dmxAddress < 0 || dmxAddress >= 512) return;
      const range = speedRange(channel);
      targets.push({
        dmxAddress,
        fixtureName: fixture.name || 'Fixture',
        channelName: channel.name || channel.type || 'Movement speed',
        min: range.min,
        max: range.max,
        inverted: shouldInvertMovementSpeedChannel(channel),
      });
    });
  });
  return targets;
}

export function movementSpeedDmxValue(target: MovementSpeedTarget, normalized: number): number {
  const safe = Math.max(0, Math.min(1, normalized));
  const min = Math.max(0, Math.min(255, target.min));
  const max = Math.max(min, Math.min(255, target.max));
  const value = target.inverted
    ? max - safe * (max - min)
    : min + safe * (max - min);
  return Math.round(Math.max(min, Math.min(max, value)));
}
