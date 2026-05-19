import React, { Suspense, lazy, useState } from 'react'
import axios from 'axios'
import { useStore, SceneTimeline } from '../../store'
import { useTheme } from '../../context/ThemeContext'
import { MidiLearnButton } from '../midi/MidiLearnButton'
const SceneTimelineEditor = lazy(() =>
  import('./SceneTimelineEditor').then((m) => ({ default: m.SceneTimelineEditor }))
)
import { LucideIcon } from '../ui/LucideIcon'
import { HorizontalFader } from '../ui/controls';
import { SceneChannelValueEditor } from './SceneChannelValueEditor';
import styles from './SceneGallery.module.scss'
import { useSceneCapture } from '../../hooks/useSceneCapture'

export const SceneGallery: React.FC = () => {
  const { theme } = useTheme()
  const {
    scenes,
    dmxChannels,
    channelNames,
    loadScene,
    deleteScene,
    updateScene,
    autoSceneList,
    setAutoSceneList,
    autoSceneEnabled,
    transitionDuration,
    setTransitionDuration,
  } = useStore(state => ({
    scenes: state.scenes,
    dmxChannels: state.dmxChannels,
    channelNames: state.channelNames,
    loadScene: state.loadScene,
    deleteScene: state.deleteScene,
    updateScene: state.updateScene,
    autoSceneList: state.autoSceneList,
    setAutoSceneList: state.setAutoSceneList,
    autoSceneEnabled: state.autoSceneEnabled,
    transitionDuration: state.transitionDuration,
    setTransitionDuration: state.setTransitionDuration,
  }))
  const [newSceneName, setNewSceneName] = useState('')
  const [newSceneOsc, setNewSceneOsc] = useState('/scene/new')
  const [activeSceneId, setActiveSceneId] = useState<string | null>(null)
  const transitionTimeSec = transitionDuration / 1000
  const [editingScene, setEditingScene] = useState<string | null>(null)
  const [editOscAddress, setEditOscAddress] = useState('')
  const [editSceneName, setEditSceneName] = useState('')
  const [editingChannelValues, setEditingChannelValues] = useState<string | null>(null)
  const [channelValues, setChannelValues] = useState<number[]>([])
  const [editingTimelineScene, setEditingTimelineScene] = useState<string | null>(null)
  const { captureScene, quickCapture, sceneNameToOscPath } = useSceneCapture()

  const handleSaveNewScene = () => {
    if (!newSceneName.trim()) {
      useStore.getState().addNotification({
        message: 'Scene name cannot be empty',
        type: 'error',
        priority: 'high'
      })
      return
    }

    const saved = captureScene({
      name: newSceneName.trim(),
      oscAddress: newSceneOsc.trim() || sceneNameToOscPath(newSceneName),
      notify: true,
    })
    if (!saved) return

    setNewSceneName('')
    setNewSceneOsc('/scene/new')
  }

  // Start editing a scene
  const startEditingScene = (scene: any) => {
    setEditingScene(scene.name)
    setEditOscAddress(scene.oscAddress)
    setEditSceneName(scene.name)
  }

  // Cancel editing
  const cancelEditing = () => {
    setEditingScene(null)
    setEditOscAddress('')
    setEditSceneName('')
  }

  // Save scene edits
  const saveSceneEdits = () => {
    if (!editingScene) return

    if (!editSceneName.trim()) {
      useStore.getState().addNotification({
        message: 'Scene name cannot be empty',
        type: 'error',
        priority: 'high'
      })
      return
    }

    if (!editOscAddress.trim()) {
      useStore.getState().addNotification({
        message: 'OSC address cannot be empty',
        type: 'error',
        priority: 'high'
      })
      return
    }

    // Check if name already exists (unless it's the same name)
    if (editSceneName !== editingScene && scenes.some(s => s.name === editSceneName)) {
      useStore.getState().addNotification({
        message: `Scene name "${editSceneName}" already exists`,
        type: 'error',
        priority: 'high'
      })
      return
    }

    const updates: any = {}
    const originalScene = scenes.find(s => s.name === editingScene)

    if (editSceneName !== editingScene) {
      updates.name = editSceneName
    }

    if (editOscAddress !== originalScene?.oscAddress) {
      updates.oscAddress = editOscAddress
    }

    if (Object.keys(updates).length > 0) {
      updateScene(editingScene, updates)

      // Update active scene ID if it was the edited scene
      if (activeSceneId === editingScene && updates.name) {
        setActiveSceneId(updates.name)
      }

      useStore.getState().addNotification({
        message: `Scene "${editSceneName}" updated successfully`,
        type: 'success',
        priority: 'normal'
      })
    }

    cancelEditing()
  }

  // Start editing channel values
  const startEditingChannelValues = (sceneName: string) => {
    const scene = scenes.find(s => s.name === sceneName)
    if (scene) {
      setEditingChannelValues(sceneName)
      setChannelValues([...scene.channelValues])
    }
  }

  // Cancel channel editing
  const cancelChannelEditing = () => {
    setEditingChannelValues(null)
    setChannelValues([])
  }

  // Update a channel value
  const handleChannelChange = (index: number, value: number) => {
    const newValues = [...channelValues]
    newValues[index] = value
    setChannelValues(newValues)
  }

  // Save edited channel values
  const saveChannelEdits = () => {
    if (!editingChannelValues) return

    const scene = scenes.find(s => s.name === editingChannelValues)
    if (!scene) return

    axios.post('/api/scenes', {
      name: editingChannelValues,
      oscAddress: scene.oscAddress,
      channelValues: channelValues
    }).then(() => {
      useStore.getState().addNotification({
        message: `Scene "${editingChannelValues}" channel values updated`,
        type: 'success'
      })
      cancelChannelEditing()
    }).catch(error => {
      useStore.getState().addNotification({
        message: `Failed to update scene: ${error.message}`,
        type: 'error'
      })
    })
  }

  // Calculate the number of active channels in a scene
  const getActiveChannelCount = (channelValues: number[] | undefined) => {
    if (!channelValues) return 0
    return channelValues.filter(v => v > 0).length
  }

  // Auto-scene management functions
  const isSceneInAutoList = (sceneName: string) => {
    return autoSceneList.includes(sceneName)
  }

  const toggleSceneInAutoList = (sceneName: string) => {
    const newAutoSceneList = isSceneInAutoList(sceneName)
      ? autoSceneList.filter(name => name !== sceneName)
      : [...autoSceneList, sceneName]

    setAutoSceneList(newAutoSceneList)

    useStore.getState().addNotification({
      message: isSceneInAutoList(sceneName)
        ? `Scene "${sceneName}" removed from auto-play list`
        : `Scene "${sceneName}" added to auto-play list`,
      type: 'success',
      priority: 'normal'
    })
  }

  const addAllScenesToAutoList = () => {
    const allSceneNames = scenes.map(scene => scene.name)
    setAutoSceneList(allSceneNames)

    useStore.getState().addNotification({
      message: `All ${scenes.length} scenes added to auto-play list`,
      type: 'success',
      priority: 'normal'
    })
  }

  const clearAutoSceneList = () => {
    setAutoSceneList([])

    useStore.getState().addNotification({
      message: 'Auto-play list cleared',
      type: 'info',
      priority: 'normal'
    })
  }

  // Format time for display
  const formatTime = (seconds: number) => {
    if (seconds < 60) {
      return `${seconds.toFixed(1)}s`
    } else {
      const mins = Math.floor(seconds / 60)
      const secs = seconds % 60
      return `${mins}m ${secs.toFixed(0)}s`
    }
  }

  return (
    <div className={styles.sceneGallery}>
      <h2 className={styles.sectionTitle}>
        {theme === 'artsnob' && 'Scene Gallery: The Exhibition of Light'}
        {theme === 'standard' && 'Scenes'}
        {theme === 'minimal' && 'Scenes'}
      </h2>

      {/* Scene creation form */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <h3>
            {theme === 'artsnob' && 'Create New Scene: Choreography of Light'}
            {theme === 'standard' && 'New Scene'}
            {theme === 'minimal' && 'New Scene'}
          </h3>
        </div>
        <div className={styles.cardBody}>
          <div className={styles.formGroup}>
            <label htmlFor="sceneName">
              {theme === 'artsnob' && 'Title of Masterpiece:'}
              {theme === 'standard' && 'Scene Name:'}
              {theme === 'minimal' && 'Name:'}
            </label>
            <input
              type="text"
              id="sceneName"
              value={newSceneName}
              onChange={(e) => setNewSceneName(e.target.value)}
              placeholder={
                theme === 'artsnob'
                  ? 'Bestow a title upon your luminous creation...'
                  : 'Enter scene name'
              }
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="sceneOsc">OSC Address:</label>
            <input
              type="text"
              id="sceneOsc"
              value={newSceneOsc}
              onChange={(e) => setNewSceneOsc(e.target.value)}
              placeholder="/scene/name"
            />
          </div>

          <div className={styles.scenePreview}>
            <div className={styles.previewHeader}>
              <h4>Current DMX State Preview</h4>
              <span className={styles.channelCount}>
                {getActiveChannelCount(dmxChannels)} active channels
              </span>
            </div>
            <div className={styles.channelPreview}>
              {dmxChannels?.map((value, index) =>
                value > 0 ? (
                  <div
                    key={index}
                    className={styles.activeChannel}
                    style={{ opacity: value / 255 }}
                    title={`Channel ${index + 1}: ${value}`}
                  >
                    {index + 1}
                  </div>
                ) : null
              )}
            </div>
          </div>
          <div className={styles.buttonGroup}>
            <button
              className={styles.saveButton}
              onClick={handleSaveNewScene}
              disabled={!newSceneName.trim()}
            >
              <i className="fas fa-save"></i>
              {theme === 'artsnob' && 'Immortalize Scene'}
              {theme === 'standard' && 'Save Scene'}
              {theme === 'minimal' && 'Save'}
            </button>

            <button
              className={styles.quickSaveButton}
              onClick={() => quickCapture()}
              title="Quick save current DMX state with timestamp"
            >
              <i className="fas fa-bolt"></i>
              {theme === 'artsnob' && 'Quick Capture'}
              {theme === 'standard' && 'Quick Save'}
              {theme === 'minimal' && 'Quick Save'}
            </button>
          </div>
        </div>
      </div>

      {/* Scene transition controls */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <h3>
            {theme === 'artsnob' && 'Transition: The Temporal Canvas'}
            {theme === 'standard' && 'Transition Controls'}
            {theme === 'minimal' && 'Transition'}
          </h3>
        </div>
        <div className={styles.cardBody}>
          <div className={styles.transitionControls}>
            <div className={styles.transitionTime}>
              <label htmlFor="transitionTime">
                {theme === 'artsnob' && 'Temporal Flow:'}
                {theme === 'standard' && 'Transition Time:'}
                {theme === 'minimal' && 'Time:'}
              </label>
              <div className={styles.timeControl}>
                <div className={styles.timeFader}>
                  <HorizontalFader
                    min={0}
                    max={60}
                    step={0.1}
                    value={transitionTimeSec}
                    onChange={(v) => setTransitionDuration(Math.round(v * 1000))}
                  />
                </div>
                <span className={styles.timeDisplay}>{formatTime(transitionTimeSec)}</span>
              </div>
            </div>

            <div className={styles.transitionHelp}>
              <p>
                {theme === 'artsnob' && 'Set the duration of the temporal journey between states of luminescence.'}
                {theme === 'standard' && 'Set the time to fade between scenes when loading.'}
                {theme === 'minimal' && 'Fade time between scenes.'}
              </p>
            </div>
          </div>
        </div>
      </div>
      {/* Auto Scene Management Controls */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <h3>
            {theme === 'artsnob' && 'Auto Scene: The Choreographed Symphony'}
            {theme === 'standard' && 'Auto Scene Management'}
            {theme === 'minimal' && 'Auto Scenes'}
          </h3>
        </div>
        <div className={styles.cardBody}>
          <div className={styles.autoSceneInfo}>
            <p>
              {autoSceneList.length === 0 ? (
                <>
                  {theme === 'artsnob' && 'No scenes enlisted in the automated dance. Select scenes below to begin the choreography.'}
                  {theme === 'standard' && 'No scenes in auto-play list. Add scenes below to enable auto-play.'}
                  {theme === 'minimal' && 'No auto scenes selected.'}
                </>
              ) : (
                <>
                  {theme === 'artsnob' && `${autoSceneList.length} luminous compositions await their automated performance.`}
                  {theme === 'standard' && `${autoSceneList.length} scenes in auto-play list${autoSceneEnabled ? ' (Active)' : ' (Inactive)'}.`}
                  {theme === 'minimal' && `${autoSceneList.length} scenes selected${autoSceneEnabled ? ' (Active)' : ''}.`}
                </>
              )}
            </p>
          </div>

          <div className={styles.autoSceneBulkControls}>
            <button
              className={styles.bulkAddButton}
              onClick={addAllScenesToAutoList}
              disabled={scenes.length === 0}
              title="Add all scenes to auto-play list"
            >
              <i className="fas fa-plus-circle"></i>
              {theme === 'artsnob' && 'Enlist All'}
              {theme === 'standard' && 'Add All'}
              {theme === 'minimal' && 'Add All'}
            </button>

            <button
              className={styles.bulkClearButton}
              onClick={clearAutoSceneList}
              disabled={autoSceneList.length === 0}
              title="Clear auto-play list"
            >
              <i className="fas fa-times-circle"></i>
              {theme === 'artsnob' && 'Dismiss All'}
              {theme === 'standard' && 'Clear All'}
              {theme === 'minimal' && 'Clear'}
            </button>
          </div>

          {autoSceneList.length > 0 && (
            <div className={styles.autoSceneList}>
              <h4>
                {theme === 'artsnob' && 'The Enlisted Compositions:'}
                {theme === 'standard' && 'Auto-Play Queue:'}
                {theme === 'minimal' && 'Queue:'}
              </h4>
              <div className={styles.autoSceneItems}>
                {autoSceneList.map((sceneName, index) => (
                  <div key={sceneName} className={styles.autoSceneItem}>
                    <span className={styles.autoSceneIndex}>{index + 1}</span>
                    <span className={styles.autoSceneName}>{sceneName}</span>
                    <button
                      className={styles.removeFromAutoButton}
                      onClick={() => toggleSceneInAutoList(sceneName)}
                      title="Remove from auto-play"
                    >
                      <i className="fas fa-times"></i>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Scenes list */}
      <h3 className={styles.galleryTitle}>
        {theme === 'artsnob' && 'The Gallery: Luminous Compositions'}
        {theme === 'standard' && 'Saved Scenes'}
        {theme === 'minimal' && 'Scenes'}
      </h3>

      {scenes.length === 0 ? (
        <div className={styles.emptyGallery}>
          <i className="fas fa-theater-masks"></i>
          <p>Your gallery awaits illumination. Create your first scene to begin.</p>
        </div>
      ) : (
        <div className={styles.scenesGrid}>          {scenes.map((scene, index) => (
          <div
            key={index}
            className={`${styles.sceneCard} ${activeSceneId === scene.name ? styles.active : ''} ${isSceneInAutoList(scene.name) ? styles.inAutoList : ''}`}
          >
            {/* Auto Scene Indicator */}
            <div className={styles.autoSceneIndicator}>
              {isSceneInAutoList(scene.name) && (
                <div className={styles.autoSceneBadge} title="In auto-play list">
                  <i className="fas fa-magic"></i>
                </div>
              )}
              {scene.timeline?.enabled && (
                <div className={styles.timelineBadge} title="Timeline enabled - animated scene">
                  <LucideIcon name="Clock" />
                </div>
              )}
            </div>

            <div className={styles.sceneHeader}>
              {editingScene === scene.name ? (
                <div className={styles.editingHeader}>
                  <input
                    type="text"
                    value={editSceneName}
                    onChange={(e) => setEditSceneName(e.target.value)}
                    className={styles.editNameInput}
                    placeholder="Scene name"
                  />
                  <div className={styles.editControls}>
                    <button
                      className={styles.saveEditButton}
                      onClick={saveSceneEdits}
                      title="Save changes"
                    >
                      <i className="fas fa-check"></i>
                      <span>Save</span>
                    </button>
                    <button
                      className={styles.cancelEditButton}
                      onClick={cancelEditing}
                      title="Cancel editing"
                    >
                      <i className="fas fa-times"></i>
                      <span>Cancel</span>
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <h4>{scene.name}</h4>
                  <div className={styles.sceneControls}>
                    <button
                      className={`${styles.autoToggleButton} ${isSceneInAutoList(scene.name) ? styles.inAutoPlay : ''}`}
                      onClick={() => toggleSceneInAutoList(scene.name)}
                      title={isSceneInAutoList(scene.name) ? 'Remove from auto-play' : 'Add to auto-play'}
                    >
                      <i className="fas fa-magic"></i>
                    </button>
                    <button
                      className={styles.timelineButton}
                      onClick={() => setEditingTimelineScene(scene.name)}
                      title="Edit Timeline"
                    >
                      <LucideIcon name="Clock" />
                    </button>
                    <button
                      className={styles.editButton}
                      onClick={() => startEditingScene(scene)}
                      title="Edit Scene Name & OSC"
                    >
                      <i className="fas fa-edit"></i>
                    </button>
                    <button
                      className={styles.editValuesButton}
                      onClick={() => editingChannelValues === scene.name ? cancelChannelEditing() : startEditingChannelValues(scene.name)}
                      title={editingChannelValues === scene.name ? "Cancel editing values" : "Edit Channel Values"}
                      style={{
                        backgroundColor: editingChannelValues === scene.name ? '#ef4444' : undefined
                      }}
                    >
                      <i className={editingChannelValues === scene.name ? "fas fa-times" : "fas fa-sliders-h"}></i>
                    </button>
                    <button
                      className={styles.loadButton}
                      onClick={() => {
                        loadScene(scene.name)
                        setActiveSceneId(scene.name)
                      }}
                      title="Load Scene"
                    >
                      <i className="fas fa-play"></i>
                    </button>
                    <button
                      className={styles.deleteButton}
                      onClick={() => {
                        if (window.confirm(`Are you sure you want to delete scene "${scene.name}"?`)) {
                          deleteScene(scene.name)
                          if (activeSceneId === scene.name) {
                            setActiveSceneId(null)
                          }
                        }
                      }}
                      title="Delete Scene"
                    >
                      <i className="fas fa-trash-alt"></i>
                    </button>
                  </div>
                </>
              )}
            </div>
            <div className={styles.sceneInfo}>
              <div className={styles.sceneProperty}>
                <span className={styles.propertyLabel}>OSC:</span>
                {editingScene === scene.name ? (
                  <input
                    type="text"
                    value={editOscAddress}
                    onChange={(e) => setEditOscAddress(e.target.value)}
                    className={styles.editOscInput}
                    placeholder="/scene/address"
                  />
                ) : (
                  <span className={styles.propertyValue}>{scene.oscAddress}</span>
                )}
              </div>

              <div className={styles.sceneProperty}>
                <span className={styles.propertyLabel}>Channels:</span>
                <span className={styles.propertyValue}>
                  {getActiveChannelCount(scene.channelValues)} active
                </span>
              </div>
            </div>

            <div className={styles.sceneMidiMapping}>
              <MidiLearnButton
                channelIndex={index}
                className={styles.sceneMidiButton}
              />
            </div>

            <div className={styles.sceneVisualizer}>
              {scene.channelValues.map((value, chIndex) =>
                value > 0 ? (
                  <div
                    key={chIndex}
                    className={styles.channelIndicator}
                    style={{
                      opacity: value / 255,
                      backgroundColor: getChannelColor(chIndex, value)
                    }}
                    title={`Channel ${chIndex + 1}: ${value}`}
                  />
                ) : null
              )}
            </div>
            
            {/* Channel Values Table */}
            {scene.channelValues && scene.channelValues.filter(v => v > 0).length > 0 && (
              <div className={styles.channelValuesTable}>
                <div className={styles.tableHeader}>
                  <span>Channel</span>
                  <span>Value</span>
                </div>
                <div className={styles.tableBody}>
                  {scene.channelValues.map((value, chIndex) =>
                    value > 0 ? (
                      <div key={chIndex} className={styles.tableRow}>
                        <span className={styles.channelNumber}>
                          {channelNames[chIndex] && channelNames[chIndex] !== `CH ${chIndex + 1}` && channelNames[chIndex] !== `Channel ${chIndex + 1}`
                            ? channelNames[chIndex]
                            : `CH ${chIndex + 1}`
                          }
                        </span>
                        <span className={styles.channelValue}>{value}</span>
                      </div>
                    ) : null
                  )}
                </div>
              </div>
            )}

            {editingChannelValues === scene.name && (
              <SceneChannelValueEditor
                originalValues={scene.channelValues}
                values={channelValues}
                onChange={handleChannelChange}
                onSave={saveChannelEdits}
                channelNames={channelNames}
                controlIdPrefix="scene-gallery"
              />
            )}
          </div>
        ))}
        </div>
      )}

      {/* Scene Timeline Editor */}
      {editingTimelineScene && (() => {
        const scene = scenes.find(s => s.name === editingTimelineScene);
        if (!scene) return null;

        return (
          <Suspense fallback={null}>
            <SceneTimelineEditor
              scene={scene}
              onClose={() => setEditingTimelineScene(null)}
              onSave={(timeline: SceneTimeline) => {
                updateScene(scene.name, { timeline });
                setEditingTimelineScene(null);
                useStore.getState().addNotification({
                  message: `Timeline saved for scene "${scene.name}"`,
                  type: 'success',
                  priority: 'normal'
                });
              }}
            />
          </Suspense>
        );
      })()}
    </div>
  )
}

// Helper function to generate colors for channel indicators
function getChannelColor(channelIndex: number, value: number): string {
  // Use a different hue based on channel index
  const hue = (channelIndex * 20) % 360
  return `hsl(${hue}, 80%, ${20 + (value / 255) * 60}%)`
}