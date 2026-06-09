import React, { useState, useEffect, useRef } from 'react';
import styles from './HelpOverlay.module.scss';
import { MidiMonitor } from '../midi/MidiMonitor';
import { OscMonitor } from '../osc/OscMonitor';
import { DipSwitchSimulator } from './DipSwitchSimulator';
import { PdfAddressSheet } from './PdfAddressSheet';

type HelpTab =
  | 'overview'
  | 'dmx-basics'
  | 'dip-simulator'
  | 'midi-setup'
  | 'controller-templates'
  | 'apc40-live'
  | 'osc-integration'
  | 'scene-management'
  | 'timeline'
  | 'act-timeline'
  | 'clip-launcher'
  | 'acts-triggers'
  | 'mobile'
  | 'factory-reset'
  | 'shortcuts'
  | 'address-sheet'
  | 'troubleshooting'
  | 'lan-bridge'
  | 'video-tour';

interface HelpOverlayProps {
  embedded?: boolean; // When true, renders without floating button (for settings page)
}

export const HelpOverlay: React.FC<HelpOverlayProps> = ({ embedded = false }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [activeTab, setActiveTab] = useState<HelpTab>('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Keyboard shortcuts (only when not embedded)
  useEffect(() => {
    if (embedded) return; // Skip keyboard shortcuts when embedded
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey) {
        switch (e.key) {
          case 'h':
          case 'H':
            e.preventDefault();
            setIsVisible(!isVisible);
            break;
          case '/':
            e.preventDefault();
            if (isVisible && searchInputRef.current) {
              searchInputRef.current.focus();
            }
            break;
          case 'Escape':
            if (isVisible) {
              e.preventDefault();
              setIsVisible(false);
            }
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isVisible, embedded]);

  // Listen for openHelpOverlay events
  useEffect(() => {
    const handleOpenHelpOverlay = (e: CustomEvent) => {
      if (e.detail?.tab) {
        setActiveTab(e.detail.tab as HelpTab);
        setIsVisible(true);
      }
    };

    window.addEventListener('openHelpOverlay', handleOpenHelpOverlay as EventListener);
    return () => window.removeEventListener('openHelpOverlay', handleOpenHelpOverlay as EventListener);
  }, []);

  // Search functionality
  const filteredContent = (content: string) => {
    if (!searchQuery) return content;
    return content.toLowerCase().includes(searchQuery.toLowerCase());
  };

  const tabs: Array<{id: HelpTab, label: string, icon: string}> = [
    { id: 'overview', label: 'Getting Started', icon: '🚀' },
    { id: 'dmx-basics', label: 'DMX Control', icon: '💡' },
    { id: 'address-sheet', label: 'Address Sheet', icon: '📋' },
    { id: 'dip-simulator', label: 'DIP Simulator', icon: '🔧' },
    { id: 'midi-setup', label: 'MIDI Setup', icon: '🎹' },
    { id: 'controller-templates', label: 'Controller Templates', icon: '🎚️' },
    { id: 'apc40-live', label: 'APC40 Live', icon: '🎛️' },
    { id: 'osc-integration', label: 'OSC Control', icon: '📡' },
    { id: 'scene-management', label: 'Scene Management', icon: '🎬' },
    { id: 'timeline', label: 'Scene Timeline', icon: '🎞️' },
    { id: 'act-timeline', label: 'Act Timeline', icon: '🎬' },
    { id: 'clip-launcher', label: 'Clip Launcher', icon: '🟧' },
    { id: 'acts-triggers', label: 'ACT Triggers', icon: '▶️' },
    { id: 'mobile', label: 'Touch Surface', icon: '📱' },
    { id: 'factory-reset', label: 'Factory Reset', icon: '♻️' },
    { id: 'shortcuts', label: 'Shortcuts', icon: '⌨️' },
    { id: 'lan-bridge', label: 'LAN / Pi Bridge', icon: '🔌' },
    { id: 'troubleshooting', label: 'Troubleshooting', icon: '🛟' },
    { id: 'video-tour', label: 'Video Tour', icon: '🎥' },
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return (
          <div className={styles.tabContent}>
            <h4>🚀 Welcome to ArtBastard DMX512</h4>
            <p>ArtBastard is a powerful, web-based DMX lighting control system that lets you control professional lighting equipment through various protocols.</p>
            
            <div className={styles.section}>
              <h5>🎯 Quick Start Guide</h5>
              <ol className={styles.stepList}>
                <li><strong>Launch System:</strong> Run <code>.\start.ps1</code> for instant startup</li>
                <li><strong>Connect Hardware:</strong> Connect your DMX interface to your lighting fixtures</li>
                <li><strong>Configure Fixtures:</strong> Go to Fixture Setup to define your lighting fixtures</li>
                <li><strong>Create Scenes:</strong> Set up lighting scenes and save them for later use</li>
                <li><strong>Setup Control:</strong> Configure MIDI controllers or OSC devices for hands-free control</li>
                <li><strong>Perform:</strong> Use the interface to control your lights in real-time</li>
              </ol>
            </div>

            <div className={styles.section}>
              <h5>🔧 System Requirements</h5>
              <ul>
                <li>Node.js 20+ (for backend server)</li>
                <li>Modern web browser (Chrome, Firefox, Safari, Edge)</li>
                <li>USB DMX interface or Art-Net compatible device</li>
                <li>DMX512 lighting fixtures</li>
                <li>Optional: MIDI controller or OSC-capable device</li>
                <li>Cloud + home LAN: Raspberry Pi running <code>artbastard-bridge</code> (see Help tab LAN / Pi Bridge)</li>
              </ul>
            </div>

            <div className={styles.section}>
              <h5>📚 Libraries & Web Technologies</h5>
              <p>ArtBastard is built using modern web technologies and libraries:</p>
              
              <h6>Backend Technologies</h6>
              <ul>
                <li><strong>Node.js</strong> - Runtime environment</li>
                <li><strong>TypeScript</strong> - Type-safe JavaScript</li>
                <li><strong>Express.js</strong> - HTTP server framework</li>
                <li><strong>Socket.io</strong> - Real-time WebSocket communication</li>
                <li><strong>dmxnet</strong> - Art-Net protocol implementation</li>
                <li><strong>osc</strong> - OSC protocol support</li>
                <li><strong>easymidi / @julusian/midi</strong> - MIDI device communication</li>
              </ul>

              <h6>Frontend Technologies</h6>
              <ul>
                <li><strong>React 18+</strong> - UI framework</li>
                <li><strong>TypeScript</strong> - Type-safe JavaScript</li>
                <li><strong>Vite</strong> - Build tool and dev server</li>
                <li><strong>Zustand</strong> - State management</li>
                <li><strong>React Router</strong> - Client-side routing</li>
                <li><strong>SCSS/Sass</strong> - CSS preprocessing with modules</li>
                <li><strong>Konva / react-konva</strong> - 2D canvas graphics</li>
                <li><strong>Three.js / @react-three/fiber</strong> - 3D graphics</li>
                <li><strong>react-grid-layout</strong> - Drag-and-drop layouts</li>
                <li><strong>react-beautiful-dnd</strong> - Drag and drop</li>
                <li><strong>lucide-react</strong> - Icon library</li>
                <li><strong>@fortawesome/react-fontawesome</strong> - Font Awesome icons</li>
                <li><strong>framer-motion</strong> - Animation library</li>
                <li><strong>react-toastify</strong> - Toast notifications</li>
                <li><strong>axios</strong> - HTTP client</li>
              </ul>

              <h6>Development Tools</h6>
              <ul>
                <li><strong>Vitest</strong> - Testing framework</li>
                <li><strong>React Testing Library</strong> - Component testing</li>
                <li><strong>Nodemon</strong> - Development auto-reload</li>
                <li><strong>TypeScript</strong> - Type checking and compilation</li>
              </ul>
            </div>

            <div className={styles.section}>
              <h5>🗺️ Routes</h5>
              <p>Hash-based deep links - bookmark any of these:</p>
              <ul>
                <li><code>#/</code> - DMX Control home</li>
                <li><code>#/fixture</code> - Fixture Setup + Advanced Fixture Control (SuperControl)</li>
                <li><code>#/scenes-acts</code> - Scenes and scene timelines</li>
                <li><code>#/acts</code> - Act timeline builder and ACT triggers</li>
                <li><code>#/mobile</code> - Touch-first phone and tablet surface</li>
                <li><code>#/settings</code> - Settings + embedded Help</li>
              </ul>
            </div>

            <div className={styles.section}>
              <h5>📊 Interface Overview</h5>
              <p>The DMX Control page is split into modular panels you can rearrange:</p>
              <ul>
                <li><strong>Header + Master Fader:</strong> global state, blackout, brightness</li>
                <li><strong>Filters &amp; Fixture Selector:</strong> narrow the channel grid</li>
                <li><strong>Channels Viewport:</strong> grid or list of channel cards</li>
                <li><strong>Pinned Channels:</strong> always-on summary of active channels</li>
                <li><strong>Scene Controls:</strong> save and recall lighting scenes</li>
                <li><strong>SuperControl:</strong> advanced fixture control with MIDI/OSC</li>
                <li><strong>MIDI / OSC traffic:</strong> floating panels for incoming controller messages (not the external operator desk)</li>
              </ul>
              <p>Press <kbd>Ctrl</kbd>+<kbd>H</kbd> from any page to open this help overlay. Scene timeline, act timeline, ACT triggers, controller templates, factory reset, touch surface, and the demo video tour each have their own tab.</p>
            </div>
          </div>
        );

      case 'dmx-basics':
        return (
          <div className={styles.tabContent}>
            <h4>💡 DMX512 Control Basics</h4>
            <p>DMX512 is the industry standard protocol for controlling stage lighting and effects.</p>
            
            <div className={styles.section}>
              <h5>🔌 Hardware Setup</h5>
              <ol className={styles.stepList}>
                <li><strong>Connect Interface:</strong> Connect your USB DMX interface to your computer</li>
                <li><strong>Chain Fixtures:</strong> Connect fixtures using DMX cables (XLR 3-pin or 5-pin)</li>
                <li><strong>Set Addresses:</strong> Configure unique DMX addresses for each fixture</li>
                <li><strong>Terminate Chain:</strong> Add a 120-ohm terminator to the last fixture</li>
              </ol>
            </div>

            <div className={styles.section}>
              <h5>📝 Fixture Configuration</h5>
              <ul>
                <li><strong>DMX Address:</strong> Set starting channel for each fixture (1-512)</li>
                <li><strong>Channel Mode:</strong> Choose the number of channels your fixture uses</li>
                <li><strong>Fixture Profile:</strong> Define what each channel controls (brightness, color, etc.)</li>
                <li><strong>Personality:</strong> Some fixtures have multiple modes - choose the right one</li>
              </ul>
            </div>

            <div className={styles.section}>
              <h5>🎛️ Control Methods</h5>
              <ul>
                <li><strong>Direct Channel Control:</strong> Set individual DMX channel values (0-255)</li>
                <li><strong>Fixture Control:</strong> Use fixture-specific controls (brightness, color, etc.)</li>
                <li><strong>Scene Control:</strong> Save and recall preset lighting looks</li>
                <li><strong>Real-time Control:</strong> Use MIDI or OSC for live performance</li>
                <li><strong>Fader layout:</strong> On the DMX page header (or Settings), switch between Horizontal Sliders and Vertical Sliders. The choice applies to the channel grid, pinned channels, and the left sidebar.</li>
              </ul>
            </div>

            <div className={styles.section}>
              <h5>⚠️ Common Issues</h5>
              <ul>
                <li><strong>No Output:</strong> Check DMX interface connection and drivers</li>
                <li><strong>Flickering:</strong> Check for loose connections or missing terminator</li>
                <li><strong>Wrong Colors:</strong> Verify fixture addressing and channel mapping</li>
                <li><strong>Partial Control:</strong> Check fixture mode matches your configuration</li>
                <li><strong>Startup Issues:</strong> Use <code>.\start.ps1 -Clear</code> for clean rebuild</li>
              </ul>
            </div>
          </div>        );

      case 'dip-simulator':
        return (
          <div className={styles.tabContent}>
            <h4>🔧 DMX DIP Switch Calculator</h4>
            <p>Calculate which DIP switches to set ON for your DMX512 fixtures. Enter your desired DMX address and see the binary representation!</p>
            
            <DipSwitchSimulator />
          </div>
        );

      case 'midi-setup':
        return (
          <div className={styles.tabContent}>
            <h4>🎹 MIDI Controller Setup</h4>
            <p>Control your lighting using MIDI controllers, keyboards, and control surfaces.</p>
            
            <div className={styles.section}>
              <h5>🔗 Connection Setup</h5>
              <ol className={styles.stepList}>
                <li><strong>Connect MIDI Device:</strong> USB or traditional MIDI cables</li>
                <li><strong>Enable Web MIDI:</strong> Grant browser permission for MIDI access</li>
                <li><strong>Select Device:</strong> Choose your controller from the MIDI settings</li>
                <li><strong>Test Connection:</strong> Verify MIDI messages are being received</li>
              </ol>
            </div>

            <div className={styles.section}>
              <h5>🎛️ Control Mapping</h5>
              <ul>
                <li><strong>Channel Faders:</strong> Map controller faders to DMX channels</li>
                <li><strong>Scene Triggers:</strong> Assign pads/keys to trigger lighting scenes</li>
                <li><strong>Master Controls:</strong> Map rotary knobs to master brightness and effects</li>
              </ul>
            </div>

            <div className={styles.section}>
              <h5>📊 MIDI Message Types</h5>
              <ul>
                <li><strong>Control Change (CC):</strong> Continuous controls like faders and knobs</li>
                <li><strong>Note On/Off:</strong> Trigger events from keys and pads</li>
                <li><strong>Program Change:</strong> Switch between different scene banks</li>
                <li><strong>Aftertouch:</strong> Pressure-sensitive control for dynamic effects</li>
              </ul>
            </div>            <div className={styles.section}>
              <h5>🔧 Popular Controllers</h5>
              <ul>
                <li><strong>Akai APC series:</strong> Grid-based controllers perfect for scene triggering. APC40 MK1 has a one-click template - see the Controller Templates tab.</li>
                <li><strong>Novation Launchpad:</strong> RGB feedback and extensive grid control.</li>
                <li><strong>Behringer X-Touch:</strong> Professional mixing console with motorized faders. Mackie-mode template ships with scribble-strip SysEx labels.</li>
                <li><strong>Korg nanoKONTROL:</strong> Compact USB controller with faders and knobs.</li>
              </ul>
            </div>

            <div className={styles.section}>
              <h5>🎚️ Controller Templates &amp; Pitch-bend</h5>
              <p>One-click templates for Behringer X-Touch (Mackie) and Akai APC40 MK1. Pitch-bend mappings are wired by default for the X-Touch master fader and per-channel faders.</p>
              <p>Apply via <em>Settings → MIDI → Apply Template</em> or via REST:</p>
              <pre><code>{`POST /api/midi/controller-template
{ "template": "xtouch" }   // or "apc40"`}</code></pre>
              <p>See the Controller Templates tab for the full mapping reference.</p>
            </div>

            <div className={styles.section}>
              <h5>📊 Live MIDI Monitor</h5>
              <p>Use the MIDI Monitor below to test your controller and see incoming messages in real-time:</p>
              <div className={styles.monitorContainer}>
                <MidiMonitor />
              </div>
              <p><em>The monitor shows the last 5 MIDI messages with details about message type, channel, and values.</em></p>
            </div>
          </div>
        );

      case 'osc-integration':
        return (
          <div className={styles.tabContent}>
            <h4>📡 OSC (Open Sound Control) Integration</h4>
            <p>Control ArtBastard remotely using OSC messages from other applications or devices.</p>
            
            <div className={styles.section}>
              <h5>🌐 Network Setup</h5>
              <ol className={styles.stepList}>
                <li><strong>Configure Port:</strong> Set OSC receive port (default: 8080)</li>
                <li><strong>Network Access:</strong> Ensure firewall allows OSC traffic</li>
                <li><strong>IP Address:</strong> Note your computer's IP for remote control</li>
                <li><strong>Test Connection:</strong> Send test messages to verify setup</li>
              </ol>
            </div>            <div className={styles.section}>
              <h5>📬 OSC Address Patterns</h5>
              <ul>
                <li><strong>/dmx/channel/[1-512]</strong> - Control individual DMX channels</li>
                <li><strong>/scene/trigger/[name]</strong> - Trigger saved scenes by name</li>
                <li><strong>/master/brightness</strong> - Control master brightness (0.0-1.0)</li>
                <li><strong>/fixture/[id]/brightness</strong> - Control fixture brightness</li>
                <li><strong>/fixture/[id]/color/[r,g,b]</strong> - Set RGB color values</li>
              </ul>
            </div>

            <div className={styles.section}>
              <h5>🎛️ SuperControl OSC Addresses</h5>
              <p>Complete reference for all SuperControl interface controls:</p>
              
              <div className={styles.oscAddressGrid}>
                <div className={styles.oscCategory}>
                  <h6>Basic Controls</h6>
                  <ul className={styles.oscAddressList}>
                    <li><code>/supercontrol/dimmer</code> - Dimmer (0-255)</li>
                    <li><code>/supercontrol/pan</code> - Pan (0-255)</li>
                    <li><code>/supercontrol/tilt</code> - Tilt (0-255)</li>
                  </ul>
                </div>
                
                <div className={styles.oscCategory}>
                  <h6>Color Controls</h6>
                  <ul className={styles.oscAddressList}>
                    <li><code>/supercontrol/red</code> - Red (0-255)</li>
                    <li><code>/supercontrol/green</code> - Green (0-255)</li>
                    <li><code>/supercontrol/blue</code> - Blue (0-255)</li>
                    <li><code>/supercontrol/color/wheel</code> - Color Wheel (0.0-1.0)</li>
                  </ul>
                </div>
                
                <div className={styles.oscCategory}>
                  <h6>Effects Controls</h6>
                  <ul className={styles.oscAddressList}>
                    <li><code>/supercontrol/gobo</code> - Gobo (0-255)</li>
                    <li><code>/supercontrol/shutter</code> - Shutter (0-255)</li>
                    <li><code>/supercontrol/strobe</code> - Strobe (0-255)</li>
                    <li><code>/supercontrol/lamp</code> - Lamp (0-255)</li>
                    <li><code>/supercontrol/reset</code> - Reset Function (0-255)</li>
                  </ul>
                </div>
                
                <div className={styles.oscCategory}>
                  <h6>Advanced Controls</h6>
                  <ul className={styles.oscAddressList}>
                    <li><code>/supercontrol/pantilt/xy</code> - Pan/Tilt XY Pad (x,y: 0.0-1.0)</li>
                    <li><code>/supercontrol/autopilot/enable</code> - Autopilot Enable (0/1)</li>
                    <li><code>/supercontrol/autopilot/speed</code> - Autopilot Speed (0.0-1.0)</li>
                  </ul>
                </div>
                
                <div className={styles.oscCategory}>
                  <h6>Scene Controls</h6>
                  <ul className={styles.oscAddressList}>
                    <li><code>/supercontrol/scene/next</code> - Next Scene (trigger)</li>
                    <li><code>/supercontrol/scene/prev</code> - Previous Scene (trigger)</li>
                    <li><code>/supercontrol/scene/save</code> - Save Current Scene (trigger)</li>
                  </ul>
                </div>
              </div>
              
              <div className={styles.oscUsageNotes}>
                <h6>📝 Usage Notes:</h6>
                <ul>
                  <li>Most controls accept values 0-255 (8-bit DMX standard)</li>
                  <li>XY Pad and normalized controls use 0.0-1.0 range</li>
                  <li>Trigger controls respond to any positive value</li>
                  <li>Addresses are customizable in SuperControl OSC input fields</li>
                  <li>Use the OSC Monitor (debug tools) to watch live incoming traffic</li>
                </ul>
              </div>
            </div>

            <div className={styles.section}>
              <h5>🔧 Compatible Software</h5>
              <ul>
                <li><strong>OSC:</strong> Control ArtBastard via Open Sound Control protocol</li>
                <li><strong>Max/MSP:</strong> Advanced programming and algorithmic control</li>
                <li><strong>Pure Data:</strong> Open-source visual programming for lighting</li>
                <li><strong>Reaper:</strong> DAW with built-in OSC support for music-synchronized lighting</li>
                <li><strong>QLab:</strong> Show control software with OSC output capabilities</li>
              </ul>
            </div>            <div className={styles.section}>
              <h5>💡 Example Use Cases</h5>
              <ul>
                <li><strong>Mobile Control:</strong> Use tablet as wireless lighting console</li>
                <li><strong>Music Sync:</strong> Sync lighting with audio software</li>
                <li><strong>Automated Shows:</strong> Program sequences with timing</li>
                <li><strong>Multi-User Control:</strong> Multiple operators with different interfaces</li>
              </ul>
            </div>            <div className={styles.section}>
              <h5>📡 Live OSC Monitor</h5>
              <p>Use the OSC Monitor below to test your setup and see incoming messages in real-time:</p>
              <div className={styles.monitorContainer}>
                <OscMonitor />
              </div>
              <p><em>The monitor displays incoming OSC messages with address patterns, arguments, and timestamps.</em></p>
            </div>
          </div>
        );

      case 'scene-management':
        return (
          <div className={styles.tabContent}>
            <h4>🎬 Scene Management</h4>
            <p>Create, save, and organize lighting scenes for quick recall during performances.</p>
            
            <div className={styles.section}>
              <h5>💾 Creating Scenes</h5>
              <ol className={styles.stepList}>
                <li><strong>Set Lighting:</strong> Adjust fixtures to desired look</li>
                <li><strong>Name Scene:</strong> Give it a descriptive name</li>
                <li><strong>Add OSC Address:</strong> Optional OSC trigger address</li>
                <li><strong>Save Scene:</strong> Store the current lighting state</li>
              </ol>
            </div>

            <div className={styles.section}>
              <h5>🎭 Scene Organization</h5>
              <ul>
                <li><strong>Naming Convention:</strong> Use clear, descriptive names (e.g., "Verse_Blue", "Chorus_Bright")</li>
                <li><strong>Categories:</strong> Group scenes by song, color, or intensity</li>
                <li><strong>Numbering:</strong> Use numbers for easy MIDI/OSC triggering</li>
                <li><strong>Backup:</strong> Export scene lists for backup and sharing</li>
              </ul>
            </div>

            <div className={styles.section}>
              <h5>⚡ Quick Save Options</h5>
              <ul>
                <li><strong>Keyboard Shortcuts:</strong> Rapid scene saving with hotkeys</li>
                <li><strong>Auto-naming:</strong> Timestamp-based naming for rapid workflow</li>
                <li><strong>Overwrite Protection:</strong> Prevent accidental scene overwrites</li>
              </ul>
            </div>

            <div className={styles.section}>
              <h5>🔄 Scene Recall</h5>
              <ul>
                <li><strong>Manual Trigger:</strong> Click scene buttons in the interface</li>
                <li><strong>MIDI Trigger:</strong> Assign MIDI notes or CCs to scenes</li>
                <li><strong>OSC Trigger:</strong> Remote triggering via OSC messages</li>
                <li><strong>Fade Times:</strong> Set transition speeds between scenes</li>
              </ul>
            </div>

            <div className={styles.section}>
              <h5>📂 Import/Export</h5>
              <ul>
                <li><strong>Scene Export:</strong> Save scenes to file for backup</li>
                <li><strong>Scene Import:</strong> Load scenes from other projects</li>
                <li><strong>Sharing:</strong> Share scene configurations with other users</li>
                <li><strong>Version Control:</strong> Track changes to scene configurations</li>
              </ul>
            </div>
          </div>
        );

      case 'shortcuts':
        return (
          <div className={styles.tabContent}>
            <h4>⌨️ Keyboard Shortcuts</h4>
            <p>Speed up your workflow with these keyboard shortcuts.</p>
            
            <div className={styles.section}>
              <h5>🔧 General Controls</h5>
              <div className={styles.shortcutList}>
                <div className={styles.shortcut}>
                  <kbd>Ctrl</kbd> + <kbd>H</kbd>
                  <span>Toggle Help Overlay</span>
                </div>
                <div className={styles.shortcut}>
                  <kbd>Ctrl</kbd> + <kbd>/</kbd>
                  <span>Focus Search in Help</span>
                </div>
                <div className={styles.shortcut}>
                  <kbd>Esc</kbd>
                  <span>Close Help/Cancel Action</span>
                </div>
                <div className={styles.shortcut}>
                  <kbd>Space</kbd>
                  <span>Emergency Blackout (or Timeline Play/Pause in timeline editor)</span>
                </div>
                <div className={styles.shortcut}>
                  <kbd>B</kbd>
                  <span>Toggle Blackout</span>
                </div>
                <div className={styles.shortcut}>
                  <kbd>?</kbd>
                  <span>Show Keyboard Shortcuts Modal</span>
                </div>
              </div>
            </div>

            <div className={styles.section}>
              <h5>🧭 Navigation</h5>
              <div className={styles.shortcutList}>
                <div className={styles.shortcut}>
                  <kbd>1</kbd>
                  <span>Go to DMX Control</span>
                </div>
                <div className={styles.shortcut}>
                  <kbd>2</kbd>
                  <span>Go to Scenes &amp; Acts</span>
                </div>
                <div className={styles.shortcut}>
                  <kbd>3</kbd>
                  <span>Go to Fixture Setup</span>
                </div>
                <div className={styles.shortcut}>
                  <kbd>4</kbd>
                  <span>Go to MIDI / OSC</span>
                </div>
                <div className={styles.shortcut}>
                  <kbd>Tab</kbd>
                  <span>Cycle Through Panels</span>
                </div>
                <div className={styles.shortcut}>
                  <kbd>Ctrl</kbd> + <kbd>F</kbd>
                  <span>Find / Filter Fixtures</span>
                </div>
                <div className={styles.shortcut}>
                  <kbd>F11</kbd>
                  <span>Toggle Fullscreen</span>
                </div>
              </div>
            </div>

            <div className={styles.section}>
              <h5>🤖 Automation</h5>
              <div className={styles.shortcutList}>
                <div className={styles.shortcut}>
                  <kbd>A</kbd>
                  <span>Toggle Automation</span>
                </div>
                <div className={styles.shortcut}>
                  <kbd>P</kbd>
                  <span>Toggle Autopilot</span>
                </div>
                <div className={styles.shortcut}>
                  <kbd>K</kbd>
                  <span>Add Keyframe at Playhead (Timeline)</span>
                </div>
              </div>
            </div>

            <div className={styles.section}>
              <h5>🎭 Scene Controls</h5>
              <div className={styles.shortcutList}>
                <div className={styles.shortcut}>
                  <kbd>Ctrl</kbd> + <kbd>S</kbd>
                  <span>Quick Save Scene</span>
                </div>
                <div className={styles.shortcut}>
                  <kbd>1</kbd> - <kbd>9</kbd>
                  <span>Trigger Scene 1-9</span>
                </div>
                <div className={styles.shortcut}>
                  <kbd>Ctrl</kbd> + <kbd>1-9</kbd>
                  <span>Save to Scene Slot 1-9</span>
                </div>
                <div className={styles.shortcut}>
                  <kbd>Shift</kbd> + <kbd>1-9</kbd>
                  <span>Delete Scene 1-9</span>
                </div>
              </div>
            </div>

            <div className={styles.section}>
              <h5>🎛️ Fader Controls</h5>
              <div className={styles.shortcutList}>
                <div className={styles.shortcut}>
                  <kbd>M</kbd>
                  <span>Toggle Master Fader</span>
                </div>
                <div className={styles.shortcut}>
                  <kbd>↑</kbd> / <kbd>↓</kbd>
                  <span>Adjust Selected Fader</span>
                </div>
                <div className={styles.shortcut}>
                  <kbd>Shift</kbd> + <kbd>↑/↓</kbd>
                  <span>Fine Adjust Selected Fader</span>
                </div>
                <div className={styles.shortcut}>
                  <kbd>0</kbd>
                  <span>Zero All Faders</span>
                </div>
              </div>
            </div>

            

            <div className={styles.section}>
              <h5>🎬 Timeline Controls</h5>
              <div className={styles.shortcutList}>
                <div className={styles.shortcut}>
                  <kbd>Space</kbd>
                  <span>Play/Pause Timeline</span>
                </div>
                <div className={styles.shortcut}>
                  <kbd>Home</kbd>
                  <span>Jump to Start</span>
                </div>
                <div className={styles.shortcut}>
                  <kbd>End</kbd>
                  <span>Jump to End</span>
                </div>
                <div className={styles.shortcut}>
                  <kbd>Shift</kbd> + <kbd>←</kbd> / <kbd>→</kbd>
                  <span>Nudge Playhead/Keyframes</span>
                </div>
                <div className={styles.shortcut}>
                  <kbd>Ctrl</kbd> + <kbd>C</kbd>
                  <span>Copy Selected Keyframes</span>
                </div>
                <div className={styles.shortcut}>
                  <kbd>Ctrl</kbd> + <kbd>V</kbd>
                  <span>Paste Keyframes</span>
                </div>
                <div className={styles.shortcut}>
                  <kbd>Delete</kbd>
                  <span>Delete Selected Keyframes</span>
                </div>
                <div className={styles.shortcut}>
                  <kbd>Ctrl</kbd> + <kbd>Z</kbd>
                  <span>Undo Timeline Change</span>
                </div>
                <div className={styles.shortcut}>
                  <kbd>Ctrl</kbd> + <kbd>Y</kbd>
                  <span>Redo Timeline Change</span>
                </div>
                <div className={styles.shortcut}>
                  <kbd>Ctrl</kbd> + <kbd>A</kbd>
                  <span>Select All Keyframes</span>
                </div>
                <div className={styles.shortcut}>
                  <kbd>?</kbd>
                  <span>Show Keyboard Shortcuts Help</span>
                </div>
              </div>
            </div>

          </div>
        );

      case 'timeline':
        return (
          <div className={styles.tabContent}>
            <h4>🎬 Scene Timeline Editor</h4>
            <p>Per-scene DMX animation: DAW-style keyframes on channel tracks. For sequencing whole scenes in a show, use the <strong>Act Timeline</strong> help tab.</p>
            
            <div className={styles.section}>
              <h5>🎯 Keyframe Animation</h5>
              <p>Keyframes now display actual DMX values (0-255) and percentages instead of meaningless labels. Each keyframe shows:</p>
              <ul>
                <li><strong>DMX Value:</strong> The actual channel value (0-255)</li>
                <li><strong>Percentage:</strong> Visual percentage representation</li>
                <li><strong>Channel Info:</strong> Fixture name and channel name in tooltips</li>
                <li><strong>Easing Type:</strong> Interpolation method (linear, ease-in, ease-out, smooth, step)</li>
              </ul>
            </div>

            <div className={styles.section}>
              <h5>📊 Timeline Components</h5>
              <ul>
                <li><strong>Timeline Ruler:</strong> Time markers with scrubbing support. Click or drag to jump/scrub through your timeline.</li>
                <li><strong>Playhead:</strong> Visual indicator showing current playback position.</li>
                <li><strong>Grid:</strong> Background grid for alignment. Enable/disable snapping to grid.</li>
                <li><strong>Drag Preview:</strong> Real-time feedback showing exact time position while dragging keyframes.</li>
                <li><strong>Curve Visualization:</strong> Smooth interpolation curves between keyframes.</li>
              </ul>
            </div>

            <div className={styles.section}>
              <h5>⌨️ Keyboard Shortcuts</h5>
              <p>Professional DAW-style shortcuts for efficient editing:</p>
              <ul>
                <li><strong>Space:</strong> Play/Pause timeline</li>
                <li><strong>Home/End:</strong> Jump to start/end of timeline</li>
                <li><strong>Shift+Arrow:</strong> Nudge playhead or selected keyframes</li>
                <li><strong>Ctrl+C/V:</strong> Copy/Paste keyframes</li>
                <li><strong>Delete:</strong> Delete selected keyframes</li>
                <li><strong>Ctrl+Z/Y:</strong> Undo/Redo timeline changes</li>
                <li><strong>Ctrl+A:</strong> Select all keyframes</li>
                <li><strong>?:</strong> Show keyboard shortcuts help</li>
              </ul>
            </div>

            <div className={styles.section}>
              <h5>🎨 Multi-Track View</h5>
              <p>View multiple channels simultaneously in a multi-track timeline. Each channel gets its own track with:</p>
              <ul>
                <li>Individual keyframes and curves</li>
                <li>Mute/Solo controls per track</li>
                <li>Track height adjustment</li>
                <li>Collapsible tracks for better organization</li>
              </ul>
            </div>
          </div>
        );

      case 'act-timeline':
        return (
          <div className={styles.tabContent}>
            <h4>Act Timeline</h4>
            <p>
              Sequence scenes in a show: clips, gaps, and scheduled MIDI/OSC events.
              For per-scene DMX keyframes, see the Scene Timeline tab.
            </p>

            <div className={styles.section}>
              <h5>Editing</h5>
              <ul>
                <li><strong>Drag clips</strong> horizontally to set start time (not list order).</li>
                <li><strong>Resize</strong> the right edge to change clip duration.</li>
                <li><strong>Playhead:</strong> click the ruler or drag the red line to seek.</li>
                <li><strong>Add step</strong> inserts a clip at the playhead.</li>
                <li><strong>Scene tray</strong> adds saved scenes directly to the end of the act.</li>
                <li><strong>Basic / Advanced</strong> keeps normal act building separate from MIDI/OSC/audio tools.</li>
                <li><strong>+2s gap</strong> (clip selected) shifts that clip and later clips.</li>
                <li><strong>Extend +5s</strong> adds empty timeline past the last clip.</li>
                <li>Playback <strong>waits through gaps</strong> before the next scene loads.</li>
              </ul>
            </div>

            <div className={styles.section}>
              <h5>Transport vs clock</h5>
              <ul>
                <li>
                  <strong>ACT triggers</strong> (MIDI/OSC): play, pause, stop, next, prev, toggle —
                  how you start an act from hardware or QLab.
                </li>
                <li>
                  <strong>Sync to BPM</strong> on the act: bar length from app BPM; does not start
                  Ableton Live.
                </li>
                <li>
                  <strong>Ableton Link</strong> (Settings + Pi bridge): shared tempo only, not Live
                  transport.
                </li>
                <li>
                  <strong>MIDI/OSC lanes</strong>: fire at absolute ms during playback (scheduled cues).
                </li>
              </ul>
            </div>

            <div className={styles.section}>
              <h5>Recommendations</h5>
              <ul>
                <li>Build scene looks first; use acts to order scenes.</li>
                <li>Map spare pads to ACT triggers for the current show act.</li>
                <li>Use OSC timeline events to start Live on a beat if needed.</li>
                <li>Leave 1–3 s gaps between clips for fades.</li>
              </ul>
            </div>
          </div>
        );

      case 'clip-launcher':
        return (
          <div className={styles.tabContent}>
            <h4>🎹 Clip Launcher</h4>
            <p>Session-style scene management for live performance. Inspired by Ableton Live's Session View, the clip launcher transforms scene management into a powerful live performance instrument.</p>
            
            <div className={styles.section}>
              <h5>🎯 Grid-Based Interface</h5>
              <p>The clip launcher uses a customizable grid (rows × columns) to organize your scenes:</p>
              <ul>
                <li><strong>Default Grid:</strong> 4×4 grid (customizable)</li>
                <li><strong>Clip Cells:</strong> Each cell can hold a scene</li>
                <li><strong>Visual Feedback:</strong> Clear indicators for playing, queued, and recording states</li>
                <li><strong>Empty Cells:</strong> Dashed border indicates empty cells ready for scene assignment</li>
              </ul>
            </div>

            <div className={styles.section}>
              <h5>🚀 Launch Controls</h5>
              <ul>
                <li><strong>Click:</strong> Launch scene (or assign scene if empty)</li>
                <li><strong>Double-Click:</strong> Edit clip properties</li>
                <li><strong>Play Button:</strong> Start scene playback</li>
                <li><strong>Stop Button:</strong> Stop scene playback</li>
                <li><strong>Loop Toggle:</strong> Enable/disable scene looping</li>
                <li><strong>Stop All:</strong> Stop all playing clips</li>
              </ul>
            </div>

            <div className={styles.section}>
              <h5>🎨 Visual States</h5>
              <ul>
                <li><strong>Playing:</strong> Highlighted with play indicator</li>
                <li><strong>Queued:</strong> Different color indicating queued state</li>
                <li><strong>Recording:</strong> Pulsing red indicator</li>
                <li><strong>Empty:</strong> Dashed border with "Add Scene" prompt</li>
              </ul>
            </div>

            <div className={styles.section}>
              <h5>🔄 Scene Integration</h5>
              <p>The clip launcher seamlessly integrates with ArtBastard's scene system:</p>
              <ul>
                <li>Any scene can be assigned to a clip cell</li>
                <li>Scenes with timelines will play their timelines when launched</li>
                <li>Multiple clips can play simultaneously for layered effects</li>
                <li>Scene changes are instantly reflected in the clip launcher</li>
              </ul>
            </div>
          </div>
        );

      case 'controller-templates':
        return (
          <div className={styles.tabContent}>
            <h4>🎚️ MIDI Controller Templates</h4>
            <p>Apply factory-tuned MIDI mappings in one click. Two templates ship with the current build.</p>

            <div className={styles.section}>
              <h5>Behringer X-Touch (Mackie mode)</h5>
              <ul>
                <li><strong>Faders 1-8:</strong> pitch-bend channels 1-8 → SuperControl dimmer per group, plus DMX channels 1-8.</li>
                <li><strong>Master fader:</strong> pitch-bend channel 9 → master brightness.</li>
                <li><strong>V-Pots 1-8:</strong> CC 16-23 → SuperControl pan/tilt/RGB axes.</li>
                <li><strong>Transport:</strong> ACT triggers (play / stop / next / prev / pause toggle).</li>
                <li><strong>Scribble strips:</strong> SysEx labels are pushed showing the DMX channel name.</li>
                <li><strong>Jog wheel:</strong> scrubs the timeline playhead.</li>
              </ul>
            </div>

            <div className={styles.section}>
              <h5>Akai APC40 MK1</h5>
              <p><strong>The APC40 has a dedicated live integration that runs without applying any template — see the <em>APC40 Live</em> tab.</strong> Plug the device in and you get Deck A/B scene grids, ACT launch buttons, Record Arm scene saves, Super Control dimmers, Device Control gobo/effects roles, group auto, Solo/Cue, FULL ON, and crossfader scene blending. The template entries below remain as fallback SuperControl bindings.</p>
              <ul>
                <li><strong>Track faders 1-8:</strong> SuperControl dimmer for selected fixture slots 1-8.</li>
                <li><strong>Master fader:</strong> SuperControl masterDimmer for the current selection.</li>
                <li><strong>Device Control CC16-23:</strong> fallback roles for gobo, gobo rotation, color wheel, prism, iris, focus, zoom, and strobe/shutter.</li>
                <li><strong>Cue Level:</strong> reserved for Device Control role-bank paging in live mode.</li>
                <li><strong>Crossfader:</strong> reserved for Deck A/B scene blending in live mode.</li>
              </ul>
            </div>

            <div className={styles.section}>
              <h5>Apply a template</h5>
              <p>UI: <em>Settings → MIDI → Apply Template</em>. Or via REST:</p>
              <pre><code>{`POST /api/midi/controller-template
Content-Type: application/json
{ "template": "xtouch" }   // or "apc40"`}</code></pre>
              <p>The endpoint is idempotent. User MIDI Learn entries on other controls are not touched. To clear everything, run a factory reset and re-apply.</p>
            </div>

            <div className={styles.section}>
              <h5>Pitch-bend</h5>
              <p>Pitch-bend mappings are supported in both directions. The X-Touch template wires master and per-channel faders to pitch-bend by default. APC40 live mode uses CC messages for its deck, fader, Device Control, Cue Level, and crossfader workflow.</p>
            </div>
          </div>
        );

      case 'apc40-live':
        return (
          <div className={styles.tabContent}>
            <h4>🎛️ APC40 MK1 Live Integration</h4>
            <p>The APC40 MK1 binds to ArtBastard automatically — no template apply required. Clip Launch / Session View is Deck A, hold SHIFT for Deck B, Scene Launch fires ACTS, Record Arm saves scene slots, Device Control follows selected fixture roles, and the crossfader blends active Deck A/B scenes. Full button-by-button reference: <code>DOCS/APC40_CHEATSHEET.md</code>.</p>

            <div className={styles.section}>
              <h5>At a glance</h5>
              <table>
                <thead>
                  <tr><th>Button</th><th>Function</th><th>LED</th></tr>
                </thead>
                <tbody>
                  <tr><td><strong>Clip Grid 8x5</strong></td><td>Launch 40 Deck A scene slots</td><td>green = saved, orange-blink = active</td></tr>
                  <tr><td><strong>SHIFT + Grid</strong></td><td>Launch/save 40 Deck B scene slots</td><td>SHIFT orange while held</td></tr>
                  <tr><td><strong>Record Arm 1-8</strong></td><td>Arm column; next grid pad saves current deck slot</td><td>red on armed columns</td></tr>
                  <tr><td><strong>Scene Launch 1-5</strong></td><td>Launch ACT 1-5</td><td>green = ACT exists, orange-blink = playing</td></tr>
                  <tr><td><strong>Clip Stop row</strong></td><td>Stop/unselect the active scene for the current deck</td><td>red while deck scene active</td></tr>
                  <tr><td><strong>Stop All Clips</strong></td><td>Stop Deck A/B scenes and ACT playback</td><td>red while active</td></tr>
                  <tr><td><strong>TRACK SELECT 1-8</strong></td><td>Select fixture group N</td><td>green when selected</td></tr>
                  <tr><td><strong>ACTIVATOR 1-8</strong></td><td>Toggle group auto control</td><td>orange-blink while active</td></tr>
                  <tr><td><strong>SOLO/CUE 1-8</strong></td><td>Solo fixture N inside selected group</td><td>momentary</td></tr>
                  <tr><td><strong>Master Select</strong></td><td>FULL ON latch; press again restores previous DMX</td><td>red while latched</td></tr>
                  <tr><td><strong>PAN</strong></td><td>Select all fixtures</td><td>n/a</td></tr>
                  <tr><td><strong>Nav ↑/↓</strong></td><td>Cycle fixtures</td><td>n/a</td></tr>
                  <tr><td><strong>Nav ←/→</strong></td><td>Cycle scenes</td><td>n/a</td></tr>
                  <tr><td><strong>Crossfader</strong></td><td>Blend active Deck A scene with active Deck B scene</td><td>n/a</td></tr>
                  <tr><td><strong>Master fader</strong></td><td>SuperControl DIMMER/masterDimmer for selection</td><td>n/a</td></tr>
                </tbody>
              </table>
            </div>

            <div className={styles.section}>
              <h5>Deck save and launch</h5>
              <p>Scene slot names are stable: <code>APC40 Deck A 01</code> through <code>APC40 Deck A 40</code>, and <code>APC40 Deck B 01</code> through <code>APC40 Deck B 40</code>.</p>
              <ul>
                <li>Leave SHIFT released for Deck A, or hold SHIFT for Deck B.</li>
                <li>Press Record Arm for a column, then press a grid pad in that column to save current DMX into that deck slot.</li>
                <li>Press a saved grid pad to launch it. Empty pads warn instead of capturing accidentally.</li>
              </ul>
            </div>

            <div className={styles.section}>
              <h5>Crossfade</h5>
              <p>Launch one Deck A scene, then hold SHIFT and launch one Deck B scene. Crossfader 0 = full Deck A, 127 = full Deck B, and middle values blend DMX channel values linearly.</p>
            </div>

            <div className={styles.section}>
              <h5>Fixture groups and auto</h5>
              <ul>
                <li><strong>TRACK SELECT</strong> column N selects fixture group N.</li>
                <li><strong>SOLO/CUE</strong> column N solos fixture N inside the selected group, and pressing it again restores the previous selection.</li>
                <li><strong>ACTIVATOR</strong> column N toggles APC40 auto control for group N. It prefers gobo/effect/color-wheel/prism/strobe roles and falls back to dimmer breathe.</li>
              </ul>
            </div>

            <div className={styles.section}>
              <h5>Faders → Super Control</h5>
              <p>Channel faders walk the current selection via <code>applySuperControlMidi('dimmer', value, slotIndex)</code>. Master fader drives <code>masterDimmer</code> for the current selection.</p>
              <table>
                <thead><tr><th>Fader</th><th>Control</th><th>Target</th></tr></thead>
                <tbody>
                  <tr><td>1-8</td><td>dimmer</td><td>Selected fixture slot 1-8</td></tr>
                  <tr><td>Master</td><td>masterDimmer</td><td>Current selection DIMMER/intensity/master</td></tr>
                </tbody>
              </table>
            </div>

            <div className={styles.section}>
              <h5>Device Control</h5>
              <p>Device Control knobs resolve roles from the selected fixture/group, with gobo and visual-effect controls first: gobo, gobo rotation, color wheel, prism, iris, focus, zoom, strobe, macro, speed, then fine pan/tilt and color channels. Cue Level pages through extra role banks.</p>
            </div>

            <div className={styles.section}>
              <h5>LED legend</h5>
              <ul>
                <li><strong>green</strong> — saved deck slot, saved ACT, or group exists</li>
                <li><strong>green/red blink</strong> — record-armed grid column</li>
                <li><strong>orange-blink</strong> — active deck scene, playing ACT, or active group auto</li>
                <li><strong>red</strong> — Record Arm, Stop All, or FULL ON active</li>
              </ul>
              <p>Hot-plug is supported: the surface repaints in a single sweep when an APC40 output appears.</p>
            </div>
          </div>
        );

      case 'acts-triggers':
        return (
          <div className={styles.tabContent}>
            <h4>▶️ ACT Triggers</h4>
            <p>
              ACT triggers are <strong>transport</strong> for a specific act (play, pause, stop,
              next, prev, toggle). They do not share Ableton Live&apos;s play button unless you map
              them yourself. For act clip editing and tempo, see the Act Timeline tab.
            </p>

            <div className={styles.section}>
              <h5>Available actions</h5>
              <ul>
                <li><code>play</code> - start playback</li>
                <li><code>pause</code> - pause without resetting</li>
                <li><code>stop</code> - stop and rewind</li>
                <li><code>next</code> - advance to the next scene/step</li>
                <li><code>prev</code> - previous scene/step</li>
                <li><code>toggle</code> - switch play/pause based on state</li>
              </ul>
            </div>

            <div className={styles.section}>
              <h5>Where they appear</h5>
              <ul>
                <li>OSC: <code>/act/play</code>, <code>/act/pause</code>, <code>/act/stop</code>, <code>/act/next</code>, <code>/act/prev</code>, <code>/act/toggle</code>.</li>
                <li>MIDI: assignable via MIDI Learn or applied through the controller templates.</li>
                <li>Keyboard: <kbd>Space</kbd> for play/pause inside the timeline; <kbd>Esc</kbd> for stop.</li>
              </ul>
            </div>

            <div className={styles.section}>
              <h5>Tip</h5>
              <p>
                Pause + play resumes the act from the same offset; stop resets. Sync to BPM on the
                act aligns length to bars (app BPM or Link tempo source). Timeline MIDI/OSC lanes
                are scheduled cues during playback, not act transport.
              </p>
            </div>
          </div>
        );

      case 'mobile':
        return (
          <div className={styles.tabContent}>
            <h4>Touch Surface</h4>
            <p>The <code>#/mobile</code> route shares live state with the desktop app and is tuned for phones and tablets.</p>

            <div className={styles.section}>
              <h5>Layout</h5>
              <ul>
                <li>Super Control and DMX channels on tabs with touch-first faders.</li>
                <li>Designed for ~430x932 viewports; works in-browser or in a popup window on desktop.</li>
                <li>Floating MIDI/OSC traffic panels stay off by default to keep the surface clean.</li>
              </ul>
            </div>

            <div className={styles.section}>
              <h5>Multi-client</h5>
              <p>State synchronises in real time over Socket.IO. Changes on a phone show up on the desk and vice versa.</p>
            </div>
          </div>
        );

      case 'factory-reset':
        return (
          <div className={styles.tabContent}>
            <h4>♻️ Factory Reset</h4>
            <p>Clears DMX state, configuration, and saved scenes. Use this between shows or after a botched configuration.</p>

            <div className={styles.section}>
              <h5>Via UI</h5>
              <ol className={styles.stepList}>
                <li>Open <em>Settings → Reset</em>.</li>
                <li>Confirm the dialog.</li>
                <li>The page reloads on a fresh state.</li>
              </ol>
            </div>

            <div className={styles.section}>
              <h5>Via API</h5>
              <pre><code>{`DELETE /api/state
DELETE /api/config
DELETE /api/scenes
GET    /api/factory-reset-check    # returns true once reset has occurred`}</code></pre>
            </div>

            <div className={styles.section}>
              <h5>Via launcher</h5>
              <pre><code>{`./start.sh --reset
.\\start.ps1 -Reset`}</code></pre>
            </div>

            <div className={styles.section}>
              <h5>Backup first</h5>
              <p>Always export <code>/api/config</code> and <code>/api/scenes</code> before you reset. Restore via the matching POST endpoints, or paste a configuration JSON via Settings → Import.</p>
            </div>
          </div>
        );

      case 'lan-bridge':
        return (
          <div className={styles.tabContent}>
            <h4>LAN / Pi Bridge</h4>
            <p>
              Use when the app runs in the cloud but Art-Net and fixtures are on your home LAN (for example 192.168.1.*).
            </p>
            <div className={styles.section}>
              <h5>Setup</h5>
              <ol className={styles.stepList}>
                <li>Run <code>artbastard-bridge</code> on a Raspberry Pi on the same network as your Art-Net node.</li>
                <li>Settings &gt; Network: generate a bridge token; save it in <code>~/.artbastard/bridge.json</code> on the Pi.</li>
                <li>Set Art-Net target IP and click Apply Art-Net target.</li>
                <li>Control lights from the cloud UI; DMX goes cloud to bridge to Art-Net.</li>
              </ol>
            </div>
            <div className={styles.section}>
              <h5>Multiple operators</h5>
              <p>
                Many browsers can connect at once. All operators share one DMX state; every fader move syncs to every client and to the Pi bridge. One bridge per show today.
              </p>
            </div>
            <div className={styles.section}>
              <h5>Ableton Link</h5>
              <p>
                Enable Link on the Pi; choose <strong>Ableton Link</strong> as tempo source in BPM / Auto Scene. Ableton Live on the same LAN can drive tempo.
              </p>
            </div>
            <div className={styles.section}>
              <h5>Later: separate sessions</h5>
              <p>
                Multiple isolated shows or tenants will need a future sessions feature. For now everyone shares one universe.
              </p>
            </div>
            <div className={styles.section}>
              <h5>Reference</h5>
              <p>Repository file <code>DOCS/BRIDGE.md</code> (systemd, env vars, troubleshooting).</p>
            </div>
          </div>
        );

      case 'troubleshooting':
        return (
          <div className={styles.tabContent}>
            <h4>🛟 Troubleshooting</h4>

            <div className={styles.section}>
              <h5>DMX</h5>
              <ul>
                <li><strong>No output:</strong> check the interface, the start address, and the universe.</li>
                <li><strong>Flicker:</strong> missing 120Ω terminator or loose XLR.</li>
                <li><strong>Wrong colour:</strong> profile mismatch - verify the channel mode in Fixture Setup.</li>
                <li><strong>Partial control:</strong> some fixtures have multiple modes - select the right one.</li>
              </ul>
            </div>

            <div className={styles.section}>
              <h5>MIDI</h5>
              <ul>
                <li><strong>Device missing:</strong> re-grant Web MIDI permission, or restart the browser with the device already plugged in.</li>
                <li><strong>Mappings lost:</strong> re-apply the controller template, or restore your configuration backup.</li>
                <li><strong>X-Touch labels stale:</strong> re-apply the X-Touch template - SysEx is sent on apply.</li>
              </ul>
            </div>

            <div className={styles.section}>
              <h5>OSC</h5>
              <ul>
                <li><strong>Not receiving:</strong> verify the listening port, the firewall, and watch the OSC Monitor for incoming traffic.</li>
                <li><strong>Wrong address:</strong> check SuperControl OSC fields and the OSC Monitor for live traffic.</li>
              </ul>
            </div>

            <div className={styles.section}>
              <h5>LAN / Pi Bridge</h5>
              <ul>
                <li><strong>Bridge disconnected:</strong> check Pi online, token valid, outbound HTTPS to cloud.</li>
                <li><strong>No Art-Net on LAN:</strong> Art-Net target IP in Settings; Pi on same subnet as node.</li>
                <li><strong>Cloud OK, no lights:</strong> bridge must be connected; cloud does not send Art-Net to LAN.</li>
                <li><strong>Link peers 0:</strong> Link on in Live; same LAN as Pi; no AP isolation.</li>
              </ul>
            </div>

            <div className={styles.section}>
              <h5>Build / start</h5>
              <ul>
                <li>Run <code>./start.sh --reset</code> or <code>.\start.ps1 -Reset</code> for a clean rebuild.</li>
                <li>If <code>dist/server.js</code> is missing, run <code>npm run build</code> first.</li>
                <li>Demo screenshots require Chrome or Edge; videos also require <code>ffmpeg</code>. Use <code>CAPTURE_CHROME</code> / <code>CAPTURE_FFMPEG</code> when tools are outside PATH.</li>
              </ul>
            </div>
          </div>
        );

      case 'video-tour':
        return (
          <div className={styles.tabContent}>
            <h4>🎥 Video Tour</h4>
            <p>Six short WebM clips of the current primary surfaces ship with the public showcase page. Embed them locally or stream from the live site.</p>

            <div className={styles.section}>
              <h5>Where</h5>
              <ul>
                <li>Repo path: <code>website/videos/</code></li>
                <li>Public showcase: <a href="https://aday1.github.io/artbastard.aday.net.au/" target="_blank" rel="noopener">aday1.github.io/artbastard.aday.net.au</a></li>
                <li>Source: GitHub <a href="https://github.com/aday1/artbastard.aday.net.au/tree/main/website/videos" target="_blank" rel="noopener">website/videos</a></li>
              </ul>
            </div>

            <div className={styles.section}>
              <h5>Clips</h5>
              <ul>
                <li>DMX Control Home</li>
                <li>Fixture Setup &amp; SuperControl</li>
                <li>Scenes &amp; Clip Launcher</li>
                <li>Acts Timeline</li>
                <li>Mobile Control Surface (430x932)</li>
                <li>Settings &amp; In-App Help</li>
              </ul>
            </div>

            <div className={styles.section}>
              <h5>Regenerate</h5>
              <p>Run <code>npm run demo:capture-videos</code> from the repo root. The pipeline drives Chrome/Edge through DevTools, uses ffmpeg for WebM encoding, and writes WebM + JPG poster pairs into <code>website/videos/</code>. See <code>DOCS/SHOWCASE.md</code> for tunable env vars.</p>
            </div>
          </div>
        );

      case 'address-sheet':
        return (
          <div className={styles.tabContent}>
            <PdfAddressSheet />
          </div>
        );

      default:
        return <div>Select a tab to view content</div>;
    }
  };

  // When embedded, always show content (no overlay)
  if (embedded) {
    return (
      <div className={styles.helpEmbedded}>
        <div className={styles.helpContent}>
          <div className={styles.helpHeader}>
            <div className={styles.headerLeft}>
              <h3>🎵 ArtBastard DMX512 Help</h3>
              <div className={styles.searchContainer}>
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search help content... (Ctrl+/)"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={styles.searchInput}
                />
                <i className="fas fa-search"></i>
              </div>
            </div>
          </div>

          <div className={styles.helpTabs}>
            {tabs.map(tab => (
              <button
                key={tab.id}
                className={`${styles.tab} ${activeTab === tab.id ? styles.active : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                <span className={styles.tabIcon}>{tab.icon}</span>
                <span className={styles.tabLabel}>{tab.label}</span>
              </button>
            ))}
          </div>

          <div className={styles.helpBody}>
            {renderTabContent()}
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Help trigger button */}
      <button
        className={styles.helpButton}
        onClick={() => setIsVisible(!isVisible)}
        title="Show ArtBastard Help (Ctrl+H)"
      >
        <i className="fas fa-question-circle"></i>
      </button>

      {/* Help overlay */}
      {isVisible && (
        <div className={styles.helpOverlay} onClick={(e) => e.target === e.currentTarget && setIsVisible(false)}>
          <div className={styles.helpContent}>
            <div className={styles.helpHeader}>
              <div className={styles.headerLeft}>
                <h3>🎵 ArtBastard DMX512 Help</h3>
                <div className={styles.searchContainer}>
                  <input
                    ref={searchInputRef}
                    type="text"
                    placeholder="Search help content... (Ctrl+/)"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className={styles.searchInput}
                  />
                  <i className="fas fa-search"></i>
                </div>
              </div>
              <button 
                onClick={() => setIsVisible(false)}
                className={styles.closeButton}
                title="Close Help (Esc)"
              >
                <i className="fas fa-times"></i>
              </button>
            </div>

            <div className={styles.helpTabs}>
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  className={`${styles.tab} ${activeTab === tab.id ? styles.active : ''}`}
                  onClick={() => setActiveTab(tab.id)}
                >
                  <span className={styles.tabIcon}>{tab.icon}</span>
                  <span className={styles.tabLabel}>{tab.label}</span>
                </button>
              ))}
            </div>

            <div className={styles.helpBody}>
              {renderTabContent()}
            </div>

            <div className={styles.helpFooter}>
              <div className={styles.footerInfo}>
                <span>💡 Press <kbd>Ctrl+H</kbd> to toggle this help anytime</span>
                <span>🎵 ArtBastard DMX512 Lighting Control System</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default HelpOverlay;
