import React, { useEffect, useMemo, useState } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { RackModule, RackTabStrip } from '../ui/rack';
import { LucideIcon } from '../ui/LucideIcon';
import { EnvelopeAutomation } from './EnvelopeAutomation';
import { DmxTransitionTracker } from './tracker/DmxTransitionTracker';
import styles from './AutomationWorkbench.module.scss';

type AutomationTab = 'envelopes' | 'tracker';

interface AutomationWorkbenchProps {
  showEnvelopes?: boolean;
  showTracker?: boolean;
  defaultTab?: AutomationTab;
}

export const AutomationWorkbench: React.FC<AutomationWorkbenchProps> = ({
  showEnvelopes = true,
  showTracker = true,
  defaultTab = 'tracker',
}) => {
  const { theme } = useTheme();
  const [tab, setTab] = useState<AutomationTab>(defaultTab);

  const tabs = useMemo(
    () =>
      [
        showTracker ? { id: 'tracker', label: theme === 'minimal' ? 'DMX' : 'DMX Tracker' } : null,
        showEnvelopes ? { id: 'envelopes', label: theme === 'minimal' ? 'Env' : 'Envelopes' } : null,
      ].filter(Boolean) as Array<{ id: AutomationTab; label: string }>,
    [showEnvelopes, showTracker, theme]
  );

  useEffect(() => {
    if (tabs.length > 0 && !tabs.some((item) => item.id === tab)) {
      setTab(tabs[0].id);
    }
  }, [tab, tabs]);

  if (tabs.length === 0) {
    return null;
  }

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
