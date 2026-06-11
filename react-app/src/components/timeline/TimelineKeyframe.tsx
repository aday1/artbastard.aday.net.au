import React from 'react';
import { SceneTimelineKeyframe } from '../../store';
import { timeToPixels, formatTime } from '../../utils/timelineHelpers';
import { LucideIcon } from '../ui/LucideIcon';
import styles from './TimelineKeyframe.module.scss';

interface TimelineKeyframeProps {
  keyframe: SceneTimelineKeyframe;
  channel: number;
  zoom: number;
  scrollLeft: number;
  trackHeight: number;
  isSelected: boolean;
  isDragging: boolean;
  isHovered: boolean;
  color: string;
  value: number;
  onMouseDown: (e: React.MouseEvent, keyframeId: string) => void;
  onDoubleClick: (e: React.MouseEvent, keyframeId: string) => void;
  onContextMenu: (e: React.MouseEvent, keyframeId: string) => void;
  onMouseEnter: (keyframeId: string) => void;
  onMouseLeave: () => void;
  getChannelInfo?: (channel: number) => { fixtureName?: string; channelName?: string } | null;
}

export const TimelineKeyframe: React.FC<TimelineKeyframeProps> = ({
  keyframe,
  channel,
  zoom,
  scrollLeft,
  trackHeight,
  isSelected,
  isDragging,
  isHovered,
  color,
  value,
  onMouseDown,
  onDoubleClick,
  onContextMenu,
  onMouseEnter,
  onMouseLeave,
  getChannelInfo
}) => {
  const x = timeToPixels(keyframe.time, zoom) - scrollLeft;
  const y = trackHeight - (value / 255) * trackHeight;

  // Don't render if off-screen
  if (x < -50 || x > window.innerWidth + 50) {
    return null;
  }

  const channelInfo = getChannelInfo?.(channel);
  const tooltip = `Time: ${formatTime(keyframe.time)}\nChannel: ${channel + 1}${channelInfo ? ` (${channelInfo.fixtureName} - ${channelInfo.channelName})` : ''}\nValue: ${value} (${Math.round((value / 255) * 100)}%)\nEasing: ${keyframe.easing || 'linear'}`;

  return (
    <div
      className={`${styles.keyframe} ${isSelected ? styles.selected : ''} ${isDragging ? styles.dragging : ''} ${isHovered ? styles.hovered : ''}`}
      style={{
        left: `${x}px`,
        top: `${y}px`,
        '--keyframe-color': color
      } as React.CSSProperties}
      onMouseDown={(e) => onMouseDown(e, keyframe.id)}
      onDoubleClick={(e) => onDoubleClick(e, keyframe.id)}
      onContextMenu={(e) => onContextMenu(e, keyframe.id)}
      onMouseEnter={() => onMouseEnter(keyframe.id)}
      onMouseLeave={onMouseLeave}
      title={tooltip}
    >
      <div className={styles.keyframeMarker}>
        <div className={styles.keyframeDiamond} style={{ backgroundColor: color }} />
      </div>
      {(isSelected || isHovered) && (
        <div className={styles.keyframeLabel}>
          <span className={styles.valueLabel}>{value}</span>
          <span className={styles.percentageLabel}>{Math.round((value / 255) * 100)}%</span>
        </div>
      )}
      {isSelected && (
        <div className={styles.keyframeHandles}>
          <div className={styles.handle} data-handle="left" />
          <div className={styles.handle} data-handle="right" />
        </div>
      )}
    </div>
  );
};

