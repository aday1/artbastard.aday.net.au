import React, { useCallback, useEffect, useMemo, useState } from 'react';
import styles from './ServerLogPanels.module.scss';

type ServerLogEntry = {
  timestamp?: string;
  type?: string;
  message?: string;
  data?: unknown;
  text?: string;
};

type ServerRoliStatus = {
  connected: boolean;
  inputName: string | null;
  outputName: string | null;
  handshakeDone: boolean;
  sysexRx: number;
  sysexTx: number;
  ackCount: number;
  touchCount: number;
  lastError: string | null;
  screensaverEnabled: boolean;
  screensaverActive: boolean;
  browserClientCount: number;
};

const MAX_LINES_PER_PANE = 220;

const PANES = [
  { key: 'MIDI', title: 'MIDI', types: ['MIDI'] },
  { key: 'OSC', title: 'OSC', types: ['OSC', 'TOUCHOSC'] },
  { key: 'DMX', title: 'DMX', types: ['DMX', 'ARTNET'] },
  { key: 'SERVER', title: 'SERVER / WEB', types: ['SERVER', 'SYSTEM', 'INFO', 'WARN', 'ERROR', 'CLOCK'] },
];

const emptyRoliStatus: ServerRoliStatus = {
  connected: false,
  inputName: null,
  outputName: null,
  handshakeDone: false,
  sysexRx: 0,
  sysexTx: 0,
  ackCount: 0,
  touchCount: 0,
  lastError: null,
  screensaverEnabled: false,
  screensaverActive: false,
  browserClientCount: 0,
};

const parseLogType = (line: string): string => {
  const match = line.match(/\[(\w+)\]/);
  return match ? match[1].toUpperCase() : 'INFO';
};

const formatEntry = (entry: ServerLogEntry): string => {
  if (entry.text) return entry.text;
  const type = (entry.type || 'INFO').toUpperCase();
  const time = entry.timestamp ? new Date(entry.timestamp).toLocaleTimeString() : new Date().toLocaleTimeString();
  const payload = entry.data === undefined ? '' : ` ${JSON.stringify(entry.data)}`;
  return `${time} [${type}] ${entry.message || ''}${payload}`;
};

interface ServerLogPanelsProps {
  compact?: boolean;
}

