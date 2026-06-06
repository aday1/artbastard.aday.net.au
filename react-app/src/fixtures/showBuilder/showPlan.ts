export interface ShowBuilderChannel {
  name: string;
  type: string;
  ranges?: Array<{ min: number; max: number; description: string }>;
  ticksOnly?: boolean;
}

export interface ShowBuilderTemplate {
  id: string;
  templateName: string;
  defaultNamePrefix: string;
  type?: string;
  category?: string;
  manufacturer?: string;
  model?: string;
  catalogId?: string;
  photoUrl?: string;
  tags?: string[];
  modes?: Array<{
    name: string;
    channels: number;
    channelData: ShowBuilderChannel[];
  }>;
  channels?: ShowBuilderChannel[];
}

export interface ExistingFixtureRange {
  id: string;
  name: string;
  startAddress: number;
  channelCount: number;
}

export interface ShowBuilderSelection {
  id?: string;
  templateId: string;
  quantity: number;
  modeName?: string;
  groupName?: string;
  startAddress?: number;
  gapChannels?: number;
  labelPrefix?: string;
}

export interface PlannedShowFixture {
  planId: string;
  selectionId?: string;
  templateId: string;
  templateName: string;
  fixtureName: string;
  groupName: string;
  fixtureNumberInGroup: number;
  type: string;
  manufacturer?: string;
  model?: string;
  catalogId?: string;
  category?: string;
  mode: string;
  startAddress: number;
  endAddress: number;
  channelCount: number;
  channels: ShowBuilderChannel[];
  photoUrl?: string;
  tags?: string[];
}

export interface PlannedShowGroup {
  name: string;
  fixturePlanIds: string[];
  fixtureNames: string[];
  fixtureCount: number;
  startAddress: number;
  endAddress: number;
}

export interface ShowPatchPlan {
  fixtures: PlannedShowFixture[];
  groups: PlannedShowGroup[];
  warnings: string[];
  errors: string[];
  totalChannels: number;
  highestAddress: number;
}

export interface ShowPatchOptions {
  showName: string;
  startAddress: number;
  gapChannels: number;
  avoidExisting: boolean;
}

interface OccupiedRange {
  id: string;
  name: string;
  start: number;
  end: number;
}

function cloneChannels(channels: ShowBuilderChannel[]): ShowBuilderChannel[] {
  return channels.map((channel) => ({
    ...channel,
    ranges: channel.ranges?.map((range) => ({ ...range })),
  }));
}

function clampAddress(value: number | undefined, fallback: number): number {
  return Math.max(1, Math.min(512, Math.floor(Number(value) || fallback)));
}

export function getTemplateMode(template: ShowBuilderTemplate, modeName?: string) {
  const preferredMode = modeName
    ? template.modes?.find((mode) => mode.name === modeName)
    : undefined;
  const mode = preferredMode ?? template.modes?.[0];

  if (mode) {
    return {
      modeName: mode.name,
      channels: cloneChannels(mode.channelData),
    };
  }

  return {
    modeName: 'Default mode',
    channels: cloneChannels(template.channels ?? [{ name: 'Channel 1', type: 'other' }]),
  };
}

function overlaps(start: number, end: number, occupied: OccupiedRange[]): OccupiedRange | undefined {
  return occupied.find((range) => !(end < range.start || start > range.end));
}

function findNextFreeStart(
  candidateStart: number,
  channelCount: number,
  occupied: OccupiedRange[]
): number {
  let start = clampAddress(candidateStart, 1);
  while (start + channelCount - 1 <= 512) {
    if (!overlaps(start, start + channelCount - 1, occupied)) {
      return start;
    }
    start += 1;
  }
  return start;
}

function buildGroupName(selection: ShowBuilderSelection, template: ShowBuilderTemplate, showName: string): string {
  return (
    selection.groupName?.trim() ||
    `${showName.trim() || 'Show'} ${template.defaultNamePrefix}`.trim()
  );
}

function buildFixtureName(
  selection: ShowBuilderSelection,
  template: ShowBuilderTemplate,
  groupName: string,
  index: number
): string {
  const prefix = selection.labelPrefix?.trim() || `${groupName} ${template.defaultNamePrefix}`.trim();
  return `${prefix} ${index + 1}`;
}

function uniqueWarningsFor(fixtures: PlannedShowFixture[]): string[] {
  const warnings = new Set<string>();

  fixtures.forEach((fixture) => {
    const tags = new Set((fixture.tags ?? []).map((tag) => tag.toUpperCase()));
    if (tags.has('LASER')) {
      warnings.add('Laser fixtures require physical safety checks before output is enabled.');
    }
    if (tags.has('PARTIAL MANUAL')) {
      warnings.add('Some fixtures use partial or torn manual sources; verify macro channels on the hardware.');
    }
  });

  return Array.from(warnings);
}

