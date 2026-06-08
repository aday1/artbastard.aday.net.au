import React, { useState, useEffect } from 'react'
import { useTheme } from '../../context/ThemeContext'
import { StatusBar } from './StatusBar'
import { Navbar } from './Navbar'
import { PinnedChannels } from './PinnedChannels'
import { ToastContainer } from './ToastContainer'
import { NetworkStatus } from './NetworkStatus'
import { DmxActivityGlow } from './DmxActivityGlow'
import BpmIndicator from '../audio/BpmIndicator'
import SignalFlashIndicator from '../midi/SignalFlashIndicator'
import PageRouter from '../router/PageRouter'
import { useStore } from '../../store'
import { ResetButton } from './ResetButton'
import { ThemeToggleButton } from './ThemeToggleButton'
import { GlobalMonitors } from '../monitors/GlobalMonitors'
import { StateManager } from '../../utils/stateManager'
import { useLocalStorageSync } from '../../hooks/useLocalStorageSync'
import { useSocket } from '../../context/SocketContext'
import { HelpOverlay } from '../ui/HelpOverlay'
import { GettingStartedPanel } from '../onboarding/GettingStartedPanel'
import styles from './Layout.module.scss'
import { LucideIcon } from '../ui/LucideIcon'
import { useMobile } from '../../hooks/useMobile'
import { MobileTopBar } from './MobileTopBar'
import { DeployLaneBadge } from './DeployLaneBadge'
import { useAppContextMenu } from '../../context/ContextMenuContext'
import { SiteBrandingLink } from '../ui/SiteBrandingLink'
import { useRouter } from '../../context/RouterContext'

interface LayoutProps {
  children?: React.ReactNode
}

