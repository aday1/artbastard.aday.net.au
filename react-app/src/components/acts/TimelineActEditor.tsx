import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useStore, Act, ActStep, TimelineEvent, TimelineMarker } from '../../store';
import { LucideIcon } from '../ui/LucideIcon';
import { useSocket } from '../../context/SocketContext';
import { TimelineEventTargetSelector } from './TimelineEventTargetSelector';
import { useAudioWaveform } from '../../hooks/useAudioWaveform';
import { useAudioFFT } from '../../hooks/useAudioFFT';
import styles from './TimelineActEditor.module.scss';

interface TimelineActEditorProps {
  act: Act;
  onClose: () => void;
}

interface StepBlock {
  step: ActStep;
  startTime: number; // Start time in milliseconds
  endTime: number; // End time in milliseconds
}

export const TimelineActEditor: React.FC<TimelineActEditorProps> = ({ act, onClose }) => {
  const {
    scenes,
    fixtures,
    groups,
    updateAct,
    addActStep,
    updateActStep,
    removeActStep,
    reorderActSteps,
    addTimelineEvent,
    updateTimelineEvent,
    removeTimelineEvent,
    midiMessages,
    oscMessages,
    startMidiLearn,
    cancelMidiLearn,
    midiLearnTarget,
    bpm
  } = useStore();

  const { socket } = useSocket();
  const { actPlaybackState } = useStore();

  const timelineRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const waveformCanvasRef = useRef<HTMLCanvasElement | null>(null);
  // Calculate default zoom to fill screen width (similar to SceneTimelineEditor)
  const calculateDefaultZoom = useCallback(() => {
    if (typeof window !== 'undefined') {
      const screenWidth = window.innerWidth;
      const targetWidth = Math.max(screenWidth * 0.9, 2000); // Use 90% of screen width, minimum 2000px
      // Calculate total duration from steps or use act.totalDuration
      const stepBlocks = act.steps.reduce((blocks, step, index) => {
        const startTime = blocks.length > 0 ? blocks[blocks.length - 1].endTime : 0;
        const endTime = startTime + step.duration;
        return [...blocks, { step, startTime, endTime }];
      }, [] as StepBlock[]);
      const totalDuration = stepBlocks.length > 0 ? stepBlocks[stepBlocks.length - 1].endTime : (act.totalDuration || 60000);
      return targetWidth / (totalDuration / 1000); // pixels per second
    }
    return 30; // Fallback: 30 pixels per second
  }, [act.steps, act.totalDuration]);
  
  const [zoom, setZoom] = useState(30); // Start with reasonable default
  const [scrollPosition, setScrollPosition] = useState(0);
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
  const [draggingStepId, setDraggingStepId] = useState<string | null>(null);
  const [resizingStepId, setResizingStepId] = useState<string | null>(null);
  const [draggingEventId, setDraggingEventId] = useState<string | null>(null);
  const [eventDragOffset, setEventDragOffset] = useState(0);
  const [dragOffset, setDragOffset] = useState(0);
  const [resizeStartWidth, setResizeStartWidth] = useState(0);
  const [resizeStartX, setResizeStartX] = useState(0);
  const [showAddStep, setShowAddStep] = useState(false);
  const hasDraggedEventRef = useRef(false);
  
  // Timeline event recording state
  const [recordingMode, setRecordingMode] = useState<'idle' | 'midi' | 'osc'>('idle');
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [showLanes, setShowLanes] = useState({ midi: true, osc: true });
  const [clickPosition, setClickPosition] = useState<number | null>(null); // Time position for adding events
  const [showTargetSelector, setShowTargetSelector] = useState(false);
  const [pendingEvent, setPendingEvent] = useState<{ type: 'midi' | 'osc'; time: number; data?: any } | null>(null);
  const [snapToGrid, setSnapToGrid] = useState(false);
  const [snapInterval, setSnapInterval] = useState(1000); // Default 1 second
  const [copiedEvents, setCopiedEvents] = useState<TimelineEvent[]>([]);
  const [editingMarker, setEditingMarker] = useState<string | null>(null);
  const [newMarkerName, setNewMarkerName] = useState('');
  const [showAddMarker, setShowAddMarker] = useState(false);
  const [editingDuration, setEditingDuration] = useState(false);
  const [durationInput, setDurationInput] = useState<string>('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  // DAW playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [playheadPosition, setPlayheadPosition] = useState(0); // Current playhead time in ms
  const [playbackDirection, setPlaybackDirection] = useState<1 | -1>(1);
  const [waveformData, setWaveformData] = useState<number[]>([]);
  const [showFFTGenerator, setShowFFTGenerator] = useState(false);
  const [fftAnalysisProgress, setFftAnalysisProgress] = useState(0);
  const playbackIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const { generateWaveform } = useAudioWaveform();
  const { analyzeAudioFile, generateLightshowFromFFT } = useAudioFFT();
  
  // Set initial zoom based on screen size
  useEffect(() => {
    setZoom(calculateDefaultZoom());
  }, [calculateDefaultZoom]);
  
  // Initialize act DAW defaults
  const [actState, setActState] = useState({
    playbackMode: act.playbackMode || 'loop',
    playbackSpeed: act.playbackSpeed || 1.0,
    syncToBpm: act.syncToBpm || false,
    bpmMultiplier: act.bpmMultiplier || 4,
    audioTrack: act.audioTrack,
    channelLanes: act.channelLanes || {}
  });
  
  // Calculate effective duration
  const effectiveDuration = actState.syncToBpm && bpm > 0
    ? (actState.bpmMultiplier || 4) * (60000 / bpm)
    : act.totalDuration;

  // Get timeline events from act
  const timelineEvents = act.timelineEvents || [];
  const midiEvents = timelineEvents.filter(e => e.type === 'midi');
  const oscEvents = timelineEvents.filter(e => e.type === 'osc');

  // Calculate step blocks with their positions - recalculate when act.steps changes
  const stepBlocks: StepBlock[] = React.useMemo(() => {
    return act.steps.reduce((blocks, step, index) => {
      const startTime = blocks.length > 0 ? blocks[blocks.length - 1].endTime : 0;
      const endTime = startTime + step.duration;
      return [...blocks, { step, startTime, endTime }];
    }, [] as StepBlock[]);
  }, [act.steps]);

  const totalDuration = stepBlocks.length > 0 ? stepBlocks[stepBlocks.length - 1].endTime : 0;
  
  // Playback controls
  const handlePlay = () => {
    setIsPlaying(true);
    setPlaybackDirection(1);
  };
  
  const handlePause = () => {
    setIsPlaying(false);
  };
  
  const handleStop = () => {
    setIsPlaying(false);
    setPlayheadPosition(0);
    setPlaybackDirection(1);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  };
  
  const handlePlaybackModeChange = (mode: 'loop' | 'pingpong' | 'forward' | 'backward' | 'once') => {
    setActState(prev => ({ ...prev, playbackMode: mode }));
    updateAct(act.id, { playbackMode: mode });
  };

  // Snap time to grid
  const snapTimeToGrid = useCallback((time: number): number => {
    if (!snapToGrid) return time;
    return Math.round(time / snapInterval) * snapInterval;
  }, [snapToGrid, snapInterval]);

  // Copy selected events
  const copyEvents = useCallback(() => {
    if (!selectedEventId) return;
    const selectedEvent = timelineEvents.find(e => e.id === selectedEventId);
    if (selectedEvent) {
      setCopiedEvents([selectedEvent]);
    }
  }, [selectedEventId, timelineEvents]);

  // Paste events at current playhead or selected time
  const pasteEvents = useCallback((pasteTime?: number) => {
    if (copiedEvents.length === 0) return;
    
    const pastePosition = pasteTime !== undefined ? pasteTime : playheadPosition;
    const timeOffset = pastePosition - copiedEvents[0].time;
    
    copiedEvents.forEach(event => {
      const newEvent: TimelineEvent = {
        ...event,
        id: `event_${Date.now()}_${Math.random()}`,
        time: Math.max(0, Math.min(event.time + timeOffset, effectiveDuration))
      };
      addTimelineEvent(act.id, newEvent);
    });
  }, [copiedEvents, playheadPosition, effectiveDuration, act.id, addTimelineEvent]);

  // Marker management functions
  const addMarker = useCallback((time: number, name: string = 'Marker') => {
    const newMarker: TimelineMarker = {
      id: `marker_${Date.now()}_${Math.random()}`,
      time: snapTimeToGrid(time),
      name: name.trim() || 'Marker',
      color: `hsl(${Math.floor(Math.random() * 360)}, 70%, 50%)`
    };
    const currentMarkers = act.markers || [];
    updateAct(act.id, {
      markers: [...currentMarkers, newMarker].sort((a, b) => a.time - b.time)
    });
    setShowAddMarker(false);
    setNewMarkerName('');
  }, [snapTimeToGrid, act.id, act.markers, updateAct]);

  const removeMarker = useCallback((markerId: string) => {
    const currentMarkers = act.markers || [];
    updateAct(act.id, {
      markers: currentMarkers.filter(m => m.id !== markerId)
    });
  }, [act.id, act.markers, updateAct]);

  const jumpToMarker = useCallback((markerId: string) => {
    const marker = act.markers?.find(m => m.id === markerId);
    if (marker) {
      setPlayheadPosition(marker.time);
      if (audioRef.current) {
        audioRef.current.currentTime = marker.time / 1000;
      }
    }
  }, [act.markers]);

  const jumpToNextMarker = useCallback(() => {
    const sortedMarkers = [...(act.markers || [])].sort((a, b) => a.time - b.time);
    const nextMarker = sortedMarkers.find(m => m.time > playheadPosition);
    if (nextMarker) {
      jumpToMarker(nextMarker.id);
    }
  }, [act.markers, playheadPosition, jumpToMarker]);

  const jumpToPreviousMarker = useCallback(() => {
    const sortedMarkers = [...(act.markers || [])].sort((a, b) => a.time - b.time);
    const prevMarker = [...sortedMarkers].reverse().find(m => m.time < playheadPosition);
    if (prevMarker) {
      jumpToMarker(prevMarker.id);
    }
  }, [act.markers, playheadPosition, jumpToMarker]);

  // Export act timeline to JSON file
  const exportActTimeline = useCallback(() => {
    const exportData = {
      act: {
        id: act.id,
        name: act.name,
        timelineEvents: act.timelineEvents || [],
        markers: act.markers || [],
        totalDuration: act.totalDuration,
        playbackMode: act.playbackMode,
        playbackSpeed: act.playbackSpeed,
        syncToBpm: act.syncToBpm,
        bpmMultiplier: act.bpmMultiplier,
        audioTrack: act.audioTrack
      },
      exportedAt: new Date().toISOString(),
      version: '1.0'
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${act.name.replace(/[^a-z0-9]/gi, '_')}_timeline.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [act]);

  // Import act timeline from JSON file
  const importActTimeline = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const importData = JSON.parse(event.target?.result as string);
        if (importData.act) {
          const updates: Partial<Act> = {};
          if (importData.act.timelineEvents) updates.timelineEvents = importData.act.timelineEvents;
          if (importData.act.markers) updates.markers = importData.act.markers;
          if (importData.act.totalDuration !== undefined) updates.totalDuration = importData.act.totalDuration;
          if (importData.act.playbackMode) updates.playbackMode = importData.act.playbackMode;
          if (importData.act.playbackSpeed !== undefined) updates.playbackSpeed = importData.act.playbackSpeed;
          if (importData.act.syncToBpm !== undefined) updates.syncToBpm = importData.act.syncToBpm;
          if (importData.act.bpmMultiplier !== undefined) updates.bpmMultiplier = importData.act.bpmMultiplier;
          if (importData.act.audioTrack) updates.audioTrack = importData.act.audioTrack;
          
          updateAct(act.id, updates);
        } else {
          alert('Invalid act timeline file format');
        }
      } catch (error) {
        console.error('Failed to import act timeline:', error);
        alert('Failed to import act timeline. Please check the file format.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }, [act.id, updateAct]);
  
  // Handle audio file import
  const handleAudioImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (!file.type.startsWith('audio/')) {
      alert('Please select an audio file');
      return;
    }
    
    // Generate waveform
    const waveform = await generateWaveform(file, 400);
    setWaveformData(waveform);
    
    // Create audio element
    const audioUrl = URL.createObjectURL(file);
    if (audioRef.current) {
      audioRef.current.src = audioUrl;
    } else {
      const audio = new Audio(audioUrl);
      audioRef.current = audio;
    }
    
    // Update act with audio track info
    const newAudioTrack = {
      url: audioUrl,
      name: file.name,
      waveform: waveform
    };
    
    setActState(prev => ({ ...prev, audioTrack: newAudioTrack }));
    updateAct(act.id, { audioTrack: newAudioTrack });
    
    // Set duration to audio length if available
    if (audioRef.current) {
      audioRef.current.addEventListener('loadedmetadata', () => {
        if (audioRef.current) {
          const audioDuration = audioRef.current.duration * 1000;
          // Could update act duration here if needed
        }
      });
    }
  };
  
  // Generate auto-lightshow from FFT
  const handleGenerateFFTLightshow = async () => {
    if (!actState.audioTrack) {
      alert('Please import an audio file first');
      return;
    }
    
    setShowFFTGenerator(true);
    setFftAnalysisProgress(0);
    
    try {
      // Get audio file from URL
      const response = await fetch(actState.audioTrack.url);
      const blob = await response.blob();
      const audioFile = new File([blob], actState.audioTrack.name, { type: blob.type });
      
      // Analyze audio
      setFftAnalysisProgress(25);
      const analysisData = await analyzeAudioFile(audioFile, 200);
      setFftAnalysisProgress(50);
      
      // Get available channels from fixtures
      const allChannels: number[] = [];
      fixtures.forEach(fixture => {
        fixture.channels.forEach((ch, index) => {
          const dmxAddress = fixture.startAddress + index - 1;
          if (dmxAddress >= 0 && dmxAddress < 512 && !allChannels.includes(dmxAddress)) {
            allChannels.push(dmxAddress);
          }
        });
      });
      
      // Distribute channels across frequency bands
      const bassChannels = allChannels.slice(0, Math.floor(allChannels.length / 3));
      const midChannels = allChannels.slice(
        Math.floor(allChannels.length / 3),
        Math.floor((allChannels.length * 2) / 3)
      );
      const trebleChannels = allChannels.slice(Math.floor((allChannels.length * 2) / 3));
      
      setFftAnalysisProgress(75);
      
      // Generate DMX events
      const events = generateLightshowFromFFT(analysisData, {
        bassChannels,
        midChannels,
        trebleChannels,
        intensityMultiplier: 0.8,
        threshold: 0.15
      });
      
      // Convert to timeline events and add to act
      events.forEach(event => {
        addTimelineEvent(act.id, {
          type: 'osc', // Using OSC type for DMX events
          time: event.time,
          targetType: 'dmxChannel',
          targetId: event.channel.toString(),
          targetValue: event.value
        });
      });
      
      setFftAnalysisProgress(100);
      setTimeout(() => {
        setShowFFTGenerator(false);
        setFftAnalysisProgress(0);
      }, 1000);
    } catch (error) {
      console.error('Error generating FFT lightshow:', error);
      alert('Error generating lightshow. Please try again.');
      setShowFFTGenerator(false);
      setFftAnalysisProgress(0);
    }
  };
  
  // Playback engine
  useEffect(() => {
    if (!isPlaying) {
      if (playbackIntervalRef.current) {
        clearInterval(playbackIntervalRef.current);
        playbackIntervalRef.current = null;
      }
      return;
    }
    
    const playbackMode = actState.playbackMode || 'loop';
    const playbackSpeed = actState.playbackSpeed || 1.0;
    const updateInterval = 16; // ~60fps
    
    // Sync audio playback
    if (audioRef.current && actState.audioTrack) {
      if (playbackDirection === 1) {
        audioRef.current.playbackRate = playbackSpeed;
        if (audioRef.current.paused) {
          audioRef.current.play().catch(console.error);
        }
      } else {
        audioRef.current.pause();
      }
    }
    
    playbackIntervalRef.current = setInterval(() => {
      setPlayheadPosition(prev => {
        const speedAdjustedDelta = (updateInterval * playbackSpeed * playbackDirection);
        let newPosition = prev + speedAdjustedDelta;
        
        if (playbackMode === 'once') {
          if (newPosition >= effectiveDuration) {
            setIsPlaying(false);
            return effectiveDuration;
          }
          return Math.min(newPosition, effectiveDuration);
        } else if (playbackMode === 'loop') {
          if (newPosition >= effectiveDuration) {
            return 0;
          }
          return newPosition;
        } else if (playbackMode === 'pingpong') {
          if (newPosition >= effectiveDuration) {
            setPlaybackDirection(-1);
            return effectiveDuration;
          } else if (newPosition <= 0) {
            setPlaybackDirection(1);
            return 0;
          }
          return newPosition;
        } else if (playbackMode === 'forward') {
          return Math.min(newPosition, effectiveDuration);
        } else if (playbackMode === 'backward') {
          if (newPosition <= 0) {
            setIsPlaying(false);
            return 0;
          }
          return newPosition;
        }
        
        return newPosition;
      });
    }, updateInterval);
    
    return () => {
      if (playbackIntervalRef.current) {
        clearInterval(playbackIntervalRef.current);
      }
    };
  }, [isPlaying, playbackDirection, actState.playbackMode, actState.playbackSpeed, effectiveDuration, actState.audioTrack]);
  
  // Sync audio position with playhead
  useEffect(() => {
    if (audioRef.current && actState.audioTrack && isPlaying) {
      const audioTime = playheadPosition / 1000;
      if (Math.abs(audioRef.current.currentTime - audioTime) > 0.1) {
        audioRef.current.currentTime = audioTime;
      }
    }
  }, [playheadPosition, isPlaying, actState.audioTrack]);
  
  // Draw waveform on canvas
  useEffect(() => {
    if (waveformCanvasRef.current && waveformData.length > 0 && actState.audioTrack) {
      const canvas = waveformCanvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      
      const width = canvas.width;
      const height = canvas.height;
      const samples = waveformData.length;
      const barWidth = width / samples;
      
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = 'rgba(59, 130, 246, 0.6)';
      
      waveformData.forEach((sample, index) => {
        const barHeight = sample * height * 0.8;
        const x = index * barWidth;
        const y = (height - barHeight) / 2;
        ctx.fillRect(x, y, Math.max(1, barWidth - 1), barHeight);
      });
      
      // Draw playhead position on waveform
      if (isPlaying) {
        const playheadX = (playheadPosition / effectiveDuration) * width;
        ctx.strokeStyle = 'rgba(255, 0, 0, 0.8)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(playheadX, 0);
        ctx.lineTo(playheadX, height);
        ctx.stroke();
      }
    }
  }, [waveformData, playheadPosition, isPlaying, effectiveDuration, actState.audioTrack]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        if (actState.audioTrack?.url) {
          URL.revokeObjectURL(actState.audioTrack.url);
        }
      }
    };
  }, []);

  // Convert time to pixel position
  const timeToPixels = useCallback((timeMs: number) => {
    return (timeMs / 1000) * zoom;
  }, [zoom]);

  // Convert pixel position to time
  const pixelsToTime = useCallback((pixels: number) => {
    return (pixels / zoom) * 1000;
  }, [zoom]);

  // Format time for display
  const formatTime = useCallback((ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const milliseconds = Math.floor((ms % 1000) / 100);
    return `${minutes}:${seconds.toString().padStart(2, '0')}.${milliseconds}`;
  }, []);

  // Handle step drag start
  const handleStepMouseDown = useCallback((e: React.MouseEvent, stepId: string, startTime: number) => {
    e.preventDefault();
    e.stopPropagation();
    
    const rect = timelineRef.current?.getBoundingClientRect();
    if (!rect) return;

    const mouseX = e.clientX - rect.left + scrollPosition;
    const stepX = timeToPixels(startTime);
    setDragOffset(mouseX - stepX);
    setDraggingStepId(stepId);
    setSelectedStepId(stepId);
  }, [scrollPosition, timeToPixels]);

  // Handle step resize start
  const handleResizeMouseDown = useCallback((e: React.MouseEvent, stepId: string, currentDuration: number) => {
    e.preventDefault();
    e.stopPropagation();
    
    setResizingStepId(stepId);
    setResizeStartWidth(timeToPixels(currentDuration));
    setResizeStartX(e.clientX);
    setSelectedStepId(stepId);
  }, [timeToPixels]);

  // Handle mouse move for dragging/resizing
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      // Handle event dragging
      if (draggingEventId && timelineRef.current) {
        hasDraggedEventRef.current = true;
        const rect = timelineRef.current.getBoundingClientRect();
        const mouseX = e.clientX - rect.left + scrollPosition;
        let newTime = Math.max(0, pixelsToTime(mouseX - eventDragOffset));
        newTime = snapTimeToGrid(newTime);
        
        // Update event time
        updateTimelineEvent(act.id, draggingEventId, { time: newTime });
      }
      
      if (draggingStepId && timelineRef.current) {
        const rect = timelineRef.current.getBoundingClientRect();
        const mouseX = e.clientX - rect.left + scrollPosition;
        const newStartTime = Math.max(0, pixelsToTime(mouseX - dragOffset));
        
        // Find the step index being dragged
        const stepIndex = act.steps.findIndex(s => s.id === draggingStepId);
        if (stepIndex >= 0) {
          // Find which step index the new position corresponds to
          let newIndex = 0;
          let cumulativeTime = 0;
          
          for (let i = 0; i < stepBlocks.length; i++) {
            if (i === stepIndex) continue; // Skip the dragged step
            
            const block = stepBlocks[i];
            const blockCenter = block.startTime + (block.step.duration / 2);
            
            if (newStartTime >= cumulativeTime && newStartTime < blockCenter) {
              newIndex = i;
              break;
            }
            
            cumulativeTime += block.step.duration;
            if (newStartTime >= cumulativeTime) {
              newIndex = i + 1;
            }
          }
          
          // Clamp to valid range
          newIndex = Math.max(0, Math.min(newIndex, act.steps.length - 1));
          
          // Only reorder if position changed
          if (newIndex !== stepIndex) {
            const newOrder = [...act.steps];
            const [movedStep] = newOrder.splice(stepIndex, 1);
            newOrder.splice(newIndex, 0, movedStep);
            reorderActSteps(act.id, newOrder.map(s => s.id));
          }
        }
      }

      if (resizingStepId && timelineRef.current) {
        const rect = timelineRef.current.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const deltaX = mouseX - resizeStartX;
        const deltaTime = pixelsToTime(deltaX);
        
        const step = act.steps.find(s => s.id === resizingStepId);
        if (step) {
          const newDuration = Math.max(100, step.duration + deltaTime);
          updateActStep(act.id, resizingStepId, { duration: newDuration });
          setResizeStartX(mouseX);
        }
      }
    };

    const handleMouseUp = () => {
      // Small delay to prevent click events from firing after drag
      setTimeout(() => {
        if (draggingEventId) {
          hasDraggedEventRef.current = false;
        }
        setDraggingStepId(null);
        setResizingStepId(null);
        setDraggingEventId(null);
        setDragOffset(0);
        setEventDragOffset(0);
        setResizeStartWidth(0);
        setResizeStartX(0);
      }, 100);
    };

    if (draggingStepId || resizingStepId || draggingEventId) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [draggingStepId, resizingStepId, draggingEventId, dragOffset, eventDragOffset, resizeStartX, scrollPosition, act, stepBlocks, pixelsToTime, updateActStep, reorderActSteps, updateTimelineEvent, act.id, snapTimeToGrid]);

  // Generate time markers
  const timeMarkers = [];
  const markerInterval = zoom > 2 ? 1000 : zoom > 1 ? 5000 : 10000; // Adjust interval based on zoom
  for (let time = 0; time <= effectiveDuration; time += markerInterval) {
    timeMarkers.push(time);
  }

  // Handle zoom
  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev * 1.5, 10));
  };

  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev / 1.5, 0.1));
  };

  const handleZoomReset = () => {
    setZoom(1);
    setScrollPosition(0);
  };

  // Handle scroll
  const handleTimelineScroll = (e: React.UIEvent<HTMLDivElement>) => {
    setScrollPosition(e.currentTarget.scrollLeft);
  };

  // Handle mouse wheel zoom - works anywhere in timeline, with or without Ctrl
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      // Check if we're over the timeline area
      const timelineElement = timelineRef.current;
      if (!timelineElement) return;
      
      const rect = timelineElement.getBoundingClientRect();
      const isOverTimeline = e.clientX >= rect.left && e.clientX <= rect.right &&
                             e.clientY >= rect.top && e.clientY <= rect.bottom;
      
      if (isOverTimeline) {
        // Zoom with Ctrl/Cmd, or just scroll normally without modifier
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          if (e.deltaY < 0) {
            handleZoomIn();
          } else {
            handleZoomOut();
          }
        }
        // Also allow zoom with Shift+Wheel for easier access
        else if (e.shiftKey) {
          e.preventDefault();
          if (e.deltaY < 0) {
            handleZoomIn();
          } else {
            handleZoomOut();
          }
        }
      }
    };
    
    window.addEventListener('wheel', handleWheel, { passive: false });
    return () => window.removeEventListener('wheel', handleWheel);
  }, [handleZoomIn, handleZoomOut]);

  // Fullscreen toggle
  const toggleFullscreen = useCallback(() => {
    if (!isFullscreen) {
      const elem = document.documentElement;
      if (elem.requestFullscreen) {
        elem.requestFullscreen();
      } else if ((elem as any).webkitRequestFullscreen) {
        (elem as any).webkitRequestFullscreen();
      } else if ((elem as any).msRequestFullscreen) {
        (elem as any).msRequestFullscreen();
      }
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if ((document as any).webkitExitFullscreen) {
        (document as any).webkitExitFullscreen();
      } else if ((document as any).msExitFullscreen) {
        (document as any).msExitFullscreen();
      }
      setIsFullscreen(false);
    }
  }, [isFullscreen]);

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('msfullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('msfullscreenchange', handleFullscreenChange);
    };
  }, []);

  // Handle timeline click to add event
  const handleTimelineClick = useCallback((e: React.MouseEvent) => {
    if (!timelineRef.current) return;
    
    const rect = timelineRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left + scrollPosition;
    const time = pixelsToTime(x);
    
    // If recording, set click position for event recording
    if (recordingMode !== 'idle') {
      setClickPosition(time);
      return;
    }
    
    // Otherwise, scrub the timeline (seek to position)
    setPlayheadPosition(Math.max(0, Math.min(time, effectiveDuration)));
    
    // If audio is playing, seek the audio as well
    if (audioRef.current && actState.audioTrack) {
      const audioTime = time / 1000; // Convert ms to seconds
      audioRef.current.currentTime = Math.max(0, Math.min(audioTime, audioRef.current.duration));
    }
  }, [scrollPosition, pixelsToTime, recordingMode, effectiveDuration, actState.audioTrack, snapTimeToGrid]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle shortcuts when typing in inputs
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      
      // Copy/Paste (Ctrl+C / Ctrl+V)
      if ((e.ctrlKey || e.metaKey) && e.key === 'c' && selectedEventId) {
        e.preventDefault();
        copyEvents();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        e.preventDefault();
        pasteEvents();
        return;
      }
      
      // Marker navigation (M = next, Shift+M = previous)
      if (e.key === 'm' || e.key === 'M') {
        if (e.shiftKey) {
          e.preventDefault();
          jumpToPreviousMarker();
        } else {
          e.preventDefault();
          jumpToNextMarker();
        }
        return;
      }
      
      // Escape to clear selection or close menus
      if (e.key === 'Escape') {
        setSelectedEventId(null);
        setShowAddMarker(false);
      }
      // F11 for fullscreen
      if (e.key === 'F11') {
        e.preventDefault();
        toggleFullscreen();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedEventId, copyEvents, pasteEvents, jumpToNextMarker, jumpToPreviousMarker, toggleFullscreen]);

  // Handle MIDI learn - listen for messages when recording
  useEffect(() => {
    if (recordingMode === 'midi' && clickPosition !== null) {
      const handleMidiMessage = () => {
        if (midiMessages.length > 0) {
          const latestMessage = midiMessages[midiMessages.length - 1];
          const messageType = (latestMessage as any).type || (latestMessage as any)._type;
          
          if (messageType === 'cc' && latestMessage.controller !== undefined) {
            // Store pending event and show target selector
            setPendingEvent({
              type: 'midi',
              time: clickPosition,
              data: {
                midiChannel: latestMessage.channel,
                midiController: latestMessage.controller,
                midiValue: latestMessage.value,
                midiType: 'cc'
              }
            });
            setShowTargetSelector(true);
            setRecordingMode('idle');
            setClickPosition(null);
            cancelMidiLearn();
          } else if (messageType === 'noteon' && latestMessage.note !== undefined) {
            setPendingEvent({
              type: 'midi',
              time: clickPosition,
              data: {
                midiChannel: latestMessage.channel,
                midiNote: latestMessage.note,
                midiValue: latestMessage.velocity,
                midiType: 'noteon'
              }
            });
            setShowTargetSelector(true);
            setRecordingMode('idle');
            setClickPosition(null);
            cancelMidiLearn();
          }
        }
      };

      // Check for new messages
      if (midiMessages.length > 0) {
        handleMidiMessage();
      }
    }
  }, [midiMessages, recordingMode, clickPosition, act.id, cancelMidiLearn]);

  // Handle target selection
  const handleTargetSelect = useCallback((targetType: 'fixture' | 'scene' | 'dmxChannel' | 'group', targetId: string, targetValue?: number) => {
    if (pendingEvent) {
      addTimelineEvent(act.id, {
        type: pendingEvent.type,
        time: pendingEvent.time,
        ...pendingEvent.data,
        targetType,
        targetId,
        targetValue
      });
      setPendingEvent(null);
      setShowTargetSelector(false);
    }
  }, [pendingEvent, act.id, addTimelineEvent]);
  
  const handleTargetCancel = useCallback(() => {
    setPendingEvent(null);
    setShowTargetSelector(false);
    setRecordingMode('idle');
    setClickPosition(null);
    cancelMidiLearn();
  }, [cancelMidiLearn]);

  // Handle OSC learn
  useEffect(() => {
    if (recordingMode === 'osc' && clickPosition !== null && oscMessages.length > 0 && socket) {
      const latestMessage = oscMessages[oscMessages.length - 1];
      
      addTimelineEvent(act.id, {
        type: 'osc',
        time: clickPosition,
        oscAddress: latestMessage.address,
        oscArgs: latestMessage.args
      });
      setRecordingMode('idle');
      setClickPosition(null);
    }
  }, [oscMessages, recordingMode, clickPosition, act.id, addTimelineEvent, socket]);

  // Initialize audio track from act
  useEffect(() => {
    if (act.audioTrack && !actState.audioTrack) {
      setActState(prev => ({ ...prev, audioTrack: act.audioTrack }));
      if (act.audioTrack.waveform) {
        setWaveformData(act.audioTrack.waveform);
      }
    }
  }, [act.audioTrack]);

  // Add new step form state
  const [newStepScene, setNewStepScene] = useState('');
  const [newStepDuration, setNewStepDuration] = useState(5000);
  const [newStepTransitionDuration, setNewStepTransitionDuration] = useState(1000);
  const [newStepNotes, setNewStepNotes] = useState('');

  // Add new step
  const handleAddStep = () => {
    if (newStepScene && newStepDuration > 0) {
      addActStep(act.id, {
        sceneName: newStepScene,
        duration: newStepDuration,
        transitionDuration: newStepTransitionDuration,
        notes: newStepNotes || undefined
      });
      
      // Reset form
      setNewStepScene('');
      setNewStepDuration(5000);
      setNewStepTransitionDuration(1000);
      setNewStepNotes('');
      setShowAddStep(false);
    }
  };

  return (
    <div className={`${styles.timelineEditor} ${isFullscreen ? styles.fullscreen : ''}`}>
      {/* Hidden audio element */}
      {actState.audioTrack && (
        <audio
          ref={audioRef}
          src={actState.audioTrack.url}
          onEnded={() => {
            if (actState.playbackMode === 'once') {
              handleStop();
            }
          }}
        />
      )}
      
      <div className={styles.editorHeader}>
        <div className={styles.headerLeft}>
          <h3>
            <LucideIcon name="Clock" />
            Timeline Editor: {act.name}
          </h3>
          <div className={styles.durationControl}>
            {editingDuration ? (
              <input
                type="number"
                min="1000"
                max="3600000"
                step="1000"
                value={durationInput}
                onChange={(e) => setDurationInput(e.target.value)}
                onBlur={() => {
                  const seconds = parseFloat(durationInput);
                  if (!isNaN(seconds) && seconds > 0) {
                    const newDuration = Math.round(seconds * 1000);
                    // Update act totalDuration
                    updateAct(act.id, { totalDuration: newDuration });
                  }
                  setEditingDuration(false);
                  setDurationInput('');
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.currentTarget.blur();
                  } else if (e.key === 'Escape') {
                    setEditingDuration(false);
                    setDurationInput('');
                  }
                }}
                autoFocus
                className={styles.durationInput}
              />
            ) : (
              <button
                className={styles.durationButton}
                onClick={() => {
                  setDurationInput((effectiveDuration / 1000).toFixed(1));
                  setEditingDuration(true);
                }}
                title="Click to edit act duration"
              >
                <LucideIcon name="Clock" size={16} />
                <span>Total: {formatTime(effectiveDuration)}</span>
              </button>
            )}
          </div>
        </div>
        
        {/* DAW Playback Controls */}
        <div className={styles.dawControls}>
          <div className={styles.playbackButtons}>
            <button
              className={styles.playButton}
              onClick={isPlaying ? handlePause : handlePlay}
              title={isPlaying ? 'Pause' : 'Play'}
            >
              <LucideIcon name={isPlaying ? 'Pause' : 'Play'} />
            </button>
            <button
              className={styles.stopButton}
              onClick={handleStop}
              title="Stop"
            >
              <LucideIcon name="Square" />
            </button>
          </div>
          
          <div className={styles.playbackMode}>
            <label>Mode:</label>
            <select
              value={actState.playbackMode || 'loop'}
              onChange={(e) => handlePlaybackModeChange(e.target.value as any)}
            >
              <option value="loop">Loop</option>
              <option value="pingpong">Ping-Pong</option>
              <option value="forward">Forward</option>
              <option value="backward">Backward</option>
              <option value="once">Once</option>
            </select>
          </div>
          
          <div className={styles.speedControl}>
            <label>Speed:</label>
            <input
              type="range"
              min="0.1"
              max="4.0"
              step="0.1"
              value={actState.playbackSpeed || 1.0}
              onChange={(e) => {
                const speed = Number(e.target.value);
                setActState(prev => ({ ...prev, playbackSpeed: speed }));
                updateAct(act.id, { playbackSpeed: speed });
              }}
            />
            <span>{actState.playbackSpeed?.toFixed(1) || '1.0'}x</span>
          </div>
          
          <div className={styles.bpmSync}>
            <label>
              <input
                type="checkbox"
                checked={actState.syncToBpm || false}
                onChange={(e) => {
                  const sync = e.target.checked;
                  setActState(prev => ({ ...prev, syncToBpm: sync }));
                  updateAct(act.id, { syncToBpm: sync });
                }}
              />
              Sync to BPM ({bpm})
            </label>
            {actState.syncToBpm && (
              <input
                type="number"
                min="1"
                max="32"
                value={actState.bpmMultiplier || 4}
                onChange={(e) => {
                  const mult = Number(e.target.value);
                  setActState(prev => ({ ...prev, bpmMultiplier: mult }));
                  updateAct(act.id, { bpmMultiplier: mult });
                }}
                style={{ width: '50px', marginLeft: '8px' }}
              />
            )}
          </div>
          
          <div className={styles.audioImport}>
            <label className={styles.importButton}>
              <LucideIcon name="Music" />
              Import Audio
              <input
                type="file"
                accept="audio/*"
                onChange={handleAudioImport}
                style={{ display: 'none' }}
              />
            </label>
            {actState.audioTrack && (
              <>
                <span className={styles.audioName} title={actState.audioTrack.name}>
                  {actState.audioTrack.name}
                </span>
                <button
                  className={styles.fftButton}
                  onClick={handleGenerateFFTLightshow}
                  title="Generate Auto Lightshow from Audio"
                >
                  <LucideIcon name="Zap" />
                  Auto Lightshow
                </button>
              </>
            )}
          </div>
        </div>
        
        <div className={styles.headerActions}>
          <div className={styles.zoomControls}>
            <button onClick={handleZoomOut} title="Zoom Out (Ctrl+Wheel or Shift+Wheel)">
              <LucideIcon name="ZoomOut" />
            </button>
            <span className={styles.zoomLevel}>{Math.round(zoom * 10)}px/s</span>
            <button onClick={handleZoomIn} title="Zoom In (Ctrl+Wheel or Shift+Wheel)">
              <LucideIcon name="ZoomIn" />
            </button>
            <button onClick={handleZoomReset} title="Reset Zoom">
              <LucideIcon name="RotateCcw" />
            </button>
            <button 
              onClick={toggleFullscreen} 
              title={isFullscreen ? "Exit Fullscreen (F11)" : "Enter Fullscreen (F11)"}
              className={styles.fullscreenButton}
            >
              <LucideIcon name={isFullscreen ? "Minimize2" : "Maximize2"} />
            </button>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted-color, #888)', marginLeft: '8px', whiteSpace: 'nowrap' }}>
              Ctrl+Wheel or Shift+Wheel to zoom
            </span>
          </div>
          <div className={styles.laneToggle}>
            <button
              className={`${styles.laneToggleButton} ${showLanes.midi ? styles.active : ''}`}
              onClick={() => setShowLanes({ ...showLanes, midi: !showLanes.midi })}
              title="Toggle MIDI Lane"
            >
              <LucideIcon name="Music" />
              MIDI
            </button>
            <button
              className={`${styles.laneToggleButton} ${showLanes.osc ? styles.active : ''}`}
              onClick={() => setShowLanes({ ...showLanes, osc: !showLanes.osc })}
              title="Toggle OSC Lane"
            >
              <LucideIcon name="Radio" />
              OSC
            </button>
          </div>
          <div className={styles.recordControls}>
            <button
              className={`${styles.recordButton} ${recordingMode === 'midi' ? styles.recording : ''}`}
              onClick={() => {
                if (recordingMode === 'midi') {
                  setRecordingMode('idle');
                  cancelMidiLearn();
                } else {
                  setRecordingMode('midi');
                }
              }}
              title="Record MIDI Event"
            >
              <LucideIcon name={recordingMode === 'midi' ? 'Square' : 'Circle'} />
              {recordingMode === 'midi' ? 'Stop MIDI' : 'Record MIDI'}
            </button>
            <button
              className={`${styles.recordButton} ${recordingMode === 'osc' ? styles.recording : ''}`}
              onClick={() => {
                setRecordingMode(recordingMode === 'osc' ? 'idle' : 'osc');
              }}
              title="Record OSC Event - Click timeline to set time, then send OSC message. Events are recorded with passthrough (messages continue working) and replayed during act playback."
            >
              <LucideIcon name={recordingMode === 'osc' ? 'Square' : 'Circle'} />
              {recordingMode === 'osc' ? 'Stop OSC' : 'Record OSC'}
            </button>
          </div>
          <button
            className={styles.addStepButton}
            onClick={() => setShowAddStep(!showAddStep)}
            title="Add Step"
          >
            <LucideIcon name="Plus" />
            Add Step
          </button>
          <div className={styles.snapControls}>
            <label title="Snap events to grid">
              <input
                type="checkbox"
                checked={snapToGrid}
                onChange={(e) => setSnapToGrid(e.target.checked)}
              />
              Snap
            </label>
            {snapToGrid && (
              <select
                value={snapInterval}
                onChange={(e) => setSnapInterval(Number(e.target.value))}
                className={styles.snapInterval}
                title="Snap interval"
              >
                <option value="100">0.1s</option>
                <option value="250">0.25s</option>
                <option value="500">0.5s</option>
                <option value="1000">1s</option>
                <option value="2000">2s</option>
                <option value="5000">5s</option>
                <option value="10000">10s</option>
              </select>
            )}
          </div>
          <button 
            className={styles.copyButton}
            onClick={copyEvents}
            disabled={!selectedEventId}
            title="Copy Selected Event (Ctrl+C)"
          >
            <LucideIcon name="Copy" />
            Copy
          </button>
          <button 
            className={styles.pasteButton}
            onClick={() => pasteEvents()}
            disabled={copiedEvents.length === 0}
            title="Paste Event at Playhead (Ctrl+V)"
          >
            <LucideIcon name="Clipboard" />
            Paste
          </button>
          <button 
            className={styles.markerButton}
            onClick={() => {
              setShowAddMarker(true);
              setNewMarkerName('');
            }}
            title="Add Marker at Playhead (M = next, Shift+M = previous)"
          >
            <LucideIcon name="Flag" />
            Add Marker
          </button>
          <label className={styles.importTimelineButton} title="Import Timeline from JSON file">
            <LucideIcon name="Upload" />
            Import
            <input
              type="file"
              accept=".json"
              onChange={importActTimeline}
              style={{ display: 'none' }}
            />
          </label>
          <button 
            className={styles.exportButton}
            onClick={exportActTimeline}
            title="Export Timeline to JSON file"
          >
            <LucideIcon name="Download" />
            Export
          </button>
          <button className={styles.closeButton} onClick={onClose}>
            <LucideIcon name="X" />
            Close
          </button>
        </div>
      </div>

      {/* Add Step Form */}
      {showAddStep && (
        <div className={styles.addStepForm}>
          <h4>Add New Step</h4>
          <div className={styles.addStepFormContent}>
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
            
            <div className={styles.formActions}>
              <button
                className={styles.addButton}
                onClick={handleAddStep}
                disabled={!newStepScene}
              >
                <LucideIcon name="Plus" />
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

      <div className={styles.timelineContainer}>
        {/* Waveform Visualization */}
        {actState.audioTrack && waveformData.length > 0 && (
          <div className={styles.waveformTrack} style={{ width: `${timeToPixels(effectiveDuration)}px` }}>
            <canvas
              ref={waveformCanvasRef}
              width={timeToPixels(effectiveDuration)}
              height={80}
              className={styles.waveformCanvas}
            />
          </div>
        )}
        
        {/* Marker Lane */}
        <div className={styles.markerLane} style={{ width: `${timeToPixels(effectiveDuration)}px` }}>
          {(act.markers || []).map(marker => (
            <div
              key={marker.id}
              className={styles.timelineMarker}
              style={{ 
                left: `${timeToPixels(marker.time)}px`,
                backgroundColor: marker.color || 'var(--accent-color, #f59e0b)'
              }}
              title={`${marker.name} - ${formatTime(marker.time)} (Click to jump, Right-click to edit)`}
              onClick={() => jumpToMarker(marker.id)}
              onContextMenu={(e) => {
                e.preventDefault();
                setEditingMarker(marker.id);
                setNewMarkerName(marker.name);
              }}
            >
              <div className={styles.markerLine} />
              <div className={styles.markerLabel}>{marker.name}</div>
              {editingMarker === marker.id && (
                <div className={styles.markerEditPanel}>
                  <input
                    type="text"
                    value={newMarkerName}
                    onChange={(e) => setNewMarkerName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const currentMarkers = act.markers || [];
                        updateAct(act.id, {
                          markers: currentMarkers.map(m => 
                            m.id === marker.id ? { ...m, name: newMarkerName.trim() || 'Marker' } : m
                          )
                        });
                        setEditingMarker(null);
                        setNewMarkerName('');
                      } else if (e.key === 'Escape') {
                        setEditingMarker(null);
                        setNewMarkerName('');
                      }
                    }}
                    onBlur={() => {
                      const currentMarkers = act.markers || [];
                      updateAct(act.id, {
                        markers: currentMarkers.map(m => 
                          m.id === marker.id ? { ...m, name: newMarkerName.trim() || 'Marker' } : m
                        )
                      });
                      setEditingMarker(null);
                      setNewMarkerName('');
                    }}
                    autoFocus
                  />
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeMarker(marker.id);
                      setEditingMarker(null);
                    }}
                    title="Delete Marker"
                  >
                    <LucideIcon name="Trash2" size={14} />
                  </button>
                </div>
              )}
            </div>
          ))}
          {showAddMarker && (
            <div 
              className={styles.addMarkerPanel}
              style={{ left: `${timeToPixels(playheadPosition)}px` }}
            >
              <input
                type="text"
                placeholder="Marker name..."
                value={newMarkerName}
                onChange={(e) => setNewMarkerName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    addMarker(playheadPosition, newMarkerName);
                  } else if (e.key === 'Escape') {
                    setShowAddMarker(false);
                    setNewMarkerName('');
                  }
                }}
                onBlur={() => {
                  if (newMarkerName.trim()) {
                    addMarker(playheadPosition, newMarkerName);
                  } else {
                    setShowAddMarker(false);
                  }
                }}
                autoFocus
              />
            </div>
          )}
        </div>
        
        {/* Time Ruler */}
        <div className={styles.timeRuler} style={{ width: `${timeToPixels(effectiveDuration)}px` }}>
          {timeMarkers.map(time => (
            <div
              key={time}
              className={styles.timeMarker}
              style={{ left: `${timeToPixels(time)}px` }}
            >
              <div className={styles.markerLine} />
              <div className={styles.markerLabel}>{formatTime(time)}</div>
            </div>
          ))}
          
          {/* Playhead - Always visible when playing or positioned */}
          {(isPlaying || playheadPosition > 0) && (
            <div
              className={styles.playhead}
              style={{ 
                left: `${timeToPixels(playheadPosition)}px`,
                opacity: isPlaying ? 1 : 0.5
              }}
            />
          )}
        </div>

        {/* Timeline Track */}
        <div
          ref={timelineRef}
          className={styles.timelineTrack}
          onScroll={handleTimelineScroll}
          onClick={(e) => {
            // Don't handle timeline click if clicking on an event marker or step block
            if ((e.target as HTMLElement).closest(`.${styles.eventMarker}`) ||
                (e.target as HTMLElement).closest(`.${styles.stepBlock}`)) {
              return;
            }
            handleTimelineClick(e);
          }}
        >
          <div className={styles.timelineContent} style={{ width: `${timeToPixels(totalDuration)}px` }}>
            {/* Grid background for fine-tuning */}
            <svg 
              className={styles.timelineGrid}
              width={timeToPixels(totalDuration)}
              height="100%"
              style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 1 }}
            >
              <defs>
                {/* Horizontal grid lines */}
                <pattern id="timelineGridHorizontal" x="0" y="0" width="100%" height="20" patternUnits="userSpaceOnUse">
                  <line x1="0" y1="20" x2="100%" y2="20" stroke="rgba(148, 163, 184, 0.2)" strokeWidth="0.5" />
                </pattern>
                {/* Vertical grid lines (time divisions) */}
                <pattern id="timelineGridVertical" x="0" y="0" width={Math.max(zoom * 10, 25)} height="100%" patternUnits="userSpaceOnUse">
                  <line x1={Math.max(zoom * 10, 25)} y1="0" x2={Math.max(zoom * 10, 25)} y2="100%" stroke="rgba(148, 163, 184, 0.3)" strokeWidth="0.5" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#timelineGridHorizontal)" />
              <rect width="100%" height="100%" fill="url(#timelineGridVertical)" />
            </svg>
            {/* MIDI Lane */}
            {showLanes.midi && (() => {
              const midiLaneState = actState.channelLanes?.[-1] || { muted: false, soloed: false }; // Use -1 as ID for MIDI lane
              const midiIsMuted = midiLaneState.muted;
              const midiIsSoloed = midiLaneState.soloed;
              const hasSoloedLanes = Object.values(actState.channelLanes || {}).some(lane => lane.soloed);
              const shouldShowMidi = !hasSoloedLanes || midiIsSoloed;
              
              return (
              <div className={`${styles.eventLane} ${midiIsMuted ? styles.muted : ''} ${midiIsSoloed ? styles.soloed : ''} ${!shouldShowMidi ? styles.hidden : ''}`}>
                <div className={styles.laneLabel}>
                  <div className={styles.laneLabelContent}>
                    <LucideIcon name="Music" />
                    <span>MIDI</span>
                  </div>
                  <div className={styles.laneControls}>
                    <button
                      className={`${styles.muteButton} ${midiIsMuted ? styles.active : ''}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setActState(prev => ({
                          ...prev,
                          channelLanes: {
                            ...prev.channelLanes,
                            [-1]: {
                              ...(prev.channelLanes?.[-1] || { muted: false, soloed: false }),
                              muted: !midiIsMuted
                            }
                          }
                        }));
                        updateAct(act.id, {
                          channelLanes: {
                            ...actState.channelLanes,
                            [-1]: {
                              ...(actState.channelLanes?.[-1] || { muted: false, soloed: false }),
                              muted: !midiIsMuted
                            }
                          }
                        });
                      }}
                      title={midiIsMuted ? 'Unmute MIDI Lane' : 'Mute MIDI Lane'}
                    >
                      <LucideIcon name={midiIsMuted ? 'VolumeX' : 'Volume2'} />
                    </button>
                    <button
                      className={`${styles.soloButton} ${midiIsSoloed ? styles.active : ''}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setActState(prev => {
                          const newLanes = { ...prev.channelLanes };
                          if (!midiIsSoloed) {
                            Object.keys(newLanes).forEach(laneId => {
                              if (Number(laneId) !== -1) {
                                newLanes[Number(laneId)] = {
                                  ...newLanes[Number(laneId)],
                                  soloed: false
                                };
                              }
                            });
                            newLanes[-1] = {
                              ...(newLanes[-1] || { muted: false, soloed: false }),
                              soloed: true
                            };
                          } else {
                            if (newLanes[-1]) {
                              newLanes[-1] = {
                                ...newLanes[-1],
                                soloed: false
                              };
                            }
                          }
                          return {
                            ...prev,
                            channelLanes: newLanes
                          };
                        });
                        updateAct(act.id, {
                          channelLanes: {
                            ...actState.channelLanes,
                            [-1]: {
                              ...(actState.channelLanes?.[-1] || { muted: false, soloed: false }),
                              soloed: !midiIsSoloed
                            }
                          }
                        });
                      }}
                      title={midiIsSoloed ? 'Unsolo MIDI Lane' : 'Solo MIDI Lane'}
                    >
                      <LucideIcon name="Radio" />
                    </button>
                  </div>
                </div>
                <div className={styles.laneContent}>
                  {midiEvents.map(event => {
                    const isDragging = draggingEventId === event.id;
                    return (
                      <div
                        key={event.id}
                        className={`${styles.eventMarker} ${selectedEventId === event.id ? styles.selected : ''} ${isDragging ? styles.dragging : ''}`}
                        style={{ left: `${timeToPixels(event.time)}px` }}
                        onMouseDown={(e) => {
                          if (e.button === 0) {
                            e.preventDefault();
                            e.stopPropagation();
                            hasDraggedEventRef.current = false;
                            setDraggingEventId(event.id);
                            const rect = timelineRef.current?.getBoundingClientRect();
                            if (rect) {
                              const mouseX = e.clientX - rect.left + scrollPosition;
                              setEventDragOffset(mouseX - timeToPixels(event.time));
                            }
                            // Select event
                            setSelectedEventId(event.id);
                          }
                        }}
                        onDoubleClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setSelectedEventId(event.id);
                          // Open properties panel (it should already be open, but ensure it is)
                        }}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setSelectedEventId(event.id);
                        }}
                        onClick={(e) => {
                          // Prevent click if we just finished dragging
                          if (hasDraggedEventRef.current) {
                            e.preventDefault();
                            e.stopPropagation();
                            hasDraggedEventRef.current = false;
                            return;
                          }
                          e.stopPropagation();
                          setSelectedEventId(event.id);
                        }}
                        title={`MIDI ${event.midiType === 'cc' ? `CC ${event.midiController}` : `Note ${event.midiNote}`} @ ${formatTime(event.time)}\n\nLeft-click: Select & Drag\nRight-click: Edit Properties\nDouble-click: Quick Edit`}
                      >
                        <div className={styles.eventMarkerDot} />
                        <div className={styles.eventMarkerLabel}>
                          {event.midiType === 'cc' ? `CC${event.midiController}` : `N${event.midiNote}`}
                        </div>
                      </div>
                    );
                  })}
                  {recordingMode === 'midi' && clickPosition !== null && (
                    <div
                      className={styles.recordingIndicator}
                      style={{ left: `${timeToPixels(clickPosition)}px` }}
                    >
                      <div className={styles.recordingPulse} />
                      <span>Recording MIDI...</span>
                    </div>
                  )}
                </div>
              </div>
              );
            })()}

            {/* OSC Lane */}
            {showLanes.osc && (() => {
              const oscLaneState = actState.channelLanes?.[-2] || { muted: false, soloed: false }; // Use -2 as ID for OSC lane
              const oscIsMuted = oscLaneState.muted;
              const oscIsSoloed = oscLaneState.soloed;
              const hasSoloedLanes = Object.values(actState.channelLanes || {}).some(lane => lane.soloed);
              const shouldShowOsc = !hasSoloedLanes || oscIsSoloed;
              
              return (
              <div className={`${styles.eventLane} ${oscIsMuted ? styles.muted : ''} ${oscIsSoloed ? styles.soloed : ''} ${!shouldShowOsc ? styles.hidden : ''}`}>
                <div className={styles.laneLabel}>
                  <div className={styles.laneLabelContent}>
                    <LucideIcon name="Radio" />
                    <span>OSC</span>
                  </div>
                  <div className={styles.laneControls}>
                    <button
                      className={`${styles.muteButton} ${oscIsMuted ? styles.active : ''}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setActState(prev => ({
                          ...prev,
                          channelLanes: {
                            ...prev.channelLanes,
                            [-2]: {
                              ...(prev.channelLanes?.[-2] || { muted: false, soloed: false }),
                              muted: !oscIsMuted
                            }
                          }
                        }));
                        updateAct(act.id, {
                          channelLanes: {
                            ...actState.channelLanes,
                            [-2]: {
                              ...(actState.channelLanes?.[-2] || { muted: false, soloed: false }),
                              muted: !oscIsMuted
                            }
                          }
                        });
                      }}
                      title={oscIsMuted ? 'Unmute OSC Lane' : 'Mute OSC Lane'}
                    >
                      <LucideIcon name={oscIsMuted ? 'VolumeX' : 'Volume2'} />
                    </button>
                    <button
                      className={`${styles.soloButton} ${oscIsSoloed ? styles.active : ''}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setActState(prev => {
                          const newLanes = { ...prev.channelLanes };
                          if (!oscIsSoloed) {
                            Object.keys(newLanes).forEach(laneId => {
                              if (Number(laneId) !== -2) {
                                newLanes[Number(laneId)] = {
                                  ...newLanes[Number(laneId)],
                                  soloed: false
                                };
                              }
                            });
                            newLanes[-2] = {
                              ...(newLanes[-2] || { muted: false, soloed: false }),
                              soloed: true
                            };
                          } else {
                            if (newLanes[-2]) {
                              newLanes[-2] = {
                                ...newLanes[-2],
                                soloed: false
                              };
                            }
                          }
                          return {
                            ...prev,
                            channelLanes: newLanes
                          };
                        });
                        updateAct(act.id, {
                          channelLanes: {
                            ...actState.channelLanes,
                            [-2]: {
                              ...(actState.channelLanes?.[-2] || { muted: false, soloed: false }),
                              soloed: !oscIsSoloed
                            }
                          }
                        });
                      }}
                      title={oscIsSoloed ? 'Unsolo OSC Lane' : 'Solo OSC Lane'}
                    >
                      <LucideIcon name="Radio" />
                    </button>
                  </div>
                </div>
                <div className={styles.laneContent}>
                  {oscEvents.map(event => {
                    const isDragging = draggingEventId === event.id;
                    return (
                      <div
                        key={event.id}
                        className={`${styles.eventMarker} ${selectedEventId === event.id ? styles.selected : ''} ${isDragging ? styles.dragging : ''}`}
                        style={{ left: `${timeToPixels(event.time)}px` }}
                        onMouseDown={(e) => {
                          if (e.button === 0) {
                            e.preventDefault();
                            e.stopPropagation();
                            hasDraggedEventRef.current = false;
                            setDraggingEventId(event.id);
                            const rect = timelineRef.current?.getBoundingClientRect();
                            if (rect) {
                              const mouseX = e.clientX - rect.left + scrollPosition;
                              setEventDragOffset(mouseX - timeToPixels(event.time));
                            }
                            // Select event
                            setSelectedEventId(event.id);
                          }
                        }}
                        onDoubleClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setSelectedEventId(event.id);
                          // Open properties panel (it should already be open, but ensure it is)
                        }}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setSelectedEventId(event.id);
                        }}
                        onClick={(e) => {
                          // Prevent click if we just finished dragging
                          if (hasDraggedEventRef.current) {
                            e.preventDefault();
                            e.stopPropagation();
                            hasDraggedEventRef.current = false;
                            return;
                          }
                          e.stopPropagation();
                          setSelectedEventId(event.id);
                        }}
                        title={`OSC ${event.oscAddress} @ ${formatTime(event.time)}\n\nLeft-click: Select & Drag\nRight-click: Edit Properties\nDouble-click: Quick Edit`}
                      >
                        <div className={styles.eventMarkerDot} />
                        <div className={styles.eventMarkerLabel}>
                          {event.oscAddress?.split('/').pop() || 'OSC'}
                        </div>
                      </div>
                    );
                  })}
                  {recordingMode === 'osc' && clickPosition !== null && (
                    <div
                      className={styles.recordingIndicator}
                      style={{ left: `${timeToPixels(clickPosition)}px` }}
                    >
                      <div className={styles.recordingPulse} />
                      <span>Recording OSC...</span>
                    </div>
                  )}
                </div>
              </div>
              );
            })()}

            {/* Playback Cursor */}
            {actPlaybackState.isPlaying && actPlaybackState.currentActId === act.id && (() => {
              // Calculate current playback time
              let absoluteTime = 0;
              for (let i = 0; i < actPlaybackState.currentStepIndex; i++) {
                absoluteTime += act.steps[i].duration;
              }
              const currentStep = act.steps[actPlaybackState.currentStepIndex];
              if (currentStep) {
                const stepElapsed = (Date.now() - actPlaybackState.stepStartTime) / actPlaybackState.playbackSpeed;
                absoluteTime += stepElapsed;
              }
              
              return (
                <div
                  className={styles.playbackCursor}
                  style={{ left: `${timeToPixels(absoluteTime)}px` }}
                >
                  <div className={styles.cursorLine} />
                  <div className={styles.cursorDot} />
                </div>
              );
            })()}

            {/* Step Blocks */}
            {stepBlocks.map((block, index) => {
              const step = block.step;
              const isSelected = selectedStepId === step.id;
              const isDragging = draggingStepId === step.id;
              const isResizing = resizingStepId === step.id;
              const scene = scenes.find(s => s.name === step.sceneName);

              return (
                <div
                  key={step.id}
                  className={`${styles.stepBlock} ${isSelected ? styles.selected : ''} ${isDragging ? styles.dragging : ''}`}
                  style={{
                    left: `${timeToPixels(block.startTime)}px`,
                    width: `${timeToPixels(step.duration)}px`,
                  }}
                  onMouseDown={(e) => handleStepMouseDown(e, step.id, block.startTime)}
                  onClick={() => setSelectedStepId(step.id)}
                >
                  <div className={styles.stepBlockContent}>
                    <div className={styles.stepBlockHeader}>
                      <span className={styles.stepNumber}>{index + 1}</span>
                      <span className={styles.stepSceneName}>{step.sceneName}</span>
                      <span className={styles.stepDuration}>{formatTime(step.duration)}</span>
                    </div>
                    {step.notes && (
                      <div className={styles.stepNotes}>{step.notes}</div>
                    )}
                  </div>
                  
                  {/* Resize Handle */}
                  <div
                    className={styles.resizeHandle}
                    onMouseDown={(e) => handleResizeMouseDown(e, step.id, step.duration)}
                  />
                </div>
              );
            })}

            {/* Empty timeline indicator */}
            {stepBlocks.length === 0 && (
              <div className={styles.emptyTimeline}>
                <LucideIcon name="Clock" size={48} />
                <p>No steps yet. Add steps to build your timeline.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Event Properties Panel */}
      {selectedEventId && !selectedStepId && (
        <div className={styles.propertiesPanel}>
          {(() => {
            const event = timelineEvents.find(e => e.id === selectedEventId);
            if (!event) return null;

            return (
              <div className={styles.propertiesContent}>
                <h4>{event.type.toUpperCase()} Event Properties</h4>
                <div className={styles.propertyGroup}>
                  <label>Time (ms)</label>
                  <input
                    type="number"
                    value={event.time}
                    onChange={(e) => updateTimelineEvent(act.id, event.id, { time: Number(e.target.value) })}
                    min="0"
                    step="100"
                  />
                </div>

                {event.type === 'midi' && (
                  <>
                    <div className={styles.propertyGroup}>
                      <label>MIDI Type</label>
                      <select
                        value={event.midiType || 'cc'}
                        onChange={(e) => updateTimelineEvent(act.id, event.id, { midiType: e.target.value as any })}
                      >
                        <option value="cc">Control Change</option>
                        <option value="noteon">Note On</option>
                        <option value="noteoff">Note Off</option>
                      </select>
                    </div>
                    {event.midiType === 'cc' && (
                      <>
                        <div className={styles.propertyGroup}>
                          <label>Controller</label>
                          <input
                            type="number"
                            value={event.midiController || 0}
                            onChange={(e) => updateTimelineEvent(act.id, event.id, { midiController: Number(e.target.value) })}
                            min="0"
                            max="127"
                          />
                        </div>
                        <div className={styles.propertyGroup}>
                          <label>Value</label>
                          <input
                            type="number"
                            value={event.midiValue || 0}
                            onChange={(e) => updateTimelineEvent(act.id, event.id, { midiValue: Number(e.target.value) })}
                            min="0"
                            max="127"
                          />
                        </div>
                      </>
                    )}
                    {(event.midiType === 'noteon' || event.midiType === 'noteoff') && (
                      <>
                        <div className={styles.propertyGroup}>
                          <label>Note</label>
                          <input
                            type="number"
                            value={event.midiNote || 60}
                            onChange={(e) => updateTimelineEvent(act.id, event.id, { midiNote: Number(e.target.value) })}
                            min="0"
                            max="127"
                          />
                        </div>
                        <div className={styles.propertyGroup}>
                          <label>Velocity</label>
                          <input
                            type="number"
                            value={event.midiValue || 127}
                            onChange={(e) => updateTimelineEvent(act.id, event.id, { midiValue: Number(e.target.value) })}
                            min="0"
                            max="127"
                          />
                        </div>
                      </>
                    )}
                    <div className={styles.propertyGroup}>
                      <label>Channel</label>
                      <input
                        type="number"
                        value={(event.midiChannel || 0) + 1}
                        onChange={(e) => updateTimelineEvent(act.id, event.id, { midiChannel: Number(e.target.value) - 1 })}
                        min="1"
                        max="16"
                      />
                    </div>
                  </>
                )}

                {event.type === 'osc' && (
                  <>
                    <div className={styles.propertyGroup}>
                      <label>OSC Address</label>
                      <input
                        type="text"
                        value={event.oscAddress || ''}
                        onChange={(e) => updateTimelineEvent(act.id, event.id, { oscAddress: e.target.value })}
                        placeholder="/osc/address"
                      />
                    </div>
                    <div className={styles.propertyGroup}>
                      <label>Target Type</label>
                      <select
                        value={event.targetType || 'dmxChannel'}
                        onChange={(e) => updateTimelineEvent(act.id, event.id, { targetType: e.target.value as any })}
                      >
                        <option value="fixture">Fixture</option>
                        <option value="scene">Scene</option>
                        <option value="dmxChannel">DMX Channel</option>
                        <option value="group">Group</option>
                      </select>
                    </div>
                    {event.targetType === 'fixture' && (
                      <div className={styles.propertyGroup}>
                        <label>Fixture</label>
                        <select
                          value={event.targetId || ''}
                          onChange={(e) => updateTimelineEvent(act.id, event.id, { targetId: e.target.value })}
                        >
                          <option value="">Select fixture...</option>
                          {fixtures.map(fixture => (
                            <option key={fixture.id} value={fixture.id}>
                              {fixture.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                    {event.targetType === 'scene' && (
                      <div className={styles.propertyGroup}>
                        <label>Scene</label>
                        <select
                          value={event.targetId || ''}
                          onChange={(e) => updateTimelineEvent(act.id, event.id, { targetId: e.target.value })}
                        >
                          <option value="">Select scene...</option>
                          {scenes.map(scene => (
                            <option key={scene.name} value={scene.name}>
                              {scene.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                    {event.targetType === 'group' && (
                      <div className={styles.propertyGroup}>
                        <label>Group</label>
                        <select
                          value={event.targetId || ''}
                          onChange={(e) => updateTimelineEvent(act.id, event.id, { targetId: e.target.value })}
                        >
                          <option value="">Select group...</option>
                          {groups.map(group => (
                            <option key={group.id} value={group.id}>
                              {group.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </>
                )}

                <div className={styles.propertyGroup}>
                  <label>Notes</label>
                  <input
                    type="text"
                    value={event.notes || ''}
                    onChange={(e) => updateTimelineEvent(act.id, event.id, { notes: e.target.value || undefined })}
                    placeholder="Optional notes..."
                  />
                </div>

                <div className={styles.propertyActions}>
                  <button
                    className={styles.saveButton}
                    onClick={() => {
                      setSelectedEventId(null);
                    }}
                    title="Close Properties Panel"
                  >
                    <LucideIcon name="Check" />
                    Save & Close
                  </button>
                  <button
                    className={styles.deleteButton}
                    onClick={() => {
                      if (window.confirm('Delete this event?')) {
                        removeTimelineEvent(act.id, event.id);
                        setSelectedEventId(null);
                      }
                    }}
                    title="Delete this timeline event"
                  >
                    <LucideIcon name="Trash2" />
                    Delete Event
                  </button>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* Step Properties Panel */}
      {selectedStepId && (
        <div className={styles.propertiesPanel}>
          {(() => {
            const step = act.steps.find(s => s.id === selectedStepId);
            if (!step) return null;

            return (
              <div className={styles.propertiesContent}>
                <h4>Step Properties</h4>
                <div className={styles.propertyGroup}>
                  <label>Scene</label>
                  <select
                    value={step.sceneName}
                    onChange={(e) => updateActStep(act.id, step.id, { sceneName: e.target.value })}
                  >
                    {scenes.map(scene => (
                      <option key={scene.name} value={scene.name}>
                        {scene.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className={styles.propertyGroup}>
                  <label>Duration (ms)</label>
                  <input
                    type="number"
                    value={step.duration}
                    onChange={(e) => updateActStep(act.id, step.id, { duration: Number(e.target.value) })}
                    min="100"
                    step="100"
                  />
                </div>

                <div className={styles.propertyGroup}>
                  <label>Transition Duration (ms)</label>
                  <input
                    type="number"
                    value={step.transitionDuration}
                    onChange={(e) => updateActStep(act.id, step.id, { transitionDuration: Number(e.target.value) })}
                    min="0"
                    step="100"
                  />
                </div>

                <div className={styles.propertyGroup}>
                  <label>Notes</label>
                  <input
                    type="text"
                    value={step.notes || ''}
                    onChange={(e) => updateActStep(act.id, step.id, { notes: e.target.value || undefined })}
                    placeholder="Optional notes..."
                  />
                </div>

                <div className={styles.propertyActions}>
                    <button
                      className={styles.deleteButton}
                      onClick={() => {
                        if (window.confirm('Delete this step?')) {
                          removeActStep(act.id, step.id);
                          setSelectedStepId(null);
                        }
                      }}
                    >
                      <LucideIcon name="Trash2" />
                      Delete Step
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        )}

      {/* Add Event Instructions */}
      {recordingMode !== 'idle' && (
        <div className={styles.recordingInstructions}>
          <div className={styles.recordingInfo}>
            <LucideIcon name={recordingMode === 'midi' ? 'Music' : 'Radio'} size={20} />
            <div className={styles.recordingText}>
              <p className={styles.recordingTitle}>
                {recordingMode === 'midi' ? 'Recording MIDI Events' : 'Recording OSC Events'}
              </p>
              <p className={styles.recordingDescription}>
                {recordingMode === 'midi' 
                  ? 'Click on the timeline to set the time position, then move a MIDI control (knob, fader, button). The event will be recorded and replayed during act playback.'
                  : 'Click on the timeline to set the time position, then send an OSC message from your device. The event will be recorded with passthrough (messages continue to work normally) and replayed during act playback.'}
              </p>
              {clickPosition !== null && (
                <p className={styles.recordingPosition}>
                  Recording at: {formatTime(clickPosition)}
                </p>
              )}
            </div>
          </div>
          <button 
            className={styles.cancelRecordingButton}
            onClick={() => {
              setRecordingMode('idle');
              setClickPosition(null);
              cancelMidiLearn();
            }}
            title="Cancel Recording"
          >
            <LucideIcon name="X" />
            Cancel
          </button>
        </div>
      )}

      {/* Target Selector */}
      {showTargetSelector && pendingEvent && (
        <TimelineEventTargetSelector
          eventType={pendingEvent.type}
          onSelect={handleTargetSelect}
          onCancel={handleTargetCancel}
        />
      )}
    </div>
  );
};
