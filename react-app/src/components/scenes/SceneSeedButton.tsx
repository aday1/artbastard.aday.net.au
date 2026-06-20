import React, { useMemo, useState } from 'react';
import { useStore } from '../../store';
import {
  SCENE_SEED_PACKS,
  SCENE_BOTH_DECK_PACK_IDS,
  listSceneSeedPickTemplates,
  type SceneSeedMode,
  type SceneSeedPackId,
  type SceneSeedTarget,
} from '../../scenes/sceneSeedGenerator';
import {
  sceneSeedModeUi,
  sceneSeedPackUi,
} from '../../scenes/sceneSeedUi';
import type { Apc40Deck } from '../../midi/apc40WorkflowHelpers';
import { LucideIcon } from '../ui/LucideIcon';
import styles from './SceneSeedButton.module.scss';

interface SceneSeedButtonProps {
  className?: string;
  compact?: boolean;
}

const TARGETS: Array<{ id: SceneSeedTarget; label: string }> = [
  { id: 'deck-a', label: 'Deck A only' },
  { id: 'deck-b', label: 'Deck B only' },
  { id: 'decks-a-b', label: 'Deck A and B' },
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
  const [packId, setPackId] = useState<SceneSeedPackId>('essential-ab-28');
  const [target, setTarget] = useState<SceneSeedTarget>('decks-a-b');
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
  const bothDeckPack = SCENE_BOTH_DECK_PACK_IDS.includes(packId);
  const effectiveTarget = bothDeckPack ? 'decks-a-b' : target;
  const modeDetails = sceneSeedModeUi(mode);
  const packDetails = sceneSeedPackUi(packId);
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
            : `Captured to Deck ${deck} slot ${String(slot).padStart(2, '0')}`
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
        title={fixtures.length === 0 ? 'Add fixtures before seeding scenes' : packDetails.bestFor}
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

          <p className={styles.seedIntro}>
            Build APC clip scenes from templates or from your live rig. Default is 14 looks on Deck A and 14 on Deck B; use one-slot or capture to fill the rest yourself.
          </p>

          <label>
            What to do
            <select value={mode} onChange={(event) => setMode(event.target.value as SceneSeedMode)}>
              {['pack', 'single-slot', 'capture-selection'].map((optionId) => {
                const option = sceneSeedModeUi(optionId as SceneSeedMode);
                return (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                );
              })}
            </select>
          </label>

          <div className={styles.seedDetailBox}>
            <strong>{modeDetails.summary}</strong>
            <p>{modeDetails.detail}</p>
          </div>

          {mode === 'pack' && (
            <>
              <label>
                Scene pack
                <select value={packId} onChange={(event) => setPackId(event.target.value as SceneSeedPackId)}>
                  {SCENE_SEED_PACKS.map((pack) => (
                    <option key={pack.id} value={pack.id}>
                      {sceneSeedPackUi(pack.id as SceneSeedPackId).label}
                    </option>
                  ))}
                </select>
              </label>

              {!bothDeckPack && (
                <label>
                  Which deck
                  <select
                    value={effectiveTarget}
                    onChange={(event) => setTarget(event.target.value as SceneSeedTarget)}
                  >
                    {TARGETS.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <div className={styles.seedDetailBox}>
                <strong>{packDetails.creates}</strong>
                <ul className={styles.seedDetailList}>
                  {packDetails.includes.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
                <p>{packDetails.leavesOpen}</p>
                <p className={styles.seedDetailHint}>{packDetails.bestFor}</p>
                {avoidStrobe && selectedPack.description && (
                  <p className={styles.seedDetailHint}>Strobe templates in this pack are skipped while NO STROBE is on.</p>
                )}
              </div>
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
                Slot (01-40)
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
              Look template
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
              Include animated timeline on this slot
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
              <small>Skip strobe looks and hold strobe channels at zero</small>
            </span>
          </label>

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
                ? 'Generate scenes'
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
