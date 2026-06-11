import React from 'react';
import { SceneTimelineKeyframe } from '../../store';
import { TimelineKeyframe } from './TimelineKeyframe';
import { TimelineCurve } from './TimelineCurve';
import { getChannelsFromKeyframes, getKeyframeValue } from '../../utils/timelineHelpers';
import styles from './TimelineTrack.module.scss';

interface TimelineTrackProps {
  channel: number;
  keyframes: SceneTimelineKeyframe[];
  zoom: number;
  scrollLeft: number;
  startTime: number;
  endTime: number;
  trackHeight: number;
  color: string;
  isCollapsed: boolean;
  selectedKeyframes: Set<string>;
  draggingKeyframe: string | null;
  hoveredKeyframe: string | null;
  onKeyframeMouseDown: (e: React.MouseEvent, keyframeId: string) => void;
  onKeyframeDoubleClick: (e: React.MouseEvent, keyframeId: string) => void;
  onKeyframeContextMenu: (e: React.MouseEvent, keyframeId: string) => void;
  onKeyframeHover: (keyframeId: string | null) => void;
  onCurveClick?: (e: React.MouseEvent, time: number, channel: number) => void;
  getChannelInfo?: (channel: number) => { fixtureName?: string; channelName?: string } | null;
  channelName?: string;
  fixtureName?: string;
  onToggleCollapse?: () => void;
}

export const TimelineTrack: React.FC<TimelineTrackProps> = ({
  channel,
  keyframes,
  zoom,
  scrollLeft,
  startTime,
  endTime,
  trackHeight,
  color,
  isCollapsed,
  selectedKeyframes,
  draggingKeyframe,
  hoveredKeyframe,
  onKeyframeMouseDown,
  onKeyframeDoubleClick,
  onKeyframeContextMenu,
  onKeyframeHover,
  onCurveClick,
  getChannelInfo,
  channelName,
  fixtureName,
  onToggleCollapse
}) => {
  // Filter keyframes for this channel and visible time range
  const channelKeyframes = keyframes.filter(kf => {
    const value = getKeyframeValue(kf, channel);
    return value !== undefined && kf.time >= startTime && kf.time <= endTime;
  });

  if (isCollapsed) {
    return (
      <div className={styles.track} style={{ height: '40px' }}>
        <div className={styles.trackHeader} onClick={onToggleCollapse}>
          <div className={styles.trackHeaderContent}>
            <div className={styles.trackColor} style={{ backgroundColor: color }} />
            <span className={styles.trackName}>
              {fixtureName ? `${fixtureName} - ${channelName || `CH ${channel + 1}`}` : `CH ${channel + 1}`}
            </span>
            <span className={styles.keyframeCount}>{channelKeyframes.length} keyframes</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.track} style={{ height: `${trackHeight}px` }}>
      <div className={styles.trackHeader} onClick={onToggleCollapse}>
        <div className={styles.trackHeaderContent}>
          <div className={styles.trackColor} style={{ backgroundColor: color }} />
          <span className={styles.trackName}>
            {fixtureName ? `${fixtureName} - ${channelName || `CH ${channel + 1}`}` : `CH ${channel + 1}`}
          </span>
          <div className={styles.trackControls}>
            <span className={styles.keyframeCount}>{channelKeyframes.length}</span>
            <button className={styles.collapseButton}>
              <svg width="12" height="12" viewBox="0 0 12 12">
                <path d="M6 9L1 4h10z" fill="currentColor" />
              </svg>
            </button>
          </div>
        </div>
      </div>
      <div className={styles.trackContent}>
        {/* Value scale (0-255) */}
        <div className={styles.valueScale}>
          <span className={styles.valueLabel}>255</span>
          <span className={styles.valueLabel}>128</span>
          <span className={styles.valueLabel}>0</span>
        </div>
        <div className={styles.trackCanvas}>
          {/* Curve visualization */}
          <TimelineCurve
            keyframes={channelKeyframes}
            channel={channel}
            zoom={zoom}
            scrollLeft={scrollLeft}
            startTime={startTime}
            endTime={endTime}
            trackHeight={trackHeight}
            color={color}
            onCurveClick={onCurveClick}
          />
          {/* Keyframes */}
          {channelKeyframes.map(keyframe => {
            const value = getKeyframeValue(keyframe, channel);
            if (value === undefined) return null;
            
            return (
              <TimelineKeyframe
                key={keyframe.id}
                keyframe={keyframe}
                channel={channel}
                zoom={zoom}
                scrollLeft={scrollLeft}
                trackHeight={trackHeight}
                isSelected={selectedKeyframes.has(keyframe.id)}
                isDragging={draggingKeyframe === keyframe.id}
                isHovered={hoveredKeyframe === keyframe.id}
                color={color}
                value={value}
                onMouseDown={onKeyframeMouseDown}
                onDoubleClick={onKeyframeDoubleClick}
                onContextMenu={onKeyframeContextMenu}
                onMouseEnter={onKeyframeHover}
                onMouseLeave={() => onKeyframeHover(null)}
                getChannelInfo={getChannelInfo}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
};

