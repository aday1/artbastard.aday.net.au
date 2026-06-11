import React from 'react';
import { FC, useMemo } from 'react';
import { useStore } from '../../store';
import styles from './DmxChannelStats.module.scss';

interface Props {
  compact?: boolean;
}

export const DmxChannelStats: FC<Props> = ({ compact = false }) => {
  const dmxChannels = useStore(state => state.dmxChannels);
  const selectedChannels = useStore(state => state.selectedChannels);

  const stats = useMemo(() => {
    let activeCount = 0;
    let maxValue = 0;
    let avgValue = 0;
    let sum = 0;

    // Ensure dmxChannels is an array before iterating
    if (Array.isArray(dmxChannels)) {
      for (let i = 0; i < dmxChannels.length; i++) {
        const value = dmxChannels[i];
        if (value > 0) {
          activeCount++;
          sum += value;
          maxValue = Math.max(maxValue, value);
        }
      }
    }

    avgValue = activeCount > 0 ? Math.round(sum / activeCount) : 0;
    const totalChannels = Array.isArray(dmxChannels) ? dmxChannels.length : 0;

    return {
      activeCount,
      maxValue,
      avgValue,
      totalChannels,
      selectedCount: selectedChannels?.length || 0
    };
  }, [dmxChannels, selectedChannels]);

  if (compact) {
    return (
      <div className={styles.compactStats}>
        <span
          className={styles.statItem}
          title={`Active DMX Channels: ${stats.activeCount} of ${stats.totalChannels}\nSelected Channels: ${stats.selectedCount}`}
        >
          <i className="fas fa-chart-line"></i>
          <span className={stats.activeCount > 0 ? styles.active : ''}>
            {stats.activeCount}/{stats.totalChannels}
          </span>
        </span>

        <span
          className={styles.statItem}
          title={`Maximum Value: ${stats.maxValue}\nAverage Value: ${stats.avgValue}`}
        >
          <i className="fas fa-tachometer-alt"></i>
          <span>
            {stats.maxValue}
            <span className={styles.maxLabel}>max</span>
          </span>
        </span>
      </div>
    );
  }

  return (
    <div className={styles.channelStats}>
      <div className={styles.statCard}>
        <div className={styles.statValue}>{stats.activeCount}</div>
        <div className={styles.statLabel}>Active Channels</div>
        <div className={styles.statSecondary}>of {stats.totalChannels} total</div>
      </div>

      <div className={styles.statCard}>
        <div className={styles.statValue}>{stats.selectedCount}</div>
        <div className={styles.statLabel}>Selected</div>
      </div>

      <div className={styles.statCard}>
        <div className={styles.statValue}>{stats.maxValue}</div>
        <div className={styles.statLabel}>Max Value</div>
      </div>

      <div className={styles.statCard}>
        <div className={styles.statValue}>{stats.avgValue}</div>
        <div className={styles.statLabel}>Average</div>
        <div className={styles.statSecondary}>of active channels</div>
      </div>
    </div>
  );
};
