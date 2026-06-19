import React, { useMemo, useState } from 'react';
import { useStore } from '../../store';
import {
  ACT_SEED_PACKS,
  type ActSeedPackId,
} from '../../acts/actSeedGenerator';
import { LucideIcon } from '../ui/LucideIcon';
import styles from './ActSeedButton.module.scss';

interface ActSeedButtonProps {
  className?: string;
}

export const ActSeedButton: React.FC<ActSeedButtonProps> = ({ className }) => {
  const scenes = useStore((state) => state.scenes);
  const seedActsFromScenes = useStore((state) => state.seedActsFromScenes);
  const [open, setOpen] = useState(false);
  const [packId, setPackId] = useState<ActSeedPackId>('starter-acts');
  const [includeTriggers, setIncludeTriggers] = useState(true);
  const [avoidStrobe, setAvoidStrobe] = useState(true);
  const [isSeeding, setIsSeeding] = useState(false);
  const [lastSummary, setLastSummary] = useState('');

  const selectedPack = useMemo(
    () => ACT_SEED_PACKS.find((pack) => pack.id === packId) ?? ACT_SEED_PACKS[0],
    [packId]
  );
  const disabled = scenes.length === 0 || isSeeding;

  const runSeed = async () => {
    if (disabled) return;
    setIsSeeding(true);
    try {
      const result = await seedActsFromScenes({ packId, includeTriggers, avoidStrobe });
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
    <div className={`${styles.seedRoot} ${className || ''}`}>
      <button
        type="button"
        className={styles.seedButton}
        onClick={() => setOpen((value) => !value)}
        disabled={scenes.length === 0}
        title={scenes.length === 0 ? 'Create or seed scenes before seeding ACTS' : selectedPack.description}
      >
        <LucideIcon name="Sparkles" size={16} />
        Seed ACTS
      </button>

      {open && (
        <div className={styles.seedPanel}>
          <div className={styles.seedHeader}>
            <strong>Optional ACT seed</strong>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close ACT seed options">
              <LucideIcon name="X" size={15} />
            </button>
          </div>

          <label>
            Pack
            <select value={packId} onChange={(event) => setPackId(event.target.value as ActSeedPackId)}>
              {ACT_SEED_PACKS.map((pack) => (
                <option key={pack.id} value={pack.id}>
                  {pack.label}
                </option>
              ))}
            </select>
          </label>

          <label className={styles.checkRow}>
            <input
              type="checkbox"
              checked={includeTriggers}
              onChange={(event) => setIncludeTriggers(event.target.checked)}
            />
            Add OSC play/stop triggers
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
              <small>Skip strobe ACTS and strobe scene references</small>
            </span>
          </label>

          <p>{avoidStrobe ? `${selectedPack.description} Strobe ACTS and strobe scene references will be skipped.` : selectedPack.description}</p>
          <p className={styles.seedNote}>Seeds never run automatically. Handmade ACTS are preserved; generated ACTS can be edited, deleted, or ignored.</p>

          <button type="button" className={styles.applyButton} onClick={runSeed} disabled={disabled}>
            <LucideIcon name="Wand2" size={16} />
            {isSeeding ? 'Seeding...' : 'Generate ACTS'}
          </button>

          {lastSummary && <span className={styles.seedSummary}>{lastSummary}</span>}
        </div>
      )}
    </div>
  );
};

export default ActSeedButton;

