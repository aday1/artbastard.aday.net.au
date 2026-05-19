import React, { useEffect, useState } from 'react';
import { RackTabStrip } from '../ui/rack';
import { DmxTransitionTracker } from '../automation/tracker/DmxTransitionTracker';
import { useStore } from '../../store';
import styles from './SceneTimelinePatternDrawer.module.scss';

interface SceneTimelinePatternDrawerProps {
  sceneName: string;
}

export const SceneTimelinePatternDrawer: React.FC<SceneTimelinePatternDrawerProps> = ({
  sceneName,
}) => {
  const [mode, setMode] = useState<'timeline' | 'pattern'>('timeline');
  const [patternId, setPatternId] = useState<string | null>(null);

  const { transitionPatterns, addTransitionPattern } = useStore(
    (s) => ({
      transitionPatterns: s.transitionPatterns,
      addTransitionPattern: s.addTransitionPattern,
    })
  );

  useEffect(() => {
    const linked = transitionPatterns.find((p) => p.name === `Scene: ${sceneName}`);
    if (linked) {
      setPatternId(linked.id);
      return;
    }
    if (transitionPatterns.length > 0 && !patternId) {
      const id = addTransitionPattern(`Scene: ${sceneName}`);
      setPatternId(id);
    }
  }, [sceneName, addTransitionPattern, transitionPatterns, patternId]);

  return (
    <div className={`ab-rack ${styles.drawer}`}>
      <RackTabStrip
        tabs={[
          { id: 'timeline', label: 'Timeline' },
          { id: 'pattern', label: 'Pattern' },
        ]}
        activeId={mode}
        onChange={(id) => setMode(id as 'timeline' | 'pattern')}
        ariaLabel="Scene editor mode"
      />
      {mode === 'pattern' && patternId ? (
        <DmxTransitionTracker patternId={patternId} compact />
      ) : (
        <p className={styles.hint}>
          Timeline lanes are above. Switch to Pattern for stepped DMX transition rows in the DMX Tracker.
        </p>
      )}
    </div>
  );
};
