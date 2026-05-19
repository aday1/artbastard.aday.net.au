import React, { useState } from 'react';
import { useStore } from '../../store/store';
import { AutopilotConfig } from '../../store/store';
import CustomPathEditor from '../automation/CustomPathEditor';
import { ArtbastardXYPad, HorizontalFader, RangeWindowControl } from '../ui/controls';
import styles from './AutopilotControls.module.scss';

export const AutopilotControls: React.FC = () => {
  const {
    channelAutopilots,
    panTiltAutopilot,
    colorSliderAutopilot,
    bpm,
    setChannelAutopilot,
    removeChannelAutopilot,
    setPanTiltAutopilot,
    togglePanTiltAutopilot,
    setColorSliderAutopilot,
    toggleColorSliderAutopilot,
    fixtures
  } = useStore();

  const [selectedChannel, setSelectedChannel] = useState<number>(0);
  const [showCustomPathEditor, setShowCustomPathEditor] = useState(false);
  const [channelAutopilotConfig, setChannelAutopilotConfig] = useState<AutopilotConfig>({
    enabled: false,
    type: 'sine',
    speed: 1.0,
    range: { min: 0, max: 255 },
    syncToBPM: false,
    phase: 0
  });

  const handleChannelAutopilotApply = () => {
    setChannelAutopilot(selectedChannel, { ...channelAutopilotConfig, enabled: true });
  };

  const handleChannelAutopilotRemove = () => {
    removeChannelAutopilot(selectedChannel);
  };

  const isPanTiltAvailable = fixtures.some(fixture => 
    fixture.channels.some(ch => ch.type === 'pan' || ch.type === 'tilt')
  );

  const activeChannelAutopilots = Object.keys(channelAutopilots).length;

  return (
    <>
      <div className={styles.autopilotControls}>
      <div className={styles.header}>
        <h3>🤖 Autopilot System</h3>
        <div className={styles.stats}>
          <span className={styles.stat}>
            {activeChannelAutopilots} Channel{activeChannelAutopilots !== 1 ? 's' : ''}
          </span>
          {panTiltAutopilot.enabled && (
            <span className={styles.stat}>Pan/Tilt Active</span>
          )}
          {bpm > 0 && (
            <span className={styles.bpm}>♪ {bpm} BPM</span>
          )}
        </div>
      </div>

      {/* Channel Autopilot Section */}
      <div className={styles.section}>
        <h4>Channel Autopilot</h4>
        
        <div className={styles.channelSelector}>
          <label>Channel:</label>
          <select 
            value={selectedChannel} 
            onChange={(e) => setSelectedChannel(parseInt(e.target.value))}
          >
            {Array.from({ length: 512 }, (_, i) => (
              <option key={i} value={i}>
                CH {i + 1} {channelAutopilots[i] ? '(Active)' : ''}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.configGrid}>
          <div className={styles.configRow}>
            <label>Pattern:</label>
            <select 
              value={channelAutopilotConfig.type}
              onChange={(e) => setChannelAutopilotConfig(prev => ({ 
                ...prev, 
                type: e.target.value as AutopilotConfig['type']
              }))}
            >
              <option value="sine">Sine Wave</option>
              <option value="ping-pong">Ping Pong</option>
              <option value="cycle">Cycle</option>
              <option value="triangle">Triangle</option>
              <option value="sawtooth">Sawtooth</option>
              <option value="random">Random</option>
            </select>
          </div>

          <div className={styles.configRow}>
            <label>Speed:</label>
            <HorizontalFader
              min={0.1}
              max={10}
              step={0.1}
              value={channelAutopilotConfig.speed}
              onChange={(v) => setChannelAutopilotConfig((prev) => ({ ...prev, speed: v }))}
            />
            <span>{channelAutopilotConfig.speed.toFixed(1)}x</span>
          </div>

          <div className={styles.configRow}>
            <label>Range:</label>
            <RangeWindowControl
              min={0}
              max={255}
              minValue={channelAutopilotConfig.range.min}
              maxValue={channelAutopilotConfig.range.max}
              onChange={(minV, maxV) =>
                setChannelAutopilotConfig((prev) => ({
                  ...prev,
                  range: { min: minV, max: maxV },
                }))
              }
            />
          </div>

          <div className={styles.configRow}>
            <label>
              <input 
                type="checkbox"
                checked={channelAutopilotConfig.syncToBPM}
                onChange={(e) => setChannelAutopilotConfig(prev => ({ 
                  ...prev, 
                  syncToBPM: e.target.checked
                }))}
              />
              Sync to BPM
            </label>
          </div>
        </div>

        <div className={styles.buttonRow}>
          <button 
            className={styles.applyButton}
            onClick={handleChannelAutopilotApply}
          >
            Apply to CH {selectedChannel + 1}
          </button>
          {channelAutopilots[selectedChannel] && (
            <button 
              className={styles.removeButton}
              onClick={handleChannelAutopilotRemove}
            >
              Remove
            </button>
          )}
        </div>
      </div>

      {/* Pan/Tilt Autopilot Section */}
      {isPanTiltAvailable && (
        <div className={styles.section}>
          <h4>Pan/Tilt Autopilot</h4>
          
          <div className={styles.configGrid}>
            <div className={styles.configRow}>
              <label>
                <input 
                  type="checkbox"
                  checked={panTiltAutopilot.enabled}
                  onChange={togglePanTiltAutopilot}
                />
                Enable Pan/Tilt Autopilot
              </label>
            </div>

            {panTiltAutopilot.enabled && (
              <>
                <div className={styles.configRow}>
                  <label>Pattern:</label>
                  <select 
                    value={panTiltAutopilot.pathType}
                    onChange={(e) => setPanTiltAutopilot({ 
                      pathType: e.target.value as any
                    })}
                  >
                    <option value="circle">Circle</option>
                    <option value="figure8">Figure 8</option>
                    <option value="square">Square</option>
                    <option value="triangle">Triangle</option>
                    <option value="linear">Linear</option>
                    <option value="custom">Custom Path</option>
                  </select>
                </div>

                {panTiltAutopilot.pathType === 'custom' && (
                  <div className={styles.configRow}>
                    <button 
                      className={styles.customPathButton}
                      onClick={() => setShowCustomPathEditor(true)}
                    >
                      {panTiltAutopilot.customPath && panTiltAutopilot.customPath.length > 0
                        ? `Edit Path (${panTiltAutopilot.customPath.length} points)`
                        : 'Create Custom Path'
                      }
                    </button>
                  </div>
                )}

                <div className={styles.configRow}>
                  <label>Speed:</label>
                  <HorizontalFader
                    min={0.1}
                    max={5}
                    step={0.1}
                    value={panTiltAutopilot.speed}
                    onChange={(v) => setPanTiltAutopilot({ speed: v })}
                  />
                  <span>{panTiltAutopilot.speed.toFixed(1)}x</span>
                </div>

                <div className={styles.configRow}>
                  <label>Size:</label>
                  <HorizontalFader
                    min={10}
                    max={100}
                    step={5}
                    value={panTiltAutopilot.size}
                    onChange={(v) => setPanTiltAutopilot({ size: Math.round(v) })}
                  />
                  <span>{panTiltAutopilot.size}%</span>
                </div>

                <div className={styles.configRow}>
                  <label>Pan / tilt center</label>
                  <ArtbastardXYPad
                    pan={panTiltAutopilot.centerX}
                    tilt={panTiltAutopilot.centerY}
                    size={220}
                    onPanTiltChange={(centerX, centerY) =>
                      setPanTiltAutopilot({ centerX, centerY })
                    }
                  />
                </div>

                <div className={styles.configRow}>
                  <label>
                    <input 
                      type="checkbox"
                      checked={panTiltAutopilot.syncToBPM}
                      onChange={(e) => setPanTiltAutopilot({ 
                        syncToBPM: e.target.checked
                      })}
                    />
                    Sync to BPM
                  </label>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Color Autopilot Section */}
      <div className={styles.section}>
        <h4>Color Autopilot</h4>
        
        <div className={styles.configGrid}>
          <div className={styles.configRow}>
            <label>
              <input 
                type="checkbox"
                checked={colorSliderAutopilot.enabled}
                onChange={toggleColorSliderAutopilot}
              />
              Enable Color Autopilot
            </label>
          </div>

          {colorSliderAutopilot.enabled && (
            <>
              <div className={styles.configRow}>
                <label>Pattern:</label>
                <select 
                  value={colorSliderAutopilot.type}
                  onChange={(e) => setColorSliderAutopilot({ 
                    type: e.target.value as 'ping-pong' | 'cycle' | 'random' | 'sine' | 'triangle' | 'sawtooth'
                  })}
                >
                  <option value="sine">Rainbow Sine</option>
                  <option value="cycle">Rainbow Cycle</option>
                  <option value="triangle">Triangle Wave</option>
                  <option value="sawtooth">Sawtooth Ramp</option>
                  <option value="ping-pong">Ping Pong</option>
                  <option value="random">Random Colors</option>
                </select>
              </div>

              <div className={styles.configRow}>
                <label>Speed:</label>
                <HorizontalFader
                  min={0.1}
                  max={1}
                  step={0.1}
                  value={colorSliderAutopilot.speed}
                  onChange={(v) => setColorSliderAutopilot({ speed: v })}
                />
                <span>{colorSliderAutopilot.speed.toFixed(1)}x</span>
              </div>

              <div className={styles.configRow}>
                <label>Hue range</label>
                <RangeWindowControl
                  min={0}
                  max={360}
                  minValue={colorSliderAutopilot.range.min}
                  maxValue={colorSliderAutopilot.range.max}
                  onChange={(minV, maxV) =>
                    setColorSliderAutopilot({
                      range: { min: minV, max: maxV },
                    })
                  }
                />
                <span style={{ display: 'none' }}>{colorSliderAutopilot.range.min}</span>
              </div>

              <div className={styles.configRow}>
                <label>
                  <input 
                    type="checkbox"
                    checked={colorSliderAutopilot.syncToBPM}
                    onChange={(e) => setColorSliderAutopilot({ 
                      syncToBPM: e.target.checked
                    })}
                  />
                  Sync to BPM
                </label>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Active Autopilots List */}
      {(activeChannelAutopilots > 0 || panTiltAutopilot.enabled || colorSliderAutopilot.enabled) && (
        <div className={styles.section}>
          <h4>Active Autopilots</h4>
          <div className={styles.activeList}>
            {Object.entries(channelAutopilots).map(([channel, config]) => (
              <div key={channel} className={styles.activeItem}>
                <span>CH {parseInt(channel) + 1}</span>
                <span>{config.type}</span>
                <span>{config.speed.toFixed(1)}x</span>
                {config.syncToBPM && <span>♪</span>}
                <button 
                  className={styles.removeSmall}
                  onClick={() => removeChannelAutopilot(parseInt(channel))}
                >
                  ×
                </button>
              </div>
            ))}
            {panTiltAutopilot.enabled && (
              <div className={styles.activeItem}>
                <span>Pan/Tilt</span>
                <span>{panTiltAutopilot.pathType}</span>
                <span>{panTiltAutopilot.speed.toFixed(1)}x</span>
                {panTiltAutopilot.syncToBPM && <span>♪</span>}
                <button 
                  className={styles.removeSmall}
                  onClick={togglePanTiltAutopilot}
                >
                  ×
                </button>
              </div>
            )}
            {colorSliderAutopilot.enabled && (
              <div className={styles.activeItem}>
                <span>Color</span>
                <span>{colorSliderAutopilot.type}</span>
                <span>{colorSliderAutopilot.speed.toFixed(1)}x</span>
                {colorSliderAutopilot.syncToBPM && <span>♪</span>}
                <button 
                  className={styles.removeSmall}
                  onClick={toggleColorSliderAutopilot}
                >
                  ×
                </button>
              </div>
            )}
          </div>
        </div>
      )}
      </div>
      
      <CustomPathEditor
        isOpen={showCustomPathEditor}
        onClose={() => setShowCustomPathEditor(false)}
        mode="autopilot"
        initialPoints={panTiltAutopilot.customPath || []}
      />
    </>
  );
};
