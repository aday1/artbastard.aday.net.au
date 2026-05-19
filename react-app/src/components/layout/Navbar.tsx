import React, { useState, useEffect } from 'react'
import { useTheme } from '../../context/ThemeContext'
import { useStore } from '../../store'
import { useSocket } from '../../context/SocketContext'
import { useBrowserMidi } from '../../hooks/useBrowserMidi'
import { DmxChannelStats } from '../dmx/DmxChannelStats'
import styles from './Navbar.module.scss'
import { Sparkles } from './Sparkles'
import { LucideIcon } from '../ui/LucideIcon'
import { ThemeToggleButton } from './ThemeToggleButton'
import * as Icons from 'lucide-react'
import { ViewType } from '../../context/RouterContext'
import { useRouter } from '../../context/RouterContext'

// Updated navigation items with Lucide icon names
const navItems: Array<{
  id: ViewType
  icon: string // Lucide icon name
  title: {
    artsnob: string
    standard: string
    minimal: string
    tooltip?: string // Explanation for the uninitiated
  }
}> = [
    {
      id: 'main',
      icon: 'Layout',
      title: {
        artsnob: "🖥️ Console Externe Élégante™",
        standard: 'External Console',
        minimal: 'Console',
        tooltip: "Opens the External Console in a new window - perfect for tablets and 2nd monitors. Click to open!"
      }
    },
    {
      id: 'dmxControl',
      icon: 'Zap',
      title: {
        artsnob: "⚡ Contrôle DMX Ultime",
        standard: 'DMX Control',
        minimal: 'DMX',
        tooltip: "Direct DMX channel control with MIDI Learn/Forget functionality."
      }
    },
    {
      id: 'fixture',
      icon: 'LampDesk',
      title: {
        artsnob: "💡 Fixture Extraordinaire",
        standard: 'Fixtures',
        minimal: 'Fix',
        tooltip: "Mere light fixtures. *sigh* How pedestrian of you to ask."
      }
    },
    {
      id: 'scenesActs',
      icon: 'Theater',
      title: {
        artsnob: "🎬 Scènes Dramatiques",
        standard: 'Scenes',
        minimal: 'Scenes',
        tooltip: "Create, manage, and orchestrate lighting scenes and automated sequences. The heart of your lighting control."
      }
    },
    {
      id: 'misc',
      icon: 'Settings',
      title: {
        artsnob: "⚙️ Paramètres Cognoscenti",
        standard: 'Settings',
        minimal: 'Cfg',
        tooltip: "Configuration settings. Do try not to strain yourself understanding that, darling."
      }
    },
    {
      id: 'mobile',
      icon: 'Smartphone',
      title: {
        artsnob: "📱 Version Mobile Élégante™",
        standard: 'Mobile Version',
        minimal: 'Mobile',
        tooltip: "Opens the mobile-optimized interface in a new window - perfect for phones and tablets. Touch-optimized controls with large sliders."
      }
    },
    {
      id: 'experimental',
      icon: 'FlaskConical',
      title: {
        artsnob: "🧪 Laboratoire Expérimental",
        standard: 'Experimental',
        minimal: 'Exp',
        tooltip: "Experimental features for the avant-garde. Face tracking and cutting-edge controls. Not for the faint of heart, mon ami."
      }
    },
  ]

