import React, { useState } from 'react';
import { useStore, Act, ActStep } from '../../store';
import { ActEditor } from './ActEditor';
import { TimelineActEditor } from './TimelineActEditor';
import { ActPlayer } from './ActPlayer';
import { LucideIcon } from '../ui/LucideIcon';
import styles from './ActsPanel.module.scss';

export const ActsPanel: React.FC = () => {
  const { acts, actPlaybackState, createAct, deleteAct, playAct, pauseAct, stopAct } = useStore();
  const [selectedActId, setSelectedActId] = useState<string | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [editorView, setEditorView] = useState<'list' | 'timeline'>('timeline'); // Default to timeline
  const [newActName, setNewActName] = useState('');
  const [newActDescription, setNewActDescription] = useState('');

  const selectedAct = acts.find(act => act.id === selectedActId);
  const isPlaying = actPlaybackState.isPlaying && actPlaybackState.currentActId === selectedActId;

  const handleCreateAct = () => {
    if (newActName.trim()) {
      createAct(newActName.trim(), newActDescription.trim() || undefined);
      setNewActName('');
      setNewActDescription('');
    }
  };

  const handleDeleteAct = (actId: string) => {
    if (window.confirm('Are you sure you want to delete this act? This cannot be undone.')) {
      deleteAct(actId);
      if (selectedActId === actId) {
        setSelectedActId(null);
        setShowEditor(false);
      }
    }
  };

  const handlePlayAct = (actId: string) => {
    if (isPlaying) {
      pauseAct();
    } else {
      playAct(actId);
    }
  };

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className={styles.actsPanel}>
      <div className={styles.header}>
        <h2>
          <i className="fas fa-theater-masks"></i>
          ACTS - Automated Scene Transition Sequences
        </h2>
        <div className={styles.headerActions}>
          <button 
            className={styles.stopButton}
            onClick={stopAct}
            disabled={!actPlaybackState.isPlaying}
          >
            <i className="fas fa-stop"></i>
            Stop All
          </button>
        </div>
      </div>

      <div className={styles.content}>
        {/* Create New Act */}
        <div className={styles.createSection}>
          <h3>Create New Act</h3>
          <div className={styles.createForm}>
            <input
              type="text"
              placeholder="Act name..."
              value={newActName}
              onChange={(e) => setNewActName(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleCreateAct()}
            />
            <input
              type="text"
              placeholder="Description (optional)..."
              value={newActDescription}
              onChange={(e) => setNewActDescription(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleCreateAct()}
            />
            <button 
              className={styles.createButton}
              onClick={handleCreateAct}
              disabled={!newActName.trim()}
            >
              <i className="fas fa-plus"></i>
              Create Act
            </button>
          </div>
        </div>

        {/* Acts List */}
        <div className={styles.actsList}>
          <h3>Acts ({acts.length})</h3>
          {acts.length === 0 ? (
            <div className={styles.emptyState}>
              <i className="fas fa-theater-masks"></i>
              <p>No acts created yet</p>
              <p>Create your first act to start building automated sequences</p>
            </div>
          ) : (
            <div className={styles.actsGrid}>
              {acts.map(act => (
                <div 
                  key={act.id} 
                  className={`${styles.actCard} ${selectedActId === act.id ? styles.selected : ''}`}
                  onClick={() => setSelectedActId(act.id)}
                >
                  <div className={styles.actHeader}>
                    <h4>{act.name}</h4>
                    <div className={styles.actActions}>
                      <button
                        className={styles.editButton}
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowEditor(true);
                        }}
                      >
                        <i className="fas fa-edit"></i>
                      </button>
                      <button
                        className={styles.deleteButton}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteAct(act.id);
                        }}
                      >
                        <i className="fas fa-trash"></i>
                      </button>
                    </div>
                  </div>
                  
                  {act.description && (
                    <p className={styles.actDescription}>{act.description}</p>
                  )}
                  
                  <div className={styles.actStats}>
                    <div className={styles.stat}>
                      <i className="fas fa-list"></i>
                      <span>{act.steps.length} steps</span>
                    </div>
                    <div className={styles.stat}>
                      <i className="fas fa-clock"></i>
                      <span>{formatDuration(act.totalDuration)}</span>
                    </div>
                    <div className={styles.stat}>
                      <i className="fas fa-sync"></i>
                      <span>{act.loopMode}</span>
                    </div>
                  </div>

                  {act.steps.length > 0 && (
                    <div className={styles.stepsPreview}>
                      <div className={styles.stepsList}>
                        {act.steps.slice(0, 3).map((step, index) => (
                          <div key={step.id} className={styles.stepPreview}>
                            <span className={styles.stepNumber}>{index + 1}</span>
                            <span className={styles.stepScene}>{step.sceneName}</span>
                            <span className={styles.stepDuration}>{formatDuration(step.duration)}</span>
                          </div>
                        ))}
                        {act.steps.length > 3 && (
                          <div className={styles.moreSteps}>
                            +{act.steps.length - 3} more steps
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Act Editor */}
        {selectedAct && showEditor && (
          <div className={styles.editorContainer}>
            <div className={styles.editorViewToggle}>
              <button
                className={`${styles.viewToggleButton} ${editorView === 'list' ? styles.active : ''}`}
                onClick={() => setEditorView('list')}
                title="List View"
              >
                <LucideIcon name="List" />
                List View
              </button>
              <button
                className={`${styles.viewToggleButton} ${editorView === 'timeline' ? styles.active : ''}`}
                onClick={() => setEditorView('timeline')}
                title="Timeline View"
              >
                <LucideIcon name="Clock" />
                Timeline View
              </button>
            </div>
            {editorView === 'list' ? (
              <ActEditor
                act={selectedAct}
                onClose={() => setShowEditor(false)}
              />
            ) : (
              <TimelineActEditor
                act={selectedAct}
                onClose={() => setShowEditor(false)}
              />
            )}
          </div>
        )}

        {/* Act Player */}
        {selectedAct && actPlaybackState.currentActId === selectedAct.id && (
          <ActPlayer
            act={selectedAct}
            playbackState={actPlaybackState}
          />
        )}
      </div>
    </div>
  );
};
