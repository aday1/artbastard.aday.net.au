import React, { useEffect, useState } from 'react';
import { useStore, Act, ActStep } from '../../store';
import { ActEditor } from './ActEditor';
import { TimelineActEditor } from './TimelineActEditor';
import { ActPlayer } from './ActPlayer';
import { ActSeedButton } from './ActSeedButton';
import { LucideIcon } from '../ui/LucideIcon';
import { Apc40SceneLaunchStrip } from '../midi/Apc40SceneLaunchStrip';
import { Apc40SurfaceDiagram, useApc40DiagramVisible } from '../midi/Apc40SurfaceDiagram';
import styles from './ActsPanel.module.scss';

export const ActsPanel: React.FC = () => {
  const { acts, actPlaybackState, createAct, deleteAct, playAct, pauseAct, stopAct } = useStore();
  const [selectedActId, setSelectedActId] = useState<string | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [editorView, setEditorView] = useState<'list' | 'timeline'>('timeline'); // Default to timeline
  const [newActName, setNewActName] = useState('');
  const [newActDescription, setNewActDescription] = useState('');
  const [pendingCreatedActName, setPendingCreatedActName] = useState<string | null>(null);
  const [showApc40Diagram] = useApc40DiagramVisible();

  const selectedAct = acts.find(act => act.id === selectedActId);
  const isPlaying = actPlaybackState.isPlaying && actPlaybackState.currentActId === selectedActId;

  useEffect(() => {
    if (pendingCreatedActName) {
      const createdAct = [...acts].reverse().find(act => act.name === pendingCreatedActName);
      if (createdAct) {
        setSelectedActId(createdAct.id);
        setShowEditor(true);
        setPendingCreatedActName(null);
      }
      return;
    }

    if (acts.length > 0 && (!selectedActId || !acts.some(act => act.id === selectedActId))) {
      setSelectedActId(acts[0].id);
      setShowEditor(true);
    }
  }, [acts, pendingCreatedActName, selectedActId]);

  const handleCreateAct = () => {
    if (newActName.trim()) {
      const actName = newActName.trim();
      createAct(actName, newActDescription.trim() || undefined);
      setPendingCreatedActName(actName);
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
          ACTS - Scene Timeline Builder
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

      <Apc40SceneLaunchStrip />

      {showApc40Diagram && (
        <Apc40SurfaceDiagram mode="acts" compact title="scene launch → acts" />
      )}

      <div className={styles.workflowStrip} aria-label="Acts workflow model">
        <div className={styles.workflowItem}>
          <span>Act</span>
          <strong>One song, movement, or show section</strong>
        </div>
        <div className={styles.workflowItem}>
          <span>Step</span>
          <strong>A saved scene placed on the timeline</strong>
        </div>
        <div className={styles.workflowItem}>
          <span>Trigger</span>
          <strong>Play, pause, stop, next, prev, or toggle</strong>
        </div>
        <div className={styles.workflowItem}>
          <span>Timeline</span>
          <strong>Scene steps first, advanced events when needed</strong>
        </div>
      </div>

      <div className={styles.content}>
        {/* Create New Act */}
        <div className={styles.createSection}>
          <div className={styles.sectionTitleRow}>
            <h3>Create New Act</h3>
            <ActSeedButton />
          </div>
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
                  onClick={() => {
                    setSelectedActId(act.id);
                    setShowEditor(true);
                  }}
                >
                  <div className={styles.actHeader}>
                    <h4>
                      {act.name}
                      {act.seed?.generatedBy === 'artbastard-act-seeder' && (
                        <span className={styles.seedBadge}>Seeded</span>
                      )}
                    </h4>
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
        {selectedAct && (
          <div className={styles.actRunway}>
            <div>
              <span className={styles.runwayLabel}>Selected act</span>
              <strong>{selectedAct.name}</strong>
              <small>
                {selectedAct.steps.length} step{selectedAct.steps.length === 1 ? '' : 's'} · {formatDuration(selectedAct.totalDuration)}
              </small>
            </div>
            <div>
              <span className={styles.runwayLabel}>ACT triggers</span>
              <strong>
                {selectedAct.triggers.filter(trigger => trigger.enabled).length || 0} active
              </strong>
              <small>play / pause / stop / next / prev / toggle</small>
            </div>
            <div>
              <span className={styles.runwayLabel}>Timeline events</span>
              <strong>{selectedAct.timelineEvents?.length || 0}</strong>
              <small>MIDI/OSC events live in Advanced mode</small>
            </div>
            <div className={styles.runwayActions}>
              <button
                className={styles.playNowButton}
                onClick={() => handlePlayAct(selectedAct.id)}
              >
                <LucideIcon name={isPlaying ? 'Pause' : 'Play'} />
                {isPlaying ? 'Pause Act' : 'Play Act'}
              </button>
              <button className={styles.stopNowButton} onClick={stopAct}>
                <LucideIcon name="Square" />
                Stop
              </button>
            </div>
          </div>
        )}

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
