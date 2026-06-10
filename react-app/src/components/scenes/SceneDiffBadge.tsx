import React from 'react';
import { LucideIcon } from '../ui/LucideIcon';
import type { SceneDiff } from '../../selectors/sceneDiff';
import styles from './SceneDiffBadge.module.scss';

interface SceneDiffBadgeProps {
  diff: SceneDiff;
  previousSceneName: string | null;
}

/**
 * Compact "what changed vs. previous scene" indicator rendered on the
 * active scene card. Surfaces fixture-level adds/removes plus changed
 * channel count so operators see at a glance what the transition did.
 */
export const SceneDiffBadge: React.FC<SceneDiffBadgeProps> = ({ diff, previousSceneName }) => {
  if (!previousSceneName) return null;
  if (
    diff.addedFixtures.length === 0 &&
    diff.removedFixtures.length === 0 &&
    diff.changedChannels.length === 0
  ) {
    return null;
  }

  return (
    <div className={styles.diffBadge} title={`Diff vs. previous scene: ${previousSceneName}`}>
      <span className={styles.diffLabel}>
        <LucideIcon name="ArrowRightLeft" size={11} />
        vs. {previousSceneName}
      </span>
      {diff.addedFixtures.length > 0 && (
        <span className={styles.additive}>
          <LucideIcon name="Plus" size={10} />
          {diff.addedFixtures.length} lit
        </span>
      )}
      {diff.removedFixtures.length > 0 && (
        <span className={styles.subtractive}>
          <LucideIcon name="Minus" size={10} />
          {diff.removedFixtures.length} dark
        </span>
      )}
      {diff.changedChannels.length > 0 && (
        <span className={styles.changed}>
          <LucideIcon name="Sliders" size={10} />
          {diff.changedChannels.length} ch
        </span>
      )}
    </div>
  );
};

export default SceneDiffBadge;