export const Navbar: React.FC = () => {
  const { theme, setTheme } = useTheme()
  const { currentView, setCurrentView } = useRouter()
  const [isCollapsed, setIsCollapsed] = useState(false)
  const navVisibility = useStore((state) => state.navVisibility)
  const { connected } = useSocket()
  const { activeBrowserInputs } = useBrowserMidi()
  const midiMessages = useStore(state => state.midiMessages)
  const dmxChannels = useStore(state => state.dmxChannels)
  const channelNames = useStore(state => state.channelNames)
  const uiSettings = useStore(state => state.uiSettings)
  const toggleSparkles = useStore(state => state.toggleSparkles)
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
    // Special handling for External Console - open in new window
    if (view === 'main') {
      const width = 1200;
      const height = 800;
      const left = (window.screen.width - width) / 2;
      const top = (window.screen.height - height) / 2;

      const newWindow = window.open(
        `${window.location.origin}${window.location.pathname}#/external-console`,
        'ExternalConsole',
        `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes,toolbar=no,menubar=no,location=no`
      );

      if (newWindow) {
        // Focus the new window
        newWindow.focus();
      } else {
        // Fallback if popup blocked
        console.warn('Popup blocked. Please allow popups for this site.');
        setCurrentView(view);
      }
    } else if (view === 'mobile') {
      // Special handling for Mobile Version - open in new window optimized for mobile (DMX tab)
      const width = 480;
      const height = 800;
      const left = (window.screen.width - width) / 2;
      const top = (window.screen.height - height) / 2;

      const newWindow = window.open(
        `${window.location.origin}${window.location.pathname}#/mobile`,
        'ArtBastardMobile',
        `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes,toolbar=no,menubar=no,location=no`
      );

      if (newWindow) {
        // Focus the new window
        newWindow.focus();
        // Wait a bit then switch to DMX tab (original mobile version)
        setTimeout(() => {
          newWindow.postMessage({ type: 'switchTab', tab: 'dmx' }, window.location.origin);
        }, 500);
      } else {
        // Fallback if popup blocked
        console.warn('Popup blocked. Please allow popups for this site.');
        setCurrentView(view);
      }
    } else {
      setCurrentView(view);
    }
  }

  const toggleCollapse = () => {
    setIsCollapsed(!isCollapsed)
  }


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

  return (
    <div className={`${styles.navbarContainer} ${isCollapsed ? styles.navBarCollapsedState : ''}`}>
      <button
        onClick={toggleCollapse}
        className={styles.collapseToggle}
        title={isCollapsed ? 'Expand Navigation' : 'Collapse Navigation'}
      >
        <LucideIcon name={isCollapsed ? 'ChevronLeft' : 'ChevronRight'} />
      </button>

      {/* Sparkles component can be placed here if it needs to be part of the main navbar scrollable content */}
      {/* <Sparkles /> */}

      <div className={`${styles.navContent} ${isCollapsed ? styles.navContentCollapsed : ''}`}>
        <div className={styles.navButtons}>
          {navItems.filter((item) => {
            // Hide experimental section if configured to hide
            if (item.id === 'experimental' && uiSettings?.hideExperimentalSection) {
              return false;
            }
            return true;
          }).map((item) => (
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
                  {/* Connection Status for main item */}
                  {item.id === 'main' && (
                    <div
                      className={`${styles.itemStatusIcon} ${connected ? styles.statusOk : styles.statusError}`}
                      title={connected ? 'Connected to server' : 'Disconnected from server'}
                    >
                      <LucideIcon name={connected ? 'Wifi' : 'WifiOff'} />
                      <span className={styles.itemStatusLabel}>
                        {connected ? 'Connected' : 'Disconnected'}
                      </span>
                    </div>
                  )}
                  {/* DMX Activity for dmxControl item */}
                  {item.id === 'dmxControl' && (
                    <>
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
        
        {/* Sparkles Toggle */}
        <div className={styles.resetLayoutSection}>
          <button
            onClick={toggleSparkles}
            className={`${styles.resetLayoutButton} ${uiSettings?.sparklesEnabled ? styles.active : ''}`}
            title={uiSettings?.sparklesEnabled ? 'Disable sparkles' : 'Enable sparkles'}
          >
            <LucideIcon name="Sparkles" />
            {!isCollapsed && <span>{uiSettings?.sparklesEnabled ? 'Sparkles ON' : 'Sparkles OFF'}</span>}
          </button>
        </div>

        {/* Reset Layout Button */}
        <div className={styles.resetLayoutSection}>
          <button
            onClick={() => {
              // Dispatch event to reset monitors and other dismissed elements
              const event = new CustomEvent('resetLayout');
              window.dispatchEvent(event);
              // Also clear any other layout-related localStorage items if needed
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
      {/* If Sparkles is meant to be fixed at the bottom or outside scroll, place it here, relative to navbarContainer */}
      <Sparkles />
    </div>
  )
}