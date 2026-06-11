import React from 'react';
import { useStore } from '../../store';
import { LucideIcon } from '../ui/LucideIcon';
import styles from './TimelinePlaybackControls.module.scss';

export const TimelinePlaybackControls: React.FC = () => {
  const {
    timelinePlayback,
    timelineSequences,
    activeTimelineSequence,
    playTimelineSequence,
    stopTimelinePlayback,
    setTimelineSpeed
  } = useStore();

  const activeSequence = timelineSequences.find(s => s.id === timelinePlayback.sequenceId || s.id === activeTimelineSequence);

  const handlePlay = () => {
    if (activeTimelineSequence) {
      playTimelineSequence(activeTimelineSequence, {
        loop: timelinePlayback.loop,
        speed: timelinePlayback.speed
      });
    }
  };

  const handleStop = () => {
    stopTimelinePlayback();
  };

  const handleSpeedChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newSpeed = parseFloat(e.target.value);
    setTimelineSpeed(newSpeed);
  };

  if (!activeSequence && !timelinePlayback.active) {
    return null; // Don't show controls if no sequence is active
  }

  return (
    <div className={styles.timelineControls}>
      <div className={styles.header}>
        <h4>Timeline Playback</h4>
        {activeSequence && (
          <span className={styles.sequenceName}>{activeSequence.name}</span>
        )}
      </div>

      <div className={styles.controls}>
        <div className={styles.playbackButtons}>
          {!timelinePlayback.active ? (
            <button
              className={styles.playButton}
              onClick={handlePlay}
              disabled={!activeTimelineSequence}
              title="Play Timeline"
            >
              <LucideIcon name="Play" size={16} />
              Play
            </button>
          ) : (
            <button
              className={styles.stopButton}
              onClick={handleStop}
              title="Stop Timeline"
            >
              <LucideIcon name="Square" size={16} />
              Stop
            </button>
          )}
        </div>

        {timelinePlayback.active && (
          <div className={styles.speedControl}>
            <label>
              <LucideIcon name="Gauge" size={14} />
              Speed: {timelinePlayback.speed.toFixed(2)}x
            </label>
            <input
              type="range"
              min="0.1"
              max="2.0"
              step="0.1"
              value={timelinePlayback.speed}
              onChange={handleSpeedChange}
              className={styles.speedSlider}
            />
          </div>
        )}

        {timelinePlayback.active && (
          <div className={styles.progress}>
            <div className={styles.progressBar}>
              <div
                className={styles.progressFill}
                style={{ width: `${timelinePlayback.position * 100}%` }}
              />
            </div>
            <span className={styles.progressText}>
              {Math.round(timelinePlayback.position * 100)}%
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

