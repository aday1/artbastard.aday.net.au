import React, { useState, useEffect } from 'react';
import { useStore, Act, ActStep } from '../../store';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import styles from './ActEditor.module.scss';

interface ActEditorProps {
  act: Act;
  onClose: () => void;
}

export const ActEditor: React.FC<ActEditorProps> = ({ act, onClose }) => {
  const { 
    scenes, 
    groups, 
    updateAct, 
    addActStep, 
    updateActStep, 
    removeActStep, 
    reorderActSteps,
    addActTrigger,
    updateActTrigger,
    removeActTrigger
  } = useStore();

  const [actName, setActName] = useState(act.name);
  const [actDescription, setActDescription] = useState(act.description || '');
  const [loopMode, setLoopMode] = useState(act.loopMode);
  const [showAddStep, setShowAddStep] = useState(false);
  const [editingStepId, setEditingStepId] = useState<string | null>(null);
  const [showTriggers, setShowTriggers] = useState(false);
  const [showAddTrigger, setShowAddTrigger] = useState(false);

  // New step form
  const [newStepScene, setNewStepScene] = useState('');
  const [newStepDuration, setNewStepDuration] = useState(5000);
  const [newStepTransitionDuration, setNewStepTransitionDuration] = useState(1000);
  const [newStepNotes, setNewStepNotes] = useState('');
  const [newStepAutopilotEnabled, setNewStepAutopilotEnabled] = useState(false);
  const [newStepAutopilotGroups, setNewStepAutopilotGroups] = useState<Array<{
    groupId: string;
    autopilotType: 'color' | 'dimmer' | 'panTilt' | 'custom';
    intensity: number;
    speed: number;
    pattern?: 'wave' | 'random' | 'chase' | 'pulse';
  }>>([]);

  // New trigger form
  const [newTriggerType, setNewTriggerType] = useState<'osc' | 'midi'>('osc');
  const [newTriggerAddress, setNewTriggerAddress] = useState('');
  const [newTriggerMidiNote, setNewTriggerMidiNote] = useState(60);
  const [newTriggerMidiChannel, setNewTriggerMidiChannel] = useState(1);
  const [newTriggerAction, setNewTriggerAction] = useState<'play' | 'pause' | 'stop' | 'next' | 'previous' | 'toggle'>('play');

  useEffect(() => {
    setActName(act.name);
    setActDescription(act.description || '');
    setLoopMode(act.loopMode);
  }, [act]);

  const handleSaveAct = () => {
    updateAct(act.id, {
      name: actName,
      description: actDescription,
      loopMode: loopMode
    });
  };

  const handleAddStep = () => {
    if (newStepScene && newStepDuration > 0) {
      addActStep(act.id, {
        sceneName: newStepScene,
        duration: newStepDuration,
        transitionDuration: newStepTransitionDuration,
        notes: newStepNotes || undefined,
        autopilotSettings: newStepAutopilotEnabled ? {
          enabled: true,
          groups: newStepAutopilotGroups
        } : undefined
      });
      
      // Reset form
      setNewStepScene('');
      setNewStepDuration(5000);
      setNewStepTransitionDuration(1000);
      setNewStepNotes('');
      setNewStepAutopilotEnabled(false);
      setNewStepAutopilotGroups([]);
      setShowAddStep(false);
    }
  };

  const handleUpdateStep = (stepId: string, updates: Partial<ActStep>) => {
    updateActStep(act.id, stepId, updates);
    setEditingStepId(null);
  };

  const handleRemoveStep = (stepId: string) => {
    if (window.confirm('Are you sure you want to remove this step?')) {
      removeActStep(act.id, stepId);
    }
  };

  const handleDragEnd = (result: any) => {
    if (!result.destination) return;
    
    const stepIds = act.steps.map(step => step.id);
    const [reorderedId] = stepIds.splice(result.source.index, 1);
    stepIds.splice(result.destination.index, 0, reorderedId);
    
    reorderActSteps(act.id, stepIds);
  };

  const handleAddTrigger = () => {
    if (newTriggerType === 'osc' && !newTriggerAddress) return;
    if (newTriggerType === 'midi' && !newTriggerMidiNote) return;

    addActTrigger(act.id, {
      type: newTriggerType,
      address: newTriggerType === 'osc' ? newTriggerAddress : undefined,
      midiNote: newTriggerType === 'midi' ? newTriggerMidiNote : undefined,
      midiChannel: newTriggerType === 'midi' ? newTriggerMidiChannel : undefined,
      action: newTriggerAction,
      enabled: true
    });

    // Reset form
    setNewTriggerType('osc');
    setNewTriggerAddress('');
    setNewTriggerMidiNote(60);
    setNewTriggerMidiChannel(1);
    setNewTriggerAction('play');
    setShowAddTrigger(false);
  };

  const handleRemoveTrigger = (triggerId: string) => {
    if (window.confirm('Are you sure you want to remove this trigger?')) {
      removeActTrigger(act.id, triggerId);
    }
  };

  const handleToggleTrigger = (triggerId: string, enabled: boolean) => {
    updateActTrigger(act.id, triggerId, { enabled });
  };

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const totalDuration = act.steps.reduce((sum, step) => sum + step.duration, 0);

  return (
    <div className={styles.actEditor}>
      <div className={styles.editorHeader}>
        <h3>
          <i className="fas fa-edit"></i>
          Edit Act: {act.name}
        </h3>
        <div className={styles.editorActions}>
          <button className={styles.saveButton} onClick={handleSaveAct}>
            <i className="fas fa-save"></i>
            Save Changes
          </button>
          <button className={styles.closeButton} onClick={onClose}>
            <i className="fas fa-times"></i>
            Close
          </button>
        </div>
      </div>

      <div className={styles.editorContent}>
        {/* Act Properties */}
        <div className={styles.actProperties}>
          <div className={styles.propertyGroup}>
            <label>Act Name</label>
            <input
              type="text"
              value={actName}
              onChange={(e) => setActName(e.target.value)}
              placeholder="Enter act name..."
            />
          </div>
          
          <div className={styles.propertyGroup}>
            <label>Description</label>
            <textarea
              value={actDescription}
              onChange={(e) => setActDescription(e.target.value)}
              placeholder="Enter act description..."
              rows={3}
            />
          </div>
          
          <div className={styles.propertyGroup}>
            <label>Loop Mode</label>
            <select
              value={loopMode}
              onChange={(e) => setLoopMode(e.target.value as 'none' | 'loop' | 'ping-pong')}
            >
              <option value="none">No Loop</option>
              <option value="loop">Loop</option>
              <option value="ping-pong">Ping-Pong</option>
            </select>
          </div>
        </div>

        {/* Steps Management */}
        <div className={styles.stepsSection}>
          <div className={styles.stepsHeader}>
            <h4>
              <i className="fas fa-list"></i>
              Steps ({act.steps.length})
            </h4>
            <div className={styles.stepsActions}>
              <span className={styles.totalDuration}>
                Total Duration: {formatDuration(totalDuration)}
              </span>
              <button 
                className={styles.addStepButton}
                onClick={() => setShowAddStep(!showAddStep)}
              >
                <i className="fas fa-plus"></i>
                Add Step
              </button>
            </div>
          </div>

          {/* Add Step Form */}
          {showAddStep && (
            <div className={styles.addStepForm}>
              <h5>Add New Step</h5>
              <div className={styles.stepForm}>
                <div className={styles.formGroup}>
                  <label>Scene</label>
                  <select
                    value={newStepScene}
                    onChange={(e) => setNewStepScene(e.target.value)}
                  >
                    <option value="">Select a scene...</option>
                    {scenes.map(scene => (
                      <option key={scene.name} value={scene.name}>
                        {scene.name}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div className={styles.formGroup}>
                  <label>Duration (ms)</label>
                  <input
                    type="number"
                    value={newStepDuration}
                    onChange={(e) => setNewStepDuration(Number(e.target.value))}
                    min="100"
                    step="100"
                  />
                </div>
                
                <div className={styles.formGroup}>
                  <label>Transition Duration (ms)</label>
                  <input
                    type="number"
                    value={newStepTransitionDuration}
                    onChange={(e) => setNewStepTransitionDuration(Number(e.target.value))}
                    min="0"
                    step="100"
                  />
                </div>
                
                <div className={styles.formGroup}>
                  <label>Notes</label>
                  <input
                    type="text"
                    value={newStepNotes}
                    onChange={(e) => setNewStepNotes(e.target.value)}
                    placeholder="Optional notes..."
                  />
                </div>
                
                <div className={styles.formGroup}>
                  <label>
                    <input
                      type="checkbox"
                      checked={newStepAutopilotEnabled}
                      onChange={(e) => setNewStepAutopilotEnabled(e.target.checked)}
                    />
                    Enable Autopilot
                  </label>
                </div>
                
                {newStepAutopilotEnabled && (
                  <div className={styles.autopilotSettings}>
                    <h6>Autopilot Groups</h6>
                    {newStepAutopilotGroups.map((group, index) => (
                      <div key={index} className={styles.autopilotGroup}>
                        <select
                          value={group.groupId}
                          onChange={(e) => {
                            const updated = [...newStepAutopilotGroups];
                            updated[index].groupId = e.target.value;
                            setNewStepAutopilotGroups(updated);
                          }}
                        >
                          <option value="">Select group...</option>
                          {groups.map(g => (
                            <option key={g.id} value={g.id}>{g.name}</option>
                          ))}
                        </select>
                        
                        <select
                          value={group.autopilotType}
                          onChange={(e) => {
                            const updated = [...newStepAutopilotGroups];
                            updated[index].autopilotType = e.target.value as any;
                            setNewStepAutopilotGroups(updated);
                          }}
                        >
                          <option value="color">Color</option>
                          <option value="dimmer">Dimmer</option>
                          <option value="panTilt">Pan/Tilt</option>
                          <option value="custom">Custom</option>
                        </select>
                        
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={group.intensity}
                          onChange={(e) => {
                            const updated = [...newStepAutopilotGroups];
                            updated[index].intensity = Number(e.target.value);
                            setNewStepAutopilotGroups(updated);
                          }}
                        />
                        <span>{group.intensity}%</span>
                        
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={group.speed}
                          onChange={(e) => {
                            const updated = [...newStepAutopilotGroups];
                            updated[index].speed = Number(e.target.value);
                            setNewStepAutopilotGroups(updated);
                          }}
                        />
                        <span>{group.speed}%</span>
                        
                        <button
                          type="button"
                          onClick={() => {
                            const updated = newStepAutopilotGroups.filter((_, i) => i !== index);
                            setNewStepAutopilotGroups(updated);
                          }}
                        >
                          <i className="fas fa-trash"></i>
                        </button>
                      </div>
                    ))}
                    
                    <button
                      type="button"
                      onClick={() => {
                        setNewStepAutopilotGroups([...newStepAutopilotGroups, {
                          groupId: '',
                          autopilotType: 'color',
                          intensity: 50,
                          speed: 50
                        }]);
                      }}
                    >
                      <i className="fas fa-plus"></i>
                      Add Group
                    </button>
                  </div>
                )}
                
                <div className={styles.formActions}>
                  <button 
                    className={styles.addButton}
                    onClick={handleAddStep}
                    disabled={!newStepScene}
                  >
                    <i className="fas fa-plus"></i>
                    Add Step
                  </button>
                  <button 
                    className={styles.cancelButton}
                    onClick={() => setShowAddStep(false)}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Steps List */}
          <DragDropContext onDragEnd={handleDragEnd}>
            <Droppable droppableId="steps">
              {(provided) => (
                <div 
                  className={styles.stepsList}
                  {...provided.droppableProps}
                  ref={provided.innerRef}
                >
                  {act.steps.map((step, index) => (
                    <Draggable key={step.id} draggableId={step.id} index={index}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          className={`${styles.stepItem} ${snapshot.isDragging ? styles.dragging : ''}`}
                        >
                          <div className={styles.stepDragHandle} {...provided.dragHandleProps}>
                            <i className="fas fa-grip-vertical"></i>
                          </div>
                          
                          <div className={styles.stepContent}>
                            <div className={styles.stepHeader}>
                              <span className={styles.stepNumber}>Step {index + 1}</span>
                              <span className={styles.stepScene}>{step.sceneName}</span>
                              <div className={styles.stepActions}>
                                <button
                                  className={styles.editStepButton}
                                  onClick={() => setEditingStepId(editingStepId === step.id ? null : step.id)}
                                >
                                  <i className="fas fa-edit"></i>
                                </button>
                                <button
                                  className={styles.removeStepButton}
                                  onClick={() => handleRemoveStep(step.id)}
                                >
                                  <i className="fas fa-trash"></i>
                                </button>
                              </div>
                            </div>
                            
                            <div className={styles.stepDetails}>
                              <div className={styles.stepDetail}>
                                <i className="fas fa-clock"></i>
                                <span>Duration: {formatDuration(step.duration)}</span>
                              </div>
                              <div className={styles.stepDetail}>
                                <i className="fas fa-exchange-alt"></i>
                                <span>Transition: {formatDuration(step.transitionDuration)}</span>
                              </div>
                              {step.notes && (
                                <div className={styles.stepDetail}>
                                  <i className="fas fa-sticky-note"></i>
                                  <span>{step.notes}</span>
                                </div>
                              )}
                            </div>

                            {/* Step Edit Form */}
                            {editingStepId === step.id && (
                              <div className={styles.stepEditForm}>
                                <div className={styles.editFormGroup}>
                                  <label>Scene</label>
                                  <select
                                    value={step.sceneName}
                                    onChange={(e) => handleUpdateStep(step.id, { sceneName: e.target.value })}
                                  >
                                    {scenes.map(scene => (
                                      <option key={scene.name} value={scene.name}>
                                        {scene.name}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                                
                                <div className={styles.editFormGroup}>
                                  <label>Duration (ms)</label>
                                  <input
                                    type="number"
                                    value={step.duration}
                                    onChange={(e) => handleUpdateStep(step.id, { duration: Number(e.target.value) })}
                                    min="100"
                                    step="100"
                                  />
                                </div>
                                
                                <div className={styles.editFormGroup}>
                                  <label>Transition Duration (ms)</label>
                                  <input
                                    type="number"
                                    value={step.transitionDuration}
                                    onChange={(e) => handleUpdateStep(step.id, { transitionDuration: Number(e.target.value) })}
                                    min="0"
                                    step="100"
                                  />
                                </div>
                                
                                <div className={styles.editFormGroup}>
                                  <label>Notes</label>
                                  <input
                                    type="text"
                                    value={step.notes || ''}
                                    onChange={(e) => handleUpdateStep(step.id, { notes: e.target.value || undefined })}
                                    placeholder="Optional notes..."
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>
        </div>

        {/* Triggers Section */}
        <div className={styles.triggersSection}>
          <div className={styles.triggersHeader}>
            <h4>
              <i className="fas fa-bolt"></i>
              Triggers ({act.triggers.length})
            </h4>
            <div className={styles.triggersActions}>
              <button 
                className={styles.addTriggerButton}
                onClick={() => setShowAddTrigger(!showAddTrigger)}
              >
                <i className="fas fa-plus"></i>
                Add Trigger
              </button>
            </div>
          </div>

          {/* Add Trigger Form */}
          {showAddTrigger && (
            <div className={styles.addTriggerForm}>
              <h5>Add New Trigger</h5>
              <div className={styles.triggerForm}>
                <div className={styles.formGroup}>
                  <label>Trigger Type</label>
                  <select
                    value={newTriggerType}
                    onChange={(e) => setNewTriggerType(e.target.value as 'osc' | 'midi')}
                  >
                    <option value="osc">OSC</option>
                    <option value="midi">MIDI</option>
                  </select>
                </div>

                {newTriggerType === 'osc' && (
                  <div className={styles.formGroup}>
                    <label>OSC Address</label>
                    <input
                      type="text"
                      value={newTriggerAddress}
                      onChange={(e) => setNewTriggerAddress(e.target.value)}
                      placeholder="/act/play"
                    />
                  </div>
                )}

                {newTriggerType === 'midi' && (
                  <>
                    <div className={styles.formGroup}>
                      <label>MIDI Note</label>
                      <input
                        type="number"
                        value={newTriggerMidiNote}
                        onChange={(e) => setNewTriggerMidiNote(Number(e.target.value))}
                        min="0"
                        max="127"
                      />
                    </div>
                    <div className={styles.formGroup}>
                      <label>MIDI Channel</label>
                      <input
                        type="number"
                        value={newTriggerMidiChannel}
                        onChange={(e) => setNewTriggerMidiChannel(Number(e.target.value))}
                        min="1"
                        max="16"
                      />
                    </div>
                  </>
                )}

                <div className={styles.formGroup}>
                  <label>Action</label>
                  <select
                    value={newTriggerAction}
                    onChange={(e) => setNewTriggerAction(e.target.value as any)}
                  >
                    <option value="play">Play</option>
                    <option value="pause">Pause</option>
                    <option value="stop">Stop</option>
                    <option value="next">Next Step</option>
                    <option value="previous">Previous Step</option>
                    <option value="toggle">Toggle Play/Pause</option>
                  </select>
                </div>

                <div className={styles.formActions}>
                  <button 
                    className={styles.addButton}
                    onClick={handleAddTrigger}
                    disabled={newTriggerType === 'osc' && !newTriggerAddress}
                  >
                    <i className="fas fa-plus"></i>
                    Add Trigger
                  </button>
                  <button 
                    className={styles.cancelButton}
                    onClick={() => setShowAddTrigger(false)}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Triggers List */}
          <div className={styles.triggersList}>
            {act.triggers.length === 0 ? (
              <div className={styles.emptyTriggers}>
                <i className="fas fa-bolt"></i>
                <p>No triggers configured</p>
                <p>Add OSC or MIDI triggers to control this act remotely</p>
              </div>
            ) : (
              act.triggers.map(trigger => (
                <div key={trigger.id} className={styles.triggerItem}>
                  <div className={styles.triggerHeader}>
                    <div className={styles.triggerInfo}>
                      <span className={styles.triggerType}>
                        <i className={`fas ${trigger.type === 'osc' ? 'fa-wifi' : 'fa-music'}`}></i>
                        {trigger.type.toUpperCase()}
                      </span>
                      <span className={styles.triggerAddress}>
                        {trigger.type === 'osc' 
                          ? trigger.address 
                          : `Note ${trigger.midiNote} (Ch ${trigger.midiChannel})`
                        }
                      </span>
                      <span className={styles.triggerAction}>
                        <i className="fas fa-play"></i>
                        {trigger.action}
                      </span>
                    </div>
                    <div className={styles.triggerActions}>
                      <label className={styles.toggleSwitch}>
                        <input
                          type="checkbox"
                          checked={trigger.enabled}
                          onChange={(e) => handleToggleTrigger(trigger.id, e.target.checked)}
                        />
                        <span className={styles.slider}></span>
                      </label>
                      <button
                        className={styles.removeTriggerButton}
                        onClick={() => handleRemoveTrigger(trigger.id)}
                      >
                        <i className="fas fa-trash"></i>
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
