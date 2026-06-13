import React, { useState } from 'react';
import { useStore } from '../../store';
import { LucideIcon } from '../ui/LucideIcon';
import { ShowBuilderPanel } from './ShowBuilderPanel';
import { Apc40SurfaceDiagram } from '../midi/Apc40SurfaceDiagram';
import styles from './UnifiedStageWorkbench.module.scss';

export type WorkbenchMode = 'patch' | 'show' | 'apc';

interface TabDef {
  id: WorkbenchMode;
  label: string;
  icon: 'Wrench' | 'Rows3' | 'Cable';
  sub: string;
}

const TABS: TabDef[] = [
  { id: 'patch', label: 'Patch', icon: 'Wrench', sub: 'See and select what is on stage' },
  { id: 'show', label: 'Build a Show', icon: 'Rows3', sub: 'Batch-create fixtures, groups, addresses' },
  { id: 'apc', label: 'APC40', icon: 'Cable', sub: 'Drive the rig from the APC40 surface' },
];

interface UnifiedStageWorkbenchProps {
  mode?: WorkbenchMode;
  onModeChange?: (mode: WorkbenchMode) => void;
}

export const UnifiedStageWorkbench: React.FC<UnifiedStageWorkbenchProps> = ({ mode: controlledMode, onModeChange }) => {
  const [localMode, setLocalMode] = useState<WorkbenchMode>('patch');
  const mode = controlledMode ?? localMode;
  const setMode = (nextMode: WorkbenchMode) => {
    if (controlledMode === undefined) setLocalMode(nextMode);
    onModeChange?.(nextMode);
  };
  const { fixtures, groups, scenes, apc40State } = useStore((s) => ({
    fixtures: s.fixtures,
    groups: s.groups,
    scenes: s.scenes,
    apc40State: s.apc40CrossfaderState,
  }));

  const activeTarget = apc40State.activeTargetLabel;

  return (
    <section className={styles.workbench} aria-label="Unified stage workbench">
      <div className={styles.tabStrip} role="tablist">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={mode === tab.id}
            className={`${styles.tab} ${mode === tab.id ? styles.tabActive : ''}`}
            onClick={() => setMode(tab.id)}
          >
            <LucideIcon name={tab.icon} size={16} />
            <span className={styles.tabLabel}>{tab.label}</span>
            <span className={styles.tabSub}>{tab.sub}</span>
          </button>
        ))}
      </div>

      {mode === 'patch' && (
        <div className={styles.patchSummary} aria-label="Patch workspace summary">
          <div>
            <strong>{fixtures.length}</strong>
            <span>patched fixtures</span>
          </div>
          <div>
            <strong>{groups.length}</strong>
            <span>groups ready</span>
          </div>
          <div>
            <strong>{scenes.length}</strong>
            <span>saved scenes</span>
          </div>
          <p>
            <LucideIcon name="ArrowUp" size={14} />
            Patch, place, select, and address fixtures in the stage editor above.
          </p>
        </div>
      )}

      {mode === 'show' && (
        <div className={`${styles.bodySlot} ${styles.showBody}`}>
          <ShowBuilderPanel />
        </div>
      )}

      {mode === 'apc' && (
        <div className={`${styles.bodySlot} ${styles.apcBody}`} aria-label="APC40 map-first workflow">
          <div className={styles.apcVisualizerPanel}>
            <div className={styles.apcVisualHeader}>
              <div>
                <span>APC40 Visualizer</span>
                <strong>{activeTarget || 'Track Select chooses groups or fixtures'}</strong>
              </div>
              <ul>
                <li><b>Track Select</b><span>stage target</span></li>
                <li><b>Faders</b><span>dimmers</span></li>
                <li><b>Device Control</b><span>gobo / color / prism / focus</span></li>
                <li><b>Grid + Crossfader</b><span>Deck A/B scenes</span></li>
              </ul>
            </div>
            <Apc40SurfaceDiagram mode="fixtures" compact showBothDecks title="APC40 Visualizer" />
          </div>
        </div>
      )}
    </section>
  );
};

export default UnifiedStageWorkbench;
