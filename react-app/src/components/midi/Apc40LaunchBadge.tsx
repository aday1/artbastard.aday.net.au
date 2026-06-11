import React from 'react';
import { LucideIcon } from '../ui/LucideIcon';
import styles from './Apc40LaunchBadge.module.scss';

interface Apc40LaunchBadgeProps {
  /**
   * 0-based Act index. APC40 SCENE LAUNCH buttons trigger the first
   * five acts (notes 0x52–0x56 in midi/apc40.ts:69-74). Pass -1 or any
   * index >= 5 and the badge falls back to a disabled "unbound" pill.
   */
  actIndex: number;
  actName?: string | null;
  /** When true the badge pulses to indicate the act is currently playing. */
  active?: boolean;
  compact?: boolean;
}

const APC40_SCENE_LAUNCH_COUNT = 5;

/**
 * Graphical badge showing which APC40 SCENE LAUNCH button triggers a
 * given act. The 5-dot strip mirrors the physical right-hand column of
 * the APC40, with the bound dot filled and labelled.
 */
export const Apc40LaunchBadge: React.FC<Apc40LaunchBadgeProps> = ({
  actIndex,
  actName,
  active = false,
  compact = false,
}) => {
  const bound = actIndex >= 0 && actIndex < APC40_SCENE_LAUNCH_COUNT;

  return (
    <div
      className={`${styles.badge} ${compact ? styles.compact : ''} ${active ? styles.active : ''}`}
      title={
        bound
          ? `APC40 SCENE LAUNCH ${actIndex + 1} → ${actName || `Act ${actIndex + 1}`}`
          : 'Not bound to an APC40 SCENE LAUNCH button (only the first 5 acts are reachable)'
      }
      aria-label={bound ? `APC40 SCENE LAUNCH ${actIndex + 1}` : 'No APC40 binding'}
    >
      <LucideIcon name={bound ? 'Cable' : 'Unplug'} size={compact ? 10 : 12} />
      <span className={styles.dots}>
        {Array.from({ length: APC40_SCENE_LAUNCH_COUNT }).map((_, i) => (
          <span
            key={i}
            className={`${styles.dot} ${i === actIndex ? styles.dotActive : ''}`}
          />
        ))}
      </span>
      <span className={styles.label}>
        {bound ? `APC ▶ ${actIndex + 1}` : 'unbound'}
      </span>
    </div>
  );
};

export default Apc40LaunchBadge;
