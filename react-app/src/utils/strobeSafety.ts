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

export interface StrobeSafetyRange {
  min: number;
  max: number;
}

export interface StrobeSafetyTarget {
  dmxAddress: number;
  fixtureName: string;
  channelName: string;
  safeValue: number;
  safeRange: StrobeSafetyRange;
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

export function isStrobeSpeedRange(range: { description: string }): boolean {
  const description = range.description.toLowerCase();
  if (/no strobe|strobe off|strobe disabled/.test(description)) return false;
  return /\bstrobe\b/.test(description);
}

function isStrobeChannel(channel: StrobeSafetyChannelLike): boolean {
  const type = normalize(channel.type);
  const name = normalize(channel.name);
  if (type === 'strobe') return true;
  // Combined dimmer/shutter/intensity channels mention "strobe" in sub-ranges but are not
  // dedicated strobe channels — range lock applies via strobe-speed guarding instead.
  if (type === 'shutter' || type === 'dimmer' || type === 'intensity' || type === 'master') {
    return false;
  }
  return /\bstrobe\b/.test(channelText(channel)) || name.includes('strobe');
}

function rangeMidpoint(min: number, max: number): number {
  const safeMin = Math.max(0, Math.min(255, Math.round(min)));
  const safeMax = Math.max(safeMin, Math.min(255, Math.round(max)));
  return Math.round((safeMin + safeMax) / 2);
}

export function strobeSafeRange(channel: StrobeSafetyChannelLike): StrobeSafetyRange {
  const ranges = channel.ranges || [];
  const preferred = ranges.find((range) => {
    const description = range.description.toLowerCase();
    return /no strobe|strobe off|strobe disabled/.test(description);
  });
  if (preferred) return { min: preferred.min, max: preferred.max };

  const open = ranges.find((range) => {
    const description = range.description.toLowerCase();
    return /\bopen\b/.test(description) && !isStrobeSpeedRange(range);
  });
  if (open) return { min: open.min, max: open.max };

  const off = ranges.find((range) => {
    const description = range.description.toLowerCase();
    return /\boff\b/.test(description) && !isStrobeSpeedRange(range);
  });
  if (off) return { min: off.min, max: off.max };

  return { min: 0, max: 0 };
}

export function strobeSafeValue(channel: StrobeSafetyChannelLike): number {
  const range = strobeSafeRange(channel);
  return rangeMidpoint(range.min, range.max);
}

export function strobeDmxAddress(fixture: StrobeSafetyFixtureLike, channelIndex: number): number {
  const override = fixture.channels[channelIndex]?.dmxAddress;
  return typeof override === 'number' ? override - 1 : fixture.startAddress + channelIndex - 1;
}

export function getFixtureChannelAtAddress(
  fixtures: StrobeSafetyFixtureLike[],
  channel: number
): StrobeSafetyChannelLike | null {
  for (const fixture of fixtures) {
    for (let channelIndex = 0; channelIndex < fixture.channels.length; channelIndex += 1) {
      if (strobeDmxAddress(fixture, channelIndex) === channel) {
        return fixture.channels[channelIndex];
      }
    }
  }
  return null;
}

export function channelHasStrobeSpeedRanges(channel: StrobeSafetyChannelLike): boolean {
  return Boolean(channel.ranges?.some((range) => isStrobeSpeedRange(range)));
}

export function findStrobeSafetyTargets(fixtures: StrobeSafetyFixtureLike[]): StrobeSafetyTarget[] {
  const targets: StrobeSafetyTarget[] = [];
  fixtures.forEach((fixture) => {
    fixture.channels.forEach((channel, channelIndex) => {
      if (!isStrobeChannel(channel)) return;
      const dmxAddress = strobeDmxAddress(fixture, channelIndex);
      if (dmxAddress < 0 || dmxAddress >= 512) return;
      const safeRange = strobeSafeRange(channel);
      targets.push({
        dmxAddress,
        fixtureName: fixture.name || 'Fixture',
        channelName: channel.name || channel.type || 'Strobe',
        safeValue: rangeMidpoint(safeRange.min, safeRange.max),
        safeRange,
      });
    });
  });
  return targets;
}

export function countStrobeSafetyAffectedChannels(fixtures: StrobeSafetyFixtureLike[]): number {
  const addresses = new Set<number>();
  findStrobeSafetyTargets(fixtures).forEach((target) => addresses.add(target.dmxAddress));
  fixtures.forEach((fixture) => {
    fixture.channels.forEach((channel, channelIndex) => {
      if (!channelHasStrobeSpeedRanges(channel)) return;
      const dmxAddress = strobeDmxAddress(fixture, channelIndex);
      if (dmxAddress >= 0 && dmxAddress < 512) addresses.add(dmxAddress);
    });
  });
  return addresses.size;
}

export function resolveStrobeSafetyValue(
  fixtures: StrobeSafetyFixtureLike[],
  channel: number,
  value: number
): number {
  const target = findStrobeSafetyTargets(fixtures).find((entry) => entry.dmxAddress === channel);
  if (target) {
    return clampToRange(value, target.safeRange.min, target.safeRange.max);
  }

  const fixtureChannel = getFixtureChannelAtAddress(fixtures, channel);
  if (!fixtureChannel?.ranges?.length) return value;

  const activeRange = fixtureChannel.ranges.find(
    (range) => value >= range.min && value <= range.max
  );
  if (activeRange && isStrobeSpeedRange(activeRange)) {
    return strobeSafeValue(fixtureChannel);
  }
  return value;
}

export function clampToRange(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}

export function strobeSafetyValueForChannel(
  fixtures: StrobeSafetyFixtureLike[],
  channel: number,
  value: number
): number {
  return resolveStrobeSafetyValue(fixtures, channel, value);
}

export function strobeSafetyUpdates(fixtures: StrobeSafetyFixtureLike[]): Record<number, number> {
  const updates: Record<number, number> = {};
  findStrobeSafetyTargets(fixtures).forEach((target) => {
    updates[target.dmxAddress] = target.safeValue;
  });
  fixtures.forEach((fixture) => {
    fixture.channels.forEach((channel, channelIndex) => {
      if (!channelHasStrobeSpeedRanges(channel)) return;
      const dmxAddress = strobeDmxAddress(fixture, channelIndex);
      if (dmxAddress < 0 || dmxAddress >= 512) return;
      const current = updates[dmxAddress];
      if (current !== undefined) return;
      updates[dmxAddress] = strobeSafeValue(channel);
    });
  });
  return updates;
}

export function applyStrobeSafetyToDmxValues(fixtures: StrobeSafetyFixtureLike[], values: number[]): number[] {
  const next = [...values];
  for (let channel = 0; channel < next.length; channel += 1) {
    next[channel] = resolveStrobeSafetyValue(fixtures, channel, next[channel] ?? 0);
  }
  return next;
}

export function strobeSafetyRangeUpdates(
  fixtures: StrobeSafetyFixtureLike[]
): Record<number, StrobeSafetyRange> {
  const updates: Record<number, StrobeSafetyRange> = {};
  findStrobeSafetyTargets(fixtures).forEach((target) => {
    updates[target.dmxAddress] = target.safeRange;
  });
  return updates;
}
