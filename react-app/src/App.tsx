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
import { useApc40Workflow } from './hooks/useApc40Workflow'
import { useApc40LedFeedback } from './hooks/useApc40LedFeedback'
import { useApc40FlourishOrchestrator } from './hooks/useApc40FlourishOrchestrator'
import { useApc40ScreensaverManager } from './hooks/useApc40ScreensaverManager'
import { useApc40Health } from './hooks/useApc40Health'
import { useActsPlaybackEngine } from './hooks/useActsPlaybackEngine'
import { useActsOscProcessor } from './hooks/useActsOscProcessor'
import { useActsMidiProcessor } from './hooks/useActsMidiProcessor'
import { useTimelinePlayback } from './hooks/useTimelinePlayback'
import { useTransitionTrackerPlayback } from './hooks/useTransitionTrackerPlayback'
import { useAppearanceSync } from './hooks/useAppearanceSync'
import { useSceneTimelinePlayback } from './hooks/useSceneTimelinePlayback'
import { useClipLauncher } from './hooks/useClipLauncher'
import { useGlobalMonitoring } from './hooks/useMonitoring'
import { MidiDmxProcessor } from './components/midi/MidiDmxProcessor'
import { OscDmxProcessor } from './components/midi/OscDmxProcessor'
import { ToastContainer } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'
import MobilePage from './pages/MobilePage'
import { FactoryResetBanner } from './components/layout/FactoryResetBanner'
import { RouterProvider } from './context/RouterContext'
import { ContextMenuProvider } from './context/ContextMenuContext'
import { shouldDefaultToMobileSurface } from './utils/deviceSurface'

/**
 * Pick a toast container position that does not overlap the new
 * MobileTopBar / safe-area chrome. We resolve once at module load
 * and again on resize via React state in the App component.
 */
const resolveToastPosition = (): 'top-right' | 'bottom-center' => {
  if (typeof window === 'undefined') return 'top-right'
  try {
    return shouldDefaultToMobileSurface()
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
  initialHashAtLoad === '#/mobile' ||
  initialHashAtLoad === '#mobile'

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

  // Native Akai APC40/APC40 mkII scene and fixture workflow controls
  useApc40Workflow();
  // Force APC40 into Generic Mode (Mode 1) on connect, listen for SysEx replies.
  useApc40Health();
  // Push LED state back to APC40 so the device surface mirrors scene + selection state.
  useApc40LedFeedback();
  // Fire short LED flourishes on meaningful app events (fixture select, crossfade, blackout, tab change, etc.)
  useApc40FlourishOrchestrator();
  // Run APC40 screensaver patterns while the browser tab is hidden.
  useApc40ScreensaverManager();
  
  // Initialize ACTS playback engine
  useActsPlaybackEngine();
  
  // Initialize ACTS OSC and MIDI processors
  useActsOscProcessor();
  useActsMidiProcessor();
  
  // Initialize timeline playback engine
  useTimelinePlayback();

  // DMX transition pattern tracker (line-stepped scenes + channels)
  useTransitionTrackerPlayback();

  useAppearanceSync();
  
  // Initialize scene timeline playback engine
  useSceneTimelinePlayback();
  
  // Initialize clip launcher playback
  useClipLauncher();
  
  const toast = (
    <ToastContainer
      position={isMobilePage ? 'bottom-center' : toastPosition}
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
  )

  return (
    <ThemeProvider>
      <SocketProvider>
        <DockingProvider>
          <PinningProvider>
            <SuperControlPreferencesProvider>
              <RouterProvider>
                <ContextMenuProvider>
                  <MidiDmxProcessor />
                  <OscDmxProcessor />
                  {isMobilePage ? (
                    <MobilePage />
                  ) : (
                    <>
                      <FactoryResetBanner />
                      <Layout />
                    </>
                  )}
                  {toast}
                </ContextMenuProvider>
              </RouterProvider>
            </SuperControlPreferencesProvider>
          </PinningProvider>
        </DockingProvider>
      </SocketProvider>
    </ThemeProvider>
  )
}

export default App
