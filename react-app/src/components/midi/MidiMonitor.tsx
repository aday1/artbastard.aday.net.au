import React, { useState, useEffect, useRef } from 'react';
import { LucideIcon } from '../ui/LucideIcon';
import { useStore } from '../../store';
import styles from './MidiMonitor.module.scss';

export const MidiMonitor: React.FC = () => {
  const { 
    midiMessages, 
    midiMappings, 
    channelNames,
    dmxChannels,
    debugTools 
  } = useStore(state => ({
    midiMessages: state.midiMessages,
    midiMappings: state.midiMappings,
    channelNames: state.channelNames,
    dmxChannels: state.dmxChannels,
    debugTools: state.debugTools
  }));
  const [lastMessages, setLastMessages] = useState<Array<any>>([]);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [flashActive, setFlashActive] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const [hoveredMessage, setHoveredMessage] = useState<any | null>(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [scrollback, setScrollback] = useState<number>(() => {
    const saved = localStorage.getItem('midiMonitorScrollback');
    return saved ? parseInt(saved, 10) : 100;
  });
  const [editingScrollback, setEditingScrollback] = useState(false);
  const [isDismissed, setIsDismissed] = useState(() => {
    const saved = localStorage.getItem('midiMonitorDismissed');
    return saved === 'true';
  });
  const [filterSource, setFilterSource] = useState<string>(() => {
    const saved = localStorage.getItem('midiMonitorFilterSource');
    return saved || 'all'; // 'all' means show all sources
  });
  const [showFilter, setShowFilter] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const monitorRef = useRef<HTMLDivElement>(null);
  const lastMessageCountRef = useRef<number>(0);

  // Listen for reset layout event
  useEffect(() => {
    const handleResetLayout = () => {
      setIsDismissed(false);
      localStorage.removeItem('midiMonitorDismissed');
    };
    window.addEventListener('resetLayout', handleResetLayout);
    return () => window.removeEventListener('resetLayout', handleResetLayout);
  }, []);

  const handleDismiss = () => {
    setIsDismissed(true);
    localStorage.setItem('midiMonitorDismissed', 'true');
  };

  // Find which DMX channel(s) a MIDI message affects
  const getDmxChannelsForMidiMessage = (msg: any): Array<{ channel: number; name: string; value: number }> => {
    const affectedChannels: Array<{ channel: number; name: string; value: number }> = [];
    
    Object.entries(midiMappings).forEach(([dmxChannelStr, mapping]) => {
      if (!mapping) return;
      
      const dmxChannel = parseInt(dmxChannelStr, 10);
      let matches = false;
      
      const msgType = msg.type || msg._type;

      if (msgType === 'cc' && mapping.controller !== undefined) {
        matches = mapping.channel === msg.channel && mapping.controller === msg.controller;
      } else if (msgType === 'noteon' && mapping.note !== undefined) {
        matches = mapping.channel === msg.channel && mapping.note === msg.note;
      } else if (msgType === 'pitch' && mapping.pitch) {
        matches = mapping.channel === msg.channel;
      }
      
      if (matches) {
        const channelName = channelNames[dmxChannel] || `CH ${dmxChannel + 1}`;
        const currentValue = dmxChannels[dmxChannel] || 0;
        affectedChannels.push({
          channel: dmxChannel,
          name: channelName,
          value: currentValue
        });
      }
    });
    
    return affectedChannels;
  };

  // Get unique MIDI sources from messages
  const availableSources = React.useMemo(() => {
    const sources = new Set<string>();
    midiMessages.forEach(msg => {
      if (msg.source) {
        sources.add(msg.source);
      } else {
        sources.add('unknown');
      }
    });
    return Array.from(sources).sort();
  }, [midiMessages]);

  // Update displayed messages based on scrollback setting and filter
  useEffect(() => {
    if (isPaused) {
      // When paused, keep showing the last messages we had - don't update
      return;
    }
    
    // Only update if we have messages or if we need to clear
    if (midiMessages && midiMessages.length > 0) {
      // Filter by source if filter is set
      let filteredMessages = midiMessages;
      if (filterSource !== 'all') {
        filteredMessages = midiMessages.filter(msg => {
          const msgSource = msg.source || 'unknown';
          return msgSource === filterSource;
        });
      }
      
      // Show last N messages based on scrollback setting
      const recentMessages = filteredMessages.slice(-scrollback);
      setLastMessages(recentMessages);
    } else if (midiMessages && midiMessages.length === 0) {
      setLastMessages([]);
    }
  }, [midiMessages, scrollback, isPaused, filterSource]);

  // Auto-scroll to bottom when new messages arrive (tail -f behavior)
  useEffect(() => {
    if (!contentRef.current || isPaused) return;
    
    const previousMessageCount = lastMessageCountRef.current;
    const currentMessageCount = midiMessages.length;
    const hasNewMessages = currentMessageCount > previousMessageCount;
    lastMessageCountRef.current = currentMessageCount;
    
    if (hasNewMessages && autoScroll) {
      // Use multiple strategies to ensure scrolling works
      const scrollToBottom = () => {
        if (contentRef.current) {
          const element = contentRef.current;
          element.scrollTop = element.scrollHeight;
        }
      };
      
      // Immediate scroll
      scrollToBottom();
      
      // Also try after a short delay to catch any DOM updates
      setTimeout(scrollToBottom, 10);
      requestAnimationFrame(() => {
        setTimeout(scrollToBottom, 10);
      });
      
      setFlashActive(true);
      setTimeout(() => setFlashActive(false), 200);
    } else if (!autoScroll && hasNewMessages) {
      // If auto-scroll is disabled but new messages arrived, check if user is near bottom
      // If so, re-enable auto-scroll
      if (contentRef.current) {
        const { scrollTop, scrollHeight, clientHeight } = contentRef.current;
        const isNearBottom = Math.abs(scrollHeight - scrollTop - clientHeight) < 10;
        if (isNearBottom) {
          setAutoScroll(true);
        }
      }
    }
  }, [midiMessages, autoScroll, isPaused]);

  // Don't render if midiMonitor is disabled in debugTools or dismissed
  // This check must come AFTER all hooks to avoid hooks violation
  if (!debugTools.midiMonitor || isDismissed) {
    return null;
  }

  const handleMouseEnter = (msg: any, event: React.MouseEvent) => {
    setHoveredMessage(msg);
    setMousePosition({ x: event.clientX, y: event.clientY });
  };

  const handleMouseMove = (event: React.MouseEvent) => {
    if (hoveredMessage) {
      setMousePosition({ x: event.clientX, y: event.clientY });
    }
  };

  const handleMouseLeave = () => {
    setHoveredMessage(null);
  };

  const scrollToLastMessage = () => {
    if (contentRef.current) {
      const element = contentRef.current;
      element.scrollTop = element.scrollHeight;
      setAutoScroll(true);
    }
  };

  const clearMessages = () => {
    useStore.setState({ midiMessages: [] });
    setLastMessages([]);
    lastMessageCountRef.current = 0;
  };

  const handleScrollbackChange = (value: number) => {
    const newValue = Math.max(10, Math.min(1000, value)); // Limit between 10 and 1000
    setScrollback(newValue);
    localStorage.setItem('midiMonitorScrollback', newValue.toString());
    setEditingScrollback(false);
  };

  const renderHeader = () => (
    <div
      className={`${styles.header} handle`}
    >
      <span className={styles.title}>
        MIDI Monitor
        {!isCollapsed && (
          <span className={styles.scrollbackSetting}>
            {' '}(
            {editingScrollback ? (
              <input
                type="number"
                min="10"
                max="1000"
                value={scrollback}
                onChange={(e) => {
                  const value = parseInt(e.target.value, 10);
                  if (!isNaN(value)) {
                    setScrollback(value);
                  }
                }}
                onBlur={() => handleScrollbackChange(scrollback)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleScrollbackChange(scrollback);
                  } else if (e.key === 'Escape') {
                    setEditingScrollback(false);
                    const saved = localStorage.getItem('midiMonitorScrollback');
                    setScrollback(saved ? parseInt(saved, 10) : 100);
                  }
                }}
                className={styles.scrollbackInput}
                autoFocus
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <span
                className={styles.scrollbackValue}
                onClick={(e) => {
                  e.stopPropagation();
                  setEditingScrollback(true);
                }}
                title="Click to edit scrollback limit"
              >
                {scrollback}
              </span>
            )}
            )
          </span>
        )}
      </span>
      {!isCollapsed && (
        <>
          <span className={styles.status}>Recent: {midiMessages.length}</span>
          {filterSource !== 'all' && (
            <span className={styles.filterBadge} title={`Filtered by: ${filterSource}`}>
              Filter: {filterSource}
            </span>
          )}
        </>
      )}
      <div className={styles.controls}>
        {!isCollapsed && (
          <>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowFilter(!showFilter);
              }}
              onPointerDown={e => e.stopPropagation()}
              title="Filter by MIDI device/source"
              className={filterSource !== 'all' ? styles.active : ''}
            >
              <LucideIcon name="Filter" size={14} strokeWidth={1.5} />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                scrollToLastMessage();
              }}
              onPointerDown={e => e.stopPropagation()}
              title="Go to last received message"
            >
              <LucideIcon name="ArrowDown" size={14} strokeWidth={1.5} />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsPaused(!isPaused);
              }}
              onPointerDown={e => e.stopPropagation()}
              title={isPaused ? "Resume receiving MIDI messages" : "Pause receiving MIDI messages"}
              className={isPaused ? styles.active : ''}
            >
              {isPaused ? (
                <LucideIcon name="Play" size={14} strokeWidth={1.5} />
              ) : (
                <LucideIcon name="Pause" size={14} strokeWidth={1.5} />
              )}
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                clearMessages();
              }}
              onPointerDown={e => e.stopPropagation()}
              title="Clear all messages"
            >
              <LucideIcon name="X" size={14} strokeWidth={1.5} />
            </button>
          </>
        )}
        <button 
          onClick={() => setIsCollapsed(!isCollapsed)} 
          onPointerDown={e => e.stopPropagation()}
          title={isCollapsed ? "Expand" : "Minimize"}
        >
          {isCollapsed ? 
            <LucideIcon name="ChevronUp" size={14} strokeWidth={1.5} /> : 
            <LucideIcon name="ChevronDown" size={14} strokeWidth={1.5} />
          }
        </button>
        <button 
          onClick={handleDismiss} 
          onPointerDown={e => e.stopPropagation()}
          title="Dismiss (use Reset Layout to restore)"
          className={styles.dismissButton}
        >
          <LucideIcon name="X" size={14} strokeWidth={1.5} />
        </button>
      </div>
    </div>
  );

  const renderContent = () => {
    if (isCollapsed) {
      return null;
    }

    if (lastMessages.length === 0) {
      return (
        <div className={styles.content}>
          <p className={styles.noData}>No MIDI messages received yet.</p>
          <p className={styles.noData}>Try moving controls on your MIDI device.</p>
        </div>
      );
    }

    return (
      <div 
        ref={contentRef}
        className={styles.content}
        onMouseMove={handleMouseMove}
        onScroll={() => {
          // Disable auto-scroll if user manually scrolls up
          if (contentRef.current) {
            const { scrollTop, scrollHeight, clientHeight } = contentRef.current;
            // More accurate check: if within 5px of bottom, consider it at bottom
            const isAtBottom = Math.abs(scrollHeight - scrollTop - clientHeight) < 5;
            setAutoScroll(isAtBottom);
          }
        }}
      >
        {lastMessages.map((msg, index) => {
          const affectedDmxChannels = getDmxChannelsForMidiMessage(msg);
          // Use a more unique key that includes the index to ensure proper rendering
          const msgType = msg.type || msg._type;
          const uniqueKey = `${msg.timestamp || Date.now()}-${index}-${msgType}-${msg.channel}-${msg.controller || msg.note || ''}`;
          
          return (
            <div
              key={uniqueKey}
              className={styles.messageRow}
              onMouseEnter={(e) => handleMouseEnter(msg, e)}
              onMouseLeave={handleMouseLeave}
            >
              <div className={styles.messageRowMain}>
                {(msg.type || msg._type) === 'cc' && (
                  <>
                    <span className={styles.type}>CC</span>
                    <span className={styles.channel}>Ch {msg.channel + 1}</span>
                    <span className={styles.controller}>CC {msg.controller}</span>
                    <span className={styles.value}>{msg.value}</span>
                    <span className={styles.source}>{msg.source}</span>
                  </>
                )}
                {(msg.type || msg._type) === 'noteon' && (
                  <>
                    <span className={styles.type}>Note</span>
                    <span className={styles.channel}>Ch {msg.channel + 1}</span>
                    <span className={styles.note}>Note {msg.note}</span>
                    <span className={styles.velocity}>Vel {msg.velocity}</span>
                    <span className={styles.source}>{msg.source}</span>
                  </>
                )}
                {(msg.type || msg._type) === 'pitch' && (
                  <>
                    <span className={styles.type}>Pitch</span>
                    <span className={styles.channel}>Ch {msg.channel + 1}</span>
                    <span className={styles.value}>Value {msg.value}</span>
                    <span className={styles.source}>{msg.source}</span>
                  </>
                )}
                {(msg.type || msg._type) !== 'cc' && (msg.type || msg._type) !== 'noteon' && (msg.type || msg._type) !== 'pitch' && (
                  <span>Other: {JSON.stringify(msg)}</span>
                )}
              </div>
              {affectedDmxChannels.length > 0 && (
                <div className={styles.dmxInfo}>
                  <span className={styles.dmxLabel}>→ DMX:</span>
                  {affectedDmxChannels.map((dmx, idx) => (
                    <span key={idx} className={styles.dmxChannel}>
                      {dmx.name} ({dmx.value})
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const monitorClasses = [
    styles.midiMonitor,
    flashActive ? styles.flash : '',
    isCollapsed ? styles.collapsed : '',
  ].join(' ');

  return (
    <>
      <div
        ref={monitorRef}
        className={monitorClasses}
        style={{
          zIndex: 1050,
        }}
      >
        {renderHeader()}
        {showFilter && !isCollapsed && (
          <div className={styles.filterPanel} onClick={(e) => e.stopPropagation()}>
            <div className={styles.filterHeader}>
              <strong>Filter by MIDI Source:</strong>
              <button
                onClick={() => {
                  setFilterSource('all');
                  localStorage.setItem('midiMonitorFilterSource', 'all');
                  setShowFilter(false);
                }}
                className={filterSource === 'all' ? styles.active : ''}
              >
                All Sources
              </button>
            </div>
            <div className={styles.filterOptions}>
              {availableSources.length > 0 ? (
                availableSources.map(source => (
                  <button
                    key={source}
                    onClick={() => {
                      setFilterSource(source);
                      localStorage.setItem('midiMonitorFilterSource', source);
                      setShowFilter(false);
                    }}
                    className={filterSource === source ? styles.active : ''}
                  >
                    {source}
                  </button>
                ))
              ) : (
                <span className={styles.noSources}>No sources detected yet</span>
              )}
            </div>
          </div>
        )}
        {renderContent()}
      </div>

      {/* Hover tooltip - position relative to mouse */}
      {hoveredMessage && !isCollapsed && (
        <div
          className={styles.hoverTooltip}
          style={{
            position: 'fixed',
            left: mousePosition.x + 15,
            top: mousePosition.y - 15,
            zIndex: 10000,
          }}
        >
          <div className={styles.tooltipHeader}>
            <strong>MIDI Message Details</strong>
          </div>
          <div className={styles.tooltipContent}>
            <div><strong>Type:</strong> {(hoveredMessage.type || hoveredMessage._type)?.toUpperCase() || 'Unknown'}</div>
            <div><strong>Channel:</strong> {hoveredMessage.channel !== undefined ? hoveredMessage.channel + 1 : 'N/A'}</div>
            {(hoveredMessage.type || hoveredMessage._type) === 'cc' && (
              <>
                <div><strong>Controller:</strong> CC {hoveredMessage.controller}</div>
                <div><strong>Value:</strong> {hoveredMessage.value} ({(hoveredMessage.value / 127 * 100).toFixed(1)}%)</div>
              </>
            )}
            {(hoveredMessage.type || hoveredMessage._type) === 'noteon' && hoveredMessage.note !== undefined && (
              <>
                <div><strong>Note:</strong> {hoveredMessage.note} ({typeof hoveredMessage.note === 'number' ? getNoteName(hoveredMessage.note) : 'N/A'})</div>
                <div><strong>Velocity:</strong> {hoveredMessage.velocity} ({(hoveredMessage.velocity / 127 * 100).toFixed(1)}%)</div>
              </>
            )}
            {(hoveredMessage.type || hoveredMessage._type) === 'pitch' && (
              <>
                <div><strong>Pitch:</strong> {hoveredMessage.value}</div>
                <div><strong>Normalized:</strong> {(((hoveredMessage.value || 0) > 127 ? (hoveredMessage.value || 0) / 16383 : (hoveredMessage.value || 0) / 127) * 100).toFixed(1)}%</div>
              </>
            )}
            {hoveredMessage.source && (
              <div><strong>Source:</strong> {hoveredMessage.source}</div>
            )}
            {hoveredMessage.timestamp && (
              <div><strong>Time:</strong> {new Date(hoveredMessage.timestamp).toLocaleString()}</div>
            )}
            {getDmxChannelsForMidiMessage(hoveredMessage).length > 0 && (
              <>
                <div><strong>Affects DMX Channels:</strong></div>
                <div className={styles.argsDetail}>
                  {getDmxChannelsForMidiMessage(hoveredMessage).map((dmx, idx) => (
                    <div key={idx} className={styles.argDetail}>
                      <span className={styles.argType}>{dmx.name}</span>
                      <span className={styles.argValue}>Value: {dmx.value}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
};

// Helper function to get note name from MIDI note number
const getNoteName = (note: number): string => {
  if (typeof note !== 'number' || isNaN(note) || note < 0 || note > 127) {
    return 'N/A';
  }
  const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const octave = Math.floor(note / 12) - 1;
  const noteName = notes[note % 12];
  return `${noteName}${octave}`;
};

export default MidiMonitor;
