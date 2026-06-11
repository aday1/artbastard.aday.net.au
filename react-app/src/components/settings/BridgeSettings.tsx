import React, { useCallback, useState } from 'react';
import { useSocket } from '../../context/SocketContext';
import { useStore } from '../../store/store';
import styles from './UnifiedSettings.module.scss';
import { GigSessionQr } from './GigSessionQr';
import qrStyles from './GigSessionQr.module.scss';

export const BridgeSettings: React.FC = () => {
  const { socket, connected } = useSocket();
  const {
    bridgeConnected,
    bridgeInfo,
    connectedClientCount,
    artNetConfig,
    updateArtNetConfig,
    addNotification,
    activeSessionId,
    sessionsList,
    setActiveSessionId,
  } = useStore((state) => ({
    bridgeConnected: state.bridgeConnected,
    bridgeInfo: state.bridgeInfo,
    connectedClientCount: state.connectedClientCount,
    artNetConfig: state.artNetConfig,
    updateArtNetConfig: state.updateArtNetConfig,
    addNotification: state.addNotification,
    activeSessionId: state.activeSessionId,
    sessionsList: state.sessionsList,
    setActiveSessionId: state.setActiveSessionId,
  }));

  const [bridgeId, setBridgeId] = useState('raspberry-pi-bridge');
  const [sessionIdInput, setSessionIdInput] = useState(activeSessionId);
  const [newSessionName, setNewSessionName] = useState('');
  const [mintedToken, setMintedToken] = useState<string | null>(null);
  const [minting, setMinting] = useState(false);
  const [artIp, setArtIp] = useState(artNetConfig.ip);

  const joinSession = useCallback(
    (sessionId: string) => {
      const sid = sessionId.trim().slice(0, 64) || 'default';
      setActiveSessionId(sid);
      setSessionIdInput(sid);
      if (socket && connected) {
        socket.emit('session:join', { sessionId: sid });
      }
      addNotification({
        message: `Joined session: ${sid}`,
        type: 'info',
        priority: 'normal',
      });
    },
    [socket, connected, setActiveSessionId, addNotification]
  );

  const createSession = useCallback(() => {
    const name = newSessionName.trim() || 'New session';
    if (socket && connected) {
      socket.emit('session:create', { name });
    } else {
      fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
        .then((r) => r.json())
        .then((data) => {
          if (data.session?.id) {
            joinSession(data.session.id);
          }
        })
        .catch(() => {
          addNotification({ message: 'Could not create session', type: 'error', priority: 'high' });
        });
    }
    setNewSessionName('');
  }, [socket, connected, newSessionName, joinSession, addNotification]);

  const mintToken = useCallback(async () => {
    setMinting(true);
    try {
      const res = await fetch('/api/bridge/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bridgeId, sessionId: activeSessionId }),
      });
      const data = await res.json();
      if (!res.ok || !data.token) {
        throw new Error(data.error || 'Failed to mint token');
      }
      setMintedToken(data.token);
      addNotification({
        message: `Bridge token for session ${data.sessionId || activeSessionId}`,
        type: 'success',
        priority: 'normal',
      });
    } catch (err) {
      addNotification({
        message: err instanceof Error ? err.message : 'Token mint failed',
        type: 'error',
        priority: 'high',
      });
    } finally {
      setMinting(false);
    }
  }, [bridgeId, activeSessionId, addNotification]);

  const pushArtNetToBridge = () => {
    updateArtNetConfig({ ip: artIp });
    if (socket && connected) {
      socket.emit('updateArtNetConfig', { ...artNetConfig, ip: artIp });
    }
    addNotification({
      message: bridgeConnected
        ? 'Art-Net target sent to LAN bridge'
        : 'Art-Net saved (bridge offline - cloud cannot reach LAN)',
      type: bridgeConnected ? 'success' : 'warning',
      priority: 'normal',
    });
  };

  const statusLabel = bridgeConnected
    ? `Connected: ${bridgeInfo?.bridgeId || 'bridge'}`
    : 'Disconnected';

  return (
    <>
      <div className={styles.settingGroup}>
        <label className={styles.settingLabel}>Show session</label>
        <p className={styles.settingDescription}>
          Browsers and the Pi bridge must use the same session ID. DMX and Art-Net for this session are isolated from other sessions. Scenes/fixtures are still shared globally.
        </p>
        <input
          className={styles.settingInput}
          value={sessionIdInput}
          onChange={(e) => setSessionIdInput(e.target.value)}
          placeholder="default"
        />
        <button
          type="button"
          className={styles.actionButton}
          onClick={() => joinSession(sessionIdInput)}
        >
          Join session
        </button>
        {sessionsList.length > 0 && (
          <select
            className={styles.settingInput}
            value={activeSessionId}
            onChange={(e) => joinSession(e.target.value)}
            style={{ marginTop: '0.5rem' }}
          >
            {sessionsList.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.id}) - {s.clientCount} clients
                {s.bridgeConnected ? ' [bridge]' : ''}
              </option>
            ))}
          </select>
        )}
        <input
          className={styles.settingInput}
          value={newSessionName}
          onChange={(e) => setNewSessionName(e.target.value)}
          placeholder="New session name"
          style={{ marginTop: '0.5rem' }}
        />
        <button type="button" className={styles.actionButton} onClick={createSession}>
          Create session
        </button>
        <p className={styles.settingDescription}>
          Active: <strong>{activeSessionId}</strong>. Reconnect the page after changing session if DMX does not update.
        </p>
        <div className={qrStyles.gigQrRow}>
          <GigSessionQr sessionId={activeSessionId} />
        </div>
      </div>

      <div className={styles.settingGroup}>
        <label className={styles.settingLabel}>LAN Bridge status</label>
        <p className={styles.settingDescription}>
          <strong>{statusLabel}</strong>
          {bridgeConnected && bridgeInfo && (
            <>
              {' '}
              | v{bridgeInfo.version} | Art-Net: {bridgeInfo.artnetStatus || 'n/a'}
              {typeof bridgeInfo.linkPeers === 'number' && (
                <> | Link peers: {bridgeInfo.linkPeers}</>
              )}
            </>
          )}
        </p>
        {!bridgeConnected && (
          <p className={styles.settingDescription}>
            Cloud cannot send Art-Net to 192.168.1.* directly. Run artbastard-bridge on your Pi with a pairing token for session <strong>{activeSessionId}</strong>.
          </p>
        )}
        <p className={styles.settingDescription}>
          Clients in this session: {connectedClientCount}. Other sessions can run in parallel with their own bridge and DMX state.
        </p>
      </div>

      <div className={styles.settingGroup}>
        <label className={styles.settingLabel}>Bridge ID (for new token)</label>
        <input
          className={styles.settingInput}
          value={bridgeId}
          onChange={(e) => setBridgeId(e.target.value)}
        />
        <button
          type="button"
          className={styles.actionButton}
          disabled={minting}
          onClick={mintToken}
        >
          {minting ? 'Creating...' : `Generate bridge token (${activeSessionId})`}
        </button>
        {mintedToken && (
          <textarea
            className={styles.settingInput}
            readOnly
            rows={4}
            value={mintedToken}
            style={{ marginTop: '0.5rem', fontFamily: 'monospace', fontSize: '0.85rem' }}
          />
        )}
        {mintedToken && (
          <p className={styles.settingDescription}>
            Copy into Pi ~/.artbastard/bridge.json as token. Session is embedded in the token. Run artbastard-bridge on the Pi.
          </p>
        )}
      </div>

      <div className={styles.settingGroup}>
        <label className={styles.settingLabel}>Art-Net target (LAN)</label>
        <input
          className={styles.settingInput}
          value={artIp}
          onChange={(e) => setArtIp(e.target.value)}
          placeholder="192.168.1.199"
        />
        <button type="button" className={styles.actionButton} onClick={pushArtNetToBridge}>
          Apply Art-Net target
        </button>
        <p className={styles.settingDescription}>
          Universe {artNetConfig.universe}, port {artNetConfig.port}. When bridge is connected, DMX output is sent from the Pi.
        </p>
      </div>
    </>
  );
};
