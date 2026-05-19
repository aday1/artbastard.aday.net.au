import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useStore } from '../../store/store';
import styles from './CustomPathEditor.module.scss';

interface PathPoint {
  x: number; // 0-255 DMX value
  y: number; // 0-255 DMX value
}

interface CustomPathEditorProps {
  isOpen: boolean;
  onClose: () => void;
  onSave?: (points: PathPoint[]) => void;
  initialPoints?: PathPoint[];
  mode?: 'autopilot' | 'track'; // Which autopilot system to use
}

export const CustomPathEditor: React.FC<CustomPathEditorProps> = ({
  isOpen,
  onClose,
  onSave,
  initialPoints = [],
  mode = 'autopilot'
}) => {
  const { 
    panTiltAutopilot, 
    setPanTiltAutopilot,
    autopilotTrackCustomPoints,
    setAutopilotTrackCustomPoints 
  } = useStore();
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [points, setPoints] = useState<PathPoint[]>(initialPoints);
  const [isDragging, setIsDragging] = useState(false);
  const [dragIndex, setDragIndex] = useState<number>(-1);
  const [showGrid, setShowGrid] = useState(true);
  const [showPreview, setShowPreview] = useState(true);
  const [previewPosition, setPreviewPosition] = useState(0);

  const canvasWidth = 400;
  const canvasHeight = 400;

  // Initialize points from store
  useEffect(() => {
    if (isOpen) {
      if (mode === 'autopilot' && panTiltAutopilot.customPath) {
        setPoints(panTiltAutopilot.customPath);
      } else if (mode === 'track' && autopilotTrackCustomPoints) {
        setPoints(autopilotTrackCustomPoints);
      } else if (initialPoints.length > 0) {
        setPoints(initialPoints);
      } else {
        // Start with a simple default path
        setPoints([
          { x: 127, y: 64 },   // Top center
          { x: 191, y: 127 },  // Right center
          { x: 127, y: 191 },  // Bottom center
          { x: 64, y: 127 },   // Left center
        ]);
      }
    }
  }, [isOpen, mode, panTiltAutopilot.customPath, autopilotTrackCustomPoints, initialPoints]);

  // Convert DMX values (0-255) to canvas coordinates
  const dmxToCanvas = useCallback((dmxX: number, dmxY: number) => {
    const x = (dmxX / 255) * canvasWidth;
    const y = canvasHeight - ((dmxY / 255) * canvasHeight); // Invert Y for display
    return { x, y };
  }, [canvasWidth, canvasHeight]);

  // Convert canvas coordinates to DMX values (0-255)
  const canvasToDmx = useCallback((canvasX: number, canvasY: number) => {
    const x = Math.round((canvasX / canvasWidth) * 255);
    const y = Math.round(((canvasHeight - canvasY) / canvasHeight) * 255); // Invert Y
    return { 
      x: Math.max(0, Math.min(255, x)), 
      y: Math.max(0, Math.min(255, y)) 
    };
  }, [canvasWidth, canvasHeight]);

  // Draw the canvas
  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    
    // Draw background
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // Draw grid
    if (showGrid) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.lineWidth = 1;
      const gridSize = 20;
      
      for (let x = 0; x <= canvasWidth; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvasHeight);
        ctx.stroke();
      }
      
      for (let y = 0; y <= canvasHeight; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvasWidth, y);
        ctx.stroke();
      }
    }

    // Draw center lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 5]);
    
    // Vertical center line
    ctx.beginPath();
    ctx.moveTo(canvasWidth / 2, 0);
    ctx.lineTo(canvasWidth / 2, canvasHeight);
    ctx.stroke();
    
    // Horizontal center line
    ctx.beginPath();
    ctx.moveTo(0, canvasHeight / 2);
    ctx.lineTo(canvasWidth, canvasHeight / 2);
    ctx.stroke();
    
    ctx.setLineDash([]);

    // Draw path lines
    if (points.length > 1) {
      ctx.strokeStyle = '#00d4ff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      
      const firstPoint = dmxToCanvas(points[0].x, points[0].y);
      ctx.moveTo(firstPoint.x, firstPoint.y);
      
      for (let i = 1; i < points.length; i++) {
        const point = dmxToCanvas(points[i].x, points[i].y);
        ctx.lineTo(point.x, point.y);
      }
      
      // Close the path if we have more than 2 points
      if (points.length > 2) {
        ctx.lineTo(firstPoint.x, firstPoint.y);
      }
      
      ctx.stroke();
    }

    // Draw points
    points.forEach((point, index) => {
      const { x, y } = dmxToCanvas(point.x, point.y);
      
      // Point background
      ctx.fillStyle = index === dragIndex ? '#ff6b6b' : '#00d4ff';
      ctx.beginPath();
      ctx.arc(x, y, 8, 0, 2 * Math.PI);
      ctx.fill();
      
      // Point border
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();
      
      // Point number
      ctx.fillStyle = '#ffffff';
      ctx.font = '10px Arial';
      ctx.textAlign = 'center';
      ctx.fillText((index + 1).toString(), x, y + 3);
    });

    // Draw preview position
    if (showPreview && points.length > 1) {
      const progress = previewPosition / 100;
      const pathIndex = progress * (points.length - 1);
      const lowerIndex = Math.floor(pathIndex);
      const upperIndex = Math.min(lowerIndex + 1, points.length - 1);
      const t = pathIndex - lowerIndex;
      
      const lowerPoint = points[lowerIndex];
      const upperPoint = points[upperIndex];
      
      const previewX = lowerPoint.x + (upperPoint.x - lowerPoint.x) * t;
      const previewY = lowerPoint.y + (upperPoint.y - lowerPoint.y) * t;
      
      const { x, y } = dmxToCanvas(previewX, previewY);
      
      // Preview indicator
      ctx.fillStyle = '#ff9f43';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, 6, 0, 2 * Math.PI);
      ctx.fill();
      ctx.stroke();
      
      // Preview trail
      ctx.fillStyle = 'rgba(255, 159, 67, 0.3)';
      ctx.beginPath();
      ctx.arc(x, y, 12, 0, 2 * Math.PI);
      ctx.fill();
    }
  }, [points, showGrid, showPreview, previewPosition, dragIndex, dmxToCanvas]);

  // Redraw canvas when points change
  useEffect(() => {
    drawCanvas();
  }, [drawCanvas]);

  // Handle mouse events
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Check if clicking on existing point
    for (let i = 0; i < points.length; i++) {
      const point = dmxToCanvas(points[i].x, points[i].y);
      const distance = Math.sqrt((x - point.x) ** 2 + (y - point.y) ** 2);
      
      if (distance <= 10) {
        setIsDragging(true);
        setDragIndex(i);
        return;
      }
    }

    // Add new point if not clicking on existing one
    const dmxCoords = canvasToDmx(x, y);
    setPoints(prev => [...prev, dmxCoords]);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging || dragIndex === -1) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const dmxCoords = canvasToDmx(x, y);

    setPoints(prev => prev.map((point, index) => 
      index === dragIndex ? dmxCoords : point
    ));
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setDragIndex(-1);
  };

  // Handle double-click to remove point
  const handleDoubleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    for (let i = 0; i < points.length; i++) {
      const point = dmxToCanvas(points[i].x, points[i].y);
      const distance = Math.sqrt((x - point.x) ** 2 + (y - point.y) ** 2);
      
      if (distance <= 10 && points.length > 2) {
        setPoints(prev => prev.filter((_, index) => index !== i));
        return;
      }
    }
  };

  const handleSave = () => {
    if (mode === 'autopilot') {
      setPanTiltAutopilot({ customPath: points });
    } else if (mode === 'track') {
      setAutopilotTrackCustomPoints(points);
    }
    
    onSave?.(points);
    onClose();
  };

  const handleClear = () => {
    if (confirm('Clear all points? This cannot be undone.')) {
      setPoints([]);
    }
  };

  const handlePresetPattern = (pattern: string) => {
    const centerX = 127;
    const centerY = 127;
    const radius = 80;
    
    let newPoints: PathPoint[] = [];
    
    switch (pattern) {
      case 'circle':
        for (let i = 0; i < 8; i++) {
          const angle = (i / 8) * 2 * Math.PI;
          newPoints.push({
            x: Math.round(centerX + Math.cos(angle) * radius),
            y: Math.round(centerY + Math.sin(angle) * radius)
          });
        }
        break;
      case 'square':
        newPoints = [
          { x: centerX - radius, y: centerY - radius },
          { x: centerX + radius, y: centerY - radius },
          { x: centerX + radius, y: centerY + radius },
          { x: centerX - radius, y: centerY + radius },
        ];
        break;
      case 'triangle':
        newPoints = [
          { x: centerX, y: centerY - radius },
          { x: centerX + radius * 0.866, y: centerY + radius * 0.5 },
          { x: centerX - radius * 0.866, y: centerY + radius * 0.5 },
        ];
        break;
      case 'figure8':
        for (let i = 0; i < 16; i++) {
          const t = (i / 16) * 2 * Math.PI;
          newPoints.push({
            x: Math.round(centerX + Math.sin(t * 2) * radius * 0.8),
            y: Math.round(centerY + Math.sin(t) * radius)
          });
        }
        break;
    }
    
    setPoints(newPoints.map(p => ({
      x: Math.max(0, Math.min(255, p.x)),
      y: Math.max(0, Math.min(255, p.y))
    })));
  };

  // Preview animation
  useEffect(() => {
    if (!showPreview || !isOpen) return;

    const interval = setInterval(() => {
      setPreviewPosition(prev => (prev + 1) % 101);
    }, 50);

    return () => clearInterval(interval);
  }, [showPreview, isOpen]);

  if (!isOpen) return null;

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <h3>Custom Path Editor</h3>
          <button className={styles.closeButton} onClick={onClose}>×</button>
        </div>
        
        <div className={styles.content}>
          <div className={styles.canvasContainer}>
            <canvas
              ref={canvasRef}
              width={canvasWidth}
              height={canvasHeight}
              className={styles.canvas}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onDoubleClick={handleDoubleClick}
            />
            
            <div className={styles.canvasInfo}>
              <p>Click to add points • Drag to move • Double-click to remove</p>
              <p>{points.length} point{points.length !== 1 ? 's' : ''}</p>
            </div>
          </div>
          
          <div className={styles.controls}>
            <div className={styles.section}>
              <h4>View Options</h4>
              <label>
                <input
                  type="checkbox"
                  checked={showGrid}
                  onChange={(e) => setShowGrid(e.target.checked)}
                />
                Show Grid
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={showPreview}
                  onChange={(e) => setShowPreview(e.target.checked)}
                />
                Show Preview
              </label>
            </div>
            
            {showPreview && (
              <div className={styles.section}>
                <h4>Preview Position</h4>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={previewPosition}
                  onChange={(e) => setPreviewPosition(parseInt(e.target.value))}
                  className={styles.previewSlider}
                />
                <span>{previewPosition}%</span>
              </div>
            )}
            
            <div className={styles.section}>
              <h4>Preset Patterns</h4>
              <div className={styles.presetButtons}>
                <button onClick={() => handlePresetPattern('circle')}>Circle</button>
                <button onClick={() => handlePresetPattern('square')}>Square</button>
                <button onClick={() => handlePresetPattern('triangle')}>Triangle</button>
                <button onClick={() => handlePresetPattern('figure8')}>Figure 8</button>
              </div>
            </div>
            
            <div className={styles.section}>
              <h4>Point List</h4>
              <div className={styles.pointList}>
                {points.map((point, index) => (
                  <div key={index} className={styles.pointItem}>
                    <span>#{index + 1}</span>
                    <div className={styles.pointCoords}>
                      <span>Pan: {point.x}</span>
                      <span>Tilt: {point.y}</span>
                    </div>
                    <button
                      onClick={() => {
                        if (points.length > 2) {
                          setPoints(prev => prev.filter((_, i) => i !== index));
                        }
                      }}
                      disabled={points.length <= 2}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
        
        <div className={styles.footer}>
          <button className={styles.clearButton} onClick={handleClear}>
            Clear All
          </button>
          <div className={styles.actionButtons}>
            <button className={styles.cancelButton} onClick={onClose}>
              Cancel
            </button>
            <button 
              className={styles.saveButton} 
              onClick={handleSave}
              disabled={points.length < 2}
            >
              Save Path ({points.length} points)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CustomPathEditor;