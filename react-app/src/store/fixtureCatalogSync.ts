import {
  fixtureLibraryEntries,
  toStoreFixtureTemplate,
} from '../fixtures/library';
import type { Fixture, FixtureTemplate } from './types';

const cloneTemplate = (template: FixtureTemplate): FixtureTemplate => ({
  ...template,
  channels: template.channels?.map((channel) => ({ ...channel })),
  modes: template.modes?.map((mode) => ({
    ...mode,
    channelData: mode.channelData.map((channel) => ({
      ...channel,
      ranges: channel.ranges?.map((range) => ({ ...range })),
    })),
  })),
  tags: template.tags ? [...template.tags] : undefined,
});

const normalizeCustomTemplate = (template: FixtureTemplate): FixtureTemplate => ({
  ...template,
  channels: template.channels && Array.isArray(template.channels) && template.channels.length > 0
    ? template.channels
    : [{ name: 'Channel 1', type: 'other' }],
  isBuiltIn: false,
  isCustom: true,
});

export const buildCatalogFixtureTemplates = (): FixtureTemplate[] =>
  fixtureLibraryEntries.map((entry) => toStoreFixtureTemplate(entry) as FixtureTemplate);

export function mergeFixtureTemplatesWithCatalog(
  templates: FixtureTemplate[] = [],
  defaults: FixtureTemplate[] = []
): FixtureTemplate[] {
  const catalogProfiles = buildCatalogFixtureTemplates();
  const protectedIds = new Set(catalogProfiles.map((template) => template.id));
  const merged = [
    ...catalogProfiles.map(cloneTemplate),
    ...defaults
      .filter((template) => !protectedIds.has(template.id))
      .map((template) => normalizeCustomTemplate(cloneTemplate(template))),
  ];

  templates.forEach((template) => {
    if (!template || template.isBuiltIn || protectedIds.has(template.id)) return;
    const normalized = normalizeCustomTemplate(cloneTemplate(template));
    const existingIndex = merged.findIndex((candidate) => candidate.id === normalized.id);
    if (existingIndex >= 0) {
      merged[existingIndex] = normalized;
    } else {
      merged.push(normalized);
    }
  });

  return merged;
}

export function refreshFixtureCatalogPhotos(
  fixtures: Fixture[],
  templates: FixtureTemplate[] = buildCatalogFixtureTemplates()
): Fixture[] {
  const builtInTemplates = templates.filter((template) => template.isBuiltIn);
  const byId = new Map(builtInTemplates.map((template) => [template.id, template]));
  const byMakeModel = new Map(
    builtInTemplates
      .filter((template) => template.manufacturer && template.model)
      .map((template) => [`${template.manufacturer}::${template.model}`, template])
  );

  let changed = false;
  const nextFixtures = fixtures.map((fixture) => {
    const template = (fixture.templateId && byId.get(fixture.templateId)) ||
      (fixture.manufacturer && fixture.model
        ? byMakeModel.get(`${fixture.manufacturer}::${fixture.model}`)
        : undefined);

    if (!template?.photoUrl) return fixture;
    const canReplacePhoto = !fixture.photoUrl || fixture.photoUrl.startsWith('/fixtures/');
    if (!canReplacePhoto || fixture.photoUrl === template.photoUrl) return fixture;
    changed = true;
    return { ...fixture, photoUrl: template.photoUrl };
  });

  return changed ? nextFixtures : fixtures;
}
