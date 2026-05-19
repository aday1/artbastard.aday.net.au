import React, { useMemo, useState } from 'react';
import { useStore } from '../../../store';
import {
  TRACKER_LANE_DEFINITIONS,
  collectTrackerLaneChannels,
  countLaneChannels,
  type TrackerFixtureScope,
  type TrackerLaneId,
} from '../../../utils/trackerFixtureRoles';
import { SkeuoButton } from '../../ui/SkeuoButton';
import styles from './TrackerFixtureLanes.module.scss';

export interface TrackerFixtureLanesProps {
  patternId: string;
}

export const TrackerFixtureLanes: React.FC<TrackerFixtureLanesProps> = ({ patternId }) => {
  const [scope, setScope] = useState<TrackerFixtureScope>('all');

  const { fixtures, selectedFixtures, setPatternPageChannels } = useStore((s) => ({
    fixtures: s.fixtures,
    selectedFixtures: s.selectedFixtures,
    setPatternPageChannels: s.setPatternPageChannels,
  }));

  const counts = useMemo(() => {
    const map: Partial<Record<TrackerLaneId, number>> = {};
    for (const lane of TRACKER_LANE_DEFINITIONS) {
      map[lane.id] = countLaneChannels(fixtures, lane.id, scope, selectedFixtures);
    }
    return map;
  }, [fixtures, scope, selectedFixtures]);

  const applyLane = (laneId: TrackerLaneId, mode: 'replace' | 'merge') => {
    const channels = collectTrackerLaneChannels(
      fixtures,
      laneId,
      scope,
      selectedFixtures
    );
    if (channels.length === 0) return;
    setPatternPageChannels(patternId, channels, mode);
  };

  return (
    <div className={styles.lanes}>
      <div className={styles.scopeRow}>
        <span className={styles.label}>Fixture scope</span>
        {(
          [
            ['all', 'All fixtures'],
            ['selected', 'Selected fixtures'],
            ['moving_heads', 'Moving heads only'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={scope === id ? styles.scopeBtnActive : styles.scopeBtn}
            onClick={() => setScope(id)}
          >
            {label}
          </button>
        ))}
        {scope === 'selected' && selectedFixtures.length === 0 && (
          <span className={styles.label}>Select fixtures on DMX / fixture page first</span>
        )}
      </div>

      <div className={styles.laneGrid}>
        {TRACKER_LANE_DEFINITIONS.map((lane) => {
          const n = counts[lane.id] ?? 0;
          const laneClass = styles[`lane_${lane.id}` as keyof typeof styles] ?? '';
          return (
            <div
              key={lane.id}
              className={`${styles.laneCard} ${laneClass}`}
              title={lane.description}
            >
              <div className={styles.laneHead}>
                <span className={styles.laneTitle}>{lane.label}</span>
                <span className={styles.laneCount}>{n} ch</span>
              </div>
              <p className={styles.laneDesc}>{lane.description}</p>
              <div className={styles.laneActions}>
                <SkeuoButton
                  compact
                  disabled={n === 0}
                  onClick={() => applyLane(lane.id, 'replace')}
                  title={`Replace page columns with ${lane.label} channels`}
                >
                  Set
                </SkeuoButton>
                <SkeuoButton
                  compact
                  disabled={n === 0}
                  onClick={() => applyLane(lane.id, 'merge')}
                  title={`Add ${lane.label} channels to this page`}
                >
                  Add
                </SkeuoButton>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
