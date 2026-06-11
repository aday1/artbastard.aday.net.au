import { useState, useCallback, useRef } from 'react';

export interface UndoRedoState<T> {
  history: T[];
  currentIndex: number;
  canUndo: boolean;
  canRedo: boolean;
}

export function useUndoRedo<T>(initialState: T, maxHistorySize: number = 50) {
  const [state, setState] = useState<T>(initialState);
  const [history, setHistory] = useState<T[]>([initialState]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const isUndoRedoRef = useRef(false);

  const canUndo = currentIndex > 0;
  const canRedo = currentIndex < history.length - 1;

  const updateState = useCallback((newState: T, addToHistory: boolean = true) => {
    setState(newState);
    
    if (addToHistory && !isUndoRedoRef.current) {
      setHistory(prev => {
        // Remove any "future" history if we're not at the end
        const newHistory = prev.slice(0, currentIndex + 1);
        // Add new state
        const updated = [...newHistory, newState];
        // Limit history size
        if (updated.length > maxHistorySize) {
          return updated.slice(-maxHistorySize);
        }
        return updated;
      });
      setCurrentIndex(prev => {
        const newIndex = prev + 1;
        // Adjust if we hit max history size
        const newHistory = history.slice(0, currentIndex + 1);
        const updated = [...newHistory, newState];
        if (updated.length > maxHistorySize) {
          return maxHistorySize - 1;
        }
        return newIndex;
      });
    }
  }, [currentIndex, history, maxHistorySize]);

  const undo = useCallback(() => {
    if (canUndo) {
      isUndoRedoRef.current = true;
      const prevIndex = currentIndex - 1;
      setCurrentIndex(prevIndex);
      setState(history[prevIndex]);
      // Reset flag after state update
      setTimeout(() => {
        isUndoRedoRef.current = false;
      }, 0);
    }
  }, [canUndo, currentIndex, history]);

  const redo = useCallback(() => {
    if (canRedo) {
      isUndoRedoRef.current = true;
      const nextIndex = currentIndex + 1;
      setCurrentIndex(nextIndex);
      setState(history[nextIndex]);
      // Reset flag after state update
      setTimeout(() => {
        isUndoRedoRef.current = false;
      }, 0);
    }
  }, [canRedo, currentIndex, history]);

  const reset = useCallback((newInitialState: T) => {
    setState(newInitialState);
    setHistory([newInitialState]);
    setCurrentIndex(0);
  }, []);

  return {
    state,
    updateState,
    undo,
    redo,
    canUndo,
    canRedo,
    reset
  };
}
