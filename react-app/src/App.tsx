import React, { useEffect, useState } from 'react'
import { Layout } from './components/layout/Layout'
import { ThemeProvider } from './context/ThemeContext'
import { SocketProvider } from './context/SocketContext'
import { PanelProvider } from './context/PanelContext'
import { DockingProvider } from './context/DockingContext'
import { PinningProvider } from './context/PinningContext'
import { ChromaticEnergyManipulatorProvider } from './context/ChromaticEnergyManipulatorContext'
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
import ExternalConsolePage from './pages/ExternalConsolePage'
import MobilePage from './pages/MobilePage'

function App() {
  // Check if this is the External Console page (opened in new window)
  const isExternalConsole = window.location.hash === '#/external-console' || 
                            window.location.hash === '#external-console';
  
  // Check if this is the Mobile page (opened in new window)
  const isMobilePage = window.location.hash === '#/mobile' || 
                       window.location.hash === '#mobile';
  
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
  
  // If this is the External Console, render it standalone
  if (isExternalConsole) {
    return (
      <ThemeProvider>
        <SocketProvider>
          <PanelProvider>
            <DockingProvider>
              <PinningProvider>
                <ChromaticEnergyManipulatorProvider>
                  <MidiDmxProcessor />
                  <OscDmxProcessor />
                  <ExternalConsolePage />
                  <ToastContainer 
                    position="top-right"
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
                </ChromaticEnergyManipulatorProvider>
              </PinningProvider>
            </DockingProvider>
          </PanelProvider>
        </SocketProvider>
      </ThemeProvider>
    );
  }
  
  // If this is the Mobile page, render it standalone
  if (isMobilePage) {
    return (
      <ThemeProvider>
        <SocketProvider>
          <PanelProvider>
            <DockingProvider>
              <PinningProvider>
                <ChromaticEnergyManipulatorProvider>
                  <MidiDmxProcessor />
                  <OscDmxProcessor />
                  <MobilePage />
                  <ToastContainer 
                    position="top-center"
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
                </ChromaticEnergyManipulatorProvider>
              </PinningProvider>
            </DockingProvider>
          </PanelProvider>
        </SocketProvider>
      </ThemeProvider>
    );
  }
  
  // Normal app layout
  return (
    <ThemeProvider>
      <SocketProvider>
        <PanelProvider>
          <DockingProvider>
            <PinningProvider>
              <ChromaticEnergyManipulatorProvider>
                {/* Global MIDI processor - processes MIDI messages into DMX channel updates */}
                <MidiDmxProcessor />
                {/* Global OSC processor - processes OSC messages into DMX channel updates */}
                <OscDmxProcessor />
                <Layout />
                <ToastContainer 
                  position="top-right"
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
              </ChromaticEnergyManipulatorProvider>
            </PinningProvider>
          </DockingProvider>
        </PanelProvider>
      </SocketProvider>
    </ThemeProvider>
  );
}

export default App