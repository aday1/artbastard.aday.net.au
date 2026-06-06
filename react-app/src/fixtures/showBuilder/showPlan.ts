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
  templateId: string;
  quantity: number;
}

export interface PlannedShowFixture {
  planId: string;
  templateId: string;
  templateName: string;
  fixtureName: string;
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

export interface ShowPatchPlan {
  fixtures: PlannedShowFixture[];
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

export function getTemplateMode(template: ShowBuilderTemplate) {
  if (template.modes?.[0]) {
    return {
      modeName: template.modes[0].name,
      channels: cloneChannels(template.modes[0].channelData),
    };
  }

  return {
    modeName: 'Default mode',
    channels: cloneChannels(template.channels ?? [{ name: 'Channel 1', type: 'other' }]),
  };
}

function overlaps(start: number, end: number, occupied: OccupiedRange[]): boolean {
  return occupied.some((range) => !(end < range.start || start > range.end));
}

function findNextFreeStart(
  candidateStart: number,
  channelCount: number,
  occupied: OccupiedRange[]
): number {
  let start = Math.max(1, Math.min(512, Math.floor(candidateStart || 1)));
  while (start + channelCount - 1 <= 512) {
    if (!overlaps(start, start + channelCount - 1, occupied)) {
      return start;
    }
    start += 1;
  }
  return start;
}

export function buildShowPatchPlan(
  templates: ShowBuilderTemplate[],
  selections: ShowBuilderSelection[],
  existingFixtures: ExistingFixtureRange[],
  options: ShowPatchOptions
): ShowPatchPlan {
  const warnings: string[] = [];
  const errors: string[] = [];
  const selected = selections.filter((selection) => selection.quantity > 0);
  const occupied: OccupiedRange[] = options.avoidExisting
    ? existingFixtures.map((fixture) => ({
        id: fixture.id,
        name: fixture.name,
        start: fixture.startAddress,
        end: fixture.startAddress + fixture.channelCount - 1,
      }))
    : [];

  const planned: PlannedShowFixture[] = [];
  let cursor = Math.max(1, Math.min(512, Math.floor(options.startAddress || 1)));

  selected.forEach((selection) => {
    const template = templates.find((item) => item.id === selection.templateId);
    if (!template) {
      errors.push(`Missing template: ${selection.templateId}`);
      return;
    }

    const mode = getTemplateMode(template);
    const channelCount = mode.channels.length;
    if (channelCount < 1) {
      errors.push(`${template.templateName} has no channels`);
      return;
    }

    for (let index = 0; index < selection.quantity; index += 1) {
      const startAddress = findNextFreeStart(cursor, channelCount, occupied);
      const endAddress = startAddress + channelCount - 1;
      if (endAddress > 512) {
        errors.push(`${template.templateName} ${index + 1} does not fit in this DMX universe`);
        break;
      }

      const fixtureName = `${options.showName.trim() || 'Show'} ${template.defaultNamePrefix} ${index + 1}`;
      const planId = `${template.id}-${index}-${startAddress}`;
      planned.push({
        planId,
        templateId: template.id,
        templateName: template.templateName,
        fixtureName,
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
      cursor = endAddress + Math.max(0, options.gapChannels) + 1;
    }
  });

  if (!planned.length && !errors.length) {
    warnings.push('Select at least one fixture type to generate a patch.');
  }

  return {
    fixtures: planned,
    warnings,
    errors,
    totalChannels: planned.reduce((sum, fixture) => sum + fixture.channelCount, 0),
    highestAddress: planned.reduce((highest, fixture) => Math.max(highest, fixture.endAddress), 0),
  };
}

export function formatPatchSheet(plan: ShowPatchPlan): string {
  const rows = plan.fixtures.map((fixture) => {
    const catalog = fixture.catalogId ? ` ${fixture.catalogId}` : '';
    return `${fixture.fixtureName}${catalog}: DMX ${fixture.startAddress}-${fixture.endAddress} (${fixture.channelCount}ch, ${fixture.mode})`;
  });
  return rows.join('\n');
}

