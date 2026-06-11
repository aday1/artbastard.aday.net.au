import React, { useState, useRef, useEffect } from 'react'
import axios from 'axios'
import { useStore } from '../../store'
import { LucideIcon } from '../ui/LucideIcon'
import { HorizontalFader } from '../ui/controls';
import { SceneChannelValueEditor } from './SceneChannelValueEditor';
import styles from './ScenePanel.module.scss'
import { useSceneCapture } from '../../hooks/useSceneCapture'

interface ScenePanelProps {
  isDocked?: boolean
  onToggleDocked?: () => void
  position?: { x: number; y: number }
  onPositionChange?: (position: { x: number; y: number }) => void
}

export const ScenePanel: React.FC<ScenePanelProps> = ({
  isDocked = true,
  onToggleDocked,
  position = { x: 100, y: 100 },
  onPositionChange
}) => {
  const {
    scenes,
    loadScene,
    deleteScene,
    addNotification,
    activeSceneName,
    updateActiveScene,
    setTuningScene,
    transitionDuration,
    setTransitionDuration,
    isTransitioning,
  } = useStore()

  const { captureScene, sceneNameToOscPath } = useSceneCapture()

  const [sceneNameInput, setSceneNameInput] = useState('')
  const [isExpanded, setIsExpanded] = useState(true)
  const [isDragging, setIsDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [showTransitionControls, setShowTransitionControls] = useState(false)
  const [currentSceneIndex, setCurrentSceneIndex] = useState(0)
  const [transitionEasing, setTransitionEasing] = useState('ease-in-out')
  const [editingSceneName, setEditingSceneName] = useState<string | null>(null)
  const [editingChannelValues, setEditingChannelValues] = useState<number[]>([])
  const panelRef = useRef<HTMLDivElement>(null)

  const handleSaveScene = () => {
    if (!sceneNameInput.trim()) return
    const name = sceneNameInput.trim()
    captureScene({
      name,
      oscAddress: sceneNameToOscPath(name),
      notify: true,
    })
    setSceneNameInput('')
  }

  const handleLoadScene = (sceneName: string) => {
    const scene = scenes.find((s) => s.name === sceneName)
    if (!scene) return
    loadScene(sceneName)
    addNotification({
      message: `Scene "${scene.name}" loading (${transitionDuration}ms fade)`,
      type: 'success',
    })
  }

  const handlePreviousScene = () => {
    if (scenes.length === 0) return
    const newIndex = currentSceneIndex > 0 ? currentSceneIndex - 1 : scenes.length - 1
    setCurrentSceneIndex(newIndex)
    handleLoadScene(scenes[newIndex].name)
  }

  const handleNextScene = () => {
    if (scenes.length === 0) return
    const newIndex = currentSceneIndex < scenes.length - 1 ? currentSceneIndex + 1 : 0
    setCurrentSceneIndex(newIndex)
    handleLoadScene(scenes[newIndex].name)
  }

  const handleRandomScene = () => {
    if (scenes.length === 0) return
    const randomIndex = Math.floor(Math.random() * scenes.length)
    setCurrentSceneIndex(randomIndex)
    handleLoadScene(scenes[randomIndex].name)
  }

  const handleDeleteScene = (sceneName: string) => {
    const scene = scenes.find(s => s.name === sceneName)
    if (scene && confirm(`Delete scene "${scene.name}"?`)) {
      deleteScene(sceneName)
      addNotification({
        message: `Scene "${scene.name}" deleted`,
        type: 'info'
      })
    }
  }

  const handleStartEdit = (sceneName: string) => {
    const scene = scenes.find(s => s.name === sceneName)
    if (scene) {
      setEditingSceneName(sceneName)
      setEditingChannelValues([...scene.channelValues])
    }
  }

  const handleCancelEdit = () => {
    setEditingSceneName(null)
    setEditingChannelValues([])
  }

  const handleSaveEdit = () => {
    if (editingSceneName) {
      const scene = scenes.find(s => s.name === editingSceneName)
      if (scene) {
        // Update the scene with new channel values
        const updates = { channelValues: editingChannelValues }
        // Use the store's updateScene action
        const updatedScenes = scenes.map(s =>
          s.name === editingSceneName
            ? { ...s, channelValues: editingChannelValues }
            : s
        )

        // Save to backend
        axios.post('/api/scenes', {
          name: editingSceneName,
          oscAddress: scene.oscAddress,
          channelValues: editingChannelValues
        }).then(() => {
          addNotification({
            message: `Scene "${editingSceneName}" updated successfully`,
            type: 'success'
          })
          setEditingSceneName(null)
          setEditingChannelValues([])
        }).catch(error => {
          addNotification({
            message: `Failed to update scene: ${error.message}`,
            type: 'error'
          })
        })
      }
    }
  }

  const handleChannelChange = (channelIndex: number, value: number) => {
    const newValues = [...editingChannelValues]
    newValues[channelIndex] = value
    setEditingChannelValues(newValues)
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveScene()
    }
  }

  // Dragging functionality for floating mode
  const handleMouseDown = (e: React.MouseEvent) => {
    if (isDocked || !panelRef.current) return

    const rect = panelRef.current.getBoundingClientRect()
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    })
    setIsDragging(true)
  }

  useEffect(() => {
    if (!isDragging || isDocked) return

    const handleMouseMove = (e: MouseEvent) => {
      if (onPositionChange) {
        onPositionChange({
          x: e.clientX - dragOffset.x,
          y: e.clientY - dragOffset.y
        })
      }
    }

    const handleMouseUp = () => {
      setIsDragging(false)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, isDocked, dragOffset, onPositionChange])

  const panelStyle = isDocked ? {} : {
    position: 'fixed' as const,
    left: position.x,
    top: position.y,
    zIndex: 1000
  }

  return (
    <div
      ref={panelRef}
      className={`${styles.scenePanel} ${isDocked ? styles.docked : styles.floating} ${isExpanded ? styles.expanded : ''} ${isTransitioning ? styles.transitioning : ''}`}
      style={panelStyle}
    >
      <div
        className={styles.header}
        onMouseDown={handleMouseDown}
        style={{ cursor: isDocked ? 'default' : 'move' }}
      >
        <div className={styles.titleSection}>
          <LucideIcon name="Film" className={styles.titleIcon} />
          <h3 className={styles.title}>Scene Management</h3>
          {isTransitioning && (
            <div className={styles.transitionIndicator}>
              <LucideIcon name="Loader2" className={styles.spinning} />
            </div>
          )}
        </div>
        <div className={styles.controls}>
          <button
            className={styles.transitionButton}
            onClick={() => setShowTransitionControls(!showTransitionControls)}
            title="Transition Settings"
          >
            <LucideIcon name="Timer" />
          </button>
          <button
            className={styles.expandButton}
            onClick={() => setIsExpanded(!isExpanded)}
            title={isExpanded ? 'Collapse' : 'Expand'}
          >
            <LucideIcon name={isExpanded ? "ChevronUp" : "ChevronDown"} />
          </button>
          {onToggleDocked && (
            <button
              className={styles.dockButton}
              onClick={onToggleDocked}
              title={isDocked ? 'Undock Panel' : 'Dock Panel'}
            >
              <LucideIcon name={isDocked ? "Pin" : "PinOff"} />
            </button>
          )}
        </div>
      </div>

      {isExpanded && (
        <div className={styles.content}>
          {/* Transition Controls */}
          {showTransitionControls && (
            <div className={styles.transitionControls}>
              <h4>Transition Settings</h4>
              <div className={styles.transitionRow}>
                <label>Duration (ms):</label>
                <HorizontalFader
                  min={0}
                  max={5000}
                  step={100}
                  value={transitionDuration}
                  onChange={(v) => setTransitionDuration(Math.round(v))}
                />
                <span className={styles.transitionValue}>{transitionDuration}ms</span>
              </div>
              <div className={styles.transitionRow}>
                <label>Easing:</label>
                <select
                  value={transitionEasing}
                  onChange={(e) => setTransitionEasing(e.target.value)}
                  className={styles.transitionSelect}
                >
                  <option value="ease-in-out">Ease In Out</option>
                  <option value="ease-in">Ease In</option>
                  <option value="ease-out">Ease Out</option>
                  <option value="linear">Linear</option>
                </select>
              </div>
            </div>
          )}

          {/* Scene Navigation */}
          {scenes.length > 0 && (
            <div className={styles.navigationSection}>
              <div className={styles.navigationButtons}>
                <button
                  onClick={handlePreviousScene}
                  disabled={isTransitioning}
                  className={styles.navButton}
                  title="Previous Scene"
                >
                  <LucideIcon name="ChevronLeft" />
                </button>
                <div className={styles.currentSceneInfo}>
                  <span className={styles.currentSceneName}>
                    {scenes[currentSceneIndex]?.name || 'No Scene'}
                  </span>
                  <span className={styles.sceneCounter}>
                    {currentSceneIndex + 1} / {scenes.length}
                  </span>
                </div>
                <button
                  onClick={handleNextScene}
                  disabled={isTransitioning}
                  className={styles.navButton}
                  title="Next Scene"
                >
                  <LucideIcon name="ChevronRight" />
                </button>
                <button
                  onClick={handleRandomScene}
                  disabled={isTransitioning}
                  className={styles.randomButton}
                  title="Random Scene"
                >
                  <LucideIcon name="Shuffle" />
                </button>
              </div>
            </div>
          )}

          <div className={styles.saveSection}>
            <input
              type="text"
              placeholder="Scene name..."
              value={sceneNameInput}
              onChange={(e) => setSceneNameInput(e.target.value)}
              onKeyPress={handleKeyPress}
              className={styles.sceneInput}
            />
            <button
              onClick={handleSaveScene}
              disabled={!sceneNameInput.trim()}
              className={styles.saveButton}
            >
              <LucideIcon name="Save" />
              Save Scene
            </button>
          </div>

          {activeSceneName && (
            <div style={{
              padding: '8px 12px',
              backgroundColor: 'rgba(59, 130, 246, 0.1)',
              border: '1px solid rgba(59, 130, 246, 0.3)',
              borderRadius: '4px',
              marginBottom: '12px',
              fontSize: '12px',
              color: '#93c5fd'
            }}>
              <strong>🎛️ Fine-Tuning Mode:</strong> Scene "{activeSceneName}" is loaded.
              Adjust sliders, then click "Save Changes" to update this scene.
            </div>
          )}

          <div className={styles.sceneList}>
            <h4>Saved Scenes ({scenes.length})</h4>
            {scenes.length === 0 ? (
              <p className={styles.noScenes}>No scenes saved</p>
            ) : (
              <>
                {/* Scenes Report Table */}
                <div className={styles.scenesReportTable}>
                  <table>
                    <thead>
                      <tr>
                        <th>Scene Name</th>
                        <th>Channels</th>
                        <th>OSC Address</th>
                        <th>MIDI Mapping</th>
                        <th>Timeline</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {scenes.map((scene) => {
                        const channelCount = scene.channelValues?.filter(v => v > 0).length || 0;
                        const hasTimeline = scene.timeline?.enabled || false;
                        const midiMapping = scene.midiMapping 
                          ? `${scene.midiMapping.controller !== undefined ? `CC ${scene.midiMapping.controller}` : `Note ${scene.midiMapping.note}`} (CH ${scene.midiMapping.channel + 1})`
                          : 'None';
                        
                        return (
                          <tr key={scene.name}>
                            <td>{scene.name}</td>
                            <td>{channelCount}</td>
                            <td>{scene.oscAddress || 'N/A'}</td>
                            <td>{midiMapping}</td>
                            <td>{hasTimeline ? 'Yes' : 'No'}</td>
                            <td>
                              <button
                                onClick={() => handleLoadScene(scene.name)}
                                className={styles.loadButton}
                                title="Load Scene"
                              >
                                <LucideIcon name="Play" size={14} />
                              </button>
                              <button
                                onClick={() => handleDeleteScene(scene.name)}
                                className={styles.deleteButton}
                                title="Delete Scene"
                              >
                                <LucideIcon name="Trash2" size={14} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className={styles.scenes}>
                {scenes.map((scene) => {
                  // Count active automation modules in this scene
                  const hasModularAutomation = scene.modularAutomation;
                  const activeModules = hasModularAutomation ?
                    Object.values(scene.modularAutomation).filter(module =>
                      typeof module === 'object' && module.enabled
                    ).length : 0;

                  return (
                    <div key={scene.name} className={styles.sceneItem}>
                      <div className={styles.sceneInfo}>
                        <span className={styles.sceneName}>{scene.name}</span>
                        {hasModularAutomation && activeModules > 0 && (
                          <div className={styles.automationBadge} title={`${activeModules} automation modules active`}>
                            <span className={styles.automationIcon}>⚡</span>
                            <span className={styles.automationCount}>{activeModules}</span>
                          </div>
                        )}
                        {scene.autopilots && Object.keys(scene.autopilots).length > 0 && (
                          <div className={styles.legacyAutopilotBadge} title="Legacy autopilots active">
                            <span className={styles.legacyIcon}>🔄</span>
                          </div>
                        )}
                      </div>
                      <div className={styles.sceneButtons}>
                        <button
                          onClick={() => handleLoadScene(scene.name)}
                          disabled={isTransitioning}
                          className={`${styles.loadButton} ${activeSceneName === scene.name ? styles.active : ''}`}
                          title={`Load Scene${hasModularAutomation && activeModules > 0 ? ` (${activeModules} automation modules)` : ''}`}
                        >
                          <LucideIcon name="Play" />
                          {activeSceneName === scene.name ? 'Active' : 'Load'}
                        </button>
                        {activeSceneName === scene.name && (
                          <button
                            onClick={() => {
                              updateActiveScene();
                              addNotification({
                                message: `Scene "${scene.name}" updated with current slider values`,
                                type: 'success'
                              });
                            }}
                            className={styles.fineTuneButton}
                            title="Save current slider values to this scene"
                          >
                            <LucideIcon name="Save" />
                            Save Changes
                          </button>
                        )}
                        <button
                          onClick={() => editingSceneName === scene.name ? handleCancelEdit() : handleStartEdit(scene.name)}
                          className={styles.editButton}
                          title={editingSceneName === scene.name ? "Cancel editing" : "Edit scene values inline"}
                        >
                          <LucideIcon name={editingSceneName === scene.name ? "X" : "Edit"} />
                        </button>
                        <button
                          onClick={() => handleDeleteScene(scene.name)}
                          className={styles.deleteButton}
                          title="Delete Scene"
                        >
                          <LucideIcon name="Trash2" />
                        </button>
                      </div>

                      {editingSceneName === scene.name && (
                        <SceneChannelValueEditor
                          originalValues={scene.channelValues}
                          values={editingChannelValues}
                          onChange={handleChannelChange}
                          onSave={handleSaveEdit}
                          controlIdPrefix="scene-panel"
                        />
                      )}
                    </div>
                  );
                })}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default ScenePanel
