import React from 'react';
import { timeToPixels } from '../../utils/timelineHelpers';
import styles from './TimelinePlayhead.module.scss';

interface TimelinePlayheadProps {
  position: number; // Time in milliseconds
  zoom: number;
  scrollLeft: number;
  height: number;
}

export const TimelinePlayhead: React.FC<TimelinePlayheadProps> = ({
  position,
  zoom,
  scrollLeft,
  height
}) => {
  const x = timeToPixels(position, zoom) - scrollLeft;

  if (x < -10 || x > window.innerWidth + 10) {
    return null; // Don't render if off-screen
  }

  return (
    <div
      className={styles.playhead}
      style={{
        left: `${x}px`,
        height: `${height}px`
      }}
    >
      <div className={styles.playheadLine} />
      <div className={styles.playheadHandle} />
    </div>
  );
};

