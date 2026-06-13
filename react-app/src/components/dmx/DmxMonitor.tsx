import React, { useEffect, useRef, useState } from 'react';
import { LucideIcon } from '../ui/LucideIcon';
import { ResizableFloatingPanel } from '../ui/ResizableFloatingPanel';
import { useStore } from '../../store';
import { useMonitorAutoPop } from '../../hooks/useMonitorAutoPop';
import styles from '../midi/MidiMonitor.module.scss';
import dmxStyles from './DmxMonitor.module.scss';
import { describeApc40DmxSource, narrateDmxChange } from './dmxActivityNarration';
import {
  type DmxActivityMessage,
  mergeDmxActivityMessages,
} from './dmxActivityMessages';

interface DmxMonitorProps {
  footerDocked?: boolean;
}

export const DmxMonitor: React.FC<DmxMonitorProps> = ({ footerDocked = false }) => {
  const {
    dmxChannels,
    channelNames,
    debugTools,
    fixtures,
    groups,
    selectedFixtures,
    latestMidiMessage,
    deviceRoleLabels,
    lastApc40Change,
    activeAutomationSource,
  } = useStore(state => ({
    dmxChannels: state.dmxChannels,
    channelNames: state.channelNames,
    debugTools: state.debugTools,
    fixtures: state.fixtures,
    groups: state.groups,
    selectedFixtures: state.selectedFixtures,
    latestMidiMessage: state.midiMessages[state.midiMessages.length - 1],
    deviceRoleLabels: state.apc40CrossfaderState.deviceRoleLabels,
    lastApc40Change: state.apc40CrossfaderState.lastChange,
    activeAutomationSource: [
      state.envelopeAutomation.globalEnabled && state.envelopeAutomation.envelopes.some(envelope => envelope.enabled)
        ? 'Envelope automation is still running'
        : undefined,
      state.autopilotUpdateInterval ? 'Autopilot is still running' : undefined,
      state.autopilotTrackAnimationId !== null ? 'Autopilot track animation is still running' : undefined,
    ].filter(Boolean).join(' · ') || undefined,
  }));
  const [messages, setMessages] = useState<DmxActivityMessage[]>([]);
  const [autoScroll, setAutoScroll] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const [scrollback, setScrollback] = useState<number>(() => {
    const saved = localStorage.getItem('dmxMonitorScrollback');
    return saved ? parseInt(saved, 10) : 100;
  });
  const [editingScrollback, setEditingScrollback] = useState(false);
  const previousChannelsRef = useRef<number[] | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // Minimised by default; first signal auto-expands + flashes unless the
  // user has manually collapsed/dismissed.
  const {
    isCollapsed,
    isDismissed,
    flashActive,
    setCollapsedByUser,
    dismissByUser,
    triggerFlash,
  } = useMonitorAutoPop({ key: 'dmxMonitor', hasSignal: messages.length > 0, autoPop: !footerDocked });

  const handleDismiss = dismissByUser;

  useEffect(() => {
    const previous = previousChannelsRef.current;
    previousChannelsRef.current = dmxChannels;
    if (!previous || isPaused) return;

    const timestamp = Date.now();
    const updates: DmxActivityMessage[] = [];
    const sourceLabel =
      describeApc40DmxSource(latestMidiMessage, deviceRoleLabels, lastApc40Change) ||
      activeAutomationSource;
    const length = Math.max(previous.length, dmxChannels.length);
    for (let channel = 0; channel < length; channel += 1) {
      const previousValue = previous[channel] ?? 0;
      const value = dmxChannels[channel] ?? 0;
      if (previousValue !== value) {
        const narration = narrateDmxChange({
          channel,
          previousValue,
          value,
          channelNames,
          fixtures,
          groups,
          selectedFixtures,
          sourceLabel,
        });
        updates.push({
          id: `${timestamp}-${channel}-${value}`,
          timestamp,
          firstTimestamp: timestamp,
          channel,
          value,
          previousValue,
          summary: narration.summary,
          detail: narration.detail,
          roleLabel: narration.roleLabel,
          fixtureName: narration.fixtureName,
          repeatCount: 1,
        });
      }
    }

    if (updates.length > 0) {
      setMessages(prev => mergeDmxActivityMessages(prev, updates));
      triggerFlash();
    }
  }, [dmxChannels, channelNames, fixtures, groups, selectedFixtures, latestMidiMessage, deviceRoleLabels, lastApc40Change, activeAutomationSource, isPaused]);

  useEffect(() => {
    if (autoScroll && contentRef.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, [messages, autoScroll]);

  if (debugTools.dmxMonitor === false || (footerDocked && (isCollapsed || isDismissed)) || (!footerDocked && isDismissed)) {
    return null;
  }

  const displayedMessages = messages.slice(-scrollback);

  const clearMessages = () => {
    setMessages([]);
  };

  const handleScrollbackChange = (value: number) => {
    const next = Math.max(10, Math.min(1000, value));
    setScrollback(next);
    localStorage.setItem('dmxMonitorScrollback', next.toString());
    setEditingScrollback(false);
  };

  const monitorClasses = [
    styles.midiMonitor,
    isCollapsed ? styles.collapsed : '',
    flashActive ? styles.flash : '',
    footerDocked ? 'footerDockedMonitor' : '',
  ].filter(Boolean).join(' ');

  return (
    <ResizableFloatingPanel
      storageKey="artbastard.dmxMonitor.size"
      defaultWidth={500}
      defaultHeight={300}
      minWidth={320}
      maxWidth={640}
      minHeight={120}
      maxHeight={480}
      anchor="top-right"
      className={monitorClasses}
      style={footerDocked
        ? {
            left: 'auto',
            right: '260px',
            top: 'auto',
            bottom: '96px',
            width: '400px',
            height: '270px',
          }
        : isCollapsed ? { width: 'auto', height: 'auto' } : undefined}
    >
      <div className={styles.monitorInner}>
        <div className={`${styles.header} handle`}>
          <span className={styles.title}>
            DMX Activity
            <span className={styles.scrollbackSetting}>
              {editingScrollback ? (
                <input
                  type="number"
                  min="10"
                  max="1000"
                  value={scrollback}
                  onChange={(e) => handleScrollbackChange(parseInt(e.target.value, 10) || 100)}
                  onBlur={() => setEditingScrollback(false)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleScrollbackChange(parseInt(e.currentTarget.value, 10) || 100);
                    } else if (e.key === 'Escape') {
                      setEditingScrollback(false);
                    }
                  }}
                  className={styles.scrollbackInput}
                  autoFocus
                />
              ) : (
                <span
                  className={styles.scrollbackValue}
                  onClick={() => setEditingScrollback(true)}
                  title="Click to edit scrollback"
                >
                  {scrollback}
                </span>
              )}
            </span>
          </span>
          <span className={styles.status}>
            {messages.length} rows{isPaused ? ' (paused)' : ''}
          </span>
          <span className={styles.controls}>
            <button onClick={() => setAutoScroll(!autoScroll)} className={autoScroll ? styles.active : ''} title="Auto-scroll">
              <LucideIcon name="ArrowDown" size={14} />
            </button>
            <button onClick={() => setIsPaused(!isPaused)} className={isPaused ? styles.active : ''} title={isPaused ? 'Resume' : 'Pause'}>
              <LucideIcon name={isPaused ? 'Play' : 'Pause'} size={14} />
            </button>
            <button onClick={clearMessages} title="Clear messages">
              <LucideIcon name="Trash2" size={14} />
            </button>
            <button onClick={() => setCollapsedByUser(!isCollapsed)} title={isCollapsed ? 'Expand' : 'Collapse'}>
              <LucideIcon name={isCollapsed ? 'ChevronUp' : 'ChevronDown'} size={14} />
            </button>
            <button onClick={handleDismiss} title="Dismiss monitor" className={styles.dismissButton}>
              <LucideIcon name="X" size={14} />
            </button>
          </span>
        </div>

        {!isCollapsed && (
          <>
            {lastApc40Change && (
              <div
                className={dmxStyles.lastApc40Context}
                title={lastApc40Change.detail ?? lastApc40Change.summary}
              >
                <span>Last APC40 {lastApc40Change.category}</span>
                <b>{lastApc40Change.summary}</b>
              </div>
            )}
            <div ref={contentRef} className={styles.content}>
              {displayedMessages.length === 0 ? (
                <div className={styles.noData}>Waiting for DMX changes...</div>
              ) : (
                displayedMessages.map((msg) => (
                  <div key={msg.id} className={styles.messageRow}>
                    <div className={styles.messageRowMain}>
                      <span className={dmxStyles.timestamp}>{new Date(msg.timestamp).toLocaleTimeString()}</span>
                      <span className={styles.type}>DMX</span>
                      <span className={styles.channel}>CH {msg.channel + 1}</span>
                      <span className={dmxStyles.dmxValue}>
                        {msg.summary}
                      </span>
                      {msg.repeatCount > 1 && (
                        <span
                          className={dmxStyles.repeatBadge}
                          title={`This channel changed ${msg.repeatCount} times since ${new Date(msg.firstTimestamp).toLocaleTimeString()}`}
                        >
                          x{msg.repeatCount}
                        </span>
                      )}
                    </div>
                    <div className={dmxStyles.detail}>{msg.detail}</div>
                  </div>
                ))
              )}
            </div>

            <div className={dmxStyles.footer}>
              <label>
                <input
                  type="checkbox"
                  checked={autoScroll}
                  onChange={(e) => setAutoScroll(e.target.checked)}
                />
                Auto-scroll
              </label>
            </div>
          </>
        )}
      </div>
    </ResizableFloatingPanel>
  );
};

export default DmxMonitor;
