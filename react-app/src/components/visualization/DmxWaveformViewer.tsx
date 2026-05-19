import React, { useRef, useEffect, useMemo } from 'react';
import { useStore } from '../../store';
import styles from './DmxWaveformViewer.module.scss';

interface DmxWaveformViewerProps {
  channels?: number[]; // Specific channels to display, or all if undefined
  width?: number;
  height?: number;
  className?: string;
  showLabels?: boolean;
  colorMode?: 'individual' | 'intensity' | 'rgb';
}

export const DmxWaveformViewer: React.FC<DmxWaveformViewerProps> = ({
  channels,
  width = 800,
  height = 400,
  className,
  showLabels = true,
  colorMode = 'intensity'
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const historyRef = useRef<number[][]>([]);
  const maxHistoryLength = 200; // Number of samples to keep
  
  const dmxChannels = useStore(state => state.dmxChannels);
  const channelNames = useStore(state => state.channelNames);
  const fixtures = useStore(state => state.fixtures);
  
  // Determine which channels to display
  const channelsToDisplay = useMemo(() => {
    if (channels) return channels;
    
    // Default: show first 16 channels or all active channels
    const activeChannels: number[] = [];
    for (let i = 0; i < 512; i++) {
      if (dmxChannels[i] > 0) {
        activeChannels.push(i);
      }
    }
    return activeChannels.slice(0, 16);
  }, [channels, dmxChannels]);
  
  // Get channel colors based on mode
  const getChannelColor = (channelIndex: number, value: number): string => {
    if (colorMode === 'intensity') {
      const intensity = value / 255;
      const hue = 200; // Blue
      const saturation = 80;
      const lightness = 20 + intensity * 50;
      return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
    }
    
    if (colorMode === 'rgb') {
      // Try to find RGB channels for this fixture
      const fixture = fixtures.find(f => {
        const start = f.startAddress - 1;
        const end = start + f.channels.length;
        return channelIndex >= start && channelIndex < end;
      });
      
      if (fixture) {
        const offset = channelIndex - (fixture.startAddress - 1);
        const channel = fixture.channels[offset];
        
        if (channel?.type === 'red') {
          return `rgb(${value}, 0, 0)`;
        } else if (channel?.type === 'green') {
          return `rgb(0, ${value}, 0)`;
        } else if (channel?.type === 'blue') {
          return `rgb(0, 0, ${value})`;
        }
      }
    }
    
    // Individual: use channel index for hue
    const hue = (channelIndex * 30) % 360;
    return `hsl(${hue}, 70%, 50%)`;
  };
  
  // Update history
  useEffect(() => {
    const interval = setInterval(() => {
      const currentValues = channelsToDisplay.map(ch => dmxChannels[ch] || 0);
      historyRef.current.push(currentValues);
      
      if (historyRef.current.length > maxHistoryLength) {
        historyRef.current.shift();
      }
    }, 50); // 20 FPS update rate
    
    return () => clearInterval(interval);
  }, [channelsToDisplay, dmxChannels]);
  
  // Draw waveform
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const draw = () => {
      ctx.clearRect(0, 0, width, height);
      
      const history = historyRef.current;
      if (history.length === 0) return;
      
      const channelCount = channelsToDisplay.length;
      const channelHeight = height / channelCount;
      const sampleWidth = width / maxHistoryLength;
      
      // Draw grid
      ctx.strokeStyle = 'rgba(100, 100, 100, 0.2)';
      ctx.lineWidth = 1;
      for (let i = 0; i <= channelCount; i++) {
        const y = i * channelHeight;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }
      
      // Draw waveforms for each channel
      channelsToDisplay.forEach((channelIndex, channelIdx) => {
        const yOffset = channelIdx * channelHeight;
        const centerY = yOffset + channelHeight / 2;
        const amplitude = channelHeight * 0.4;
        
        ctx.strokeStyle = getChannelColor(channelIndex, dmxChannels[channelIndex] || 0);
        ctx.lineWidth = 2;
        ctx.beginPath();
        
        history.forEach((sample, sampleIdx) => {
          const value = sample[channelIdx] || 0;
          const normalizedValue = value / 255; // 0-1
          const y = centerY - (normalizedValue - 0.5) * amplitude * 2;
          const x = sampleIdx * sampleWidth;
          
          if (sampleIdx === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        });
        
        ctx.stroke();
        
        // Draw current value indicator
        const currentValue = dmxChannels[channelIndex] || 0;
        const normalizedValue = currentValue / 255;
        const currentY = centerY - (normalizedValue - 0.5) * amplitude * 2;
        
        ctx.fillStyle = getChannelColor(channelIndex, currentValue);
        ctx.beginPath();
        ctx.arc(width - 10, currentY, 4, 0, Math.PI * 2);
        ctx.fill();
        
        // Draw channel label
        if (showLabels) {
          const channelName = channelNames[channelIndex] || `CH ${channelIndex + 1}`;
          ctx.fillStyle = '#e2e8f0';
          ctx.font = '11px monospace';
          ctx.textAlign = 'left';
          ctx.fillText(channelName, 8, centerY + 4);
          ctx.fillText(`${currentValue}`, width - 50, centerY + 4);
        }
      });
      
      animationRef.current = requestAnimationFrame(draw);
    };
    
    draw();
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [channelsToDisplay, dmxChannels, channelNames, width, height, showLabels, colorMode, fixtures]);
  
  return (
    <div className={`${styles.dmxWaveformViewer} ${className || ''}`}>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className={styles.canvas}
      />
      <div className={styles.controls}>
        <div className={styles.info}>
          <span>Channels: {channelsToDisplay.length}</span>
          <span>Mode: {colorMode}</span>
          <span>Rate: 20 FPS</span>
        </div>
      </div>
    </div>
  );
};

