import type { FixtureLibraryEntry } from './types';

export function toStoreFixtureTemplate(entry: FixtureLibraryEntry) {
  return {
    id: entry.id,
    catalogId: entry.catalogId,
    templateName: entry.name,
    defaultNamePrefix: entry.defaultNamePrefix,
    type: entry.type,
    category: entry.category,
    manufacturer: entry.manufacturer,
    model: entry.model,
    modelConfidence: entry.modelConfidence,
    photoUrl: entry.photoUrl,
    documentationPath: entry.documentationPath,
    notes: entry.notes,
    tags: entry.tags,
    addressing: entry.addressing,
    modes: entry.modes,
    channels: entry.modes[0]?.channelData ?? [],
    isBuiltIn: true,
    isCustom: false,
    isFavorite: false,
  };
}

export function toCanvasFixtureTemplate(entry: FixtureLibraryEntry) {
  return {
    id: entry.id,
    catalogId: entry.catalogId,
    name: entry.name,
    type: entry.type,
    category: entry.category,
    manufacturer: entry.manufacturer,
    model: entry.model,
    modelConfidence: entry.modelConfidence,
    photoUrl: entry.photoUrl,
    documentationPath: entry.documentationPath,
    notes: entry.notes,
    tags: entry.tags,
    addressing: entry.addressing,
    modes: entry.modes,
    channels: entry.modes[0]?.channelData ?? [],
  };
}
