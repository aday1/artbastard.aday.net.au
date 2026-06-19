import React, { useMemo, useState } from 'react';
import { useStore } from '../../store';
import {
  SCENE_SEED_PACKS,
  listSceneSeedPickTemplates,
  type SceneSeedMode,
  type SceneSeedPackId,
  type SceneSeedTarget,
} from '../../scenes/sceneSeedGenerator';
import type { Apc40Deck } from '../../midi/apc40WorkflowHelpers';
import { LucideIcon } from '../ui/LucideIcon';
import styles from './SceneSeedButton.module.scss';

interface SceneSeedButtonProps {
  className?: string;
  compact?: boolean;
}

const TARGETS: Array<{ id: SceneSeedTarget; label: string }> = [
  { id: 'deck-a', label: 'Deck A' },
  { id: 'deck-b', label: 'Deck B' },
  { id: 'decks-a-b', label: 'Deck A + B' },
];

const MODES: Array<{ id: SceneSeedMode; label: string }> = [
  { id: 'pack', label: 'Full pack' },
  { id: 'single-slot', label: 'One slot look' },
  { id: 'capture-selection', label: 'Capture selection' },
];

const DECKS: Array<{ id: Apc40Deck; label: string }> = [
  { id: 'A', label: 'Deck A' },
  { id: 'B', label: 'Deck B' },
];

