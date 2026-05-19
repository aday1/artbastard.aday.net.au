import React, { useState } from 'react';
import { useDocking } from '@/context/DockingContext';
import './GridControls.module.scss';

export const GridControls: React.FC = () => {
  const {
    state,
    setGridSize,
    setGridSnappingEnabled,
    setShowGrid,
  } = useDocking();

  const [isExpanded, setIsExpanded] = useState(false);
  const handleGridSizeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const size = parseInt(e.target.value, 10);
    if (size >= 20 && size <= 200) {
      setGridSize(size);
    }
  };

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };

  return (
    <div className={`grid-controls ${isExpanded ? 'expanded' : 'collapsed'}`}>
      <button
        className="grid-controls-toggle"
        onClick={toggleExpanded}
        title="Grid Settings"
      >
        <i className="fas fa-th"></i>
        {isExpanded && <span>Grid</span>}
      </button>

      {isExpanded && (
        <div className="grid-controls-panel">
          <div className="grid-control-group">
            <label>
              <input
                type="checkbox"
                checked={state.showGrid}
                onChange={(e) => setShowGrid(e.target.checked)}
              />
              <span>Show Grid</span>
            </label>
          </div>

          <div className="grid-control-group">
            <label>
              <input
                type="checkbox"
                checked={state.gridSnappingEnabled}
                onChange={(e) => setGridSnappingEnabled(e.target.checked)}
              />
              <span>Snap to Grid</span>
            </label>
          </div>

          <div className="grid-control-group">            <label>
              <span>Grid Size: {state.gridSize}px</span>
              <input
                type="range"
                min="20"
                max="200"
                step="10"
                value={state.gridSize}
                onChange={handleGridSizeChange}
                className="grid-size-slider"
              />
            </label>
          </div>          <div className="grid-presets">
            <span className="presets-label">Presets:</span>
            <div className="preset-buttons">
              <button onClick={() => setGridSize(40)} className={state.gridSize === 40 ? 'active' : ''}>
                40px
              </button>
              <button onClick={() => setGridSize(80)} className={state.gridSize === 80 ? 'active' : ''}>
                80px
              </button>
              <button onClick={() => setGridSize(120)} className={state.gridSize === 120 ? 'active' : ''}>
                120px
              </button>
              <button onClick={() => setGridSize(160)} className={state.gridSize === 160 ? 'active' : ''}>
                160px
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
