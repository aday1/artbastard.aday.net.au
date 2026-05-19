import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useStore, Scene, SceneTimeline, SceneTimelineKeyframe, TimelineMarker } from '../../store';
import { LucideIcon } from '../ui/LucideIcon';
import { useAudioWaveform } from '../../hooks/useAudioWaveform';
import { useUndoRedo } from '../../hooks/useUndoRedo';
import { TimelineRuler } from '../timeline/TimelineRuler';
import { TimelinePlayhead } from '../timeline/TimelinePlayhead';
import { TimelineGrid } from '../timeline/TimelineGrid';
import { formatTime as formatTimeUtil, getChannelsFromKeyframes } from '../../utils/timelineHelpers';
import styles from './SceneTimelineEditor.module.scss';

interface SceneTimelineEditorProps {
  scene: Scene;
  onClose: () => void;
  onSave: (timeline: SceneTimeline) => void;
}

export const SceneTimelineEditor: React.FC<SceneTimelineEditorProps> = ({ scene, onClose, onSave }) => {
  const { dmxChannels, setDmxChannel, bpm, channelNames, fixtures, getChannelInfo, getChannelRange, channelColors, getFixtureColor } = useStore();
  const timelineRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const waveformCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const sceneName = scene.name;
  
  const initialTimeline: SceneTimeline = scene.timeline || {
    enabled: false,
    duration: 60000, // Default 60 seconds
    loop: false,
    keyframes: [
      {
        id: 'start',
        time: 0,
        channelValues: {},
        easing: 'linear'
      }
    ],
    playbackMode: 'loop',
    playbackSpeed: 1.0,
    syncToBpm: false,
    bpmMultiplier: 4,
    channelLanes: {},
    enabledChannels: []
  };

  const { state: timeline, updateState: updateTimelineState, undo, redo, canUndo, canRedo } = useUndoRedo<SceneTimeline>(initialTimeline, 100);
  
  // Wrapper function to update timeline with history tracking
  const setTimeline = useCallback((updater: SceneTimeline | ((prev: SceneTimeline) => SceneTimeline)) => {
    const newTimeline = typeof updater === 'function' ? updater(timeline) : updater;
    updateTimelineState(newTimeline, true);
  }, [timeline, updateTimelineState]);
  
  // Calculate default zoom to fill screen width (aim for ~2000px for 60s timeline)
  const calculateDefaultZoom = useCallback(() => {
    if (typeof window !== 'undefined') {
      const screenWidth = window.innerWidth;
      const targetWidth = Math.max(screenWidth * 0.9, 2000); // Use 90% of screen width, minimum 2000px
      const defaultDuration = 60000; // 60 seconds default
      return targetWidth / (defaultDuration / 1000); // pixels per second
    }
    return 30; // Fallback: 30 pixels per second
  }, []);
  
  const [zoom, setZoom] = useState(30); // Start with reasonable default
  
  // Set initial zoom based on screen size
  useEffect(() => {
    setZoom(calculateDefaultZoom());
  }, [calculateDefaultZoom]);
  const [scrollPosition, setScrollPosition] = useState(0);
  const [selectedKeyframeIds, setSelectedKeyframeIds] = useState<Set<string>>(new Set()); // Multi-select support
  const [draggingKeyframeId, setDraggingKeyframeId] = useState<string | null>(null);
  const [draggingSelectedKeyframes, setDraggingSelectedKeyframes] = useState<Set<string>>(new Set()); // For multi-drag
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [dragPreviewTime, setDragPreviewTime] = useState<number | null>(null); // Show time while dragging
  const hasDraggedRef = useRef(false); // Track if we actually moved during drag
  const [selectionBox, setSelectionBox] = useState<{ startX: number; startY: number; endX: number; endY: number } | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [showAddKeyframe, setShowAddKeyframe] = useState(false);
  const [editingChannels, setEditingChannels] = useState<Record<number, number>>({});
  const [selectedChannel, setSelectedChannel] = useState<number | null>(null); // For viewing single channel curve
  const [hoveredKeyframeId, setHoveredKeyframeId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'single' | 'multi'>('multi'); // Single curve view or multi-channel tracks
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawingChannel, setDrawingChannel] = useState<number | null>(null);
  const [editingDuration, setEditingDuration] = useState(false);
  const [durationInput, setDurationInput] = useState<string>('');
  const [showWaveformMenu, setShowWaveformMenu] = useState(false);
  const [copiedKeyframes, setCopiedKeyframes] = useState<SceneTimelineKeyframe[]>([]);
  const [snapToGrid, setSnapToGrid] = useState(false);
  const [snapInterval, setSnapInterval] = useState(1000); // Default 1 second
  const [editingMarker, setEditingMarker] = useState<string | null>(null);
  const [newMarkerName, setNewMarkerName] = useState('');
  const [showAddMarker, setShowAddMarker] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  // Track height state - persisted to localStorage
  const [trackHeight, setTrackHeight] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('timelineTrackHeight');
      return saved ? parseInt(saved, 10) : 350; // Default 350px
    } catch {
      return 350;
    }
  });
  
  // DAW playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [playheadPosition, setPlayheadPosition] = useState(0); // Current playhead time in ms
  const [playbackDirection, setPlaybackDirection] = useState<1 | -1>(1); // 1 = forward, -1 = backward
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [waveformData, setWaveformData] = useState<number[]>([]);
  const playbackIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const { generateWaveform } = useAudioWaveform();
  
  // Initialize timeline defaults
  useEffect(() => {
    if (timeline && !timeline.playbackMode) {
      setTimeline(prev => ({
        ...prev,
        playbackMode: 'loop',
        playbackSpeed: 1.0,
        syncToBpm: false,
        bpmMultiplier: 4
      }));
    }
  }, [timeline, setTimeline]);
  
  // Early return if timeline is not initialized
  if (!timeline) {
    return (
      <div className={styles.timelineEditor}>
        <div className={styles.editorHeader}>
          <h3>Loading timeline...</h3>
        </div>
      </div>
    );
  }
  
  // Calculate effective duration based on BPM sync
  const effectiveDuration = timeline.syncToBpm && bpm > 0
    ? (timeline.bpmMultiplier || 4) * (60000 / bpm) // Convert beats to milliseconds
    : timeline.duration;
  
  // Playback controls
  const handlePlay = () => {
    if (!timeline) return;
    setIsPlaying(true);
    setPlaybackDirection(1);
    // Dispatch event to start timeline playback for DMX updates
    window.dispatchEvent(new CustomEvent('startSceneTimeline', { detail: { sceneName: scene.name } }));
    if (audioRef.current && timeline.audioTrack) {
      audioRef.current.play().catch(console.error);
    }
  };
  
  const handlePause = () => {
    setIsPlaying(false);
    // Dispatch event to stop timeline playback
    window.dispatchEvent(new CustomEvent('stopSceneTimeline'));
    if (audioRef.current) {
      audioRef.current.pause();
    }
  };
  
  const handleStop = () => {
    setIsPlaying(false);
    setPlayheadPosition(0);
    setPlaybackDirection(1);
    // Dispatch event to stop timeline playback
    window.dispatchEvent(new CustomEvent('stopSceneTimeline'));
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  };
  
  const handlePlaybackModeChange = (mode: 'loop' | 'pingpong' | 'forward' | 'backward' | 'once') => {
    setTimeline(prev => ({ ...prev, playbackMode: mode }));
  };
  
  // Handle audio file import
  const handleAudioImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Check if it's an audio file
    if (!file.type.startsWith('audio/')) {
      alert('Please select an audio file');
      return;
    }
    
    setAudioFile(file);
    
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
    
    // Update timeline with audio track info
    setTimeline(prev => ({
      ...prev,
      audioTrack: {
        url: audioUrl,
        name: file.name,
        waveform: waveform
      }
    }));
    
    // Set duration to audio length if available
    if (audioRef.current) {
      audioRef.current.addEventListener('loadedmetadata', () => {
        if (audioRef.current) {
          const audioDuration = audioRef.current.duration * 1000; // Convert to ms
          setTimeline(prev => ({
            ...prev,
            duration: Math.max(prev.duration, audioDuration)
          }));
        }
      });
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
    
    const playbackMode = timeline.playbackMode || 'loop';
    const playbackSpeed = timeline.playbackSpeed || 1.0;
    const updateInterval = 16; // ~60fps
    
    // Sync audio playback
    if (audioRef.current && timeline.audioTrack) {
      if (playbackDirection === 1) {
        audioRef.current.playbackRate = playbackSpeed;
        if (audioRef.current.paused) {
          audioRef.current.play().catch(console.error);
        }
      } else {
        // Reverse playback (not natively supported, would need custom implementation)
        audioRef.current.pause();
      }
    }
    
    playbackIntervalRef.current = setInterval(() => {
      setPlayheadPosition(prev => {
        const speedAdjustedDelta = (updateInterval * playbackSpeed * playbackDirection);
        let newPosition = prev + speedAdjustedDelta;
        
        // Apply timeline values at current position for DMX updates
        if (timeline.enabled) {
          const normalizedTime = timeline.loop ? newPosition % effectiveDuration : Math.min(newPosition, effectiveDuration);
          const { prev: prevKf, next: nextKf, progress } = (() => {
            let prev: SceneTimelineKeyframe | null = null;
            let next: SceneTimelineKeyframe | null = null;
            
            for (let i = 0; i < timeline.keyframes.length; i++) {
              const kf = timeline.keyframes[i];
              if (kf.time <= normalizedTime) {
                prev = kf;
              }
              if (kf.time >= normalizedTime && !next) {
                next = kf;
                break;
              }
            }
            
            if (!next && prev) {
              next = prev;
            }
            
            let progress = 0;
            if (prev && next && prev.id !== next.id) {
              const timeDiff = next.time - prev.time;
              const elapsed = normalizedTime - prev.time;
              progress = timeDiff > 0 ? elapsed / timeDiff : 0;
            }
            
            return { prev, next, progress };
          })();
          
          if (prevKf && nextKf) {
            const hasSoloedChannels = timeline.channelLanes 
              ? Object.values(timeline.channelLanes).some(lane => lane.soloed)
              : false;
            
            const allChannels = new Set([
              ...Object.keys(prevKf.channelValues).map(Number),
              ...Object.keys(nextKf.channelValues).map(Number)
            ]);
            
            allChannels.forEach(channelIndex => {
              const laneState = timeline.channelLanes?.[channelIndex];
              const isMuted = laneState?.muted || false;
              const isSoloed = laneState?.soloed || false;
              
              if (isMuted || (hasSoloedChannels && !isSoloed)) {
                return;
              }
              
              const startValue = prevKf.channelValues[channelIndex] || 0;
              const endValue = nextKf.channelValues[channelIndex] || 0;
              
              // Interpolate value
              let easedProgress = progress;
              const easing = prevKf.easing || 'linear';
              switch (easing) {
                case 'smooth':
                  easedProgress = progress * progress * (3 - 2 * progress);
                  break;
                case 'ease-in':
                  easedProgress = progress * progress;
                  break;
                case 'ease-out':
                  easedProgress = 1 - (1 - progress) * (1 - progress);
                  break;
                case 'ease-in-out':
                  easedProgress = progress < 0.5
                    ? 2 * progress * progress
                    : 1 - Math.pow(-2 * progress + 2, 2) / 2;
                  break;
                case 'step':
                  easedProgress = progress >= 1 ? 1 : 0;
                  break;
              }
              
              const interpolatedValue = Math.round(startValue + (endValue - startValue) * easedProgress);
              // setDmxChannel already respects min/max ranges, so we can pass the interpolated value directly
              setDmxChannel(channelIndex, interpolatedValue);
            });
          }
        }
        
        // Handle different playback modes
        if (playbackMode === 'once') {
          if (newPosition >= effectiveDuration) {
            setIsPlaying(false);
            return effectiveDuration;
          }
          return Math.min(newPosition, effectiveDuration);
        } else if (playbackMode === 'loop') {
          if (newPosition >= effectiveDuration) {
            return 0; // Loop back to start
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
  }, [isPlaying, playbackDirection, timeline.playbackMode, timeline.playbackSpeed, effectiveDuration, timeline.audioTrack]);
  
  // Sync audio position with playhead
  useEffect(() => {
    if (audioRef.current && timeline.audioTrack && isPlaying) {
      const audioTime = playheadPosition / 1000; // Convert ms to seconds
      if (Math.abs(audioRef.current.currentTime - audioTime) > 0.1) {
        audioRef.current.currentTime = audioTime;
      }
    }
  }, [playheadPosition, isPlaying, timeline.audioTrack]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        if (timeline.audioTrack?.url) {
          URL.revokeObjectURL(timeline.audioTrack.url);
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

  // Handle keyframe drag start
  const handleKeyframeMouseDown = useCallback((e: React.MouseEvent, keyframeId: string, currentTime: number) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Reset drag tracking
    hasDraggedRef.current = false;
    
    const rect = timelineRef.current?.getBoundingClientRect();
    if (!rect) return;

    const mouseX = e.clientX - rect.left + scrollPosition;
    const keyframeX = timeToPixels(currentTime);
    setDragOffset({ x: mouseX - keyframeX, y: 0 });
    setDraggingKeyframeId(keyframeId);
    // Don't set selectedKeyframeIds here - only on right-click
  }, [scrollPosition, timeToPixels]);


  // Handle timeline click - seek to position or add keyframe
  const handleTimelineClick = useCallback((e: React.MouseEvent) => {
    if (!timelineRef.current) return;
    
    // Don't add if we just finished dragging
    if (hasDraggedRef.current) {
      hasDraggedRef.current = false;
      return;
    }

    // Don't handle if clicking on existing keyframe or curve (those have their own handlers)
    if ((e.target as HTMLElement).closest(`.${styles.keyframeMarker}`) ||
        (e.target as HTMLElement).closest(`.${styles.channelCurve}`) ||
        (e.target as HTMLElement).closest(`.${styles.curveOverlay}`)) {
      return;
    }
    
    const rect = timelineRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left + scrollPosition;
    let clickTime = Math.max(0, Math.min(pixelsToTime(clickX), effectiveDuration));
    clickTime = snapTimeToGrid(clickTime);

    // If clicking on the timeline background (not on a keyframe or curve), seek to that position
    // This allows scrubbing the timeline
    setPlayheadPosition(clickTime);
    
    // If audio is playing, seek the audio as well
    if (audioRef.current && timeline.audioTrack) {
      const audioTime = clickTime / 1000; // Convert ms to seconds
      audioRef.current.currentTime = Math.max(0, Math.min(audioTime, audioRef.current.duration));
    }
    
    // Don't add keyframes when properties panel is open
    if (selectedKeyframeIds.size > 0) return;

    // Check if clicking near existing keyframe (within 20px)
    const existingKeyframe = timeline.keyframes.find(kf => {
      const kfX = timeToPixels(kf.time);
      return Math.abs(kfX - clickX) < 20;
    });

    if (existingKeyframe) {
      // Don't open properties on left-click, just seek
      return;
    }

    // Create new keyframe with current DMX values or interpolate from nearby keyframes
    const sortedKeyframes = [...timeline.keyframes].sort((a, b) => a.time - b.time);
    const prevKeyframe = sortedKeyframes.filter(kf => kf.time < clickTime).pop();
    const nextKeyframe = sortedKeyframes.find(kf => kf.time > clickTime);
    
    let currentValues: Record<number, number> = {};
    
    if (prevKeyframe && nextKeyframe) {
      // Interpolate between keyframes
      const progress = (clickTime - prevKeyframe.time) / (nextKeyframe.time - prevKeyframe.time);
      const allChannels = new Set([
        ...Object.keys(prevKeyframe.channelValues).map(Number),
        ...Object.keys(nextKeyframe.channelValues).map(Number)
      ]);
      
      allChannels.forEach(channelIndex => {
        const startValue = prevKeyframe.channelValues[channelIndex] || 0;
        const endValue = nextKeyframe.channelValues[channelIndex] || 0;
        const interpolated = Math.round(startValue + (endValue - startValue) * progress);
        if (interpolated > 0) {
          currentValues[channelIndex] = interpolated;
        }
      });
    } else {
      // Use current DMX state
      dmxChannels.forEach((value, index) => {
        if (value > 0) {
          currentValues[index] = value;
        }
      });

      // In single-channel view, always ensure the selected channel gets a keyframe,
      // even if its current value is 0 (explicit "off" keyframe).
      if (viewMode === 'single' && selectedChannel !== null) {
        const channelValue = dmxChannels[selectedChannel] || 0;
        currentValues[selectedChannel] = channelValue;
      }
    }

    const newKeyframe: SceneTimelineKeyframe = {
      id: `keyframe_${Date.now()}`,
      time: clickTime,
      channelValues: currentValues,
      easing: prevKeyframe?.easing || 'linear'
    };

    setTimeline(prev => ({
      ...prev,
      keyframes: [...prev.keyframes, newKeyframe].sort((a, b) => a.time - b.time)
    }));

    // Don't open properties panel on left-click - only right-click does that
    // setSelectedKeyframeId(newKeyframe.id);
    // setEditingChannels(currentValues);
  }, [scrollPosition, pixelsToTime, effectiveDuration, timeline.keyframes, dmxChannels, timeToPixels]);

  // Generate time markers
  const timeMarkers = [];
  const markerInterval = zoom > 2 ? 1000 : zoom > 1 ? 5000 : 10000;
  for (let time = 0; time <= effectiveDuration; time += markerInterval) {
    timeMarkers.push(time);
  }
  
  // Draw waveform on canvas
  useEffect(() => {
    if (waveformCanvasRef.current && waveformData.length > 0 && timeline.audioTrack) {
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
  }, [waveformData, playheadPosition, isPlaying, effectiveDuration, timeline.audioTrack]);

  // Handle zoom
  const handleZoomIn = useCallback(() => {
    setZoom(prev => Math.min(prev * 1.5, 200));
  }, []);
  
  const handleZoomOut = useCallback(() => {
    setZoom(prev => Math.max(prev / 1.5, 5));
  }, []);
  
  const handleZoomReset = useCallback(() => {
    setZoom(calculateDefaultZoom());
    setScrollPosition(0);
  }, [calculateDefaultZoom]);

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

  // Handle scroll
  const handleTimelineScroll = (e: React.UIEvent<HTMLDivElement>) => {
    setScrollPosition(e.currentTarget.scrollLeft);
  };

  // Save timeline
  const handleSave = () => {
    onSave(timeline);
    onClose();
  };

  // Delete selected keyframes
  const deleteSelectedKeyframes = () => {
    if (selectedKeyframeIds.size === 0) return;
    
    setTimeline(prev => ({
      ...prev,
      keyframes: prev.keyframes.filter(kf => !selectedKeyframeIds.has(kf.id))
    }));
    setSelectedKeyframeIds(new Set());
  };

  // Copy selected keyframes
  const copyKeyframes = useCallback(() => {
    if (selectedKeyframeIds.size === 0) return;
    const selectedKeyframes = timeline.keyframes.filter(kf => selectedKeyframeIds.has(kf.id));
    setCopiedKeyframes(selectedKeyframes.map(kf => ({
      ...kf,
      // Deep clone channelValues
      channelValues: { ...kf.channelValues }
    })));
  }, [selectedKeyframeIds, timeline.keyframes]);

  // Paste keyframes at current playhead or selected time
  const pasteKeyframes = useCallback((pasteTime?: number) => {
    if (copiedKeyframes.length === 0) return;
    
    const pastePosition = pasteTime !== undefined ? pasteTime : playheadPosition;
    const sortedCopied = [...copiedKeyframes].sort((a, b) => a.time - b.time);
    const minTime = sortedCopied[0].time;
    const timeOffset = pastePosition - minTime;
    
    const newKeyframes: SceneTimelineKeyframe[] = sortedCopied.map(keyframe => ({
      id: `keyframe_${Date.now()}_${Math.random()}`,
      time: Math.max(0, Math.min(keyframe.time + timeOffset, timeline.duration)),
      channelValues: { ...keyframe.channelValues },
      easing: keyframe.easing || 'linear',
      bezierControl1: keyframe.bezierControl1 ? { ...keyframe.bezierControl1 } : undefined,
      bezierControl2: keyframe.bezierControl2 ? { ...keyframe.bezierControl2 } : undefined
    }));

    setTimeline(prev => ({
      ...prev,
      keyframes: [...prev.keyframes, ...newKeyframes].sort((a, b) => a.time - b.time)
    }));
    setSelectedKeyframeIds(new Set(newKeyframes.map(kf => kf.id)));
  }, [copiedKeyframes, playheadPosition, timeline.duration, setTimeline]);

  // Snap time to grid
  const snapTimeToGrid = useCallback((time: number): number => {
    if (!snapToGrid) return time;
    return Math.round(time / snapInterval) * snapInterval;
  }, [snapToGrid, snapInterval]);

  // Duplicate selected keyframes
  const duplicateKeyframe = () => {
    if (selectedKeyframeIds.size === 0) return;
    
    const selectedKeyframes = timeline.keyframes.filter(kf => selectedKeyframeIds.has(kf.id));
    const sortedSelected = [...selectedKeyframes].sort((a, b) => a.time - b.time);
    const minTime = sortedSelected[0].time;
    const timeOffset = 1000; // Default 1 second offset
    
    const newKeyframes: SceneTimelineKeyframe[] = sortedSelected.map(keyframe => {
      const newTime = Math.min(keyframe.time + timeOffset, timeline.duration);
      return {
        id: `keyframe_${Date.now()}_${Math.random()}`,
        time: snapTimeToGrid(newTime),
        channelValues: { ...keyframe.channelValues },
        easing: keyframe.easing || 'linear',
        bezierControl1: keyframe.bezierControl1 ? { ...keyframe.bezierControl1 } : undefined,
        bezierControl2: keyframe.bezierControl2 ? { ...keyframe.bezierControl2 } : undefined
      };
    });

    setTimeline(prev => ({
      ...prev,
      keyframes: [...prev.keyframes, ...newKeyframes].sort((a, b) => a.time - b.time)
    }));
    setSelectedKeyframeIds(new Set(newKeyframes.map(kf => kf.id)));
  };

  // Marker management functions
  const addMarker = useCallback((time: number, name: string = 'Marker') => {
    const newMarker: TimelineMarker = {
      id: `marker_${Date.now()}_${Math.random()}`,
      time: snapTimeToGrid(time),
      name: name.trim() || 'Marker',
      color: `hsl(${Math.floor(Math.random() * 360)}, 70%, 50%)`
    };
    setTimeline(prev => ({
      ...prev,
      markers: [...(prev.markers || []), newMarker].sort((a, b) => a.time - b.time)
    }));
    setShowAddMarker(false);
    setNewMarkerName('');
  }, [snapTimeToGrid, setTimeline]);

  const removeMarker = useCallback((markerId: string) => {
    setTimeline(prev => ({
      ...prev,
      markers: (prev.markers || []).filter(m => m.id !== markerId)
    }));
  }, [setTimeline]);

  const jumpToMarker = useCallback((markerId: string) => {
    const marker = timeline.markers?.find(m => m.id === markerId);
    if (marker) {
      setPlayheadPosition(marker.time);
      if (audioRef.current) {
        audioRef.current.currentTime = marker.time / 1000;
      }
    }
  }, [timeline.markers]);

  const jumpToNextMarker = useCallback(() => {
    const sortedMarkers = [...(timeline.markers || [])].sort((a, b) => a.time - b.time);
    const nextMarker = sortedMarkers.find(m => m.time > playheadPosition);
    if (nextMarker) {
      jumpToMarker(nextMarker.id);
    }
  }, [timeline.markers, playheadPosition, jumpToMarker]);

  const jumpToPreviousMarker = useCallback(() => {
    const sortedMarkers = [...(timeline.markers || [])].sort((a, b) => a.time - b.time);
    const prevMarker = [...sortedMarkers].reverse().find(m => m.time < playheadPosition);
    if (prevMarker) {
      jumpToMarker(prevMarker.id);
    }
  }, [timeline.markers, playheadPosition, jumpToMarker]);

  // Export timeline to JSON file
  const exportTimeline = useCallback(() => {
    const exportData = {
      timeline,
      sceneName: scene.name,
      exportedAt: new Date().toISOString(),
      version: '1.0'
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${scene.name.replace(/[^a-z0-9]/gi, '_')}_timeline.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [timeline, scene.name]);

  // Import timeline from JSON file
  const importTimeline = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const importData = JSON.parse(event.target?.result as string);
        if (importData.timeline) {
          // Validate timeline structure
          const importedTimeline: SceneTimeline = {
            enabled: importData.timeline.enabled ?? false,
            duration: importData.timeline.duration ?? 60000,
            loop: importData.timeline.loop ?? false,
            keyframes: importData.timeline.keyframes ?? [],
            playbackMode: importData.timeline.playbackMode ?? 'loop',
            playbackSpeed: importData.timeline.playbackSpeed ?? 1.0,
            syncToBpm: importData.timeline.syncToBpm ?? false,
            bpmMultiplier: importData.timeline.bpmMultiplier ?? 4,
            audioTrack: importData.timeline.audioTrack,
            channelLanes: importData.timeline.channelLanes ?? {},
            enabledChannels: importData.timeline.enabledChannels ?? [],
            markers: importData.timeline.markers ?? []
          };
          setTimeline(importedTimeline);
          // Reset undo/redo history after import
          updateTimelineState(importedTimeline, false);
        } else {
          alert('Invalid timeline file format');
        }
      } catch (error) {
        console.error('Failed to import timeline:', error);
        alert('Failed to import timeline. Please check the file format.');
      }
    };
    reader.readAsText(file);
    // Reset input so same file can be imported again
    e.target.value = '';
  }, [setTimeline, updateTimelineState]);

  // Capture current DMX state as keyframe (works with first selected keyframe)
  const captureCurrentState = () => {
    if (selectedKeyframeIds.size === 0) return;
    
    const currentValues: Record<number, number> = {};
    dmxChannels.forEach((value, index) => {
      if (value > 0) {
        currentValues[index] = value;
      }
    });

    setTimeline(prev => ({
      ...prev,
      keyframes: prev.keyframes.map(kf =>
        selectedKeyframeIds.has(kf.id)
          ? { ...kf, channelValues: currentValues }
          : kf
      )
    }));
    setEditingChannels(currentValues);
  };

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle shortcuts when typing in inputs
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      // Space: Play/Pause (DAW-style)
      if (e.code === 'Space' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        if (isPlaying) {
          handlePause();
        } else {
          handlePlay();
        }
        return;
      }

      // Home: Jump to start
      if (e.code === 'Home') {
        e.preventDefault();
        setPlayheadPosition(0);
        if (timelineRef.current) {
          timelineRef.current.scrollLeft = 0;
          setScrollPosition(0);
        }
        return;
      }

      // End: Jump to end
      if (e.code === 'End') {
        e.preventDefault();
        setPlayheadPosition(effectiveDuration);
        return;
      }

      // Left/Right arrows: Nudge playhead or keyframes
      if (e.code === 'ArrowLeft' || e.code === 'ArrowRight') {
        if (selectedKeyframeIds.size > 0) {
          // Nudge selected keyframes
          e.preventDefault();
          const nudgeAmount = e.shiftKey ? (snapInterval || 1000) : (snapInterval ? snapInterval / 10 : 100);
          const direction = e.code === 'ArrowLeft' ? -1 : 1;
          const delta = direction * nudgeAmount;
          
          setTimeline(prev => ({
            ...prev,
            keyframes: prev.keyframes.map(kf => {
              if (selectedKeyframeIds.has(kf.id)) {
                const newTime = Math.max(0, Math.min(kf.time + delta, effectiveDuration));
                return { ...kf, time: newTime };
              }
              return kf;
            }).sort((a, b) => a.time - b.time)
          }));
        } else {
          // Nudge playhead
          e.preventDefault();
          const nudgeAmount = e.shiftKey ? 5000 : 1000; // 5s with shift, 1s without
          const direction = e.code === 'ArrowLeft' ? -1 : 1;
          const newPosition = Math.max(0, Math.min(playheadPosition + (direction * nudgeAmount), effectiveDuration));
          setPlayheadPosition(newPosition);
        }
        return;
      }
      
      // Undo/Redo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        redo();
        return;
      }
      
      
      // Delete keyframes
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedKeyframeIds.size > 0) {
        e.preventDefault();
        // Inline delete logic to avoid dependency issues
        setTimeline(prev => ({
          ...prev,
          keyframes: prev.keyframes.filter(kf => !selectedKeyframeIds.has(kf.id))
        }));
        setSelectedKeyframeIds(new Set());
      }
      // Escape to clear selection or close waveform menu
      if (e.key === 'Escape') {
        setSelectedKeyframeIds(new Set());
        setShowWaveformMenu(false);
      }
      if (e.key === 'F11') {
        e.preventDefault();
        toggleFullscreen();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedKeyframeIds, undo, redo, setTimeline, isPlaying, handlePlay, handlePause, effectiveDuration, playheadPosition, setPlayheadPosition, scrollPosition, setScrollPosition, snapInterval, timeline.keyframes, copiedKeyframes, toggleFullscreen]);

  // Close waveform menu when clicking outside
  useEffect(() => {
    if (!showWaveformMenu) return;
    
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest(`.${styles.waveformMenuContainer}`)) {
        setShowWaveformMenu(false);
      }
    };
    
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, [showWaveformMenu]);

  // Global mouse handlers for dragging keyframes
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!timelineRef.current) return;
      
      // Handle keyframe dragging
      if (draggingKeyframeId || draggingSelectedKeyframes.size > 0) {
        hasDraggedRef.current = true; // Mark that we've dragged
        
        const rect = timelineRef.current.getBoundingClientRect();
        const mouseX = e.clientX - rect.left + scrollPosition;
        const mouseY = e.clientY - rect.top;
        
        // Calculate new time - CLAMP to current duration, NEVER extend it
        // Keyframes should NEVER affect duration - duration is set separately
        let newTime = Math.max(0, Math.min(pixelsToTime(mouseX - dragOffset.x), timeline.duration));
        newTime = snapTimeToGrid(newTime);
        setDragPreviewTime(newTime); // Show preview time while dragging
        
        if (draggingSelectedKeyframes.size > 0) {
          // Multi-drag: move all selected keyframes by the same time offset
          const firstSelected = timeline.keyframes.find(kf => draggingSelectedKeyframes.has(kf.id));
          if (firstSelected) {
            const timeOffset = newTime - firstSelected.time;
            setTimeline(prev => ({
              ...prev,
              // IMPORTANT: Only update keyframes, NEVER update duration
              keyframes: prev.keyframes.map(kf => {
                if (draggingSelectedKeyframes.has(kf.id)) {
                  // Clamp to current duration - do NOT extend duration
                  let newKfTime = Math.max(0, Math.min(kf.time + timeOffset, prev.duration));
                  newKfTime = snapTimeToGrid(newKfTime);
                  return { ...kf, time: newKfTime };
                }
                return kf;
              }).sort((a, b) => a.time - b.time)
            }));
          }
        } else if (draggingKeyframeId) {
          // Single keyframe drag
          const keyframe = timeline.keyframes.find(kf => kf.id === draggingKeyframeId);
          if (keyframe && drawingChannel !== null) {
            // Get channel range to respect min/max when dragging
            const channelRange = getChannelRange(drawingChannel);
            
            // Get accurate Y coordinate - use SVG coordinates if in multi-channel mode
            let mouseYInViewBox: number;
            if (viewMode === 'multi') {
              const channelSvg = timelineRef.current?.querySelector(`svg.channelCurve[data-channel="${drawingChannel}"]`) as SVGSVGElement;
              if (channelSvg) {
                const svgPoint = channelSvg.createSVGPoint();
                svgPoint.x = e.clientX;
                svgPoint.y = e.clientY;
                const svgCTM = channelSvg.getScreenCTM();
                if (svgCTM) {
                  const svgCoords = svgPoint.matrixTransform(svgCTM.inverse());
                  mouseYInViewBox = svgCoords.y; // Already in viewBox coordinates (0-100)
                } else {
                  // Fallback
                  const svgRect = channelSvg.getBoundingClientRect();
                  mouseYInViewBox = ((e.clientY - svgRect.top) / svgRect.height) * 100;
                }
              } else {
                // Fallback
                mouseYInViewBox = (mouseY / rect.height) * 100;
              }
            } else {
              // Single channel mode - convert pixel Y to viewBox Y (0-100)
              mouseYInViewBox = (mouseY / rect.height) * 100;
            }
            
            // dragOffset.y is already in viewBox coordinates (0-100)
            const adjustedY = mouseYInViewBox - dragOffset.y;
            const rawValue = Math.max(0, Math.min(255, 255 - (adjustedY / 100) * 255));
            const clampedValue = Math.max(channelRange.min, Math.min(channelRange.max, rawValue));
            
            setTimeline(prev => ({
              ...prev,
              // IMPORTANT: Only update keyframes, NEVER update duration
              keyframes: prev.keyframes.map(kf => {
                if (kf.id === draggingKeyframeId) {
                  // Clamp time to current duration - do NOT extend duration
                  const clampedTime = Math.max(0, Math.min(snapTimeToGrid(newTime), prev.duration));
                  return {
                    ...kf,
                    time: clampedTime,
                    channelValues: {
                      ...kf.channelValues,
                      [drawingChannel]: clampedValue
                    }
                  };
                }
                return kf;
              }).sort((a, b) => a.time - b.time)
            }));
          } else if (keyframe) {
            // Dragging time only (not value) - CLAMP to duration, never extend
            setTimeline(prev => ({
              ...prev,
              // IMPORTANT: Only update keyframes, NEVER update duration
              keyframes: prev.keyframes.map(kf => {
                if (kf.id === draggingKeyframeId) {
                  // Clamp time to current duration - do NOT extend duration
                  const clampedTime = Math.max(0, Math.min(newTime, prev.duration));
                  return { ...kf, time: clampedTime };
                }
                return kf;
              }).sort((a, b) => a.time - b.time)
            }));
          }
        }
      } else if (isDrawing && drawingChannel !== null) {
        // Drawing mode: create/update keyframe as mouse moves
        hasDraggedRef.current = true;
        
        // Get accurate X coordinate - try to use SVG coordinates if in multi-channel mode
        const rect = timelineRef.current.getBoundingClientRect();
        let mouseX: number;
        if (viewMode === 'multi' && drawingChannel !== null) {
          const channelSvg = timelineRef.current?.querySelector(`svg.channelCurve[data-channel="${drawingChannel}"]`) as SVGSVGElement;
          if (channelSvg) {
            const svgPoint = channelSvg.createSVGPoint();
            svgPoint.x = e.clientX;
            svgPoint.y = e.clientY;
            const svgCTM = channelSvg.getScreenCTM();
            if (svgCTM) {
              const svgCoords = svgPoint.matrixTransform(svgCTM.inverse());
              // SVG X coordinate is already in timeline pixels, account for scroll
              mouseX = svgCoords.x + scrollPosition;
            } else {
              // Fallback
              mouseX = e.clientX - rect.left + scrollPosition;
            }
          } else {
            // Fallback
            mouseX = e.clientX - rect.left + scrollPosition;
          }
        } else {
          // Single channel mode
          mouseX = e.clientX - rect.left + scrollPosition;
        }
        
        let drawTime = Math.max(0, Math.min(pixelsToTime(mouseX), effectiveDuration));
        drawTime = snapTimeToGrid(drawTime);
        
        // Get channel range to respect min/max when drawing
        const channelRange = getChannelRange(drawingChannel);
        
        let rawValue: number;
        if (viewMode === 'single' && selectedChannel === drawingChannel) {
          // In single-channel mode, we need to get Y from the SVG viewBox coordinates
          // Find the curveOverlay SVG element
          const curveOverlay = timelineRef.current?.querySelector(`.${styles.curveOverlay}`) as SVGSVGElement;
          if (curveOverlay) {
            const svgPoint = curveOverlay.createSVGPoint();
            svgPoint.x = e.clientX;
            svgPoint.y = e.clientY;
            const svgCoords = svgPoint.matrixTransform(curveOverlay.getScreenCTM()?.inverse());
            const mouseY = svgCoords.y; // This is in viewBox coordinates (0-100)
            rawValue = Math.max(0, Math.min(255, 255 - (mouseY / 100) * 255));
          } else {
            // Fallback to regular calculation
            const mouseY = e.clientY - rect.top;
            rawValue = Math.max(0, Math.min(255, 255 - (mouseY / 100) * 255));
          }
        } else {
          // Multi-channel mode: find the SVG for the drawing channel and get accurate coordinates
          const channelSvg = timelineRef.current?.querySelector(`svg.channelCurve[data-channel="${drawingChannel}"]`) as SVGSVGElement;
          
          if (channelSvg) {
            // Use SVG viewBox coordinates for accurate positioning
            const svgPoint = channelSvg.createSVGPoint();
            svgPoint.x = e.clientX;
            svgPoint.y = e.clientY;
            const svgCTM = channelSvg.getScreenCTM();
            if (svgCTM) {
              const svgCoords = svgPoint.matrixTransform(svgCTM.inverse());
              // SVG Y coordinate is in viewBox (0-100), convert to DMX value
              const mouseYInViewBox = svgCoords.y;
              rawValue = Math.max(0, Math.min(255, 255 - (mouseYInViewBox / 100) * 255));
            } else {
              // Fallback if CTM not available
              const svgRect = channelSvg.getBoundingClientRect();
              const relativeY = e.clientY - svgRect.top;
              rawValue = Math.max(0, Math.min(255, 255 - (relativeY / svgRect.height) * 255));
            }
          } else {
            // Fallback: find which channel track we're in using timeline coordinates
            const mouseY = e.clientY - rect.top;
            const channelsWithKeyframes = new Set<number>();
            timeline.keyframes.forEach(k => {
              Object.keys(k.channelValues).forEach(ch => channelsWithKeyframes.add(Number(ch)));
            });
            const enabledChannels = timeline.enabledChannels || [];
            enabledChannels.forEach(ch => channelsWithKeyframes.add(ch));
            const sortedChannels = Array.from(channelsWithKeyframes).sort((a, b) => a - b);
            
            const trackLabelHeight = 80;
            const totalTrackHeight = trackHeight + trackLabelHeight;
            
            // Find which track the mouse is in
            let trackIndex = -1;
            for (let i = 0; i < sortedChannels.length; i++) {
              const trackTop = i * totalTrackHeight + trackLabelHeight;
              const trackBottom = trackTop + trackHeight;
              if (mouseY >= trackTop && mouseY <= trackBottom) {
                trackIndex = i;
                break;
              }
            }
            
            if (trackIndex >= 0 && sortedChannels[trackIndex] === drawingChannel) {
              const trackTop = trackIndex * totalTrackHeight + trackLabelHeight;
              const relativeY = mouseY - trackTop;
              rawValue = Math.max(0, Math.min(255, 255 - (relativeY / trackHeight) * 255));
            } else {
              // Fallback
              rawValue = Math.max(0, Math.min(255, 255 - (mouseY / 100) * 255));
            }
          }
        }
        
        const clampedValue = Math.max(channelRange.min, Math.min(channelRange.max, rawValue));
        
        // Find or create keyframe at this time
        setTimeline(prev => {
          const existingKf = prev.keyframes.find(kf => 
            kf.channelValues[drawingChannel] !== undefined &&
            Math.abs(kf.time - drawTime) < 50 // Within 50ms
          );
          
          if (existingKf) {
            // Update existing keyframe
            return {
              ...prev,
              keyframes: prev.keyframes.map(kf => {
                if (kf.id === existingKf.id) {
                  return {
                    ...kf,
                    channelValues: {
                      ...kf.channelValues,
                      [drawingChannel]: clampedValue
                    }
                  };
                }
                return kf;
              })
            };
          } else {
            // Create new keyframe
            const newKeyframe: SceneTimelineKeyframe = {
              id: `keyframe_${Date.now()}_${Math.random()}`,
              time: drawTime,
              channelValues: {
                [drawingChannel]: clampedValue
              },
              easing: 'linear'
            };
            return {
              ...prev,
              keyframes: [...prev.keyframes, newKeyframe].sort((a, b) => a.time - b.time)
            };
          }
        });
      }
    };
    
    const handleMouseUp = (e: MouseEvent) => {
      // Small delay to prevent click events from firing after drag
      setTimeout(() => {
        if (draggingKeyframeId || draggingSelectedKeyframes.size > 0 || isDrawing) {
          // Don't clear selection if we dragged - keep dragged items selected
          if (hasDraggedRef.current) {
            // Keep selection
          } else {
            // Only clear if no drag occurred
            setSelectedKeyframeIds(new Set());
          }
        }
        
        setDraggingKeyframeId(null);
        setDraggingSelectedKeyframes(new Set());
        setIsDrawing(false);
        setDrawingChannel(null);
        setDragPreviewTime(null); // Clear drag preview
        hasDraggedRef.current = false;
      }, 100);
    };
    
    if (draggingKeyframeId || draggingSelectedKeyframes.size > 0 || isDrawing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [draggingKeyframeId, draggingSelectedKeyframes, isDrawing, drawingChannel, dragOffset, scrollPosition, pixelsToTime, effectiveDuration, timeline.keyframes, getChannelRange, viewMode, selectedChannel, timeline.enabledChannels, zoom, snapTimeToGrid, setTimeline]);

  // Smooth interpolation between keyframes (add intermediate keyframes)
  const smoothKeyframes = () => {
    if (timeline.keyframes.length < 2) return;

    const sortedKeyframes = [...timeline.keyframes].sort((a, b) => a.time - b.time);
    const newKeyframes: SceneTimelineKeyframe[] = [];
    
    for (let i = 0; i < sortedKeyframes.length - 1; i++) {
      const current = sortedKeyframes[i];
      const next = sortedKeyframes[i + 1];
      const timeDiff = next.time - current.time;
      
      // Add current keyframe
      newKeyframes.push(current);
      
      // Add intermediate keyframes for smooth transition
      if (timeDiff > 2000) {
        const steps = Math.floor(timeDiff / 1000);
        for (let step = 1; step < steps; step++) {
          const intermediateTime = current.time + (timeDiff * step / steps);
          const intermediateValues: Record<number, number> = {};
          
          // Interpolate values
          const allChannels = new Set([
            ...Object.keys(current.channelValues).map(Number),
            ...Object.keys(next.channelValues).map(Number)
          ]);
          
          allChannels.forEach(channelIndex => {
            const startValue = current.channelValues[channelIndex] || 0;
            const endValue = next.channelValues[channelIndex] || 0;
            const progress = step / steps;
            const interpolated = Math.round(startValue + (endValue - startValue) * progress);
            if (interpolated > 0) {
              intermediateValues[channelIndex] = interpolated;
            }
          });
          
          newKeyframes.push({
            id: `keyframe_${Date.now()}_${step}`,
            time: intermediateTime,
            channelValues: intermediateValues,
            easing: 'smooth'
          });
        }
      }
    }
    
    // Add last keyframe
    newKeyframes.push(sortedKeyframes[sortedKeyframes.length - 1]);
    
    setTimeline(prev => ({
      ...prev,
      keyframes: newKeyframes.sort((a, b) => a.time - b.time)
    }));
  };

  // Apply waveform preset between two selected keyframes
  // NOTE: We intentionally keep the number of generated points low (6-16)
  // so the envelope stays readable and easy to edit instead of becoming
  // a dense "forest" of keyframes.
  const applyWaveform = (waveformType: 'sine' | 'sawtooth' | 'sawtoothReverse' | 'triangle' | 'square' | 'random' | 'noise' | 'exponential' | 'exponentialIn' | 'exponentialOut' | 'bezier') => {
    if (selectedKeyframeIds.size !== 2) {
      alert('Please select exactly 2 keyframes to apply a waveform between them.');
      return;
    }

    const selectedKeyframes = timeline.keyframes
      .filter(kf => selectedKeyframeIds.has(kf.id))
      .sort((a, b) => a.time - b.time);
    
    if (selectedKeyframes.length !== 2) return;
    
    const [startKf, endKf] = selectedKeyframes;
    const timeDiff = endKf.time - startKf.time;
    
    if (timeDiff <= 0) return;
    
    // Get all channels that exist in both keyframes
    const allChannels = new Set([
      ...Object.keys(startKf.channelValues).map(Number),
      ...Object.keys(endKf.channelValues).map(Number)
    ]);
    
    // Number of intermediate keyframes to generate.
    // Keep this small so the drawn waveform is a clean shape, not dozens of points.
    const numSteps = 8; // fixed small number of intermediate keyframes
    
    const newKeyframes: SceneTimelineKeyframe[] = [];
    
    // Generate waveform keyframes
    for (let i = 1; i < numSteps; i++) {
      const progress = i / numSteps; // 0 to 1
      let waveformValue: number;
      
      // Calculate waveform value based on type
      switch (waveformType) {
        case 'sine':
          waveformValue = 0.5 + 0.5 * Math.sin(progress * Math.PI * 2);
          break;
        case 'sawtooth':
          waveformValue = progress; // Linear rise
          break;
        case 'sawtoothReverse':
          waveformValue = 1 - progress; // Linear fall
          break;
        case 'triangle':
          waveformValue = progress < 0.5 ? progress * 2 : 2 - (progress * 2);
          break;
        case 'square':
          waveformValue = progress < 0.5 ? 1 : 0;
          break;
        case 'random':
          waveformValue = Math.random();
          break;
        default:
          waveformValue = progress;
      }
      
      const intermediateTime = startKf.time + (timeDiff * progress);
      const intermediateValues: Record<number, number> = {};
      
      allChannels.forEach(channelIndex => {
        const startValue = startKf.channelValues[channelIndex] ?? 0;
        const endValue = endKf.channelValues[channelIndex] ?? 0;
        
        // Apply waveform to the range between start and end values
        // Waveform oscillates around the midpoint
        const midpoint = (startValue + endValue) / 2;
        const range = Math.abs(endValue - startValue) / 2;
        
        // For sine/triangle/square/random/noise, oscillate around midpoint
        // For sawtooth/exponential/bezier, interpolate from start to end
        let value: number;
        if (waveformType === 'sine' || waveformType === 'triangle' || waveformType === 'square' || waveformType === 'random' || waveformType === 'noise') {
          // Oscillate around midpoint with full range
          const amplitude = range * 2; // Full range from start to end
          value = midpoint + (waveformValue - 0.5) * amplitude;
        } else {
          // Sawtooth/exponential/bezier: interpolate from start to end
          value = startValue + (endValue - startValue) * waveformValue;
        }
        
        // Clamp to channel range
        const channelRange = getChannelRange(channelIndex);
        value = Math.max(channelRange.min, Math.min(channelRange.max, Math.round(value)));
        
        intermediateValues[channelIndex] = value;
      });
      
      newKeyframes.push({
        id: `waveform_${Date.now()}_${i}_${Math.random()}`,
        time: intermediateTime,
        channelValues: intermediateValues,
        easing: waveformType === 'square' ? 'step' : 'smooth'
      });
    }
    
    // Insert new keyframes between start and end, keeping start and end
    setTimeline(prev => {
      const otherKeyframes = prev.keyframes.filter(kf => !selectedKeyframeIds.has(kf.id));
      return {
        ...prev,
        keyframes: [...otherKeyframes, startKf, ...newKeyframes, endKf].sort((a, b) => a.time - b.time)
      };
    });
    
    setShowWaveformMenu(false);
  };

  // Get curve path for visualization (returns SVG path string)
  const getCurvePath = useCallback((startKf: SceneTimelineKeyframe, endKf: SceneTimelineKeyframe, channelIndex: number, svgWidth: number = 100): string => {
    const startValue = startKf.channelValues[channelIndex] || 0;
    const endValue = endKf.channelValues[channelIndex] || 0;
    
    // Calculate relative positions (0-100% for SVG)
    const timeRange = endKf.time - startKf.time;
    const startXPercent = 0;
    const endXPercent = 100;
    
    // Normalize values to 0-100 for visualization (inverted Y)
    const startY = 100 - (startValue / 255) * 100;
    const endY = 100 - (endValue / 255) * 100;
    
    const easing = startKf.easing || 'linear';
    
    if (easing === 'smooth') {
      // Smooth S-curve using cubic bezier
      return `M ${startXPercent} ${startY} C ${startXPercent + 25} ${startY}, ${endXPercent - 25} ${endY}, ${endXPercent} ${endY}`;
    } else if (easing === 'step') {
      // Step - horizontal line then vertical
      return `M ${startXPercent} ${startY} L ${endXPercent - 1} ${startY} L ${endXPercent - 1} ${endY} L ${endXPercent} ${endY}`;
    } else if (startKf.bezierControl1 && startKf.bezierControl2) {
      // Custom bezier curve
      const cp1X = startXPercent + (endXPercent - startXPercent) * startKf.bezierControl1.x;
      const cp1Y = startY + (endY - startY) * startKf.bezierControl1.y;
      const cp2X = startXPercent + (endXPercent - startXPercent) * startKf.bezierControl2.x;
      const cp2Y = startY + (endY - startY) * startKf.bezierControl2.y;
      return `M ${startXPercent} ${startY} C ${cp1X} ${cp1Y}, ${cp2X} ${cp2Y}, ${endXPercent} ${endY}`;
    } else {
      // Linear or other easing - use smooth approximation
      if (easing === 'ease-in') {
        return `M ${startXPercent} ${startY} Q ${endXPercent * 0.5} ${startY}, ${endXPercent} ${endY}`;
      } else if (easing === 'ease-out') {
        return `M ${startXPercent} ${startY} Q ${endXPercent * 0.5} ${endY}, ${endXPercent} ${endY}`;
      } else if (easing === 'ease-in-out') {
        return `M ${startXPercent} ${startY} C ${startXPercent + 20} ${startY}, ${endXPercent - 20} ${endY}, ${endXPercent} ${endY}`;
      } else {
        // Linear
        return `M ${startXPercent} ${startY} L ${endXPercent} ${endY}`;
      }
    }
  }, []);

  const selectedKeyframes = timeline.keyframes.filter(kf => selectedKeyframeIds.has(kf.id));
  const selectedKeyframe = selectedKeyframes[0] || null; // Use first selected for properties panel

  return (
    <div className={`${styles.timelineEditor} ${isFullscreen ? styles.fullscreen : ''}`}>
      {/* Hidden audio element */}
      {timeline.audioTrack && (
        <audio
          ref={audioRef}
          src={timeline.audioTrack.url}
          onEnded={() => {
            if (timeline.playbackMode === 'once') {
              handleStop();
            }
          }}
        />
      )}
      
      <div className={styles.editorHeader}>
        <div className={styles.headerLeft}>
          <h3>
            <LucideIcon name="Clock" />
            Scene Timeline: {scene.name}
          </h3>
          <div className={styles.durationControl}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted-color, #888)', marginRight: '8px' }}>
              Duration:
            </span>
            {editingDuration ? (
              <input
                type="number"
                min="0.1"
                max="600"
                step="0.1"
                value={durationInput}
                onChange={(e) => setDurationInput(e.target.value)}
                onBlur={() => {
                  const seconds = parseFloat(durationInput);
                  if (!isNaN(seconds) && seconds > 0) {
                    const newDuration = Math.round(seconds * 1000);
                    setTimeline(prev => ({
                      ...prev,
                      duration: newDuration,
                      // Clamp all keyframes to new duration - keyframes never extend duration
                      keyframes: prev.keyframes.map(kf => ({
                        ...kf,
                        time: Math.min(kf.time, newDuration)
                      }))
                    }));
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
                title="Set timeline duration. Keyframes are clamped to this duration and cannot extend it."
              />
            ) : (
              <button
                className={styles.durationButton}
                onClick={() => {
                  setDurationInput((timeline.duration / 1000).toFixed(1));
                  setEditingDuration(true);
                }}
                title="Click to edit duration. Keyframes are clamped to this duration and cannot extend it."
              >
                <LucideIcon name="Clock" size={16} />
                <span>{((timeline.duration || 60000) / 1000).toFixed(1)}s</span>
              </button>
            )}
          </div>
          <div className={styles.timelineToggle}>
            <label>
              <input
                type="checkbox"
                checked={timeline.enabled}
                onChange={(e) => setTimeline(prev => ({ ...prev, enabled: e.target.checked }))}
              />
              Enable Timeline
            </label>
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
              value={timeline.playbackMode || 'loop'}
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
              value={timeline.playbackSpeed || 1.0}
              onChange={(e) => setTimeline(prev => ({ ...prev, playbackSpeed: Number(e.target.value) }))}
            />
            <span>{timeline.playbackSpeed?.toFixed(1) || '1.0'}x</span>
          </div>
          
          <div className={styles.bpmSync}>
            <label>
              <input
                type="checkbox"
                checked={timeline.syncToBpm || false}
                onChange={(e) => setTimeline(prev => ({ ...prev, syncToBpm: e.target.checked }))}
              />
              Sync to BPM ({bpm})
            </label>
            {timeline.syncToBpm && (
              <input
                type="number"
                min="1"
                max="32"
                value={timeline.bpmMultiplier || 4}
                onChange={(e) => setTimeline(prev => ({ ...prev, bpmMultiplier: Number(e.target.value) }))}
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
            {timeline.audioTrack && (
              <span className={styles.audioName} title={timeline.audioTrack.name}>
                {timeline.audioTrack.name}
              </span>
            )}
          </div>
        </div>
        
        <div className={styles.headerActions}>
          <div className={styles.undoRedoControls}>
            <button 
              onClick={undo} 
              disabled={!canUndo}
              title="Undo (Ctrl+Z)"
              className={styles.undoButton}
            >
              <LucideIcon name="Undo2" />
            </button>
            <button 
              onClick={redo} 
              disabled={!canRedo}
              title="Redo (Ctrl+Shift+Z / Ctrl+Y)"
              className={styles.redoButton}
            >
              <LucideIcon name="Redo2" />
            </button>
          </div>
          <div className={styles.snapControls}>
            <label title="Snap keyframes to grid">
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
          <div className={styles.zoomControls}>
            <button onClick={handleZoomOut} title="Zoom Out (Ctrl+Wheel or Shift+Wheel)">
              <LucideIcon name="ZoomOut" />
            </button>
            <span className={styles.zoomLevel}>{Math.round(zoom)}px/s</span>
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
          {viewMode === 'multi' && (
            <div className={styles.trackHeightControls}>
              <LucideIcon name="Maximize2" size={14} style={{ marginRight: '4px' }} />
              <button 
                onClick={() => {
                  const newHeight = Math.max(150, trackHeight - 50);
                  setTrackHeight(newHeight);
                  localStorage.setItem('timelineTrackHeight', String(newHeight));
                }}
                title="Decrease Track Height"
              >
                <LucideIcon name="ChevronDown" size={14} />
              </button>
              <input
                type="range"
                min="150"
                max="600"
                step="25"
                value={trackHeight}
                onChange={(e) => {
                  const newHeight = Number(e.target.value);
                  setTrackHeight(newHeight);
                  localStorage.setItem('timelineTrackHeight', String(newHeight));
                }}
                className={styles.trackHeightSlider}
                title={`Track Height: ${trackHeight}px`}
              />
              <span className={styles.trackHeightValue} title={`Track Height: ${trackHeight}px`}>
                {trackHeight}px
              </span>
              <button 
                onClick={() => {
                  const newHeight = Math.min(600, trackHeight + 50);
                  setTrackHeight(newHeight);
                  localStorage.setItem('timelineTrackHeight', String(newHeight));
                }}
                title="Increase Track Height"
              >
                <LucideIcon name="ChevronUp" size={14} />
              </button>
            </div>
          )}
          <button 
            className={styles.deleteButton} 
            onClick={deleteSelectedKeyframes} 
            disabled={selectedKeyframeIds.size === 0}
            title="Delete Selected Keyframes (Del)"
          >
            <LucideIcon name="Trash2" />
            Delete ({selectedKeyframeIds.size})
          </button>
          <button 
            className={styles.addKeyframeButton} 
            onClick={() => {
              // Add keyframe at current playhead position with current DMX values
              const currentValues: Record<number, number> = {};
              dmxChannels.forEach((value, index) => {
                if (value > 0) {
                  currentValues[index] = value;
                }
              });
              
              // If in single view mode and channel is selected, only add for that channel
              if (viewMode === 'single' && selectedChannel !== null) {
                const channelValue = dmxChannels[selectedChannel] || 0;
                // Always include the selected channel, even if its value is 0,
                // so you can explicitly keyframe "off" states.
                currentValues[selectedChannel] = channelValue;
              }
              
              // Don't add if no values at all (e.g. multi-view with everything at 0)
              if (Object.keys(currentValues).length === 0) {
                return;
              }
              
              const newKeyframe: SceneTimelineKeyframe = {
                id: `keyframe_${Date.now()}_${Math.random()}`,
                time: playheadPosition,
                channelValues: currentValues,
                easing: 'linear'
              };
              
              setTimeline(prev => ({
                ...prev,
                keyframes: [...prev.keyframes, newKeyframe].sort((a, b) => a.time - b.time)
              }));
              
              // Select the new keyframe
              setSelectedKeyframeIds(new Set([newKeyframe.id]));
            }}
            title="Add Keyframe at Playhead Position (K)"
          >
            <LucideIcon name="Plus" />
            Add Keyframe
          </button>
          <button className={styles.captureButton} onClick={captureCurrentState} disabled={selectedKeyframeIds.size === 0}>
            <LucideIcon name="Camera" />
            Capture Current State
          </button>
          <button 
            className={styles.duplicateButton} 
            onClick={duplicateKeyframe} 
            disabled={selectedKeyframeIds.size === 0}
            title="Duplicate Selected Keyframes"
          >
            <LucideIcon name="Copy" />
            Duplicate ({selectedKeyframeIds.size})
          </button>
          <button 
            className={styles.smoothButton} 
            onClick={smoothKeyframes}
            disabled={timeline.keyframes.length < 2}
            title="Smooth Transitions"
          >
            <LucideIcon name="Zap" />
            Smooth
          </button>
          <div className={styles.waveformMenuContainer}>
            <button
              className={styles.waveformButton}
              onClick={(e) => {
                e.stopPropagation();
                if (selectedKeyframeIds.size !== 2) {
                  alert('Please select exactly 2 keyframes to draw a waveform between them.\n\nTip: Select the first keyframe, then hold Ctrl/Cmd and click the second keyframe.');
                  return;
                }
                setShowWaveformMenu(!showWaveformMenu);
              }}
              title={selectedKeyframeIds.size !== 2 
                ? `Select exactly 2 keyframes to draw waveforms (Currently: ${selectedKeyframeIds.size} selected)`
                : "Draw Waveform Between Keyframes - Click to see options"}
            >
              <LucideIcon name="Activity" />
              Draw Waveform
              {selectedKeyframeIds.size === 2 && (
                <span style={{ fontSize: '0.75rem', opacity: 0.8, marginLeft: '4px' }}>
                  ({selectedKeyframeIds.size} selected)
                </span>
              )}
              {showWaveformMenu && (
                <div className={styles.waveformDropdown}>
                  <button
                    onClick={() => applyWaveform('sine')}
                    title="Sine wave - Smooth oscillation"
                  >
                    <LucideIcon name="Activity" />
                    Sine
                  </button>
                  <button
                    onClick={() => applyWaveform('sawtooth')}
                    title="Sawtooth - Linear rise from start to end"
                  >
                    <LucideIcon name="TrendingUp" />
                    Sawtooth (Rise)
                  </button>
                  <button
                    onClick={() => applyWaveform('sawtoothReverse')}
                    title="Reverse Sawtooth - Linear fall from start to end"
                  >
                    <LucideIcon name="TrendingDown" />
                    Sawtooth (Fall)
                  </button>
                  <button
                    onClick={() => applyWaveform('triangle')}
                    title="Triangle - Rise then fall"
                  >
                    <LucideIcon name="Triangle" />
                    Triangle
                  </button>
                  <button
                    onClick={() => applyWaveform('square')}
                    title="Square - Step between high and low"
                  >
                    <LucideIcon name="Square" />
                    Square
                  </button>
                  <button
                    onClick={() => applyWaveform('random')}
                    title="Random - Random values between start and end"
                  >
                    <LucideIcon name="Shuffle" />
                    Random
                  </button>
                  <button
                    onClick={() => applyWaveform('noise')}
                    title="Noise - Smooth random variation"
                  >
                    <LucideIcon name="Activity" />
                    Noise
                  </button>
                  <button
                    onClick={() => applyWaveform('exponential')}
                    title="Exponential - Smooth ease-in-out curve"
                  >
                    <LucideIcon name="TrendingUp" />
                    Exponential
                  </button>
                  <button
                    onClick={() => applyWaveform('exponentialIn')}
                    title="Exponential In - Slow start, fast end"
                  >
                    <LucideIcon name="ArrowDownRight" />
                    Exp In
                  </button>
                  <button
                    onClick={() => applyWaveform('exponentialOut')}
                    title="Exponential Out - Fast start, slow end"
                  >
                    <LucideIcon name="ArrowUpRight" />
                    Exp Out
                  </button>
                  <button
                    onClick={() => applyWaveform('bezier')}
                    title="Bezier - Custom cubic curve"
                  >
                    <LucideIcon name="Move" />
                    Bezier
                  </button>
                </div>
              )}
            </button>
          </div>
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
          <label className={styles.importButton} title="Import Timeline from JSON file">
            <LucideIcon name="Upload" />
            Import
            <input
              type="file"
              accept=".json"
              onChange={importTimeline}
              style={{ display: 'none' }}
            />
          </label>
          <button 
            className={styles.exportButton}
            onClick={exportTimeline}
            title="Export Timeline to JSON file"
          >
            <LucideIcon name="Download" />
            Export
          </button>
          <button className={styles.saveButton} onClick={handleSave}>
            <LucideIcon name="Save" />
            Save Timeline
          </button>
          <button className={styles.closeButton} onClick={onClose}>
            <LucideIcon name="X" />
            Close
          </button>
        </div>
      </div>

      <div className={styles.timelineContainer}>
        {/* Waveform Visualization */}
        {timeline.audioTrack && waveformData.length > 0 && (
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
          {(timeline.markers || []).map(marker => (
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
                        setTimeline(prev => ({
                          ...prev,
                          markers: (prev.markers || []).map(m => 
                            m.id === marker.id ? { ...m, name: newMarkerName.trim() || 'Marker' } : m
                          )
                        }));
                        setEditingMarker(null);
                        setNewMarkerName('');
                      } else if (e.key === 'Escape') {
                        setEditingMarker(null);
                        setNewMarkerName('');
                      }
                    }}
                    onBlur={() => {
                      setTimeline(prev => ({
                        ...prev,
                        markers: (prev.markers || []).map(m => 
                          m.id === marker.id ? { ...m, name: newMarkerName.trim() || 'Marker' } : m
                        )
                      }));
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
          
          {/* Playhead - Always visible when playing */}
          {(isPlaying || playheadPosition > 0) && (
            <div
              className={styles.playhead}
              style={{ left: `${timeToPixels(playheadPosition)}px` }}
            />
          )}
        </div>

        {/* View Mode Toggle */}
        <div className={styles.viewModeToggle}>
          <button
            className={viewMode === 'single' ? styles.active : ''}
            onClick={() => {
              setViewMode('single');
              // If no channel selected, try to select the first channel with keyframes
              if (selectedChannel === null) {
                const channelsWithKeyframes = new Set<number>();
                timeline.keyframes.forEach(kf => {
                  Object.keys(kf.channelValues).forEach(ch => channelsWithKeyframes.add(Number(ch)));
                });
                const enabledChannels = timeline.enabledChannels || [];
                enabledChannels.forEach(ch => channelsWithKeyframes.add(ch));
                const firstChannel = Array.from(channelsWithKeyframes).sort((a, b) => a - b)[0];
                if (firstChannel !== undefined) {
                  setSelectedChannel(firstChannel);
                }
              }
            }}
            title="Single Channel View - Shows a focused view of one DMX channel's value curve over time. Select a channel from the properties panel to view. Useful for detailed editing of individual channel animations."
          >
            <LucideIcon name="Focus" />
            Single Channel
            {selectedChannel !== null && (
              <span className={styles.channelIndicator}>
                {selectedChannel + 1}
              </span>
            )}
          </button>
          <button
            className={viewMode === 'multi' ? styles.active : ''}
            onClick={() => setViewMode('multi')}
            title="All Channels View - Shows all DMX channels that have keyframes or are enabled as separate tracks. Each channel appears as its own timeline lane with its value curve. Best for overview and multi-channel editing."
          >
            <LucideIcon name="Layers" />
            All Channels
          </button>
          {viewMode === 'multi' && (
            <div className={styles.addChannelControl}>
              <select
                value=""
                onChange={(e) => {
                  if (e.target.value) {
                    const channelToAdd = Number(e.target.value);
                    setTimeline(prev => {
                      const enabledChannels = prev.enabledChannels || [];
                      if (!enabledChannels.includes(channelToAdd)) {
                        return {
                          ...prev,
                          enabledChannels: [...enabledChannels, channelToAdd].sort((a, b) => a - b)
                        };
                      }
                      return prev;
                    });
                    e.target.value = '';
                  }
                }}
                title="Add Channel - Add a new channel track to the timeline. You can add channels even if they don't have keyframes yet."
              >
                <option value="">+ Add Channel</option>
                {Array.from({ length: 512 }, (_, i) => i).map(chIdx => {
                  // Don't show channels that are already enabled or have keyframes
                  const channelsWithKeyframes = new Set<number>();
                  timeline.keyframes.forEach(kf => {
                    Object.keys(kf.channelValues).forEach(ch => channelsWithKeyframes.add(Number(ch)));
                  });
                  const enabledChannels = timeline.enabledChannels || [];
                  if (channelsWithKeyframes.has(chIdx) || enabledChannels.includes(chIdx)) {
                    return null;
                  }
                  
                  const chInfo = getChannelInfo(chIdx);
                  const chName = chInfo 
                    ? `${chInfo.fixtureName} - ${chInfo.channelName}`
                    : channelNames[chIdx] || `CH ${chIdx + 1}`;
                  return (
                    <option key={chIdx} value={chIdx}>
                      {chIdx + 1}: {chName}
                    </option>
                  );
                }).filter(Boolean)}
              </select>
            </div>
          )}
        </div>

        {/* Timeline Ruler */}
        <div 
          className={styles.timelineRulerContainer}
          onMouseDown={(e) => {
            // Scrubbing: Click on ruler to jump to time
            if (e.button === 0 && timelineRef.current) {
              const rect = timelineRef.current.getBoundingClientRect();
              const x = e.clientX - rect.left + scrollPosition;
              const clickedTime = pixelsToTime(x);
              const clampedTime = Math.max(0, Math.min(clickedTime, effectiveDuration));
              setPlayheadPosition(clampedTime);
              
              // If playing, pause to allow scrubbing
              if (isPlaying) {
                handlePause();
              }
            }
          }}
          onMouseMove={(e) => {
            // Scrubbing: Drag on ruler to scrub through timeline
            if (e.buttons === 1 && timelineRef.current) {
              const rect = timelineRef.current.getBoundingClientRect();
              const x = e.clientX - rect.left + scrollPosition;
              const clickedTime = pixelsToTime(x);
              const clampedTime = Math.max(0, Math.min(clickedTime, effectiveDuration));
              setPlayheadPosition(clampedTime);
            }
          }}
        >
          <TimelineRuler
            duration={effectiveDuration}
            zoom={zoom}
            scrollLeft={scrollPosition}
            width={timelineRef.current?.clientWidth || 0}
            bpm={bpm}
            syncToBpm={timeline.syncToBpm}
            timeFormat="time"
          />
        </div>

        {/* Timeline Track */}
        <div
          ref={timelineRef}
          className={styles.timelineTrack}
          onScroll={handleTimelineScroll}
          onMouseDown={(e) => {
            // Start selection box if clicking on empty space (not on keyframe or curve)
            if (e.button === 0 && 
                !(e.target as HTMLElement).closest(`.${styles.keyframeMarker}`) &&
                !(e.target as HTMLElement).closest(`.${styles.channelCurve}`) &&
                !(e.target as HTMLElement).closest(`.${styles.curveOverlay}`)) {
              const rect = timelineRef.current?.getBoundingClientRect();
              if (rect) {
                const startX = e.clientX - rect.left + scrollPosition;
                const startY = e.clientY - rect.top;
                setIsSelecting(true);
                setSelectionBox({ startX, startY, endX: startX, endY: startY });
                
                // Clear selection if not holding Ctrl/Cmd
                if (!e.ctrlKey && !e.metaKey) {
                  setSelectedKeyframeIds(new Set());
                }
              }
            }
          }}
          onMouseMove={(e) => {
            if (isSelecting && selectionBox && timelineRef.current) {
              const rect = timelineRef.current.getBoundingClientRect();
              const endX = e.clientX - rect.left + scrollPosition;
              const endY = e.clientY - rect.top;
              setSelectionBox({ ...selectionBox, endX, endY });
              
              // Select keyframes within selection box
              const minX = Math.min(selectionBox.startX, endX);
              const maxX = Math.max(selectionBox.startX, endX);
              const minY = Math.min(selectionBox.startY, endY);
              const maxY = Math.max(selectionBox.startY, endY);
              
              const selectedIds = new Set(selectedKeyframeIds);
              timeline.keyframes.forEach(kf => {
                const kfX = timeToPixels(kf.time);
                // Check if keyframe is in selection box (for multi-channel view, check all channels)
                if (viewMode === 'multi') {
                  // In multi-channel view, we need to check which channel tracks are within the selection box Y range
                  // Get all channels that have keyframes OR are enabled
                  const channelsWithKeyframes = new Set<number>();
                  timeline.keyframes.forEach(k => {
                    Object.keys(k.channelValues).forEach(ch => channelsWithKeyframes.add(Number(ch)));
                  });
                  const enabledChannels = timeline.enabledChannels || [];
                  enabledChannels.forEach(ch => channelsWithKeyframes.add(ch));
                  const sortedChannels = Array.from(channelsWithKeyframes).sort((a, b) => a - b);
                  
                  // Calculate track positions - use dynamic track height
                  const trackLabelHeight = 80; // Approximate height of channel track label
                  const totalTrackHeight = trackHeight + trackLabelHeight;
                  
                  // Check each channel track
                  sortedChannels.forEach((channelIndex, trackIndex) => {
                    const trackTop = trackIndex * totalTrackHeight + trackLabelHeight;
                    const trackBottom = trackTop + trackHeight;
                    
                    // Check if selection box overlaps with this track
                    const selectionTop = Math.min(selectionBox.startY, endY);
                    const selectionBottom = Math.max(selectionBox.startY, endY);
                    
                    const trackOverlaps = !(selectionBottom < trackTop || selectionTop > trackBottom);
                    
                    // If track overlaps and keyframe has this channel, check if keyframe is in selection
                    if (trackOverlaps && kf.channelValues[channelIndex] !== undefined) {
                      if (kfX >= minX && kfX <= maxX) {
                        // Calculate Y position within the track (using dynamic trackHeight)
                        const value = kf.channelValues[channelIndex] || 0;
                        const kfY = 100 - (value / 255) * 100;
                        const kfYPixels = trackTop + (kfY / 100) * trackHeight;
                        
                        if (kfYPixels >= minY && kfYPixels <= maxY) {
                          if (e.ctrlKey || e.metaKey) {
                            selectedIds.add(kf.id);
                          } else {
                            selectedIds.add(kf.id);
                          }
                        }
                      }
                    }
                  });
                } else {
                  // In single-channel view, also check Y position
                  if (selectedChannel !== null) {
                    const value = kf.channelValues[selectedChannel] || 0;
                    const kfY = 100 - (value / 255) * 100;
                    const kfYPixels = (kfY / 100) * rect.height;
                    if (kfX >= minX && kfX <= maxX && kfYPixels >= minY && kfYPixels <= maxY) {
                      if (e.ctrlKey || e.metaKey) {
                        selectedIds.add(kf.id);
                      } else {
                        selectedIds.add(kf.id);
                      }
                    }
                  }
                }
              });
              
              if (!e.ctrlKey && !e.metaKey) {
                setSelectedKeyframeIds(selectedIds);
              }
            }
          }}
          onMouseUp={(e) => {
            if (isSelecting) {
              setIsSelecting(false);
              setSelectionBox(null);
            }
          }}
          onClick={(e) => {
            // Always allow timeline scrubbing, even when properties panel is open
            if (!isSelecting) {
              handleTimelineClick(e);
            }
          }}
        >
          <div className={styles.timelineContent} style={{ width: `${timeToPixels(effectiveDuration)}px` }}>
            {/* Timeline Grid Background */}
            {timelineRef.current && (
              <TimelineGrid
                duration={effectiveDuration}
                zoom={zoom}
                scrollLeft={scrollPosition}
                width={timelineRef.current.clientWidth}
                height={timelineRef.current.clientHeight}
                bpm={bpm}
                syncToBpm={timeline.syncToBpm}
              />
            )}

            {/* Playhead */}
            {isPlaying && timelineRef.current && (
              <TimelinePlayhead
                position={playheadPosition}
                zoom={zoom}
                scrollLeft={scrollPosition}
                height={timelineRef.current.clientHeight}
              />
            )}

            {/* Drag Preview - Shows time position while dragging keyframes */}
            {dragPreviewTime !== null && timelineRef.current && (
              <div
                className={styles.dragPreview}
                style={{
                  left: `${timeToPixels(dragPreviewTime) - scrollPosition}px`,
                  top: '0px',
                  height: `${timelineRef.current.clientHeight}px`
                }}
              >
                <div className={styles.dragPreviewLine} />
                <div className={styles.dragPreviewLabel}>
                  {formatTime(dragPreviewTime)}
                </div>
              </div>
            )}

            {/* Selection Box */}
            {selectionBox && (
              <div
                className={styles.selectionBox}
                style={{
                  left: `${Math.min(selectionBox.startX, selectionBox.endX)}px`,
                  top: `${Math.min(selectionBox.startY, selectionBox.endY)}px`,
                  width: `${Math.abs(selectionBox.endX - selectionBox.startX)}px`,
                  height: `${Math.abs(selectionBox.endY - selectionBox.startY)}px`,
                }}
              />
            )}
            {/* Multi-Channel Timeline View */}
            {viewMode === 'multi' && (() => {
              // Get all channels that have keyframes OR are enabled in timeline
              const channelsWithKeyframes = new Set<number>();
              timeline.keyframes.forEach(kf => {
                Object.keys(kf.channelValues).forEach(ch => channelsWithKeyframes.add(Number(ch)));
              });
              
              // Also include enabled channels from timeline.enabledChannels if it exists
              const enabledChannels = timeline.enabledChannels || [];
              enabledChannels.forEach(ch => channelsWithKeyframes.add(ch));
              
              const sortedChannels = Array.from(channelsWithKeyframes).sort((a, b) => a - b);
              
              return (
                <div className={styles.multiChannelTimeline}>
                  {sortedChannels.map(channelIndex => {
                    const channelKeyframes = timeline.keyframes
                      .filter(kf => kf.channelValues[channelIndex] !== undefined)
                      .sort((a, b) => a.time - b.time);
                    
                    const channelInfo = getChannelInfo(channelIndex);
                    const channelName = channelInfo 
                      ? `${channelInfo.fixtureName} - ${channelInfo.channelName}`
                      : channelNames[channelIndex] || `CH ${channelIndex + 1}`;
                    
                    const laneState = timeline.channelLanes?.[channelIndex] || { muted: false, soloed: false };
                    const isMuted = laneState.muted;
                    const isSoloed = laneState.soloed;
                    
                    // Check if any channel is soloed
                    const hasSoloedChannels = Object.values(timeline.channelLanes || {}).some(lane => lane.soloed);
                    const shouldShow = !hasSoloedChannels || isSoloed;
                    
                    return (
                      <div 
                        key={channelIndex} 
                        className={`${styles.channelTrack} ${isMuted ? styles.muted : ''} ${isSoloed ? styles.soloed : ''} ${!shouldShow ? styles.hidden : ''}`}
                        style={{ minHeight: `${trackHeight + 80}px` }}
                      >
                        <div className={styles.channelTrackLabel}>
                          <div className={styles.channelInfo}>
                            <span className={styles.channelNumber}>{channelIndex + 1}</span>
                            <span className={styles.channelName}>{channelName}</span>
                          </div>
                          <div className={styles.laneControls}>
                            <button
                              className={`${styles.muteButton} ${isMuted ? styles.active : ''}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                setTimeline(prev => ({
                                  ...prev,
                                  channelLanes: {
                                    ...prev.channelLanes,
                                    [channelIndex]: {
                                      ...(prev.channelLanes?.[channelIndex] || { muted: false, soloed: false }),
                                      muted: !isMuted
                                    }
                                  }
                                }));
                              }}
                              title={isMuted ? 'Unmute Channel' : 'Mute Channel'}
                            >
                              <LucideIcon name={isMuted ? 'VolumeX' : 'Volume2'} />
                            </button>
                            <button
                              className={`${styles.soloButton} ${isSoloed ? styles.active : ''}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                setTimeline(prev => {
                                  const newLanes = { ...prev.channelLanes };
                                  if (!isSoloed) {
                                    // Solo this channel - unsolo all others
                                    Object.keys(newLanes).forEach(ch => {
                                      if (Number(ch) !== channelIndex) {
                                        newLanes[Number(ch)] = {
                                          ...newLanes[Number(ch)],
                                          soloed: false
                                        };
                                      }
                                    });
                                    newLanes[channelIndex] = {
                                      ...(newLanes[channelIndex] || { muted: false, soloed: false }),
                                      soloed: true
                                    };
                                  } else {
                                    // Unsolo this channel
                                    if (newLanes[channelIndex]) {
                                      newLanes[channelIndex] = {
                                        ...newLanes[channelIndex],
                                        soloed: false
                                      };
                                    }
                                  }
                                  return {
                                    ...prev,
                                    channelLanes: newLanes
                                  };
                                });
                              }}
                              title={isSoloed ? 'Unsolo Channel' : 'Solo Channel'}
                            >
                              <LucideIcon name={isSoloed ? 'Radio' : 'Radio'} style={{ transform: isSoloed ? 'scale(1.2)' : 'scale(1)' }} />
                            </button>
                            <button
                              className={styles.deleteChannelButton}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (window.confirm(`Remove channel ${channelIndex + 1} from timeline? This will delete all keyframes for this channel.`)) {
                                  // Remove all keyframes for this channel
                                  setTimeline(prev => {
                                    const newKeyframes = prev.keyframes.map(kf => {
                                      const newChannelValues = { ...kf.channelValues };
                                      delete newChannelValues[channelIndex];
                                      return {
                                        ...kf,
                                        channelValues: newChannelValues
                                      };
                                    }).filter(kf => Object.keys(kf.channelValues).length > 0);
                                    
                                    // Remove from enabled channels
                                    const newEnabledChannels = (prev.enabledChannels || []).filter(ch => ch !== channelIndex);
                                    
                                    // Remove from channel lanes
                                    const newChannelLanes = { ...prev.channelLanes };
                                    delete newChannelLanes[channelIndex];
                                    
                                    return {
                                      ...prev,
                                      keyframes: newKeyframes,
                                      enabledChannels: newEnabledChannels,
                                      channelLanes: newChannelLanes
                                    };
                                  });
                                }
                              }}
                              title="Remove Channel - Deletes all keyframes for this channel and removes it from the timeline"
                            >
                              <LucideIcon name="X" size={16} />
                            </button>
                          </div>
                        </div>
                        <div className={styles.channelTrackContent}>
                          {/* Value curve visualization */}
                          {channelKeyframes.length > 0 ? (
                            <svg 
                              className={styles.channelCurve}
                              data-channel={channelIndex}
                              width={timeToPixels(effectiveDuration)}
                              height={trackHeight}
                              viewBox={`0 0 ${timeToPixels(effectiveDuration)} 100`}
                              preserveAspectRatio="none"
                              style={{ height: `${trackHeight}px` }}
                              onMouseDown={(e) => {
                                // Left-click to draw/drag on envelope
                                if (e.button !== 0) return; // Only left mouse button
                                e.preventDefault();
                                e.stopPropagation();
                                
                                // Don't start drawing if properties panel is open
                                if (Object.keys(editingChannels).length > 0) return;
                                
                                // Get accurate coordinates using SVG's viewBox transformation
                                const svg = e.currentTarget as SVGSVGElement;
                                const svgRect = svg.getBoundingClientRect();
                                const timelineRect = timelineRef.current?.getBoundingClientRect();
                                
                                if (!timelineRect) return;
                                
                                // Convert mouse coordinates to SVG viewBox coordinates
                                const svgPoint = svg.createSVGPoint();
                                svgPoint.x = e.clientX;
                                svgPoint.y = e.clientY;
                                const svgCTM = svg.getScreenCTM();
                                if (!svgCTM) return;
                                const svgCoords = svgPoint.matrixTransform(svgCTM.inverse());
                                
                                // SVG X coordinate is already in timeline pixels (viewBox matches timeline width)
                                // But we need to account for scroll position
                                const svgXInTimeline = svgCoords.x + scrollPosition;
                                const clickTime = Math.max(0, Math.min(pixelsToTime(svgXInTimeline), effectiveDuration));
                                
                                // SVG Y coordinate is in viewBox (0-100), convert to DMX value
                                const mouseYInViewBox = svgCoords.y; // Already 0-100 from viewBox
                                const rawValue = Math.max(0, Math.min(255, 255 - (mouseYInViewBox / 100) * 255));
                                
                                // Check if clicking near an existing keyframe (within 10px in timeline coordinates)
                                const nearbyKeyframe = channelKeyframes.find(kf => {
                                  const kfX = timeToPixels(kf.time);
                                  const kfYInViewBox = 100 - ((kf.channelValues[channelIndex] || 0) / 255) * 100;
                                  const distX = Math.abs(kfX - svgXInTimeline);
                                  const distY = Math.abs(kfYInViewBox - mouseYInViewBox);
                                  // Convert viewBox Y distance to pixels for comparison
                                  const distYPixels = (distY / 100) * trackHeight;
                                  return distX < 10 && distYPixels < 10;
                                });
                                
                                if (nearbyKeyframe) {
                                  // Start dragging this keyframe
                                  hasDraggedRef.current = false;
                                  const newSelection = new Set(selectedKeyframeIds);
                                  if (!e.ctrlKey && !e.metaKey) {
                                    newSelection.clear();
                                  }
                                  newSelection.add(nearbyKeyframe.id);
                                  setSelectedKeyframeIds(newSelection);
                                  
                                  const channelRange = getChannelRange(channelIndex);
                                  const clampedValue = Math.max(channelRange.min, Math.min(channelRange.max, rawValue));
                                  
                                  // Calculate drag offset in timeline coordinates
                                  const kfX = timeToPixels(nearbyKeyframe.time);
                                  const kfYInViewBox = 100 - ((nearbyKeyframe.channelValues[channelIndex] || 0) / 255) * 100;
                                  setDragOffset({ 
                                    x: svgXInTimeline - kfX, 
                                    y: mouseYInViewBox - kfYInViewBox 
                                  });
                                  
                                  if (newSelection.size > 1) {
                                    setDraggingSelectedKeyframes(newSelection);
                                  } else {
                                    setDraggingKeyframeId(nearbyKeyframe.id);
                                  }
                                  setIsDrawing(true);
                                  setDrawingChannel(channelIndex);
                                } else {
                                  // Create new keyframe and start drawing
                                  const channelRange = getChannelRange(channelIndex);
                                  const clampedValue = Math.max(channelRange.min, Math.min(channelRange.max, rawValue));
                                  
                                  const newKeyframe: SceneTimelineKeyframe = {
                                    id: `keyframe_${Date.now()}_${Math.random()}`,
                                    time: clickTime,
                                    channelValues: {
                                      [channelIndex]: clampedValue
                                    },
                                    easing: 'linear'
                                  };
                                  
                                  setTimeline(prev => ({
                                    ...prev,
                                    keyframes: [...prev.keyframes, newKeyframe].sort((a, b) => a.time - b.time)
                                  }));
                                  
                                  hasDraggedRef.current = false;
                                  setDragOffset({ x: 0, y: 0 });
                                  setDraggingKeyframeId(newKeyframe.id);
                                  setIsDrawing(true);
                                  setDrawingChannel(channelIndex);
                                }
                              }}
                              onDoubleClick={(e) => {
                                // Double-click on envelope to enter manual value editor
                                e.preventDefault();
                                e.stopPropagation();
                                
                                // Get accurate coordinates using SVG's viewBox transformation
                                const svg = e.currentTarget as SVGSVGElement;
                                const svgPoint = svg.createSVGPoint();
                                svgPoint.x = e.clientX;
                                svgPoint.y = e.clientY;
                                const svgCTM = svg.getScreenCTM();
                                if (!svgCTM) return;
                                const svgCoords = svgPoint.matrixTransform(svgCTM.inverse());
                                
                                // SVG X coordinate is already in timeline pixels, account for scroll
                                const svgXInTimeline = svgCoords.x + scrollPosition;
                                const clickTime = Math.max(0, Math.min(pixelsToTime(svgXInTimeline), effectiveDuration));
                                
                                // Find nearest keyframe or create one
                                const nearestKeyframe = channelKeyframes.reduce((nearest, kf) => {
                                  const dist = Math.abs(kf.time - clickTime);
                                  const nearestDist = nearest ? Math.abs(nearest.time - clickTime) : Infinity;
                                  return dist < nearestDist ? kf : nearest;
                                }, null as SceneTimelineKeyframe | null);
                                
                                if (nearestKeyframe) {
                                  const newSelection = new Set(selectedKeyframeIds);
                                  if (!newSelection.has(nearestKeyframe.id)) {
                                    newSelection.clear();
                                    newSelection.add(nearestKeyframe.id);
                                    setSelectedKeyframeIds(newSelection);
                                  }
                                  setEditingChannels({ ...nearestKeyframe.channelValues });
                                }
                              }}
                            >
                              {/* Grid lines for fine-tuning */}
                              <defs>
                                {/* Glow filters for curves - enhanced for better visibility */}
                                <filter id={`curveGlow_${channelIndex}`} x="-100%" y="-100%" width="300%" height="300%">
                                  <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                                  <feMerge>
                                    <feMergeNode in="coloredBlur"/>
                                    <feMergeNode in="SourceGraphic"/>
                                  </feMerge>
                                </filter>
                                <filter id={`curveGlowStrong_${channelIndex}`} x="-100%" y="-100%" width="300%" height="300%">
                                  <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
                                  <feMerge>
                                    <feMergeNode in="coloredBlur"/>
                                    <feMergeNode in="SourceGraphic"/>
                                  </feMerge>
                                </filter>
                                <linearGradient id={`curveGradient_${channelIndex}`} x1="0%" y1="0%" x2="100%" y2="0%">
                                  <stop offset="0%" stopColor="rgba(59, 130, 246, 1)" />
                                  <stop offset="100%" stopColor="rgba(139, 92, 246, 1)" />
                                </linearGradient>
                                <pattern id={`gridPattern_${channelIndex}`} x="0" y="0" width={Math.max(zoom / 10, 5)} height="10" patternUnits="userSpaceOnUse">
                                  <line x1="0" y1="0" x2="0" y2="10" stroke="var(--border-color, #333)" strokeWidth="0.5" opacity="0.3" />
                                </pattern>
                                <pattern id={`gridPatternVertical_${channelIndex}`} x="0" y="0" width={Math.max(zoom, 25)} height="100" patternUnits="userSpaceOnUse">
                                  <line x1="0" y1="0" x2="0" y2="100" stroke="var(--border-color, #333)" strokeWidth="0.5" opacity="0.2" />
                                </pattern>
                              </defs>
                              <rect width="100%" height="100%" fill={`url(#gridPattern_${channelIndex})`} />
                              <rect width="100%" height="100%" fill={`url(#gridPatternVertical_${channelIndex})`} />
                            {channelKeyframes.slice(0, -1).map((kf, idx) => {
                              const nextKf = channelKeyframes[idx + 1];
                              if (!nextKf) return null;
                              
                              const startX = timeToPixels(kf.time);
                              const endX = timeToPixels(nextKf.time);
                              const startValue = kf.channelValues[channelIndex] || 0;
                              const endValue = nextKf.channelValues[channelIndex] || 0;
                              const startY = 100 - (startValue / 255) * 100;
                              const endY = 100 - (endValue / 255) * 100;
                              
                              const easing = kf.easing || 'linear';
                              let pathD = '';
                              
                              if (easing === 'smooth') {
                                const cp1x = startX + (endX - startX) * 0.3;
                                const cp1y = startY;
                                const cp2x = startX + (endX - startX) * 0.7;
                                const cp2y = endY;
                                pathD = `M ${startX} ${startY} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${endX} ${endY}`;
                              } else if (easing === 'step') {
                                pathD = `M ${startX} ${startY} L ${endX - 2} ${startY} L ${endX - 2} ${endY} L ${endX} ${endY}`;
                              } else {
                                pathD = `M ${startX} ${startY} L ${endX} ${endY}`;
                              }
                              
                              return (
                                <g key={`curve_${kf.id}_${nextKf.id}`}>
                                  {/* Glow layer - thicker and more visible */}
                                  <path
                                    d={pathD}
                                    stroke={`url(#curveGradient_${channelIndex})`}
                                    strokeWidth="4"
                                    fill="none"
                                    opacity="0.5"
                                    filter={`url(#curveGlowStrong_${channelIndex})`}
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  />
                                  {/* Main curve */}
                                  <path
                                    d={pathD}
                                    stroke={`url(#curveGradient_${channelIndex})`}
                                    strokeWidth="2.5"
                                    fill="none"
                                    className={styles.curvePath}
                                    filter={`url(#curveGlow_${channelIndex})`}
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  />
                                </g>
                              );
                            })}
                            
                            {/* Keyframe markers */}
                            {channelKeyframes.map(kf => {
                              const value = kf.channelValues[channelIndex] || 0;
                              const x = timeToPixels(kf.time);
                              const y = 100 - (value / 255) * 100;
                              const isSelected = selectedKeyframeIds.has(kf.id);
                              
                              const isDragging = draggingKeyframeId === kf.id || draggingSelectedKeyframes.has(kf.id);
                              
                              return (
                                <g key={`marker_${kf.id}`}>
                                  <circle
                                    cx={x}
                                    cy={y}
                                    r={isSelected ? 6 : 4}
                                    fill={isSelected ? 'var(--accent-color, #f59e0b)' : 'var(--primary-color, #3b82f6)'}
                                    stroke="white"
                                    strokeWidth={isSelected ? 2 : 1}
                                    onContextMenu={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      // Only open properties on right-click - select this keyframe
                                      const newSelection = new Set(selectedKeyframeIds);
                                      if (!e.ctrlKey && !e.metaKey) {
                                        newSelection.clear();
                                      }
                                      newSelection.add(kf.id);
                                      setSelectedKeyframeIds(newSelection);
                                      setEditingChannels({ ...kf.channelValues });
                                    }}
                                    onMouseDown={(e) => {
                                      // Only handle left mouse button for dragging
                                      if (e.button !== 0) return;
                                      e.preventDefault();
                                      e.stopPropagation();
                                      
                                      // Don't open properties panel - just start dragging
                                      // Reset drag tracking
                                      hasDraggedRef.current = false;
                                      
                                      // Handle multi-select (but don't open properties)
                                      const newSelection = new Set(selectedKeyframeIds);
                                      if (e.ctrlKey || e.metaKey) {
                                        // Toggle selection
                                        if (newSelection.has(kf.id)) {
                                          newSelection.delete(kf.id);
                                        } else {
                                          newSelection.add(kf.id);
                                        }
                                      } else if (!newSelection.has(kf.id)) {
                                        // Single select if not already selected
                                        newSelection.clear();
                                        newSelection.add(kf.id);
                                      }
                                      setSelectedKeyframeIds(newSelection);
                                      
                                      const rect = e.currentTarget.ownerSVGElement?.getBoundingClientRect();
                                      if (rect) {
                                        const mouseX = e.clientX - rect.left + scrollPosition;
                                        const mouseY = e.clientY - rect.top;
                                        // Get channel range to respect min/max when dragging
                                        const channelRange = getChannelRange(channelIndex);
                                        const rawValue = Math.max(0, Math.min(255, 255 - (mouseY / 100) * 255));
                                        const clampedValue = Math.max(channelRange.min, Math.min(channelRange.max, rawValue));
                                        setDragOffset({ x: mouseX - timeToPixels(kf.time), y: mouseY - (100 - (clampedValue / 255) * 100) });
                                        
                                        // If multiple selected, prepare for multi-drag
                                        if (newSelection.size > 1 && newSelection.has(kf.id)) {
                                          setDraggingSelectedKeyframes(newSelection);
                                        } else {
                                          setDraggingKeyframeId(kf.id);
                                        }
                                        setIsDrawing(true);
                                        setDrawingChannel(channelIndex);
                                      }
                                    }}
                                    onDoubleClick={(e) => {
                                      // Double-click to enter manual value editor
                                      e.preventDefault();
                                      e.stopPropagation();
                                      const newSelection = new Set(selectedKeyframeIds);
                                      if (!newSelection.has(kf.id)) {
                                        newSelection.clear();
                                        newSelection.add(kf.id);
                                        setSelectedKeyframeIds(newSelection);
                                      }
                                      setEditingChannels({ ...kf.channelValues });
                                    }}
                                    onClick={(e) => {
                                      // Prevent click from opening properties if we just finished dragging
                                      if (hasDraggedRef.current) {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        hasDraggedRef.current = false;
                                        return;
                                      }
                                      // Single click doesn't open properties - only right-click or double-click does
                                    }}
                                    style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
                                    opacity={isDragging ? 0.8 : 1}
                                  />
                                  <text
                                    x={x}
                                    y={y - 8}
                                    fontSize="8"
                                    fill="var(--text-color, #fff)"
                                    textAnchor="middle"
                                    pointerEvents="none"
                                  >
                                    {value}
                                  </text>
                                </g>
                              );
                            })}
                            
                            {/* Playhead line */}
                            {isPlaying && (
                              <line
                                x1={timeToPixels(playheadPosition)}
                                y1={0}
                                x2={timeToPixels(playheadPosition)}
                                y2={100}
                                stroke="var(--danger-color, #ef4444)"
                                strokeWidth="2"
                                strokeDasharray="4,4"
                                opacity="0.8"
                                style={{ pointerEvents: 'none' }}
                              />
                            )}
                          </svg>
                          ) : (
                            <div 
                              className={styles.emptyChannelTrack}
                              onMouseDown={(e) => {
                                // Allow drawing on empty channel track
                                if (e.button === 0) {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  
                                  const rect = e.currentTarget.getBoundingClientRect();
                                  const mouseX = e.clientX - rect.left + scrollPosition;
                                  const mouseY = e.clientY - rect.top;
                                  
                                  const clickTime = Math.max(0, Math.min(pixelsToTime(mouseX), effectiveDuration));
                                  
                                  // Get channel range to respect min/max when drawing
                                  const channelRange = getChannelRange(channelIndex);
                                  const rawValue = Math.max(0, Math.min(255, 255 - (mouseY / 100) * 255));
                                  const clampedValue = Math.max(channelRange.min, Math.min(channelRange.max, rawValue));
                                  
                                  // Create new keyframe at this position
                                  const newChannelValues: Record<number, number> = {
                                    [channelIndex]: clampedValue
                                  };
                                  
                                  const newKeyframe: SceneTimelineKeyframe = {
                                    id: `keyframe_${Date.now()}_${Math.random()}`,
                                    time: clickTime,
                                    channelValues: newChannelValues,
                                    easing: 'linear'
                                  };
                                  
                                  setTimeline(prev => ({
                                    ...prev,
                                    keyframes: [...prev.keyframes, newKeyframe].sort((a, b) => a.time - b.time)
                                  }));
                                  
                                  // Start dragging the new keyframe
                                  hasDraggedRef.current = false;
                                  setDragOffset({ x: 0, y: 0 });
                                  setDraggingKeyframeId(newKeyframe.id);
                                  setIsDrawing(true);
                                  setDrawingChannel(channelIndex);
                                }
                              }}
                            >
                              <p>No keyframes yet - Click and drag on this track to add keyframes</p>
                            </div>
                          )}
                          {/* Playhead line overlay for better visibility */}
                          {isPlaying && (
                            <div
                              className={styles.trackPlayhead}
                              style={{ left: `${timeToPixels(playheadPosition)}px` }}
                            />
                          )}
                        </div>
                      </div>
                    );
                  })}
                  
                  {sortedChannels.length === 0 && (
                    <div className={styles.emptyTimeline}>
                      <LucideIcon name="Clock" size={48} />
                      <p>No channels with keyframes yet</p>
                      <p>Click and drag on timeline to draw envelopes</p>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Single Channel Curve View */}
            {viewMode === 'single' && (
              <>
                {selectedChannel === null ? (
                  <div className={styles.channelSelectorPrompt}>
                    <LucideIcon name="Info" size={32} />
                    <h4>Select a Channel to View</h4>
                    <p>In Single Channel mode, you can focus on editing one DMX channel at a time.</p>
                    <p>Select a channel from the dropdown in the Keyframe Properties panel (right-click a keyframe to open it), or switch to "All Channels" mode to see all channels at once.</p>
                    <div className={styles.channelSelectorInline}>
                      <label>Quick Select Channel:</label>
                      <select
                        value=""
                        onChange={(e) => {
                          if (e.target.value) {
                            setSelectedChannel(Number(e.target.value));
                          }
                        }}
                      >
                        <option value="">-- Select Channel --</option>
                        {(() => {
                          const channelsWithKeyframes = new Set<number>();
                          timeline.keyframes.forEach(kf => {
                            Object.keys(kf.channelValues).forEach(ch => channelsWithKeyframes.add(Number(ch)));
                          });
                          return Array.from(channelsWithKeyframes).sort((a, b) => a - b).map(chIdx => {
                            const chInfo = getChannelInfo(chIdx);
                            const chName = chInfo 
                              ? `${chInfo.fixtureName} - ${chInfo.channelName}`
                              : channelNames[chIdx] || `CH ${chIdx + 1}`;
                            return (
                              <option key={chIdx} value={chIdx}>
                                {chIdx + 1}: {chName}
                              </option>
                            );
                          });
                        })()}
                      </select>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Transition Curves Visualization */}
                    {timeline.keyframes.length > 1 && (() => {
                      const sortedKeyframes = [...timeline.keyframes].sort((a, b) => a.time - b.time);
                      const timelineWidth = timeToPixels(timeline.duration);
                      return (
                        <div className={styles.curveVisualization} style={{ width: `${timelineWidth}px`, height: '120px' }}>
                          {/* Playhead for single channel view - always visible when playing */}
                          {(isPlaying || playheadPosition > 0) && (
                            <div
                              className={styles.trackPlayhead}
                              style={{ 
                                left: `${timeToPixels(playheadPosition)}px`,
                                opacity: isPlaying ? 1 : 0.5
                              }}
                            />
                          )}
                          <svg 
                            className={styles.curveOverlay} 
                            viewBox="0 0 100 100" 
                            preserveAspectRatio="none"
                            onMouseDown={(e) => {
                              // Left-click to draw/drag on envelope in single-channel view
                              if (e.button !== 0 || selectedChannel === null) return; // Only left mouse button
                              e.preventDefault();
                              e.stopPropagation();
                              
                              // Don't start drawing if properties panel is open
                              if (Object.keys(editingChannels).length > 0) return;
                              
                              const rect = e.currentTarget.getBoundingClientRect();
                              const mouseX = e.clientX - rect.left + scrollPosition;
                              // Convert SVG viewBox coordinates (0-100) to actual Y position
                              const svgPoint = e.currentTarget.createSVGPoint();
                              svgPoint.x = e.clientX;
                              svgPoint.y = e.clientY;
                              const svgCoords = svgPoint.matrixTransform(e.currentTarget.getScreenCTM()?.inverse());
                              const mouseY = svgCoords.y; // This is in viewBox coordinates (0-100)
                              
                              const clickTime = Math.max(0, Math.min(pixelsToTime(mouseX), effectiveDuration));
                              
                              // Get channel range to respect min/max when drawing
                              const channelRange = getChannelRange(selectedChannel);
                              // Convert viewBox Y (0-100, inverted) to DMX value (0-255)
                              const rawValue = Math.max(0, Math.min(255, 255 - (mouseY / 100) * 255));
                              const clampedValue = Math.max(channelRange.min, Math.min(channelRange.max, rawValue));
                              
                              // Find keyframes for this channel
                              const channelKeyframes = timeline.keyframes
                                .filter(kf => kf.channelValues[selectedChannel] !== undefined)
                                .sort((a, b) => a.time - b.time);
                              
                              // Check if clicking near an existing keyframe (within 10px time-wise)
                              const nearbyKeyframe = channelKeyframes.find(kf => {
                                const kfX = timeToPixels(kf.time);
                                const kfY = 100 - ((kf.channelValues[selectedChannel] || 0) / 255) * 100;
                                const distX = Math.abs(kfX - mouseX);
                                const distY = Math.abs(kfY - mouseY);
                                return distX < (zoom / 10) && distY < 5; // Scale threshold with zoom
                              });
                              
                              if (nearbyKeyframe) {
                                // Start dragging this keyframe
                                hasDraggedRef.current = false;
                                const newSelection = new Set(selectedKeyframeIds);
                                if (!e.ctrlKey && !e.metaKey) {
                                  newSelection.clear();
                                }
                                newSelection.add(nearbyKeyframe.id);
                                setSelectedKeyframeIds(newSelection);
                                
                                setDragOffset({ x: mouseX - timeToPixels(nearbyKeyframe.time), y: mouseY - (100 - (clampedValue / 255) * 100) });
                                
                                if (newSelection.size > 1) {
                                  setDraggingSelectedKeyframes(newSelection);
                                } else {
                                  setDraggingKeyframeId(nearbyKeyframe.id);
                                }
                                setIsDrawing(true);
                                setDrawingChannel(selectedChannel);
                              } else {
                                // Create new keyframe and start drawing
                                const newKeyframe: SceneTimelineKeyframe = {
                                  id: `keyframe_${Date.now()}_${Math.random()}`,
                                  time: clickTime,
                                  channelValues: {
                                    [selectedChannel]: clampedValue
                                  },
                                  easing: 'linear'
                                };
                                
                                setTimeline(prev => ({
                                  ...prev,
                                  keyframes: [...prev.keyframes, newKeyframe].sort((a, b) => a.time - b.time)
                                }));
                                
                                hasDraggedRef.current = false;
                                setDragOffset({ x: 0, y: 0 });
                                setDraggingKeyframeId(newKeyframe.id);
                                setIsDrawing(true);
                                setDrawingChannel(selectedChannel);
                              }
                            }}
                            onDoubleClick={(e) => {
                              // Double-click on envelope to enter manual value editor
                              e.preventDefault();
                              e.stopPropagation();
                              const rect = e.currentTarget.getBoundingClientRect();
                              const mouseX = e.clientX - rect.left + scrollPosition;
                              const clickTime = Math.max(0, Math.min(pixelsToTime(mouseX), effectiveDuration));
                              
                              // Find nearest keyframe
                              const sortedKeyframes = [...timeline.keyframes].sort((a, b) => a.time - b.time);
                              const nearestKeyframe = sortedKeyframes.reduce((nearest, kf) => {
                                if (selectedChannel !== null && kf.channelValues[selectedChannel] !== undefined) {
                                  const dist = Math.abs(kf.time - clickTime);
                                  const nearestDist = nearest ? Math.abs(nearest.time - clickTime) : Infinity;
                                  return dist < nearestDist ? kf : nearest;
                                }
                                return nearest;
                              }, null as SceneTimelineKeyframe | null);
                              
                              if (nearestKeyframe) {
                                const newSelection = new Set(selectedKeyframeIds);
                                if (!newSelection.has(nearestKeyframe.id)) {
                                  newSelection.clear();
                                  newSelection.add(nearestKeyframe.id);
                                  setSelectedKeyframeIds(newSelection);
                                }
                                setEditingChannels({ ...nearestKeyframe.channelValues });
                              }
                            }}
                          >
                            <defs>
                              {/* Glow filter for curves */}
                              <filter id="curveGlow" x="-50%" y="-50%" width="200%" height="200%">
                                <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
                                <feMerge>
                                  <feMergeNode in="coloredBlur"/>
                                  <feMergeNode in="SourceGraphic"/>
                                </feMerge>
                              </filter>
                              <filter id="curveGlowStrong" x="-50%" y="-50%" width="200%" height="200%">
                                <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                                <feMerge>
                                  <feMergeNode in="coloredBlur"/>
                                  <feMergeNode in="SourceGraphic"/>
                                </feMerge>
                              </filter>
                              <linearGradient id="curveGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                                <stop offset="0%" stopColor="rgba(59, 130, 246, 0.9)" />
                                <stop offset="100%" stopColor="rgba(139, 92, 246, 0.9)" />
                              </linearGradient>
                              {/* Grid patterns for fine-tuning - scale with zoom */}
                              <pattern id="gridPatternSingle" x="0" y="0" width={Math.max(zoom / 10, 5)} height="10" patternUnits="userSpaceOnUse">
                                <line x1="0" y1="0" x2="0" y2="10" stroke="rgba(148, 163, 184, 0.4)" strokeWidth="0.5" />
                              </pattern>
                              <pattern id="gridPatternVerticalSingle" x="0" y="0" width={Math.max(zoom, 25)} height="100" patternUnits="userSpaceOnUse">
                                <line x1="0" y1="0" x2="0" y2="100" stroke="rgba(148, 163, 184, 0.3)" strokeWidth="0.5" />
                              </pattern>
                              {/* Value grid lines (horizontal lines for DMX values) */}
                              <pattern id="gridPatternValueSingle" x="0" y="0" width="100%" height="10" patternUnits="userSpaceOnUse">
                                <line x1="0" y1="5" x2="100%" y2="5" stroke="rgba(148, 163, 184, 0.2)" strokeWidth="0.5" />
                              </pattern>
                            </defs>
                            {/* Grid background layers */}
                            <rect width="100%" height="100%" fill="url(#gridPatternValueSingle)" />
                            <rect width="100%" height="100%" fill="url(#gridPatternSingle)" />
                            <rect width="100%" height="100%" fill="url(#gridPatternVerticalSingle)" />
                            {sortedKeyframes.slice(0, -1).map((kf, index) => {
                              const nextKf = sortedKeyframes[index + 1];
                              if (!nextKf) return null;
                              
                              // Calculate segment position
                              const segmentStart = (kf.time / timeline.duration) * 100;
                              const segmentEnd = (nextKf.time / timeline.duration) * 100;
                              const segmentWidth = segmentEnd - segmentStart;
                              
                              // Transform path to segment position
                              const path = getCurvePath(kf, nextKf, selectedChannel, 100);
                              const transformedPath = path.replace(/M\s+(\d+)/, `M ${segmentStart}`).replace(/L\s+(\d+)/, (match, num) => {
                                const newX = segmentStart + (parseFloat(num) / 100) * segmentWidth;
                                return `L ${newX}`;
                              }).replace(/C\s+([\d.]+)\s+([\d.]+),\s+([\d.]+)\s+([\d.]+),\s+([\d.]+)\s+([\d.]+)/, (match, cp1x, cp1y, cp2x, cp2y, endx, endy) => {
                                const newCp1X = segmentStart + (parseFloat(cp1x) / 100) * segmentWidth;
                                const newCp2X = segmentStart + (parseFloat(cp2x) / 100) * segmentWidth;
                                const newEndX = segmentStart + (parseFloat(endx) / 100) * segmentWidth;
                                return `C ${newCp1X} ${cp1y}, ${newCp2X} ${cp2y}, ${newEndX} ${endy}`;
                              }).replace(/Q\s+([\d.]+)\s+([\d.]+),\s+([\d.]+)\s+([\d.]+)/, (match, cpx, cpy, endx, endy) => {
                                const newCpX = segmentStart + (parseFloat(cpx) / 100) * segmentWidth;
                                const newEndX = segmentStart + (parseFloat(endx) / 100) * segmentWidth;
                                return `Q ${newCpX} ${cpy}, ${newEndX} ${endy}`;
                              });
                              
                              return (
                                <g key={`curve_${kf.id}_${nextKf.id}`}>
                                  {/* Glow layer - slightly thicker and blurred */}
                                  <path
                                    d={transformedPath}
                                    stroke="url(#curveGradient)"
                                    strokeWidth="3"
                                    fill="none"
                                    opacity="0.4"
                                    filter="url(#curveGlowStrong)"
                                  />
                                  {/* Main curve */}
                                  <path
                                    d={transformedPath}
                                    stroke="url(#curveGradient)"
                                    strokeWidth="2"
                                    fill="none"
                                    className={styles.curvePath}
                                    filter="url(#curveGlow)"
                                  />
                                </g>
                              );
                            })}
                          </svg>
                        </div>
                      );
                    })()}
                    {timeline.keyframes.length <= 1 && (
                      <div className={styles.emptyTimeline}>
                        <LucideIcon name="Clock" size={48} />
                        <p>Not enough keyframes to show curve</p>
                        <p>Add at least 2 keyframes to see the transition curve for channel {selectedChannel + 1}</p>
                      </div>
                    )}
                  </>
                )}
              </>
            )}

            {/* Keyframes - Only show in single view mode, positioned correctly based on DMX value */}
            {viewMode === 'single' && selectedChannel !== null && timeline.keyframes
              .filter(kf => kf.channelValues[selectedChannel] !== undefined)
              .map((keyframe) => {
              const isSelected = selectedKeyframeIds.has(keyframe.id);
              const isDragging = draggingKeyframeId === keyframe.id || draggingSelectedKeyframes.has(keyframe.id);
              const isHovered = hoveredKeyframeId === keyframe.id;
              
              // Get value for selected channel
              const value = keyframe.channelValues[selectedChannel] ?? 0;
              const channelColor = channelColors[selectedChannel] || '#3b82f6';
              const chInfo = getChannelInfo(selectedChannel);
              const primaryColor = channelColor;
              
              // Calculate vertical position based on DMX value (inverted: 0 at bottom, 255 at top)
              // Curve visualization SVG uses viewBox="0 0 100 100", so Y=0 is top, Y=100 is bottom
              // The curve visualization container is 120px high
              // Keyframes should align with the curve: value 0 at bottom, value 255 at top
              const curveContainerHeight = 180; // Height of curve visualization container (more room for 0–255)
              // Map DMX value (0-255) to Y position: 0 = bottom (100px), 255 = top (0px) in viewBox coordinates
              // Then convert to pixel position in the 120px container
              const viewBoxY = 100 - (value / 255) * 100; // Inverted: 0 at bottom, 100 at top
              const topPosition = (viewBoxY / 100) * curveContainerHeight; // Convert viewBox to pixels
              
              // Build tooltip
              const chName = chInfo ? `${chInfo.fixtureName} - ${chInfo.channelName}` : `CH ${selectedChannel + 1}`;
              const tooltip = `Keyframe @ ${formatTime(keyframe.time)}\n\n${chName}: ${value} (${Math.round((value / 255) * 100)}%)\n\nEasing: ${keyframe.easing || 'linear'}\n\nLeft-click: Select & Drag\nRight-click: Edit Properties\nDouble-click: Quick Edit`;

              return (
                <div
                  key={keyframe.id}
                  className={`${styles.keyframeMarker} ${isSelected ? styles.selected : ''} ${isDragging ? styles.dragging : ''} ${isHovered ? styles.hovered : ''}`}
                  style={{ 
                    left: `${timeToPixels(keyframe.time)}px`,
                    top: `${topPosition}px`, // Position based on DMX value
                    '--keyframe-color': primaryColor
                  } as React.CSSProperties}
                  onMouseDown={(e) => {
                    // Only handle left mouse button for dragging
                    if (e.button === 0) {
                      e.preventDefault();
                      e.stopPropagation();
                      
                      // Don't open properties panel - just start dragging
                      // Reset drag tracking
                      hasDraggedRef.current = false;
                      
                      // Handle multi-select (but don't open properties)
                      const newSelection = new Set(selectedKeyframeIds);
                      if (e.ctrlKey || e.metaKey) {
                        // Toggle selection
                        if (newSelection.has(keyframe.id)) {
                          newSelection.delete(keyframe.id);
                        } else {
                          newSelection.add(keyframe.id);
                        }
                      } else if (!newSelection.has(keyframe.id)) {
                        // Single select if not already selected
                        newSelection.clear();
                        newSelection.add(keyframe.id);
                      }
                      setSelectedKeyframeIds(newSelection);
                      
                      handleKeyframeMouseDown(e, keyframe.id, keyframe.time);
                      
                      // If multiple selected, prepare for multi-drag
                      if (newSelection.size > 1 && newSelection.has(keyframe.id)) {
                        setDraggingSelectedKeyframes(newSelection);
                      }
                    }
                  }}
                  onDoubleClick={(e) => {
                    // Double-click to enter manual value editor
                    e.preventDefault();
                    e.stopPropagation();
                    const newSelection = new Set(selectedKeyframeIds);
                    if (!newSelection.has(keyframe.id)) {
                      newSelection.clear();
                      newSelection.add(keyframe.id);
                      setSelectedKeyframeIds(newSelection);
                    }
                    setEditingChannels({ ...keyframe.channelValues });
                  }}
                  onClick={(e) => {
                    // Prevent click from opening properties if we just finished dragging
                    if (hasDraggedRef.current) {
                      e.preventDefault();
                      e.stopPropagation();
                      hasDraggedRef.current = false;
                      return;
                    }
                    // Single click doesn't open properties - only right-click or double-click does
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    // Right-click to edit keyframe properties
                    const newSelection = new Set(selectedKeyframeIds);
                    if (!e.ctrlKey && !e.metaKey) {
                      newSelection.clear();
                    }
                    newSelection.add(keyframe.id);
                    setSelectedKeyframeIds(newSelection);
                    setEditingChannels({ ...keyframe.channelValues });
                  }}
                  onMouseEnter={() => setHoveredKeyframeId(keyframe.id)}
                  onMouseLeave={() => setHoveredKeyframeId(null)}
                  title={tooltip}
                >
                  <div 
                    className={styles.keyframeDot}
                    style={{ 
                      backgroundColor: primaryColor,
                      borderColor: isSelected ? '#f59e0b' : primaryColor
                    }}
                  >
                    <LucideIcon name="Circle" size={16} />
                  </div>
                  <div className={styles.keyframeLabel}>
                    {/* Show channel value */}
                    <span className={styles.valueLabel}>
                      {Math.round(value)}
                    </span>
                    <span className={styles.percentageLabel}>
                      {Math.round((value / 255) * 100)}%
                    </span>
                  </div>
                </div>
              );
            })}

            {/* Empty timeline indicator */}
            {timeline.keyframes.length === 0 && (
              <div className={styles.emptyTimeline}>
                <LucideIcon name="Clock" size={48} />
                <p>Click on timeline to add keyframes</p>
                <p>Capture current DMX state at different times</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Keyframe Properties Panel */}
      {selectedKeyframe && (
        <div className={styles.propertiesPanel}>
          <div className={styles.propertiesContent}>
            <h4>Keyframe Properties</h4>
            <div className={styles.propertyGroup}>
              <label>
                Time (ms)
                <span className={styles.helpText} title="The position in the timeline where this keyframe occurs. This determines when the DMX values in this keyframe are applied.">
                  <LucideIcon name="HelpCircle" size={14} />
                </span>
              </label>
              <input
                type="number"
                value={selectedKeyframe.time}
                onChange={(e) => {
                  const newTime = Math.max(0, Math.min(Number(e.target.value), timeline.duration));
                  setTimeline(prev => ({
                    ...prev,
                    keyframes: prev.keyframes.map(kf =>
                      selectedKeyframeIds.has(kf.id)
                        ? { ...kf, time: newTime }
                        : kf
                    ).sort((a, b) => a.time - b.time)
                  }));
                }}
                min="0"
                max={timeline.duration}
                step="100"
              />
              <small className={styles.fieldDescription}>
                Position in timeline: {formatTime(selectedKeyframe.time)} - When this keyframe's DMX values are applied
              </small>
            </div>

            <div className={styles.propertyGroup}>
              <label>
                Timeline Duration (ms)
                <span className={styles.helpText} title="The total length of the timeline. Keyframes cannot be placed beyond this duration.">
                  <LucideIcon name="HelpCircle" size={14} />
                </span>
              </label>
              <input
                type="number"
                value={timeline.duration}
                onChange={(e) => {
                  const newDuration = Math.max(1000, Number(e.target.value));
                  setTimeline(prev => ({
                    ...prev,
                    duration: newDuration,
                    keyframes: prev.keyframes.map(kf => ({
                      ...kf,
                      time: Math.min(kf.time, newDuration)
                    }))
                  }));
                }}
                min="1000"
                step="1000"
              />
              <small className={styles.fieldDescription}>
                Total timeline length: {formatTime(timeline.duration)} - All keyframes must be within this duration
              </small>
            </div>

            <div className={styles.propertyGroup}>
              <label>Easing/Transition Type</label>
              <select
                value={selectedKeyframe.easing || 'linear'}
                onChange={(e) => {
                  setTimeline(prev => ({
                    ...prev,
                    keyframes: prev.keyframes.map(kf =>
                      selectedKeyframeIds.has(kf.id)
                        ? { 
                            ...kf, 
                            easing: e.target.value as any,
                            // Clear bezier controls if not using bezier
                            bezierControl1: e.target.value === 'bezier' ? kf.bezierControl1 : undefined,
                            bezierControl2: e.target.value === 'bezier' ? kf.bezierControl2 : undefined
                          }
                        : kf
                    )
                  }));
                }}
              >
                <option value="linear">Linear</option>
                <option value="smooth">Smooth (S-Curve)</option>
                <option value="ease-in">Ease In</option>
                <option value="ease-out">Ease Out</option>
                <option value="ease-in-out">Ease In Out</option>
                <option value="step">Step (Instant)</option>
              </select>
              <small style={{ color: 'var(--text-muted-color, #888)', fontSize: '0.75rem', marginTop: '4px', display: 'block' }}>
                Controls how values transition from this keyframe to the next
              </small>
            </div>

            {/* Curve Preview */}
            {(() => {
              const nextKeyframe = timeline.keyframes
                .sort((a, b) => a.time - b.time)
                .find(kf => kf.time > selectedKeyframe.time);
              
              if (nextKeyframe && selectedChannel !== null) {
                const previewChannel = selectedChannel;
                return (
                  <div className={styles.propertyGroup}>
                    <label>Transition Preview (Channel {previewChannel + 1})</label>
                    <div className={styles.curvePreview}>
                      <svg width="100%" height="80" viewBox="0 0 100 100" preserveAspectRatio="none" style={{ border: '1px solid var(--border-color, #333)', borderRadius: '4px', background: 'var(--background-color, #0f0f0f)' }}>
                        {/* Grid lines */}
                        <line x1="0" y1="25" x2="100" y2="25" stroke="var(--border-color, #333)" strokeWidth="0.5" strokeDasharray="2,2" />
                        <line x1="0" y1="50" x2="100" y2="50" stroke="var(--border-color, #333)" strokeWidth="0.5" strokeDasharray="2,2" />
                        <line x1="0" y1="75" x2="100" y2="75" stroke="var(--border-color, #333)" strokeWidth="0.5" strokeDasharray="2,2" />
                        
                        {/* Curve */}
                        <path
                          d={getCurvePath(selectedKeyframe, nextKeyframe, previewChannel, 100)}
                          stroke="var(--primary-color, #3b82f6)"
                          strokeWidth="2"
                          fill="none"
                        />
                        
                        {/* Keyframe markers */}
                        <circle
                          cx="0"
                          cy={100 - ((selectedKeyframe.channelValues[previewChannel] || 0) / 255) * 100}
                          r="3"
                          fill="var(--primary-color, #3b82f6)"
                        />
                        <circle
                          cx="100"
                          cy={100 - ((nextKeyframe.channelValues[previewChannel] || 0) / 255) * 100}
                          r="3"
                          fill="var(--accent-color, #f59e0b)"
                        />
                        
                        {/* Value labels */}
                        <text x="2" y="10" fontSize="8" fill="var(--text-muted-color, #888)">
                          {selectedKeyframe.channelValues[previewChannel] || 0}
                        </text>
                        <text x="88" y="10" fontSize="8" fill="var(--text-muted-color, #888)">
                          {nextKeyframe.channelValues[previewChannel] || 0}
                        </text>
                      </svg>
                      <small style={{ color: 'var(--text-muted-color, #888)', fontSize: '0.7rem', marginTop: '4px', display: 'block' }}>
                        {selectedKeyframe.easing || 'linear'} easing
                      </small>
                    </div>
                  </div>
                );
              }
              return null;
            })()}


            <div className={styles.propertyGroup}>
              <label>Channels ({Object.keys(selectedKeyframe.channelValues).length})</label>
              <div className={styles.channelList}>
                {Object.entries(selectedKeyframe.channelValues).slice(0, 20).map(([channelIndex, value]) => (
                  <div key={channelIndex} className={styles.channelItem}>
                    <span>CH {parseInt(channelIndex) + 1}</span>
                    <input
                      type="range"
                      min="0"
                      max="255"
                      value={value}
                      onChange={(e) => {
                        const newValue = Number(e.target.value);
                        setTimeline(prev => ({
                          ...prev,
                          keyframes: prev.keyframes.map(kf =>
                            selectedKeyframeIds.has(kf.id)
                              ? {
                                  ...kf,
                                  channelValues: {
                                    ...kf.channelValues,
                                    [channelIndex]: newValue
                                  }
                                }
                              : kf
                          )
                        }));
                        setEditingChannels(prev => ({
                          ...prev,
                          [channelIndex]: newValue
                        }));
                      }}
                    />
                    <span>{value}</span>
                  </div>
                ))}
                {Object.keys(selectedKeyframe.channelValues).length > 20 && (
                  <div className={styles.moreChannels}>
                    +{Object.keys(selectedKeyframe.channelValues).length - 20} more channels
                  </div>
                )}
              </div>
            </div>

            <div className={styles.propertyActions}>
              <button
                className={styles.saveButton}
                onClick={() => {
                  // Changes are already saved via onChange handlers, just close the panel
                  setSelectedKeyframeIds(new Set());
                  setEditingChannels({});
                  setEditingChannels({});
                }}
                title="Save changes and return to timeline editor"
              >
                <LucideIcon name="Check" />
                Save & Close
              </button>
              <button
                className={styles.deleteButton}
                  onClick={() => {
                    if (window.confirm(`Delete ${selectedKeyframeIds.size} selected keyframe${selectedKeyframeIds.size > 1 ? 's' : ''}?`)) {
                      deleteSelectedKeyframes();
                    }
                  }}
              >
                <LucideIcon name="Trash2" />
                Delete Keyframe
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
