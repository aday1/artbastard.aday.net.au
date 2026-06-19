import React, { useMemo, useState } from 'react';
import { useStore } from '../../store';
import {
  ACT_SEED_PACKS,
  listActSeedPickTemplates,
  type ActSeedMode,
  type ActSeedPackId,
} from '../../acts/actSeedGenerator';
import { LucideIcon } from '../ui/LucideIcon';
import styles from './ActSeedButton.module.scss';

interface ActSeedButtonProps {
  className?: string;
}

const MODES: Array<{ id: ActSeedMode; label: string }> = [
  { id: 'pack', label: 'Full pack' },
  { id: 'single-template', label: 'One ACT template' },
  { id: 'from-scenes', label: 'From selected scenes' },
];

export const ActSeedButton: React.FC<ActSeedButtonProps> = ({ className }) => {
  const scenes = useStore((state) => state.scenes);
  const seedActsFromScenes = useStore((state) => state.seedActsFromScenes);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<ActSeedMode>('pack');
  const [packId, setPackId] = useState<ActSeedPackId>('starter-acts');
  const [actSlot, setActSlot] = useState(1);
  const [templateId, setTemplateId] = useState('color-warmup');
  const [selectedSceneNames, setSelectedSceneNames] = useState<string[]>([]);
  const [includeTriggers, setIncludeTriggers] = useState(true);
  const [avoidStrobe, setAvoidStrobe] = useState(true);
  const [isSeeding, setIsSeeding] = useState(false);
  const [lastSummary, setLastSummary] = useState('');

  const pickTemplates = useMemo(
    () => listActSeedPickTemplates(avoidStrobe),
    [avoidStrobe]
  );

  const selectedPack = useMemo(
    () => ACT_SEED_PACKS.find((pack) => pack.id === packId) ?? ACT_SEED_PACKS[0],
    [packId]
  );
  const disabled = scenes.length === 0 || isSeeding;
  const sceneSelectionMissing = mode === 'from-scenes' && selectedSceneNames.length === 0;

  const toggleSceneName = (sceneName: string) => {
    setSelectedSceneNames((current) =>
      current.includes(sceneName)
        ? current.filter((name) => name !== sceneName)
        : [...current, sceneName]
    );
  };

  const runSeed = async () => {
    if (disabled || sceneSelectionMissing) return;
    setIsSeeding(true);
    try {
      const result = await seedActsFromScenes({
        mode,
        packId,
        actSlot,
        templateId: mode === 'single-template' ? templateId : undefined,
        sceneNames: mode === 'from-scenes' ? selectedSceneNames : undefined,
        includeTriggers,
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
            Mode
            <select value={mode} onChange={(event) => setMode(event.target.value as ActSeedMode)}>
              {MODES.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          {mode === 'pack' && (
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
          )}

          {mode !== 'pack' && (
            <label>
              ACT slot
              <select value={actSlot} onChange={(event) => setActSlot(Number(event.target.value))}>
                {Array.from({ length: 5 }, (_, index) => index + 1).map((slotNumber) => (
                  <option key={slotNumber} value={slotNumber}>
                    Scene Launch {slotNumber}
                  </option>
                ))}
              </select>
            </label>
          )}

          {mode === 'single-template' && (
            <label>
              ACT template
              <select value={templateId} onChange={(event) => setTemplateId(event.target.value)}>
                {pickTemplates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.label}
                  </option>
                ))}
              </select>
            </label>
          )}

          {mode === 'from-scenes' && (
            <div className={styles.scenePickList}>
              <strong>Scenes in this ACT</strong>
              <div className={styles.scenePickScroll}>
                {scenes.map((scene) => (
                  <label key={scene.name} className={styles.checkRow}>
                    <input
                      type="checkbox"
                      checked={selectedSceneNames.includes(scene.name)}
                      onChange={() => toggleSceneName(scene.name)}
                    />
                    {scene.name}
                  </label>
                ))}
              </div>
            </div>
          )}

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

          <p>
            {mode === 'pack' && (avoidStrobe ? `${selectedPack.description} Strobe ACTS and strobe scene references will be skipped.` : selectedPack.description)}
            {mode === 'single-template' && 'Seed one ACT template into a single Scene Launch button so you can audition it before filling the whole row.'}
            {mode === 'from-scenes' && 'Build one ACT from the scenes you tick below, in order, so you can judge the sequence before committing to a full pack.'}
          </p>
          <p className={styles.seedNote}>Seeds never run automatically. Handmade ACTS are preserved; generated ACTS can be edited, deleted, or ignored.</p>

          <button type="button" className={styles.applyButton} onClick={runSeed} disabled={disabled || sceneSelectionMissing}>
            <LucideIcon name="Wand2" size={16} />
            {isSeeding
              ? 'Working...'
              : mode === 'pack'
                ? 'Generate ACTS'
                : mode === 'from-scenes'
                  ? 'Build ACT from scenes'
                  : 'Seed this ACT'}
          </button>

          {sceneSelectionMissing && (
            <span className={styles.seedSummary}>Tick at least one scene for this ACT.</span>
          )}

          {lastSummary && <span className={styles.seedSummary}>{lastSummary}</span>}
        </div>
      )}
    </div>
  );
};

export default ActSeedButton;
