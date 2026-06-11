import React, { useState, useEffect, useRef } from 'react';
import styles from './ColorPicker.module.scss';
import { useStore } from '../../store';

interface ColorPickerProps {
  fixtureId: string;
  rgbChannels?: {
    redChannel?: number;
    greenChannel?: number;
    blueChannel?: number;
  };
  movementChannels?: {
    panChannel?: number;
    tiltChannel?: number;
  };
  onValuesChange?: (values: {
    red?: number;
    green?: number;
    blue?: number;
    pan?: number;
    tilt?: number;
  }) => void;
}

export const ColorPicker: React.FC<ColorPickerProps> = ({
  fixtureId,
  rgbChannels = {},
  movementChannels = {},
  onValuesChange
}) => {
  const { redChannel, greenChannel, blueChannel } = rgbChannels;
  const { panChannel, tiltChannel } = movementChannels;
  
  // State for color values (0-255)
  const [color, setColor] = useState<{ r: number; g: number; b: number }>({ r: 255, g: 255, b: 255 });
  // State for movement values (0-255)
  const [movement, setMovement] = useState<{ pan: number; tilt: number }>({ pan: 127, tilt: 127 });
  
  // References to canvas elements
  const colorCanvasRef = useRef<HTMLCanvasElement>(null);
  const colorSliderRef = useRef<HTMLCanvasElement>(null);
  const movementCanvasRef = useRef<HTMLCanvasElement>(null);

  // Get DMX channel values and set functions from store
  const { getDmxChannelValue, setDmxChannelValue } = useStore(state => ({
    getDmxChannelValue: state.getDmxChannelValue,
    setDmxChannelValue: state.setDmxChannelValue
  }));

  // Initialize from DMX values if available
  useEffect(() => {
    if (redChannel !== undefined && greenChannel !== undefined && blueChannel !== undefined) {
      setColor({
        r: getDmxChannelValue(redChannel),
        g: getDmxChannelValue(greenChannel),
        b: getDmxChannelValue(blueChannel)
      });
    }
    
    if (panChannel !== undefined && tiltChannel !== undefined) {
      setMovement({
        pan: getDmxChannelValue(panChannel),
        tilt: getDmxChannelValue(tiltChannel)
      });
    }
  }, [redChannel, greenChannel, blueChannel, panChannel, tiltChannel, getDmxChannelValue]);

  // Draw color picker canvas
  useEffect(() => {
    const drawColorPicker = () => {
      const canvas = colorCanvasRef.current;
      if (!canvas) return;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      
      const width = canvas.width;
      const height = canvas.height;
      
      // Create color gradient
      const gradientX = ctx.createLinearGradient(0, 0, width, 0);
      gradientX.addColorStop(0, 'rgba(255, 0, 0, 1)');
      gradientX.addColorStop(0.17, 'rgba(255, 255, 0, 1)');
      gradientX.addColorStop(0.33, 'rgba(0, 255, 0, 1)');
      gradientX.addColorStop(0.5, 'rgba(0, 255, 255, 1)');
      gradientX.addColorStop(0.67, 'rgba(0, 0, 255, 1)');
      gradientX.addColorStop(0.83, 'rgba(255, 0, 255, 1)');
      gradientX.addColorStop(1, 'rgba(255, 0, 0, 1)');
      
      // Fill with gradient
      ctx.fillStyle = gradientX;
      ctx.fillRect(0, 0, width, height);
      
      // Add white gradient from top to middle
      const gradientY1 = ctx.createLinearGradient(0, 0, 0, height / 2);
      gradientY1.addColorStop(0, 'rgba(255, 255, 255, 1)');
      gradientY1.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = gradientY1;
      ctx.fillRect(0, 0, width, height / 2);
      
      // Add black gradient from middle to bottom
      const gradientY2 = ctx.createLinearGradient(0, height / 2, 0, height);
      gradientY2.addColorStop(0, 'rgba(0, 0, 0, 0)');
      gradientY2.addColorStop(1, 'rgba(0, 0, 0, 1)');
      ctx.fillStyle = gradientY2;
      ctx.fillRect(0, height / 2, width, height / 2);
      
      // Draw current color indicator
      const rgbColor = `rgb(${color.r}, ${color.g}, ${color.b})`;
      // Determine position based on color (simplified approximation)
      // This is a simple approximation - a more accurate mapping would require color space calculations
      let colorPos = { x: (color.r + color.g + color.b) / 3 / 255 * width, y: height / 2 };
      
      // Draw indicator circle
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(colorPos.x, colorPos.y, 10, 0, 2 * Math.PI);
      ctx.stroke();
    };
    
    drawColorPicker();
  }, [color]);

  // Draw movement (pan/tilt) canvas
  useEffect(() => {
    const drawMovementPicker = () => {
      const canvas = movementCanvasRef.current;
      if (!canvas) return;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      
      const width = canvas.width;
      const height = canvas.height;
      
      // Clear canvas
      ctx.clearRect(0, 0, width, height);
      
      // Draw background grid
      ctx.strokeStyle = '#555555';
      ctx.lineWidth = 0.5;
      
      // Draw grid lines
      for (let i = 0; i <= 10; i++) {
        // Vertical lines
        ctx.beginPath();
        ctx.moveTo(width * (i / 10), 0);
        ctx.lineTo(width * (i / 10), height);
        ctx.stroke();
        
        // Horizontal lines
        ctx.beginPath();
        ctx.moveTo(0, height * (i / 10));
        ctx.lineTo(width, height * (i / 10));
        ctx.stroke();
      }
      
      // Draw center lines
      ctx.strokeStyle = '#888888';
      ctx.lineWidth = 1;
      
      ctx.beginPath();
      ctx.moveTo(width / 2, 0);
      ctx.lineTo(width / 2, height);
      ctx.stroke();
      
      ctx.beginPath();
      ctx.moveTo(0, height / 2);
      ctx.lineTo(width, height / 2);
      ctx.stroke();
      
      // Calculate positions based on pan/tilt values (0-255)
      const panPosition = (movement.pan / 255) * width;
      const tiltPosition = (movement.tilt / 255) * height;
      
      // Draw current position indicator
      ctx.fillStyle = '#4ecdc4';
      ctx.beginPath();
      ctx.arc(panPosition, tiltPosition, 8, 0, 2 * Math.PI);
      ctx.fill();
      
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(panPosition, tiltPosition, 8, 0, 2 * Math.PI);
      ctx.stroke();
    };
    
    drawMovementPicker();
  }, [movement]);

  // Handle color picker canvas clicks
  const handleColorPickerClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = colorCanvasRef.current;
    if (!canvas) return;
    
    // Get click coordinates relative to canvas
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Get color at click position
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const pixelData = ctx.getImageData(x, y, 1, 1).data;
    const newColor = { r: pixelData[0], g: pixelData[1], b: pixelData[2] };
    
    setColor(newColor);
    
    // Update DMX channels if available
    if (redChannel !== undefined) setDmxChannelValue(redChannel, newColor.r);
    if (greenChannel !== undefined) setDmxChannelValue(greenChannel, newColor.g);
    if (blueChannel !== undefined) setDmxChannelValue(blueChannel, newColor.b);
    
    // Notify parent component
    if (onValuesChange) {
      onValuesChange({
        red: newColor.r,
        green: newColor.g,
        blue: newColor.b
      });
    }
  };

  // Handle movement picker canvas clicks/drags
  const handleMovementPickerInteraction = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = movementCanvasRef.current;
    if (!canvas) return;
    
    // Get click coordinates relative to canvas
    const rect = canvas.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left, canvas.width));
    const y = Math.max(0, Math.min(e.clientY - rect.top, canvas.height));
    
    // Calculate pan/tilt values (0-255)
    const panValue = Math.round((x / canvas.width) * 255);
    const tiltValue = Math.round((y / canvas.height) * 255);
    
    const newMovement = { pan: panValue, tilt: tiltValue };
    setMovement(newMovement);
    
    // Update DMX channels if available
    if (panChannel !== undefined) setDmxChannelValue(panChannel, panValue);
    if (tiltChannel !== undefined) setDmxChannelValue(tiltChannel, tiltValue);
    
    // Notify parent component
    if (onValuesChange) {
      onValuesChange({
        pan: panValue,
        tilt: tiltValue
      });
    }
  };

  // Enable dragging for movement picker
  useEffect(() => {
    const canvas = movementCanvasRef.current;
    if (!canvas) return;
    
    let isDragging = false;
    
    const handleMouseDown = () => {
      isDragging = true;
    };
    
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      
      const rect = canvas.getBoundingClientRect();
      const x = Math.max(0, Math.min(e.clientX - rect.left, canvas.width));
      const y = Math.max(0, Math.min(e.clientY - rect.top, canvas.height));
      
      // Calculate pan/tilt values (0-255)
      const panValue = Math.round((x / canvas.width) * 255);
      const tiltValue = Math.round((y / canvas.height) * 255);
      
      const newMovement = { pan: panValue, tilt: tiltValue };
      setMovement(newMovement);
      
      // Update DMX channels if available
      if (panChannel !== undefined) setDmxChannelValue(panChannel, panValue);
      if (tiltChannel !== undefined) setDmxChannelValue(tiltChannel, tiltValue);
      
      // Notify parent component
      if (onValuesChange) {
        onValuesChange({
          pan: panValue,
          tilt: tiltValue
        });
      }
    };
    
    const handleMouseUp = () => {
      isDragging = false;
    };
    
    canvas.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    
    return () => {
      canvas.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [panChannel, tiltChannel, onValuesChange, setDmxChannelValue]);

  return (
    <div className={styles.colorPickerContainer}>
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>RGB Color Control</h3>
        {rgbChannels && (redChannel !== undefined || greenChannel !== undefined || blueChannel !== undefined) ? (
          <div className={styles.rgbWrapper}>
            <canvas 
              ref={colorCanvasRef}
              width={200}
              height={200}
              className={styles.colorCanvas}
              onClick={handleColorPickerClick}
            />
            <div className={styles.rgbValues}>
              <div className={styles.rgbValue}>
                <label>R:</label>
                <input 
                  type="number" 
                  value={color.r}
                  min={0}
                  max={255}
                  onChange={(e) => {
                    const val = Math.max(0, Math.min(255, parseInt(e.target.value) || 0));
                    setColor(prev => ({ ...prev, r: val }));
                    if (redChannel !== undefined) setDmxChannelValue(redChannel, val);
                    if (onValuesChange) onValuesChange({ red: val });
                  }}
                />
                <span>DMX: {redChannel !== undefined ? redChannel : 'N/A'}</span>
              </div>
              <div className={styles.rgbValue}>
                <label>G:</label>
                <input 
                  type="number" 
                  value={color.g}
                  min={0}
                  max={255}
                  onChange={(e) => {
                    const val = Math.max(0, Math.min(255, parseInt(e.target.value) || 0));
                    setColor(prev => ({ ...prev, g: val }));
                    if (greenChannel !== undefined) setDmxChannelValue(greenChannel, val);
                    if (onValuesChange) onValuesChange({ green: val });
                  }}
                />
                <span>DMX: {greenChannel !== undefined ? greenChannel : 'N/A'}</span>
              </div>
              <div className={styles.rgbValue}>
                <label>B:</label>
                <input 
                  type="number" 
                  value={color.b}
                  min={0}
                  max={255}
                  onChange={(e) => {
                    const val = Math.max(0, Math.min(255, parseInt(e.target.value) || 0));
                    setColor(prev => ({ ...prev, b: val }));
                    if (blueChannel !== undefined) setDmxChannelValue(blueChannel, val);
                    if (onValuesChange) onValuesChange({ blue: val });
                  }}
                />
                <span>DMX: {blueChannel !== undefined ? blueChannel : 'N/A'}</span>
              </div>
            </div>
            <div 
              className={styles.colorPreview} 
              style={{ backgroundColor: `rgb(${color.r},${color.g},${color.b})` }}
            />
          </div>
        ) : (
          <div className={styles.noChannels}>
            This fixture does not have RGB channels configured.
          </div>
        )}
      </div>

      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Pan/Tilt Control</h3>
        {movementChannels && (panChannel !== undefined || tiltChannel !== undefined) ? (
          <div className={styles.movementWrapper}>
            <canvas 
              ref={movementCanvasRef}
              width={200}
              height={200}
              className={styles.movementCanvas}
              onClick={handleMovementPickerInteraction}
            />
            <div className={styles.movementValues}>
              <div className={styles.movementValue}>
                <label>Pan:</label>
                <input 
                  type="number" 
                  value={movement.pan}
                  min={0}
                  max={255}
                  onChange={(e) => {
                    const val = Math.max(0, Math.min(255, parseInt(e.target.value) || 0));
                    setMovement(prev => ({ ...prev, pan: val }));
                    if (panChannel !== undefined) setDmxChannelValue(panChannel, val);
                    if (onValuesChange) onValuesChange({ pan: val });
                  }}
                />
                <span>DMX: {panChannel !== undefined ? panChannel : 'N/A'}</span>
              </div>
              <div className={styles.movementValue}>
                <label>Tilt:</label>
                <input 
                  type="number" 
                  value={movement.tilt}
                  min={0}
                  max={255}
                  onChange={(e) => {
                    const val = Math.max(0, Math.min(255, parseInt(e.target.value) || 0));
                    setMovement(prev => ({ ...prev, tilt: val }));
                    if (tiltChannel !== undefined) setDmxChannelValue(tiltChannel, val);
                    if (onValuesChange) onValuesChange({ tilt: val });
                  }}
                />
                <span>DMX: {tiltChannel !== undefined ? tiltChannel : 'N/A'}</span>
              </div>
            </div>
            <div className={styles.movementPreview}>
              <div className={styles.fixtureHead} style={{
                transform: `rotateX(${movement.tilt / 255 * 180 - 90}deg) rotateY(${movement.pan / 255 * 360 - 180}deg)`
              }}>
                <div className={styles.beam} style={{
                  backgroundColor: `rgb(${color.r},${color.g},${color.b})`
                }} />
              </div>
            </div>
          </div>
        ) : (
          <div className={styles.noChannels}>
            This fixture does not have Pan/Tilt channels configured.
          </div>
        )}
      </div>
    </div>
  );
};
