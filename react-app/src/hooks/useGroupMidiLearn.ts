import { useState, useEffect, useCallback } from 'react'
import { useStore } from '../store'
import { MidiMapping } from '../store'
import { debugLog } from '../utils/debugLog';

export const useGroupMidiLearn = () => {
  const {
    midiLearnTarget,
    midiMessages,
    startGroupMidiLearn,
    cancelMidiLearn,
    setGroupMidiMapping,
    addNotification,
  } = useStore((state) => ({
    midiLearnTarget: state.midiLearnTarget,
    midiMessages: state.midiMessages,
    startGroupMidiLearn: state.startGroupMidiLearn,
    cancelMidiLearn: state.cancelMidiLearn,
    setGroupMidiMapping: state.setGroupMidiMapping,
    addNotification: state.addNotification,
  }))
  
  const [learnStatus, setLearnStatus] = useState<'idle' | 'learning' | 'success' | 'timeout'>('idle')
  const [timeoutId, setTimeoutId] = useState<number | null>(null)
  
  // Start MIDI learn mode for a group
  const startLearn = useCallback((groupId: string) => {
    if (midiLearnTarget !== null) {
      cancelMidiLearn()
      debugLog.log(`[GroupMidiLearn] Canceled previous learn to start group ${groupId}`);
    }
    
    startGroupMidiLearn(groupId)
    setLearnStatus('learning')
    addNotification({
      message: `MIDI Learn started for group. Send a MIDI CC or note.`,
      type: 'info',
      priority: 'normal'
    });
    debugLog.log(`[GroupMidiLearn] Started for group ${groupId}. Status: learning.`);
    
    if (timeoutId) {
      window.clearTimeout(timeoutId);
    }

    const newTimeoutId = window.setTimeout(() => {
      const currentTarget = useStore.getState().midiLearnTarget;
      if (currentTarget && currentTarget.type === 'group' && currentTarget.groupId === groupId) {
        cancelMidiLearn()
        setLearnStatus('timeout')
        addNotification({
          message: `MIDI Learn for group timed out.`,
          type: 'error',
          priority: 'high'
        });
        debugLog.log(`[GroupMidiLearn] Timed out for group ${groupId}. Status: timeout.`);
      }
    }, 30000)
    
    setTimeoutId(newTimeoutId)
  }, [midiLearnTarget, startGroupMidiLearn, cancelMidiLearn, addNotification, timeoutId])
  
  // Cancel MIDI learn mode
  const cancelLearn = useCallback(() => {
    if (midiLearnTarget !== null) {
      debugLog.log(`[GroupMidiLearn] Cancelling learn for target:`, midiLearnTarget);
      cancelMidiLearn()
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
  }, [cancelMidiLearn, midiLearnTarget, timeoutId, addNotification])
  
  // Reset learn status after success or timeout
  useEffect(() => {
    let resetTimer: number | null = null;
    if (learnStatus === 'success' || learnStatus === 'timeout') {
      debugLog.log(`[GroupMidiLearn] Learn status is ${learnStatus}. Will reset to idle in 3 seconds.`);
      resetTimer = window.setTimeout(() => {
        setLearnStatus('idle');
        debugLog.log('[GroupMidiLearn] Learn status reset to idle.');
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
    if (midiLearnTarget === null || midiLearnTarget.type !== 'group' || learnStatus !== 'learning' || midiMessages.length === 0) {
      return;
    }

    const latestMessage = midiMessages[midiMessages.length - 1] as any;
    const groupId = midiLearnTarget.groupId;
    debugLog.log('[GroupMidiLearn] In learn mode. Processing message:', latestMessage, `for group ${groupId}`);
    
    // Handle both CC and Note messages for groups
    const createMapping = () => {
      let mapping: MidiMapping | undefined;
      const messageType = latestMessage.type || latestMessage._type;

      if (messageType === 'cc' && latestMessage.controller !== undefined) {
        mapping = {
          channel: latestMessage.channel,
          controller: latestMessage.controller
        };
        debugLog.log(`[GroupMidiLearn] Creating CC mapping for group ${groupId}:`, mapping);
      } else if (messageType === 'noteon' && latestMessage.note !== undefined) {
        mapping = {
          channel: latestMessage.channel,
          note: latestMessage.note
        };
        debugLog.log(`[GroupMidiLearn] Creating Note mapping for group ${groupId}:`, mapping);
      } else if (messageType === 'pitch' && latestMessage.value !== undefined) {
        mapping = {
          channel: latestMessage.channel,
          pitch: true
        };
        debugLog.log(`[GroupMidiLearn] Creating Pitch mapping for group ${groupId}:`, mapping);
      }

      if (mapping) {
        setGroupMidiMapping(groupId, mapping)
        
        setLearnStatus('success')
        addNotification({
          message: mapping.pitch
            ? `Group mapped to MIDI Pitch on CH ${mapping.channel}.`
            : mapping.controller !== undefined
              ? `Group mapped to MIDI CC ${mapping.controller} on CH ${mapping.channel}.`
              : `Group mapped to MIDI Note ${mapping.note} on CH ${mapping.channel}.`,
          type: 'success',
          priority: 'normal'
        });
        debugLog.log(`[GroupMidiLearn] Success for group ${groupId}. Status: success.`);
        
        if (timeoutId) {
          window.clearTimeout(timeoutId)
          setTimeoutId(null)
        }
      }
    }

    if ((latestMessage.type || latestMessage._type) === 'cc' || (latestMessage.type || latestMessage._type) === 'noteon' || (latestMessage.type || latestMessage._type) === 'pitch') {
      createMapping();
    } else {
      debugLog.log('[GroupMidiLearn] Ignoring message:', latestMessage.type || latestMessage._type);
    }
  }, [midiMessages, midiLearnTarget, learnStatus, setGroupMidiMapping, timeoutId, addNotification, cancelMidiLearn]);
  
  return {
    isLearning: midiLearnTarget !== null && midiLearnTarget.type === 'group' && learnStatus === 'learning',
    learnStatus,
    currentLearningGroupId: midiLearnTarget?.type === 'group' ? midiLearnTarget.groupId : null,
    startLearn,
    cancelLearn
  }
}
