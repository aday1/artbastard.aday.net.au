import React, { useCallback, useMemo, useRef, useState } from 'react';
import { useStore } from '../../../store';
import { RackModule, RotaryKnob, RackLed, RackLedStrip, RackToggle } from '../../ui/rack';
import { SkeuoButton } from '../../ui/SkeuoButton';
import { LucideIcon } from '../../ui/LucideIcon';
import {
  formatEasingCode,
  formatHexCell,
  parseEasingCode,
  parseHexCell,
  resolveVisibleChannels,
} from '../../../utils/transitionTrackerEngine';
import type { TransitionEasing } from '../../../store/types';
import { getFixtureInfoForChannel } from '../../../utils/fixturePresentation';
import { getTrackerColumnMeta } from '../../../utils/trackerFixtureRoles';
import { TrackerChannelPicker } from './TrackerChannelPicker';
import styles from './DmxTransitionTracker.module.scss';

export interface DmxTransitionTrackerProps {
  patternId?: string | null;
  compact?: boolean;
}

type CellFocus = { line: number; col: 'scene' | 'td' | 'ez' | 'snap' | number };

export const DmxTransitionTracker: React.FC<DmxTransitionTrackerProps> = ({
  patternId: patternIdProp,
  compact = false,
}) => {
  const gridRef = useRef<HTMLDivElement>(null);
  const [focus, setFocus] = useState<CellFocus>({ line: 0, col: 'scene' });
  const [includePinned, setIncludePinned] = useState(false);

  const {
    transitionPatterns,
    activeTransitionPatternId,
    transitionTrackerPlayback,
    scenes,
    bpm,
    selectedChannels,
    pinnedChannels,
    channelNames,
    dmxChannels,
    setActiveTransitionPattern,
    addTransitionPattern,
    deleteTransitionPattern,
    duplicateTransitionPattern,
    updateTransitionPattern,
    updateTransitionPatternLine,
    setPatternLength,
    captureLineFromDmx,
    captureLineFromScene,
    startTransitionTrackerPlayback,
    stopTransitionTrackerPlayback,
    setTransitionTrackerPlaybackOptions,
    previewTrackerLine,
    previewTrackerChannel,
    bakeEnvelopeToPatternTrack,
    importPatternTrackToEnvelope,
    envelopeAutomation,
    fixtures,
  } = useStore((s) => ({
    transitionPatterns: s.transitionPatterns,
    activeTransitionPatternId: s.activeTransitionPatternId,
    transitionTrackerPlayback: s.transitionTrackerPlayback,
    scenes: s.scenes,
    bpm: s.bpm,
    selectedChannels: s.selectedChannels,
    pinnedChannels: s.pinnedChannels,
    channelNames: s.channelNames,
    dmxChannels: s.dmxChannels,
    setActiveTransitionPattern: s.setActiveTransitionPattern,
    addTransitionPattern: s.addTransitionPattern,
    deleteTransitionPattern: s.deleteTransitionPattern,
    duplicateTransitionPattern: s.duplicateTransitionPattern,
    updateTransitionPattern: s.updateTransitionPattern,
    updateTransitionPatternLine: s.updateTransitionPatternLine,
    setPatternLength: s.setPatternLength,
    captureLineFromDmx: s.captureLineFromDmx,
    captureLineFromScene: s.captureLineFromScene,
    startTransitionTrackerPlayback: s.startTransitionTrackerPlayback,
    stopTransitionTrackerPlayback: s.stopTransitionTrackerPlayback,
    setTransitionTrackerPlaybackOptions: s.setTransitionTrackerPlaybackOptions,
    previewTrackerLine: s.previewTrackerLine,
    previewTrackerChannel: s.previewTrackerChannel,
    bakeEnvelopeToPatternTrack: s.bakeEnvelopeToPatternTrack,
    importPatternTrackToEnvelope: s.importPatternTrackToEnvelope,
    envelopeAutomation: s.envelopeAutomation,
    fixtures: s.fixtures,
  }));

  const patternId = patternIdProp ?? activeTransitionPatternId;
  const pattern = transitionPatterns.find((p) => p.id === patternId) ?? transitionPatterns[0];

  const visibleChannels = useMemo(
    () =>
      pattern
        ? resolveVisibleChannels(pattern, selectedChannels, pinnedChannels, {
            includePinned,
          })
        : [],
    [pattern, selectedChannels, pinnedChannels, includePinned]
  );

  const previewChannel =
    typeof focus.col === 'number' ? focus.col : visibleChannels[0] ?? 0;

  const focusEnvelope = envelopeAutomation.envelopes.find(
    (e) => e.channel === previewChannel
  );

  const columnMeta = useMemo(
    () =>
      visibleChannels.map((ch) => getTrackerColumnMeta(ch, fixtures, channelNames)),
    [visibleChannels, fixtures, channelNames]
  );

  const focusFixtureInfo = getFixtureInfoForChannel(previewChannel, fixtures);
  const previewValue = dmxChannels[previewChannel] ?? 0;

  const moveFocus = useCallback(
    (deltaLine: number, deltaCol: number) => {
      if (!pattern) return;
      setFocus((prev) => {
        let line = Math.max(0, Math.min(pattern.length - 1, prev.line + deltaLine));
        const cols: Array<CellFocus['col']> = ['scene', 'td', 'ez', 'snap', ...visibleChannels];
        let idx = cols.indexOf(prev.col);
        if (idx < 0) idx = 0;
        idx = Math.max(0, Math.min(cols.length - 1, idx + deltaCol));
        return { line, col: cols[idx] };
      });
    },
    [pattern, visibleChannels]
  );

  const onGridKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      moveFocus(1, 0);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      moveFocus(-1, 0);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      moveFocus(0, 1);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      moveFocus(0, -1);
    }
  };

  if (!pattern) {
    return <p className={styles.empty}>No transition pattern loaded.</p>;
  }

  const playing = transitionTrackerPlayback.active && transitionTrackerPlayback.patternId === pattern.id;
  const playhead = playing ? transitionTrackerPlayback.currentLine : -1;

  return (
    <RackModule
      className={styles.root}
      title={
        <>
          <LucideIcon name="Grid3x3" />
          DMX transition tracker
          <RackLed state={playing ? 'armed' : 'off'} title={playing ? 'Playing' : 'Stopped'} />
        </>
      }
      actions={
        <>
          <SkeuoButton
            compact
            active={playing}
            accent={playing ? 'green' : 'cyan'}
            onClick={() =>
              playing ? stopTransitionTrackerPlayback() : startTransitionTrackerPlayback(pattern.id)
            }
          >
            {playing ? 'Stop' : 'Play'}
          </SkeuoButton>
        </>
      }
    >
      <TrackerChannelPicker
        patternId={pattern.id}
        focusedChannel={previewChannel}
        onFocusChannel={(ch) => setFocus((prev) => ({ ...prev, col: ch }))}
        includePinned={includePinned}
        onIncludePinnedChange={setIncludePinned}
      />
      <div className={styles.toolbar}>
        <label className={styles.selectWrap}>
          Pattern
          <select
            value={pattern.id}
            onChange={(e) => setActiveTransitionPattern(e.target.value)}
          >
            {transitionPatterns.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <SkeuoButton compact onClick={() => addTransitionPattern()}>
          New
        </SkeuoButton>
        <SkeuoButton compact onClick={() => duplicateTransitionPattern(pattern.id)}>
          Dup
        </SkeuoButton>
        <SkeuoButton compact accent="purple" onClick={() => deleteTransitionPattern(pattern.id)}>
          Del
        </SkeuoButton>
        <RotaryKnob
          label="LPB"
          min={1}
          max={32}
          step={1}
          value={pattern.linesPerBeat}
          onChange={(v) => updateTransitionPattern(pattern.id, { linesPerBeat: v })}
        />
        <RotaryKnob
          label="Len"
          min={4}
          max={compact ? 64 : 128}
          step={4}
          value={pattern.length}
          onChange={(v) => setPatternLength(pattern.id, v)}
        />
        <RackToggle
          pressed={transitionTrackerPlayback.syncToBpm}
          onToggle={() =>
            setTransitionTrackerPlaybackOptions({ syncToBpm: !transitionTrackerPlayback.syncToBpm })
          }
          label={`BPM ${bpm}`}
        />
        <RackToggle
          pressed={transitionTrackerPlayback.loop}
          onToggle={() =>
            setTransitionTrackerPlaybackOptions({ loop: !transitionTrackerPlayback.loop })
          }
          label="Loop"
        />
        <RackToggle
          pressed={transitionTrackerPlayback.livePreview}
          onToggle={() =>
            setTransitionTrackerPlaybackOptions({
              livePreview: !transitionTrackerPlayback.livePreview,
            })
          }
          label="Live"
        />
      </div>

      <div className={styles.inspector}>
        <span className={styles.inspectorLabel}>
          {focusFixtureInfo
            ? `${focusFixtureInfo.fixtureName} · ${focusFixtureInfo.shortFunction}`
            : `Ch ${previewChannel + 1}`}
          {!focusFixtureInfo && channelNames[previewChannel]
            ? ` ${channelNames[previewChannel]}`
            : ''}
        </span>
        <span className={styles.inspectorHex}>{formatHexCell(previewValue)}</span>
        <RackLedStrip count={12} value={previewValue} />
        {focusEnvelope && (
          <>
            <SkeuoButton
              compact
              onClick={() =>
                bakeEnvelopeToPatternTrack(pattern.id, previewChannel, focusEnvelope.id)
              }
            >
              Env to grid
            </SkeuoButton>
            <SkeuoButton
              compact
              onClick={() =>
                importPatternTrackToEnvelope(pattern.id, previewChannel, focusEnvelope.id)
              }
            >
              Grid to env
            </SkeuoButton>
          </>
        )}
      </div>

      {visibleChannels.length === 0 ? (
        <p className={styles.emptyGrid}>
          No columns in this page. Add channels above (number + Add, + Selection, or Fixture
          lanes). Your existing pattern may still list CH 1-8 from an older default; use x or
          Clear all to trim the list.
        </p>
      ) : (
      <div
        ref={gridRef}
        className={`ab-rack-tracker-grid ${styles.grid}`}
        tabIndex={0}
        onKeyDown={onGridKeyDown}
      >
        <table>
          <thead>
            <tr className={styles.headerRow}>
              <th rowSpan={2}>#</th>
              <th rowSpan={2}>Scene</th>
              <th rowSpan={2}>TD</th>
              <th rowSpan={2}>EZ</th>
              <th rowSpan={2}>Sn</th>
              {columnMeta.map((col) => (
                <th
                  key={`f-${col.channelIndex}`}
                  className={
                    col.laneId
                      ? (styles[`colLane_${col.laneId}` as keyof typeof styles] as string)
                      : undefined
                  }
                  title={col.title}
                >
                  <span className={styles.colFixture}>{col.fixtureShort}</span>
                </th>
              ))}
            </tr>
            <tr className={styles.headerRow}>
              {columnMeta.map((col) => (
                <th
                  key={`r-${col.channelIndex}`}
                  className={
                    col.laneId
                      ? (styles[`colLane_${col.laneId}` as keyof typeof styles] as string)
                      : undefined
                  }
                >
                  <span className={styles.colRole}>{col.roleLabel}</span>
                  <span className={styles.colDmx}>{col.channelIndex + 1}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pattern.lines.map((line) => {
              const rowClass =
                line.index === playhead ? 'ab-rack-tracker-row--playhead' : undefined;
              const isFocusRow = line.index === focus.line;
              return (
                <tr key={line.index} className={rowClass}>
                  <td>{String(line.index).padStart(2, '0')}</td>
                  <td
                    className={
                      isFocusRow && focus.col === 'scene' ? 'ab-rack-tracker-cell--focus' : ''
                    }
                  >
                    <select
                      className="ab-rack-tracker-cell-input"
                      value={line.sceneName ?? ''}
                      onFocus={() => setFocus({ line: line.index, col: 'scene' })}
                      onChange={(e) =>
                        updateTransitionPatternLine(pattern.id, line.index, {
                          sceneName: e.target.value || undefined,
                        })
                      }
                    >
                      <option value="">--</option>
                      {scenes.map((s) => (
                        <option key={s.name} value={s.name}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td
                    className={
                      isFocusRow && focus.col === 'td' ? 'ab-rack-tracker-cell--focus' : ''
                    }
                  >
                    <input
                      className="ab-rack-tracker-cell-input"
                      value={line.fx.transitionMs}
                      onFocus={() => setFocus({ line: line.index, col: 'td' })}
                      onChange={(e) =>
                        updateTransitionPatternLine(pattern.id, line.index, {
                          fx: { ...line.fx, transitionMs: Number(e.target.value) || 0 },
                        })
                      }
                    />
                  </td>
                  <td
                    className={
                      isFocusRow && focus.col === 'ez' ? 'ab-rack-tracker-cell--focus' : ''
                    }
                  >
                    <input
                      className="ab-rack-tracker-cell-input"
                      value={formatEasingCode(line.fx.easing)}
                      maxLength={2}
                      onFocus={() => setFocus({ line: line.index, col: 'ez' })}
                      onChange={(e) =>
                        updateTransitionPatternLine(pattern.id, line.index, {
                          fx: {
                            ...line.fx,
                            easing: parseEasingCode(e.target.value) as TransitionEasing,
                          },
                        })
                      }
                    />
                  </td>
                  <td
                    className={
                      isFocusRow && focus.col === 'snap' ? 'ab-rack-tracker-cell--focus' : ''
                    }
                  >
                    <input
                      type="checkbox"
                      checked={!!line.fx.snap}
                      onFocus={() => setFocus({ line: line.index, col: 'snap' })}
                      onChange={(e) =>
                        updateTransitionPatternLine(pattern.id, line.index, {
                          fx: { ...line.fx, snap: e.target.checked },
                        })
                      }
                    />
                  </td>
                  {visibleChannels.map((ch) => {
                    const val = line.channelValues[ch] ?? null;
                    const cellFocused = isFocusRow && focus.col === ch;
                    const meta = columnMeta.find((m) => m.channelIndex === ch);
                    const laneClass = meta?.laneId
                      ? (styles[`colLane_${meta.laneId}` as keyof typeof styles] as string)
                      : '';
                    return (
                      <td
                        key={ch}
                        className={[
                          laneClass,
                          cellFocused ? 'ab-rack-tracker-cell--focus' : '',
                        ]
                          .filter(Boolean)
                          .join(' ')}
                      >
                        <input
                          className="ab-rack-tracker-cell-input"
                          value={formatHexCell(val)}
                          maxLength={2}
                          onFocus={() => setFocus({ line: line.index, col: ch })}
                          onChange={(e) => {
                            const parsed = parseHexCell(e.target.value);
                            const channelValues = { ...line.channelValues };
                            if (parsed === null && (e.target.value === '' || e.target.value === '..')) {
                              delete channelValues[ch];
                            } else if (parsed !== null) {
                              channelValues[ch] = parsed;
                              if (transitionTrackerPlayback.livePreview) {
                                previewTrackerChannel(ch, parsed);
                              }
                            }
                            updateTransitionPatternLine(pattern.id, line.index, { channelValues });
                          }}
                        />
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      )}

      <div className={styles.footer}>
        <SkeuoButton
          compact
          onClick={() => previewTrackerLine(pattern.id, focus.line)}
          title="Audition focused row on live DMX"
        >
          Preview row
        </SkeuoButton>
        <SkeuoButton
          compact
          onClick={() => captureLineFromDmx(pattern.id, focus.line, visibleChannels)}
        >
          Capture DMX
        </SkeuoButton>
        <SkeuoButton
          compact
          disabled={!pattern.lines[focus.line]?.sceneName}
          onClick={() => {
            const sn = pattern.lines[focus.line]?.sceneName;
            if (sn) captureLineFromScene(pattern.id, focus.line, sn, scenes);
          }}
        >
          Capture scene
        </SkeuoButton>
        <SkeuoButton
          compact
          onClick={() => {
            const blob = new Blob([JSON.stringify(pattern, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${pattern.name.replace(/\s+/g, '_')}.json`;
            a.click();
            URL.revokeObjectURL(url);
          }}
        >
          Export
        </SkeuoButton>
      </div>
    </RackModule>
  );
};
