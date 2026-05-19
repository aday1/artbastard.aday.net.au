import React, { useState } from 'react';
import { useStore } from '../../store';
import styles from './SuperControl.module.scss';

const SuperControlEnhanced: React.FC = () => {
  const { fixtures, selectedFixtures, setDmxChannelValue, getDmxChannelValue } = useStore();
  const [expandedFixture, setExpandedFixture] = useState<string | null>(null);

  // Get fixtures that are actually in use
  const fixturesInUse = fixtures.filter(f => selectedFixtures.includes(f.id));

  // Helper to get channel type label
  const getChannelTypeLabel = (type: string): string => {
    const typeMap: Record<string, string> = {
      dimmer: '💡 Dimmer/Intensity',
      red: '🔴 Red',
      green: '🟢 Green',
      blue: '🔵 Blue',
      white: '⚪ White',
      amber: '🟠 Amber',
      uv: '🟣 UV',
      pan: '↔️ Pan',
      pan_fine: '↔️ Pan Fine',
      tilt: '↕️ Tilt',
      tilt_fine: '↕️ Tilt Fine',
      shutter: '⏸️ Shutter',
      zoom: '🔍 Zoom',
      focus: '📍 Focus',
      color_wheel: '🌈 Color Wheel',
      gobo_wheel: '⭕ Gobo Wheel',
      gobo_rotation: '🔄 Gobo Rotation',
      prism: '💎 Prism',
      iris: '👁️ Iris',
      macro: '⚙️ Macro',
      reset: '↩️ Reset',
      speed: '⚡ Speed',
      sound: '🔊 Sound',
      strobe: '⚡ Strobe',
      effect: '✨ Effect',
      other: '❓ Other'
    };
    return typeMap[type] || type;
  };

  return (
    <div className={styles.superControlEnhanced}>
      <div className={styles.enhancedHeader}>
        <h2>DMX Control Panel</h2>
        <p className={styles.subtitle}>
          {fixturesInUse.length > 0
            ? `${fixturesInUse.length} fixture${fixturesInUse.length !== 1 ? 's' : ''} active`
            : 'No fixtures selected'}
        </p>
      </div>

      <div className={styles.fixturesList}>
        {fixturesInUse.length === 0 ? (
          <div className={styles.emptyState}>
            <p>Select fixtures in the Fixture Setup panel to control them here</p>
          </div>
        ) : (
          fixturesInUse.map(fixture => (
            <div key={fixture.id} className={styles.fixtureCard}>
              <div
                className={styles.fixtureHeader}
                onClick={() => setExpandedFixture(expandedFixture === fixture.id ? null : fixture.id)}
              >
                <div className={styles.fixtureTitle}>
                  <h3>{fixture.name}</h3>
                  <span className={styles.fixtureType}>{fixture.type}</span>
                  {fixture.manufacturer && (
                    <span className={styles.fixtureManufacturer}>{fixture.manufacturer}</span>
                  )}
                </div>
                <div className={styles.fixtureAddress}>
                  <span className={styles.label}>DMX:</span>
                  <span className={styles.range}>
                    {fixture.startAddress}-{fixture.startAddress + fixture.channels.length - 1}
                  </span>
                </div>
                <div className={styles.toggleIcon}>
                  {expandedFixture === fixture.id ? '▼' : '▶'}
                </div>
              </div>

              {expandedFixture === fixture.id && (
                <div className={styles.fixtureDetails}>
                  <div className={styles.channelGrid}>
                    {fixture.channels.map((channel, idx) => {
                      const dmxAddress = fixture.startAddress + idx;
                      const currentValue = getDmxChannelValue(dmxAddress - 1) || 0;

                      return (
                        <div key={idx} className={styles.channelControl}>
                          <div className={styles.channelHeader}>
                            <div className={styles.channelLabel}>
                              <strong className={styles.channelName}>{channel.name}</strong>
                              <span className={styles.channelType}>{getChannelTypeLabel(channel.type)}</span>
                            </div>
                            <span className={styles.dmxValue}>
                              DMX {dmxAddress}
                            </span>
                          </div>

                          <div className={styles.sliderRow}>
                            <input
                              type="range"
                              min="0"
                              max="255"
                              value={currentValue}
                              onChange={e => setDmxChannelValue(dmxAddress - 1, parseInt(e.target.value))}
                              className={styles.slider}
                            />
                            <div className={styles.valueDisplay}>
                              <input
                                type="number"
                                min="0"
                                max="255"
                                value={currentValue}
                                onChange={e => {
                                  const val = Math.max(0, Math.min(255, parseInt(e.target.value) || 0));
                                  setDmxChannelValue(dmxAddress - 1, val);
                                }}
                                className={styles.numberInput}
                              />
                              <span className={styles.percentage}>{Math.round((currentValue / 255) * 100)}%</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {fixture.mode && (
                    <div className={styles.modeInfo}>
                      <span className={styles.label}>Mode:</span>
                      <span>{fixture.mode}</span>
                    </div>
                  )}

                  {fixture.notes && (
                    <div className={styles.notesSection}>
                      <span className={styles.label}>Notes:</span>
                      <p>{fixture.notes}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default SuperControlEnhanced;
