import React from 'react';
import type { EnvelopeLoopDirection, EnvelopeRepeatMode } from '../../store';
import styles from './EnvelopeShared.module.scss';

export interface EnvelopePlaybackControlsProps {
  repeatMode: EnvelopeRepeatMode;
  loopDirection: EnvelopeLoopDirection;
  onRepeatModeChange: (mode: EnvelopeRepeatMode) => void;
  onLoopDirectionChange: (dir: EnvelopeLoopDirection) => void;
  compact?: boolean;
}

const SegmentButton: React.FC<{
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}> = ({ active, onClick, children }) => (
  <button
    type="button"
    className={`${styles.segmentBtn} ${active ? styles.segmentActive : ''}`}
    onClick={onClick}
  >
    {children}
  </button>
);

export const EnvelopePlaybackControls: React.FC<EnvelopePlaybackControlsProps> = ({
  repeatMode,
  loopDirection,
  onRepeatModeChange,
  onLoopDirectionChange,
}) => (
  <>
    <div className={styles.formRow}>
      <label>Playback</label>
      <div className={styles.segmentRow}>
        <SegmentButton active={repeatMode === 'once'} onClick={() => onRepeatModeChange('once')}>
          Once
        </SegmentButton>
        <SegmentButton active={repeatMode === 'loop'} onClick={() => onRepeatModeChange('loop')}>
          Repeat
        </SegmentButton>
      </div>
    </div>
    <div className={styles.formRow}>
      <label>Direction</label>
      <div className={styles.segmentRow}>
        <SegmentButton
          active={loopDirection === 'forward'}
          onClick={() => onLoopDirectionChange('forward')}
        >
          Forward
        </SegmentButton>
        <SegmentButton
          active={loopDirection === 'reverse'}
          onClick={() => onLoopDirectionChange('reverse')}
        >
          Reverse
        </SegmentButton>
        <SegmentButton
          active={loopDirection === 'pingpong'}
          onClick={() => onLoopDirectionChange('pingpong')}
        >
          Ping-pong
        </SegmentButton>
      </div>
    </div>
  </>
);
