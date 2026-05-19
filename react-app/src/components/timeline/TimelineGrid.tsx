import React from 'react';
import { timeToPixels, calculateGridInterval } from '../../utils/timelineHelpers';
import styles from './TimelineGrid.module.scss';

interface TimelineGridProps {
  duration: number;
  zoom: number;
  scrollLeft: number;
  width: number;
  height: number;
  bpm?: number;
  syncToBpm?: boolean;
}

export const TimelineGrid: React.FC<TimelineGridProps> = ({
  duration,
  zoom,
  scrollLeft,
  width,
  height,
  bpm,
  syncToBpm = false
}) => {
  const gridInterval = calculateGridInterval(zoom, bpm);
  const pixelsPerInterval = timeToPixels(gridInterval, zoom);
  
  // Generate vertical grid lines
  const lines: Array<{ time: number; x: number; isMajor: boolean }> = [];
  const startTime = Math.max(0, Math.floor((scrollLeft / zoom) * 1000) - gridInterval);
  const endTime = Math.min(duration, startTime + ((width / zoom) * 1000) + gridInterval);
  
  for (let time = startTime; time <= endTime; time += gridInterval) {
    const x = timeToPixels(time, zoom) - scrollLeft;
    if (x >= -10 && x <= width + 10) {
      const intervalCount = Math.floor(time / gridInterval);
      lines.push({
        time,
        x,
        isMajor: intervalCount % 4 === 0
      });
    }
  }

  return (
    <svg
      className={styles.timelineGrid}
      style={{ width: `${width}px`, height: `${height}px` }}
    >
      {lines.map((line, index) => (
        <line
          key={index}
          x1={line.x}
          y1={0}
          x2={line.x}
          y2={height}
          className={`${styles.gridLine} ${line.isMajor ? styles.major : styles.minor}`}
        />
      ))}
    </svg>
  );
};

