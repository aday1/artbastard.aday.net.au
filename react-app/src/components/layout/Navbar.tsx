import React, { useState, useEffect } from 'react'
import { useTheme } from '../../context/ThemeContext'
import { useStore } from '../../store'
import { useSocket } from '../../context/SocketContext'
import { useBrowserMidi } from '../../hooks/useBrowserMidi'
import styles from './Navbar.module.scss'
import { LucideIcon } from '../ui/LucideIcon'
import * as Icons from 'lucide-react'
import { ViewType } from '../../context/RouterContext'
import { useRouter } from '../../context/RouterContext'
import { toast } from 'react-toastify'
import { NAV_ITEMS as SHARED_NAV_ITEMS, NavItem } from './navItems'
import { openMobileSurface } from '../../utils/openPopupSurface'

// Active navigation items used by both desktop sidebar and drawer.
const navItems: NavItem[] = SHARED_NAV_ITEMS
const NAVBAR_COLLAPSED_KEY = 'artbastard.navbar.collapsed.v1'

export interface NavbarProps {
  /**
   * `sidebar` (default) - desktop floating top navigation strip.
   * `drawer`            - simplified vertical list rendered inside a
   *                       Drawer panel; no per-item status indicators,
   *                       no popup window launchers, no collapse toggle.
   */
  variant?: 'sidebar' | 'drawer'
  /**
   * Called when an item is selected in drawer mode so the parent can
   * close its drawer.
   */
  onItemSelected?: () => void
}

