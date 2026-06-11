import type { Fixture } from '../../../store/types';
import { emitYaml, parseYaml } from '../yamlSerializer';

export interface FixturesSectionPayload {
  fixtures: Fixture[];
}

export function exportFixtures(fixtures: Fixture[]): string {
  return emitYaml({ fixtures: fixtures.map(toYamlShape) });
}

export function parseFixtures(yamlText: string): { fixtures: Fixture[]; warnings: string[] } {
  const warnings: string[] = [];
  const raw = parseYaml<FixturesSectionPayload>(yamlText);
  if (!raw || !Array.isArray(raw.fixtures)) {
    throw new Error('fixtures.yaml must have a top-level "fixtures" list.');
  }
  const fixtures: Fixture[] = [];
  raw.fixtures.forEach((entry, index) => {
    if (!entry || typeof entry !== 'object') {
      warnings.push(`fixture #${index + 1}: skipped (not an object)`);
      return;
    }
    if (!entry.id || !entry.name) {
      warnings.push(`fixture #${index + 1}: missing id or name`);
      return;
    }
    fixtures.push(normalize(entry));
  });
  return { fixtures, warnings };
}

function toYamlShape(fixture: Fixture) {
  return {
    id: fixture.id,
    name: fixture.name,
    type: fixture.type,
    manufacturer: fixture.manufacturer,
    model: fixture.model,
    mode: fixture.mode,
    templateId: fixture.templateId,
    startAddress: fixture.startAddress,
    tags: fixture.tags && fixture.tags.length ? fixture.tags : undefined,
    notes: fixture.notes,
    isFavorite: fixture.isFavorite || undefined,
    isFlagged: fixture.isFlagged || undefined,
    photoUrl: fixture.photoUrl,
    flags: fixture.flags && fixture.flags.length ? fixture.flags : undefined,
    channels: fixture.channels.map((ch) => ({
      name: ch.name,
      type: ch.type,
      dmxAddress: ch.dmxAddress,
    })),
  };
}

function normalize(entry: any): Fixture {
  return {
    id: String(entry.id),
    name: String(entry.name),
    type: String(entry.type || 'generic'),
    manufacturer: entry.manufacturer ? String(entry.manufacturer) : undefined,
    model: entry.model ? String(entry.model) : undefined,
    mode: entry.mode ? String(entry.mode) : undefined,
    templateId: entry.templateId ? String(entry.templateId) : undefined,
    startAddress: Number(entry.startAddress) || 1,
    channels: Array.isArray(entry.channels)
      ? entry.channels.map((ch: any, idx: number) => ({
          name: String(ch?.name || `Ch ${idx + 1}`),
          type: String(ch?.type || 'other'),
          dmxAddress: Number(ch?.dmxAddress) || 1,
        }))
      : [],
    notes: entry.notes ? String(entry.notes) : undefined,
    flags: Array.isArray(entry.flags) ? entry.flags : undefined,
    isFlagged: entry.isFlagged ? Boolean(entry.isFlagged) : undefined,
    isFavorite: entry.isFavorite ? Boolean(entry.isFavorite) : undefined,
    photoUrl: entry.photoUrl ? String(entry.photoUrl) : undefined,
    tags: Array.isArray(entry.tags) ? entry.tags.map((t: any) => String(t)) : undefined,
  };
}
