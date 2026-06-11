import type { FixtureLibraryEntry, FixtureLibraryRange } from './types';

export interface FixtureLibraryValidationIssue {
  entryId: string;
  message: string;
}

function rangeHasValidBounds(range: FixtureLibraryRange): boolean {
  return (
    Number.isInteger(range.min) &&
    Number.isInteger(range.max) &&
    range.min >= 0 &&
    range.max <= 255 &&
    range.min <= range.max &&
    range.description.trim().length > 0
  );
}

export function validateFixtureLibraryEntries(entries: FixtureLibraryEntry[]): FixtureLibraryValidationIssue[] {
  const issues: FixtureLibraryValidationIssue[] = [];
  const seenIds = new Set<string>();
  const seenCatalogIds = new Set<string>();

  entries.forEach((entry) => {
    if (seenIds.has(entry.id)) {
      issues.push({ entryId: entry.id, message: `Duplicate fixture id: ${entry.id}` });
    }
    seenIds.add(entry.id);

    if (seenCatalogIds.has(entry.catalogId)) {
      issues.push({ entryId: entry.id, message: `Duplicate catalog id: ${entry.catalogId}` });
    }
    seenCatalogIds.add(entry.catalogId);

    if (!entry.catalogId.match(/^AB-FIX-\d{3}$/)) {
      issues.push({ entryId: entry.id, message: `Catalog id must use AB-FIX-### format: ${entry.catalogId}` });
    }

    if (!entry.name.trim() || !entry.defaultNamePrefix.trim() || !entry.type.trim() || !entry.category.trim()) {
      issues.push({ entryId: entry.id, message: 'Fixture identity fields must be populated' });
    }

    if (!entry.modes.length) {
      issues.push({ entryId: entry.id, message: 'Fixture must define at least one DMX mode' });
    }

    entry.modes.forEach((mode) => {
      if (mode.channels !== mode.channelData.length) {
        issues.push({
          entryId: entry.id,
          message: `${mode.name} declares ${mode.channels} channels but defines ${mode.channelData.length}`,
        });
      }

      mode.channelData.forEach((channel, index) => {
        if (!channel.name.trim() || !channel.type.trim()) {
          issues.push({ entryId: entry.id, message: `${mode.name} channel ${index + 1} needs name and type` });
        }

        channel.ranges?.forEach((range) => {
          if (!rangeHasValidBounds(range)) {
            issues.push({
              entryId: entry.id,
              message: `${mode.name} channel ${index + 1} has invalid range ${range.min}-${range.max}`,
            });
          }
        });
      });
    });

    if (entry.addressing?.method === 'dip-switch') {
      const switches = entry.addressing.addressRange.switches;
      if (!switches.length) {
        issues.push({ entryId: entry.id, message: 'DIP-switch addressing needs switch values' });
      }
      if (entry.addressing.addressRange.min < 1 || entry.addressing.addressRange.max > 512) {
        issues.push({ entryId: entry.id, message: 'DIP-switch address range must stay within DMX 1-512' });
      }
    }
  });

  return issues;
}

