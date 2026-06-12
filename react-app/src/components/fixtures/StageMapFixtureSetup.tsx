import React, { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { type Fixture, type Group, type PlacedFixture, useStore } from '../../store';
import { getFixtureTypeColor, getFixtureTypeIcon } from '../../utils/fixturePresentation';
import { mergeSmartFixtureGroups, suggestFixtureGroups } from '../../fixtures/autoGroups';
import {
  cleanupAfterFixtureDelete,
  createFixtureFromTemplate,
  findNextAvailableDmxStart,
  fixtureIdsToIndices,
  fixtureIndicesToIds,
  makeLayoutForFixture,
  normalizeFixtureLayout,
  STAGE_MAP_HEIGHT,
  STAGE_MAP_WIDTH,
  suggestStageMapGroups,
  type StageMapViewMode,
} from '../../fixtures/stageMap';
import { STAGE_RIG_PRESETS, buildRigFromPreset, type StageRigPreset } from '../../fixtures/stageRigPresets';
import { loadShowPreset } from '../../fixtures/showPresets/loadShow';
import { getTemplateMode } from '../../fixtures/showBuilder/showPlan';
import { SceneSeedButton } from '../scenes/SceneSeedButton';
import { ActSeedButton } from '../acts/ActSeedButton';
import { UnifiedStageWorkbench } from './UnifiedStageWorkbench';
import { LucideIcon } from '../ui/LucideIcon';
import { HoverZoomImage } from '../ui/HoverZoomImage';
import styles from './StageMapFixtureSetup.module.scss';

type StageTool = 'select' | 'box';

interface DragState {
  fixtureId: string;
  pointerId: number;
  startClient: { x: number; y: number };
  origin: { x: number; y: number };
}

interface SelectionBox {
  start: { x: number; y: number };
  current: { x: number; y: number };
}

const safeGroupId = (name: string) =>
  name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'group';

const makeGroup = (name: string, fixtureIndices: number[]): Group => ({
  id: `group-map-${Date.now()}-${safeGroupId(name)}-${Math.random().toString(36).slice(2, 7)}`,
  name,
  fixtureIndices,
  lastStates: new Array(512).fill(0),
  isMuted: false,
  isSolo: false,
  masterValue: 255,
});

const fixtureEndAddress = (fixture: Fixture) => fixture.startAddress + fixture.channels.length - 1;

function findAddressConflict(fixtures: Fixture[], target: Fixture): Fixture | null {
  const start = target.startAddress;
  const end = fixtureEndAddress(target);
  return fixtures.find((fixture) => {
    if (fixture.id === target.id) return false;
    return !(end < fixture.startAddress || start > fixtureEndAddress(fixture));
  }) || null;
}

export const StageMapFixtureSetup: React.FC = () => {
  const stageRef = useRef<HTMLDivElement>(null);
  const {
    addNotification,
    fixtureLayout,
    fixtureTemplates,
    fixtures,
    groups,
    scenes,
    seedActsFromScenes,
    seedScenesFromFixtures,
    selectedFixtures,
    setFixtureLayout,
    setFixtures,
    setGroups,
    setSelectedFixtures,
  } = useStore((state) => ({
    addNotification: state.addNotification,
    fixtureLayout: state.fixtureLayout,
    fixtureTemplates: state.fixtureTemplates,
    fixtures: state.fixtures,
    groups: state.groups,
    scenes: state.scenes,
    seedActsFromScenes: state.seedActsFromScenes,
    seedScenesFromFixtures: state.seedScenesFromFixtures,
    selectedFixtures: state.selectedFixtures,
    setFixtureLayout: state.setFixtureLayout,
    setFixtures: state.setFixtures,
    setGroups: state.setGroups,
    setSelectedFixtures: state.setSelectedFixtures,
  }));

  const [viewMode, setViewMode] = useState<StageMapViewMode>('top');
  const [tool, setTool] = useState<StageTool>('select');
  const [gridEnabled, setGridEnabled] = useState(true);
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [selectionBox, setSelectionBox] = useState<SelectionBox | null>(null);
  const [newGroupName, setNewGroupName] = useState('Map Group');
  const [isGiddyUp, setIsGiddyUp] = useState(false);
  const [isLoadingStandardShow, setIsLoadingStandardShow] = useState(false);
  const [showAutoAdd, setShowAutoAdd] = useState(false);
  const [autoAddBusy, setAutoAddBusy] = useState<string | null>(null);
  const [stageToolsOpen, setStageToolsOpen] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem('stage-map-tools-open') === '1';
  });
  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem('stage-map-tools-open', stageToolsOpen ? '1' : '0');
  }, [stageToolsOpen]);
  const [contextMenu, setContextMenu] = useState<{ fixtureId: string; x: number; y: number } | null>(null);

  const layout = useMemo(() => normalizeFixtureLayout(fixtures, fixtureLayout), [fixtures, fixtureLayout]);
  const layoutByFixtureId = useMemo(() => new Map(layout.map((item) => [item.fixtureId, item])), [layout]);
  const selectedIdSet = useMemo(() => new Set(selectedFixtures), [selectedFixtures]);
  const selectedFixtureObjects = useMemo(
    () => fixtures.filter((fixture) => selectedIdSet.has(fixture.id)),
    [fixtures, selectedIdSet]
  );
  const primarySelectedFixture = selectedFixtureObjects[0] || null;
  const primaryConflict = primarySelectedFixture ? findAddressConflict(fixtures, primarySelectedFixture) : null;

  const templateTypes = useMemo(() => {
    const values = fixtureTemplates
      .filter((template) => template.id !== 'custom-blank')
      .map((template) => template.type || template.category || 'Fixture');
    return ['all', ...Array.from(new Set(values)).sort((a, b) => a.localeCompare(b))];
  }, [fixtureTemplates]);

  const filteredTemplates = useMemo(() => {
    const term = search.trim().toLowerCase();
    return [...fixtureTemplates]
      .filter((template) => template.id !== 'custom-blank')
      .filter((template) => !favoritesOnly || template.isFavorite)
      .filter((template) => typeFilter === 'all' || (template.type || template.category || 'Fixture') === typeFilter)
      .filter((template) => {
        if (!term) return true;
        return [
          template.templateName,
          template.defaultNamePrefix,
          template.manufacturer,
          template.model,
          template.catalogId,
          template.type,
          template.category,
        ].some((value) => String(value || '').toLowerCase().includes(term));
      })
      .sort((a, b) => {
        const af = a.isFavorite ? 0 : 1;
        const bf = b.isFavorite ? 0 : 1;
        if (af !== bf) return af - bf;
        return a.templateName.localeCompare(b.templateName);
      });
  }, [favoritesOnly, fixtureTemplates, search, typeFilter]);

  const smartSuggestions = useMemo(
    () => [
      ...suggestFixtureGroups(fixtures),
      ...suggestStageMapGroups(fixtures, layout),
    ],
    [fixtures, layout]
  );

  const selectedGroupMembership = useMemo(() => {
    if (!selectedFixtures.length) return [];
    const selectedSet = new Set(selectedFixtures);
    return groups.map((group) => {
      const ids = fixtureIndicesToIds(fixtures, group.fixtureIndices);
      const included = ids.filter((id) => selectedSet.has(id)).length;
      return {
        group,
        included,
        total: selectedFixtures.length,
        allSelectedInGroup: selectedFixtures.length > 0 && included === selectedFixtures.length,
      };
    });
  }, [fixtures, groups, selectedFixtures]);

  const notify = (message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info') => {
    addNotification?.({ message, type, priority: type === 'error' ? 'high' : 'normal' });
  };

  const stagePointFromEvent = (event: Pick<PointerEvent | React.PointerEvent, 'clientX' | 'clientY'>) => {
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) return { x: STAGE_MAP_WIDTH / 2, y: STAGE_MAP_HEIGHT / 2 };
    const x = ((event.clientX - rect.left) / rect.width) * STAGE_MAP_WIDTH;
    const y = ((event.clientY - rect.top) / rect.height) * STAGE_MAP_HEIGHT;
    const snapped = snapEnabled ? { x: Math.round(x / 25) * 25, y: Math.round(y / 25) * 25 } : { x, y };
    return {
      x: Math.max(0, Math.min(STAGE_MAP_WIDTH, Math.round(snapped.x))),
      y: Math.max(0, Math.min(STAGE_MAP_HEIGHT, Math.round(snapped.y))),
    };
  };

  const persistFixtures = async (nextFixtures: Fixture[], nextLayout?: PlacedFixture[]) => {
    setFixtures(nextFixtures);
    await axios.post('/api/fixtures', {
      fixtures: nextFixtures,
      ...(nextLayout ? { fixtureLayout: nextLayout } : {}),
    });
  };

  const persistLayout = async (nextLayout: PlacedFixture[]) => {
    const normalized = normalizeFixtureLayout(fixtures, nextLayout);
    setFixtureLayout(normalized);
    await axios.post('/api/fixture-layout', { fixtureLayout: normalized });
  };

  const persistGroups = async (nextGroups: Group[]) => {
    setGroups(nextGroups);
    await axios.post('/api/groups', { groups: nextGroups });
  };

  const placeTemplateAt = async (templateId: string, point: { x: number; y: number }) => {
    const template = fixtureTemplates.find((item) => item.id === templateId);
    if (!template) return;
    const mode = template.modes?.[0];
    const channelCount = Math.max(1, mode?.channelData?.length || template.channels?.length || mode?.channels || 1);
    const startAddress = findNextAvailableDmxStart(fixtures, channelCount);
    const samePrefixCount = fixtures.filter((fixture) =>
      fixture.name.startsWith(template.defaultNamePrefix || template.templateName)
    ).length;
    const fixture = createFixtureFromTemplate(template, startAddress, samePrefixCount + 1);
    const nextFixtures = [...fixtures, fixture];
    const nextLayout = [
      ...layout.filter((item) => item.fixtureId !== fixture.id),
      makeLayoutForFixture(fixture, point),
    ];

    try {
      setFixtureLayout(nextLayout);
      await persistFixtures(nextFixtures, nextLayout);
      await axios.post('/api/fixture-layout', { fixtureLayout: nextLayout });
      setSelectedFixtures([fixture.id]);
      notify(`Patched ${fixture.name} at DMX ${fixture.startAddress}`, 'success');
    } catch (error) {
      console.error('Failed to place fixture from stage map:', error);
      notify('Fixture was placed locally, but server save failed', 'warning');
    }
  };

  const updateLayoutItem = async (fixtureId: string, patch: Partial<PlacedFixture>, persist = true) => {
    const fixture = fixtures.find((item) => item.id === fixtureId);
    if (!fixture) return;
    const existing = layoutByFixtureId.get(fixtureId);
    const nextItem = makeLayoutForFixture(
      fixture,
      {
        x: patch.x ?? existing?.x ?? STAGE_MAP_WIDTH / 2,
        y: patch.y ?? existing?.y ?? STAGE_MAP_HEIGHT / 2,
      },
      { ...existing, ...patch }
    );
    const nextLayout = [
      ...layout.filter((item) => item.fixtureId !== fixtureId),
      nextItem,
    ];
    setFixtureLayout(nextLayout);
    if (persist) {
      try {
        await axios.post('/api/fixture-layout', { fixtureLayout: nextLayout });
      } catch (error) {
        console.error('Failed to save fixture layout:', error);
        notify('Stage map moved locally, but server save failed', 'warning');
      }
    }
  };

  const findTemplateForFixture = (fixture: Fixture) => {
    if (fixture.templateId) {
      const byId = fixtureTemplates.find((tmpl) => tmpl.id === fixture.templateId);
      if (byId) return byId;
    }
    if (fixture.manufacturer && fixture.model) {
      const byModel = fixtureTemplates.find(
        (tmpl) => tmpl.manufacturer === fixture.manufacturer && tmpl.model === fixture.model
      );
      if (byModel) return byModel;
    }
    return undefined;
  };

  const changeFixtureMode = async (fixtureId: string, newModeName: string) => {
    const fixture = fixtures.find((item) => item.id === fixtureId);
    if (!fixture) return;
    const template = findTemplateForFixture(fixture);
    if (!template) {
      notify('Cannot switch mode: source template not found in library', 'warning');
      return;
    }
    if (fixture.mode === newModeName) return;

    const nextMode = getTemplateMode(template as any, newModeName);
    const newChannelCount = nextMode.channels.length;
    const oldChannelCount = fixture.channels.length;

    let nextStartAddress = fixture.startAddress;
    if (newChannelCount > oldChannelCount) {
      const othersOnly = fixtures.filter((item) => item.id !== fixtureId);
      const myEnd = fixture.startAddress + newChannelCount - 1;
      const collides = othersOnly.some((other) => {
        const start = other.startAddress;
        const end = other.startAddress + other.channels.length - 1;
        return !(myEnd < start || fixture.startAddress > end);
      });
      if (collides || myEnd > 512) {
        nextStartAddress = findNextAvailableDmxStart(othersOnly, newChannelCount, fixture.startAddress);
      }
    }

    const updatedFixture: Fixture = {
      ...fixture,
      mode: nextMode.modeName,
      channels: nextMode.channels.map((channel) => ({
        ...channel,
        ranges: channel.ranges?.map((range) => ({ ...range })),
      })) as Fixture['channels'],
      startAddress: nextStartAddress,
    };

    const nextFixtures = fixtures.map((item) => (item.id === fixtureId ? updatedFixture : item));
    try {
      await persistFixtures(nextFixtures);
      notify(
        nextStartAddress === fixture.startAddress
          ? `Mode switched to ${nextMode.modeName}`
          : `Mode switched to ${nextMode.modeName}; relocated to DMX ${nextStartAddress}`,
        'success',
      );
    } catch (error) {
      console.error('Failed to switch fixture mode:', error);
      notify('Mode change saved locally, but server save failed', 'warning');
    }
  };

  const updatePrimaryFixture = async (patch: Partial<Fixture>) => {
    if (!primarySelectedFixture) return;
    const nextFixtures = fixtures.map((fixture) =>
      fixture.id === primarySelectedFixture.id ? { ...fixture, ...patch } : fixture
    );
    const nextLayout = normalizeFixtureLayout(nextFixtures, layout);
    try {
      await persistFixtures(nextFixtures);
      setFixtureLayout(nextLayout);
      await axios.post('/api/fixture-layout', { fixtureLayout: nextLayout });
    } catch (error) {
      console.error('Failed to save fixture edit:', error);
      notify('Fixture edit saved locally, but server save failed', 'warning');
    }
  };

  const deleteSelectedFixtures = async () => {
    if (!selectedFixtures.length) return;
    const idsToDelete = new Set(selectedFixtures);
    const nextFixtures = fixtures.filter((fixture) => !idsToDelete.has(fixture.id));
    const nextGroups = groups
      .map((group) => {
        const keptIds = fixtureIndicesToIds(fixtures, group.fixtureIndices).filter((id) => !idsToDelete.has(id));
        return { ...group, fixtureIndices: fixtureIdsToIndices(nextFixtures, keptIds) };
      })
      .filter((group) => group.fixtureIndices.length > 0);
    const nextLayout = layout.filter((item) => !idsToDelete.has(item.fixtureId));

    try {
      setFixtures(nextFixtures);
      setGroups(nextGroups);
      setFixtureLayout(nextLayout);
      setSelectedFixtures([]);
      await Promise.all([...idsToDelete].map((fixtureId) => axios.delete(`/api/fixtures/${fixtureId}`)));
      await axios.post('/api/groups', { groups: nextGroups });
      await axios.post('/api/fixture-layout', { fixtureLayout: nextLayout });
      notify(`Deleted ${idsToDelete.size} fixture${idsToDelete.size === 1 ? '' : 's'}`, 'success');
    } catch (error) {
      console.error('Failed to delete fixtures cleanly:', error);
      notify('Fixture delete was applied locally, but server sync failed', 'warning');
    }
  };

  const createGroupFromSelection = async () => {
    const indices = fixtureIdsToIndices(fixtures, selectedFixtures);
    if (!newGroupName.trim() || indices.length === 0) {
      notify('Select fixtures on the map before creating a group', 'warning');
      return;
    }
    const nextGroups = [...groups, makeGroup(newGroupName.trim(), indices)];
    try {
      await persistGroups(nextGroups);
      notify(`Created group ${newGroupName.trim()}`, 'success');
      setNewGroupName('Map Group');
    } catch (error) {
      console.error('Failed to create map group:', error);
      notify('Group was created locally, but server save failed', 'warning');
    }
  };

  const toggleSelectionInGroup = async (group: Group) => {
    if (!selectedFixtures.length) return;
    const currentIds = fixtureIndicesToIds(fixtures, group.fixtureIndices);
    const selectedSet = new Set(selectedFixtures);
    const allIncluded = selectedFixtures.every((id) => currentIds.includes(id));
    const nextIds = allIncluded
      ? currentIds.filter((id) => !selectedSet.has(id))
      : Array.from(new Set([...currentIds, ...selectedFixtures]));
    const nextGroups = groups.map((item) =>
      item.id === group.id
        ? { ...item, fixtureIndices: fixtureIdsToIndices(fixtures, nextIds) }
        : item
    ).filter((item) => item.fixtureIndices.length > 0);

    try {
      await persistGroups(nextGroups);
    } catch (error) {
      console.error('Failed to update group membership:', error);
      notify('Group update was applied locally, but server save failed', 'warning');
    }
  };

  const applySmartGroups = async () => {
    if (!fixtures.length) {
      notify('Add fixtures before applying smart groups', 'warning');
      return;
    }
    const result = mergeSmartFixtureGroups(groups, smartSuggestions);
    try {
      await persistGroups(result.groups);
      notify(`Applied ${smartSuggestions.length} smart groups`, 'success');
    } catch (error) {
      console.error('Failed to save smart groups:', error);
      notify('Smart groups applied locally, but server save failed', 'warning');
    }
  };

  const runGiddyUp = async () => {
    if (!fixtures.length || isGiddyUp) {
      notify('Drop fixtures onto the stage before running Giddy Up', 'warning');
      return;
    }
    setIsGiddyUp(true);
    try {
      const result = mergeSmartFixtureGroups(groups, smartSuggestions);
      await persistGroups(result.groups);
      const sceneSummary = await seedScenesFromFixtures({
        packId: 'smart-starter-40',
        target: 'deck-a',
        includeAutomation: true,
      });
      const actSummary = await seedActsFromScenes({
        packId: 'starter-acts',
        includeTriggers: true,
      });
      notify(
        `Giddy Up complete: ${result.created + result.refreshed} groups, ${sceneSummary.created + sceneSummary.refreshed} scenes, ${actSummary.created + actSummary.refreshed} ACTS`,
        'success'
      );
    } catch (error) {
      console.error('Failed to run Giddy Up setup:', error);
      notify('Giddy Up hit a server save problem; local state may still be updated', 'warning');
    } finally {
      setIsGiddyUp(false);
    }
  };

  const loadStandardShow = async () => {
    if (isLoadingStandardShow) return;
    if (fixtures.length > 0) {
      const ok = window.confirm(
        `Replace your current ${fixtures.length} fixture${fixtures.length === 1 ? '' : 's'} and ${groups.length} group${groups.length === 1 ? '' : 's'} with the Standard Show? This cannot be undone from the UI.`,
      );
      if (!ok) return;
    }
    setIsLoadingStandardShow(true);
    try {
      const resolved = await loadShowPreset('standard-show');
      const cols = 3;
      const rows = Math.ceil(resolved.fixtures.length / cols);
      const xMargin = STAGE_MAP_WIDTH * 0.15;
      const yMargin = STAGE_MAP_HEIGHT * 0.2;
      const xStep = (STAGE_MAP_WIDTH - 2 * xMargin) / Math.max(1, cols - 1);
      const yStep = (STAGE_MAP_HEIGHT - 2 * yMargin) / Math.max(1, rows - 1);
      const nextLayout: PlacedFixture[] = resolved.fixtures.map((fixture, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        return makeLayoutForFixture(fixture, {
          x: Math.round(xMargin + col * xStep),
          y: Math.round(yMargin + row * yStep),
        });
      });
      setFixtureLayout(nextLayout);
      await axios.post('/api/fixtures', {
        fixtures: resolved.fixtures,
        fixtureLayout: nextLayout,
        groups: resolved.groups,
      });
      setFixtures(resolved.fixtures);
      setGroups(resolved.groups);
      setSelectedFixtures([]);
      const highest = resolved.fixtures.reduce(
        (max, f) => Math.max(max, f.startAddress + f.channels.length - 1),
        0,
      );
      if (resolved.warnings.length) {
        resolved.warnings.forEach((w) => notify(w, 'warning'));
      }
      notify(
        `Standard Show loaded — ${resolved.fixtures.length} fixtures, ${resolved.groups.length} groups, highest DMX ${highest}`,
        'success',
      );
    } catch (error) {
      console.error('Failed to load Standard Show:', error);
      notify(
        `Failed to load Standard Show: ${error instanceof Error ? error.message : 'unknown error'}`,
        'error',
      );
    } finally {
      setIsLoadingStandardShow(false);
    }
  };

  const runAutoAddPreset = async (preset: StageRigPreset) => {
    if (autoAddBusy) return;
    setAutoAddBusy(preset.id);
    try {
      const { fixtures: nextFixtures, layout: nextLayout, unmatched } = buildRigFromPreset(
        preset,
        fixtures,
        fixtureTemplates
      );
      const added = nextFixtures.length - fixtures.length;
      if (added <= 0) {
        notify(`No fixture templates available for "${preset.name}"`, 'warning');
        return;
      }
      const mergedLayout = [
        ...layout.filter((item) => !nextLayout.some((entry) => entry.fixtureId === item.fixtureId)),
        ...nextLayout,
      ];
      setFixtureLayout(mergedLayout);
      await persistFixtures(nextFixtures, mergedLayout);
      await axios.post('/api/fixture-layout', { fixtureLayout: mergedLayout });
      setSelectedFixtures(nextLayout.map((item) => item.fixtureId));
      const tail = unmatched.length ? ` (${unmatched.length} slot${unmatched.length === 1 ? '' : 's'} skipped)` : '';
      notify(`Auto-added ${added} fixtures from "${preset.name}"${tail}`, 'success');
      setShowAutoAdd(false);
    } catch (error) {
      console.error('Auto-add preset failed:', error);
      notify('Auto-add was applied locally, but server save failed', 'warning');
    } finally {
      setAutoAddBusy(null);
    }
  };

  const handleStagePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;
    if (contextMenu) setContextMenu(null);
    // Right-click on empty stage: just close any open menu, don't start anything.
    if (event.button === 2) return;
    const point = stagePointFromEvent(event);
    if (selectedTemplateId && tool === 'select') {
      placeTemplateAt(selectedTemplateId, point);
      return;
    }
    // Drag-marquee on the default Select tool (no template chosen) as well as
    // the explicit Box tool — operators don't have to switch modes to lasso.
    if (tool === 'box' || (tool === 'select' && !selectedTemplateId)) {
      setSelectionBox({ start: point, current: point });
      event.currentTarget.setPointerCapture(event.pointerId);
      return;
    }
    setSelectedFixtures([]);
  };

  const handleStagePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (selectionBox) {
      setSelectionBox({ ...selectionBox, current: stagePointFromEvent(event) });
    }
  };

  const handleStagePointerUp = () => {
    if (!selectionBox) return;
    const left = Math.min(selectionBox.start.x, selectionBox.current.x);
    const right = Math.max(selectionBox.start.x, selectionBox.current.x);
    const top = Math.min(selectionBox.start.y, selectionBox.current.y);
    const bottom = Math.max(selectionBox.start.y, selectionBox.current.y);
    const dragged = Math.abs(selectionBox.current.x - selectionBox.start.x) > 2
      || Math.abs(selectionBox.current.y - selectionBox.start.y) > 2;
    if (dragged) {
      const selected = layout
        .filter((item) => item.x >= left && item.x <= right && item.y >= top && item.y <= bottom)
        .map((item) => item.fixtureId);
      setSelectedFixtures(selected);
    } else {
      // Click on empty stage without dragging — treat as deselect.
      setSelectedFixtures([]);
    }
    setSelectionBox(null);
  };

  const handleFixturePointerDown = (event: React.PointerEvent, fixtureId: string) => {
    event.preventDefault();
    event.stopPropagation();
    const item = layoutByFixtureId.get(fixtureId);
    if (!item) return;
    if (event.shiftKey) {
      setSelectedFixtures(
        selectedFixtures.includes(fixtureId)
          ? selectedFixtures.filter((id) => id !== fixtureId)
          : [...selectedFixtures, fixtureId]
      );
    } else if (!selectedFixtures.includes(fixtureId)) {
      setSelectedFixtures([fixtureId]);
    }
    setDragState({
      fixtureId,
      pointerId: event.pointerId,
      startClient: { x: event.clientX, y: event.clientY },
      origin: { x: item.x, y: item.y },
    });
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  };

  const handleFixtureContextMenu = (event: React.MouseEvent, fixtureId: string) => {
    event.preventDefault();
    event.stopPropagation();
    // Right-click selects the fixture if it wasn't already in the selection so
    // group operations from the menu act on the expected target.
    if (!selectedFixtures.includes(fixtureId)) {
      setSelectedFixtures([fixtureId]);
    }
    setContextMenu({ fixtureId, x: event.clientX, y: event.clientY });
  };

  useEffect(() => {
    if (!contextMenu) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setContextMenu(null);
    };
    const handleClick = () => setContextMenu(null);
    window.addEventListener('keydown', handleKey);
    window.addEventListener('pointerdown', handleClick);
    return () => {
      window.removeEventListener('keydown', handleKey);
      window.removeEventListener('pointerdown', handleClick);
    };
  }, [contextMenu]);

  useEffect(() => {
    if (!dragState) return;
    const handleMove = (event: PointerEvent) => {
      if (event.pointerId !== dragState.pointerId) return;
      const rect = stageRef.current?.getBoundingClientRect();
      if (!rect) return;
      const scaleX = STAGE_MAP_WIDTH / rect.width;
      const scaleY = STAGE_MAP_HEIGHT / rect.height;
      const x = dragState.origin.x + (event.clientX - dragState.startClient.x) * scaleX;
      const y = dragState.origin.y + (event.clientY - dragState.startClient.y) * scaleY;
      const next = snapEnabled
        ? { x: Math.round(x / 25) * 25, y: Math.round(y / 25) * 25 }
        : { x, y };
      updateLayoutItem(dragState.fixtureId, {
        x: Math.max(0, Math.min(STAGE_MAP_WIDTH, Math.round(next.x))),
        y: Math.max(0, Math.min(STAGE_MAP_HEIGHT, Math.round(next.y))),
      }, false);
    };
    const handleUp = async (event: PointerEvent) => {
      if (event.pointerId !== dragState.pointerId) return;
      const item = useStore.getState().fixtureLayout.find((entry) => entry.fixtureId === dragState.fixtureId);
      setDragState(null);
      if (item) {
        try {
          await axios.post('/api/fixture-layout', { fixtureLayout: useStore.getState().fixtureLayout });
        } catch (error) {
          console.error('Failed to save dragged fixture layout:', error);
          notify('Stage move saved locally, but server save failed', 'warning');
        }
      }
    };
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    };
  }, [dragState, snapEnabled]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const templateId = event.dataTransfer.getData('application/x-artbastard-fixture-template');
    if (!templateId) return;
    placeTemplateAt(templateId, stagePointFromEvent(event as any));
  };

  const boxStyle = selectionBox
    ? {
        left: `${Math.min(selectionBox.start.x, selectionBox.current.x) / STAGE_MAP_WIDTH * 100}%`,
        top: `${Math.min(selectionBox.start.y, selectionBox.current.y) / STAGE_MAP_HEIGHT * 100}%`,
        width: `${Math.abs(selectionBox.current.x - selectionBox.start.x) / STAGE_MAP_WIDTH * 100}%`,
        height: `${Math.abs(selectionBox.current.y - selectionBox.start.y) / STAGE_MAP_HEIGHT * 100}%`,
      }
    : undefined;

  return (
    <section className={styles.stageMapSetup}>
      <header className={styles.toolbar}>
        <div className={styles.toolbarGroup}>
          <button type="button" className={viewMode === 'top' ? styles.active : ''} onClick={() => setViewMode('top')}>
            <LucideIcon name="Map" size={16} />
            Top
          </button>
          <button type="button" className={viewMode === 'side' ? styles.active : ''} onClick={() => setViewMode('side')}>
            <LucideIcon name="PanelTop" size={16} />
            Side
          </button>
        </div>
        <div className={styles.toolbarGroup}>
          <button type="button" className={tool === 'select' ? styles.active : ''} onClick={() => setTool('select')} title="Select and place fixtures">
            <LucideIcon name="MousePointer2" size={16} />
          </button>
          <button type="button" className={tool === 'box' ? styles.active : ''} onClick={() => setTool('box')} title="Box select fixtures">
            <LucideIcon name="Scan" size={16} />
          </button>
          <button type="button" className={gridEnabled ? styles.active : ''} onClick={() => setGridEnabled((value) => !value)} title="Toggle grid">
            <LucideIcon name="Grid3X3" size={16} />
          </button>
          <button type="button" className={snapEnabled ? styles.active : ''} onClick={() => setSnapEnabled((value) => !value)} title="Snap to grid">
            <LucideIcon name="Magnet" size={16} />
          </button>
        </div>
        <div className={styles.toolbarGroup}>
          <button type="button" onClick={() => setZoom((value) => Math.max(0.75, value - 0.1))} title="Zoom out">
            <LucideIcon name="ZoomOut" size={16} />
          </button>
          <span className={styles.zoomLabel}>{Math.round(zoom * 100)}%</span>
          <button type="button" onClick={() => setZoom((value) => Math.min(1.4, value + 0.1))} title="Zoom in">
            <LucideIcon name="ZoomIn" size={16} />
          </button>
        </div>
        <div className={styles.toolbarGroup}>
          <button
            type="button"
            className={stageToolsOpen ? styles.active : ''}
            onClick={() => setStageToolsOpen((v) => !v)}
            title="Show / hide stage tools (Auto-Add, Smart Groups, Standard Show, seeds, Giddy Up)"
          >
            <LucideIcon name={stageToolsOpen ? 'ChevronUp' : 'ChevronDown'} size={16} />
            Stage Tools
          </button>
        </div>
        {stageToolsOpen && (
          <div className={styles.toolbarGroup}>
            <div className={styles.autoAddWrapper}>
              <button
                type="button"
                className={showAutoAdd ? styles.active : ''}
                onClick={() => setShowAutoAdd((value) => !value)}
                title="Auto-add a preset rig"
              >
                <LucideIcon name="Wand2" size={16} />
                Auto-Add
              </button>
              {showAutoAdd && (
                <div className={styles.autoAddMenu} role="menu">
                  <div className={styles.autoAddHeader}>
                    <strong>Quick Rig Presets</strong>
                    <span>Build a stage in one click</span>
                  </div>
                  {STAGE_RIG_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      className={styles.autoAddItem}
                      onClick={() => runAutoAddPreset(preset)}
                      disabled={autoAddBusy !== null}
                    >
                      <LucideIcon name={preset.icon as any} size={18} />
                      <span>
                        <strong>{preset.name}</strong>
                        <small>{preset.description}</small>
                      </span>
                      {autoAddBusy === preset.id && <em>Adding...</em>}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button type="button" onClick={applySmartGroups} disabled={!fixtures.length}>
              <LucideIcon name="Sparkles" size={16} />
              Smart Groups
            </button>
            <button
              type="button"
              onClick={loadStandardShow}
              disabled={isLoadingStandardShow}
              title="One-click reset to Aday's 9-fixture standard rig (MINI LED MH, LED MH Spot, Mini MH Gobo w/Strips, UV PAR, LED BAR, Full Color Laser, EL1000RGB, MINI BEAM, LED Toy Mover) patched at their physical DMX addresses. Replaces current fixtures."
            >
              <LucideIcon name="LayoutDashboard" size={16} />
              {isLoadingStandardShow ? 'Loading...' : 'Standard Show'}
            </button>
            <SceneSeedButton compact />
            <ActSeedButton />
            <button
              type="button"
              className={styles.giddyButton}
              onClick={runGiddyUp}
              disabled={!fixtures.length || isGiddyUp}
              title="One-shot starter: auto-builds smart fixture groups from the stage layout, seeds the smart-starter-40 scene pack on Deck A (with automation), and seeds the starter-acts ACT pack (with triggers). Requires fixtures already placed on the stage."
            >
              <LucideIcon name="Rocket" size={16} />
              {isGiddyUp ? 'Working...' : 'Giddy Up'}
            </button>
          </div>
        )}
      </header>

      <div className={styles.workspace}>
        <aside className={styles.libraryPane} aria-label="Fixture library">
          <div className={styles.paneHeader}>
            <div>
              <strong>Fixture Library</strong>
              <span>{filteredTemplates.length} profiles</span>
            </div>
            <button
              type="button"
              className={favoritesOnly ? styles.activeIconButton : styles.iconButton}
              onClick={() => setFavoritesOnly((value) => !value)}
              title="Show favorites only"
            >
              <LucideIcon name="Star" size={16} />
            </button>
          </div>
          <input
            className={styles.searchInput}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search fixtures"
          />
          <select className={styles.typeSelect} value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
            {templateTypes.map((type) => (
              <option key={type} value={type}>{type === 'all' ? 'All types' : type}</option>
            ))}
          </select>
          <div className={styles.templateList}>
            {filteredTemplates.map((template) => {
              const type = template.type || template.category || 'Fixture';
              const color = getFixtureTypeColor(type);
              const icon = getFixtureTypeIcon(type) as any;
              const isSelected = selectedTemplateId === template.id;
              return (
                <button
                  key={template.id}
                  type="button"
                  draggable
                  className={`${styles.templateButton} ${isSelected ? styles.selectedTemplate : ''}`}
                  onClick={() => setSelectedTemplateId(isSelected ? null : template.id)}
                  onDragStart={(event) => {
                    event.dataTransfer.setData('application/x-artbastard-fixture-template', template.id);
                    event.dataTransfer.effectAllowed = 'copy';
                  }}
                  title="Drag to the stage or click then tap the stage"
                  style={{ ['--fixture-accent' as any]: color }}
                >
                  {template.photoUrl ? (
                    <HoverZoomImage src={template.photoUrl} alt={template.templateName} zoomSize={240} />
                  ) : (
                    <span className={styles.templateIcon}><LucideIcon name={icon} size={18} /></span>
                  )}
                  <span>
                    <strong>{template.templateName}</strong>
                    <small>{type} · {template.modes?.[0]?.channels || template.channels?.length || 1}ch</small>
                  </span>
                </button>
              );
            })}
          </div>
        </aside>

        <main className={styles.mapPane}>
          <div className={styles.stageHeader}>
            <div>
              <strong>{viewMode === 'top' ? 'Top-down Stage Map' : 'Side View Stage Map'}</strong>
              <span>{fixtures.length} fixtures · {groups.length} groups · {selectedFixtures.length} selected</span>
            </div>
            {selectedTemplateId && (
              <span className={styles.placeHint}>
                <LucideIcon name="MousePointerClick" size={15} />
                Click the map to patch the selected profile
              </span>
            )}
          </div>
          <div className={styles.stageViewport} style={{ ['--stage-zoom' as any]: zoom }}>
            <div
              ref={stageRef}
              className={`${styles.stageSurface} ${viewMode === 'side' ? styles.sideView : ''} ${gridEnabled ? styles.gridOn : ''}`}
              onPointerDown={handleStagePointerDown}
              onPointerMove={handleStagePointerMove}
              onPointerUp={handleStagePointerUp}
              onDragOver={(event) => event.preventDefault()}
              onDrop={handleDrop}
              role="application"
              aria-label="Canvas-first fixture stage map"
            >
              <div className={styles.stageLabelTop}>{viewMode === 'top' ? 'UPSTAGE' : 'HIGH / BACK'}</div>
              <div className={styles.stageLabelBottom}>{viewMode === 'top' ? 'DOWNSTAGE' : 'LOW / FRONT'}</div>
              <div className={styles.stageLabelLeft}>STAGE LEFT</div>
              <div className={styles.stageLabelRight}>STAGE RIGHT</div>

              {fixtures.length === 0 && (
                <div className={styles.emptyStage}>
                  <LucideIcon name="MapPinned" size={42} />
                  <strong>Drop a fixture profile here</strong>
                  <span>Drag from the library, or tap a profile and then tap the stage.</span>
                </div>
              )}

              {layout.map((item) => {
                const fixture = fixtures.find((entry) => entry.id === item.fixtureId);
                if (!fixture) return null;
                const color = getFixtureTypeColor(fixture.type);
                const icon = getFixtureTypeIcon(fixture.type) as any;
                const selected = selectedIdSet.has(fixture.id);
                const conflict = findAddressConflict(fixtures, fixture);
                const fixtureIndex = fixtures.findIndex((entry) => entry.id === fixture.id);
                const fixtureGroups = groups.filter((group) => group.fixtureIndices.includes(fixtureIndex)).slice(0, 3);
                return (
                  <button
                    key={item.fixtureId}
                    type="button"
                    className={`${styles.fixtureNode} ${selected ? styles.selectedNode : ''} ${conflict ? styles.conflictNode : ''}`}
                    style={{
                      ['--fixture-color' as any]: color,
                      left: `${(item.x / STAGE_MAP_WIDTH) * 100}%`,
                      top: `${(item.y / STAGE_MAP_HEIGHT) * 100}%`,
                      transform: `translate(-50%, -50%) rotate(${(item as any).rotation || 0}deg) scale(${item.scale || 1})`,
                    }}
                    onPointerDown={(event) => handleFixturePointerDown(event, fixture.id)}
                    onContextMenu={(event) => handleFixtureContextMenu(event, fixture.id)}
                    title={`${fixture.name} DMX ${fixture.startAddress}-${fixtureEndAddress(fixture)}`}
                  >
                    <span className={styles.nodeIcon}><LucideIcon name={icon} size={18} /></span>
                    <span className={styles.nodeName}>{fixture.name}</span>
                    <span className={styles.nodeAddress}>{fixture.startAddress}-{fixtureEndAddress(fixture)}</span>
                    {fixtureGroups.length > 0 && (
                      <span className={styles.nodeGroups}>
                        {fixtureGroups.map((group) => <em key={group.id}>{group.name}</em>)}
                      </span>
                    )}
                  </button>
                );
              })}

              {selectionBox && <div className={styles.selectionBox} style={boxStyle} />}
            </div>
          </div>
        </main>

        {contextMenu && (() => {
          const target = fixtures.find((f) => f.id === contextMenu.fixtureId);
          const targetIndex = target ? fixtures.findIndex((f) => f.id === target.id) : -1;
          const memberOf = target
            ? groups.filter((g) => g.fixtureIndices.includes(targetIndex))
            : [];
          const memberIds = new Set(memberOf.map((g) => g.id));
          const notMemberOf = groups.filter((g) => !memberIds.has(g.id));
          const selectionCount = selectedFixtures.length;
          return (
            <div
              className={styles.contextMenu}
              style={{ left: contextMenu.x, top: contextMenu.y }}
              role="menu"
              onPointerDown={(event) => event.stopPropagation()}
              onContextMenu={(event) => event.preventDefault()}
            >
              <div className={styles.contextHeader}>
                {selectionCount > 1
                  ? `${selectionCount} fixtures selected`
                  : target?.name ?? 'Fixture'}
              </div>

              {notMemberOf.length > 0 && (
                <>
                  <div className={styles.contextSection}>Add to group</div>
                  {notMemberOf.map((group) => (
                    <button
                      key={`add-${group.id}`}
                      type="button"
                      className={styles.contextItem}
                      onClick={() => {
                        void toggleSelectionInGroup(group);
                        setContextMenu(null);
                      }}
                    >
                      <LucideIcon name="Plus" size={13} />
                      <span>{group.name}</span>
                    </button>
                  ))}
                </>
              )}

              {memberOf.length > 0 && (
                <>
                  <div className={styles.contextSection}>Remove from group</div>
                  {memberOf.map((group) => (
                    <button
                      key={`remove-${group.id}`}
                      type="button"
                      className={styles.contextItem}
                      onClick={() => {
                        void toggleSelectionInGroup(group);
                        setContextMenu(null);
                      }}
                    >
                      <LucideIcon name="Minus" size={13} />
                      <span>{group.name}</span>
                    </button>
                  ))}
                </>
              )}

              <div className={styles.contextDivider} />
              <button
                type="button"
                className={styles.contextItem}
                onClick={() => {
                  void createGroupFromSelection();
                  setContextMenu(null);
                }}
                disabled={!selectionCount}
              >
                <LucideIcon name="FolderPlus" size={13} />
                <span>New group from selection ({selectionCount})</span>
              </button>
              <button
                type="button"
                className={`${styles.contextItem} ${styles.contextDanger}`}
                onClick={() => {
                  void deleteSelectedFixtures();
                  setContextMenu(null);
                }}
              >
                <LucideIcon name="Trash2" size={13} />
                <span>Delete {selectionCount > 1 ? `${selectionCount} fixtures` : 'fixture'}</span>
              </button>
            </div>
          );
        })()}

        <aside className={styles.inspectorPane} aria-label="Stage map inspector">
          <div className={styles.paneHeader}>
            <div>
              <strong>Inspector</strong>
              <span>{selectedFixtures.length ? `${selectedFixtures.length} selected` : 'No selection'}</span>
            </div>
            {selectedFixtures.length > 0 && (
              <button type="button" className={styles.iconButton} onClick={() => setSelectedFixtures([])} title="Clear selection">
                <LucideIcon name="X" size={16} />
              </button>
            )}
          </div>

          {!primarySelectedFixture ? (
            <div className={styles.emptyInspector}>
              <LucideIcon name="MousePointer2" size={34} />
              <strong>Select fixtures on the map</strong>
              <span>Selection here is shared with Super Control and APC40 group/fixture selection.</span>
            </div>
          ) : (
            <>
              <section className={styles.inspectorSection}>
                <h3>{selectedFixtures.length === 1 ? 'Fixture' : 'Selection'}</h3>
                {selectedFixtures.length === 1 ? (
                  <div className={styles.editGrid}>
                    <label>
                      Name
                      <input
                        value={primarySelectedFixture.name}
                        onChange={(event) => updatePrimaryFixture({ name: event.target.value })}
                      />
                    </label>
                    <label>
                      Type
                      <input
                        value={primarySelectedFixture.type}
                        onChange={(event) => updatePrimaryFixture({ type: event.target.value })}
                      />
                    </label>
                    <label>
                      Start DMX
                      <input
                        type="number"
                        min={1}
                        max={512}
                        value={primarySelectedFixture.startAddress}
                        onChange={(event) => updatePrimaryFixture({ startAddress: Math.max(1, Math.min(512, Number(event.target.value) || 1)) })}
                      />
                    </label>
                    <label>
                      Rotation
                      <input
                        type="number"
                        value={(layoutByFixtureId.get(primarySelectedFixture.id) as any)?.rotation || 0}
                        onChange={(event) => updateLayoutItem(primarySelectedFixture.id, { rotation: Number(event.target.value) || 0 } as any)}
                      />
                    </label>
                    <label>
                      Scale
                      <input
                        type="number"
                        min={0.5}
                        max={2}
                        step={0.1}
                        value={layoutByFixtureId.get(primarySelectedFixture.id)?.scale || 1}
                        onChange={(event) => updateLayoutItem(primarySelectedFixture.id, { scale: Math.max(0.5, Math.min(2, Number(event.target.value) || 1)) })}
                      />
                    </label>
                    {(() => {
                      const sourceTemplate = findTemplateForFixture(primarySelectedFixture);
                      const availableModes = sourceTemplate?.modes ?? [];
                      if (availableModes.length > 1) {
                        return (
                          <label>
                            Mode
                            <select
                              value={primarySelectedFixture.mode || availableModes[0]?.name || ''}
                              onChange={(event) => changeFixtureMode(primarySelectedFixture.id, event.target.value)}
                            >
                              {availableModes.map((mode) => (
                                <option key={mode.name} value={mode.name}>
                                  {mode.name} ({mode.channelData?.length ?? mode.channels} ch)
                                </option>
                              ))}
                            </select>
                          </label>
                        );
                      }
                      return (
                        <label>
                          Mode
                          <input
                            value={primarySelectedFixture.mode || 'Default'}
                            readOnly
                            title={sourceTemplate ? 'This template has only one mode' : 'Source template not found; mode is locked'}
                          />
                        </label>
                      );
                    })()}
                  </div>
                ) : (
                  <div className={styles.selectionList}>
                    {selectedFixtureObjects.map((fixture) => (
                      <button key={fixture.id} type="button" onClick={() => setSelectedFixtures([fixture.id])}>
                        <span>{fixture.name}</span>
                        <small>DMX {fixture.startAddress}-{fixtureEndAddress(fixture)}</small>
                      </button>
                    ))}
                  </div>
                )}
                {primaryConflict && (
                  <p className={styles.conflictWarning}>
                    <LucideIcon name="AlertTriangle" size={15} />
                    DMX overlaps {primaryConflict.name} ({primaryConflict.startAddress}-{fixtureEndAddress(primaryConflict)})
                  </p>
                )}
                <button type="button" className={styles.dangerButton} onClick={deleteSelectedFixtures}>
                  <LucideIcon name="Trash2" size={15} />
                  Delete selected
                </button>
              </section>

              <section className={styles.inspectorSection}>
                <h3>Groups</h3>
                <div className={styles.createGroupRow}>
                  <input value={newGroupName} onChange={(event) => setNewGroupName(event.target.value)} />
                  <button type="button" onClick={createGroupFromSelection}>
                    <LucideIcon name="FolderPlus" size={15} />
                    Create
                  </button>
                </div>
                <div className={styles.groupMembershipList}>
                  {selectedGroupMembership.map(({ group, included, total, allSelectedInGroup }) => (
                    <button
                      key={group.id}
                      type="button"
                      className={allSelectedInGroup ? styles.groupIncluded : ''}
                      onClick={() => toggleSelectionInGroup(group)}
                    >
                      <span>{group.name}</span>
                      <small>{included}/{total} selected · {group.fixtureIndices.length} total</small>
                    </button>
                  ))}
                </div>
              </section>

              <section className={styles.inspectorSection}>
                <h3>Channels</h3>
                <div className={styles.channelList}>
                  {primarySelectedFixture.channels.map((channel, index) => (
                    <span key={`${channel.name}-${index}`}>
                      <strong>{primarySelectedFixture.startAddress + index}</strong>
                      {channel.name}
                      <em>{channel.type}</em>
                    </span>
                  ))}
                </div>
              </section>
            </>
          )}

          <section className={styles.inspectorSection}>
            <h3>Suggested Groups</h3>
            <div className={styles.suggestionList}>
              {smartSuggestions.slice(0, 10).map((suggestion) => (
                <span key={`${suggestion.key}-${suggestion.name}`} title={suggestion.reason}>
                  {suggestion.name}
                  <em>{suggestion.fixtureIndices.length}</em>
                </span>
              ))}
              {!smartSuggestions.length && <p>Add fixtures to see smart group suggestions.</p>}
            </div>
          </section>

        </aside>
      </div>

      <div className={styles.drawerStack}>
        <UnifiedStageWorkbench />
      </div>
    </section>
  );
};

export default StageMapFixtureSetup;
