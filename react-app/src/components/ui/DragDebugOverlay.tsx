import React from 'react';
import { useDocking } from '@/context/DockingContext';

export const DragDebugOverlay: React.FC = () => {
  const { state } = useDocking();

  if (!state.isDragging) {
    return null;
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: 10,
        left: 10,
        background: 'rgba(0, 0, 0, 0.8)',
        color: 'white',
        padding: '8px 12px',
        borderRadius: '4px',
        fontSize: '12px',
        fontFamily: 'monospace',
        zIndex: 20000,
        pointerEvents: 'none',
      }}
    >
      <div>🎯 Dragging: {state.draggedComponentId}</div>
      <div>📏 Grid: {state.gridSize}px</div>
      <div>🧲 Snap: {state.gridSnappingEnabled ? 'ON' : 'OFF'}</div>
      <div>👁️ Grid Visible: {state.showGrid || state.showGridTemporarily ? 'YES' : 'NO'}</div>
      <div>⚡ Dock Zones: {state.showDockZones ? 'VISIBLE' : 'HIDDEN'}</div>
    </div>
  );
};
