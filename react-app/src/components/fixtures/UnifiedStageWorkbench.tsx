import React, { useState } from 'react';
import { useStore } from '../../store';
import { LucideIcon } from '../ui/LucideIcon';
import { StageMapDashboard } from './StageMapDashboard';
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
  const { fixtures, groups, apc40State } = useStore((s) => ({
    fixtures: s.fixtures,
    groups: s.groups,
    apc40State: s.apc40CrossfaderState,
  }));

  const highlightGroupId = mode === 'apc' ? apc40State.activeGroupId : null;
  const highlightFixtureIds = mode === 'apc' ? apc40State.activeFixtureIds : [];
  const highlightLabel = mode === 'apc' ? apc40State.activeTargetLabel : null;

  const subtitle =
    mode === 'show'
      ? `${fixtures.length} fixtures · ${groups.length} groups · build below to add more`
      : mode === 'apc'
        ? apc40State.activeTargetLabel
          ? `APC target -> ${apc40State.activeTargetLabel}`
          : `${fixtures.length} fixtures · ${groups.length} groups · tap to target the surface`
        : undefined;

  const title =
    mode === 'show'
      ? 'Show planning map'
      : mode === 'apc'
        ? 'APC40 live stage map'
        : 'Live Stage Map';

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

      <div className={styles.mapWrap}>
        <StageMapDashboard
          title={title}
          subtitle={subtitle}
          highlightGroupId={highlightGroupId}
          highlightFixtureIds={highlightFixtureIds}
          highlightLabel={highlightLabel}
        />
      </div>

      {mode === 'patch' && (
        <div className={styles.patchHint}>
          <LucideIcon name="ArrowDown" size={14} />
          <span>Use the patch editor below to add, move, and address fixtures.</span>
        </div>
      )}

      {mode === 'show' && (
        <div className={styles.bodySlot}>
          <ShowBuilderPanel />
        </div>
      )}

      {mode === 'apc' && (
        <div className={styles.bodySlot}>
          <Apc40WorkflowBody withoutMap />
        </div>
      )}
    </section>
  );
};

export default UnifiedStageWorkbench;
