import React, { useEffect } from 'react';
import { useDocking } from '@/context/DockingContext';

export const GridKeyboardControls: React.FC = () => {
  const { 
    state, 
    setGridSize, 
    setGridSnappingEnabled, 
    setShowGrid 
  } = useDocking();

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Only handle if no input element is focused
      if (document.activeElement?.tagName === 'INPUT' || 
          document.activeElement?.tagName === 'TEXTAREA') {
        return;
      }

      // Ctrl + G: Toggle grid visibility
      if (e.ctrlKey && e.key === 'g') {
        e.preventDefault();
        setShowGrid(!state.showGrid);
      }

      // Ctrl + S: Toggle grid snapping
      if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        setGridSnappingEnabled(!state.gridSnappingEnabled);
      }

      // Ctrl + Plus: Increase grid size
      if (e.ctrlKey && (e.key === '+' || e.key === '=')) {
        e.preventDefault();
        setGridSize(Math.min(100, state.gridSize + 10));
      }

      // Ctrl + Minus: Decrease grid size
      if (e.ctrlKey && e.key === '-') {
        e.preventDefault();
        setGridSize(Math.max(10, state.gridSize - 10));
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [state.showGrid, state.gridSnappingEnabled, state.gridSize, setShowGrid, setGridSnappingEnabled, setGridSize]);

  return null; // This component only handles keyboard events
};
