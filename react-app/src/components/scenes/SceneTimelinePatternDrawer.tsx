import React, { useEffect, useState } from 'react';
import { RackTabStrip } from '../ui/rack';
import { DmxTransitionTracker } from '../automation/tracker/DmxTransitionTracker';
import { useStore } from '../../store';
import { isFeatureEnabled } from '../../utils/featureFlags';
import styles from './SceneTimelinePatternDrawer.module.scss';

interface SceneTimelinePatternDrawerProps {
  sceneName: string;
}

export const SceneTimelinePatternDrawer: React.FC<SceneTimelinePatternDrawerProps> = ({
  sceneName,
}) => {
  const trackerEnabled = isFeatureEnabled('dmxTracker');
  const [mode, setMode] = useState<'timeline' | 'pattern'>('timeline');
  const [patternId, setPatternId] = useState<string | null>(null);

  const { transitionPatterns, addTransitionPattern } = useStore(
    (s) => ({
      transitionPatterns: s.transitionPatterns,
      addTransitionPattern: s.addTransitionPattern,
    })
  );

  useEffect(() => {
    if (!trackerEnabled) {
      setMode('timeline');
      return;
    }
    const linked = transitionPatterns.find((p) => p.name === `Scene: ${sceneName}`);
    if (linked) {
      setPatternId(linked.id);
      return;
    }
    if (transitionPatterns.length > 0 && !patternId) {
      const id = addTransitionPattern(`Scene: ${sceneName}`);
      setPatternId(id);
    }
  }, [trackerEnabled, sceneName, addTransitionPattern, transitionPatterns, patternId]);

  return (
    <div className={`ab-rack ${styles.drawer}`}>
      <RackTabStrip
        tabs={[
          { id: 'timeline', label: 'Timeline' },
          ...(trackerEnabled ? [{ id: 'pattern', label: 'Pattern' } as const] : []),
        ]}
        activeId={mode}
        onChange={(id) => setMode(id as 'timeline' | 'pattern')}
        ariaLabel="Scene editor mode"
      />
      {trackerEnabled && mode === 'pattern' && patternId ? (
        <DmxTransitionTracker patternId={patternId} compact />
      ) : (
        <p className={styles.hint}>
          Timeline lanes are above.
        </p>
      )}
    </div>
  );
};
