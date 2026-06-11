import type { Fixture, FixtureTemplate, Group, PlacedFixture } from '../store';
import { getTemplateMode } from './showBuilder/showPlan';
import type { SmartFixtureGroupSuggestion } from './autoGroups';

export const STAGE_MAP_WIDTH = 1000;
export const STAGE_MAP_HEIGHT = 600;

export type StageMapViewMode = 'top' | 'side';

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const fixtureEndAddress = (fixture: Pick<Fixture, 'startAddress' | 'channels'>) =>
  fixture.startAddress + Math.max(1, fixture.channels?.length || 1) - 1;

const safeSlug = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'fixture';

export function normalizeStageCoordinate(value: unknown, axis: 'x' | 'y'): number {
  const max = axis === 'x' ? STAGE_MAP_WIDTH : STAGE_MAP_HEIGHT;
  const numberValue = typeof value === 'number' && Number.isFinite(value) ? value : max / 2;
  const scaled = numberValue >= 0 && numberValue <= 1 ? numberValue * max : numberValue;
  return Math.round(clamp(scaled, 0, max));
}

export function fallbackStagePosition(index: number, total: number): { x: number; y: number } {
  const count = Math.max(1, total);
  const columns = Math.min(8, Math.max(1, Math.ceil(Math.sqrt(count * 1.6))));
  const rows = Math.max(1, Math.ceil(count / columns));
  const column = index % columns;
  const row = Math.floor(index / columns);
  const x = ((column + 1) / (columns + 1)) * STAGE_MAP_WIDTH;
  const y = ((row + 1) / (rows + 1)) * STAGE_MAP_HEIGHT;
  return { x: Math.round(x), y: Math.round(y) };
}

export function normalizeFixtureLayout(
  fixtures: Fixture[],
  fixtureLayout: PlacedFixture[]
): PlacedFixture[] {
  const byFixtureId = new Map(
    fixtureLayout
      .filter((item) => item?.fixtureId)
      .map((item) => [item.fixtureId, item])
  );

  return fixtures.map((fixture, index) => {
    const existing = byFixtureId.get(fixture.id);
    const fallback = fallbackStagePosition(index, fixtures.length);
    return {
      id: existing?.id || `layout-${fixture.id}`,
      fixtureId: fixture.id,
      fixtureStoreId: fixture.id,
      name: fixture.name,
      type: fixture.type || 'Fixture',
      x: normalizeStageCoordinate(existing?.x ?? fallback.x, 'x'),
      y: normalizeStageCoordinate(existing?.y ?? fallback.y, 'y'),
      rotation: typeof (existing as any)?.rotation === 'number' ? (existing as any).rotation : 0,
      scale: typeof existing?.scale === 'number' && Number.isFinite(existing.scale) ? existing.scale : 1,
      dmxAddress: fixture.startAddress,
      startAddress: fixture.startAddress,
      color: (existing as any)?.color || '',
      radius: typeof (existing as any)?.radius === 'number' ? (existing as any).radius : 34,
      controls: (existing as any)?.controls || [],
    } as PlacedFixture;
  });
}

export function findNextAvailableDmxStart(fixtures: Fixture[], channelCount: number, preferredStart = 1): number {
  const count = Math.max(1, Math.floor(channelCount || 1));
  const occupied = fixtures
    .map((fixture) => ({
      start: Math.max(1, Math.floor(fixture.startAddress || 1)),
      end: fixtureEndAddress(fixture),
    }))
    .sort((a, b) => a.start - b.start);

  let cursor = Math.max(1, Math.floor(preferredStart || 1));
  while (cursor + count - 1 <= 512) {
    const collision = occupied.find((range) => !(cursor + count - 1 < range.start || cursor > range.end));
    if (!collision) return cursor;
    cursor = collision.end + 1;
  }
  return Math.max(1, 512 - count + 1);
}

