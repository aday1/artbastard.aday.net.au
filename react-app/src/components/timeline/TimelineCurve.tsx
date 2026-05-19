import React from 'react';
import { SceneTimelineKeyframe } from '../../store';
import { generateCurvePath, timeToPixels } from '../../utils/timelineHelpers';
import styles from './TimelineCurve.module.scss';

interface TimelineCurveProps {
  keyframes: SceneTimelineKeyframe[];
  channel: number;
  zoom: number;
  scrollLeft: number;
  startTime: number;
  endTime: number;
  trackHeight: number;
  color: string;
  onCurveClick?: (e: React.MouseEvent, time: number, channel: number) => void;
}

export const TimelineCurve: React.FC<TimelineCurveProps> = ({
  keyframes,
  channel,
  zoom,
  scrollLeft,
  startTime,
  endTime,
  trackHeight,
  color,
  onCurveClick
}) => {
  const path = generateCurvePath(keyframes, channel, startTime, endTime, zoom, trackHeight);
  const width = timeToPixels(endTime - startTime, zoom);
  const offsetX = timeToPixels(startTime, zoom) - scrollLeft;

  if (path === '' || offsetX + width < 0 || offsetX > window.innerWidth) {
    return null; // Don't render if off-screen or no path
  }

  const handleClick = (e: React.MouseEvent<SVGElement>) => {
    if (onCurveClick) {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const time = (x / zoom) * 1000 + startTime;
      onCurveClick(e, time, channel);
    }
  };

  return (
    <svg
      className={styles.timelineCurve}
      style={{
        left: `${offsetX}px`,
        width: `${width}px`,
        height: `${trackHeight}px`
      }}
      onClick={handleClick}
    >
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth="2"
        className={styles.curvePath}
      />
      {/* Value grid lines */}
      <line
        x1="0"
        y1={trackHeight * 0.5}
        x2={width}
        y2={trackHeight * 0.5}
        className={styles.midline}
      />
    </svg>
  );
};