const LayoutBody: React.FC<LayoutProps> = ({ children }) => {
  const { openAppMenu } = useAppContextMenu()
  const { currentView } = useRouter()
  const { theme, darkMode, toggleDarkMode, setTheme } = useTheme()
  const { 
    // Remove automation-related imports since we're removing transport controls
  } = useStore()
  const [serverAddress, setServerAddress] = useState<string>('localhost:3030');
  const { isMobileOrTablet } = useMobile();
  const isFocusedFixtureRoute = currentView === 'fixture';
  
  // Setup auto-save on exit
  useEffect(() => {
    StateManager.setupAutoSaveOnExit();
  }, []);

  // If a drawer closed without cleanup, body scroll can stay locked.
  useEffect(() => {
    document.body.classList.remove('ab-no-scroll');
    document.documentElement.classList.remove('ab-no-scroll');
  }, []);

  // The fixture setup route is long-form, touch-first patching UI. On mobile and
  // tablet it needs native document scrolling instead of the desktop shell's
  // fixed internal scroller, otherwise phone browsers can feel locked.
  useEffect(() => {
    const shouldUseDocumentScroll = isFocusedFixtureRoute && isMobileOrTablet;
    document.documentElement.classList.toggle('ab-fixture-scroll-page', shouldUseDocumentScroll);
    document.body.classList.toggle('ab-fixture-scroll-page', shouldUseDocumentScroll);

    return () => {
      document.documentElement.classList.remove('ab-fixture-scroll-page');
      document.body.classList.remove('ab-fixture-scroll-page');
    };
  }, [isFocusedFixtureRoute, isMobileOrTablet]);

  // Setup WebSocket localStorage sync
  const { syncAllLocalStorage } = useLocalStorageSync();
  const { socket, connected } = useSocket();
  
  // Sync all localStorage on initial connection
  useEffect(() => {
    if (socket && connected) {
      // Small delay to ensure socket is fully ready
      const timeoutId = setTimeout(() => {
        syncAllLocalStorage();
      }, 1000);
      return () => clearTimeout(timeoutId);
    }
  }, [socket, connected, syncAllLocalStorage]);
  
  // Fetch network IP address
  useEffect(() => {
    if (socket && connected) {
      socket.emit('getNetworkInfo');
      socket.on('networkInfo', (info: any) => {
        if (info && info.primaryHost) {
          const port = info.serverPort || window.location.port || (window.location.protocol === 'https:' ? '443' : '80');
          setServerAddress(`${info.primaryHost}:${port}`);
        } else if (info && info.interfaces && info.interfaces.length > 0) {
          const externalInterface = info.interfaces.find((i: any) => !i.internal);
          if (externalInterface) {
            const port = info.serverPort || window.location.port || (window.location.protocol === 'https:' ? '443' : '80');
            setServerAddress(`${externalInterface.address}:${port}`);
          }
        }
      });
      
      return () => {
        socket.off('networkInfo');
      };
    } else {
      // Fallback to window.location if socket not connected
      setServerAddress(`${window.location.hostname}:${window.location.port || (window.location.protocol === 'https:' ? '443' : '80')}`);
    }
  }, [socket, connected]);
  
  return (
    <>
      <div
        className={[
          'ab-rack',
          styles.layout,
          isFocusedFixtureRoute ? styles.fixtureRoute : '',
          styles[theme],
          darkMode ? styles.dark : styles.light,
          isMobileOrTablet ? styles.layoutMobile : '',
        ]
          .filter(Boolean)
          .join(' ')}
        style={{ fontFeatureSettings: "'liga' 1, 'calt' 1, 'tnum' 1, 'case' 1" }}
        onContextMenu={(e) => {
          const t = e.target as HTMLElement
          if (t.closest('main')) return
          if (t.closest('[data-skip-app-context-menu]')) return
          openAppMenu(e)
        }}
      >
        {/* Global UI Effects */}
        <DmxActivityGlow />
        {/* <BpmIndicator /> */}
        {/* <SignalFlashIndicator position="bottom-left" /> */}

        {/* On mobile/tablet, the sidebars become drawers spawned by the
            MobileTopBar. On desktop, we render them inline. */}
        {isMobileOrTablet ? (
          <MobileTopBar />
        ) : (
          <>
            <PinnedChannels />
          </>
        )}

        <div className={styles.contentWrapper}>
          <div className={styles.mainContent}>
            {!isMobileOrTablet && !isFocusedFixtureRoute && (
              <>
                <h1 className={styles.title}>
                  <SiteBrandingLink brand="artbastard">ArtBastard</SiteBrandingLink>
                  {' '}
                  DMX512FTW:
                  {theme === 'artsnob' && <span>The Luminary Palette</span>}
                  {theme === 'standard' && <span>DMX Controller</span>}
                  {theme === 'minimal' && <span>DMX</span>}
                  <DeployLaneBadge placement="inline" className={styles.titleLaneBadge} />
                </h1>
                <p className={styles.siteCredit}>
                  Part of the{' '}
                  <SiteBrandingLink brand="macroverse">Macroverse</SiteBrandingLink>
                  {' '}suite on{' '}
                  <SiteBrandingLink brand="artbastard">aday.net.au</SiteBrandingLink>
                </p>
                <div className={styles.serverInfo}>{serverAddress}</div>
              </>
            )}

            <main
              className={styles.contentArea}
              onContextMenu={(e) => {
                const t = e.target as HTMLElement
                if (t.closest('[data-skip-app-context-menu]')) return
                openAppMenu(e)
              }}
            >
              <PageRouter />
            </main>

            {!isMobileOrTablet && !isFocusedFixtureRoute && (
              <div className={styles.bottomControls}>
                <ResetButton showLabels={true} />

                {/* Theme Controls */}
                <div className={styles.themeControls}>
                  {/* Language Switcher */}
                  <button
                    onClick={() => {
                      // Toggle between ArtSnob and Standard only
                      setTheme(theme === 'artsnob' ? 'standard' : 'artsnob')
                    }}
                    className={`${styles.themeButton} ${styles[theme]}`}
                    title={`Current: ${theme === 'artsnob' ? 'ArtSnob (French pretentious)' : 'Standard (Normal)'} - Click to switch language`}
                  >
                    <LucideIcon name={theme === 'artsnob' ? 'Languages' : 'Globe'} />
                    <span>{theme === 'artsnob' ? 'ArtSnob' : 'Standard'}</span>
                  </button>

                  {/* Dark/Light Mode Toggle */}
                  <ThemeToggleButton showLabels={true} />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Desktop floating top Navbar; drawer copy is spawned by MobileTopBar. */}
        {!isMobileOrTablet && <Navbar />}
        <ToastContainer />
        {!isMobileOrTablet && <StatusBar />}

        {/* Global floating monitors stay off the fixture patch surface. */}
        {!isFocusedFixtureRoute && <GlobalMonitors />}

        {/* Global Help Overlay - available on all pages */}
        <HelpOverlay />
        <GettingStartedPanel />
      </div>
    </>
  )
}

export const Layout: React.FC<LayoutProps> = (props) => <LayoutBody {...props} />
