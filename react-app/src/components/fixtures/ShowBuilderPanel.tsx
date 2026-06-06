import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { type Group, useStore } from '../../store';
import useStoreUtils from '../../store/storeUtils';
import { LucideIcon } from '../ui/LucideIcon';
import {
  buildShowPatchPlan,
  formatPatchCsv,
  formatPatchSheet,
  getTemplateMode,
  type PlannedShowFixture,
  type ShowBuilderSelection,
  type ShowBuilderTemplate,
} from '../../fixtures/showBuilder/showPlan';
import styles from './FixtureSetup.module.scss';

interface ShowBuilderRow {
  id: string;
  templateId: string;
  modeName: string;
  quantity: number;
  groupName: string;
  startAddress: number;
  gapChannels: number;
  labelPrefix: string;
}

const clampQuantity = (value: number) => Math.max(0, Math.min(32, Math.floor(value || 0)));
const clampAddress = (value: number) => Math.max(1, Math.min(512, Math.floor(value || 1)));
const clampGap = (value: number) => Math.max(0, Math.min(64, Math.floor(value || 0)));

const safeSlug = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'show';

function fixtureFromPlanItem(item: PlannedShowFixture, index: number) {
  return {
    id: `fixture-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}`,
    name: item.fixtureName,
    type: item.type,
    manufacturer: item.manufacturer || '',
    model: item.model,
    mode: item.mode,
    startAddress: item.startAddress,
    channels: item.channels.map((channel) => ({
      ...channel,
      ranges: channel.ranges?.map((range) => ({ ...range })),
    })),
    notes: [
      item.catalogId ? `Catalog: ${item.catalogId}` : '',
      item.category ? `Category: ${item.category}` : '',
      `Group: ${item.groupName}`,
      `Patch: DMX ${item.startAddress}-${item.endAddress}`,
      `Physical address: ${item.addressInstruction}`,
      item.modeSwitchInstruction ? `Mode switches: ${item.modeSwitchInstruction}` : '',
    ].filter(Boolean).join('\n'),
    photoUrl: item.photoUrl,
    tags: Array.from(new Set([...(item.tags || []), 'SHOW', `GROUP:${item.groupName}`])),
  };
}

function makeGroup(name: string, fixtureIndices: number[]): Group {
  return {
    id: `group-${Date.now()}-${safeSlug(name)}-${Math.random().toString(36).slice(2, 7)}`,
    name,
    fixtureIndices,
    lastStates: new Array(512).fill(0),
    isMuted: false,
    isSolo: false,
    masterValue: 255,
  };
}

function defaultModeName(template?: ShowBuilderTemplate) {
  return template?.modes?.[0]?.name || 'Default mode';
}

function labelWithHint(label: string, hint: string) {
  return (
    <span className={styles.fieldLabelText}>
      {label}
      <span className={styles.infoDot} title={hint}>?</span>
    </span>
  );
}

