import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useStore } from '../../store';
import { useMidiScaling, ScalingOptions } from '../../hooks/useMidiScaling';

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
    midiMessages,
    setDmxChannel,
    masterSliders,
    updateMasterSliderValue,
    midiLearnTarget,
    quickSceneLoad,
    quickSceneMidiMapping,
  } = useStore(state => ({
    midiMappings: state.midiMappings,
    midiMessages: state.midiMessages,
    setDmxChannel: state.setDmxChannel,
    masterSliders: state.masterSliders,
    updateMasterSliderValue: state.updateMasterSliderValue,
    midiLearnTarget: state.midiLearnTarget,
    quickSceneLoad: state.quickSceneLoad,
    quickSceneMidiMapping: state.quickSceneMidiMapping,
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
    console.log('[MidiDmxProcessor] MIDI mappings updated in store:', midiMappings);
  }, [midiMappings]);
    // Process MIDI messages and update DMX channels
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

    console.log(`[MidiDmxProcessor] Attempting to process MIDI message:`, latestMessage);

    // Skip processing if we're in MIDI Learn mode - let the Learn hook handle it
    if (midiLearnTarget !== null) {
      console.log(`[MidiDmxProcessor] Skipping processing - MIDI Learn mode active for:`, midiLearnTarget);
      return;
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
            console.log(`[MidiDmxProcessor] Master Slider "${slider.name}" matched MIDI. New value: ${newValueForMaster}`);
            stableFunctions.updateMasterSliderValue(slider.id, Math.max(0, Math.min(255, newValueForMaster)));
            messageHandledByMasterSlider = true;
            break; // Assuming one MIDI message controls at most one master slider
          }
        }
      }
    }

    // --- Process for Quick Scene Load MIDI Control ---
    if (!messageHandledByMasterSlider && quickSceneMidiMapping) {
      let quickSceneTriggered = false;
      
      // Check for CC messages
      if (((latestMessage as any).type || (latestMessage as any)._type) === 'cc' && 
          quickSceneMidiMapping.controller !== undefined &&
          quickSceneMidiMapping.channel === latestMessage.channel &&
          quickSceneMidiMapping.controller === latestMessage.controller) {
        
        console.log(`[MidiDmxProcessor] Quick Scene Load triggered by MIDI CC ${quickSceneMidiMapping.controller} on CH ${quickSceneMidiMapping.channel}`);
        quickSceneLoad();
        quickSceneTriggered = true;
      }
      // Check for Note messages
      else if (((latestMessage as any).type || (latestMessage as any)._type) === 'noteon' && 
               quickSceneMidiMapping.note !== undefined &&
               quickSceneMidiMapping.channel === latestMessage.channel &&
               quickSceneMidiMapping.note === latestMessage.note) {
        
        console.log(`[MidiDmxProcessor] Quick Scene Load triggered by MIDI Note ${quickSceneMidiMapping.note} on CH ${quickSceneMidiMapping.channel}`);
        quickSceneLoad();
        quickSceneTriggered = true;
      }
      
      if (quickSceneTriggered) {
        messageHandledByMasterSlider = true; // Prevent further processing
      }
    }

    // --- Process for Direct DMX Channel Mappings (if not handled by a master slider) ---
    const latestType = (latestMessage as any).type || (latestMessage as any)._type;

    if (!messageHandledByMasterSlider && latestType === 'cc' && typeof latestMessage.value === 'number') {
      console.log('[MidiDmxProcessor] Processing CC for Direct DMX. Mappings:', midiMappings);
      let dmxMatchFound = false;
      Object.entries(midiMappings).forEach(([dmxChannelStr, mapping]) => {
        if (!mapping) return;
        const dmxChannel = parseInt(dmxChannelStr, 10);
        if (mapping.controller !== undefined &&
            mapping.channel === latestMessage.channel &&
            mapping.controller === latestMessage.controller) {
            dmxMatchFound = true;
          
          console.log(`[MidiDmxProcessor] Found DMX channel mapping for CC ${mapping.controller} on CH ${mapping.channel} -> DMX CH ${dmxChannel}`);
          
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
          
          console.log(`[MidiDmxProcessor] MIDI CC ${mapping.controller} value ${latestMessage.value} -> DMX CH ${dmxChannel} value ${boundedValue}`);
          
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
        console.log('[MidiDmxProcessor] No DMX channel mapped to received CC (after master slider check).');
      }
    } else if (!messageHandledByMasterSlider && (latestType === 'noteon' || latestType === 'noteoff')) {
      // Handle direct Note On/Off to DMX mappings
      console.log('[MidiDmxProcessor] Processing Note for Direct DMX. Mappings:', midiMappings);
      let dmxMatchFound = false;
      Object.entries(midiMappings).forEach(([dmxChannelStr, mapping]) => {
        if (!mapping) return;
        const dmxChannel = parseInt(dmxChannelStr, 10);
        if (mapping.note !== undefined &&
            mapping.channel === latestMessage.channel &&
            mapping.note === latestMessage.note) {
            dmxMatchFound = true;
          
          console.log(`[MidiDmxProcessor] Found DMX channel mapping for Note ${mapping.note} on CH ${mapping.channel} -> DMX CH ${dmxChannel}`);
          
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
          
          console.log(`[MidiDmxProcessor] MIDI Note ${mapping.note} value ${noteValue} -> DMX CH ${dmxChannel} value ${boundedValue}`);
          
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
        console.log('[MidiDmxProcessor] No DMX channel mapped to received Note (after master slider check).');
      }    }
    
  }, [midiMessages, midiMappings, masterSliders, channelRangeMappings, stableFunctions, midiLearnTarget]); // Use stable functions
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
