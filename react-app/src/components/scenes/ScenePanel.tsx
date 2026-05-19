import React, { useState, useRef, useEffect } from 'react'
import axios from 'axios'
import { useStore } from '../../store'
import { LucideIcon } from '../ui/LucideIcon'
import styles from './ScenePanel.module.scss'

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
    saveScene,
    loadScene,
    deleteScene,
    addNotification,
    activeSceneName,
    updateActiveScene,
    setTuningScene
  } = useStore()

  const [sceneNameInput, setSceneNameInput] = useState('')
  const [isExpanded, setIsExpanded] = useState(true)
  const [isDragging, setIsDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [showTransitionControls, setShowTransitionControls] = useState(false)
  const [transitionDuration, setTransitionDuration] = useState(1000)
  const [currentSceneIndex, setCurrentSceneIndex] = useState(0)
  const [transitionEasing, setTransitionEasing] = useState('ease-in-out')
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [editingSceneName, setEditingSceneName] = useState<string | null>(null)
  const [editingChannelValues, setEditingChannelValues] = useState<number[]>([])
  const panelRef = useRef<HTMLDivElement>(null)

  const handleSaveScene = () => {
    if (sceneNameInput.trim()) {
      const oscAddress = `/scene/${sceneNameInput.trim().toLowerCase().replace(/\s+/g, '_')}`
      saveScene(sceneNameInput.trim(), oscAddress)
      addNotification({
        message: `Scene "${sceneNameInput.trim()}" saved successfully`,
        type: 'success'
      })
      setSceneNameInput('')
    }
  }

  const handleLoadScene = async (sceneName: string) => {
    const scene = scenes.find(s => s.name === sceneName)
    if (scene) {
      setIsTransitioning(true)

      try {
        // Simulate smooth transition
        await new Promise(resolve => setTimeout(resolve, transitionDuration))
        loadScene(sceneName)
        addNotification({
          message: `Scene "${scene.name}" loaded with ${transitionDuration}ms transition`,
          type: 'success'
        })
      } finally {
        setIsTransitioning(false)
      }
    }
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
                <input
                  type="range"
                  min="0"
                  max="5000"
                  step="100"
                  value={transitionDuration}
                  onChange={(e) => setTransitionDuration(parseInt(e.target.value))}
                  className={styles.transitionSlider}
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

                      {/* Inline Channel Editor */}
                      {editingSceneName === scene.name && (
                        <div style={{
                          marginTop: '12px',
                          padding: '12px',
                          backgroundColor: 'rgba(15, 23, 42, 0.6)',
                          border: '1px solid rgba(71, 85, 105, 0.5)',
                          borderRadius: '6px'
                        }}>
                          <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: '12px'
                          }}>
                            <h5 style={{ margin: 0, fontSize: '14px', color: '#e2e8f0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                              Edit Channel Values
                              {(() => {
                                const modifiedCount = editingChannelValues.filter((val, idx) => val !== scene.channelValues[idx]).length;
                                return modifiedCount > 0 ? (
                                  <span style={{
                                    padding: '2px 8px',
                                    backgroundColor: '#fbbf24',
                                    color: '#1e293b',
                                    borderRadius: '12px',
                                    fontSize: '11px',
                                    fontWeight: 'bold'
                                  }}>
                                    {modifiedCount} PENDING
                                  </span>
                                ) : null;
                              })()}
                            </h5>
                            <button
                              onClick={handleSaveEdit}
                              disabled={editingChannelValues.every((val, idx) => val === scene.channelValues[idx])}
                              style={{
                                padding: '8px 16px',
                                backgroundColor: editingChannelValues.some((val, idx) => val !== scene.channelValues[idx]) ? '#10b981' : '#6b7280',
                                color: 'white',
                                border: editingChannelValues.some((val, idx) => val !== scene.channelValues[idx]) ? '2px solid #34d399' : 'none',
                                borderRadius: '4px',
                                cursor: editingChannelValues.some((val, idx) => val !== scene.channelValues[idx]) ? 'pointer' : 'not-allowed',
                                fontSize: '13px',
                                fontWeight: 'bold',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                boxShadow: editingChannelValues.some((val, idx) => val !== scene.channelValues[idx]) ? '0 0 20px rgba(16, 185, 129, 0.5)' : 'none'
                              }}
                            >
                              <LucideIcon name="Save" size={16} />
                              {editingChannelValues.some((val, idx) => val !== scene.channelValues[idx]) ? 'SAVE CHANGES' : 'No Changes'}
                            </button>
                          </div>

                          <div style={{
                            maxHeight: '400px',
                            overflowY: 'auto',
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                            gap: '12px'
                          }}>
                            {editingChannelValues.map((value, index) => {
                              // Only show channels with non-zero values
                              if (value === 0 && scene.channelValues[index] === 0) return null;

                              return (
                                <div key={index} style={{
                                  padding: '8px',
                                  backgroundColor: 'rgba(30, 41, 59, 0.5)',
                                  borderRadius: '4px',
                                  border: '1px solid rgba(71, 85, 105, 0.3)'
                                }}>
                                  <div style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    marginBottom: '6px',
                                    fontSize: '11px',
                                    color: '#94a3b8'
                                  }}>
                                    <span>CH {index + 1}</span>
                                    <span style={{
                                      fontWeight: 'bold',
                                      color: value !== scene.channelValues[index] ? '#fbbf24' : '#e2e8f0'
                                    }}>
                                      {value}
                                    </span>
                                  </div>
                                  <input
                                    type="range"
                                    min="0"
                                    max="255"
                                    value={value}
                                    onChange={(e) => handleChannelChange(index, parseInt(e.target.value))}
                                    style={{
                                      width: '100%',
                                      accentColor: value !== scene.channelValues[index] ? '#fbbf24' : '#3b82f6'
                                    }}
                                  />
                                </div>
                              );
                            })}
                          </div>

                          <div style={{
                            marginTop: '12px',
                            padding: '8px',
                            backgroundColor: 'rgba(59, 130, 246, 0.1)',
                            borderRadius: '4px',
                            fontSize: '11px',
                            color: '#93c5fd'
                          }}>
                            💡 <strong>Tip:</strong> Modified channels are highlighted in yellow.
                            Only non-zero channels are shown.
                          </div>
                        </div>
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