export function createFixtureFromTemplate(
  template: FixtureTemplate,
  startAddress: number,
  sequenceNumber: number
): Fixture {
  const mode = getTemplateMode(template as any, undefined);
  const prefix = template.defaultNamePrefix || template.templateName || 'Fixture';
  const name = `${prefix} ${sequenceNumber}`;
  return {
    id: `fixture-${Date.now()}-${safeSlug(prefix)}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    type: template.type || template.category || 'Fixture',
    manufacturer: template.manufacturer || '',
    model: template.model,
    mode: mode.modeName,
    templateId: template.id,
    startAddress,
    channels: mode.channels.map((channel) => ({
      ...channel,
      ranges: channel.ranges?.map((range) => ({ ...range })),
    })),
    notes: [
      template.catalogId ? `Catalog: ${template.catalogId}` : '',
      template.documentationPath ? `Docs: ${template.documentationPath}` : '',
      template.notes || '',
    ].filter(Boolean).join('\n'),
    photoUrl: template.photoUrl,
    tags: template.tags || [],
  };
}

export function makeLayoutForFixture(
  fixture: Fixture,
  position: { x: number; y: number },
  existing?: Partial<PlacedFixture>
): PlacedFixture {
  return {
    id: existing?.id || `layout-${fixture.id}`,
    fixtureId: fixture.id,
    fixtureStoreId: fixture.id,
    name: fixture.name,
    type: fixture.type || 'Fixture',
    x: normalizeStageCoordinate(position.x, 'x'),
    y: normalizeStageCoordinate(position.y, 'y'),
    rotation: typeof (existing as any)?.rotation === 'number' ? (existing as any).rotation : 0,
    scale: typeof existing?.scale === 'number' && Number.isFinite(existing.scale) ? existing.scale : 1,
    dmxAddress: fixture.startAddress,
    startAddress: fixture.startAddress,
    color: (existing as any)?.color || '',
    radius: typeof (existing as any)?.radius === 'number' ? (existing as any).radius : 34,
    controls: (existing as any)?.controls || [],
  } as PlacedFixture;
}

export function fixtureIdsToIndices(fixtures: Fixture[], fixtureIds: string[]): number[] {
  const idSet = new Set(fixtureIds);
  return fixtures
    .map((fixture, index) => (idSet.has(fixture.id) ? index : -1))
    .filter((index) => index >= 0);
}

export function fixtureIndicesToIds(fixtures: Fixture[], fixtureIndices: number[]): string[] {
  return fixtureIndices
    .map((index) => fixtures[index]?.id)
    .filter((id): id is string => Boolean(id));
}

export function cleanupAfterFixtureDelete(
  fixturesBeforeDelete: Fixture[],
  groups: Group[],
  fixtureLayout: PlacedFixture[],
  fixtureId: string
): { groups: Group[]; fixtureLayout: PlacedFixture[]; selectedFixtures: string[] } {
  const deletedIndex = fixturesBeforeDelete.findIndex((fixture) => fixture.id === fixtureId);
  const cleanedGroups = groups
    .map((group) => ({
      ...group,
      fixtureIndices: group.fixtureIndices
        .filter((index) => index !== deletedIndex)
        .map((index) => (deletedIndex >= 0 && index > deletedIndex ? index - 1 : index)),
    }))
    .filter((group) => group.fixtureIndices.length > 0);

  return {
    groups: cleanedGroups,
    fixtureLayout: fixtureLayout.filter((item) => item.fixtureId !== fixtureId),
    selectedFixtures: [],
  };
}

function suggestion(
  key: string,
  name: string,
  reason: string,
  fixtureIndices: number[]
): SmartFixtureGroupSuggestion | null {
  const unique = Array.from(new Set(fixtureIndices)).sort((a, b) => a - b);
  return unique.length ? { key, name, reason, fixtureIndices: unique } : null;
}

export function suggestStageMapGroups(
  fixtures: Fixture[],
  fixtureLayout: PlacedFixture[]
): SmartFixtureGroupSuggestion[] {
  if (!fixtures.length || !fixtureLayout.length) return [];
  const normalized = normalizeFixtureLayout(fixtures, fixtureLayout);
  const byFixtureId = new Map(normalized.map((item) => [item.fixtureId, item]));
  const positioned = fixtures
    .map((fixture, index) => ({ fixture, index, layout: byFixtureId.get(fixture.id) }))
    .filter((item): item is { fixture: Fixture; index: number; layout: PlacedFixture } => Boolean(item.layout));

  const thirds = {
    left: STAGE_MAP_WIDTH / 3,
    right: (STAGE_MAP_WIDTH / 3) * 2,
    centerY: STAGE_MAP_HEIGHT / 2,
  };

  return [
    suggestion(
      'stage-left',
      'Stage Left',
      'Fixtures placed in the left third of the stage map.',
      positioned.filter((item) => item.layout.x < thirds.left).map((item) => item.index)
    ),
    suggestion(
      'stage-center',
      'Stage Center',
      'Fixtures placed in the center third of the stage map.',
      positioned.filter((item) => item.layout.x >= thirds.left && item.layout.x <= thirds.right).map((item) => item.index)
    ),
    suggestion(
      'stage-right',
      'Stage Right',
      'Fixtures placed in the right third of the stage map.',
      positioned.filter((item) => item.layout.x > thirds.right).map((item) => item.index)
    ),
    suggestion(
      'upstage',
      'Upstage',
      'Fixtures placed toward the back/top of the map.',
      positioned.filter((item) => item.layout.y < thirds.centerY).map((item) => item.index)
    ),
    suggestion(
      'downstage',
      'Downstage',
      'Fixtures placed toward the front/bottom of the map.',
      positioned.filter((item) => item.layout.y >= thirds.centerY).map((item) => item.index)
    ),
  ].filter((item): item is SmartFixtureGroupSuggestion => Boolean(item));
}
