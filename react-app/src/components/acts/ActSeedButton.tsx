import React, { useMemo, useState } from 'react';
import { useStore } from '../../store';
import {
  ACT_SEED_PACKS,
  listActSeedPickTemplates,
  type ActSeedMode,
  type ActSeedPackId,
} from '../../acts/actSeedGenerator';
import {
  actSeedModeUi,
  actSeedPackUi,
} from '../../acts/actSeedUi';
import { LucideIcon } from '../ui/LucideIcon';
import styles from './ActSeedButton.module.scss';

interface ActSeedButtonProps {
  className?: string;
}

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

  const modeDetails = actSeedModeUi(mode);
  const packDetails = actSeedPackUi(packId);
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
        title={scenes.length === 0 ? 'Create or seed scenes before seeding ACTS' : packDetails.bestFor}
      >
        <LucideIcon name="Sparkles" size={16} />
        Seed ACTS
      </button>

      {open && (
        <div className={styles.seedPanel}>
          <div className={styles.seedHeader}>
            <strong>ACT seed (optional)</strong>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close ACT seed options">
              <LucideIcon name="X" size={15} />
            </button>
          </div>

          <p className={styles.seedIntro}>
            ACT macros chain APC clip scenes on the Scene Launch row. Seed scenes first, then pick a pack or build one ACT from scenes you select.
          </p>

          <label>
            What to do
            <select value={mode} onChange={(event) => setMode(event.target.value as ActSeedMode)}>
              {['pack', 'single-template', 'from-scenes'].map((optionId) => {
                const option = actSeedModeUi(optionId as ActSeedMode);
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
                ACT pack
                <select value={packId} onChange={(event) => setPackId(event.target.value as ActSeedPackId)}>
                  {ACT_SEED_PACKS.map((pack) => (
                    <option key={pack.id} value={pack.id}>
                      {actSeedPackUi(pack.id as ActSeedPackId).label}
                    </option>
                  ))}
                </select>
              </label>

              <div className={styles.seedDetailBox}>
                <strong>{packDetails.creates}</strong>
                <ul className={styles.seedDetailList}>
                  {packDetails.includes.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
                <p className={styles.seedDetailHint}>{packDetails.bestFor}</p>
                {avoidStrobe && (
                  <p className={styles.seedDetailHint}>Strobe ACTS and strobe scene steps are skipped while NO STROBE is on.</p>
                )}
              </div>
            </>
          )}

          {mode !== 'pack' && (
            <label>
              Scene Launch button
              <select value={actSlot} onChange={(event) => setActSlot(Number(event.target.value))}>
                {Array.from({ length: 5 }, (_, index) => index + 1).map((slotNumber) => (
                  <option key={slotNumber} value={slotNumber}>
                    Button {slotNumber}
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
              <strong>Scenes in this ACT (order matters)</strong>
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
            Add OSC play/stop triggers on each ACT
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

          <p className={styles.seedNote}>Seeds never run automatically. Handmade ACTS are kept; generated ACTS can be edited or deleted.</p>

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
