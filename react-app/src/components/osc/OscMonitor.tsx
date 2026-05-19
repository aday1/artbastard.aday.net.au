import React, { useState, useEffect, useRef } from 'react';
// import { motion, useDragControls, PanInfo } from 'framer-motion'; // Removed framer-motion
import { LucideIcon } from '../ui/LucideIcon';
import { useStore } from '../../store';
import styles from './OscMonitor.module.scss';
import { useSocket } from '../../context/SocketContext';
import { OscMessage } from '../../store';

export const OscMonitor: React.FC = () => {
  const oscMessagesFromStore = useStore(state => state.oscMessages);
  const debugTools = useStore(state => state.debugTools);
  const addOscMessageToStore = useStore(state => state.addOscMessage);
  const [lastMessages, setLastMessages] = useState<Array<OscMessage>>([]);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [flashActive, setFlashActive] = useState(false);
  const [hoveredMessage, setHoveredMessage] = useState<OscMessage | null>(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [isPaused, setIsPaused] = useState(false);
  const [scrollback, setScrollback] = useState<number>(() => {
    const saved = localStorage.getItem('oscMonitorScrollback');
    return saved ? parseInt(saved, 10) : 100;
  });
  const [editingScrollback, setEditingScrollback] = useState(false);
  const [isDismissed, setIsDismissed] = useState(() => {
    const saved = localStorage.getItem('oscMonitorDismissed');
    return saved === 'true';
  });
  const [filterHost, setFilterHost] = useState<string>(() => {
    const saved = localStorage.getItem('oscMonitorFilterHost');
    return saved || 'all'; // 'all' means show all hosts
  });
  const [showFilter, setShowFilter] = useState(false);
  const { socket, connected: socketConnected } = useSocket();
  const monitorRef = useRef<HTMLDivElement>(null);

  // Listen for reset layout event
  useEffect(() => {
    const handleResetLayout = () => {
      setIsDismissed(false);
      localStorage.removeItem('oscMonitorDismissed');
    };
    window.addEventListener('resetLayout', handleResetLayout);
    return () => window.removeEventListener('resetLayout', handleResetLayout);
  }, []);

  // Throttling for OSC messages to reduce lag
  const lastOscMessageTimeRef = useRef<number>(0);
  const pendingOscMessageRef = useRef<OscMessage | null>(null);
  const oscThrottleTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const OSC_THROTTLE_MS = 16; // ~60fps for store updates
  const MAX_OSC_MESSAGE_AGE_MS = 50; // Don't process messages older than 50ms

  useEffect(() => {
    if (socket && socketConnected && !isPaused) {
      const handleOscMessage = (message: OscMessage) => {
        const now = Date.now();
        const timeSinceLastMessage = now - lastOscMessageTimeRef.current;
        
        // Always store the latest message
        pendingOscMessageRef.current = message;
        
        // Cancel any existing timeout
        if (oscThrottleTimeoutRef.current) {
          clearTimeout(oscThrottleTimeoutRef.current);
          oscThrottleTimeoutRef.current = null;
        }
        
        // Throttle store updates to reduce re-renders
        if (timeSinceLastMessage >= OSC_THROTTLE_MS) {
          // Time to update - add to store immediately
          addOscMessageToStore(message);
          lastOscMessageTimeRef.current = now;
          pendingOscMessageRef.current = null;
          setFlashActive(true);
          setTimeout(() => setFlashActive(false), 200);
        } else {
          // Too soon - schedule a throttled store update
          oscThrottleTimeoutRef.current = setTimeout(() => {
            const pending = pendingOscMessageRef.current;
            if (pending) {
              // Check message age - don't process if too old
              const messageAge = Date.now() - (pending.timestamp || 0);
              if (messageAge < MAX_OSC_MESSAGE_AGE_MS) {
                addOscMessageToStore(pending);
                lastOscMessageTimeRef.current = Date.now();
                setFlashActive(true);
                setTimeout(() => setFlashActive(false), 200);
              } else {
                // Message too old - discard it
                console.log(`[OscMonitor] Discarding stale OSC message (${messageAge}ms old)`);
              }
              pendingOscMessageRef.current = null;
            }
            oscThrottleTimeoutRef.current = null;
          }, OSC_THROTTLE_MS - timeSinceLastMessage);
        }
      };
      socket.on('oscMessage', handleOscMessage);
      return () => {
        socket.off('oscMessage', handleOscMessage);
        // Cleanup timeout on unmount
        if (oscThrottleTimeoutRef.current) {
          clearTimeout(oscThrottleTimeoutRef.current);
          oscThrottleTimeoutRef.current = null;
        }
        pendingOscMessageRef.current = null;
      };
    }
  }, [socket, socketConnected, addOscMessageToStore, isPaused]);

  const contentRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const lastMessageCountRef = useRef<number>(0);

  // Get unique OSC hosts from messages
  const availableHosts = React.useMemo(() => {
    const hosts = new Set<string>();
    oscMessagesFromStore.forEach(msg => {
      if (msg.source) {
        hosts.add(msg.source);
      } else {
        hosts.add('unknown');
      }
    });
    return Array.from(hosts).sort();
  }, [oscMessagesFromStore]);

  // Update displayed messages based on scrollback setting and filter
  useEffect(() => {
    if (oscMessagesFromStore.length > 0) {
      // Filter by host if filter is set
      let filteredMessages = oscMessagesFromStore;
      if (filterHost !== 'all') {
        filteredMessages = oscMessagesFromStore.filter(msg => {
          const msgHost = msg.source || 'unknown';
          return msgHost === filterHost;
        });
      }
      
      // Show last N messages based on scrollback setting
      const recentMessages = filteredMessages.slice(-scrollback);
      setLastMessages(recentMessages);
    } else {
      setLastMessages([]);
    }
  }, [oscMessagesFromStore, scrollback, filterHost]);

  // Auto-scroll to bottom when new messages arrive (tail -f behavior)
  useEffect(() => {
    const previousMessageCount = lastMessageCountRef.current;
    const hasNewMessages = oscMessagesFromStore.length > previousMessageCount;
    lastMessageCountRef.current = oscMessagesFromStore.length;
    
    if (hasNewMessages && autoScroll && contentRef.current) {
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
    } else if (!autoScroll && hasNewMessages && contentRef.current) {
      // If auto-scroll is disabled but new messages arrived, check if user is near bottom
      // If so, re-enable auto-scroll
      const { scrollTop, scrollHeight, clientHeight } = contentRef.current;
      const isNearBottom = Math.abs(scrollHeight - scrollTop - clientHeight) < 10;
      if (isNearBottom) {
        setAutoScroll(true);
      }
    }
  }, [oscMessagesFromStore.length, autoScroll]);

  const handleDismiss = () => {
    setIsDismissed(true);
    localStorage.setItem('oscMonitorDismissed', 'true');
  };

  const handleMouseEnter = (msg: OscMessage, event: React.MouseEvent) => {
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
    useStore.setState({ oscMessages: [] });
    setLastMessages([]);
    lastMessageCountRef.current = 0;
  };

  const handleScrollbackChange = (value: number) => {
    const newValue = Math.max(10, Math.min(1000, value)); // Limit between 10 and 1000
    setScrollback(newValue);
    localStorage.setItem('oscMonitorScrollback', newValue.toString());
    setEditingScrollback(false);
  };

  const renderHeader = () => (
    <div
      className={`${styles.header} handle`}
      // onPointerDown={(e) => { // Removed onPointerDown
      //   if ((e.target as HTMLElement).closest('button')) {
      //     return;
      //   }
      //   // dragControls.start(e); // Removed dragControls
      // }}
      // style={{ cursor: 'grab' }} // Removed cursor style
    >
      {/* <div className={styles.dragHandle}> // Removed drag handle icon container
        <LucideIcon name="GripVertical" size={18} strokeWidth={1.5} />
      </div> */}
      <span className={styles.title}>
        OSC Monitor
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
                    const saved = localStorage.getItem('oscMonitorScrollback');
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
          <span className={styles.status}>Recent: {oscMessagesFromStore.length}</span>
          {filterHost !== 'all' && (
            <span className={styles.filterBadge} title={`Filtered by: ${filterHost}`}>
              Filter: {filterHost}
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
              title="Filter by OSC host/source"
              className={filterHost !== 'all' ? styles.active : ''}
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
              title={isPaused ? "Resume receiving OSC messages" : "Pause receiving OSC messages"}
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

    if (!socketConnected && lastMessages.length === 0) {
      return (
        <div className={styles.content}>
          <p className={styles.noData}>Socket not connected.</p>
          <p className={styles.noData}>OSC messages will appear here.</p>
        </div>
      );
    }

    if (lastMessages.length === 0) {
      return (
        <div className={styles.content}>
          <p className={styles.noData}>No OSC messages received yet.</p>
          <p className={styles.noData}>Ensure OSC sources are configured and sending data.</p>
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
          // Use a more unique key that includes the index to ensure proper rendering
          const uniqueKey = `${msg.timestamp || Date.now()}-${index}-${msg.address}`;
          return (
            <div
              key={uniqueKey}
              className={styles.messageRow}
              onMouseEnter={(e) => handleMouseEnter(msg, e)}
              onMouseLeave={handleMouseLeave}
            >
            <span className={styles.address}>{msg.address}</span>
            <div className={styles.args}>
              {msg.args.map((arg, argIndex) => (
                <span key={argIndex} className={styles.arg}>
                  {`${arg.type}: ${typeof arg.value === 'number' ? arg.value.toFixed(3) : String(arg.value)}`}
                </span>
              ))}
            </div>
            {msg.source && (
              <span className={styles.source} title={`Source: ${msg.source}`}>
                {msg.source}
              </span>
            )}
            <span className={styles.timestamp}>
              {msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString() : ''}
            </span>
          </div>
          );
        })}
      </div>
    );
  };
  const monitorClasses = [
    styles.oscMonitor,
    flashActive ? styles.flash : '',
    isCollapsed ? styles.collapsed : '',
  ].join(' ');

  // Don't render if oscMonitor is disabled in debugTools or dismissed
  if (!debugTools.oscMonitor || isDismissed) {
    return null;
  }

  return (
    <>
      <div // Changed from motion.div to div
        ref={monitorRef}
        className={monitorClasses}
        style={{ // Removed inline positioning, will be handled by SCSS
          // position: 'fixed',
          // top: initialCssTop,
          // right: initialCssRight,
          zIndex: 1040, // Keep zIndex
          // width: '400px', // Will be in SCSS
          // x: position.x, // Removed
          // y: position.y, // Removed
        }}
        // Removed all drag props
        // drag
        // dragControls={dragControls}
        // dragListener={false}
        // onDragEnd={handleDragEnd}
        // dragConstraints={constraints}
        // whileDrag={{ cursor: 'grabbing' }}
      >
        {renderHeader()}
        {showFilter && !isCollapsed && (
          <div className={styles.filterPanel} onClick={(e) => e.stopPropagation()}>
            <div className={styles.filterHeader}>
              <strong>Filter by OSC Host:</strong>
              <button
                onClick={() => {
                  setFilterHost('all');
                  localStorage.setItem('oscMonitorFilterHost', 'all');
                  setShowFilter(false);
                }}
                className={filterHost === 'all' ? styles.active : ''}
              >
                All Hosts
              </button>
            </div>
            <div className={styles.filterOptions}>
              {availableHosts.length > 0 ? (
                availableHosts.map(host => (
                  <button
                    key={host}
                    onClick={() => {
                      setFilterHost(host);
                      localStorage.setItem('oscMonitorFilterHost', host);
                      setShowFilter(false);
                    }}
                    className={filterHost === host ? styles.active : ''}
                  >
                    {host}
                  </button>
                ))
              ) : (
                <span className={styles.noHosts}>No hosts detected yet</span>
              )}
            </div>
          </div>
        )}
        {renderContent()}
      </div>

      {/* Hover tooltip - position relative to mouse, so should be fine */}
      {hoveredMessage && !isCollapsed && (
        <div
          className={styles.hoverTooltip}
          style={{
            position: 'fixed',
            left: mousePosition.x + 15, // Adjusted for better visibility from cursor
            top: mousePosition.y - 15,  // Adjusted for better visibility from cursor
            zIndex: 10000, // Ensure tooltip is on top
          }}
        >
          <div className={styles.tooltipHeader}>
            <strong>OSC Message Details</strong>
          </div>
          <div className={styles.tooltipContent}>
            <div><strong>Address:</strong> {hoveredMessage.address}</div>
            {hoveredMessage.source && (
              <div><strong>Source:</strong> {hoveredMessage.source}</div>
            )}
            {hoveredMessage.timestamp && (
              <div><strong>Time:</strong> {new Date(hoveredMessage.timestamp).toLocaleString()}</div>
            )}
            <div><strong>Arguments:</strong></div>
            <div className={styles.argsDetail}>
              {hoveredMessage.args.map((arg, index) => (
                <div key={index} className={styles.argDetail}>
                  <span className={styles.argType}>{arg.type}</span>
                  <span className={styles.argValue}>
                    {typeof arg.value === 'number' ?
                      `${arg.value.toFixed(3)} (${(arg.value * 100).toFixed(1)}%)` : // Keep detailed number value
                      String(arg.value)
                    }
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default OscMonitor;