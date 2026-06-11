import React from 'react';
import { formatTime, formatBarsBeats, timeToPixels, calculateGridInterval } from '../../utils/timelineHelpers';
import styles from './TimelineRuler.module.scss';

interface TimelineRulerProps {
  duration: number;
  zoom: number;
  scrollLeft: number;
  width: number;
  bpm?: number;
  syncToBpm?: boolean;
  timeFormat?: 'time' | 'bars-beats' | 'both';
}

export const TimelineRuler: React.FC<TimelineRulerProps> = ({
  duration,
  zoom,
  scrollLeft,
  width,
  bpm,
  syncToBpm = false,
  timeFormat = 'time'
}) => {
  const gridInterval = calculateGridInterval(zoom, bpm);
  const pixelsPerInterval = timeToPixels(gridInterval, zoom);
  
  // Generate tick marks
  const ticks: Array<{ time: number; x: number; isMajor: boolean }> = [];
  const startTime = Math.max(0, Math.floor((scrollLeft / zoom) * 1000) - gridInterval);
  const endTime = Math.min(duration, startTime + ((width / zoom) * 1000) + gridInterval);
  
  for (let time = startTime; time <= endTime; time += gridInterval) {
    const x = timeToPixels(time, zoom) - scrollLeft;
    if (x >= -100 && x <= width + 100) {
      // Major tick every 4 intervals
      const intervalCount = Math.floor(time / gridInterval);
      ticks.push({
        time,
        x,
        isMajor: intervalCount % 4 === 0
      });
    }
  }

  return (
    <div className={styles.timelineRuler}>
      <div className={styles.rulerContent} style={{ width: `${timeToPixels(duration, zoom)}px` }}>
        {ticks.map((tick, index) => (
          <div
            key={index}
            className={`${styles.tick} ${tick.isMajor ? styles.major : styles.minor}`}
            style={{ left: `${tick.x}px` }}
          >
            {tick.isMajor && (
              <span className={styles.label}>
                {syncToBpm && bpm
                  ? formatBarsBeats(tick.time, bpm)
                  : formatTime(tick.time)}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

