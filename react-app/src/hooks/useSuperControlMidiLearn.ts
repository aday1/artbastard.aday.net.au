import { useState, useEffect, useCallback } from 'react'
import { useStore } from '../store'
import { MidiMapping } from '../store'

export interface SuperControlMidiMapping extends MidiMapping {
  controlName: string;
  minValue?: number;
  maxValue?: number;
}

export const useSuperControlMidiLearn = () => {
  const {
    midiLearnTarget,
    midiMessages,
    startMidiLearn: startMidiLearnAction,
    cancelMidiLearn: cancelMidiLearnAction,
    addNotification,
  } = useStore((state) => ({
    midiLearnTarget: state.midiLearnTarget,
    midiMessages: state.midiMessages,
    startMidiLearn: state.startMidiLearn,
    cancelMidiLearn: state.cancelMidiLearn,
    addNotification: state.addNotification,
  }))

  const [learnStatus, setLearnStatus] = useState<'idle' | 'learning' | 'success' | 'timeout'>('idle')
  const [timeoutId, setTimeoutId] = useState<number | null>(null)
  const [superControlMappings, setSuperControlMappings] = useState<Record<string, SuperControlMidiMapping>>({})

  // Start MIDI learn mode for a SuperControl control
  const startLearn = useCallback((controlName: string, minValue: number = 0, maxValue: number = 255) => {
    const target = { type: 'superControl' as const, controlName };
    
    if (midiLearnTarget !== null) {
      cancelMidiLearnAction() 
      console.log(`[SuperControlMidiLearn] Canceled previous learn to start ${controlName}`);
    }
    
    startMidiLearnAction(target)
    setLearnStatus('learning')
    addNotification({
      message: `MIDI Learn started for ${controlName}. Send a MIDI CC or Note.`,
      type: 'info',
      priority: 'normal'
    });
    console.log(`[SuperControlMidiLearn] Started for control ${controlName}. Status: learning. Range: ${minValue}-${maxValue}`);
    
    if (timeoutId) {
      window.clearTimeout(timeoutId);
    }

    const newTimeoutId = window.setTimeout(() => {
      const currentTarget = useStore.getState().midiLearnTarget;
      if (currentTarget && currentTarget.type === 'superControl' && currentTarget.controlName === controlName) { 
        cancelMidiLearnAction()
        setLearnStatus('timeout')
        addNotification({
          message: `MIDI Learn for ${controlName} timed out.`,
          type: 'error',
          priority: 'high'
        });
        console.log(`[SuperControlMidiLearn] Timed out for control ${controlName}. Status: timeout.`);
      }
    }, 30000)
    
    setTimeoutId(newTimeoutId)
  }, [midiLearnTarget, startMidiLearnAction, cancelMidiLearnAction, addNotification, timeoutId])
  
  // Cancel MIDI learn mode
  const cancelLearn = useCallback(() => {
    if (midiLearnTarget !== null) {
      console.log(`[SuperControlMidiLearn] Cancelling learn for target:`, midiLearnTarget);
      cancelMidiLearnAction()
      addNotification({
        message: `MIDI Learn cancelled.`,
        type: 'info',
        priority: 'low'
      });
    }
    setLearnStatus('idle')
    
    if (timeoutId) {
      window.clearTimeout(timeoutId)
      setTimeoutId(null)
    }
  }, [cancelMidiLearnAction, midiLearnTarget, timeoutId, addNotification])
  
  // Reset learn status after success or timeout
  useEffect(() => {
    let resetTimer: number | null = null;
    if (learnStatus === 'success' || learnStatus === 'timeout') {
      console.log(`[SuperControlMidiLearn] Learn status is ${learnStatus}. Will reset to idle in 3 seconds.`);
      resetTimer = window.setTimeout(() => {
        setLearnStatus('idle');
        console.log('[SuperControlMidiLearn] Learn status reset to idle.');
      }, 3000);
    }
    return () => {
      if (resetTimer) {
        window.clearTimeout(resetTimer);
      }
    };
  }, [learnStatus])

  // Listen for MIDI messages during learn mode
  useEffect(() => {
    if (midiLearnTarget === null || midiLearnTarget.type !== 'superControl' || learnStatus !== 'learning' || midiMessages.length === 0) {
      return;
    }

    const latestMessage = midiMessages[midiMessages.length - 1]
    const controlName = midiLearnTarget.controlName;
    console.log('[SuperControlMidiLearn] In learn mode. Processing message:', latestMessage, `for control ${controlName}`);
    
    const messageType = latestMessage.type || latestMessage._type;

    if (messageType === 'cc' && latestMessage.controller !== undefined) {
      const mapping: SuperControlMidiMapping = {
        controlName,
        channel: latestMessage.channel,
        controller: latestMessage.controller,
        minValue: 0,
        maxValue: 255
      }
      console.log(`[SuperControlMidiLearn] Creating CC mapping for control ${controlName}:`, mapping);
      
      // Store the mapping
      setSuperControlMappings(prev => ({
        ...prev,
        [controlName]: mapping
      }))
      
      // Special handling for quickSceneLoad
      if (controlName === 'quickSceneLoad') {
        const { setQuickSceneMidiMapping } = useStore.getState();
        setQuickSceneMidiMapping(mapping);
      }
      
      const event = new CustomEvent('superControlMidiMappingCreated', { detail: { controlName, mapping } })
      window.dispatchEvent(event)
      
      setLearnStatus('success')
      addNotification({
        message: `${controlName} mapped to MIDI CC ${mapping.controller} on CH ${mapping.channel}.`,
        type: 'success',
        priority: 'normal'
      });
      console.log(`[SuperControlMidiLearn] Success for control ${controlName}. Status: success.`);
      
      if (timeoutId) {
        window.clearTimeout(timeoutId)
        setTimeoutId(null)
      }
    } else if (messageType === 'noteon' && latestMessage.note !== undefined) {
      const mapping: SuperControlMidiMapping = {
        controlName,
        channel: latestMessage.channel,
        note: latestMessage.note,
        minValue: 0,
        maxValue: 255
      }
      console.log(`[SuperControlMidiLearn] Creating Note mapping for control ${controlName}:`, mapping);
      
      // Store the mapping
      setSuperControlMappings(prev => ({
        ...prev,
        [controlName]: mapping
      }))
      
      // Special handling for quickSceneLoad
      if (controlName === 'quickSceneLoad') {
        const { setQuickSceneMidiMapping } = useStore.getState();
        setQuickSceneMidiMapping(mapping);
      }
      
      const event = new CustomEvent('superControlMidiMappingCreated', { detail: { controlName, mapping } })
      window.dispatchEvent(event)
      
      setLearnStatus('success')
      addNotification({
        message: `${controlName} mapped to MIDI Note ${mapping.note} on CH ${mapping.channel}.`,
        type: 'success',
        priority: 'normal'
      });
      console.log(`[SuperControlMidiLearn] Success for control ${controlName}. Status: success.`);
      
      if (timeoutId) {
        window.clearTimeout(timeoutId)
        setTimeoutId(null)
      }
    } else {
      console.log('[SuperControlMidiLearn] Ignoring non-CC/Note message or message without controller/note:', messageType);
    }
  }, [midiMessages, midiLearnTarget, learnStatus, timeoutId, addNotification, cancelMidiLearnAction]);

  // Remove MIDI mapping for a control
  const forgetMapping = useCallback((controlName: string) => {
    setSuperControlMappings(prev => {
      const updated = { ...prev };
      delete updated[controlName];
      return updated;
    });
    
    addNotification({
      message: `MIDI mapping removed for ${controlName}.`,
      type: 'info',
      priority: 'normal'
    });
    console.log(`[SuperControlMidiLearn] Mapping removed for control ${controlName}`);
  }, [addNotification]);

  // Set custom range for a mapping
  const setMappingRange = useCallback((controlName: string, minValue: number, maxValue: number) => {
    setSuperControlMappings(prev => {
      const mapping = prev[controlName];
      if (mapping) {
        return {
          ...prev,
          [controlName]: {
            ...mapping,
            minValue,
            maxValue
          }
        };
      }
      return prev;
    });
  }, []);

  // Process incoming MIDI for mapped controls
  const processMidiForControl = useCallback((midiMessage: any, controlHandlers: Record<string, (value: number) => void>) => {
    Object.entries(superControlMappings).forEach(([controlName, mapping]) => {
      let matched = false;
      let midiValue = 0;

    const messageType = midiMessage.type || midiMessage._type;
    if (messageType === 'cc' && mapping.controller !== undefined && 
          midiMessage.channel === mapping.channel && midiMessage.controller === mapping.controller) {
        matched = true;
        midiValue = midiMessage.value || 0;
    } else if (messageType === 'noteon' && mapping.note !== undefined && 
                 midiMessage.channel === mapping.channel && midiMessage.note === mapping.note) {
        matched = true;
        midiValue = midiMessage.velocity || 0;
      }

      if (matched && controlHandlers[controlName]) {
        // Map MIDI value (0-127) to control range
        const minVal = mapping.minValue || 0;
        const maxVal = mapping.maxValue || 255;
        const scaledValue = Math.round((midiValue / 127) * (maxVal - minVal) + minVal);
        
        console.log(`[SuperControlMidiLearn] Triggering ${controlName} with MIDI value ${midiValue} -> scaled ${scaledValue}`);
        controlHandlers[controlName](scaledValue);
      }
    });
  }, [superControlMappings]);
  
  return {
    isLearning: midiLearnTarget !== null && midiLearnTarget.type === 'superControl' && learnStatus === 'learning',
    learnStatus,
    currentLearningControlName: midiLearnTarget?.type === 'superControl' ? midiLearnTarget.controlName : null,
    startLearn,
    cancelLearn,
    forgetMapping,
    setMappingRange,
    processMidiForControl,
    mappings: superControlMappings
  }
}