export const SceneSeedButton: React.FC<SceneSeedButtonProps> = ({ className, compact = false }) => {
  const fixtures = useStore((state) => state.fixtures);
  const selectedFixtures = useStore((state) => state.selectedFixtures);
  const seedScenesFromFixtures = useStore((state) => state.seedScenesFromFixtures);
  const captureSelectionToApcSlot = useStore((state) => state.captureSelectionToApcSlot);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<SceneSeedMode>('pack');
  const [packId, setPackId] = useState<SceneSeedPackId>('smart-starter-40');
  const [target, setTarget] = useState<SceneSeedTarget>('deck-a');
  const [deck, setDeck] = useState<Apc40Deck>('A');
  const [slot, setSlot] = useState(1);
  const [templateId, setTemplateId] = useState('full-red');
  const [selectedFixturesOnly, setSelectedFixturesOnly] = useState(true);
  const [includeAutomation, setIncludeAutomation] = useState(false);
  const [avoidStrobe, setAvoidStrobe] = useState(true);
  const [isSeeding, setIsSeeding] = useState(false);
  const [lastSummary, setLastSummary] = useState('');

  const pickTemplates = useMemo(
    () => listSceneSeedPickTemplates(avoidStrobe),
    [avoidStrobe]
  );

  const disabled = fixtures.length === 0 || isSeeding;
  const effectiveTarget = packId === 'smart-ab-80' ? 'decks-a-b' : target;
  const selectedPack = useMemo(
    () => SCENE_SEED_PACKS.find((pack) => pack.id === packId) ?? SCENE_SEED_PACKS[0],
    [packId]
  );
  const selectionRequired = mode !== 'pack' && selectedFixturesOnly;
  const selectionMissing = selectionRequired && selectedFixtures.length === 0;

  const runSeed = async () => {
    if (disabled || selectionMissing) return;
    setIsSeeding(true);
    try {
      if (mode === 'capture-selection') {
        const result = await captureSelectionToApcSlot({
          deck,
          slot,
          fixtureIds: selectedFixturesOnly ? selectedFixtures : undefined,
        });
        setLastSummary(
          result.disabledReason
            ? result.disabledReason
            : `Captured to Deck ${deck} slot ${slot}`
        );
        return;
      }

      const result = await seedScenesFromFixtures({
        mode,
        packId,
        target: mode === 'single-slot' ? (deck === 'B' ? 'deck-b' : 'deck-a') : effectiveTarget,
        deck: mode === 'single-slot' ? deck : undefined,
        slot,
        templateId: mode === 'single-slot' ? templateId : undefined,
        fixtureIds: mode === 'single-slot' && selectedFixturesOnly ? selectedFixtures : undefined,
        includeAutomation,
        avoidStrobe,
      });
      setLastSummary(
        result.disabledReason
          ? result.disabledReason
          : `${result.created} created, ${result.refreshed} refreshed${result.skipped ? `, ${result.skipped} skipped` : ''}`
      );
    } finally {
      setIsSeeding(false);
    }
  };

  return (
    <div className={`${styles.seedRoot} ${compact ? styles.compact : ''} ${className || ''}`}>
      <button
        type="button"
        className={styles.seedButton}
        onClick={() => setOpen((value) => !value)}
        disabled={fixtures.length === 0}
        title={fixtures.length === 0 ? 'Add fixtures before seeding scenes' : selectedPack.description}
      >
        <LucideIcon name="Sparkles" size={16} />
        {compact ? 'Seed' : 'Seed Scenes'}
      </button>

      {open && (
        <div className={styles.seedPanel}>
          <div className={styles.seedHeader}>
            <strong>Scene seed</strong>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close scene seed options">
              <LucideIcon name="X" size={15} />
            </button>
          </div>

          <label>
            Mode
            <select value={mode} onChange={(event) => setMode(event.target.value as SceneSeedMode)}>
              {MODES.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          {mode === 'pack' && (
            <>
              <label>
                Pack
                <select value={packId} onChange={(event) => setPackId(event.target.value as SceneSeedPackId)}>
                  {SCENE_SEED_PACKS.map((pack) => (
                    <option key={pack.id} value={pack.id}>
                      {pack.label}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Target
                <select
                  value={effectiveTarget}
                  onChange={(event) => setTarget(event.target.value as SceneSeedTarget)}
                  disabled={packId === 'smart-ab-80'}
                >
                  {TARGETS.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </>
          )}

          {mode !== 'pack' && (
            <>
              <label>
                Deck
                <select value={deck} onChange={(event) => setDeck(event.target.value as Apc40Deck)}>
                  {DECKS.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Slot
                <select value={slot} onChange={(event) => setSlot(Number(event.target.value))}>
                  {Array.from({ length: 40 }, (_, index) => index + 1).map((slotNumber) => (
                    <option key={slotNumber} value={slotNumber}>
                      {String(slotNumber).padStart(2, '0')}
                    </option>
                  ))}
                </select>
              </label>
            </>
          )}

          {mode === 'single-slot' && (
            <label>
              Look
              <select value={templateId} onChange={(event) => setTemplateId(event.target.value)}>
                {pickTemplates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.label}
                  </option>
                ))}
              </select>
            </label>
          )}

          {mode !== 'pack' && (
            <label className={styles.checkRow}>
              <input
                type="checkbox"
                checked={selectedFixturesOnly}
                onChange={(event) => setSelectedFixturesOnly(event.target.checked)}
              />
              Selected fixtures only ({selectedFixtures.length})
            </label>
          )}

          {mode === 'single-slot' && (
            <label className={styles.checkRow}>
              <input
                type="checkbox"
                checked={includeAutomation}
                onChange={(event) => setIncludeAutomation(event.target.checked)}
              />
              Include animated timeline
            </label>
          )}

          <label className={`${styles.checkRow} ${styles.noStrobeRow}`}>
            <input
              type="checkbox"
              checked={avoidStrobe}
              onChange={(event) => setAvoidStrobe(event.target.checked)}
            />
            <LucideIcon name="ShieldOff" size={16} />
            <span>
              <strong>NO STROBE SAFETY MODE</strong>
              <small>Skip strobe looks and hold strobe channels safe</small>
            </span>
          </label>

          <p>
            {mode === 'pack' && (avoidStrobe ? `${selectedPack.description} Strobe looks will be skipped.` : selectedPack.description)}
            {mode === 'single-slot' && 'Generate one refined look into a single APC clip slot. Use selected fixtures to audition washes or heads without touching the whole rig.'}
            {mode === 'capture-selection' && 'Save the current live DMX from your selected fixtures into one APC clip slot so you can load it and decide if the look is keep or toss.'}
          </p>

          <button
            type="button"
            className={styles.applyButton}
            onClick={runSeed}
            disabled={disabled || selectionMissing}
          >
            <LucideIcon name="Wand2" size={16} />
            {isSeeding
              ? 'Working...'
              : mode === 'pack'
                ? 'Generate slots'
                : mode === 'capture-selection'
                  ? 'Capture to slot'
                  : 'Seed this slot'}
          </button>

          {selectionMissing && (
            <span className={styles.seedSummary}>Select fixtures on the stage map or in SuperControl first.</span>
          )}

          {lastSummary && <span className={styles.seedSummary}>{lastSummary}</span>}
        </div>
      )}
    </div>
  );
};

export default SceneSeedButton;
