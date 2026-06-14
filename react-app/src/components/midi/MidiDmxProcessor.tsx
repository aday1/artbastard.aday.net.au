import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useStore } from '../../store';
import { useMidiScaling, ScalingOptions } from '../../hooks/useMidiScaling';
import { debugLog } from '../../utils/debugLog';

// Extended mapping interface to include range limits and curve
interface MidiRangeMapping {
  inputMin?: number;
  inputMax?: number;
  outputMin?: number;
  outputMax?: number;
  curve?: number; // Changed from string literal to number to match useMidiScaling
  inverted?: boolean; // Add support for inverted MIDI input
}

/**
 * This component doesn't render anything but processes MIDI messages
 * and converts them to DMX channel changes
 */
export const MidiDmxProcessor: React.FC = () => {
  const {
    midiMappings, // DMX channel mappings
    superControlMidiMappings,
    applySuperControlMidi,
    superControlLearnTarget,
    rebindSuperControl,
    midiMessages,
    setDmxChannel,
    masterSliders,
    updateMasterSliderValue,
    midiLearnTarget,
    quickSceneSave,
    quickSceneSaveMidiMapping,
    quickSceneSaveB,
    quickSceneSaveBMidiMapping,
    quickSceneLoad,
    quickSceneMidiMapping,
    quickSceneLoadB,
    quickSceneLoadBMidiMapping,
  } = useStore(state => ({
    midiMappings: state.midiMappings,
    superControlMidiMappings: state.superControlMidiMappings,
    applySuperControlMidi: state.applySuperControlMidi,
    superControlLearnTarget: state.superControlLearnTarget,
    rebindSuperControl: state.rebindSuperControl,
    midiMessages: state.midiMessages,
    setDmxChannel: state.setDmxChannel,
    masterSliders: state.masterSliders,
    updateMasterSliderValue: state.updateMasterSliderValue,
    midiLearnTarget: state.midiLearnTarget,
    quickSceneSave: state.quickSceneSave,
    quickSceneSaveMidiMapping: state.quickSceneSaveMidiMapping,
    quickSceneSaveB: state.quickSceneSaveB,
    quickSceneSaveBMidiMapping: state.quickSceneSaveBMidiMapping,
    quickSceneLoad: state.quickSceneLoad,
    quickSceneMidiMapping: state.quickSceneMidiMapping,
    quickSceneLoadB: state.quickSceneLoadB,
    quickSceneLoadBMidiMapping: state.quickSceneLoadBMidiMapping,
  }));
  const { scaleValue } = useMidiScaling();
  
  // Keep track of the last processed message to prevent duplicates
  const [lastProcessedMessageSignature, setLastProcessedMessageSignature] = useState<string | null>(null);
  
  // Keep track of custom range mappings for each channel
  const [channelRangeMappings, setChannelRangeMappings] = useState<Record<number, MidiRangeMapping>>({});

  // Memoize store functions to avoid recreating them
  const stableFunctions = useMemo(() => ({
    setDmxChannel,
    updateMasterSliderValue,
    scaleValue,
  }), [setDmxChannel, updateMasterSliderValue, scaleValue]);

  // Log when MIDI mappings change, helpful for debugging
  useEffect(() => {
    debugLog.log('[MidiDmxProcessor] MIDI mappings updated in store:', midiMappings);
  }, [midiMappings]);

  const normalizePitchToMidiValue = useCallback((rawValue: number) => {
    const normalized = rawValue > 127
      ? rawValue / 16383
      : rawValue / 127;
    const bounded = Math.max(0, Math.min(1, normalized));
    return Math.round(bounded * 127);
  }, []);

  const matchesPressMapping = useCallback((mapping: any, message: any) => {
    const messageType = message.type || message._type;
    if (messageType === 'cc' && mapping.controller !== undefined) {
      return mapping.channel === message.channel &&
        mapping.controller === message.controller &&
        (typeof message.value !== 'number' || message.value > 0);
    }
    if (messageType === 'noteon' && mapping.note !== undefined) {
      return mapping.channel === message.channel &&
        mapping.note === message.note &&
        (message.velocity ?? 127) > 0;
    }
    if (messageType === 'pitch' && mapping.pitch && typeof message.value === 'number') {
      return mapping.channel === message.channel && normalizePitchToMidiValue(message.value) > 0;
    }
    return false;
  }, [normalizePitchToMidiValue]);

  // Listen for direct MIDI messages (bypass store for lower latency)
  useEffect(() => {
    const handleDirectMidi = (event: Event) => {
      const customEvent = event as CustomEvent;
      const message = customEvent.detail;
      
      // Process high-frequency browser controls directly (CC and pitch)
      if ((message._type === 'cc' || message._type === 'pitch') && (message.source === 'browser' || message.sourceTransport === 'browser')) {
        processMidiMessageDirect(message);
      }
    };

    window.addEventListener('midiMessageDirect', handleDirectMidi);
    return () => {
      window.removeEventListener('midiMessageDirect', handleDirectMidi);
    };
  }, [midiMappings, masterSliders, midiLearnTarget, stableFunctions]);

  // Direct processing function for low-latency browser control messages (bypasses store re-render)
  const processMidiMessageDirect = useCallback((message: any) => {
    if (midiLearnTarget !== null) {
      return; // Skip if in learn mode
    }

    // SuperControl re-learn: rewrite the binding signature for the targeted
    // control from the next inbound MIDI message, then stop here so the message
    // doesn't also drive a stale binding.
    if (superControlLearnTarget) {
      const t = message._type || message.type;
      const sig =
        t === 'cc' && message.controller !== undefined
          ? { channel: message.channel, controller: message.controller }
          : t === 'noteon' && message.note !== undefined
          ? { channel: message.channel, note: message.note }
          : t === 'pitch'
          ? { channel: message.channel, pitch: true }
          : null;
      if (sig) {
        rebindSuperControl(superControlLearnTarget.controlName, superControlLearnTarget.slotIndex, sig);
        return;
      }
    }

    // Process for Master Sliders first
    let messageHandledByMasterSlider = false;
    if (masterSliders && masterSliders.length > 0) {
      for (const slider of masterSliders) {
        if (slider.midiMapping && 
            slider.midiMapping.channel === message.channel &&
            slider.midiMapping.controller === message.controller) {
          const scaledValue = Math.round((message.value / 127) * 255);
          stableFunctions.updateMasterSliderValue(slider.id, scaledValue);
          messageHandledByMasterSlider = true;
          break;
        }
      }
    }

    const messageType = message._type || message.type;

    // Process for DMX channels if not handled by master slider
    if (!messageHandledByMasterSlider && messageType === 'cc' && message.controller !== undefined) {
      Object.entries(midiMappings).forEach(([dmxChannelStr, mapping]) => {
        if (!mapping) return;
        const dmxChannel = parseInt(dmxChannelStr, 10);
        if (mapping.controller !== undefined &&
            mapping.channel === message.channel &&
            mapping.controller === message.controller) {
          
          // Get the range mapping for this channel if any
          const currentRangeMapping = channelRangeMappings[dmxChannel] || {};
          
          // Build scaling options with defaults
          const scalingOptions: Partial<ScalingOptions> = {
            inputMin: currentRangeMapping.inputMin || 0,
            inputMax: currentRangeMapping.inputMax || 127,
            outputMin: currentRangeMapping.outputMin || 0,
            outputMax: currentRangeMapping.outputMax || 255,
            curve: currentRangeMapping.curve || 1
          };
          
          // Apply inversion if configured
          let inputValue = message.value;
          if (currentRangeMapping.inverted) {
            inputValue = 127 - inputValue;
          }
          
          // Scale the MIDI value to DMX range using the scaling function
          const dmxValue = stableFunctions.scaleValue(inputValue, scalingOptions);
          const roundedDmxValue = typeof dmxValue === 'number' ? Math.round(dmxValue) : 0;
          const boundedValue = Math.max(0, Math.min(255, roundedDmxValue));
          
          // Update the DMX channel directly (bypasses store re-render for this update)
          stableFunctions.setDmxChannel(dmxChannel, boundedValue);
        }
      });
    } else if (!messageHandledByMasterSlider && messageType === 'pitch' && typeof message.value === 'number') {
      const pitchAsMidiValue = normalizePitchToMidiValue(message.value);
      Object.entries(midiMappings).forEach(([dmxChannelStr, mapping]) => {
        if (!mapping || !mapping.pitch) return;
        const dmxChannel = parseInt(dmxChannelStr, 10);
        if (mapping.channel !== message.channel) return;

        const currentRangeMapping = channelRangeMappings[dmxChannel] || {};
        const scalingOptions: Partial<ScalingOptions> = {
          inputMin: currentRangeMapping.inputMin || 0,
          inputMax: currentRangeMapping.inputMax || 127,
          outputMin: currentRangeMapping.outputMin || 0,
          outputMax: currentRangeMapping.outputMax || 255,
          curve: currentRangeMapping.curve || 1
        };

        let inputValue = pitchAsMidiValue;
        if (currentRangeMapping.inverted) {
          inputValue = 127 - inputValue;
        }

        const dmxValue = stableFunctions.scaleValue(inputValue, scalingOptions);
        const roundedDmxValue = typeof dmxValue === 'number' ? Math.round(dmxValue) : 0;
        const boundedValue = Math.max(0, Math.min(255, roundedDmxValue));
        stableFunctions.setDmxChannel(dmxChannel, boundedValue);
      });
    }

    // SuperControl routing — also runs for direct (browser-low-latency) path
    if (superControlMidiMappings && superControlMidiMappings.length > 0) {
      superControlMidiMappings.forEach((binding) => {
        if (binding.channel !== message.channel) return;
        let matched = false;
        let midiValue = 0;
        if (messageType === 'cc' && binding.controller !== undefined &&
            binding.controller === message.controller &&
            typeof message.value === 'number') {
          matched = true;
          midiValue = message.value;
        } else if (messageType === 'noteon' && binding.note !== undefined &&
                   binding.note === message.note) {
          matched = true;
          midiValue = message.velocity ?? 0;
        } else if (messageType === 'pitch' && binding.pitch &&
                   typeof message.value === 'number') {
          matched = true;
          midiValue = normalizePitchToMidiValue(message.value);
        }
        if (matched) {
          const dmxValue = Math.max(0, Math.min(255, Math.round((midiValue / 127) * 255)));
          applySuperControlMidi(binding.controlName, dmxValue, binding.slotIndex);
        }
      });
    }
  }, [midiMappings, masterSliders, midiLearnTarget, stableFunctions, channelRangeMappings, normalizePitchToMidiValue, superControlMidiMappings, applySuperControlMidi, superControlLearnTarget, rebindSuperControl]);

  // Process MIDI messages from store (for server MIDI and monitoring)
  useEffect(() => {
    if (!midiMessages || midiMessages.length === 0) {
      return;
    }

    const latestMessage = midiMessages[midiMessages.length - 1];
    const currentMessageSignature = JSON.stringify(latestMessage);

    if (currentMessageSignature === lastProcessedMessageSignature) {
      return;
    }
    setLastProcessedMessageSignature(currentMessageSignature); // Mark as processed early

    // Skip browser MIDI CC/Pitch messages - they are handled directly
    if ((latestMessage.source === 'browser' || (latestMessage as any).sourceTransport === 'browser') && (latestMessage._type === 'cc' || latestMessage._type === 'pitch')) {
      return;
    }

    debugLog.log(`[MidiDmxProcessor] Attempting to process MIDI message:`, latestMessage);

    // Skip processing if we're in MIDI Learn mode - let the Learn hook handle it
    if (midiLearnTarget !== null) {
      debugLog.log(`[MidiDmxProcessor] Skipping processing - MIDI Learn mode active for:`, midiLearnTarget);
      return;
    }

    // SuperControl re-learn (Tactile Codex). Capture the message, rebind, abort.
    if (superControlLearnTarget) {
      const t = (latestMessage as any)._type || (latestMessage as any).type;
      const sig =
        t === 'cc' && (latestMessage as any).controller !== undefined
          ? { channel: (latestMessage as any).channel, controller: (latestMessage as any).controller }
          : t === 'noteon' && (latestMessage as any).note !== undefined
          ? { channel: (latestMessage as any).channel, note: (latestMessage as any).note }
          : t === 'pitch'
          ? { channel: (latestMessage as any).channel, pitch: true }
          : null;
      if (sig) {
        rebindSuperControl(superControlLearnTarget.controlName, superControlLearnTarget.slotIndex, sig);
        return;
      }
    }

    let messageHandledByMasterSlider = false;

    // --- Process for Master Sliders ---
    if (masterSliders && masterSliders.length > 0) {
      for (const slider of masterSliders) {
        if (slider.midiMapping) {
          let match = false;
          let newValueForMaster = slider.value; // Default to current value

          const msgType = (latestMessage as any).type || (latestMessage as any)._type;

          if (msgType === 'cc' && 
              slider.midiMapping.controller !== undefined &&
              slider.midiMapping.channel === latestMessage.channel &&
              slider.midiMapping.controller === latestMessage.controller) {
            match = true;
            // Scale CC value (0-127) to master slider range (0-255)
            newValueForMaster = Math.round((latestMessage.value / 127) * 255);
          } else if (msgType === 'noteon' && 
                     slider.midiMapping.note !== undefined &&
                     slider.midiMapping.channel === latestMessage.channel &&
                     slider.midiMapping.note === latestMessage.note) {
            match = true;
            // Use velocity for value, scaled 0-127 to 0-255, or full on if velocity > 0
            newValueForMaster = latestMessage.velocity > 0 ? Math.round((latestMessage.velocity / 127) * 255) : slider.value; 
            // Or simply: newValueForMaster = latestMessage.velocity > 0 ? 255 : slider.value;
          } else if (msgType === 'noteoff' &&
                     slider.midiMapping.note !== undefined &&
                     slider.midiMapping.channel === latestMessage.channel &&
                     slider.midiMapping.note === latestMessage.note) {
            match = true;
            newValueForMaster = 0; // Note Off typically sets value to 0
          }          if (match) {
            debugLog.log(`[MidiDmxProcessor] Master Slider "${slider.name}" matched MIDI. New value: ${newValueForMaster}`);
            stableFunctions.updateMasterSliderValue(slider.id, Math.max(0, Math.min(255, newValueForMaster)));
            messageHandledByMasterSlider = true;
            break; // Assuming one MIDI message controls at most one master slider
          }
        }
      }
    }

    // --- Process for Quick Scene MIDI Controls ---
    if (!messageHandledByMasterSlider && quickSceneSaveMidiMapping && matchesPressMapping(quickSceneSaveMidiMapping, latestMessage)) {
      debugLog.log('[MidiDmxProcessor] Quick Scene Save A triggered by MIDI');
      quickSceneSave();
      messageHandledByMasterSlider = true;
    }

    if (!messageHandledByMasterSlider && quickSceneSaveBMidiMapping && matchesPressMapping(quickSceneSaveBMidiMapping, latestMessage)) {
      debugLog.log('[MidiDmxProcessor] Quick Scene Save B triggered by MIDI');
      quickSceneSaveB();
      messageHandledByMasterSlider = true;
    }

    if (!messageHandledByMasterSlider && quickSceneMidiMapping && matchesPressMapping(quickSceneMidiMapping, latestMessage)) {
      debugLog.log('[MidiDmxProcessor] Quick Scene Load A triggered by MIDI');
      quickSceneLoad();
      messageHandledByMasterSlider = true;
    }

    if (!messageHandledByMasterSlider && quickSceneLoadBMidiMapping && matchesPressMapping(quickSceneLoadBMidiMapping, latestMessage)) {
      debugLog.log('[MidiDmxProcessor] Quick Scene Load B triggered by MIDI');
      quickSceneLoadB();
      messageHandledByMasterSlider = true;
    }

    // --- Process for Direct DMX Channel Mappings (if not handled by a master slider) ---
    const latestType = (latestMessage as any).type || (latestMessage as any)._type;

    if (!messageHandledByMasterSlider && latestType === 'cc' && typeof latestMessage.value === 'number') {
      debugLog.log('[MidiDmxProcessor] Processing CC for Direct DMX. Mappings:', midiMappings);
      let dmxMatchFound = false;
      Object.entries(midiMappings).forEach(([dmxChannelStr, mapping]) => {
        if (!mapping) return;
        const dmxChannel = parseInt(dmxChannelStr, 10);
        if (mapping.controller !== undefined &&
            mapping.channel === latestMessage.channel &&
            mapping.controller === latestMessage.controller) {
            dmxMatchFound = true;
          
          debugLog.log(`[MidiDmxProcessor] Found DMX channel mapping for CC ${mapping.controller} on CH ${mapping.channel} -> DMX CH ${dmxChannel}`);
          
          // Get the range mapping for this channel if any
          const currentRangeMapping = channelRangeMappings[dmxChannel] || {};
          
          // Build scaling options with defaults
          const scalingOptions: Partial<ScalingOptions> = {
            inputMin: currentRangeMapping.inputMin || 0,
            inputMax: currentRangeMapping.inputMax || 127,
            outputMin: currentRangeMapping.outputMin || 0,
            outputMax: currentRangeMapping.outputMax || 255,
            curve: currentRangeMapping.curve || 1
          };
          
          // Apply inversion if configured
          let inputValue = latestMessage.value;
          if (currentRangeMapping.inverted) {
            inputValue = 127 - inputValue;
          }
          
          // Scale the MIDI value to DMX range
          const dmxValue = stableFunctions.scaleValue(inputValue, scalingOptions);
          const roundedDmxValue = typeof dmxValue === 'number' ? Math.round(dmxValue) : 0;
          const boundedValue = Math.max(0, Math.min(255, roundedDmxValue));
          
          debugLog.log(`[MidiDmxProcessor] MIDI CC ${mapping.controller} value ${latestMessage.value} -> DMX CH ${dmxChannel} value ${boundedValue}`);
          
          // Update the DMX channel
          stableFunctions.setDmxChannel(dmxChannel, boundedValue);
          
          // Dispatch custom event for UI components that need to react
          const event = new CustomEvent('dmxChannelUpdate', {
            detail: { channel: dmxChannel, value: boundedValue }
          });
          window.dispatchEvent(event);
        }
      });
      if (!dmxMatchFound) {
        debugLog.log('[MidiDmxProcessor] No DMX channel mapped to received CC (after master slider check).');
      }
    } else if (!messageHandledByMasterSlider && latestType === 'pitch' && typeof latestMessage.value === 'number') {
      debugLog.log('[MidiDmxProcessor] Processing Pitch for Direct DMX. Mappings:', midiMappings);
      let dmxMatchFound = false;
      const pitchAsMidiValue = normalizePitchToMidiValue(latestMessage.value);

      Object.entries(midiMappings).forEach(([dmxChannelStr, mapping]) => {
        if (!mapping || !mapping.pitch) return;
        const dmxChannel = parseInt(dmxChannelStr, 10);
        if (mapping.channel !== latestMessage.channel) return;
        dmxMatchFound = true;

        const currentRangeMapping = channelRangeMappings[dmxChannel] || {};
        const scalingOptions: Partial<ScalingOptions> = {
          inputMin: currentRangeMapping.inputMin || 0,
          inputMax: currentRangeMapping.inputMax || 127,
          outputMin: currentRangeMapping.outputMin || 0,
          outputMax: currentRangeMapping.outputMax || 255,
          curve: currentRangeMapping.curve || 1
        };

        let inputValue = pitchAsMidiValue;
        if (currentRangeMapping.inverted) {
          inputValue = 127 - inputValue;
        }

        const dmxValue = stableFunctions.scaleValue(inputValue, scalingOptions);
        const roundedDmxValue = typeof dmxValue === 'number' ? Math.round(dmxValue) : 0;
        const boundedValue = Math.max(0, Math.min(255, roundedDmxValue));

        stableFunctions.setDmxChannel(dmxChannel, boundedValue);
        const event = new CustomEvent('dmxChannelUpdate', {
          detail: { channel: dmxChannel, value: boundedValue }
        });
        window.dispatchEvent(event);
      });

      if (!dmxMatchFound) {
        debugLog.log('[MidiDmxProcessor] No DMX channel mapped to received Pitch message.');
      }
    } else if (!messageHandledByMasterSlider && (latestType === 'noteon' || latestType === 'noteoff')) {
      // Handle direct Note On/Off to DMX mappings
      debugLog.log('[MidiDmxProcessor] Processing Note for Direct DMX. Mappings:', midiMappings);
      let dmxMatchFound = false;
      Object.entries(midiMappings).forEach(([dmxChannelStr, mapping]) => {
        if (!mapping) return;
        const dmxChannel = parseInt(dmxChannelStr, 10);
        if (mapping.note !== undefined &&
            mapping.channel === latestMessage.channel &&
            mapping.note === latestMessage.note) {
            dmxMatchFound = true;
          
          debugLog.log(`[MidiDmxProcessor] Found DMX channel mapping for Note ${mapping.note} on CH ${mapping.channel} -> DMX CH ${dmxChannel}`);
          
          // For note messages, use velocity as the value (note on) or 0 (note off)
          let noteValue = 0;
          if (latestType === 'noteon' && latestMessage.velocity && latestMessage.velocity > 0) {
            noteValue = latestMessage.velocity;
          }
          
          // Get the range mapping for this channel if any
          const currentRangeMapping = channelRangeMappings[dmxChannel] || {};
          
          // Build scaling options with defaults
          const scalingOptions: Partial<ScalingOptions> = {
            inputMin: currentRangeMapping.inputMin || 0,
            inputMax: currentRangeMapping.inputMax || 127,
            outputMin: currentRangeMapping.outputMin || 0,
            outputMax: currentRangeMapping.outputMax || 255,
            curve: currentRangeMapping.curve || 1
          };
          
          // Apply inversion if configured
          let inputValue = noteValue;
          if (currentRangeMapping.inverted) {
            inputValue = 127 - inputValue;
          }
          
          // Scale the MIDI note value to DMX range
          const dmxValue = stableFunctions.scaleValue(inputValue, scalingOptions);
          const roundedDmxValue = typeof dmxValue === 'number' ? Math.round(dmxValue) : 0;
          const boundedValue = Math.max(0, Math.min(255, roundedDmxValue));
          
          debugLog.log(`[MidiDmxProcessor] MIDI Note ${mapping.note} value ${noteValue} -> DMX CH ${dmxChannel} value ${boundedValue}`);
          
          // Update the DMX channel
          stableFunctions.setDmxChannel(dmxChannel, boundedValue);
          
          // Dispatch custom event for UI components that need to react
          const event = new CustomEvent('dmxChannelUpdate', {
            detail: { channel: dmxChannel, value: boundedValue }
          });
          window.dispatchEvent(event);
        }
      });
      if (!dmxMatchFound) {
        debugLog.log('[MidiDmxProcessor] No DMX channel mapped to received Note (after master slider check).');
      }    }

    // --- SuperControl routing (APC40-style template) ---
    // Runs in addition to raw-DMX matching: a single MIDI control can drive a
    // SuperControl parameter (dimmer / pan / RGB / etc.) across the current
    // fixture selection. Templates that prefer this route ship an empty
    // midiMappings, so the two paths don't double-write the same channel.
    if (superControlMidiMappings && superControlMidiMappings.length > 0) {
      superControlMidiMappings.forEach((binding) => {
        if (binding.channel !== latestMessage.channel) return;

        let matched = false;
        let midiValue = 0;

        if (latestType === 'cc' && binding.controller !== undefined &&
            binding.controller === latestMessage.controller &&
            typeof latestMessage.value === 'number') {
          matched = true;
          midiValue = latestMessage.value;
        } else if (latestType === 'noteon' && binding.note !== undefined &&
                   binding.note === latestMessage.note) {
          matched = true;
          midiValue = latestMessage.velocity ?? 0;
        } else if (latestType === 'pitch' && binding.pitch &&
                   typeof latestMessage.value === 'number') {
          matched = true;
          midiValue = normalizePitchToMidiValue(latestMessage.value);
        }

        if (matched) {
          const dmxValue = Math.max(0, Math.min(255, Math.round((midiValue / 127) * 255)));
          applySuperControlMidi(binding.controlName, dmxValue, binding.slotIndex);
        }
      });
    }

  }, [midiMessages, midiMappings, superControlMidiMappings, applySuperControlMidi, masterSliders, channelRangeMappings, stableFunctions, midiLearnTarget, normalizePitchToMidiValue, matchesPressMapping, superControlLearnTarget, rebindSuperControl, quickSceneSave, quickSceneSaveMidiMapping, quickSceneSaveB, quickSceneSaveBMidiMapping, quickSceneLoad, quickSceneMidiMapping, quickSceneLoadB, quickSceneLoadBMidiMapping]); // Use stable functions
  /**
   * Set a custom range mapping for a specific DMX channel
   */
  const setChannelRangeMapping = useCallback((dmxChannel: number, mapping: MidiRangeMapping) => {
    setChannelRangeMappings(prev => ({
      ...prev,
      [dmxChannel]: {
        ...prev[dmxChannel],
        ...mapping
      }
    }));
  }, []);

  /**
   * Get all custom range mappings
   */
  const getChannelRangeMappings = useCallback(() => {
    return channelRangeMappings;
  }, [channelRangeMappings]);

  // Expose setChannelRangeMapping and getChannelRangeMappings to window for testing/external use
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).midiDmxProcessor = {
        setChannelRangeMapping,
        getChannelRangeMappings,
      };
    }
    return () => {
      if (typeof window !== 'undefined') {
        delete (window as any).midiDmxProcessor;
      }
    };
  }, [setChannelRangeMapping, getChannelRangeMappings]);

  return null;
};

export default MidiDmxProcessor;
