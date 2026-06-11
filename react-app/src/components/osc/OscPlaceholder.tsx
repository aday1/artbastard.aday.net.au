import React, { useState } from 'react';
import { useStore } from '../../store';
import { useTheme } from '../../context/ThemeContext';
import { LucideIcon } from '../ui/LucideIcon';
import styles from './OscPlaceholder.module.scss';

export const OscPlaceholder: React.FC = () => {
  const { theme } = useTheme();
  const { fixtures, scenes, oscAssignments, superControlOscAddresses } = useStore(state => ({
    fixtures: state.fixtures,
    scenes: state.scenes,
    oscAssignments: state.oscAssignments,
    superControlOscAddresses: state.superControlOscAddresses
  }));

  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    dmx: true,
    scenes: true,
    master: true,
    supercontrol: true,
    tempo: true,
    custom: true
  });

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className={styles.oscPlaceholder}>
      <div className={styles.header}>
        <h2>
          {theme === 'artsnob' && '📡 OSC Placeholder: The Namespace Registry'}
          {theme === 'standard' && 'OSC Namespace Reference'}
          {theme === 'minimal' && 'OSC Namespaces'}
        </h2>
        <p className={styles.description}>
          Complete list of available OSC addresses and namespaces in ArtBastard.
          Use these addresses to control ArtBastard from external OSC applications.
        </p>
      </div>

      {/* Built-in OSC Namespaces */}
      <div className={styles.section}>
        <button 
          className={styles.sectionHeader}
          onClick={() => toggleSection('dmx')}
        >
          <LucideIcon name={expandedSections.dmx ? "ChevronDown" : "ChevronRight"} />
          <h3>DMX Channel Control</h3>
          <span className={styles.badge}>Built-in</span>
        </button>
        {expandedSections.dmx && (
          <div className={styles.sectionContent}>
            <div className={styles.namespaceGroup}>
              <h4>Direct Channel Control</h4>
              <div className={styles.addressList}>
                <div className={styles.addressItem}>
                  <code>/channel/{'{id}'}</code>
                  <span className={styles.description}>Control DMX channel 1-512 directly</span>
                  <button 
                    className={styles.copyButton}
                    onClick={() => copyToClipboard('/channel/1')}
                    title="Copy example"
                  >
                    <LucideIcon name="Copy" size={14} />
                  </button>
                </div>
                <div className={styles.example}>
                  <strong>Example:</strong> <code>/channel/1</code> <code>0.5</code> (sets channel 1 to 50%)
                  <br />
                  <strong>Value Range:</strong> 0.0-1.0 (normalized) or 0-255 (DMX range)
                </div>
              </div>
            </div>

            <div className={styles.namespaceGroup}>
              <h4>Custom DMX Channel Assignments</h4>
              <p className={styles.info}>
                Each DMX channel can have a custom OSC address assigned. 
                Default pattern: <code>/1/dmx1</code>, <code>/1/dmx2</code>, etc.
              </p>
              <div className={styles.addressList}>
                {oscAssignments.slice(0, 10).map((address, index) => (
                  address && (
                    <div key={index} className={styles.addressItem}>
                      <code>{address}</code>
                      <span className={styles.description}>DMX Channel {index + 1}</span>
                      <button 
                        className={styles.copyButton}
                        onClick={() => copyToClipboard(address)}
                        title="Copy address"
                      >
                        <LucideIcon name="Copy" size={14} />
                      </button>
                    </div>
                  )
                ))}
                {oscAssignments.filter(a => a).length > 10 && (
                  <div className={styles.moreInfo}>
                    + {oscAssignments.filter(a => a).length - 10} more custom assignments...
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Scene Control */}
      <div className={styles.section}>
        <button 
          className={styles.sectionHeader}
          onClick={() => toggleSection('scenes')}
        >
          <LucideIcon name={expandedSections.scenes ? "ChevronDown" : "ChevronRight"} />
          <h3>Scene Control</h3>
          <span className={styles.badge}>Built-in</span>
        </button>
        {expandedSections.scenes && (
          <div className={styles.sectionContent}>
            <div className={styles.namespaceGroup}>
              <h4>Scene Commands</h4>
              <div className={styles.addressList}>
                <div className={styles.addressItem}>
                  <code>/scene/load</code>
                  <span className={styles.description}>Load a scene by name</span>
                  <button 
                    className={styles.copyButton}
                    onClick={() => copyToClipboard('/scene/load SceneName')}
                    title="Copy example"
                  >
                    <LucideIcon name="Copy" size={14} />
                  </button>
                </div>
                <div className={styles.example}>
                  <strong>Example:</strong> <code>/scene/load</code> <code>"My Scene"</code>
                </div>

                <div className={styles.addressItem}>
                  <code>/scene/save</code>
                  <span className={styles.description}>Save current state as a scene</span>
                  <button 
                    className={styles.copyButton}
                    onClick={() => copyToClipboard('/scene/save SceneName')}
                    title="Copy example"
                  >
                    <LucideIcon name="Copy" size={14} />
                  </button>
                </div>
                <div className={styles.example}>
                  <strong>Example:</strong> <code>/scene/save</code> <code>"New Scene"</code>
                </div>
              </div>
            </div>

            <div className={styles.namespaceGroup}>
              <h4>Scene Triggers (Custom Addresses)</h4>
              <p className={styles.info}>
                Each scene can have a custom OSC address for direct triggering.
              </p>
              <div className={styles.addressList}>
                {scenes.slice(0, 10).map((scene, index) => (
                  <div key={index} className={styles.addressItem}>
                    <code>{scene.oscAddress || `/scene/${scene.name.toLowerCase().replace(/\s+/g, '_')}`}</code>
                    <span className={styles.description}>{scene.name}</span>
                    <button 
                      className={styles.copyButton}
                      onClick={() => copyToClipboard(scene.oscAddress || `/scene/${scene.name.toLowerCase().replace(/\s+/g, '_')}`)}
                      title="Copy address"
                    >
                      <LucideIcon name="Copy" size={14} />
                    </button>
                  </div>
                ))}
                {scenes.length > 10 && (
                  <div className={styles.moreInfo}>
                    + {scenes.length - 10} more scenes...
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Master Controls */}
      <div className={styles.section}>
        <button 
          className={styles.sectionHeader}
          onClick={() => toggleSection('master')}
        >
          <LucideIcon name={expandedSections.master ? "ChevronDown" : "ChevronRight"} />
          <h3>Master Controls</h3>
          <span className={styles.badge}>Built-in</span>
        </button>
        {expandedSections.master && (
          <div className={styles.sectionContent}>
            <div className={styles.namespaceGroup}>
              <h4>Master Sliders</h4>
              <div className={styles.addressList}>
                <div className={styles.addressItem}>
                  <code>/master/{'{id}'}</code>
                  <span className={styles.description}>Control master slider by ID</span>
                  <button 
                    className={styles.copyButton}
                    onClick={() => copyToClipboard('/master/1')}
                    title="Copy example"
                  >
                    <LucideIcon name="Copy" size={14} />
                  </button>
                </div>
                <div className={styles.example}>
                  <strong>Example:</strong> <code>/master/1</code> <code>0.75</code> (sets master 1 to 75%)
                  <br />
                  <strong>Value Range:</strong> 0.0-1.0 (normalized)
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* SuperControl */}
      <div className={styles.section}>
        <button 
          className={styles.sectionHeader}
          onClick={() => toggleSection('supercontrol')}
        >
          <LucideIcon name={expandedSections.supercontrol ? "ChevronDown" : "ChevronRight"} />
          <h3>SuperControl Parameters</h3>
          <span className={styles.badge}>Built-in</span>
        </button>
        {expandedSections.supercontrol && (
          <div className={styles.sectionContent}>
            <div className={styles.namespaceGroup}>
              <h4>Available SuperControl Addresses</h4>
              <div className={styles.addressList}>
                {Object.entries(superControlOscAddresses).map(([control, address]) => (
                  <div key={control} className={styles.addressItem}>
                    <code>{address}</code>
                    <span className={styles.description}>{control}</span>
                    <button 
                      className={styles.copyButton}
                      onClick={() => copyToClipboard(address)}
                      title="Copy address"
                    >
                      <LucideIcon name="Copy" size={14} />
                    </button>
                  </div>
                ))}
              </div>
              <div className={styles.example}>
                <strong>Value Range:</strong> 0.0-1.0 (normalized)
                <br />
                <strong>Example:</strong> <code>/supercontrol/dimmer</code> <code>0.5</code>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Tempo Control */}
      <div className={styles.section}>
        <button 
          className={styles.sectionHeader}
          onClick={() => toggleSection('tempo')}
        >
          <LucideIcon name={expandedSections.tempo ? "ChevronDown" : "ChevronRight"} />
          <h3>Tempo Control</h3>
          <span className={styles.badge}>Built-in</span>
        </button>
        {expandedSections.tempo && (
          <div className={styles.sectionContent}>
            <div className={styles.namespaceGroup}>
              <h4>Tempo Commands</h4>
              <div className={styles.addressList}>
                <div className={styles.addressItem}>
                  <code>/tempo/playpause</code>
                  <span className={styles.description}>Toggle play/pause</span>
                  <button 
                    className={styles.copyButton}
                    onClick={() => copyToClipboard('/tempo/playpause')}
                    title="Copy address"
                  >
                    <LucideIcon name="Copy" size={14} />
                  </button>
                </div>
                <div className={styles.addressItem}>
                  <code>/tempo/play</code>
                  <span className={styles.description}>Start playback</span>
                  <button 
                    className={styles.copyButton}
                    onClick={() => copyToClipboard('/tempo/play')}
                    title="Copy address"
                  >
                    <LucideIcon name="Copy" size={14} />
                  </button>
                </div>
                <div className={styles.addressItem}>
                  <code>/tempo/stop</code>
                  <span className={styles.description}>Stop playback</span>
                  <button 
                    className={styles.copyButton}
                    onClick={() => copyToClipboard('/tempo/stop')}
                    title="Copy address"
                  >
                    <LucideIcon name="Copy" size={14} />
                  </button>
                </div>
                <div className={styles.addressItem}>
                  <code>/tempo/toggle</code>
                  <span className={styles.description}>Toggle playback state</span>
                  <button 
                    className={styles.copyButton}
                    onClick={() => copyToClipboard('/tempo/toggle')}
                    title="Copy address"
                  >
                    <LucideIcon name="Copy" size={14} />
                  </button>
                </div>
                <div className={styles.addressItem}>
                  <code>/tempo/tap</code>
                  <span className={styles.description}>Tap tempo</span>
                  <button 
                    className={styles.copyButton}
                    onClick={() => copyToClipboard('/tempo/tap')}
                    title="Copy address"
                  >
                    <LucideIcon name="Copy" size={14} />
                  </button>
                </div>
              </div>
              <div className={styles.example}>
                <strong>Note:</strong> These commands trigger on any value &gt; 0.5
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className={styles.section}>
        <button 
          className={styles.sectionHeader}
          onClick={() => toggleSection('custom')}
        >
          <LucideIcon name={expandedSections.custom ? "ChevronDown" : "ChevronRight"} />
          <h3>Quick Actions & Custom</h3>
          <span className={styles.badge}>Built-in</span>
        </button>
        {expandedSections.custom && (
          <div className={styles.sectionContent}>
            <div className={styles.namespaceGroup}>
              <h4>Quick Scene Save</h4>
              <div className={styles.addressList}>
                <div className={styles.addressItem}>
                  <code>/artbastard/quick/save</code>
                  <span className={styles.description}>Quick save current state as scene</span>
                  <button 
                    className={styles.copyButton}
                    onClick={() => copyToClipboard('/artbastard/quick/save')}
                    title="Copy address"
                  >
                    <LucideIcon name="Copy" size={14} />
                  </button>
                </div>
                <div className={styles.addressItem}>
                  <code>/quick/save</code>
                  <span className={styles.description}>Alternative quick save address</span>
                  <button 
                    className={styles.copyButton}
                    onClick={() => copyToClipboard('/quick/save')}
                    title="Copy address"
                  >
                    <LucideIcon name="Copy" size={14} />
                  </button>
                </div>
                <div className={styles.example}>
                  <strong>Note:</strong> Creates a scene with timestamp name (e.g., "Quick_12-34-56")
                </div>
              </div>
            </div>

            <div className={styles.namespaceGroup}>
              <h4>ACT Triggers</h4>
              <p className={styles.info}>
                ACTs can have custom OSC trigger addresses configured per trigger.
                Check your ACT configuration for specific addresses.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Usage Notes */}
      <div className={styles.usageNotes}>
        <h3>📝 Usage Notes</h3>
        <ul>
          <li><strong>Value Normalization:</strong> Values can be sent as 0.0-1.0 (normalized) or 0-255 (DMX range). ArtBastard automatically normalizes values &gt; 1.0.</li>
          <li><strong>Button Triggers:</strong> Scene and ACT triggers activate when value &gt; 0.5</li>
          <li><strong>Default Port:</strong> OSC receive port is configurable (default: 8000)</li>
          <li><strong>Custom Assignments:</strong> DMX channels and scenes can have custom OSC addresses assigned in their respective setup pages</li>
          <li><strong>Network:</strong> Ensure your OSC client is on the same network as ArtBastard</li>
        </ul>
      </div>
    </div>
  );
};

