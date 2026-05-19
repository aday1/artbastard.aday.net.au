import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useStore } from '../../store';
import { useTheme } from '../../context/ThemeContext';
import { useMobile } from '../../hooks/useMobile';
import { LucideIcon } from '../ui/LucideIcon';
import styles from './AccelerometerControl.module.scss';

interface AccelerometerMapping {
  id: string;
  axis: 'x' | 'y' | 'z' | 'magnitude';
  targetType: 'dmx' | 'fixture';
  targetId: string; // DMX channel number or fixture ID
  targetParam?: string; // For fixtures: 'pan', 'tilt', 'dimmer', 'red', 'green', 'blue', etc.
  minValue: number; // Input range min (typically -1 to 1)
  maxValue: number; // Input range max
  outputMin: number; // DMX output min (0-255)
  outputMax: number; // DMX output max (0-255)
  invert: boolean;
  enabled: boolean;
}

interface AccelerometerData {
  x: number;
  y: number;
  z: number;
  magnitude: number;
  timestamp: number;
}

interface AccelerometerState {
  enabled: boolean;
  smoothing: number; // 0-1, higher = more smoothing
  mappings: AccelerometerMapping[];
  lastData: AccelerometerData | null;
  smoothedData: AccelerometerData | null;
  permissionGranted: boolean | null;
  isSupported: boolean;
}

