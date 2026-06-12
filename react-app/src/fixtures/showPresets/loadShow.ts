import { parse as parseYaml } from 'yaml';
import type { Fixture, FixtureChannel, Group } from '../../store/types';
import {
  getFixtureLibraryEntryByCatalogId,
  type FixtureLibraryEntry,
  type FixtureLibraryMode,
} from '../library';

export interface ShowPresetFixture {
  catalogId: string;
  name: string;
  mode: string;
  startAddress: number;
}

export interface ShowPresetGroup {
  name: string;
  catalogIds: string[];
}

export interface ShowPresetFile {
  spec?: string;
  id: string;
  name: string;
  description?: string;
  version?: number;
  fixtures: ShowPresetFixture[];
  groups?: ShowPresetGroup[];
}

export interface ResolvedShow {
  preset: ShowPresetFile;
  fixtures: Fixture[];
  groups: Group[];
  warnings: string[];
}

const newId = (prefix: string) =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

const pickMode = (
  libEntry: FixtureLibraryEntry,
  modeName: string,
  warnings: string[],
): FixtureLibraryMode => {
  const exact = libEntry.modes.find((m) => m.name === modeName);
  if (exact) return exact;
  warnings.push(
    `Mode '${modeName}' not found on ${libEntry.catalogId} (${libEntry.name}); using '${libEntry.modes[0].name}'`,
  );
  return libEntry.modes[0];
};

export const resolveShow = (preset: ShowPresetFile): ResolvedShow => {
  const warnings: string[] = [];
  const catalogToFixtureId = new Map<string, string>();
  const fixtures: Fixture[] = [];

  for (const entry of preset.fixtures) {
    const libEntry = getFixtureLibraryEntryByCatalogId(entry.catalogId);
    if (!libEntry) {
      warnings.push(`Unknown catalogId '${entry.catalogId}' (${entry.name}) — skipped`);
      continue;
    }
    const mode = pickMode(libEntry, entry.mode, warnings);
    const channels: FixtureChannel[] = mode.channelData.map((ch, idx) => ({
      name: ch.name,
      type: ch.type,
      dmxAddress: entry.startAddress + idx,
      ranges: ch.ranges,
      ticksOnly: ch.ticksOnly,
    }));
    const id = newId('fixture');
    catalogToFixtureId.set(entry.catalogId, id);
    fixtures.push({
      id,
      name: entry.name,
      type: libEntry.type,
      manufacturer: libEntry.manufacturer,
      model: libEntry.model,
      mode: mode.name,
      templateId: libEntry.id,
      startAddress: entry.startAddress,
      channels,
      photoUrl: libEntry.photoUrl,
      tags: ['SHOW:Standard'],
    });
  }

  const groups: Group[] = (preset.groups ?? []).map((g) => {
    const fixtureIds = g.catalogIds
      .map((cid) => catalogToFixtureId.get(cid))
      .filter((v): v is string => Boolean(v));
    const fixtureIndices = fixtureIds
      .map((fid) => fixtures.findIndex((f) => f.id === fid))
      .filter((i) => i >= 0);
    return {
      id: newId('group'),
      name: g.name,
      fixtureIndices,
      fixtureIds,
      lastStates: new Array(512).fill(0),
      isMuted: false,
      isSolo: false,
      masterValue: 255,
    };
  });

  return { preset, fixtures, groups, warnings };
};

export const loadShowPreset = async (id: string): Promise<ResolvedShow> => {
  const res = await fetch(`/shows/${encodeURIComponent(id)}.yaml`);
  if (!res.ok) {
    throw new Error(`Failed to load show '${id}': ${res.status} ${res.statusText}`);
  }
  const text = await res.text();
  const parsed = parseYaml(text) as ShowPresetFile;
  if (!parsed || !Array.isArray(parsed.fixtures)) {
    throw new Error(`Show '${id}' is missing a 'fixtures' list`);
  }
  return resolveShow(parsed);
};
