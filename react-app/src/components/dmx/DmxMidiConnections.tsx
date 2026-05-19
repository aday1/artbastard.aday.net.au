import React from 'react';
import { LucideIcon } from '../ui/LucideIcon';
import smx from './SmxSuperPanel.module.scss';

interface MidiInputDevice {
  id: string;
  name?: string;
}

interface DmxMidiConnectionsProps {
  browserMidiError: string | null;
  browserMidiSupported: boolean;
  browserInputs: MidiInputDevice[];
  activeBrowserInputs: string[];
  onRefreshMidiDevices: () => void;
  onConnectMidiDevice: (inputId: string) => void;
  onDisconnectMidiDevice: (inputId: string) => void;
}

function SegmentLadder({ litCount }: { litCount: number }) {
  const n = 5;
  return (
    <div className={smx.stripLadder} aria-hidden>
      {Array.from({ length: n }, (_, i) => {
        const fromTop = i;
        const on = fromTop >= n - litCount;
        return (
          <div
            key={i}
            className={`${smx.ladderSeg} ${on ? smx.segLit : ''}`}
          />
        );
      })}
    </div>
  );
}

export const DmxMidiConnections: React.FC<DmxMidiConnectionsProps> = ({
  browserMidiError,
  browserMidiSupported,
  browserInputs,
  activeBrowserInputs,
  onRefreshMidiDevices,
  onConnectMidiDevice,
  onDisconnectMidiDevice,
}) => {
  const activeCount = activeBrowserInputs.length;
  const linkLed =
    browserMidiSupported && browserInputs.length > 0 && activeCount > 0;

  return (
    <div className={smx.rackFrame}>
      <div className={smx.rackFaceplate}>
        <span className={`${smx.screw} ${smx.screwTl}`} />
        <span className={`${smx.screw} ${smx.screwTr}`} />
        <span className={`${smx.screw} ${smx.screwBl}`} />
        <span className={`${smx.screw} ${smx.screwBr}`} />

        <div className={smx.rackHeader}>
          <h3 className={smx.rackTitle}>
            <LucideIcon name="Music" />
            Super-Control / MIDI I/O
          </h3>
          <div className={smx.ledRow}>
            <span className={smx.ledLabel}>Bus</span>
            <div className={smx.ledCluster} title="MIDI stack status">
              <span
                className={`${smx.led} ${browserMidiSupported ? smx.ledOn : ''}`}
                title="Web MIDI available"
              />
              <span
                className={`${smx.led} ${browserInputs.length > 0 ? smx.ledWarn : ''}`}
                title="Inputs detected"
              />
              <span
                className={`${smx.led} ${linkLed ? smx.ledOn : ''}`}
                title="At least one port linked"
              />
            </div>
          </div>
        </div>

        <div className={smx.rackBody}>
          {browserMidiError && (
            <div className={smx.alertErr} role="alert">
              <LucideIcon name="AlertCircle" />
              <span>MIDI error: {browserMidiError}</span>
            </div>
          )}

          {!browserMidiSupported && (
            <div className={smx.alertWarn} role="status">
              <LucideIcon name="AlertTriangle" />
              <span>Web MIDI is not available in this browser or context.</span>
            </div>
          )}

          {browserMidiSupported && (
            <div className={smx.subPanel}>
              <div className={smx.ioToolbar}>
                <span className={smx.ioLabel}>Input matrix</span>
                <button
                  type="button"
                  className={smx.punchButton}
                  onClick={onRefreshMidiDevices}
                  title="Rescan MIDI inputs"
                >
                  <LucideIcon name="RefreshCw" />
                  Scan
                </button>
              </div>

              {browserInputs.length === 0 ? (
                <div className={smx.emptyState}>
                  No inputs detected. Connect a controller or virtual cable, then Scan.
                </div>
              ) : (
                <div className={smx.channelStripList}>
                  {browserInputs.map((input) => {
                    const isConnected = activeBrowserInputs.includes(input.id);
                    const lit = isConnected ? 5 : 0;
                    return (
                      <div
                        key={input.id}
                        className={`${smx.channelStrip} ${isConnected ? smx.stripHot : ''}`}
                      >
                        <SegmentLadder litCount={lit} />
                        <div className={smx.stripText}>
                          <span className={smx.stripName}>
                            {input.name || 'MIDI input'}
                          </span>
                          <span className={smx.stripMeta} title={input.id}>
                            {input.id}
                          </span>
                        </div>
                        <div className={smx.stripAction}>
                          {isConnected ? (
                            <button
                              type="button"
                              className={smx.toggleDisconnect}
                              onClick={() => onDisconnectMidiDevice(input.id)}
                              title="Disconnect this input"
                            >
                              <LucideIcon name="X" />
                              Off
                            </button>
                          ) : (
                            <button
                              type="button"
                              className={smx.toggleConnect}
                              onClick={() => onConnectMidiDevice(input.id)}
                              title="Arm this input for MIDI learn and DMX"
                            >
                              <LucideIcon name="Link" />
                              Link
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          <p className={smx.privacyNote}>
            MIDI uses the Web MIDI API in your browser only. Ports and learn data stay on this
            device; nothing is uploaded to the Art Bastard server for MIDI. For cloud AI or other
            APIs, paste keys only in client-side fields; do not route secrets through the sync API.
          </p>
        </div>
      </div>
    </div>
  );
};
