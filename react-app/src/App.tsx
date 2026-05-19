import React, { useEffect, useState } from 'react'
import { Layout } from './components/layout/Layout'
import { ThemeProvider } from './context/ThemeContext'
import { SocketProvider } from './context/SocketContext'
import { DockingProvider } from './context/DockingContext'
import { PinningProvider } from './context/PinningContext'
import { SuperControlPreferencesProvider } from './context/SuperControlPreferencesContext'
import { useSceneTransitionAnimation } from './hooks/useSceneTransitionAnimation'
import { useGlobalMidiManager } from './hooks/useGlobalMidiManager'
import { useGlobalBrowserMidi } from './hooks/useGlobalBrowserMidi'
import { useActsPlaybackEngine } from './hooks/useActsPlaybackEngine'
import { useActsOscProcessor } from './hooks/useActsOscProcessor'
import { useActsMidiProcessor } from './hooks/useActsMidiProcessor'
import { useTimelinePlayback } from './hooks/useTimelinePlayback'
import { useSceneTimelinePlayback } from './hooks/useSceneTimelinePlayback'
import { useClipLauncher } from './hooks/useClipLauncher'
import { useGlobalMonitoring } from './hooks/useMonitoring'
import { MidiDmxProcessor } from './components/midi/MidiDmxProcessor'
import { OscDmxProcessor } from './components/midi/OscDmxProcessor'
import { ToastContainer } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'
import MobilePage from './pages/MobilePage'
import { FactoryResetBanner } from './components/layout/FactoryResetBanner'

/**
 * Pick a toast container position that does not overlap the new
 * MobileTopBar / safe-area chrome. We resolve once at module load
 * and again on resize via React state in the App component.
 */
const resolveToastPosition = (): 'top-right' | 'bottom-center' => {
  if (typeof window === 'undefined') return 'top-right'
  try {
    // Matches the canonical TABLET_BP from useMobile.ts so the toast
    // strip moves to the bottom-centre on every device that gets the
    // mobile chrome (phones, iPad portrait/landscape, small touch
    // laptops). Anything wider gets the desktop top-right stack.
    return window.matchMedia('(max-width: 1279px)').matches
      ? 'bottom-center'
      : 'top-right'
  } catch {
    return 'top-right'
  }
}

// Capture the URL hash exactly once at module load so that React strict
// mode remounts and the SPA's own hash updates (RouterContext rewrites
// the hash whenever currentView changes) do not accidentally re-classify
// the SPA as the standalone Mobile popup window.
const initialHashAtLoad = typeof window !== 'undefined' ? window.location.hash : ''
const initialIsMobilePopup =
  initialHashAtLoad === '#/mobile' || initialHashAtLoad === '#mobile'

function App() {
  const isMobilePage = initialIsMobilePopup

  const [toastPosition, setToastPosition] = useState(resolveToastPosition())
  useEffect(() => {
    const handleResize = () => setToastPosition(resolveToastPosition())
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])
  
  // Initialize global monitoring
  useGlobalMonitoring();
  
  // Initialize scene transition animation
  useSceneTransitionAnimation();
  
  // Initialize global MIDI manager to persist across all pages
  useGlobalMidiManager();
  
  // Initialize global browser MIDI manager to persist across all pages
  useGlobalBrowserMidi();
  
  // Initialize ACTS playback engine
  useActsPlaybackEngine();
  
  // Initialize ACTS OSC and MIDI processors
  useActsOscProcessor();
  useActsMidiProcessor();
  
  // Initialize timeline playback engine
  useTimelinePlayback();
  
  // Initialize scene timeline playback engine
  useSceneTimelinePlayback();
  
  // Initialize clip launcher playback
  useClipLauncher();
  
  // If this is the Mobile page, render it standalone
  if (isMobilePage) {
    return (
      <ThemeProvider>
        <SocketProvider>
          <DockingProvider>
            <PinningProvider>
              <SuperControlPreferencesProvider>
                <MidiDmxProcessor />
                <OscDmxProcessor />
                <MobilePage />
                  <ToastContainer
                    position="bottom-center"
                    autoClose={3000}
                    hideProgressBar={false}
                    newestOnTop={false}
                    closeOnClick
                    rtl={false}
                    pauseOnFocusLoss
                    draggable
                    pauseOnHover
                    theme="dark"
                  />
              </SuperControlPreferencesProvider>
            </PinningProvider>
          </DockingProvider>
        </SocketProvider>
      </ThemeProvider>
    );
  }
  
  // Normal app layout
  return (
    <ThemeProvider>
      <SocketProvider>
        <DockingProvider>
            <PinningProvider>
              <SuperControlPreferencesProvider>
                {/* Global MIDI processor - processes MIDI messages into DMX channel updates */}
                <MidiDmxProcessor />
                {/* Global OSC processor - processes OSC messages into DMX channel updates */}
                <OscDmxProcessor />
                <FactoryResetBanner />
                <Layout />
                <ToastContainer
                  position={toastPosition}
                  autoClose={3000}
                  hideProgressBar={false}
                  newestOnTop={false}
                  closeOnClick
                  rtl={false}
                  pauseOnFocusLoss
                  draggable
                  pauseOnHover
                  theme="dark"
                />
              </SuperControlPreferencesProvider>
          </PinningProvider>
        </DockingProvider>
      </SocketProvider>
    </ThemeProvider>
  );
}

export default App