import React, { useState, useEffect, useRef } from 'react';
import styles from './HelpOverlay.module.scss';
import { MidiMonitor } from '../midi/MidiMonitor';
import { OscMonitor } from '../osc/OscMonitor';
import { DipSwitchSimulator } from './DipSwitchSimulator';
import { PdfAddressSheet } from './PdfAddressSheet';

type HelpTab = 'overview' | 'dmx-basics' | 'dip-simulator' | 'midi-setup' | 'osc-integration' | 'scene-management' | 'timeline' | 'clip-launcher' | 'shortcuts' | 'address-sheet';

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
  };  const tabs: Array<{id: HelpTab, label: string, icon: string}> = [
    { id: 'overview', label: 'Getting Started', icon: '🚀' },
    { id: 'dmx-basics', label: 'DMX Control', icon: '💡' },
    { id: 'address-sheet', label: 'Address Sheet', icon: '📋' },
    { id: 'dip-simulator', label: 'DIP Simulator', icon: '🔧' },
    { id: 'midi-setup', label: 'MIDI Setup', icon: '🎹' },
    { id: 'osc-integration', label: 'OSC Control', icon: '📡' },
    { id: 'scene-management', label: 'Scene Management', icon: '🎬' },
    { id: 'timeline', label: 'Timeline Editor', icon: '🎬' },
    { id: 'clip-launcher', label: 'Clip Launcher', icon: '🎹' },
    { id: 'shortcuts', label: 'Shortcuts', icon: '⌨️' },
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
              <h5>📊 Interface Overview</h5>
              <p>The interface is organized into modular panels that you can arrange to suit your workflow:</p>
              <ul>
                <li><strong>DMX Control Panel:</strong> Main fader interface for direct channel control</li>
                <li><strong>Scene Control:</strong> Save and recall lighting scenes</li>
                
                <li><strong>SuperControl:</strong> Advanced fixture control with MIDI/OSC</li>
                <li><strong>Master Fader:</strong> Global brightness control</li>
                <li><strong>Monitors:</strong> MIDI and OSC message monitoring</li>
              </ul>
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
                <li><strong>Akai APC series:</strong> Grid-based controllers perfect for scene triggering</li>
                <li><strong>Novation Launchpad:</strong> RGB feedback and extensive grid control</li>
                <li><strong>Behringer X-Touch:</strong> Professional mixing console with motorized faders</li>
                <li><strong>Korg nanoKONTROL:</strong> Compact USB controller with faders and knobs</li>
              </ul>
            </div>            <div className={styles.section}>
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
                  <li>Use OSC Placeholder in Experimental section to view all available OSC addresses</li>
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

            <div className={styles.section}>
              <h5>🔍 Navigation</h5>
              <div className={styles.shortcutList}>
                <div className={styles.shortcut}>
                  <kbd>Tab</kbd>
                  <span>Cycle Through Panels</span>
                </div>
                <div className={styles.shortcut}>
                  <kbd>Ctrl</kbd> + <kbd>Tab</kbd>
                  <span>Switch Panel Focus</span>
                </div>
                <div className={styles.shortcut}>
                  <kbd>Ctrl</kbd> + <kbd>F</kbd>
                  <span>Find/Filter Fixtures</span>
                </div>
                <div className={styles.shortcut}>
                  <kbd>F11</kbd>
                  <span>Toggle Fullscreen</span>
                </div>
              </div>
            </div>          </div>
        );

      case 'timeline':
        return (
          <div className={styles.tabContent}>
            <h4>🎬 Timeline Editor</h4>
            <p>Create complex lighting sequences with DAW-style timeline editing. The timeline system has been completely refactored to provide professional-grade editing capabilities.</p>
            
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
