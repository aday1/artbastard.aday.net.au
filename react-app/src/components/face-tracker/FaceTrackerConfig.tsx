import React, { useState, useEffect } from 'react';
import { useTheme } from '../../context/ThemeContext';
import styles from './FaceTrackerConfig.module.scss';

interface FaceTrackerConfig {
  dmxApiUrl: string;
  panChannel: number;
  tiltChannel: number;
  irisChannel: number;
  zoomChannel: number;
  focusChannel: number;
  cameraIndex: number;
  updateRate: number;
  panSensitivity: number;
  tiltSensitivity: number;
  panOffset: number;
  tiltOffset: number;
  irisValue: number;
  zoomValue: number;
  focusValue: number;
  showPreview: boolean;
  show3DVisualization: boolean;
  smoothingFactor: number;
  maxVelocity: number;
  brightness: number;
  contrast: number;
  cameraExposure: number;
  cameraBrightness: number;
  autoExposure: boolean;
  useOSC: boolean;
  oscHost: string;
  oscPort: number;
  oscPanPath: string;
  oscTiltPath: string;
  oscIrisPath: string;
  oscZoomPath: string;
  oscFocusPath: string;
  panMin: number;
  panMax: number;
  tiltMin: number;
  tiltMax: number;
  irisMin: number;
  irisMax: number;
  zoomMin: number;
  zoomMax: number;
  focusMin: number;
  focusMax: number;
  panScale: number;
  tiltScale: number;
  panDeadZone: number;
  tiltDeadZone: number;
  panLimit: number;
  tiltLimit: number;
  panGear: number;
  tiltGear: number;
}

interface SliderFieldProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
}

const SliderField: React.FC<SliderFieldProps> = ({
  label,
  value,
  onChange,
  min = 0,
  max = 255,
  step = 1,
  disabled = false
}) => {
  // Ensure value is a valid number
  const safeValue = typeof value === 'number' && !isNaN(value) ? value : min;
  
  return (
    <div className={styles.configField}>
      <label className={styles.fieldLabel}>{label}</label>
      <div className={styles.sliderContainer}>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={safeValue}
          onChange={(e) => onChange(Number(e.target.value))}
          disabled={disabled}
          className={styles.slider}
        />
        <span className={styles.valueDisplay}>{safeValue.toFixed(step < 1 ? 2 : 0)}</span>
      </div>
    </div>
  );
};