export const ServerLogPanels: React.FC<ServerLogPanelsProps> = ({ compact = false }) => {
  const [lines, setLines] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [roliStatus, setRoliStatus] = useState<ServerRoliStatus>(emptyRoliStatus);

  const refreshLogs = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/logs?tail=900&types=MIDI,OSC,TOUCHOSC,DMX,ARTNET,SERVER,SYSTEM,INFO,WARN,ERROR,CLOCK');
      const text = response.ok ? await response.text() : '';
      setLines(text.split(/\r?\n/).filter(Boolean).slice(-MAX_LINES_PER_PANE * PANES.length));
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshRoliStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/roli/server/status');
      if (!response.ok) return;
      const status = await response.json();
      setRoliStatus(status);
      (window as any).__artbastardServerRoliStatus = status;
      window.dispatchEvent(new CustomEvent('serverRoliStatus', { detail: status }));
    } catch {
      setRoliStatus((current) => ({ ...current, lastError: current.lastError || 'Could not fetch ROLI status' }));
    }
  }, []);

  useEffect(() => {
    void refreshLogs();
    void refreshRoliStatus();
  }, [refreshLogs, refreshRoliStatus]);

  useEffect(() => {
    const onServerLog = (event: Event) => {
      const nextLine = formatEntry((event as CustomEvent<ServerLogEntry>).detail);
      setLines((current) => [...current, nextLine].slice(-MAX_LINES_PER_PANE * PANES.length));
    };
    const onRoliStatus = (event: Event) => {
      setRoliStatus({ ...emptyRoliStatus, ...((event as CustomEvent<ServerRoliStatus>).detail || {}) });
    };
    window.addEventListener('serverLog', onServerLog);
    window.addEventListener('serverRoliStatus', onRoliStatus);
    return () => {
      window.removeEventListener('serverLog', onServerLog);
      window.removeEventListener('serverRoliStatus', onRoliStatus);
    };
  }, []);

  const grouped = useMemo(() => {
    return PANES.map((pane) => {
      const typeSet = new Set(pane.types);
      return {
        ...pane,
        lines: lines.filter((line) => typeSet.has(parseLogType(line))).slice(-MAX_LINES_PER_PANE),
      };
    });
  }, [lines]);

  const postRoliAction = useCallback(async (path: string) => {
    const response = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' } });
    if (!response.ok) return;
    const result = await response.json();
    const status = result.status || result;
    setRoliStatus(status);
    (window as any).__artbastardServerRoliStatus = status;
    window.dispatchEvent(new CustomEvent('serverRoliStatus', { detail: status }));
  }, []);

  const clearLogs = useCallback(async () => {
    await fetch('/api/logs/clear', { method: 'POST' });
    setLines([]);
  }, []);

  return (
    <section
      className={`${styles.logConsole} ${compact ? styles.logConsoleCompact : ''}`}
      aria-label="Server log panels"
    >
      <div className={styles.header}>
        <div className={styles.titleBlock}>
          <h2 className={styles.title}>Server Console Panels</h2>
          <span className={styles.subtitle}>Live MIDI, OSC, DMX, ROLI, and server activity</span>
        </div>
        <div className={styles.actions}>
          <button type="button" className={styles.actionButton} onClick={refreshLogs} disabled={loading}>
            {loading ? 'Refreshing' : 'Refresh'}
          </button>
          <button type="button" className={styles.actionButton} onClick={() => postRoliAction('/api/roli/server/connect')}>
            Server ROLI
          </button>
          <button type="button" className={styles.actionButton} onClick={() => postRoliAction('/api/roli/server/test-frame')}>
            LED Test
          </button>
          <button type="button" className={styles.actionButton} onClick={() => postRoliAction('/api/roli/server/disconnect')}>
            Release ROLI
          </button>
          <button type="button" className={styles.clearButton} onClick={clearLogs}>
            Clear
          </button>
        </div>
      </div>

      <div className={styles.statusStrip}>
        <div className={styles.statusItem}>
          <span className={styles.statusLabel}>ROLI claim</span>
          <span className={`${styles.statusValue} ${roliStatus.connected ? styles.connected : styles.disconnected}`}>
            {roliStatus.connected ? 'server owns port' : 'not claimed'}
          </span>
        </div>
        <div className={styles.statusItem}>
          <span className={styles.statusLabel}>Input</span>
          <span className={styles.statusValue}>{roliStatus.inputName || 'none'}</span>
        </div>
        <div className={styles.statusItem}>
          <span className={styles.statusLabel}>Output</span>
          <span className={styles.statusValue}>{roliStatus.outputName || 'none'}</span>
        </div>
        <div className={styles.statusItem}>
          <span className={styles.statusLabel}>Handshake</span>
          <span className={`${styles.statusValue} ${roliStatus.handshakeDone ? styles.connected : styles.disconnected}`}>
            {roliStatus.handshakeDone ? 'ready' : roliStatus.lastError || 'pending'}
          </span>
        </div>
        <div className={styles.statusItem}>
          <span className={styles.statusLabel}>Screensaver</span>
          <span className={`${styles.statusValue} ${roliStatus.screensaverActive ? styles.connected : ''}`}>
            {roliStatus.screensaverActive
              ? 'active'
              : roliStatus.screensaverEnabled
              ? `armed (${roliStatus.browserClientCount} browser${roliStatus.browserClientCount === 1 ? '' : 's'})`
              : 'disabled'}
          </span>
        </div>
        <div className={styles.statusItem}>
          <span className={styles.statusLabel}>SysEx / ACK / touch</span>
          <span className={styles.statusValue}>{roliStatus.sysexRx} rx / {roliStatus.ackCount} ack / {roliStatus.touchCount} touch</span>
        </div>
      </div>

      <div className={styles.panes}>
        {grouped.map((pane) => (
          <div className={styles.pane} key={pane.key}>
            <div className={styles.paneHeader}>
              <span className={styles.paneTitle}>{pane.title}</span>
              <span className={styles.paneCount}>{pane.lines.length}</span>
            </div>
            <div className={styles.logBody}>
              {pane.lines.length === 0 ? (
                <div className={styles.emptyLine}>Waiting for activity</div>
              ) : (
                pane.lines.map((line, index) => (
                  <div className={styles.logLine} key={`${pane.key}-${index}-${line.slice(0, 20)}`}>{line}</div>
                ))
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

export default ServerLogPanels;