const AccelerometerControl: React.FC = () => {
  const { theme } = useTheme();
  const { isMobile, isTouch } = useMobile();
  const { dmxChannels, setDmxChannel, fixtures } = useStore();
  
  const [state, setState] = useState<AccelerometerState>(() => {
    // Load from localStorage
    const saved = localStorage.getItem('accelerometerControl');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return {
          enabled: false, // Always start disabled
          smoothing: parsed.smoothing ?? 0.7,
          mappings: parsed.mappings ?? [],
          lastData: null,
          smoothedData: null,
          permissionGranted: parsed.permissionGranted ?? null,
          isSupported: typeof window !== 'undefined' && ('DeviceMotionEvent' in window || 'DeviceOrientationEvent' in window),
        };
      } catch (e) {
        console.error('Failed to load accelerometer settings:', e);
      }
    }
    return {
      enabled: false,
      smoothing: 0.7,
      mappings: [],
      lastData: null,
      smoothedData: null,
      permissionGranted: null,
      isSupported: typeof window !== 'undefined' && ('DeviceMotionEvent' in window || 'DeviceOrientationEvent' in window),
    };
  });

  const animationFrameRef = useRef<number | null>(null);
  const smoothingBufferRef = useRef<AccelerometerData | null>(null);

  // Request permission and start listening
  const requestPermission = useCallback(async () => {
    if (!state.isSupported) {
      alert('Accelerometer is not supported on this device/browser');
      return;
    }

    // Request permission (iOS 13+)
    if (typeof (DeviceMotionEvent as any).requestPermission === 'function') {
      try {
        const permission = await (DeviceMotionEvent as any).requestPermission();
        if (permission === 'granted') {
          setState(prev => ({ ...prev, permissionGranted: true }));
        } else {
          setState(prev => ({ ...prev, permissionGranted: false }));
          alert('Accelerometer permission denied');
        }
      } catch (error) {
        console.error('Error requesting permission:', error);
        setState(prev => ({ ...prev, permissionGranted: false }));
      }
    } else {
      // Permission not required (Android, older iOS)
      setState(prev => ({ ...prev, permissionGranted: true }));
    }
  }, [state.isSupported]);

  // Process accelerometer data
  const processAccelerometerData = useCallback((event: DeviceMotionEvent) => {
    const acceleration = event.accelerationIncludingGravity || event.acceleration;
    if (!acceleration) return;

    // Normalize values (typically -1 to 1, but can vary)
    const x = acceleration.x ? acceleration.x / 9.81 : 0; // Normalize by gravity
    const y = acceleration.y ? acceleration.y / 9.81 : 0;
    const z = acceleration.z ? acceleration.z / 9.81 : 0;
    const magnitude = Math.sqrt(x * x + y * y + z * z);

    const newData: AccelerometerData = {
      x: Math.max(-1, Math.min(1, x)),
      y: Math.max(-1, Math.min(1, y)),
      z: Math.max(-1, Math.min(1, z)),
      magnitude: Math.max(0, Math.min(2, magnitude)),
      timestamp: Date.now(),
    };

    // Apply smoothing
    const smoothing = state.smoothing;
    if (smoothingBufferRef.current) {
      const prev = smoothingBufferRef.current;
      smoothingBufferRef.current = {
        x: prev.x * smoothing + newData.x * (1 - smoothing),
        y: prev.y * smoothing + newData.y * (1 - smoothing),
        z: prev.z * smoothing + newData.z * (1 - smoothing),
        magnitude: prev.magnitude * smoothing + newData.magnitude * (1 - smoothing),
        timestamp: newData.timestamp,
      };
    } else {
      smoothingBufferRef.current = newData;
    }

    setState(prev => ({
      ...prev,
      lastData: newData,
      smoothedData: smoothingBufferRef.current,
    }));

    // Apply mappings
    if (state.enabled && smoothingBufferRef.current) {
      const data = smoothingBufferRef.current;
      state.mappings.forEach(mapping => {
        if (!mapping.enabled) return;

        let value: number;
        switch (mapping.axis) {
          case 'x':
            value = data.x;
            break;
          case 'y':
            value = data.y;
            break;
          case 'z':
            value = data.z;
            break;
          case 'magnitude':
            value = data.magnitude;
            break;
          default:
            return;
        }

        // Clamp to input range
        value = Math.max(mapping.minValue, Math.min(mapping.maxValue, value));
        
        // Normalize to 0-1
        const normalized = (value - mapping.minValue) / (mapping.maxValue - mapping.minValue);
        
        // Invert if needed
        const finalNormalized = mapping.invert ? 1 - normalized : normalized;
        
        // Map to output range
        const outputValue = Math.round(
          mapping.outputMin + (finalNormalized * (mapping.outputMax - mapping.outputMin))
        );

        // Apply to target
        if (mapping.targetType === 'dmx') {
          const channel = parseInt(mapping.targetId);
          if (!isNaN(channel) && channel >= 1 && channel <= 512) {
            setDmxChannel(channel - 1, outputValue);
          }
        } else if (mapping.targetType === 'fixture') {
          // Find fixture and update parameter
          const fixture = fixtures.find(f => f.id === mapping.targetId);
          if (fixture && mapping.targetParam) {
            // This would need fixture parameter update logic
            // For now, we'll update the relevant DMX channel
            const param = mapping.targetParam.toLowerCase();
            if (param === 'pan' || param === 'tilt' || param === 'dimmer') {
              const channelIndex = fixture.channels.findIndex(
                ch => ch.type.toLowerCase() === param
              );
              if (channelIndex >= 0) {
                const dmxChannel = fixture.startAddress - 1 + channelIndex;
                if (dmxChannel >= 0 && dmxChannel < 512) {
                  setDmxChannel(dmxChannel, outputValue);
                }
              }
            } else if (param === 'red' || param === 'green' || param === 'blue' || param === 'white') {
              const channelIndex = fixture.channels.findIndex(
                ch => ch.type.toLowerCase() === param
              );
              if (channelIndex >= 0) {
                const dmxChannel = fixture.startAddress - 1 + channelIndex;
                if (dmxChannel >= 0 && dmxChannel < 512) {
                  setDmxChannel(dmxChannel, outputValue);
                }
              }
            }
          }
        }
      });
    }
  }, [state.enabled, state.mappings, setDmxChannel, fixtures]);

  // Start/stop accelerometer
  useEffect(() => {
    if (!state.enabled || !state.permissionGranted) {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      return;
    }

    const handleMotion = (event: DeviceMotionEvent) => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      animationFrameRef.current = requestAnimationFrame(() => {
        processAccelerometerData(event);
      });
    };

    window.addEventListener('devicemotion', handleMotion);
    
    return () => {
      window.removeEventListener('devicemotion', handleMotion);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [state.enabled, state.permissionGranted, processAccelerometerData]);

  // Save to localStorage
  useEffect(() => {
    localStorage.setItem('accelerometerControl', JSON.stringify({
      smoothing: state.smoothing,
      mappings: state.mappings,
      permissionGranted: state.permissionGranted,
    }));
  }, [state.smoothing, state.mappings, state.permissionGranted]);

  const addMapping = () => {
    const newMapping: AccelerometerMapping = {
      id: `mapping-${Date.now()}`,
      axis: 'x',
      targetType: 'dmx',
      targetId: '1',
      outputMin: 0,
      outputMax: 255,
      minValue: -1,
      maxValue: 1,
      invert: false,
      enabled: true,
    };
    setState(prev => ({
      ...prev,
      mappings: [...prev.mappings, newMapping],
    }));
  };

  const updateMapping = (id: string, updates: Partial<AccelerometerMapping>) => {
    setState(prev => ({
      ...prev,
      mappings: prev.mappings.map(m => m.id === id ? { ...m, ...updates } : m),
    }));
  };

  const removeMapping = (id: string) => {
    setState(prev => ({
      ...prev,
      mappings: prev.mappings.filter(m => m.id !== id),
    }));
  };

  const toggleEnabled = () => {
    if (!state.permissionGranted) {
      requestPermission();
      return;
    }
    setState(prev => ({ ...prev, enabled: !prev.enabled }));
  };

  if (!isMobile && !isTouch) {
    return (
      <div className={styles.accelerometerControl}>
        <div className={styles.notMobileWarning}>
          <LucideIcon name="Smartphone" size={48} />
          <h3>Mobile Device Required</h3>
          <p>Accelerometer control is only available on mobile devices with motion sensors.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.accelerometerControl}>
      <div className={styles.header}>
        <div className={styles.titleSection}>
          <LucideIcon name="Smartphone" className={styles.icon} />
          <div>
            <h3>
              {theme === 'artsnob' 
                ? '📱 Contrôle Accéléromètre Expérimental'
                : '📱 Experimental Accelerometer Control'}
            </h3>
            <p className={styles.subtitle}>
              {theme === 'artsnob'
                ? 'Utilisez les capteurs de mouvement de votre téléphone pour contrôler DMX'
                : 'Use your phone\'s motion sensors to control DMX channels and fixtures'}
            </p>
          </div>
        </div>
      </div>

      {!state.isSupported && (
        <div className={styles.warning}>
          <LucideIcon name="AlertTriangle" />
          <span>Accelerometer is not supported on this device/browser</span>
        </div>
      )}

      <div className={styles.controls}>
        <div className={styles.controlGroup}>
          <div className={styles.toggleSection}>
            <label className={styles.toggleLabel}>
              <input
                type="checkbox"
                checked={state.enabled}
                onChange={toggleEnabled}
                disabled={!state.permissionGranted || !state.isSupported}
              />
              <span>Enable Accelerometer Control</span>
            </label>
            {state.permissionGranted === null && (
              <button onClick={requestPermission} className={styles.permissionButton}>
                <LucideIcon name="Shield" size={16} />
                Request Permission
              </button>
            )}
            {state.permissionGranted === false && (
              <div className={styles.permissionDenied}>
                <LucideIcon name="XCircle" size={16} />
                Permission Denied
              </div>
            )}
          </div>

          <div className={styles.smoothingControl}>
            <label>
              Smoothing: {Math.round(state.smoothing * 100)}%
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={state.smoothing}
                onChange={(e) => setState(prev => ({ ...prev, smoothing: parseFloat(e.target.value) }))}
              />
            </label>
            <small>Higher values = smoother, less responsive</small>
          </div>
        </div>

        {/* Live Data Display */}
        {state.smoothedData && (
          <div className={styles.dataDisplay}>
            <h4>Live Accelerometer Data</h4>
            <div className={styles.dataGrid}>
              <div className={styles.dataItem}>
                <span className={styles.dataLabel}>X:</span>
                <span className={styles.dataValue}>{state.smoothedData.x.toFixed(3)}</span>
              </div>
              <div className={styles.dataItem}>
                <span className={styles.dataLabel}>Y:</span>
                <span className={styles.dataValue}>{state.smoothedData.y.toFixed(3)}</span>
              </div>
              <div className={styles.dataItem}>
                <span className={styles.dataLabel}>Z:</span>
                <span className={styles.dataValue}>{state.smoothedData.z.toFixed(3)}</span>
              </div>
              <div className={styles.dataItem}>
                <span className={styles.dataLabel}>Magnitude:</span>
                <span className={styles.dataValue}>{state.smoothedData.magnitude.toFixed(3)}</span>
              </div>
            </div>
          </div>
        )}

        {/* Mappings */}
        <div className={styles.mappingsSection}>
          <div className={styles.mappingsHeader}>
            <h4>Mappings</h4>
            <button onClick={addMapping} className={styles.addButton}>
              <LucideIcon name="Plus" size={16} />
              Add Mapping
            </button>
          </div>

          {state.mappings.length === 0 ? (
            <div className={styles.noMappings}>
              <p>No mappings configured. Add a mapping to control DMX channels or fixtures.</p>
            </div>
          ) : (
            <div className={styles.mappingsList}>
              {state.mappings.map(mapping => (
                <MappingEditor
                  key={mapping.id}
                  mapping={mapping}
                  fixtures={fixtures}
                  onUpdate={(updates) => updateMapping(mapping.id, updates)}
                  onRemove={() => removeMapping(mapping.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

interface MappingEditorProps {
  mapping: AccelerometerMapping;
  fixtures: any[];
  onUpdate: (updates: Partial<AccelerometerMapping>) => void;
  onRemove: () => void;
}

const MappingEditor: React.FC<MappingEditorProps> = ({ mapping, fixtures, onUpdate, onRemove }) => {
  return (
    <div className={styles.mappingCard}>
      <div className={styles.mappingHeader}>
        <label className={styles.enableToggle}>
          <input
            type="checkbox"
            checked={mapping.enabled}
            onChange={(e) => onUpdate({ enabled: e.target.checked })}
          />
          <span>Enabled</span>
        </label>
        <button onClick={onRemove} className={styles.removeButton}>
          <LucideIcon name="Trash2" size={14} />
        </button>
      </div>

      <div className={styles.mappingContent}>
        <div className={styles.mappingRow}>
          <label>
            Axis:
            <select
              value={mapping.axis}
              onChange={(e) => onUpdate({ axis: e.target.value as any })}
            >
              <option value="x">X Axis</option>
              <option value="y">Y Axis</option>
              <option value="z">Z Axis</option>
              <option value="magnitude">Magnitude</option>
            </select>
          </label>

          <label>
            Target Type:
            <select
              value={mapping.targetType}
              onChange={(e) => onUpdate({ targetType: e.target.value as any })}
            >
              <option value="dmx">DMX Channel</option>
              <option value="fixture">Fixture</option>
            </select>
          </label>
        </div>

        {mapping.targetType === 'dmx' ? (
          <div className={styles.mappingRow}>
            <label>
              DMX Channel:
              <input
                type="number"
                min="1"
                max="512"
                value={mapping.targetId}
                onChange={(e) => onUpdate({ targetId: e.target.value })}
              />
            </label>
          </div>
        ) : (
          <div className={styles.mappingRow}>
            <label>
              Fixture:
              <select
                value={mapping.targetId}
                onChange={(e) => onUpdate({ targetId: e.target.value })}
              >
                <option value="">Select Fixture</option>
                {fixtures.map(f => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
            </label>
            {mapping.targetId && (
              <label>
                Parameter:
                <select
                  value={mapping.targetParam || ''}
                  onChange={(e) => onUpdate({ targetParam: e.target.value })}
                >
                  <option value="">Select Parameter</option>
                  <option value="pan">Pan</option>
                  <option value="tilt">Tilt</option>
                  <option value="dimmer">Dimmer</option>
                  <option value="red">Red</option>
                  <option value="green">Green</option>
                  <option value="blue">Blue</option>
                  <option value="white">White</option>
                </select>
              </label>
            )}
          </div>
        )}

        <div className={styles.mappingRow}>
          <label>
            Input Range Min:
            <input
              type="number"
              step="0.1"
              value={mapping.minValue}
              onChange={(e) => onUpdate({ minValue: parseFloat(e.target.value) })}
            />
          </label>
          <label>
            Input Range Max:
            <input
              type="number"
              step="0.1"
              value={mapping.maxValue}
              onChange={(e) => onUpdate({ maxValue: parseFloat(e.target.value) })}
            />
          </label>
        </div>

        <div className={styles.mappingRow}>
          <label>
            Output Range Min:
            <input
              type="number"
              min="0"
              max="255"
              value={mapping.outputMin}
              onChange={(e) => onUpdate({ outputMin: parseInt(e.target.value) })}
            />
          </label>
          <label>
            Output Range Max:
            <input
              type="number"
              min="0"
              max="255"
              value={mapping.outputMax}
              onChange={(e) => onUpdate({ outputMax: parseInt(e.target.value) })}
            />
          </label>
        </div>

        <div className={styles.mappingRow}>
          <label className={styles.invertToggle}>
            <input
              type="checkbox"
              checked={mapping.invert}
              onChange={(e) => onUpdate({ invert: e.target.checked })}
            />
            <span>Invert</span>
          </label>
        </div>
      </div>
    </div>
  );
};

export default AccelerometerControl;

