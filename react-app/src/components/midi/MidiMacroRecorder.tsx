/**
 * MIDI Macro Recorder Component
 * Records MIDI/OSC actions for playback and automation
 */

import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '../../store';
import styles from './MidiMacroRecorder.module.scss';

export interface MacroStep {
  id: string;
  timestamp: number;
  type: 'dmx' | 'midi' | 'osc' | 'delay' | 'condition';
  action: string;
  data: Record<string, unknown>;
}

export interface Macro {
  id: string;
  name: string;
  description?: string;
  steps: MacroStep[];
  createdAt: number;
  updatedAt: number;
}

const MidiMacroRecorder: React.FC = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [macros, setMacros] = useState<Macro[]>([]);
  const [selectedMacro, setSelectedMacro] = useState<string | null>(null);
  const [recordingSteps, setRecordingSteps] = useState<MacroStep[]>([]);
  const recordingStartTime = useRef<number | null>(null);

  const {
    midiMessages,
    oscMessages,
    setDmxChannel,
    setMultipleDmxChannels
  } = useStore(state => ({
    midiMessages: state.midiMessages,
    oscMessages: state.oscMessages,
    setDmxChannel: state.setDmxChannel,
    setMultipleDmxChannels: state.setMultipleDmxChannels
  }));

  // Record MIDI messages
  useEffect(() => {
    if (!isRecording) return;

    const handleMidiMessage = (message: { channel: number; note?: number; controller?: number; velocity?: number; value?: number; type?: string; _type?: string; source?: string; timestamp?: number }) => {
      const step: MacroStep = {
        id: `step-${Date.now()}-${Math.random()}`,
        timestamp: Date.now() - (recordingStartTime.current || Date.now()),
        type: 'midi',
        action: 'midi_message',
        data: message
      };
      setRecordingSteps(prev => [...prev, step]);
    };

    // Monitor MIDI messages from store
    // Note: This is a simplified implementation. In production, you'd want to track
    // which messages have already been processed to avoid duplicates
    let lastMessageCount = 0;
    const checkMidiMessages = () => {
      const currentMessages = useStore.getState().midiMessages;
      if (currentMessages.length > lastMessageCount) {
        const newMessages = currentMessages.slice(lastMessageCount);
        newMessages.forEach(msg => handleMidiMessage(msg as any));
        lastMessageCount = currentMessages.length;
      }
    };

    const interval = setInterval(checkMidiMessages, 50); // Check every 50ms

    return () => {
      clearInterval(interval);
    };
  }, [isRecording]);

  // Start recording
  const startRecording = () => {
    setIsRecording(true);
    setRecordingSteps([]);
    recordingStartTime.current = Date.now();
  };

  // Stop recording
  const stopRecording = () => {
    setIsRecording(false);
    if (recordingSteps.length > 0) {
      const name = prompt('Enter macro name:');
      if (name) {
        const macro: Macro = {
          id: `macro-${Date.now()}`,
          name,
          steps: recordingSteps,
          createdAt: Date.now(),
          updatedAt: Date.now()
        };
        setMacros(prev => [...prev, macro]);
        setRecordingSteps([]);
      }
    }
    recordingStartTime.current = null;
  };

  // Play macro
  const playMacro = async (macroId: string) => {
    const macro = macros.find(m => m.id === macroId);
    if (!macro) return;

    setIsPlaying(true);
    const startTime = Date.now();

    for (const step of macro.steps) {
      const delay = step.timestamp - (Date.now() - startTime);
      if (delay > 0) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }

      switch (step.type) {
        case 'dmx':
          if (step.data.channel !== undefined && step.data.value !== undefined) {
            setDmxChannel(step.data.channel as number, step.data.value as number);
          }
          break;
        case 'midi':
          // Handle MIDI playback
          break;
        case 'osc':
          // Handle OSC playback
          break;
        case 'delay':
          await new Promise(resolve => setTimeout(resolve, step.data.duration as number || 0));
          break;
      }
    }

    setIsPlaying(false);
  };

  // Delete macro
  const deleteMacro = (macroId: string) => {
    if (confirm('Delete this macro?')) {
      setMacros(prev => prev.filter(m => m.id !== macroId));
    }
  };

  return (
    <div className={styles.macroRecorder}>
      <div className={styles.header}>
        <h2>MIDI/OSC Macro Recorder</h2>
        <div className={styles.controls}>
          {!isRecording ? (
            <button
              className={styles.recordButton}
              onClick={startRecording}
              disabled={isPlaying}
            >
              <i className="fas fa-circle"></i>
              Start Recording
            </button>
          ) : (
            <button
              className={styles.stopButton}
              onClick={stopRecording}
            >
              <i className="fas fa-stop"></i>
              Stop Recording
            </button>
          )}
        </div>
      </div>

      {isRecording && (
        <div className={styles.recordingIndicator}>
          <span className={styles.recordingDot}></span>
          Recording... ({recordingSteps.length} steps)
        </div>
      )}

      <div className={styles.macrosList}>
        <h3>Saved Macros</h3>
        {macros.length === 0 ? (
          <div className={styles.emptyState}>
            <p>No macros saved. Start recording to create one.</p>
          </div>
        ) : (
          <div className={styles.macrosGrid}>
            {macros.map(macro => (
              <div key={macro.id} className={styles.macroCard}>
                <div className={styles.macroHeader}>
                  <h4>{macro.name}</h4>
                  <div className={styles.macroActions}>
                    <button
                      className={styles.playButton}
                      onClick={() => playMacro(macro.id)}
                      disabled={isPlaying || isRecording}
                      title="Play macro"
                    >
                      <i className="fas fa-play"></i>
                    </button>
                    <button
                      className={styles.deleteButton}
                      onClick={() => deleteMacro(macro.id)}
                      title="Delete macro"
                    >
                      <i className="fas fa-trash"></i>
                    </button>
                  </div>
                </div>
                <p className={styles.macroInfo}>
                  {macro.steps.length} steps • {((macro.steps[macro.steps.length - 1]?.timestamp || 0) / 1000).toFixed(1)}s
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default MidiMacroRecorder;

