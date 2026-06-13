import React, { useState } from 'react';
import { useStore } from '../../store';
import { LucideIcon } from '../ui/LucideIcon';
import SuperControl from '../dmx/SuperControl';
import { ShowBuilderPanel } from './ShowBuilderPanel';
import { Apc40WorkflowBody } from './Apc40WorkflowPanel';
import styles from './UnifiedStageWorkbench.module.scss';

type WorkbenchMode = 'patch' | 'show' | 'apc';

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

export const UnifiedStageWorkbench: React.FC = () => {
  const [mode, setMode] = useState<WorkbenchMode>('patch');
  const { fixtures, groups, scenes, apc40State } = useStore((s) => ({
    fixtures: s.fixtures,
    groups: s.groups,
    scenes: s.scenes,
    apc40State: s.apc40CrossfaderState,
  }));

  const activeTarget = apc40State.activeTargetLabel || 'No APC40 target selected';

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
        <div className={`${styles.bodySlot} ${styles.apcBody}`} aria-label="APC40 SuperControl workflow">
          <div className={styles.apcOverview}>
            <div className={styles.apcModeHeader}>
              <span>APC40 target</span>
              <strong>{activeTarget}</strong>
            </div>
            <Apc40WorkflowBody withoutMap />
          </div>
          <div className={styles.superControlPanel}>
            <SuperControl isDockable={false} preferTouchLayout embeddedWorkbench />
          </div>
        </div>
      )}
    </section>
  );
};

export default UnifiedStageWorkbench;
