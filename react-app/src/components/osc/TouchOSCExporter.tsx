import React, { useState } from 'react';
import { useStore } from '../../store';
import { generateToscLayout } from '../../utils/touchoscExporter';
import { 
  generate512ChannelXml, 
  generateFixturesXml, 
  generateScenesXml,
  generateCompleteXml 
} from '../../utils/touchoscXmlGenerator';
import { LucideIcon } from '../ui/LucideIcon';
import styles from './TouchOSCExporter.module.scss';
import { useSocket } from '../../context/SocketContext';

export const TouchOSCExporter: React.FC = () => {
  const { masterSliders, pinnedChannels, scenes, fixtures, getChannelInfo, addNotification, oscAssignments } = useStore();
  const { socket } = useSocket();
  
  // ⚠️ WARNING: TouchOSC Export is currently BROKEN
  // This feature is non-functional and may cause errors
  const [resolution, setResolution] = useState<any>('phone_portrait');
  const [includeMasters, setIncludeMasters] = useState(true);
  const [includePinned, setIncludePinned] = useState(true);
  const [includeScenes, setIncludeScenes] = useState(true);
  const [includeFixtures, setIncludeFixtures] = useState(true);
  const [includeAllDmx, setIncludeAllDmx] = useState(false);

  const { oscConfig } = useStore();
  const [targetIp, setTargetIp] = useState('192.168.1.');
  const [sendPort, setSendPort] = useState(oscConfig?.sendPort || 8000);
  const [recvPort, setRecvPort] = useState(oscConfig?.port || 9000);
  const [serverIp, setServerIp] = useState<string | null>(null);

  const [pushPort, setPushPort] = useState(6666);
  const [isExporting, setIsExporting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  React.useEffect(() => {
    if (socket) {
      socket.emit('getNetworkInfo');
      socket.on('networkInfo', (info: any) => {
        if (info && info.primaryHost) {
          setServerIp(info.primaryHost);
          // If targetIp isn't set yet or is default, set it to the base of serverIp
          if (targetIp === '192.168.1.') {
            const parts = info.primaryHost.split('.');
            if (parts.length === 4) setTargetIp(`${parts[0]}.${parts[1]}.${parts[2]}.`);
          }
        } else if (info && info.interfaces) {
          const externalIps = info.interfaces.filter((i: any) => !i.internal);
          if (externalIps.length > 0) {
            setServerIp(externalIps[0].address);
          }
        }
      });
      return () => {
        socket.off('networkInfo');
      };
    }
  }, [socket, targetIp]);

  const handleExport = async (autoUpload = false) => {
    if (autoUpload) setIsUploading(true);
    else setIsExporting(true);

    try {
      const result = await generateToscLayout({
        resolution,
        includeMasterSliders: includeMasters,
        includePinnedChannels: includePinned,
        includeScenes,
        includeFixtures,
        includeAllDmx,
        masterSliders,
        pinnedChannels,
        scenes,
        fixtures,
        getChannelInfo,
      });

      if (autoUpload && socket && result.xml) {
        // Update OSC config in backend if changed (optional, but keep it simple for now)
        // Just send the target IP/Port for this specific push
        socket.emit('uploadTouchOscLayout', {
          ip: targetIp,
          port: pushPort,
          xml: result.xml,
          resolution
        });
        addNotification({
          message: `Attempting to push layout to ${targetIp}:${pushPort}...`,
          type: 'info',
        });
      } else {
        addNotification({
          message: 'TouchOSC layout exported successfully',
          type: 'success',
        });
      }
    } catch (error) {
      console.error('Export error:', error);
      addNotification({
        message: 'Failed to export TouchOSC layout',
        type: 'error',
      });
    } finally {
      setIsExporting(false);
      setIsUploading(false);
    }
  };

  const handleUpdateOscConfig = () => {
    if (socket) {
      socket.emit('saveOscConfig', {
        ...oscConfig,
        sendHost: targetIp,
        sendPort: sendPort,
        port: recvPort
      });
      addNotification({ message: 'OSC Configuration Updated', type: 'success' });
    }
  };

  return (
    <div className={styles.exporter}>
      <div className={styles.header}>
        <LucideIcon name="Download" size={18} />
        <h4>TouchOSC Layout Generator</h4>
      </div>

      <div className={styles.warningBox} style={{ 
        border: '2px solid #ff4444', 
        backgroundColor: 'rgba(255, 68, 68, 0.1)',
        padding: '1rem',
        borderRadius: '8px',
        marginBottom: '1rem'
      }}>
        <LucideIcon name="AlertTriangle" size={24} style={{ color: '#ff4444' }} />
        <div>
          <strong style={{ color: '#ff4444', fontSize: '1.1rem' }}>⚠️ TOUCHOSC SECTION IS COMPLETELY BROKEN ⚠️</strong>
          <p style={{ marginTop: '0.5rem' }}>
            TouchOSC export functionality is non-functional and may cause errors. 
            Generated .tosc files may crash TouchOSC. This feature is disabled until further notice.
            Use manual XML generation below at your own risk.
          </p>
        </div>
      </div>

      <p className={styles.description}>
        Generate a professional <code>.tosc</code> layout with auto-populated fixtures, XY pads, and scene launchers.
        <br />
        <strong>Alternative:</strong> Use the XML generators below to copy/paste into TouchOSC Editor manually.
      </p>

      <div className={styles.settings}>
        <div className={styles.settingGroup}>
          <label>Target Resolution</label>
          <select
            value={resolution}
            onChange={(e) => setResolution(e.target.value as any)}
            className={styles.select}
          >
            <option value="phone_portrait">iPhone Portrait</option>
            <option value="phone_landscape">iPhone Landscape</option>
            <option value="tablet_portrait">iPad Portrait</option>
            <option value="tablet_landscape">iPad Landscape</option>
            <option value="android_phone_portrait">Android Phone P</option>
            <option value="android_phone_landscape">Android Phone L</option>
            <option value="android_tablet_portrait">Android Tablet P</option>
            <option value="android_tablet_landscape">Android Tablet L</option>
          </select>
        </div>

        <div className={styles.syncStatus}>
          <div className={styles.statusItem}>
            <LucideIcon name="Server" size={14} />
            <span>Local DMX IP: <strong>{serverIp || 'Detecting...'}</strong></span>
          </div>
          <div className={styles.statusItem}>
            <LucideIcon name="CornerUpRight" size={14} />
            <span>Out: {sendPort}</span>
          </div>
          <div className={styles.statusItem}>
            <LucideIcon name="CornerDownLeft" size={14} />
            <span>In: {recvPort}</span>
          </div>
        </div>

        <div className={styles.checkboxGrid}>
          <label className={styles.checkboxLabel}>
            <input type="checkbox" checked={includeMasters} onChange={(e) => setIncludeMasters(e.target.checked)} />
            <span>Master Sliders ({masterSliders.length})</span>
          </label>

          <label className={styles.checkboxLabel}>
            <input type="checkbox" checked={includePinned} onChange={(e) => setIncludePinned(e.target.checked)} />
            <span>Pinned Channels ({pinnedChannels?.length || 0})</span>
          </label>

          <label className={styles.checkboxLabel}>
            <input type="checkbox" checked={includeFixtures} onChange={(e) => setIncludeFixtures(e.target.checked)} />
            <span>Fixture XY Pads ({fixtures.length})</span>
          </label>

          <label className={styles.checkboxLabel}>
            <input type="checkbox" checked={includeScenes} onChange={(e) => setIncludeScenes(e.target.checked)} />
            <span>Scene Launcher ({scenes.length})</span>
          </label>

          <label className={styles.checkboxLabel}>
            <input type="checkbox" checked={includeAllDmx} onChange={(e) => setIncludeAllDmx(e.target.checked)} />
            <span className={styles.highlight}>All 512 DMX Channels (Huge!)</span>
          </label>
        </div>

        <div className={styles.uploadSection}>
          <div className={styles.settingGroup}>
            <label>TouchOSC Editor / Remote Setup</label>
            <div className={styles.multiInputRow}>
              <div className={styles.inputStack}>
                <span className={styles.miniLabel}>Editor IP</span>
                <input
                  type="text"
                  value={targetIp}
                  onChange={(e) => setTargetIp(e.target.value)}
                  placeholder="192.168.1.XX"
                  className={styles.input}
                />
              </div>
              <div className={styles.inputStack}>
                <span className={styles.miniLabel}>Push Port</span>
                <input
                  type="number"
                  value={pushPort}
                  onChange={(e) => setPushPort(parseInt(e.target.value))}
                  className={styles.input}
                />
              </div>
              <div className={styles.inputStack}>
                <span className={styles.miniLabel}>Send Port</span>
                <input
                  type="number"
                  value={sendPort}
                  onChange={(e) => setSendPort(parseInt(e.target.value))}
                  className={styles.input}
                />
              </div>
              <div className={styles.inputStack}>
                <span className={styles.miniLabel}>Recv Port</span>
                <input
                  type="number"
                  value={recvPort}
                  onChange={(e) => setRecvPort(parseInt(e.target.value))}
                  className={styles.input}
                />
              </div>
              <button
                className={styles.miniActionButton}
                onClick={handleUpdateOscConfig}
                title="Save Ports to Global Config"
              >
                <LucideIcon name="Save" size={14} />
              </button>
            </div>

            <button
              className={styles.uploadButtonFull}
              onClick={() => handleExport(true)}
              disabled={isUploading || isExporting}
            >
              <LucideIcon name={isUploading ? 'Loader2' : 'Wifi'} size={14} className={isUploading ? styles.spin : ''} />
              {isUploading ? 'Pushing...' : 'Auto-Upload to Editor Network'}
            </button>
          </div>
        </div>

        <button
          className={styles.previewToggle}
          onClick={() => setShowPreview(!showPreview)}
        >
          <LucideIcon name={showPreview ? 'EyeOff' : 'Eye'} size={14} />
          {showPreview ? 'Hide Template Details' : 'Preview Layout Structure'}
        </button>

        {showPreview && (
          <div className={styles.visualPreview}>
            <div className={styles.previewTablet}>
              <div className={styles.screen}>
                <div className={styles.topTabs}>
                  {includeMasters && <div className={styles.tab}>Masters</div>}
                  {includeFixtures && <div className={styles.tabActive}>Fixtures</div>}
                  {includeScenes && <div className={styles.tab}>Scenes</div>}
                  {includePinned && <div className={styles.tab}>Pinned</div>}
                </div>

                <div className={styles.content}>
                  {includeFixtures && (
                    <div className={styles.fixtureGrid}>
                      <div className={styles.xyPad}>
                        <div className={styles.crosshair}></div>
                        <span>PAN / TILT</span>
                      </div>
                      <div className={styles.faders}>
                        <div className={styles.faderTrack}><div className={styles.thumb}></div></div>
                        <div className={styles.faderTrack}><div className={styles.thumb}></div></div>
                        <div className={styles.faderTrack}><div className={styles.thumb}></div></div>
                      </div>
                    </div>
                  )}
                </div>

                <div className={styles.importUrl}>
                  <span>Import via URL in TouchOSC App:</span>
                  <code>http://{serverIp}:3030/api/touchosc/layout.tosc</code>
                </div>
              </div>
            </div>

            <div className={styles.importInstructions}>
              <h5>Two ways to sync:</h5>
              <ol>
                <li><strong>Auto-Upload:</strong> Enter Editor IP above and click "Auto-Upload".</li>
                <li><strong>Manual Import:</strong> Open TouchOSC App → Layout → Add → URL, and paste the link above.</li>
              </ol>
            </div>
          </div>
        )}
      </div>

      <button
        className={styles.exportButton}
        onClick={() => handleExport(false)}
        disabled={isExporting || isUploading}
      >
        <LucideIcon name={isExporting ? 'Loader2' : 'Download'} size={16} className={isExporting ? styles.spin : ''} />
        {isExporting ? 'Generating...' : 'Download .tosc File'}
      </button>

      <div className={styles.note}>
        <LucideIcon name="Info" size={14} />
        <span>XY Pads map to fixture Pan/Tilt channels automatically.</span>
      </div>

      {/* Fixture Reference List */}
      <div className={styles.fixtureReference}>
        <h4>
          <LucideIcon name="List" size={16} />
          Fixture Reference (for Manual Building)
        </h4>
        <div className={styles.fixtureTable}>
          <table>
            <thead>
              <tr>
                <th>Fixture Name</th>
                <th>DMX Address</th>
                <th>Channels</th>
                <th>Channel Range</th>
                <th>Type</th>
                <th>OSC Addresses</th>
              </tr>
            </thead>
            <tbody>
              {fixtures.length === 0 ? (
                <tr>
                  <td colSpan={6} className={styles.emptyRow}>
                    No fixtures configured. Add fixtures to see them here.
                  </td>
                </tr>
              ) : (
                fixtures.map((fixture) => {
                  const channelCount = fixture.channels?.length || 0;
                  const endAddress = fixture.startAddress + channelCount - 1;
                  
                  // Get OSC addresses for all channels in this fixture
                  const oscAddresses: string[] = [];
                  for (let i = 0; i < channelCount; i++) {
                    const dmxChannelIndex = fixture.startAddress - 1 + i; // Convert to 0-based index
                    const oscAddress = oscAssignments[dmxChannelIndex];
                    if (oscAddress) {
                      const channelName = fixture.channels?.[i]?.name || `CH${i + 1}`;
                      oscAddresses.push(`${channelName}: ${oscAddress}`);
                    } else {
                      const channelName = fixture.channels?.[i]?.name || `CH${i + 1}`;
                      oscAddresses.push(`${channelName}: (not assigned)`);
                    }
                  }
                  
                  return (
                    <tr key={fixture.id}>
                      <td><strong>{fixture.name}</strong></td>
                      <td>{fixture.startAddress}</td>
                      <td>{channelCount}</td>
                      <td>CH {fixture.startAddress}-{endAddress}</td>
                      <td>{fixture.type || 'Generic'}</td>
                      <td className={styles.oscAddressesCell}>
                        {oscAddresses.length > 0 ? (
                          <div className={styles.oscAddressesList}>
                            {oscAddresses.map((addr, idx) => (
                              <div key={idx} className={styles.oscAddressItem}>
                                <code>{addr}</code>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className={styles.noOscAddresses}>No OSC addresses assigned</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* XML Generators */}
      <div className={styles.xmlGenerators}>
        <h4>
          <LucideIcon name="Code" size={16} />
          XML Generators (Copy to Clipboard)
        </h4>
        <p className={styles.xmlDescription}>
          Generate XML that you can paste directly into TouchOSC Editor. Each section is separate so you can build your layout piece by piece.
        </p>
        
        <div className={styles.xmlButtonGrid}>
          <div className={styles.xmlButtonGroup}>
            <button
              className={styles.xmlButton}
              onClick={async () => {
                try {
                  // Generate full XML document (includes header and structure)
                  const xml = generate512ChannelXml('/channel', false);
                  await navigator.clipboard.writeText(xml);
                  addNotification({
                    message: '512 Channel XML copied to clipboard! Paste into TouchOSC Editor.',
                    type: 'success',
                  });
                  console.log('Full XML copied (first 500 chars):', xml.substring(0, 500));
                  console.log('Full XML length:', xml.length);
                } catch (error) {
                  console.error('Failed to copy to clipboard:', error);
                  // Fallback: use execCommand
                  const xml = generate512ChannelXml('/channel', false);
                  const textarea = document.createElement('textarea');
                  textarea.value = xml;
                  textarea.style.position = 'fixed';
                  textarea.style.opacity = '0';
                  document.body.appendChild(textarea);
                  textarea.select();
                  try {
                    document.execCommand('copy');
                    addNotification({
                      message: 'XML copied to clipboard (fallback method)!',
                      type: 'success',
                    });
                  } catch (err) {
                    addNotification({
                      message: 'Failed to copy. Check browser console (F12) for XML content.',
                      type: 'error',
                    });
                    console.log('Full XML content:', xml);
                  }
                  document.body.removeChild(textarea);
                }
              }}
              title="Copy XML for all 512 DMX channels"
            >
              <LucideIcon name="Copy" size={14} />
              Copy 512 Channel Strip XML
            </button>
            <button
              className={styles.xmlDownloadButton}
              onClick={() => {
                const xml = generate512ChannelXml('/channel', false);
                const blob = new Blob([xml], { type: 'application/xml' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'touchosc_512_channels.xml';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                addNotification({
                  message: '512 Channel XML downloaded!',
                  type: 'success',
                });
              }}
              title="Download XML file for all 512 DMX channels"
            >
              <LucideIcon name="Download" size={14} />
            </button>
          </div>

          {fixtures.length > 0 && (
            <div className={styles.xmlButtonGroup}>
              <button
                className={styles.xmlButton}
                onClick={async () => {
                  try {
                    const fixtureInfos = fixtures.map((fixture: any) => ({
                      id: fixture.id,
                      name: fixture.name,
                      startAddress: fixture.startAddress,
                      channels: fixture.channels || [],
                      type: fixture.type
                    }));
                    const xml = generateFixturesXml(fixtureInfos, '/fixture');
                    await navigator.clipboard.writeText(xml);
                    addNotification({
                      message: `Fixtures XML (${fixtures.length} fixtures) copied to clipboard!`,
                      type: 'success',
                    });
                    console.log('Fixtures XML copied:', xml.substring(0, 200) + '...');
                  } catch (error) {
                    console.error('Failed to copy to clipboard:', error);
                    const fixtureInfos = fixtures.map((fixture: any) => ({
                      id: fixture.id,
                      name: fixture.name,
                      startAddress: fixture.startAddress,
                      channels: fixture.channels || [],
                      type: fixture.type
                    }));
                    const xml = generateFixturesXml(fixtureInfos, '/fixture');
                    const textarea = document.createElement('textarea');
                    textarea.value = xml;
                    textarea.style.position = 'fixed';
                    textarea.style.opacity = '0';
                    document.body.appendChild(textarea);
                    textarea.select();
                    try {
                      document.execCommand('copy');
                      addNotification({
                        message: 'Fixtures XML copied to clipboard (fallback method)!',
                        type: 'success',
                      });
                    } catch (err) {
                      addNotification({
                        message: 'Failed to copy. Check console for XML.',
                        type: 'error',
                      });
                      console.log('Fixtures XML content:', xml);
                    }
                    document.body.removeChild(textarea);
                  }
                }}
                title="Copy XML for all fixtures with XY pads"
              >
                <LucideIcon name="Copy" size={14} />
                Copy Fixtures XML ({fixtures.length} fixtures)
              </button>
              <button
                className={styles.xmlDownloadButton}
                onClick={() => {
                  const fixtureInfos = fixtures.map((fixture: any) => ({
                    id: fixture.id,
                    name: fixture.name,
                    startAddress: fixture.startAddress,
                    channels: fixture.channels || [],
                    type: fixture.type
                  }));
                  const xml = generateFixturesXml(fixtureInfos, '/fixture');
                  const blob = new Blob([xml], { type: 'application/xml' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `touchosc_fixtures_${fixtures.length}.xml`;
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                  URL.revokeObjectURL(url);
                  addNotification({
                    message: 'Fixtures XML downloaded!',
                    type: 'success',
                  });
                }}
                title="Download XML file for all fixtures"
              >
                <LucideIcon name="Download" size={14} />
              </button>
            </div>
          )}

          {scenes.length > 0 && (
            <div className={styles.xmlButtonGroup}>
              <button
                className={styles.xmlButton}
                onClick={async () => {
                  try {
                    const sceneInfos = scenes.map((scene: any) => ({
                      name: scene.name || 'Unnamed Scene',
                      oscAddress: scene.oscAddress || `/scene/${(scene.name || 'scene').replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}/load`
                    }));
                    const xml = generateScenesXml(sceneInfos, '/scene');
                    await navigator.clipboard.writeText(xml);
                    addNotification({
                      message: `Scenes XML (${scenes.length} scenes) copied to clipboard!`,
                      type: 'success',
                    });
                    console.log('Scenes XML copied:', xml.substring(0, 200) + '...');
                  } catch (error) {
                    console.error('Failed to copy to clipboard:', error);
                    const sceneInfos = scenes.map((scene: any) => ({
                      name: scene.name || 'Unnamed Scene',
                      oscAddress: scene.oscAddress || `/scene/${(scene.name || 'scene').replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}/load`
                    }));
                    const xml = generateScenesXml(sceneInfos, '/scene');
                    const textarea = document.createElement('textarea');
                    textarea.value = xml;
                    textarea.style.position = 'fixed';
                    textarea.style.opacity = '0';
                    document.body.appendChild(textarea);
                    textarea.select();
                    try {
                      document.execCommand('copy');
                      addNotification({
                        message: 'Scenes XML copied to clipboard (fallback method)!',
                        type: 'success',
                      });
                    } catch (err) {
                      addNotification({
                        message: 'Failed to copy. Check console for XML.',
                        type: 'error',
                      });
                      console.log('Scenes XML content:', xml);
                    }
                    document.body.removeChild(textarea);
                  }
                }}
                title="Copy XML for scene launcher buttons"
              >
                <LucideIcon name="Copy" size={14} />
                Copy Scenes XML ({scenes.length} scenes)
              </button>
              <button
                className={styles.xmlDownloadButton}
                onClick={() => {
                  const sceneInfos = scenes.map((scene: any) => ({
                    name: scene.name || 'Unnamed Scene',
                    oscAddress: scene.oscAddress || `/scene/${(scene.name || 'scene').replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}/load`
                  }));
                  const xml = generateScenesXml(sceneInfos, '/scene');
                  const blob = new Blob([xml], { type: 'application/xml' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `touchosc_scenes_${scenes.length}.xml`;
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                  URL.revokeObjectURL(url);
                  addNotification({
                    message: 'Scenes XML downloaded!',
                    type: 'success',
                  });
                }}
                title="Download XML file for scenes"
              >
                <LucideIcon name="Download" size={14} />
              </button>
            </div>
          )}

          <div className={styles.xmlButtonGroup}>
            <button
              className={styles.xmlButton}
              onClick={async () => {
                try {
                  const fixtureInfos = fixtures.map((fixture: any) => ({
                    id: fixture.id,
                    name: fixture.name,
                    startAddress: fixture.startAddress,
                    channels: fixture.channels || [],
                    type: fixture.type
                  }));
                  const sceneInfos = scenes.map((scene: any) => ({
                    name: scene.name || 'Unnamed Scene',
                    oscAddress: scene.oscAddress || `/scene/${(scene.name || 'scene').replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}/load`
                  }));
                  const xml = generateCompleteXml({
                    fixtures: fixtureInfos,
                    scenes: sceneInfos,
                    pinnedChannels: pinnedChannels || [],
                    oscBasePath: '',
                  });
                  await navigator.clipboard.writeText(xml);
                  addNotification({
                    message: 'Complete layout XML copied to clipboard!',
                    type: 'success',
                  });
                  console.log('Complete XML copied:', xml.substring(0, 200) + '...');
                } catch (error) {
                  console.error('Failed to copy to clipboard:', error);
                  const fixtureInfos = fixtures.map((fixture: any) => ({
                    id: fixture.id,
                    name: fixture.name,
                    startAddress: fixture.startAddress,
                    channels: fixture.channels || [],
                    type: fixture.type
                  }));
                  const sceneInfos = scenes.map((scene: any) => ({
                    name: scene.name || 'Unnamed Scene',
                    oscAddress: scene.oscAddress || `/scene/${(scene.name || 'scene').replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}/load`
                  }));
                  const xml = generateCompleteXml({
                    fixtures: fixtureInfos,
                    scenes: sceneInfos,
                    pinnedChannels: pinnedChannels || [],
                    oscBasePath: '',
                  });
                  const textarea = document.createElement('textarea');
                  textarea.value = xml;
                  textarea.style.position = 'fixed';
                  textarea.style.opacity = '0';
                  document.body.appendChild(textarea);
                  textarea.select();
                  try {
                    document.execCommand('copy');
                    addNotification({
                      message: 'Complete XML copied to clipboard (fallback method)!',
                      type: 'success',
                    });
                  } catch (err) {
                    addNotification({
                      message: 'Failed to copy. Check console for XML.',
                      type: 'error',
                    });
                    console.log('Complete XML content:', xml);
                  }
                  document.body.removeChild(textarea);
                }
              }}
              title="Copy complete XML with all sections"
            >
              <LucideIcon name="Copy" size={14} />
              Copy Complete Layout XML
            </button>
            <button
              className={styles.xmlDownloadButton}
              onClick={() => {
                const fixtureInfos = fixtures.map((fixture: any) => ({
                  id: fixture.id,
                  name: fixture.name,
                  startAddress: fixture.startAddress,
                  channels: fixture.channels || [],
                  type: fixture.type
                }));
                const sceneInfos = scenes.map((scene: any) => ({
                  name: scene.name || 'Unnamed Scene',
                  oscAddress: scene.oscAddress || `/scene/${(scene.name || 'scene').replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}/load`
                }));
                const xml = generateCompleteXml({
                  fixtures: fixtureInfos,
                  scenes: sceneInfos,
                  pinnedChannels: pinnedChannels || [],
                  oscBasePath: '',
                });
                const blob = new Blob([xml], { type: 'application/xml' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'touchosc_complete_layout.xml';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                addNotification({
                  message: 'Complete layout XML downloaded!',
                  type: 'success',
                });
              }}
              title="Download complete XML file"
            >
              <LucideIcon name="Download" size={14} />
            </button>
          </div>
        </div>

        <div className={styles.xmlInstructions}>
          <h5>How to use in TouchOSC Editor:</h5>
          <ol>
            <li><strong>Click any "Copy" button above</strong> to copy XML to clipboard</li>
            <li><strong>Open TouchOSC Editor</strong> (standalone app, not the mobile app)</li>
            <li><strong>Create a new layout</strong> or open an existing one</li>
            <li><strong>Important:</strong> In TouchOSC Editor, you need to paste the XML in a specific way:
              <ul>
                <li>Right-click on the <strong>canvas/background</strong> (not on an existing control)</li>
                <li>Select <strong>"Paste"</strong> from the context menu</li>
                <li>OR use <strong>Edit → Paste</strong> from the menu bar</li>
                <li>OR use keyboard shortcut: <strong>Ctrl+V</strong> (Windows/Linux) or <strong>Cmd+V</strong> (Mac)</li>
              </ul>
            </li>
            <li>The controls should appear in your layout</li>
            <li>If nothing appears, try:
              <ul>
                <li>Make sure you clicked the "Copy" button and saw a success notification</li>
                <li>Check the browser console (F12) for any errors</li>
                <li>Try pasting into a text editor first to verify the XML was copied</li>
                <li>In TouchOSC Editor, try: <strong>File → Import → From Clipboard</strong> (if available)</li>
              </ul>
            </li>
            <li>Adjust positions and sizes as needed after pasting</li>
          </ol>
          <div className={styles.xmlNote}>
            <LucideIcon name="Info" size={14} />
            <span><strong>Note:</strong> The XML includes the full document structure. If TouchOSC Editor doesn't accept it, you may need to paste just the node content (between &lt;children&gt; tags) into an existing group.</span>
          </div>
        </div>
      </div>
    </div>
  );
};