export const FaceTrackerConfig: React.FC = () => {
  const { theme } = useTheme();
  const [config, setConfig] = useState<FaceTrackerConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lastSave, setLastSave] = useState<Date | null>(null);

  // Load config on mount
  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const response = await fetch('/api/face-tracker/config');
      if (!response.ok) throw new Error('Failed to load config');
      const data = await response.json();
      
      // Ensure all required fields have default values
      const defaultConfig: FaceTrackerConfig = {
        dmxApiUrl: "http://localhost:3030/api/dmx/batch",
        panChannel: 1,
        tiltChannel: 2,
        irisChannel: 0,
        zoomChannel: 0,
        focusChannel: 0,
        cameraIndex: 0,
        updateRate: 30,
        panSensitivity: 1.0,
        tiltSensitivity: 1.0,
        panOffset: 128,
        tiltOffset: 128,
        irisValue: 128,
        zoomValue: 128,
        focusValue: 128,
        showPreview: true,
        show3DVisualization: true,
        smoothingFactor: 0.85,
        maxVelocity: 5.0,
        brightness: 1.0,
        contrast: 1.0,
        cameraExposure: -1,
        cameraBrightness: -1,
        autoExposure: true,
        useOSC: false,
        oscHost: "127.0.0.1",
        oscPort: 9000,
        oscPanPath: "/dmx/pan",
        oscTiltPath: "/dmx/tilt",
        oscIrisPath: "/dmx/iris",
        oscZoomPath: "/dmx/zoom",
        oscFocusPath: "/dmx/focus",
        panMin: 0,
        panMax: 255,
        tiltMin: 0,
        tiltMax: 255,
        irisMin: 0,
        irisMax: 255,
        zoomMin: 0,
        zoomMax: 255,
        focusMin: 0,
        focusMax: 255,
        panScale: 1.0,
        tiltScale: 1.0,
        panDeadZone: 0.0,
        tiltDeadZone: 0.0,
        panLimit: 1.0,
        tiltLimit: 1.0,
        panGear: 1.0,
        tiltGear: 1.0,
      };
      
      // Merge loaded config with defaults to ensure all fields exist
      const mergedConfig = { ...defaultConfig, ...data };
      setConfig(mergedConfig);
      setLoading(false);
    } catch (error) {
      console.error('Error loading face tracker config:', error);
      setLoading(false);
    }
  };

  const saveConfig = async () => {
    if (!config) return;
    setSaving(true);
    try {
      const response = await fetch('/api/face-tracker/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });
      if (!response.ok) throw new Error('Failed to save config');
      setLastSave(new Date());
      setSaving(false);
    } catch (error) {
      console.error('Error saving face tracker config:', error);
      setSaving(false);
    }
  };

  const updateConfig = (field: keyof FaceTrackerConfig, value: any) => {
    if (!config) return;
    setConfig({ ...config, [field]: value });
  };

  if (loading) {
    return <div className={styles.faceTrackerConfig}>Loading configuration...</div>;
  }

  if (!config) {
    return <div className={styles.faceTrackerConfig}>Failed to load configuration</div>;
  }

  return (
    <div className={styles.faceTrackerConfig}>
      <h2 className={styles.title}>Face Tracker Configuration</h2>
      
      <div className={styles.saveSection}>
        <button onClick={saveConfig} disabled={saving} className={styles.saveButton}>
          {saving ? 'Saving...' : 'Save Configuration'}
        </button>
        {lastSave && (
          <span className={styles.saveStatus}>
            Saved at {lastSave.toLocaleTimeString()}
          </span>
        )}
      </div>

      <div className={styles.configSections}>
        {/* DMX Channels */}
        <section className={styles.configSection}>
          <h3 className={styles.sectionTitle}>DMX Channels</h3>
          <SliderField
            label="Pan Channel"
            value={config.panChannel}
            onChange={(v) => updateConfig('panChannel', Math.round(v))}
            min={0}
            max={512}
            step={1}
          />
          <SliderField
            label="Tilt Channel"
            value={config.tiltChannel}
            onChange={(v) => updateConfig('tiltChannel', Math.round(v))}
            min={0}
            max={512}
            step={1}
          />
          <SliderField
            label="Iris Channel"
            value={config.irisChannel}
            onChange={(v) => updateConfig('irisChannel', Math.round(v))}
            min={0}
            max={512}
            step={1}
          />
          <SliderField
            label="Zoom Channel"
            value={config.zoomChannel}
            onChange={(v) => updateConfig('zoomChannel', Math.round(v))}
            min={0}
            max={512}
            step={1}
          />
          <SliderField
            label="Focus Channel"
            value={config.focusChannel}
            onChange={(v) => updateConfig('focusChannel', Math.round(v))}
            min={0}
            max={512}
            step={1}
          />
        </section>

        {/* Range Limits */}
        <section className={styles.configSection}>
          <h3 className={styles.sectionTitle}>Range Limits</h3>
          <div className={styles.subsection}>
            <h4>Pan Range</h4>
            <SliderField
              label="Pan Min"
              value={config.panMin}
              onChange={(v) => updateConfig('panMin', Math.round(v))}
              min={0}
              max={255}
              step={1}
            />
            <SliderField
              label="Pan Max"
              value={config.panMax}
              onChange={(v) => updateConfig('panMax', Math.round(v))}
              min={0}
              max={255}
              step={1}
            />
          </div>
          <div className={styles.subsection}>
            <h4>Tilt Range</h4>
            <SliderField
              label="Tilt Min"
              value={config.tiltMin}
              onChange={(v) => updateConfig('tiltMin', Math.round(v))}
              min={0}
              max={255}
              step={1}
            />
            <SliderField
              label="Tilt Max"
              value={config.tiltMax}
              onChange={(v) => updateConfig('tiltMax', Math.round(v))}
              min={0}
              max={255}
              step={1}
            />
          </div>
          <div className={styles.subsection}>
            <h4>Iris/Zoom/Focus Range</h4>
            <SliderField
              label="Iris Min"
              value={config.irisMin}
              onChange={(v) => updateConfig('irisMin', Math.round(v))}
              min={0}
              max={255}
              step={1}
            />
            <SliderField
              label="Iris Max"
              value={config.irisMax}
              onChange={(v) => updateConfig('irisMax', Math.round(v))}
              min={0}
              max={255}
              step={1}
            />
            <SliderField
              label="Zoom Min"
              value={config.zoomMin}
              onChange={(v) => updateConfig('zoomMin', Math.round(v))}
              min={0}
              max={255}
              step={1}
            />
            <SliderField
              label="Zoom Max"
              value={config.zoomMax}
              onChange={(v) => updateConfig('zoomMax', Math.round(v))}
              min={0}
              max={255}
              step={1}
            />
            <SliderField
              label="Focus Min"
              value={config.focusMin}
              onChange={(v) => updateConfig('focusMin', Math.round(v))}
              min={0}
              max={255}
              step={1}
            />
            <SliderField
              label="Focus Max"
              value={config.focusMax}
              onChange={(v) => updateConfig('focusMax', Math.round(v))}
              min={0}
              max={255}
              step={1}
            />
          </div>
        </section>

        {/* Rigging Parameters */}
        <section className={styles.configSection}>
          <h3 className={styles.sectionTitle}>Rigging Parameters</h3>
          <div className={styles.subsection}>
            <h4>Pan Rigging</h4>
            <SliderField
              label="Pan Scale"
              value={config.panScale}
              onChange={(v) => updateConfig('panScale', v)}
              min={0}
              max={5}
              step={0.01}
            />
            <SliderField
              label="Pan Dead Zone"
              value={config.panDeadZone}
              onChange={(v) => updateConfig('panDeadZone', v)}
              min={0}
              max={1}
              step={0.01}
            />
            <SliderField
              label="Pan Limit"
              value={config.panLimit}
              onChange={(v) => updateConfig('panLimit', v)}
              min={0}
              max={2}
              step={0.01}
            />
            <SliderField
              label="Pan Gear"
              value={config.panGear}
              onChange={(v) => updateConfig('panGear', v)}
              min={0.1}
              max={10}
              step={0.1}
            />
          </div>
          <div className={styles.subsection}>
            <h4>Tilt Rigging</h4>
            <SliderField
              label="Tilt Scale"
              value={config.tiltScale}
              onChange={(v) => updateConfig('tiltScale', v)}
              min={0}
              max={5}
              step={0.01}
            />
            <SliderField
              label="Tilt Dead Zone"
              value={config.tiltDeadZone}
              onChange={(v) => updateConfig('tiltDeadZone', v)}
              min={0}
              max={1}
              step={0.01}
            />
            <SliderField
              label="Tilt Limit"
              value={config.tiltLimit}
              onChange={(v) => updateConfig('tiltLimit', v)}
              min={0}
              max={2}
              step={0.01}
            />
            <SliderField
              label="Tilt Gear"
              value={config.tiltGear}
              onChange={(v) => updateConfig('tiltGear', v)}
              min={0.1}
              max={10}
              step={0.1}
            />
          </div>
        </section>

        {/* Advanced Settings */}
        <section className={styles.configSection}>
          <h3 className={styles.sectionTitle}>Advanced Settings</h3>
          <SliderField
            label="Update Rate (Hz)"
            value={config.updateRate}
            onChange={(v) => updateConfig('updateRate', Math.round(v))}
            min={1}
            max={60}
            step={1}
          />
          <SliderField
            label="Pan Sensitivity"
            value={config.panSensitivity}
            onChange={(v) => updateConfig('panSensitivity', v)}
            min={0}
            max={5}
            step={0.01}
          />
          <SliderField
            label="Tilt Sensitivity"
            value={config.tiltSensitivity}
            onChange={(v) => updateConfig('tiltSensitivity', v)}
            min={0}
            max={5}
            step={0.01}
          />
          <SliderField
            label="Pan Offset"
            value={config.panOffset}
            onChange={(v) => updateConfig('panOffset', Math.round(v))}
            min={0}
            max={255}
            step={1}
          />
          <SliderField
            label="Tilt Offset"
            value={config.tiltOffset}
            onChange={(v) => updateConfig('tiltOffset', Math.round(v))}
            min={0}
            max={255}
            step={1}
          />
          <SliderField
            label="Smoothing Factor"
            value={config.smoothingFactor}
            onChange={(v) => updateConfig('smoothingFactor', v)}
            min={0}
            max={1}
            step={0.01}
          />
          <SliderField
            label="Max Velocity"
            value={config.maxVelocity}
            onChange={(v) => updateConfig('maxVelocity', v)}
            min={0}
            max={255}
            step={1}
          />
          <SliderField
            label="Camera Index"
            value={config.cameraIndex}
            onChange={(v) => updateConfig('cameraIndex', Math.round(v))}
            min={0}
            max={10}
            step={1}
          />
          <SliderField
            label="Brightness"
            value={config.brightness}
            onChange={(v) => updateConfig('brightness', v)}
            min={0}
            max={3}
            step={0.01}
          />
          <SliderField
            label="Contrast"
            value={config.contrast}
            onChange={(v) => updateConfig('contrast', v)}
            min={0}
            max={3}
            step={0.01}
          />
          <SliderField
            label="Iris Value"
            value={config.irisValue}
            onChange={(v) => updateConfig('irisValue', Math.round(v))}
            min={0}
            max={255}
            step={1}
          />
          <SliderField
            label="Zoom Value"
            value={config.zoomValue}
            onChange={(v) => updateConfig('zoomValue', Math.round(v))}
            min={0}
            max={255}
            step={1}
          />
          <SliderField
            label="Focus Value"
            value={config.focusValue}
            onChange={(v) => updateConfig('focusValue', Math.round(v))}
            min={0}
            max={255}
            step={1}
          />
        </section>

        {/* OSC Settings */}
        <section className={styles.configSection}>
          <h3 className={styles.sectionTitle}>OSC Settings</h3>
          <div className={styles.checkboxField}>
            <label>
              <input
                type="checkbox"
                checked={config.useOSC}
                onChange={(e) => updateConfig('useOSC', e.target.checked)}
              />
              Enable OSC
            </label>
          </div>
          <div className={styles.textField}>
            <label>OSC Host</label>
            <input
              type="text"
              value={config.oscHost}
              onChange={(e) => updateConfig('oscHost', e.target.value)}
              disabled={!config.useOSC}
            />
          </div>
          <SliderField
            label="OSC Port"
            value={config.oscPort}
            onChange={(v) => updateConfig('oscPort', Math.round(v))}
            min={1024}
            max={65535}
            step={1}
            disabled={!config.useOSC}
          />
          <div className={styles.textField}>
            <label>OSC Pan Path</label>
            <input
              type="text"
              value={config.oscPanPath}
              onChange={(e) => updateConfig('oscPanPath', e.target.value)}
              disabled={!config.useOSC}
            />
          </div>
          <div className={styles.textField}>
            <label>OSC Tilt Path</label>
            <input
              type="text"
              value={config.oscTiltPath}
              onChange={(e) => updateConfig('oscTiltPath', e.target.value)}
              disabled={!config.useOSC}
            />
          </div>
          <div className={styles.textField}>
            <label>OSC Iris Path</label>
            <input
              type="text"
              value={config.oscIrisPath}
              onChange={(e) => updateConfig('oscIrisPath', e.target.value)}
              disabled={!config.useOSC}
            />
          </div>
          <div className={styles.textField}>
            <label>OSC Zoom Path</label>
            <input
              type="text"
              value={config.oscZoomPath}
              onChange={(e) => updateConfig('oscZoomPath', e.target.value)}
              disabled={!config.useOSC}
            />
          </div>
          <div className={styles.textField}>
            <label>OSC Focus Path</label>
            <input
              type="text"
              value={config.oscFocusPath}
              onChange={(e) => updateConfig('oscFocusPath', e.target.value)}
              disabled={!config.useOSC}
            />
          </div>
        </section>

        {/* Display Settings */}
        <section className={styles.configSection}>
          <h3 className={styles.sectionTitle}>Display Settings</h3>
          <div className={styles.checkboxField}>
            <label>
              <input
                type="checkbox"
                checked={config.showPreview}
                onChange={(e) => updateConfig('showPreview', e.target.checked)}
              />
              Show Preview
            </label>
          </div>
          <div className={styles.checkboxField}>
            <label>
              <input
                type="checkbox"
                checked={config.show3DVisualization}
                onChange={(e) => updateConfig('show3DVisualization', e.target.checked)}
              />
              Show 3D Visualization
            </label>
          </div>
        </section>
      </div>
    </div>
  );
};

export default FaceTrackerConfig;

