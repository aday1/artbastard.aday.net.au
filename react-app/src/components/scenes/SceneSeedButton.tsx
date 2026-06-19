import React, { useMemo, useState } from 'react';
import { useStore } from '../../store';
import {
  SCENE_SEED_PACKS,
  type SceneSeedPackId,
  type SceneSeedTarget,
} from '../../scenes/sceneSeedGenerator';
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

export const SceneSeedButton: React.FC<SceneSeedButtonProps> = ({ className, compact = false }) => {
  const fixtures = useStore((state) => state.fixtures);
  const seedScenesFromFixtures = useStore((state) => state.seedScenesFromFixtures);
  const [open, setOpen] = useState(false);
  const [packId, setPackId] = useState<SceneSeedPackId>('smart-starter-40');
  const [target, setTarget] = useState<SceneSeedTarget>('deck-a');
  const [includeAutomation, setIncludeAutomation] = useState(false);
  const [avoidStrobe, setAvoidStrobe] = useState(true);
  const [isSeeding, setIsSeeding] = useState(false);
  const [lastSummary, setLastSummary] = useState<string>('');

  const disabled = fixtures.length === 0 || isSeeding;
  const effectiveTarget = packId === 'smart-ab-80' ? 'decks-a-b' : target;
  const selectedPack = useMemo(
    () => SCENE_SEED_PACKS.find((pack) => pack.id === packId) ?? SCENE_SEED_PACKS[0],
    [packId]
  );

  const runSeed = async () => {
    if (disabled) return;
    setIsSeeding(true);
    try {
      const result = await seedScenesFromFixtures({
        packId,
        target: effectiveTarget,
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
            <strong>Smart scene seed</strong>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close scene seed options">
              <LucideIcon name="X" size={15} />
            </button>
          </div>

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

          <label className={styles.checkRow}>
            <input
              type="checkbox"
              checked={includeAutomation}
              onChange={(event) => setIncludeAutomation(event.target.checked)}
            />
            Include animated timelines
          </label>

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

          <p>{avoidStrobe ? `${selectedPack.description} Strobe looks will be skipped and strobe channels are held safe.` : selectedPack.description}</p>

          <button type="button" className={styles.applyButton} onClick={runSeed} disabled={disabled}>
            <LucideIcon name="Wand2" size={16} />
            {isSeeding ? 'Seeding...' : 'Generate slots'}
          </button>

          {lastSummary && <span className={styles.seedSummary}>{lastSummary}</span>}
        </div>
      )}
    </div>
  );
};

export default SceneSeedButton;
