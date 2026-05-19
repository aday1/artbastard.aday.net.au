import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useStore } from '../../store';
import { LucideIcon } from '../ui/LucideIcon';
import styles from './SceneGroupManager.module.scss';

interface SceneGroup {
  id: string;
  name: string;
  description?: string;
  scenes: Scene[];
  autoPilot: {
    enabled: boolean;
    mode: 'sequential' | 'random' | 'timeline';
    transitionDuration: number;
    holdDuration: number;
    loop: boolean;
  };
  timeline?: {
    enabled: boolean;
    totalDuration: number;
    cues: TimelineCue[];
  };
  color: string;
  createdAt: number;
  updatedAt: number;
}

interface Scene {
  id: string;
  name: string;
  description?: string;
  values: Record<number, number>;
  timestamp: number;
  duration?: number; // Duration in timeline mode
  position?: number; // Position in timeline
}

interface TimelineCue {
  id: string;
  sceneId: string;
  position: number; // Position in timeline (0-100%)
  duration: number; // Duration in ms
  transitionType: 'fade' | 'cut' | 'crossfade';
  easing: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out';
}

interface SceneGroupManagerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SceneGroupManager: React.FC<SceneGroupManagerProps> = ({
  isOpen,
  onClose
}) => {
  const {
    scenes,
    saveScene,
    loadScene,
    deleteScene,
    addNotification,
    dmxChannels,
    setDmxChannelValue
  } = useStore();

  const [sceneGroups, setSceneGroups] = useState<SceneGroup[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<SceneGroup | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentSceneIndex, setCurrentSceneIndex] = useState(0);
  const [playbackProgress, setPlaybackProgress] = useState(0);
  const [isTimelineMode, setIsTimelineMode] = useState(false);
  const [timelinePosition, setTimelinePosition] = useState(0);
  
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDescription, setNewGroupDescription] = useState('');
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  
  const playbackIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const timelineIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);

  // Load scene groups from localStorage on mount
  useEffect(() => {
    const savedGroups = localStorage.getItem('sceneGroups');
    if (savedGroups) {
      try {
        setSceneGroups(JSON.parse(savedGroups));
      } catch (error) {
        console.error('Failed to load scene groups:', error);
      }
    }
  }, []);

  // Save scene groups to localStorage when they change
  useEffect(() => {
    localStorage.setItem('sceneGroups', JSON.stringify(sceneGroups));
  }, [sceneGroups]);

  const createSceneGroup = () => {
    if (!newGroupName.trim()) return;

    const newGroup: SceneGroup = {
      id: `group_${Date.now()}`,
      name: newGroupName.trim(),
      description: newGroupDescription.trim() || undefined,
      scenes: [],
      autoPilot: {
        enabled: false,
        mode: 'sequential',
        transitionDuration: 1000,
        holdDuration: 3000,
        loop: true
      },
      color: getRandomColor(),
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    setSceneGroups(prev => [...prev, newGroup]);
    setNewGroupName('');
    setNewGroupDescription('');
    setShowCreateGroup(false);
    
    addNotification({
      message: `Scene group "${newGroup.name}" created`,
      type: 'success'
    });
  };

  const getRandomColor = (): string => {
    const colors = [
      '#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#feca57', 
      '#a55eea', '#fd79a8', '#f8b500', '#6c5ce7', '#00b894'
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  };

  const addSceneToGroup = (groupId: string, scene: any) => {
    setSceneGroups(prev => prev.map(group => {
      if (group.id === groupId) {
        const newScene: Scene = {
          id: `scene_${Date.now()}`,
          name: scene.name,
          description: scene.description,
          values: scene.values,
          timestamp: Date.now()
        };
        
        return {
          ...group,
          scenes: [...group.scenes, newScene],
          updatedAt: Date.now()
        };
      }
      return group;
    }));
  };

  const removeSceneFromGroup = (groupId: string, sceneId: string) => {
    setSceneGroups(prev => prev.map(group => {
      if (group.id === groupId) {
        return {
          ...group,
          scenes: group.scenes.filter(scene => scene.id !== sceneId),
          updatedAt: Date.now()
        };
      }
      return group;
    }));
  };

  const updateGroupAutoPilot = (groupId: string, autoPilot: Partial<SceneGroup['autoPilot']>) => {
    setSceneGroups(prev => prev.map(group => {
      if (group.id === groupId) {
        return {
          ...group,
          autoPilot: { ...group.autoPilot, ...autoPilot },
          updatedAt: Date.now()
        };
      }
      return group;
    }));
  };

  const startPlayback = () => {
    if (!selectedGroup || selectedGroup.scenes.length === 0) return;

    setIsPlaying(true);
    setCurrentSceneIndex(0);
    setPlaybackProgress(0);
    startTimeRef.current = Date.now();

    if (selectedGroup.autoPilot.mode === 'timeline' && selectedGroup.timeline?.enabled) {
      startTimelinePlayback();
    } else {
      startAutoPilotPlayback();
    }
  };

  const stopPlayback = () => {
    setIsPlaying(false);
    setPlaybackProgress(0);
    
    if (playbackIntervalRef.current) {
      clearInterval(playbackIntervalRef.current);
      playbackIntervalRef.current = null;
    }
    
    if (timelineIntervalRef.current) {
      clearInterval(timelineIntervalRef.current);
      timelineIntervalRef.current = null;
    }
  };

  const startAutoPilotPlayback = () => {
    if (!selectedGroup) return;

    const playNextScene = () => {
      if (!selectedGroup) return;

      let nextIndex: number;
      
      switch (selectedGroup.autoPilot.mode) {
        case 'random':
          nextIndex = Math.floor(Math.random() * selectedGroup.scenes.length);
          break;
        case 'sequential':
        default:
          nextIndex = (currentSceneIndex + 1) % selectedGroup.scenes.length;
          break;
      }

      // Load the scene
      const scene = selectedGroup.scenes[nextIndex];
      if (scene) {
        loadScene(scene.name);
        setCurrentSceneIndex(nextIndex);
        
        addNotification({
          message: `Playing scene: ${scene.name}`,
          type: 'info'
        });
      }

      // Schedule next scene
      if (selectedGroup.autoPilot.loop || nextIndex < selectedGroup.scenes.length - 1) {
        playbackIntervalRef.current = setTimeout(() => {
          if (isPlaying) {
            playNextScene();
          }
        }, selectedGroup.autoPilot.holdDuration);
      } else {
        stopPlayback();
      }
    };

    // Start with first scene
    if (selectedGroup.scenes.length > 0) {
      const firstScene = selectedGroup.scenes[0];
      loadScene(firstScene.name);
      setCurrentSceneIndex(0);
      
      playbackIntervalRef.current = setTimeout(() => {
        if (isPlaying) {
          playNextScene();
        }
      }, selectedGroup.autoPilot.holdDuration);
    }
  };

  const startTimelinePlayback = () => {
    if (!selectedGroup?.timeline?.enabled) return;

    const timeline = selectedGroup.timeline;
    const startTime = Date.now();
    
    timelineIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / timeline.totalDuration, 1);
      
      setTimelinePosition(progress);
      setPlaybackProgress(progress * 100);
      
      // Find current cue
      const currentCue = timeline.cues.find(cue => {
        const cueStart = cue.position * timeline.totalDuration;
        const cueEnd = cueStart + cue.duration;
        return elapsed >= cueStart && elapsed <= cueEnd;
      });
      
      if (currentCue) {
        const scene = selectedGroup.scenes.find(s => s.id === currentCue.sceneId);
        if (scene) {
          loadScene(scene.name);
        }
      }
      
      if (progress >= 1) {
        if (selectedGroup.autoPilot.loop) {
          setTimelinePosition(0);
          setPlaybackProgress(0);
          startTimeRef.current = Date.now();
        } else {
          stopPlayback();
        }
      }
    }, 50); // Update every 50ms for smooth playback
  };

  const createTimeline = (groupId: string) => {
    const group = sceneGroups.find(g => g.id === groupId);
    if (!group || group.scenes.length === 0) return;

    const totalDuration = group.scenes.length * 5000; // 5 seconds per scene default
    const cues: TimelineCue[] = group.scenes.map((scene, index) => ({
      id: `cue_${scene.id}`,
      sceneId: scene.id,
      position: index / group.scenes.length,
      duration: 5000,
      transitionType: 'fade',
      easing: 'ease-in-out'
    }));

    setSceneGroups(prev => prev.map(g => {
      if (g.id === groupId) {
        return {
          ...g,
          timeline: {
            enabled: true,
            totalDuration,
            cues
          },
          autoPilot: {
            ...g.autoPilot,
            mode: 'timeline'
          },
          updatedAt: Date.now()
        };
      }
      return g;
    }));

    setIsTimelineMode(true);
  };

  const updateTimelineCue = (groupId: string, cueId: string, updates: Partial<TimelineCue>) => {
    setSceneGroups(prev => prev.map(group => {
      if (group.id === groupId && group.timeline) {
        return {
          ...group,
          timeline: {
            ...group.timeline,
            cues: group.timeline.cues.map(cue => 
              cue.id === cueId ? { ...cue, ...updates } : cue
            )
          },
          updatedAt: Date.now()
        };
      }
      return group;
    }));
  };

  const deleteSceneGroup = (groupId: string) => {
    const group = sceneGroups.find(g => g.id === groupId);
    if (group && confirm(`Delete scene group "${group.name}"?`)) {
      setSceneGroups(prev => prev.filter(g => g.id !== groupId));
      
      if (selectedGroup?.id === groupId) {
        setSelectedGroup(null);
        stopPlayback();
      }
      
      addNotification({
        message: `Scene group "${group.name}" deleted`,
        type: 'info'
      });
    }
  };

  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.manager} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.titleSection}>
            <LucideIcon name="Layers" className={styles.titleIcon} />
            <h2>Scene Group Manager</h2>
            <div className={styles.status}>
              {isPlaying && (
                <div className={styles.playingIndicator}>
                  <LucideIcon name="Play" className={styles.playingIcon} />
                  Playing
                </div>
              )}
            </div>
          </div>
          <div className={styles.headerControls}>
            <button
              className={styles.closeButton}
              onClick={onClose}
              title="Close Manager"
            >
              <LucideIcon name="X" />
            </button>
          </div>
        </div>

        <div className={styles.content}>
          {/* Scene Groups List */}
          <div className={styles.groupsSection}>
            <div className={styles.sectionHeader}>
              <h3>Scene Groups</h3>
              <button
                className={styles.createButton}
                onClick={() => setShowCreateGroup(true)}
                title="Create New Group"
              >
                <LucideIcon name="Plus" />
                New Group
              </button>
            </div>

            {showCreateGroup && (
              <div className={styles.createGroupForm}>
                <input
                  type="text"
                  placeholder="Group name (e.g., ACT 1)"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  className={styles.groupNameInput}
                />
                <input
                  type="text"
                  placeholder="Description (optional)"
                  value={newGroupDescription}
                  onChange={(e) => setNewGroupDescription(e.target.value)}
                  className={styles.groupDescriptionInput}
                />
                <div className={styles.createFormActions}>
                  <button
                    onClick={createSceneGroup}
                    disabled={!newGroupName.trim()}
                    className={styles.createConfirmButton}
                  >
                    Create
                  </button>
                  <button
                    onClick={() => {
                      setShowCreateGroup(false);
                      setNewGroupName('');
                      setNewGroupDescription('');
                    }}
                    className={styles.createCancelButton}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            <div className={styles.groupsList}>
              {sceneGroups.map(group => (
                <div
                  key={group.id}
                  className={`${styles.groupCard} ${selectedGroup?.id === group.id ? styles.selected : ''}`}
                  onClick={() => setSelectedGroup(group)}
                >
                  <div className={styles.groupHeader}>
                    <div 
                      className={styles.groupColor}
                      style={{ backgroundColor: group.color }}
                    />
                    <div className={styles.groupInfo}>
                      <h4>{group.name}</h4>
                      {group.description && (
                        <p>{group.description}</p>
                      )}
                      <div className={styles.groupStats}>
                        {group.scenes.length} scenes
                        {group.autoPilot.enabled && (
                          <span className={styles.autoPilotBadge}>
                            <LucideIcon name="Zap" />
                            Auto-pilot
                          </span>
                        )}
                      </div>
                    </div>
                    <div className={styles.groupActions}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          createTimeline(group.id);
                        }}
                        title="Create Timeline"
                        className={styles.timelineButton}
                      >
                        <LucideIcon name="Clock" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteSceneGroup(group.id);
                        }}
                        title="Delete Group"
                        className={styles.deleteButton}
                      >
                        <LucideIcon name="Trash2" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Selected Group Details */}
          {selectedGroup && (
            <div className={styles.groupDetails}>
              <div className={styles.sectionHeader}>
                <h3>{selectedGroup.name}</h3>
              </div>

              {/* Auto-pilot Settings */}
              <div className={styles.autoPilotSection}>
                <h4>Auto-pilot Settings</h4>
                <div className={styles.autoPilotControls}>
                  <label className={styles.checkboxLabel}>
                    <input
                      type="checkbox"
                      checked={selectedGroup.autoPilot.enabled}
                      onChange={(e) => updateGroupAutoPilot(selectedGroup.id, { enabled: e.target.checked })}
                    />
                    Enable Auto-pilot
                  </label>

                  {selectedGroup.autoPilot.enabled && (
                    <>
                      <div className={styles.modeSelector}>
                        <label>Mode:</label>
                        <select
                          value={selectedGroup.autoPilot.mode}
                          onChange={(e) => updateGroupAutoPilot(selectedGroup.id, { mode: e.target.value as any })}
                          className={styles.modeSelect}
                        >
                          <option value="sequential">Sequential</option>
                          <option value="random">Random</option>
                          <option value="timeline">Timeline</option>
                        </select>
                      </div>

                      <div className={styles.durationControls}>
                        <div className={styles.durationControl}>
                          <label>Transition Duration (ms):</label>
                          <input
                            type="range"
                            min="0"
                            max="5000"
                            step="100"
                            value={selectedGroup.autoPilot.transitionDuration}
                            onChange={(e) => updateGroupAutoPilot(selectedGroup.id, { transitionDuration: parseInt(e.target.value) })}
                            className={styles.durationSlider}
                          />
                          <span>{selectedGroup.autoPilot.transitionDuration}ms</span>
                        </div>

                        <div className={styles.durationControl}>
                          <label>Hold Duration (ms):</label>
                          <input
                            type="range"
                            min="1000"
                            max="30000"
                            step="500"
                            value={selectedGroup.autoPilot.holdDuration}
                            onChange={(e) => updateGroupAutoPilot(selectedGroup.id, { holdDuration: parseInt(e.target.value) })}
                            className={styles.durationSlider}
                          />
                          <span>{selectedGroup.autoPilot.holdDuration}ms</span>
                        </div>
                      </div>

                      <label className={styles.checkboxLabel}>
                        <input
                          type="checkbox"
                          checked={selectedGroup.autoPilot.loop}
                          onChange={(e) => updateGroupAutoPilot(selectedGroup.id, { loop: e.target.checked })}
                        />
                        Loop Playback
                      </label>
                    </>
                  )}
                </div>
              </div>

              {/* Timeline Editor */}
              {selectedGroup.timeline?.enabled && (
                <div className={styles.timelineSection}>
                  <h4>Timeline Editor</h4>
                  <div className={styles.timelineContainer}>
                    <div className={styles.timelineTrack}>
                      {selectedGroup.timeline.cues.map(cue => {
                        const scene = selectedGroup.scenes.find(s => s.id === cue.sceneId);
                        return (
                          <div
                            key={cue.id}
                            className={styles.timelineCue}
                            style={{
                              left: `${cue.position * 100}%`,
                              width: `${(cue.duration / selectedGroup.timeline!.totalDuration) * 100}%`
                            }}
                            title={scene?.name}
                          >
                            <div className={styles.cueLabel}>
                              {scene?.name || 'Unknown Scene'}
                            </div>
                          </div>
                        );
                      })}
                      
                      {/* Playback Progress */}
                      {isPlaying && (
                        <div
                          className={styles.playbackProgress}
                          style={{ left: `${playbackProgress}%` }}
                        />
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Scenes List */}
              <div className={styles.scenesSection}>
                <h4>Scenes in Group</h4>
                <div className={styles.scenesList}>
                  {selectedGroup.scenes.map((scene, index) => (
                    <div
                      key={scene.id}
                      className={`${styles.sceneItem} ${index === currentSceneIndex ? styles.current : ''}`}
                    >
                      <div className={styles.sceneInfo}>
                        <div className={styles.sceneName}>{scene.name}</div>
                        {scene.description && (
                          <div className={styles.sceneDescription}>{scene.description}</div>
                        )}
                        <div className={styles.sceneStats}>
                          {Object.keys(scene.values).length} channels
                        </div>
                      </div>
                      <div className={styles.sceneActions}>
                        <button
                          onClick={() => loadScene(scene.name)}
                          className={styles.loadSceneButton}
                          title="Load Scene"
                        >
                          <LucideIcon name="Play" />
                        </button>
                        <button
                          onClick={() => removeSceneFromGroup(selectedGroup.id, scene.id)}
                          className={styles.removeSceneButton}
                          title="Remove from Group"
                        >
                          <LucideIcon name="X" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Add Scene to Group */}
                <div className={styles.addSceneSection}>
                  <h5>Add Existing Scene</h5>
                  <select
                    onChange={(e) => {
                      if (e.target.value) {
                        const scene = scenes.find(s => s.name === e.target.value);
                        if (scene) {
                          addSceneToGroup(selectedGroup.id, scene);
                          e.target.value = '';
                        }
                      }
                    }}
                    className={styles.sceneSelect}
                    defaultValue=""
                  >
                    <option value="">Select a scene to add...</option>
                    {scenes
                      .filter(scene => !selectedGroup.scenes.some(s => s.name === scene.name))
                      .map(scene => (
                        <option key={scene.name} value={scene.name}>
                          {scene.name}
                        </option>
                      ))}
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SceneGroupManager;
