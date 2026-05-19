import React, { useMemo } from 'react';
import { useStore } from '../../store';
import styles from './ColorTemperatureVisualizer.module.scss';

interface ColorTemperatureVisualizerProps {
  width?: number;
  height?: number;
  className?: string;
}

// Convert RGB to color temperature (Kelvin) approximation
function rgbToColorTemp(r: number, g: number, b: number): number {
  // Simple approximation: warmer colors (more red) = lower temp, cooler (more blue) = higher temp
  const max = Math.max(r, g, b);
  if (max === 0) return 2000; // Default warm
  
  const normalizedR = r / max;
  const normalizedB = b / max;
  
  // Map to typical color temperature range (2000K - 10000K)
  // More red = lower temp, more blue = higher temp
  if (normalizedR > normalizedB) {
    // Warmer (red/orange)
    return 2000 + (normalizedR * 3000); // 2000-5000K
  } else {
    // Cooler (blue/white)
    return 5000 + (normalizedB * 5000); // 5000-10000K
  }
}

// Get color for temperature
function getTempColor(temp: number): string {
  if (temp < 3000) return '#ff8c42'; // Warm orange
  if (temp < 4000) return '#ffb347'; // Warm white
  if (temp < 5000) return '#fff5e6'; // Neutral white
  if (temp < 6000) return '#e6f3ff'; // Cool white
  if (temp < 7000) return '#b3d9ff'; // Daylight
  return '#80c5ff'; // Cool blue
}

export const ColorTemperatureVisualizer: React.FC<ColorTemperatureVisualizerProps> = ({
  width = 600,
  height = 400,
  className
}) => {
  const fixtures = useStore(state => state.fixtures);
  const dmxChannels = useStore(state => state.dmxChannels);
  
  // Calculate color temperature for each fixture
  const fixtureTemps = useMemo(() => {
    return fixtures.map(fixture => {
      const startAddress = fixture.startAddress - 1;
      let r = 0, g = 0, b = 0;
      let hasColor = false;
      
      // Find RGB channels
      fixture.channels.forEach((channel, index) => {
        const channelIndex = startAddress + index;
        const value = dmxChannels[channelIndex] || 0;
        
        if (channel.type === 'red') {
          r = value;
          hasColor = true;
        } else if (channel.type === 'green') {
          g = value;
          hasColor = true;
        } else if (channel.type === 'blue') {
          b = value;
          hasColor = true;
        }
      });
      
      if (!hasColor || (r === 0 && g === 0 && b === 0)) {
        return null;
      }
      
      const temp = rgbToColorTemp(r, g, b);
      const color = getTempColor(temp);
      
      return {
        fixture,
        temp,
        color,
        rgb: { r, g, b }
      };
    }).filter(Boolean);
  }, [fixtures, dmxChannels]);
  
  // Calculate average temperature
  const avgTemp = useMemo(() => {
    if (fixtureTemps.length === 0) return null;
    const sum = fixtureTemps.reduce((acc, ft: any) => acc + ft.temp, 0);
    return Math.round(sum / fixtureTemps.length);
  }, [fixtureTemps]);
  
  return (
    <div className={`${styles.colorTempVisualizer} ${className || ''}`} style={{ width, height }}>
      <div className={styles.header}>
        <h3>Color Temperature Analysis</h3>
        {avgTemp && (
          <div className={styles.avgTemp}>
            <span className={styles.tempValue}>{avgTemp}K</span>
            <span className={styles.tempLabel}>Average</span>
          </div>
        )}
      </div>
      
      <div className={styles.content}>
        {fixtureTemps.length === 0 ? (
          <div className={styles.emptyState}>
            <p>No fixtures with RGB channels active</p>
            <p className={styles.hint}>Activate RGB channels to see color temperature analysis</p>
          </div>
        ) : (
          <div className={styles.tempList}>
            {fixtureTemps.map((ft: any, index) => (
              <div key={ft.fixture.id || index} className={styles.tempItem}>
                <div className={styles.fixtureInfo}>
                  <span className={styles.fixtureName}>{ft.fixture.name}</span>
                  <span className={styles.temp}>{ft.temp}K</span>
                </div>
                <div className={styles.tempBar}>
                  <div
                    className={styles.tempFill}
                    style={{
                      backgroundColor: ft.color,
                      width: `${((ft.temp - 2000) / 8000) * 100}%`
                    }}
                  />
                </div>
                <div className={styles.rgbInfo}>
                  <span>R: {ft.rgb.r}</span>
                  <span>G: {ft.rgb.g}</span>
                  <span>B: {ft.rgb.b}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      
      {/* Temperature scale */}
      <div className={styles.scale}>
        <div className={styles.scaleLabel}>2000K</div>
        <div className={styles.scaleGradient} />
        <div className={styles.scaleLabel}>10000K</div>
      </div>
    </div>
  );
};

