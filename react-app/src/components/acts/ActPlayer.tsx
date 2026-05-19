import React, { useState, useEffect } from 'react';
import { useStore, Act, ActPlaybackState } from '../../store';
import styles from './ActPlayer.module.scss';

interface ActPlayerProps {
  act: Act;
  playbackState: ActPlaybackState;
}

export const ActPlayer: React.FC<ActPlayerProps> = ({ act, playbackState }) => {
  const { 
    nextActStep, 
    previousActStep, 
    pauseAct, 
    stopAct, 
    setActPlaybackSpeed,
    setActStepProgress 
  } = useStore();

  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(playbackState.isPlaying);

  useEffect(() => {
    setIsPlaying(playbackState.isPlaying);
  }, [playbackState.isPlaying]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (isPlaying && playbackState.currentActId === act.id) {
      interval = setInterval(() => {
        const now = Date.now();
        const elapsed = now - playbackState.stepStartTime;
        const currentStep = act.steps[playbackState.currentStepIndex];
        
        if (currentStep) {
          const stepDuration = currentStep.duration * playbackState.playbackSpeed;
          const progress = Math.min(elapsed / stepDuration, 1);
          
          setCurrentTime(elapsed);
          setActStepProgress(progress);
          
          // Auto-advance to next step
          if (progress >= 1) {
            nextActStep();
          }
        }
      }, 100);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isPlaying, playbackState, act, nextActStep, setActStepProgress]);

  const currentStep = act.steps[playbackState.currentStepIndex];
  const stepDuration = currentStep ? currentStep.duration * playbackState.playbackSpeed : 0;
  const remainingTime = Math.max(0, stepDuration - currentTime);

  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const handlePlayPause = () => {
    if (isPlaying) {
      pauseAct();
    } else {
      // Resume playback logic would go here
      setIsPlaying(true);
    }
  };

  const handleStop = () => {
    stopAct();
    setIsPlaying(false);
  };

  const handleSpeedChange = (speed: number) => {
    setActPlaybackSpeed(speed);
  };

  const handleStepClick = (stepIndex: number) => {
    // Jump to specific step logic would go here
    console.log('Jump to step:', stepIndex);
  };

  const progressPercentage = currentStep ? (playbackState.stepProgress * 100) : 0;

  return (
    <div className={styles.actPlayer}>
      <div className={styles.playerHeader}>
        <h4>
          <i className="fas fa-play-circle"></i>
          Playing: {act.name}
        </h4>
        <div className={styles.playerStatus}>
          <span className={styles.loopCount}>
            Loop: {playbackState.loopCount}
          </span>
          <span className={styles.currentStep}>
            Step {playbackState.currentStepIndex + 1} of {act.steps.length}
          </span>
        </div>
      </div>

      <div className={styles.playerContent}>
        {/* Current Step Info */}
        {currentStep && (
          <div className={styles.currentStepInfo}>
            <div className={styles.stepName}>
              <i className="fas fa-scene"></i>
              {currentStep.sceneName}
            </div>
            <div className={styles.stepTiming}>
              <div className={styles.timeDisplay}>
                <span className={styles.currentTime}>{formatTime(currentTime)}</span>
                <span className={styles.separator}>/</span>
                <span className={styles.totalTime}>{formatTime(stepDuration)}</span>
              </div>
              <div className={styles.remainingTime}>
                <i className="fas fa-clock"></i>
                {formatTime(remainingTime)} remaining
              </div>
            </div>
          </div>
        )}

        {/* Progress Bar */}
        <div className={styles.progressSection}>
          <div className={styles.progressBar}>
            <div 
              className={styles.progressFill}
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
          <div className={styles.progressLabel}>
            {progressPercentage.toFixed(1)}% complete
          </div>
        </div>

        {/* Controls */}
        <div className={styles.controls}>
          <div className={styles.playbackControls}>
            <button 
              className={styles.previousButton}
              onClick={previousActStep}
              disabled={playbackState.currentStepIndex === 0}
            >
              <i className="fas fa-step-backward"></i>
            </button>
            
            <button 
              className={`${styles.playPauseButton} ${isPlaying ? styles.playing : ''}`}
              onClick={handlePlayPause}
            >
              <i className={`fas ${isPlaying ? 'fa-pause' : 'fa-play'}`}></i>
            </button>
            
            <button 
              className={styles.nextButton}
              onClick={nextActStep}
              disabled={playbackState.currentStepIndex >= act.steps.length - 1}
            >
              <i className="fas fa-step-forward"></i>
            </button>
            
            <button 
              className={styles.stopButton}
              onClick={handleStop}
            >
              <i className="fas fa-stop"></i>
            </button>
          </div>

          <div className={styles.speedControl}>
            <label>Speed:</label>
            <input
              type="range"
              min="0.1"
              max="2.0"
              step="0.1"
              value={playbackState.playbackSpeed}
              onChange={(e) => handleSpeedChange(Number(e.target.value))}
              className={styles.speedSlider}
            />
            <span className={styles.speedValue}>
              {playbackState.playbackSpeed.toFixed(1)}x
            </span>
          </div>
        </div>

        {/* Steps Timeline */}
        <div className={styles.timeline}>
          <h5>Timeline</h5>
          <div className={styles.stepsTimeline}>
            {act.steps.map((step, index) => (
              <div 
                key={step.id}
                className={`${styles.timelineStep} ${
                  index === playbackState.currentStepIndex ? styles.current : ''
                } ${index < playbackState.currentStepIndex ? styles.completed : ''}`}
                onClick={() => handleStepClick(index)}
              >
                <div className={styles.timelineStepNumber}>
                  {index + 1}
                </div>
                <div className={styles.timelineStepInfo}>
                  <div className={styles.timelineStepName}>
                    {step.sceneName}
                  </div>
                  <div className={styles.timelineStepDuration}>
                    {formatTime(step.duration)}
                  </div>
                </div>
                {index === playbackState.currentStepIndex && (
                  <div className={styles.timelineProgress}>
                    <div 
                      className={styles.timelineProgressFill}
                      style={{ width: `${progressPercentage}%` }}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Loop Mode Info */}
        <div className={styles.loopInfo}>
          <i className="fas fa-sync"></i>
          <span>Loop Mode: {act.loopMode}</span>
          {act.loopMode === 'loop' && (
            <span className={styles.loopIndicator}>
              Will restart from step 1
            </span>
          )}
          {act.loopMode === 'ping-pong' && (
            <span className={styles.loopIndicator}>
              Will reverse direction
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