export function buildShowPatchPlan(
  templates: ShowBuilderTemplate[],
  selections: ShowBuilderSelection[],
  existingFixtures: ExistingFixtureRange[],
  options: ShowPatchOptions
): ShowPatchPlan {
  const warnings: string[] = [];
  const errors: string[] = [];
  const selected = selections.filter((selection) => selection.quantity > 0 && selection.templateId);
  const occupied: OccupiedRange[] = options.avoidExisting
    ? existingFixtures.map((fixture) => ({
        id: fixture.id,
        name: fixture.name,
        start: fixture.startAddress,
        end: fixture.startAddress + fixture.channelCount - 1,
      }))
    : [];

  const planned: PlannedShowFixture[] = [];
  let cursor = clampAddress(options.startAddress, 1);

  selected.forEach((selection, selectionIndex) => {
    const template = templates.find((item) => item.id === selection.templateId);
    if (!template) {
      errors.push(`Missing template: ${selection.templateId}`);
      return;
    }

    const mode = getTemplateMode(template, selection.modeName);
    const channelCount = mode.channels.length;
    if (channelCount < 1) {
      errors.push(`${template.templateName} has no channels`);
      return;
    }

    const groupName = buildGroupName(selection, template, options.showName);
    const rowGap = Math.max(0, Math.floor(selection.gapChannels ?? options.gapChannels ?? 0));
    let rowCursor = selection.startAddress ? clampAddress(selection.startAddress, cursor) : cursor;

    for (let index = 0; index < selection.quantity; index += 1) {
      const explicitFirstStart = index === 0 && selection.startAddress !== undefined;
      const startAddress = explicitFirstStart
        ? rowCursor
        : findNextFreeStart(rowCursor, channelCount, occupied);
      const endAddress = startAddress + channelCount - 1;

      if (endAddress > 512) {
        errors.push(`${template.templateName} ${index + 1} does not fit in this DMX universe`);
        break;
      }

      const collision = overlaps(startAddress, endAddress, occupied);
      if (collision) {
        errors.push(
          `${groupName} requested DMX ${startAddress}-${endAddress}, overlapping ${collision.name} DMX ${collision.start}-${collision.end}`
        );
        break;
      }

      const fixtureName = buildFixtureName(selection, template, groupName, index);
      const planId = `${selection.id || `row-${selectionIndex}`}-${template.id}-${index}-${startAddress}`;
      planned.push({
        planId,
        selectionId: selection.id,
        templateId: template.id,
        templateName: template.templateName,
        fixtureName,
        groupName,
        fixtureNumberInGroup: index + 1,
        type: template.type || 'Fixture',
        manufacturer: template.manufacturer,
        model: template.model,
        catalogId: template.catalogId,
        category: template.category,
        mode: mode.modeName,
        startAddress,
        endAddress,
        channelCount,
        channels: cloneChannels(mode.channels),
        photoUrl: template.photoUrl,
        tags: template.tags,
      });

      occupied.push({
        id: planId,
        name: fixtureName,
        start: startAddress,
        end: endAddress,
      });
      rowCursor = endAddress + rowGap + 1;
      cursor = Math.max(cursor, rowCursor);
    }
  });

  if (!planned.length && !errors.length) {
    warnings.push('Add at least one fixture row to generate a patch.');
  }

  warnings.push(...uniqueWarningsFor(planned));

  const groupMap = new Map<string, PlannedShowGroup>();
  planned.forEach((fixture) => {
    const existing = groupMap.get(fixture.groupName);
    if (existing) {
      existing.fixturePlanIds.push(fixture.planId);
      existing.fixtureNames.push(fixture.fixtureName);
      existing.fixtureCount += 1;
      existing.startAddress = Math.min(existing.startAddress, fixture.startAddress);
      existing.endAddress = Math.max(existing.endAddress, fixture.endAddress);
    } else {
      groupMap.set(fixture.groupName, {
        name: fixture.groupName,
        fixturePlanIds: [fixture.planId],
        fixtureNames: [fixture.fixtureName],
        fixtureCount: 1,
        startAddress: fixture.startAddress,
        endAddress: fixture.endAddress,
      });
    }
  });

  return {
    fixtures: planned,
    groups: Array.from(groupMap.values()),
    warnings,
    errors,
    totalChannels: planned.reduce((sum, fixture) => sum + fixture.channelCount, 0),
    highestAddress: planned.reduce((highest, fixture) => Math.max(highest, fixture.endAddress), 0),
  };
}

export function formatPatchSheet(plan: ShowPatchPlan): string {
  const rows = plan.fixtures.map((fixture) => {
    const catalog = fixture.catalogId ? ` ${fixture.catalogId}` : '';
    return `${fixture.groupName} | ${fixture.fixtureName}${catalog}: DMX ${fixture.startAddress}-${fixture.endAddress} (${fixture.channelCount}ch, ${fixture.mode})`;
  });
  return rows.join('\n');
}

function csv(value: string | number | undefined): string {
  const text = String(value ?? '');
  return `"${text.replace(/"/g, '""')}"`;
}

export function formatPatchCsv(plan: ShowPatchPlan): string {
  const header = [
    'Group',
    'Fixture',
    'Catalog ID',
    'Profile',
    'Mode',
    'DMX Start',
    'DMX End',
    'Channels',
  ];
  const rows = plan.fixtures.map((fixture) => [
    fixture.groupName,
    fixture.fixtureName,
    fixture.catalogId,
    fixture.templateName,
    fixture.mode,
    fixture.startAddress,
    fixture.endAddress,
    fixture.channelCount,
  ]);

  return [header, ...rows].map((row) => row.map(csv).join(',')).join('\n');
}

