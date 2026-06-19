export type DimmerFadeWaveform = 'breath' | 'saw';

export interface DimmerFadeChannelLike {
  name?: string;
  type?: string;
  dmxAddress?: number;
}

export interface DimmerFadeFixtureLike {
  name?: string;
  startAddress: number;
  channels: DimmerFadeChannelLike[];
}

export interface DimmerFadeTarget {
  dmxAddress: number;
  fixtureName: string;
  channelName: string;
}

const DIMMER_ALIASES = ['dimmer', 'intensity', 'master'];

function normalize(value?: string): string {
  return (value || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
}

function channelMatchesDimmer(channel: DimmerFadeChannelLike): boolean {
  const type = normalize(channel.type);
  const name = normalize(channel.name);

  return DIMMER_ALIASES.some((alias) => {
    if (type === alias || name === alias) return true;
    return type.startsWith(`${alias}_`) || name.startsWith(`${alias}_`) || type.includes(alias) || name.includes(alias);
  });
}

function fixtureDmxAddress(fixture: DimmerFadeFixtureLike, channelIndex: number): number {
  const override = fixture.channels[channelIndex]?.dmxAddress;
  return typeof override === 'number' ? override - 1 : fixture.startAddress + channelIndex - 1;
}

export function findDimmerFadeTargets(fixtures: DimmerFadeFixtureLike[]): DimmerFadeTarget[] {
  const targets: DimmerFadeTarget[] = [];

  fixtures.forEach((fixture) => {
    fixture.channels.forEach((channel, channelIndex) => {
      if (!channelMatchesDimmer(channel)) return;

      const dmxAddress = fixtureDmxAddress(fixture, channelIndex);
      if (dmxAddress < 0 || dmxAddress >= 512) return;

      targets.push({
        dmxAddress,
        fixtureName: fixture.name || 'Fixture',
        channelName: channel.name || channel.type || 'Dimmer',
      });
    });
  });

  return targets;
}

export function dimmerFadeLevel(waveform: DimmerFadeWaveform, progress: number): number {
  const normalizedProgress = ((progress % 1) + 1) % 1;

  if (waveform === 'saw') {
    return 1 - normalizedProgress;
  }

  return 0.5 - (Math.cos(normalizedProgress * Math.PI * 2) * 0.5);
}

export function dimmerFadeUpdates(
  fixtures: DimmerFadeFixtureLike[],
  value: number
): Record<number, number> {
  const safeValue = Math.max(0, Math.min(255, Math.round(value)));
  const updates: Record<number, number> = {};

  findDimmerFadeTargets(fixtures).forEach((target) => {
    updates[target.dmxAddress] = safeValue;
  });

  return updates;
}
