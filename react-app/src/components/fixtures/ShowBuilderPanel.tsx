import React, { useMemo, useState } from 'react';
import axios from 'axios';
import { useStore } from '../../store';
import useStoreUtils from '../../store/storeUtils';
import { LucideIcon } from '../ui/LucideIcon';
import {
  buildShowPatchPlan,
  formatPatchSheet,
  type PlannedShowFixture,
  type ShowBuilderSelection,
} from '../../fixtures/showBuilder/showPlan';
import styles from './FixtureSetup.module.scss';

const clampQuantity = (value: number) => Math.max(0, Math.min(32, Math.floor(value || 0)));

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
      `Patch: DMX ${item.startAddress}-${item.endAddress}`,
    ].filter(Boolean).join('\n'),
    photoUrl: item.photoUrl,
    tags: Array.from(new Set([...(item.tags || []), 'SHOW'])),
  };
}

export const ShowBuilderPanel: React.FC = () => {
  const { fixtures, fixtureTemplates, setFixtures, setSelectedFixtures } = useStore((state) => ({
    fixtures: state.fixtures,
    fixtureTemplates: state.fixtureTemplates,
    setFixtures: state.setFixtures,
    setSelectedFixtures: state.setSelectedFixtures,
  }));
  const [showName, setShowName] = useState('Beta Show');
  const [startAddress, setStartAddress] = useState(() => {
    const highest = fixtures.reduce(
      (max, fixture) => Math.max(max, fixture.startAddress + fixture.channels.length - 1),
      0
    );
    return Math.min(512, Math.max(1, highest + 1));
  });
  const [gapChannels, setGapChannels] = useState(1);
  const [avoidExisting, setAvoidExisting] = useState(true);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
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

  const selections: ShowBuilderSelection[] = useMemo(() => {
    return Object.entries(quantities).map(([templateId, quantity]) => ({
      templateId,
      quantity,
    }));
  }, [quantities]);

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
      { showName, startAddress, gapChannels, avoidExisting }
    );
  }, [avoidExisting, fixtures, gapChannels, selections, showName, sortedTemplates, startAddress]);

  const updateQuantity = (templateId: string, nextQuantity: number) => {
    setQuantities((current) => ({
      ...current,
      [templateId]: clampQuantity(nextQuantity),
    }));
  };

  const clearPlan = () => {
    setQuantities({});
  };

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

  const createShowFixtures = async () => {
    if (!plan.fixtures.length || plan.errors.length) return;
    setIsCreating(true);
    const newFixtures = plan.fixtures.map(fixtureFromPlanItem);
    const updatedFixtures = [...fixtures, ...newFixtures];

    setFixtures(updatedFixtures);
    setSelectedFixtures(newFixtures.map((fixture) => fixture.id));

    try {
      await axios.post('/api/fixtures', { fixtures: updatedFixtures });
      useStoreUtils.getState().addNotification({
        message: `Created ${newFixtures.length} show fixture${newFixtures.length === 1 ? '' : 's'}`,
        type: 'success',
        priority: 'normal',
      });
    } catch (error) {
      console.error('Failed to save generated show fixtures:', error);
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
          <h3>Build a show and patch it</h3>
          <p>Select fixture types, generate DMX addresses, then create the rig in one pass.</p>
        </div>
        <div className={styles.showBuilderStats}>
          <span>{plan.fixtures.length} fixtures</span>
          <span>{plan.totalChannels} channels</span>
          <span>Highest DMX {plan.highestAddress || '-'}</span>
        </div>
      </div>

      <div className={styles.showBuilderControls}>
        <label>
          Show name
          <input value={showName} onChange={(event) => setShowName(event.target.value)} />
        </label>
        <label>
          Start DMX
          <input
            type="number"
            min={1}
            max={512}
            value={startAddress}
            onChange={(event) => setStartAddress(Math.max(1, Math.min(512, Number(event.target.value) || 1)))}
          />
        </label>
        <label>
          Gap
          <input
            type="number"
            min={0}
            max={32}
            value={gapChannels}
            onChange={(event) => setGapChannels(Math.max(0, Math.min(32, Number(event.target.value) || 0)))}
          />
        </label>
        <label className={styles.showBuilderToggle}>
          <input
            type="checkbox"
            checked={avoidExisting}
            onChange={(event) => setAvoidExisting(event.target.checked)}
          />
          Avoid existing fixtures
        </label>
      </div>

      <div className={styles.showTemplateGrid}>
        {sortedTemplates.map((template) => {
          const quantity = quantities[template.id] || 0;
          const channelCount = template.modes?.[0]?.channels || template.channels?.length || 1;
          return (
            <article
              key={template.id}
              className={`${styles.showTemplateCard} ${quantity > 0 ? styles.showTemplateSelected : ''}`}
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
                <span>{channelCount} channels</span>
              </div>
              <div className={styles.quantityStepper}>
                <button
                  type="button"
                  onClick={() => updateQuantity(template.id, quantity - 1)}
                  aria-label={`Remove one ${template.templateName}`}
                >
                  <LucideIcon name="Minus" size={16} />
                </button>
                <input
                  type="number"
                  min={0}
                  max={32}
                  value={quantity}
                  onChange={(event) => updateQuantity(template.id, Number(event.target.value))}
                  aria-label={`${template.templateName} quantity`}
                />
                <button
                  type="button"
                  onClick={() => updateQuantity(template.id, quantity + 1)}
                  aria-label={`Add one ${template.templateName}`}
                >
                  <LucideIcon name="Plus" size={16} />
                </button>
              </div>
            </article>
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
          <h4>Patch sheet</h4>
          <div className={styles.showPlanActions}>
            <button type="button" onClick={clearPlan} disabled={!plan.fixtures.length}>
              <LucideIcon name="RotateCcw" size={16} />
              Clear
            </button>
            <button type="button" onClick={copyPatchSheet} disabled={!plan.fixtures.length}>
              <LucideIcon name="Copy" size={16} />
              Copy
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
                <span>{fixture.fixtureName}</span>
                <strong>DMX {fixture.startAddress}-{fixture.endAddress}</strong>
                <span>{fixture.channelCount}ch</span>
                <span>{fixture.mode}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className={styles.showPlanEmpty}>Pick fixture quantities above to generate addresses.</div>
        )}
      </div>
    </section>
  );
};