export const ShowBuilderPanel: React.FC = () => {
  const { fixtures, groups, fixtureTemplates, setFixtures, setGroups, setSelectedFixtures } = useStore((state) => ({
    fixtures: state.fixtures,
    groups: state.groups,
    fixtureTemplates: state.fixtureTemplates,
    setFixtures: state.setFixtures,
    setGroups: state.setGroups,
    setSelectedFixtures: state.setSelectedFixtures,
  }));
  const [showName, setShowName] = useState('Beta Show');
  const [avoidExisting, setAvoidExisting] = useState(true);
  const [rows, setRows] = useState<ShowBuilderRow[]>([]);
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<string[]>([]);
  const [isCreating, setIsCreating] = useState(false);

  const sortedTemplates = useMemo(() => {
    return [...fixtureTemplates]
      .filter((template) => template.id !== 'custom-blank')
      .sort((a, b) => {
        const aCatalog = a.catalogId ? 0 : 1;
        const bCatalog = b.catalogId ? 0 : 1;
        if (aCatalog !== bCatalog) return aCatalog - bCatalog;
        return a.templateName.localeCompare(b.templateName);
      });
  }, [fixtureTemplates]);

  const highestFixtureAddress = useMemo(
    () =>
      fixtures.reduce(
        (max, fixture) => Math.max(max, fixture.startAddress + fixture.channels.length - 1),
        0
      ),
    [fixtures]
  );

  const createRowFor = useCallback((templateId = sortedTemplates[0]?.id) => {
    const template = sortedTemplates.find((item) => item.id === templateId) || sortedTemplates[0];
    if (!template) return;
    setRows((current) => [
      ...current,
      {
        id: `row-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        templateId: template.id,
        modeName: defaultModeName(template),
        quantity: 1,
        groupName: `${showName.trim() || 'Show'} ${template.defaultNamePrefix}`,
        startAddress: Math.min(512, Math.max(1, highestFixtureAddress + 1 + current.length * 10)),
        gapChannels: 0,
        labelPrefix: template.defaultNamePrefix,
      },
    ]);
  }, [highestFixtureAddress, showName, sortedTemplates]);

  const rowCountByTemplate = useMemo(() => {
    const counts = new Map<string, number>();
    rows.forEach((row) => counts.set(row.templateId, (counts.get(row.templateId) || 0) + 1));
    return counts;
  }, [rows]);

  const updateRow = (rowId: string, patch: Partial<ShowBuilderRow>) => {
    setRows((current) =>
      current.map((row) => {
        if (row.id !== rowId) return row;
        const next = { ...row, ...patch };
        if (patch.templateId) {
          const template = sortedTemplates.find((item) => item.id === patch.templateId);
          next.modeName = defaultModeName(template);
          next.groupName = `${showName.trim() || 'Show'} ${template?.defaultNamePrefix || 'Fixture'}`;
          next.labelPrefix = template?.defaultNamePrefix || 'Fixture';
        }
        return next;
      })
    );
  };

  const removeRow = (rowId: string) => {
    setRows((current) => current.filter((row) => row.id !== rowId));
  };

  const clearPlan = () => {
    setRows([]);
    setSelectedTemplateIds([]);
  };

  const toggleTemplateSelection = useCallback((templateId: string) => {
    setSelectedTemplateIds((current) =>
      current.includes(templateId)
        ? current.filter((id) => id !== templateId)
        : [...current, templateId]
    );
  }, []);

  useEffect(() => {
    const handleApcTemplateAdd = (event: Event) => {
      const detail = (event as CustomEvent<{ templateIndex?: number }>).detail;
      if (!sortedTemplates.length || detail?.templateIndex === undefined) return;
      const template = sortedTemplates[detail.templateIndex % sortedTemplates.length];
      if (template) toggleTemplateSelection(template.id);
    };

    window.addEventListener('artbastard:apc40-add-template', handleApcTemplateAdd);
    return () => window.removeEventListener('artbastard:apc40-add-template', handleApcTemplateAdd);
  }, [sortedTemplates, toggleTemplateSelection]);

  const addSelectedTemplates = () => {
    const ids = selectedTemplateIds.length ? selectedTemplateIds : [sortedTemplates[0]?.id].filter(Boolean) as string[];
    ids.forEach((templateId) => createRowFor(templateId));
  };

  const selections: ShowBuilderSelection[] = useMemo(() => {
    return rows.map((row) => ({
      id: row.id,
      templateId: row.templateId,
      modeName: row.modeName,
      quantity: row.quantity,
      groupName: row.groupName,
      startAddress: row.startAddress,
      gapChannels: row.gapChannels,
      labelPrefix: row.labelPrefix,
    }));
  }, [rows]);

  const plan = useMemo(() => {
    return buildShowPatchPlan(
      sortedTemplates,
      selections,
      fixtures.map((fixture) => ({
        id: fixture.id,
        name: fixture.name,
        startAddress: fixture.startAddress,
        channelCount: fixture.channels.length,
      })),
      { showName, startAddress: Math.max(1, highestFixtureAddress + 1), gapChannels: 0, avoidExisting }
    );
  }, [avoidExisting, fixtures, highestFixtureAddress, selections, showName, sortedTemplates]);

  const copyPatchSheet = async () => {
    const text = formatPatchSheet(plan);
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      useStoreUtils.getState().addNotification({
        message: 'Patch sheet copied',
        type: 'success',
        priority: 'normal',
      });
    } catch (error) {
      console.error('Failed to copy patch sheet:', error);
      useStoreUtils.getState().addNotification({
        message: 'Copy failed; use the address table as the source of truth',
        type: 'warning',
        priority: 'normal',
      });
    }
  };

  const downloadCsv = () => {
    if (!plan.fixtures.length) return;
    const blob = new Blob([formatPatchCsv(plan)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${safeSlug(showName)}-dmx-show-map.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const createShowFixtures = async () => {
    if (!plan.fixtures.length || plan.errors.length) return;
    setIsCreating(true);
    const newFixtures = plan.fixtures.map(fixtureFromPlanItem);
    const updatedFixtures = [...fixtures, ...newFixtures];
    const baseIndex = fixtures.length;
    const groupIndexes = new Map<string, number[]>();

    plan.fixtures.forEach((fixture, index) => {
      const indexes = groupIndexes.get(fixture.groupName) || [];
      indexes.push(baseIndex + index);
      groupIndexes.set(fixture.groupName, indexes);
    });

    const updatedGroups = [...groups];
    groupIndexes.forEach((fixtureIndices, groupName) => {
      const existingIndex = updatedGroups.findIndex((group) => group.name === groupName);
      if (existingIndex >= 0) {
        updatedGroups[existingIndex] = {
          ...updatedGroups[existingIndex],
          fixtureIndices: Array.from(new Set([...updatedGroups[existingIndex].fixtureIndices, ...fixtureIndices])),
        };
      } else {
        updatedGroups.push(makeGroup(groupName, fixtureIndices));
      }
    });

    setFixtures(updatedFixtures);
    setGroups(updatedGroups);
    setSelectedFixtures(newFixtures.map((fixture) => fixture.id));

    try {
      await Promise.all([
        axios.post('/api/fixtures', { fixtures: updatedFixtures }),
        axios.post('/api/groups', { groups: updatedGroups }),
      ]);
      useStoreUtils.getState().addNotification({
        message: `Created ${newFixtures.length} fixtures and ${groupIndexes.size} group${groupIndexes.size === 1 ? '' : 's'}`,
        type: 'success',
        priority: 'normal',
      });
    } catch (error) {
      console.error('Failed to save generated show fixtures or groups:', error);
      useStoreUtils.getState().addNotification({
        message: 'Show created locally, but server save failed',
        type: 'warning',
        priority: 'high',
      });
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <section className={styles.showBuilder} aria-label="Show builder and address generator">
      <div className={styles.showBuilderHeader}>
        <div>
          <span className={styles.stepKicker}>Start here</span>
          <h3>Create the DMX show</h3>
          <p>Select fixture profiles, add them as address blocks, set quantities/groups/start addresses, then create the patched rig.</p>
        </div>
        <div className={styles.showBuilderStats}>
          <span>{plan.fixtures.length} fixtures</span>
          <span>{plan.groups.length} groups</span>
          <span>{plan.totalChannels} channels</span>
          <span>Highest DMX {plan.highestAddress || '-'}</span>
        </div>
      </div>

      <div className={styles.showBuilderControls}>
        <label>
          Show name
          <input value={showName} onChange={(event) => setShowName(event.target.value)} />
        </label>
        <label className={styles.showBuilderToggle}>
          <input
            type="checkbox"
            checked={avoidExisting}
            onChange={(event) => setAvoidExisting(event.target.checked)}
          />
          Avoid existing fixtures
        </label>
        <button
          type="button"
          className={styles.showBuilderAddButton}
          onClick={addSelectedTemplates}
          title="Adds one address-block row for every selected fixture profile."
        >
          <LucideIcon name="Plus" size={16} />
          {selectedTemplateIds.length ? `Add ${selectedTemplateIds.length} selected` : 'Add first fixture'}
        </button>
      </div>

      <div className={styles.showBuilderBulk}>
        <span>{selectedTemplateIds.length} fixture profile{selectedTemplateIds.length === 1 ? '' : 's'} selected</span>
        <button type="button" onClick={() => setSelectedTemplateIds(sortedTemplates.map((template) => template.id))}>
          <LucideIcon name="ListChecks" size={15} />
          Select all
        </button>
        <button type="button" onClick={() => setSelectedTemplateIds([])} disabled={!selectedTemplateIds.length}>
          <LucideIcon name="CircleOff" size={15} />
          Clear
        </button>
      </div>

      <div className={styles.showTemplateGrid}>
        {sortedTemplates.map((template) => {
          const mode = getTemplateMode(template);
          const selectedCount = rowCountByTemplate.get(template.id) || 0;
          const isTemplateSelected = selectedTemplateIds.includes(template.id);
          return (
            <button
              key={template.id}
              type="button"
              className={`${styles.showTemplateCard} ${isTemplateSelected ? styles.showTemplateSelected : ''}`}
              onClick={() => toggleTemplateSelection(template.id)}
              aria-pressed={isTemplateSelected}
              aria-label={`${isTemplateSelected ? 'Deselect' : 'Select'} ${template.templateName}`}
              title="Select this profile for the show seed. Use the Add selected button to create address-block rows."
            >
              <div className={styles.showTemplateImage}>
                {template.photoUrl ? (
                  <img src={template.photoUrl} alt={template.templateName} />
                ) : (
                  <LucideIcon name="Package" />
                )}
              </div>
              <div className={styles.showTemplateInfo}>
                <strong>{template.templateName}</strong>
                <span>{template.catalogId || template.type || 'Fixture'}</span>
                <span>{mode.channels.length} channels default</span>
              </div>
              {isTemplateSelected ? (
                <span className={styles.selectedPill}>
                  {selectedCount ? `${selectedCount} row${selectedCount === 1 ? '' : 's'}` : 'Selected'}
                </span>
              ) : (
                <LucideIcon name="Plus" size={18} />
              )}
            </button>
          );
        })}
      </div>

      <div className={styles.showRows}>
        <div className={styles.showRowsHeader}>
          <h4>Fixture groups and address blocks</h4>
          <span>{rows.length ? 'One row equals one physical address block. Use another row for another group.' : 'Select cards above, add selected rows, or press APC40 grid pads.'}</span>
        </div>
        {rows.map((row) => {
          const template = sortedTemplates.find((item) => item.id === row.templateId);
          const modeOptions = template?.modes ?? [];
          const selectedMode = template ? getTemplateMode(template, row.modeName) : { channels: [] };
          return (
            <div key={row.id} className={styles.showRowEditor}>
              <label>
                {labelWithHint('Fixture', 'The physical hardware profile from the single fixture profile catalog.')}
                <select value={row.templateId} onChange={(event) => updateRow(row.id, { templateId: event.target.value })}>
                  {sortedTemplates.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.catalogId ? `${item.catalogId} - ` : ''}{item.templateName}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {labelWithHint('Mode', 'The DMX channel mode you will set on the fixture itself.')}
                <select
                  value={row.modeName}
                  onChange={(event) => updateRow(row.id, { modeName: event.target.value })}
                >
                  {modeOptions.length ? (
                    modeOptions.map((mode) => (
                      <option key={mode.name} value={mode.name}>
                        {mode.name} ({mode.channels}ch)
                      </option>
                    ))
                  ) : (
                    <option value="Default mode">Default mode ({selectedMode.channels.length}ch)</option>
                  )}
                </select>
              </label>
              <label>
                {labelWithHint('Qty', 'How many identical physical units to patch in this row.')}
                <input
                  type="number"
                  min={0}
                  max={32}
                  value={row.quantity}
                  onChange={(event) => updateRow(row.id, { quantity: clampQuantity(Number(event.target.value)) })}
                />
              </label>
              <label>
                {labelWithHint('Group', 'Fixtures with the same group name are controlled together after creation.')}
                <input value={row.groupName} onChange={(event) => updateRow(row.id, { groupName: event.target.value })} />
              </label>
              <label>
                {labelWithHint('Start DMX', 'This is the address you physically set on the first fixture in this row.')}
                <input
                  type="number"
                  min={1}
                  max={512}
                  value={row.startAddress}
                  onChange={(event) => updateRow(row.id, { startAddress: clampAddress(Number(event.target.value)) })}
                />
              </label>
              <label>
                {labelWithHint('Gap', 'Optional unused channels between repeated fixtures. Leave 0 unless you need spacing.')}
                <input
                  type="number"
                  min={0}
                  max={64}
                  value={row.gapChannels}
                  onChange={(event) => updateRow(row.id, { gapChannels: clampGap(Number(event.target.value)) })}
                />
              </label>
              <label>
                {labelWithHint('Label prefix', 'Name prefix for fixtures created from this row.')}
                <input value={row.labelPrefix} onChange={(event) => updateRow(row.id, { labelPrefix: event.target.value })} />
              </label>
              <button type="button" className={styles.showRowRemove} onClick={() => removeRow(row.id)} aria-label="Remove fixture row">
                <LucideIcon name="Trash2" size={16} />
              </button>
            </div>
          );
        })}
      </div>

      {(plan.errors.length > 0 || plan.warnings.length > 0) && (
        <div className={styles.showPlanMessages}>
          {[...plan.errors, ...plan.warnings].map((message) => (
            <span key={message}>{message}</span>
          ))}
        </div>
      )}

      <div className={styles.showPlan}>
        <div className={styles.showPlanHeader}>
          <h4>Physical patch sheet</h4>
          <div className={styles.showPlanActions}>
            <button type="button" onClick={clearPlan} disabled={!rows.length}>
              <LucideIcon name="RotateCcw" size={16} />
              Clear
            </button>
            <button type="button" onClick={copyPatchSheet} disabled={!plan.fixtures.length}>
              <LucideIcon name="Copy" size={16} />
              Copy
            </button>
            <button type="button" onClick={downloadCsv} disabled={!plan.fixtures.length}>
              <LucideIcon name="Download" size={16} />
              CSV
            </button>
            <button
              type="button"
              className={styles.createShowButton}
              onClick={createShowFixtures}
              disabled={!plan.fixtures.length || plan.errors.length > 0 || isCreating}
            >
              <LucideIcon name="Wand2" size={16} />
              {isCreating ? 'Creating...' : 'Create Show'}
            </button>
          </div>
        </div>

        {plan.fixtures.length > 0 ? (
        <div className={styles.showPlanTable}>
            {plan.fixtures.map((fixture) => (
              <div key={fixture.planId} className={styles.showPlanRow}>
                <span>{fixture.groupName}</span>
                <span>{fixture.fixtureName}</span>
                <span>{fixture.catalogId || fixture.templateName}</span>
                <strong>DMX {fixture.startAddress}-{fixture.endAddress}</strong>
                <span>{fixture.channelCount}ch</span>
                <span>{fixture.mode}</span>
                <span title={fixture.modeSwitchInstruction || fixture.addressInstruction}>
                  {fixture.addressInstruction}
                  {fixture.modeSwitchInstruction ? ` | ${fixture.modeSwitchInstruction}` : ''}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className={styles.showPlanEmpty}>Add fixture rows to generate physical DMX addresses.</div>
        )}
      </div>
    </section>
  );
};