export const Navbar: React.FC<NavbarProps> = ({ variant = 'sidebar', onItemSelected }) => {
  const { theme, setTheme } = useTheme()
  const { currentView, setCurrentView } = useRouter()
  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.localStorage.getItem(NAVBAR_COLLAPSED_KEY) === '1'
  })
  const navVisibility = useStore((state) => state.navVisibility)
  const { connected } = useSocket()
  const { activeBrowserInputs } = useBrowserMidi()
  const midiMessages = useStore(state => state.midiMessages)
  const dmxChannels = useStore(state => state.dmxChannels)
  const channelNames = useStore(state => state.channelNames)
  const [midiActivity, setMidiActivity] = useState(false)
  const [dmxActivity, setDmxActivity] = useState(false)

  // Get active channels (channels with value > 0)
  const activeChannels = React.useMemo(() => {
    if (!dmxChannels) return [];
    return dmxChannels
      .map((value, index) => value > 0 ? index : -1)
      .filter(index => index !== -1)
      .slice(0, 10); // Show max 10 active channels
  }, [dmxChannels]);

  // Flash MIDI indicator on new messages
  useEffect(() => {
    if (midiMessages && midiMessages.length > 0) {
      setMidiActivity(true);
      const timer = setTimeout(() => setMidiActivity(false), 300);
      return () => clearTimeout(timer);
    }
  }, [midiMessages]);

  // Monitor DMX activity
  useEffect(() => {
    if (dmxChannels && dmxChannels.some(value => value > 0)) {
      setDmxActivity(true);
      const timer = setTimeout(() => setDmxActivity(false), 1000);
      return () => clearTimeout(timer);
    }
  }, [dmxChannels]);

  const handleViewChange = (view: ViewType) => {
    // Drawer variant always navigates in-place. Popups are blocked on
    // mobile Safari and feel hostile on tablet anyway.
    if (variant === 'drawer') {
      if (view === 'mobile') {
        setCurrentView('mobile')
        onItemSelected?.()
        return
      }
      setCurrentView(view)
      onItemSelected?.()
      return
    }

    if (view === 'mobile') {
      const result = openMobileSurface()
      if (result.kind === 'window' && result.window) {
        const mobileWindow = result.window
        setTimeout(() => {
          try {
            mobileWindow.postMessage({ type: 'switchTab', tab: 'dmx' }, window.location.origin)
          } catch {
            // Popup closed or cross-origin; ignore.
          }
        }, 500)
        return
      }
      if (result.kind === 'tab') {
        toast.info('Pop-up blocked. Touch surface opened in a new tab.')
        return
      }
      if (result.kind === 'same-tab') {
        toast.info('Pop-ups are blocked. Opening the touch surface in this tab.')
        return
      }
    }

    setCurrentView(view)
  }

  const toggleCollapse = () => {
    setIsCollapsed(!isCollapsed)
  }

  useEffect(() => {
    window.localStorage.setItem(NAVBAR_COLLAPSED_KEY, isCollapsed ? '1' : '0')
  }, [isCollapsed])

  useEffect(() => {
    if (isCollapsed) {
      document.body.classList.add('navbar-is-collapsed')
    } else {
      document.body.classList.remove('navbar-is-collapsed')
    }
    // Cleanup function to remove the class if the component unmounts
    return () => {
      document.body.classList.remove('navbar-is-collapsed')
    }
  }, [isCollapsed])

  if (!navVisibility) { // Assuming navVisibility from store can hide the whole navbar
    return null
  }

  // Drawer variant - simplified vertical list rendered inside a Drawer.
  // No sidebar collapse, no per-item status indicators, no popups.
  if (variant === 'drawer') {
    return (
      <nav className={styles.drawerNav} aria-label="Primary navigation">
        <ul className={styles.drawerNavList}>
          {navItems.map((item) => {
              const active = currentView === item.id
              const labelText =
                item.title[theme as keyof typeof item.title] ?? item.title.standard
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    className={`${styles.drawerNavItem} ${active ? styles.drawerNavItemActive : ''}`}
                    onClick={() => handleViewChange(item.id)}
                  >
                    <span className={styles.drawerNavIcon} aria-hidden="true">
                      <LucideIcon name={item.icon as keyof typeof Icons} size={20} />
                    </span>
                    <span className={styles.drawerNavText}>
                      <span className={styles.drawerNavTitle}>{labelText}</span>
                      {item.title.tooltip && (
                        <span className={styles.drawerNavDesc}>{item.title.tooltip}</span>
                      )}
                    </span>
                    {active && <LucideIcon name="Check" size={16} />}
                  </button>
                </li>
              )
            })}
        </ul>

        <div className={styles.drawerNavSection}>
          <button
            type="button"
            onClick={() => {
              const event = new CustomEvent('resetLayout')
              window.dispatchEvent(event)
              localStorage.removeItem('midiMonitorDismissed')
              localStorage.removeItem('oscMonitorDismissed')
              localStorage.removeItem('fancyQuotesDismissed')
              onItemSelected?.()
            }}
            className={styles.drawerNavItem}
          >
            <span className={styles.drawerNavIcon} aria-hidden="true">
              <LucideIcon name="RotateCcw" size={20} />
            </span>
            <span className={styles.drawerNavText}>
              <span className={styles.drawerNavTitle}>Reset layout</span>
              <span className={styles.drawerNavDesc}>
                Restore dismissed monitors and panels.
              </span>
            </span>
          </button>
        </div>
      </nav>
    )
  }

  return (
    <div className={`${styles.navbarContainer} ${isCollapsed ? styles.navBarCollapsedState : ''}`}>
      <button
        onClick={toggleCollapse}
        className={styles.collapseToggle}
        title={isCollapsed ? 'Expand Navigation' : 'Collapse Navigation'}
      >
        <LucideIcon name={isCollapsed ? 'ChevronDown' : 'ChevronUp'} />
      </button>

      <div className={`${styles.navContent} ${isCollapsed ? styles.navContentCollapsed : ''}`}>
        <div className={styles.navButtons}>
          {navItems.map((item) => (
            <div key={item.id} className={styles.navItemContainer}>
              <button
                onClick={() => handleViewChange(item.id)}
                className={`${styles.navButton} ${currentView === item.id ? styles.active : ''}`}
                title={item.title.tooltip || item.title[theme as keyof typeof item.title]}
                data-tooltip={item.title.tooltip}
              >
                <LucideIcon name={item.icon as keyof typeof Icons} />
                <span>{item.title[theme as keyof typeof item.title]}</span>
              </button>

              {/* Status indicators under each menu item */}
              {!isCollapsed && (
                <div className={styles.itemStatusIndicators}>
                  {item.id === 'dmxControl' && (
                    <>
                      <div
                        className={`${styles.itemStatusIcon} ${connected ? styles.statusOk : styles.statusError}`}
                        title={connected ? 'Connected to server' : 'Disconnected from server'}
                      >
                        <LucideIcon name={connected ? 'Wifi' : 'WifiOff'} />
                        <span className={styles.itemStatusLabel}>
                          {connected ? 'Connected' : 'Disconnected'}
                        </span>
                      </div>
                      <div
                        className={`${styles.itemStatusIcon} ${dmxActivity ? styles.statusActive : styles.statusNeutral}`}
                        title={`DMX Output ${dmxActivity ? '(active)' : '(idle)'}`}
                      >
                        <LucideIcon name="Lightbulb" />
                        <span className={styles.itemStatusLabel}>
                          DMX {dmxActivity ? '(Active)' : '(Idle)'}
                        </span>
                      </div>
                      {/* Active Channels Indicator */}
                      {!isCollapsed && activeChannels.length > 0 && (
                        <div className={styles.activeChannelsIndicator}>
                          <div className={styles.channelsGrid}>
                            {activeChannels.map(channelIndex => {
                              const value = dmxChannels[channelIndex] || 0;
                              const intensity = value / 255;
                              const channelName = channelNames[channelIndex] || `CH ${channelIndex + 1}`;
                              return (
                                <div
                                  key={channelIndex}
                                  className={styles.channelDot}
                                  style={{
                                    opacity: 0.4 + (intensity * 0.6),
                                    backgroundColor: `hsl(${(channelIndex * 137.5) % 360}, 70%, ${50 + (intensity * 30)}%)`,
                                    borderColor: `rgba(255, 255, 255, ${0.2 + (intensity * 0.3)})`
                                  }}
                                  title={`${channelName}: ${value} (${Math.round(intensity * 100)}%)`}
                                >
                                  <span className={styles.channelNumber}>{channelIndex + 1}</span>
                                </div>
                              );
                            })}
                            {activeChannels.length === 10 && (
                              <div className={styles.moreIndicator} title="More active channels...">
                                +
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {/* Current View Indicator */}
                  {item.id === currentView && (
                    <div
                      className={`${styles.itemStatusIcon} ${styles.statusHighlight}`}
                      title={`Current View: ${item.title[theme as keyof typeof item.title]}`}
                    >
                      <LucideIcon name="CheckCircle" />
                      <span className={styles.itemStatusLabel}>
                        Active
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
        
        <div className={styles.toolbarExtras}>
          <div className={styles.resetLayoutSection}>
            <button
              type="button"
              onClick={() => {
                const event = new CustomEvent('resetLayout');
                window.dispatchEvent(event);
                localStorage.removeItem('midiMonitorDismissed');
                localStorage.removeItem('oscMonitorDismissed');
                localStorage.removeItem('fancyQuotesDismissed');
              }}
              className={styles.resetLayoutButton}
              title="Reset Layout - Restore dismissed monitors"
            >
              <LucideIcon name="RotateCcw" />
              {!isCollapsed && <span>Reset Layout</span>}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
