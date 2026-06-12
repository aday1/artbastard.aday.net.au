import React, { useMemo, useState } from 'react';
import { LucideIcon } from '../ui/LucideIcon';
import smx from './SmxSuperPanel.module.scss';
import { getRoliDevices, type RoliDeviceInfo } from '../../engines/roliLightpad';
import { bucketFor, BUCKET_LABELS, BUCKET_ORDER, type MidiBucket } from '../../midi/midiInterfaceGrouping';

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

// Shared with MidiOscSetup → groupMidiInterfaces. Keep ordering identical so
// users see the same hierarchy in both places.
type DeviceCategory = MidiBucket;
const CATEGORY_LABEL: Record<DeviceCategory, string> = BUCKET_LABELS;
const CATEGORY_ORDER: DeviceCategory[] = BUCKET_ORDER;

function categorize(name: string): DeviceCategory {
  return bucketFor(name);
}

function labelForRoli(name: string, devices: RoliDeviceInfo[]): string | null {
  const trimmed = (name || '').trim();
  const dev = devices.find(
    (d) =>
      (d.inputName && d.inputName.trim() === trimmed) ||
      (d.outputName && d.outputName.trim() === trimmed)
  );
  if (!dev) return null;
  const roleLabel = dev.role === 'primary' ? 'Primary (XY pad)' : 'Colour Wheel';
  const handshake = dev.handshakeDone ? 'ready' : 'handshake…';
  return `${roleLabel} · ${handshake}`;
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
  const [expanded, setExpanded] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState<Record<DeviceCategory, boolean>>(() => {
    const defaults: Record<DeviceCategory, boolean> = { hardware: true, virtual: true, network: true, other: true };
    if (typeof window === 'undefined') return defaults;
    for (const cat of CATEGORY_ORDER) {
      const raw = window.localStorage.getItem(`midi-group-open:${cat}`);
      if (raw === '0') defaults[cat] = false;
    }
    return defaults;
  });
  const toggleCategory = (cat: DeviceCategory) => {
    setCategoryOpen((prev) => {
      const next = { ...prev, [cat]: !prev[cat] };
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(`midi-group-open:${cat}`, next[cat] ? '1' : '0');
      }
      return next;
    });
  };
  const activeCount = activeBrowserInputs.length;
  const linkLed =
    browserMidiSupported && browserInputs.length > 0 && activeCount > 0;

  const summary = browserMidiSupported
    ? `${browserInputs.length} input${browserInputs.length === 1 ? '' : 's'}, ${activeCount} linked`
    : 'Web MIDI unavailable';

  const roliDevices = getRoliDevices();

  const grouped = useMemo(() => {
    const groups: Record<DeviceCategory, MidiInputDevice[]> = {
      hardware: [],
      virtual: [],
      network: [],
      other: [],
    };
    for (const input of browserInputs) {
      groups[categorize(input.name || '')].push(input);
    }
    // Within each group, sort: ROLI primary first, then colour-wheel, then alpha.
    const roliPriority = (name: string) => {
      const l = (name || '').toLowerCase();
      if (l.includes('lightpad') || l.includes('roli')) return 0;
      if (l.includes('apc')) return 1;
      return 2;
    };
    for (const k of CATEGORY_ORDER) {
      groups[k].sort((a, b) => {
        const pa = roliPriority(a.name || '');
        const pb = roliPriority(b.name || '');
        if (pa !== pb) return pa - pb;
        return (a.name || '').localeCompare(b.name || '');
      });
    }
    return groups;
  }, [browserInputs]);

  const renderStrip = (input: MidiInputDevice) => {
    const isConnected = activeBrowserInputs.includes(input.id);
    const lit = isConnected ? 5 : 0;
    const roleLabel = labelForRoli(input.name || '', roliDevices);
    return (
      <div
        key={input.id}
        className={`${smx.channelStrip} ${isConnected ? smx.stripHot : ''}`}
      >
        <SegmentLadder litCount={lit} />
        <div className={smx.stripText}>
          <span className={smx.stripName}>
            {input.name || 'MIDI input'}
            {roleLabel && (
              <span
                style={{
                  marginLeft: 8,
                  fontSize: '0.7em',
                  padding: '1px 6px',
                  borderRadius: 999,
                  background: 'rgba(34, 197, 94, 0.22)',
                  color: 'rgba(187, 247, 208, 0.95)',
                  letterSpacing: '0.04em',
                }}
              >
                {roleLabel}
              </span>
            )}
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
  };

  return (
    <div className={smx.rackFrame}>
      <div className={smx.rackFaceplate}>
        <span className={`${smx.screw} ${smx.screwTl}`} />
        <span className={`${smx.screw} ${smx.screwTr}`} />
        <span className={`${smx.screw} ${smx.screwBl}`} />
        <span className={`${smx.screw} ${smx.screwBr}`} />

        <button
          type="button"
          className={smx.rackHeaderButton}
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          title={expanded ? 'Collapse MIDI input list' : 'Expand MIDI input list'}
        >
          <h3 className={smx.rackTitle}>
            <LucideIcon name="Music" />
            Super-Control / MIDI I/O
          </h3>
          <div className={smx.headerRight}>
            <span className={smx.collapsedSummary}>{summary}</span>
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
            <LucideIcon name={expanded ? 'ChevronUp' : 'ChevronDown'} />
          </div>
        </button>

        {expanded ? (
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
                    onClick={(e) => {
                      e.stopPropagation();
                      onRefreshMidiDevices();
                    }}
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
                  <div
                    className={smx.channelStripList}
                    style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
                  >
                    {CATEGORY_ORDER.map((cat) => {
                      const items = grouped[cat];
                      if (items.length === 0) return null;
                      const open = categoryOpen[cat];
                      return (
                        <div key={cat} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          <button
                            type="button"
                            onClick={() => toggleCategory(cat)}
                            style={{
                              fontSize: '0.62rem',
                              fontWeight: 700,
                              letterSpacing: '0.18em',
                              textTransform: 'uppercase',
                              color: 'rgba(148, 163, 184, 0.95)',
                              borderBottom: '1px solid rgba(148, 163, 184, 0.18)',
                              paddingBottom: 4,
                              background: 'transparent',
                              border: 'none',
                              borderBottomStyle: 'solid',
                              textAlign: 'left',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 6,
                              padding: '0 0 4px 0',
                            }}
                            aria-expanded={open}
                          >
                            <span style={{ width: 12, display: 'inline-block' }}>
                              {open ? '▼' : '▶'}
                            </span>
                            {CATEGORY_LABEL[cat]} · {items.length}
                          </button>
                          {open && (
                            <div className={smx.channelStripList}>
                              {items.map(renderStrip)}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            <p className={smx.privacyNote}>
              MIDI uses the Web MIDI API in your browser only. Ports and learn data stay on this
              device.
            </p>
          </div>
        ) : (
          <div className={smx.rackBodyCollapsed}>
            <span className={smx.expandHint}>Click header to expand ports and link devices.</span>
          </div>
        )}
      </div>
    </div>
  );
};
