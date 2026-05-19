import React, { useState, useRef, useCallback } from 'react';
import { SceneTimelineKeyframe } from '../store';
import { pixelsToTime, snapToGrid, calculateGridInterval } from '../utils/timelineHelpers';

interface UseTimelineInteractionOptions {
  timelineDuration: number;
  zoom: number;
  bpm?: number;
  snapEnabled?: boolean;
  onKeyframeMove?: (keyframeId: string, newTime: number) => void;
  onKeyframeValueChange?: (keyframeId: string, channel: number, newValue: number) => void;
  onKeyframeSelect?: (keyframeIds: string[]) => void;
  onKeyframeDelete?: (keyframeIds: string[]) => void;
  onKeyframeDuplicate?: (keyframeIds: string[]) => void;
}

export function useTimelineInteraction(options: UseTimelineInteractionOptions) {
  const {
    timelineDuration,
    zoom,
    bpm,
    snapEnabled = false,
    onKeyframeMove,
    onKeyframeValueChange,
    onKeyframeSelect,
    onKeyframeDelete,
    onKeyframeDuplicate
  } = options;

  const [selectedKeyframes, setSelectedKeyframes] = useState<Set<string>>(new Set());
  const [draggingKeyframe, setDraggingKeyframe] = useState<string | null>(null);
  const [dragStartPos, setDragStartPos] = useState<{ x: number; y: number } | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [hoveredKeyframe, setHoveredKeyframe] = useState<string | null>(null);
  const hasMovedRef = useRef(false);

  const handleKeyframeMouseDown = useCallback((
    e: React.MouseEvent,
    keyframeId: string,
    keyframeTime: number,
    keyframeValue?: number
  ) => {
    e.preventDefault();
    e.stopPropagation();
    
    hasMovedRef.current = false;
    setDraggingKeyframe(keyframeId);
    setDragStartPos({ x: e.clientX, y: e.clientY });
    setDragOffset({ x: 0, y: 0 });
    setIsDragging(true);

    // Handle selection
    const newSelection = new Set(selectedKeyframes);
    if (e.ctrlKey || e.metaKey) {
      // Multi-select
      if (newSelection.has(keyframeId)) {
        newSelection.delete(keyframeId);
      } else {
        newSelection.add(keyframeId);
      }
    } else if (e.shiftKey) {
      // Range select
      newSelection.add(keyframeId);
    } else {
      // Single select
      if (!newSelection.has(keyframeId)) {
        newSelection.clear();
        newSelection.add(keyframeId);
      }
    }
    setSelectedKeyframes(newSelection);
    onKeyframeSelect?.(Array.from(newSelection));
  }, [selectedKeyframes, onKeyframeSelect]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || !draggingKeyframe || !dragStartPos) return;

    const deltaX = e.clientX - dragStartPos.x;
    const deltaY = e.clientY - dragStartPos.y;

    if (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3) {
      hasMovedRef.current = true;
    }

    setDragOffset({ x: deltaX, y: deltaY });

    // Calculate new time
    const timeDelta = pixelsToTime(deltaX, zoom);
    const currentTime = pixelsToTime(
      pixelsToTime(0, zoom) + deltaX, // This needs the actual keyframe time
      zoom
    );

    // Apply snapping if enabled
    let newTime = currentTime;
    if (snapEnabled) {
      const gridInterval = calculateGridInterval(zoom, bpm);
      newTime = snapToGrid(currentTime, gridInterval);
    }

    // Clamp to timeline bounds
    newTime = Math.max(0, Math.min(newTime, timelineDuration));

    // Update keyframe position
    if (onKeyframeMove && hasMovedRef.current) {
      onKeyframeMove(draggingKeyframe, newTime);
    }
  }, [isDragging, draggingKeyframe, dragStartPos, zoom, snapEnabled, bpm, timelineDuration, onKeyframeMove]);

  const handleMouseUp = useCallback(() => {
    if (isDragging && draggingKeyframe) {
      setIsDragging(false);
      setDraggingKeyframe(null);
      setDragStartPos(null);
      setDragOffset({ x: 0, y: 0 });
    }
  }, [isDragging, draggingKeyframe]);

  // Global mouse event listeners
  React.useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  const selectKeyframes = useCallback((keyframeIds: string[], additive: boolean = false) => {
    if (additive) {
      setSelectedKeyframes(prev => {
        const newSet = new Set(prev);
        keyframeIds.forEach(id => newSet.add(id));
        return newSet;
      });
    } else {
      setSelectedKeyframes(new Set(keyframeIds));
    }
    onKeyframeSelect?.(keyframeIds);
  }, [onKeyframeSelect]);

  const clearSelection = useCallback(() => {
    setSelectedKeyframes(new Set());
    onKeyframeSelect?.([]);
  }, [onKeyframeSelect]);

  const deleteSelected = useCallback(() => {
    if (selectedKeyframes.size > 0) {
      onKeyframeDelete?.(Array.from(selectedKeyframes));
      setSelectedKeyframes(new Set());
    }
  }, [selectedKeyframes, onKeyframeDelete]);

  const duplicateSelected = useCallback(() => {
    if (selectedKeyframes.size > 0) {
      onKeyframeDuplicate?.(Array.from(selectedKeyframes));
    }
  }, [selectedKeyframes, onKeyframeDuplicate]);

  return {
    selectedKeyframes,
    draggingKeyframe,
    dragOffset,
    isDragging,
    hoveredKeyframe,
    setHoveredKeyframe,
    handleKeyframeMouseDown,
    selectKeyframes,
    clearSelection,
    deleteSelected,
    duplicateSelected,
    hasMoved: hasMovedRef.current
  };
}

