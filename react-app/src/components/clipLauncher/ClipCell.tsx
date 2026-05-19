import React from 'react';
import { ClipCell as ClipCellType } from '../../store/clipLauncherStore';
import { LucideIcon } from '../ui/LucideIcon';
import styles from './ClipCell.module.scss';

interface ClipCellProps {
  clip: ClipCellType;
  isPlaying: boolean;
  isQueued: boolean;
  isRecording: boolean;
  onLaunch: () => void;
  onStop: () => void;
  onRecord: () => void;
  onToggleLoop: () => void;
  onDoubleClick: () => void;
  getScenePreview?: (sceneName: string) => { color: string; thumbnail?: string };
}

export const ClipCell: React.FC<ClipCellProps> = ({
  clip,
  isPlaying,
  isQueued,
  isRecording,
  onLaunch,
  onStop,
  onRecord,
  onToggleLoop,
  onDoubleClick,
  getScenePreview
}) => {
  const isEmpty = !clip.sceneName;
  const preview = clip.sceneName && getScenePreview ? getScenePreview(clip.sceneName) : null;
  const displayColor = preview?.color || clip.color;

  return (
    <div
      className={`${styles.clipCell} ${isEmpty ? styles.empty : ''} ${isPlaying ? styles.playing : ''} ${isQueued ? styles.queued : ''} ${isRecording ? styles.recording : ''}`}
      style={{ '--clip-color': displayColor } as React.CSSProperties}
      onDoubleClick={onDoubleClick}
    >
      {/* Clip Header */}
      <div className={styles.clipHeader}>
        <div className={styles.clipName}>
          {clip.sceneName || 'Empty'}
        </div>
        {clip.loop && (
          <div className={styles.loopIndicator} title="Looping">
            <LucideIcon name="Repeat" size={12} />
          </div>
        )}
      </div>

      {/* Clip Content */}
      <div className={styles.clipContent}>
        {isEmpty ? (
          <div className={styles.emptySlot}>
            <LucideIcon name="Plus" size={24} />
            <span>Click to add scene</span>
          </div>
        ) : (
          <>
            {/* Scene Preview */}
            <div className={styles.scenePreview} style={{ backgroundColor: displayColor }}>
              {preview?.thumbnail && (
                <img src={preview.thumbnail} alt={clip.sceneName || ''} />
              )}
            </div>

            {/* Playhead Progress */}
            {isPlaying && (
              <div className={styles.playheadProgress}>
                <div className={styles.playheadBar} />
              </div>
            )}
          </>
        )}
      </div>

      {/* Clip Controls */}
      <div className={styles.clipControls}>
        {isEmpty ? (
          <button
            className={styles.recordButton}
            onClick={onRecord}
            title="Record new scene"
          >
            <LucideIcon name="Circle" size={16} />
          </button>
        ) : (
          <>
            <button
              className={`${styles.launchButton} ${isPlaying ? styles.playing : ''}`}
              onClick={isPlaying ? onStop : onLaunch}
              title={isPlaying ? 'Stop' : 'Launch'}
            >
              <LucideIcon name={isPlaying ? 'Square' : 'Play'} size={16} />
            </button>
            <button
              className={`${styles.loopButton} ${clip.loop ? styles.active : ''}`}
              onClick={onToggleLoop}
              title="Toggle loop"
            >
              <LucideIcon name="Repeat" size={14} />
            </button>
          </>
        )}
      </div>

      {/* Recording Indicator */}
      {isRecording && (
        <div className={styles.recordingIndicator}>
          <div className={styles.recordingPulse} />
          <span>REC</span>
        </div>
      )}

      {/* Queued Indicator */}
      {isQueued && !isPlaying && (
        <div className={styles.queuedIndicator}>
          <LucideIcon name="Clock" size={12} />
        </div>
      )}
    </div>
  );
};

