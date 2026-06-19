export interface StrobeSafetyChannelLike {
  name?: string;
  type?: string;
  dmxAddress?: number;
  ranges?: Array<{ min: number; max: number; description: string }>;
}

export interface StrobeSafetyFixtureLike {
  name?: string;
  startAddress: number;
  channels: StrobeSafetyChannelLike[];
}

export interface StrobeSafetyTarget {
  dmxAddress: number;
  fixtureName: string;
  channelName: string;
  safeValue: number;
}

function normalize(value?: string): string {
  return (value || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
}

function channelText(channel: StrobeSafetyChannelLike): string {
  return [
    channel.name,
    channel.type,
    ...(channel.ranges || []).map((range) => range.description),
  ].filter(Boolean).join(' ').toLowerCase();
}

function isStrobeChannel(channel: StrobeSafetyChannelLike): boolean {
  const type = normalize(channel.type);
  const name = normalize(channel.name);
  if (type === 'strobe') return true;
  if (type === 'shutter') return false;
  return /\bstrobe\b/.test(channelText(channel)) || name.includes('strobe');
}

function rangeMidpoint(min: number, max: number): number {
  const safeMin = Math.max(0, Math.min(255, Math.round(min)));
  const safeMax = Math.max(safeMin, Math.min(255, Math.round(max)));
  return Math.round((safeMin + safeMax) / 2);
}

export function strobeSafeValue(channel: StrobeSafetyChannelLike): number {
  const ranges = channel.ranges || [];
  const preferred = ranges.find((range) => {
    const description = range.description.toLowerCase();
    return /no strobe|strobe off|strobe disabled/.test(description);
  });
  if (preferred) return rangeMidpoint(preferred.min, preferred.max);

  const open = ranges.find((range) => {
    const description = range.description.toLowerCase();
    return /\bopen\b/.test(description) && !/\bstrobe\b/.test(description);
  });
  if (open) return rangeMidpoint(open.min, open.max);

  const off = ranges.find((range) => /\boff\b/.test(range.description.toLowerCase()));
  if (off) return rangeMidpoint(off.min, off.max);

  return 0;
}

export function strobeDmxAddress(fixture: StrobeSafetyFixtureLike, channelIndex: number): number {
  const override = fixture.channels[channelIndex]?.dmxAddress;
  return typeof override === 'number' ? override - 1 : fixture.startAddress + channelIndex - 1;
}

export function findStrobeSafetyTargets(fixtures: StrobeSafetyFixtureLike[]): StrobeSafetyTarget[] {
  const targets: StrobeSafetyTarget[] = [];
  fixtures.forEach((fixture) => {
    fixture.channels.forEach((channel, channelIndex) => {
      if (!isStrobeChannel(channel)) return;
      const dmxAddress = strobeDmxAddress(fixture, channelIndex);
      if (dmxAddress < 0 || dmxAddress >= 512) return;
      targets.push({
        dmxAddress,
        fixtureName: fixture.name || 'Fixture',
        channelName: channel.name || channel.type || 'Strobe',
        safeValue: strobeSafeValue(channel),
      });
    });
  });
  return targets;
}

export function strobeSafetyValueForChannel(fixtures: StrobeSafetyFixtureLike[], channel: number): number | undefined {
  return findStrobeSafetyTargets(fixtures).find((target) => target.dmxAddress === channel)?.safeValue;
}

export function strobeSafetyUpdates(fixtures: StrobeSafetyFixtureLike[]): Record<number, number> {
  const updates: Record<number, number> = {};
  findStrobeSafetyTargets(fixtures).forEach((target) => {
    updates[target.dmxAddress] = target.safeValue;
  });
  return updates;
}

export function applyStrobeSafetyToDmxValues(fixtures: StrobeSafetyFixtureLike[], values: number[]): number[] {
  const next = [...values];
  findStrobeSafetyTargets(fixtures).forEach((target) => {
    if (target.dmxAddress >= 0 && target.dmxAddress < next.length) {
      next[target.dmxAddress] = target.safeValue;
    }
  });
  return next;
}
