import React, { useState, useEffect } from 'react';
import { useSocket } from '../../context/SocketContext';
import { useStore } from '../../store';
import styles from './DebugMenu.module.scss';

interface DebugMenuProps {
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'embedded';
}

interface SystemInfo {
  timestamp: string;
  userAgent: string;
  currentUrl: string;
  nodeEnv: string;
  webMidiSupported: boolean;
  socketIOAvailable: boolean;
  reactVersion: string;
  documentReadyState: string;
  windowLoaded: boolean;
  errors: any[];
  memoryUsage?: any;
  performance?: any;
}

interface NetworkInfo {
  interfaces: Array<{
    name: string;
    address: string;
    family: string;
    internal: boolean;
  }>;
  serverHost: string;
  serverPort: number;
  oscConfig?: {
    receivePort: number;
    receiveHost: string;
    sendEnabled: boolean;
    sendHost: string;
    sendPort: number;
    interfaceAssignment: string;
  };
}

interface OscTestMessage {
  address: string;
  args: Array<{ type: string; value: any }>;
}

export const DebugMenu: React.FC<DebugMenuProps> = ({ position = 'top-right' }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [activeTab, setActiveTab] = useState<'system' | 'midi' | 'osc' | 'dmx'>('system');
  const [systemInfo, setSystemInfo] = useState<SystemInfo>({} as SystemInfo);
  const [oscTestAddress, setOscTestAddress] = useState('/dmx/channel/1');
  const [oscTestValue, setOscTestValue] = useState('127');  const [dmxTestChannel, setDmxTestChannel] = useState('1');
  const [dmxTestValue, setDmxTestValue] = useState('255');
  const [showNetworkPanel, setShowNetworkPanel] = useState(false);
  const [networkInfo, setNetworkInfo] = useState<NetworkInfo | null>(null);
  
  const { 
    midiMessages, 
    midiMappings, 
    midiLearnTarget,
    allFixtures,
    fixtureLayout,
    masterSliders,
    dmxChannels,
    setDmxChannel,
    debugTools,
    oscConfig
  } = useStore(state => ({
    midiMessages: state.midiMessages,
    midiMappings: state.midiMappings,
    midiLearnTarget: state.midiLearnTarget,
    allFixtures: state.fixtures,
    fixtureLayout: state.fixtureLayout,
    masterSliders: state.masterSliders,
    dmxChannels: state.dmxChannels,
    setDmxChannel: state.setDmxChannel,
    debugTools: state.debugTools,
    oscConfig: state.oscConfig
  }));

  const { socket, connected } = useSocket();

  // Fetch network information from backend
  useEffect(() => {
    if (socket && connected) {
      // Request network info from backend
      socket.emit('getNetworkInfo');
      
      socket.on('networkInfo', (info: NetworkInfo) => {
        setNetworkInfo(info);
      });
      
      return () => {
        socket.off('networkInfo');
      };
    }
  }, [socket, connected]);

  useEffect(() => {
    const updateSystemInfo = () => {
      const memInfo = (performance as any).memory || {};
      setSystemInfo({
        timestamp: new Date().toLocaleTimeString(),
        userAgent: navigator.userAgent,
        currentUrl: window.location.href,
        nodeEnv: process.env.NODE_ENV || 'unknown',
        webMidiSupported: 'navigator' in window && 'requestMIDIAccess' in navigator,
        socketIOAvailable: typeof window !== 'undefined' && 'io' in window,
        reactVersion: React.version,
        documentReadyState: document.readyState,
        windowLoaded: document.readyState === 'complete',
        errors: (window as any).__reactErrors || [],
        memoryUsage: {
          usedJSHeapSize: memInfo.usedJSHeapSize,
          totalJSHeapSize: memInfo.totalJSHeapSize,
          jsHeapSizeLimit: memInfo.jsHeapSizeLimit
        },
        performance: {
          navigation: performance.navigation?.type,
          timing: performance.timing ? {
            loadEventEnd: performance.timing.loadEventEnd,
            navigationStart: performance.timing.navigationStart
          } : null
        }
      });
    };

    updateSystemInfo();
    const interval = setInterval(updateSystemInfo, 2000);    // Listen for errors
    const errorHandler = (event: ErrorEvent) => {
      if (!(window as any).__reactErrors) {
        (window as any).__reactErrors = [];
      }
      (window as any).__reactErrors.push({
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        error: event.error?.toString(),
        timestamp: new Date().toISOString()
      });
    };

    window.addEventListener('error', errorHandler);
    
    return () => {
      clearInterval(interval);
      window.removeEventListener('error', errorHandler);
    };
  }, [connected]); // Add connected dependency

  // OSC Test Functions
  const sendOscTestMessage = () => {
    if (!socket || !connected) {
      alert('Socket not connected!');
      return;
    }

    try {
      const message: OscTestMessage = {
        address: oscTestAddress,
        args: [{ type: 'f', value: parseFloat(oscTestValue) }]
      };
      
      socket.emit('oscSend', message);
      console.log('OSC test message sent:', message);
      alert(`OSC message sent to ${oscTestAddress} with value ${oscTestValue}`);
    } catch (error) {
      console.error('Error sending OSC message:', error);
      alert('Error sending OSC message: ' + error);
    }
  };

  const requestOscTestMessage = () => {
    if (!socket || !connected) {
      alert('Socket not connected!');
      return;
    }

    socket.emit('oscRequestTest', { address: oscTestAddress });
    console.log('OSC test message requested for:', oscTestAddress);
    alert(`OSC test message requested for ${oscTestAddress}`);
  };

  // DMX Test Functions
  const sendDmxTestMessage = () => {
    const channel = parseInt(dmxTestChannel, 10);
    const value = parseInt(dmxTestValue, 10);

    if (isNaN(channel) || channel < 1 || channel > 512) {
      alert('Invalid DMX channel! Must be 1-512');
      return;
    }

    if (isNaN(value) || value < 0 || value > 255) {
      alert('Invalid DMX value! Must be 0-255');
      return;
    }

    // Use store's setDmxChannel to update the DMX value (convert to 0-based channel)
    setDmxChannel(channel - 1, value);
    console.log(`DMX channel ${channel} set to ${value}`);
    alert(`DMX channel ${channel} set to ${value}`);
  };


  const positionStyles = {
    'top-left': { top: '10px', left: '10px' },
    'top-right': { top: '10px', right: '240px' }, // Moved to avoid navbar overlap
    'bottom-left': { bottom: '10px', left: '10px' },
    'bottom-right': { bottom: '10px', right: '240px' } // Moved to avoid navbar overlap
  };
  const formatBytes = (bytes: number) => {
    if (!bytes) return 'N/A';
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };
  // Don't render if debugButton is disabled in debugTools (unless embedded)
  if (!debugTools.debugButton && position !== 'embedded') {
    return null;
  }

  // Embedded mode - render without overlay
  if (position === 'embedded') {
    return (
      <div className={styles.debugPanel} style={{ position: 'relative', zIndex: 'auto' }}>
        <div className={styles.header}>
          <h3>🚀 ArtBastard Debug Menu</h3>
        </div>

        {/* Tab Navigation */}
        <div className={styles.tabNav}>
          {[
            { id: 'system', label: '🖥️ System', icon: '🖥️' },
            { id: 'midi', label: '🎹 MIDI', icon: '🎹' },
            { id: 'osc', label: '📡 OSC', icon: '📡' },
            { id: 'dmx', label: '💡 DMX', icon: '💡' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`${styles.tabButton} ${activeTab === tab.id ? styles.active : ''}`}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>        {/* Tab Content */}
        <div className={styles.tabContent}>
          {/* System Tab */}
          {activeTab === 'system' && (
            <div className={styles.systemTab}>
              <div className={styles.section}>
                <h4>🔧 Environment</h4>
                <div className={styles.infoGrid}>
                  <div>NODE_ENV: {systemInfo.nodeEnv}</div>
                  <div>React: {systemInfo.reactVersion}</div>
                  <div>Document State: {systemInfo.documentReadyState}</div>
                  <div>Window Loaded: {systemInfo.windowLoaded ? '✅' : '❌'}</div>
                  <div>Socket.IO: {connected ? '✅ Connected' : '❌ Disconnected'}</div>
                  <div>WebMIDI: {systemInfo.webMidiSupported ? '✅' : '❌'}</div>
                </div>
              </div>

              <div className={styles.section}>
                <h4>📊 Performance & Memory</h4>
                <div className={styles.infoGrid}>
                  <div>JS Heap Used: {formatBytes(systemInfo.memoryUsage?.usedJSHeapSize)}</div>
                  <div>JS Heap Total: {formatBytes(systemInfo.memoryUsage?.totalJSHeapSize)}</div>
                  <div>JS Heap Limit: {formatBytes(systemInfo.memoryUsage?.jsHeapSizeLimit)}</div>
                  <div>Navigation Type: {systemInfo.performance?.navigation || 'N/A'}</div>
                </div>
              </div>

              <div className={styles.section}>
                <h4>🌐 Network & Status</h4>
                <div className={styles.infoGrid}>
                  <div>Current URL: {systemInfo.currentUrl}</div>
                  <div>User Agent: {systemInfo.userAgent?.substring(0, 50)}...</div>
                  <div>Last Update: {systemInfo.timestamp}</div>
                  <div>Load Time: {systemInfo.performance?.timing ? 
                    `${systemInfo.performance.timing.loadEventEnd - systemInfo.performance.timing.navigationStart}ms` : 'N/A'}</div>
                </div>
              </div>

              {systemInfo.errors?.length > 0 && (
                <div className={styles.section}>
                  <h4>🚨 Recent Errors</h4>
                  <div className={styles.errorList}>
                    {systemInfo.errors.slice(-3).map((error: any, index: number) => (
                      <div key={index} className={styles.error}>
                        <div className={styles.errorMessage}>{error.message}</div>
                        <div className={styles.errorDetails}>
                          {error.filename}:{error.lineno}:{error.colno}
                        </div>
                        <div className={styles.errorTime}>
                          {new Date(error.timestamp).toLocaleTimeString()}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* MIDI Tab */}
          {activeTab === 'midi' && (
            <div className={styles.midiTab}>
              <div className={styles.section}>
                <h4>🎹 MIDI Status</h4>
                <div className={styles.infoGrid}>
                  <div>Learn Target: {midiLearnTarget !== null ? JSON.stringify(midiLearnTarget) : 'None'}</div>
                  <div>Active Mappings: {Object.keys(midiMappings).length}</div>
                  <div>Recent Messages: {midiMessages.length}</div>
                  <div>WebMIDI Support: {typeof navigator !== 'undefined' && 'requestMIDIAccess' in navigator ? '✅' : '❌'}</div>
                </div>
              </div>

            </div>
          )}

          {/* OSC Tab */}
          {activeTab === 'osc' && (
            <div className={styles.oscTab}>
              <div className={styles.section}>
                <h4>📡 OSC Configuration</h4>
                {oscConfig ? (
                  <>
                    <div className={styles.infoGrid}>
                      <div><strong>Receive Port:</strong> {oscConfig.port || 'N/A'}</div>
                      <div><strong>Receive Host:</strong> {oscConfig.host || 'N/A'}</div>
                      <div><strong>Send Enabled:</strong> {oscConfig.sendEnabled ? '✅ Yes' : '❌ No'}</div>
                      {oscConfig.sendEnabled && (
                        <>
                          <div><strong>Send Port:</strong> {oscConfig.sendPort || 'N/A'}</div>
                          <div><strong>Send Host:</strong> {oscConfig.sendHost || 'N/A'}</div>
                        </>
                      )}
                    </div>
                    <div className={styles.infoBox}>
                      <strong>📋 OSC Client Configuration:</strong>
                      <div className={styles.configBlock}>
                        <div><strong>Send to:</strong> {oscConfig.host || 'N/A'}:{oscConfig.port || 'N/A'}</div>
                        {oscConfig.sendEnabled && (
                          <div><strong>Receive from:</strong> {oscConfig.sendHost || 'N/A'}:{oscConfig.sendPort || 'N/A'}</div>
                        )}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className={styles.infoBox}>
                    <p>OSC configuration not available. Please check your connection.</p>
                  </div>
                )}
              </div>

              {networkInfo && (
                <>
                  <div className={styles.section}>
                    <h4>🌐 Network Interfaces & IP Addresses</h4>
                    <div className={styles.infoGrid}>
                      <div className={styles.subSection}>
                        <strong>External IP Addresses:</strong>
                        {networkInfo.interfaces
                          .filter(iface => iface.family === 'IPv4' && !iface.internal)
                          .map((iface, index) => (
                            <div key={index} className={styles.ipAddress}>
                              <strong>{iface.name}:</strong> {iface.address}
                            </div>
                          ))}
                        {networkInfo.interfaces.filter(iface => iface.family === 'IPv4' && !iface.internal).length === 0 && (
                          <div className={styles.noData}>No external network interfaces found</div>
                        )}
                      </div>
                      <div className={styles.subSection}>
                        <strong>Internal IP Addresses:</strong>
                        {networkInfo.interfaces
                          .filter(iface => iface.family === 'IPv4' && iface.internal)
                          .map((iface, index) => (
                            <div key={index} className={styles.ipAddress}>
                              <strong>{iface.name}:</strong> {iface.address} <span className={styles.internalLabel}>(internal)</span>
                            </div>
                          ))}
                        {networkInfo.interfaces.filter(iface => iface.family === 'IPv4' && iface.internal).length === 0 && (
                          <div className={styles.noData}>No internal network interfaces</div>
                        )}
                      </div>
                    </div>
                    <div className={styles.infoBox}>
                      <div className={styles.serverInfo}>
                        <strong>🌐 Web Server:</strong>
                        <div className={styles.serverDetails}>
                          <div><strong>Host:</strong> {networkInfo.serverHost}</div>
                          <div><strong>Port:</strong> {networkInfo.serverPort}</div>
                          <div><strong>URL:</strong> {window.location.origin}</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {networkInfo.oscConfig && (
                    <div className={styles.section}>
                      <h4>📡 OSC Configuration & Interface Assignment</h4>
                      <div className={styles.infoGrid}>
                        <div className={styles.subSection}>
                          <strong>OSC Receive:</strong>
                          <div className={styles.oscDetails}>
                            <div><strong>Listen Address:</strong> {networkInfo.oscConfig.receiveHost}</div>
                            <div><strong>Listen Port:</strong> {networkInfo.oscConfig.receivePort} (UDP)</div>
                            <div><strong>Interface Assignment:</strong> {networkInfo.oscConfig.interfaceAssignment}</div>
                          </div>
                        </div>
                        <div className={styles.subSection}>
                          <strong>OSC Send:</strong>
                          <div className={styles.oscDetails}>
                            <div><strong>Send Enabled:</strong> {networkInfo.oscConfig.sendEnabled ? '✅ Yes' : '❌ No'}</div>
                            {networkInfo.oscConfig.sendEnabled && (
                              <>
                                <div><strong>Send Host:</strong> {networkInfo.oscConfig.sendHost}</div>
                                <div><strong>Send Port:</strong> {networkInfo.oscConfig.sendPort} (UDP)</div>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className={styles.infoBox}>
                        <strong>📋 OSC Connection Details:</strong>
                        <div className={styles.configBlock}>
                          <div><strong>To send OSC to ArtBastard:</strong> {networkInfo.interfaces.filter(i => i.family === 'IPv4' && !i.internal)[0]?.address || 'N/A'}:{networkInfo.oscConfig.receivePort}</div>
                          {networkInfo.oscConfig.sendEnabled && (
                            <div><strong>ArtBastard sends OSC to:</strong> {networkInfo.oscConfig.sendHost}:{networkInfo.oscConfig.sendPort}</div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}

              <div className={styles.section}>
                <h4>📡 OSC Test Functions</h4>
                <div className={styles.inputGroup}>
                  <label>OSC Address:</label>
                  <input
                    type="text"
                    value={oscTestAddress}
                    onChange={(e) => setOscTestAddress(e.target.value)}
                    placeholder="/test/address"
                    className={styles.input}
                  />
                </div>

                <div className={styles.inputGroup}>
                  <label>Value:</label>
                  <input
                    type="number"
                    value={oscTestValue}
                    onChange={(e) => setOscTestValue(e.target.value)}
                    step="0.01"
                    className={styles.input}
                  />
                </div>

                <div className={styles.buttonGrid}>
                  <button
                    onClick={sendOscTestMessage}
                    className={styles.testButton}
                    disabled={!connected}
                  >
                    📡 Send OSC Message
                  </button>
                  <button
                    onClick={requestOscTestMessage}
                    className={styles.testButton}
                    disabled={!connected}
                  >
                    📥 Request OSC Test
                  </button>
                </div>

                <div className={styles.connectionStatus}>
                  Socket Status: {connected ? '✅ Connected' : '❌ Disconnected'}
                </div>
              </div>
            </div>
          )}

          {/* DMX Tab */}
          {activeTab === 'dmx' && (
            <div className={styles.dmxTab}>
              <div className={styles.section}>
                <h4>💡 DMX Test Functions</h4>
                <div className={styles.inputGroup}>
                  <label>DMX Channel (1-512):</label>
                  <input
                    type="number"
                    min="1"
                    max="512"
                    value={dmxTestChannel}
                    onChange={(e) => setDmxTestChannel(e.target.value)}
                    className={styles.input}
                  />
                </div>

                <div className={styles.inputGroup}>
                  <label>Value (0-255):</label>
                  <input
                    type="number"
                    min="0"
                    max="255"
                    value={dmxTestValue}
                    onChange={(e) => setDmxTestValue(e.target.value)}
                    className={styles.input}
                  />
                </div>

                <button
                  onClick={sendDmxTestMessage}
                  className={styles.testButton}
                  disabled={!connected}
                >
                  💡 Send DMX Channel Debug
                </button>

                <div className={styles.connectionStatus}>
                  Socket Status: {connected ? '✅ Connected' : '❌ Disconnected'}
                </div>
              </div>

              <div className={styles.section}>
                <h4>📊 DMX Status</h4>
                <div className={styles.infoGrid}>
                  <div>Active Channels: {dmxChannels.filter(v => v > 0).length}</div>
                  <div>Total Fixtures: {fixtureLayout.length}</div>
                  <div>Max Channel Used: {Math.max(...dmxChannels.map((v, i) => v > 0 ? i + 1 : 0))}</div>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    );  }

  // If not embedded mode, return null (no overlay functionality)
  return null;
};

export default DebugMenu;
