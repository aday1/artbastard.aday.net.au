import React, { useState } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { RackModule, RackTabStrip } from '../ui/rack';
import { LucideIcon } from '../ui/LucideIcon';
import { EnvelopeAutomation } from './EnvelopeAutomation';
import { DmxTransitionTracker } from './tracker/DmxTransitionTracker';
import styles from './AutomationWorkbench.module.scss';

type AutomationTab = 'envelopes' | 'tracker';

export const AutomationWorkbench: React.FC = () => {
  const { theme } = useTheme();
  const [tab, setTab] = useState<AutomationTab>('tracker');

  const tabs = [
    { id: 'tracker', label: theme === 'minimal' ? 'Trk' : 'Renoise tracker' },
    { id: 'envelopes', label: theme === 'minimal' ? 'Env' : 'Envelopes' },
  ];

  return (
    <div className={`ab-rack ${styles.workbench}`}>
      <RackModule
        className={styles.shell}
        title={
          <>
            <LucideIcon name="SlidersHorizontal" />
            {theme === 'artsnob' && 'Automation workbench'}
            {theme === 'standard' && 'Automation'}
            {theme === 'minimal' && 'Auto'}
          </>
        }
        actions={
          <RackTabStrip
            tabs={tabs}
            activeId={tab}
            onChange={(id) => setTab(id as AutomationTab)}
            ariaLabel="Automation modes"
          />
        }
      >
        {tab === 'envelopes' ? (
          <EnvelopeAutomation embedded />
        ) : (
          <DmxTransitionTracker />
        )}
      </RackModule>
    </div>
  );
};
