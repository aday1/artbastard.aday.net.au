import { useEffect } from 'react'
import { useStore, actions, connectSocket } from './state'
import { autoInitMidi } from './midi'
import { TopBar, NavRail, ToastHost } from './components/shell'
import { ChannelsView } from './components/ChannelsView'
import { FixturesView } from './components/FixturesView'
import { ScenesView } from './components/ScenesView'
import { ActsView } from './components/ActsView'
import { MidiView } from './components/MidiView'
import { OscView } from './components/OscView'
import { SettingsView } from './components/SettingsView'
import type { Tab } from './state'

const TAB_KEYS: Record<string, Tab> = {
  '1': 'channels', '2': 'fixtures', '3': 'scenes', '4': 'acts', '5': 'midi', '6': 'osc', '7': 'settings',
}

function isTyping(): boolean {
  const el = document.activeElement
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'SELECT' || el.tagName === 'TEXTAREA')
}

export default function App() {
  const tab = useStore((s) => s.tab)
  const connected = useStore((s) => s.connected)

  useEffect(() => {
    connectSocket()
    autoInitMidi()

    const onKeyDown = (e: KeyboardEvent) => {
      if (isTyping() || e.repeat || e.ctrlKey || e.metaKey || e.altKey) {
        if (e.key === 'Escape') (document.activeElement as HTMLElement | null)?.blur()
        return
      }
      const t = TAB_KEYS[e.key]
      if (t) { actions.setTab(t); return }
      if (e.key === 'b' || e.key === 'B') actions.toggleBlackout()
      if (e.key === 'f' || e.key === 'F') actions.flash(true)
      if (e.key === 's' || e.key === 'S') actions.quickSaveScene()
      if (e.key === 'Escape') actions.clearSelection()
    }
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'f' || e.key === 'F') actions.flash(false)
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [])

  return (
    <div className="shell">
      <TopBar />
      <div className="main">
        <NavRail />
        <main className="view">
          {!connected && (
            <div className="panel" style={{ marginBottom: 12, borderColor: 'var(--danger)' }}>
              <strong style={{ color: 'var(--danger)' }}>Reconnecting to server…</strong>
              <span className="muted" style={{ marginLeft: 8 }}>controls are paused until the link is back</span>
            </div>
          )}
          {tab === 'channels' && <ChannelsView />}
          {tab === 'fixtures' && <FixturesView />}
          {tab === 'scenes' && <ScenesView />}
          {tab === 'acts' && <ActsView />}
          {tab === 'midi' && <MidiView />}
          {tab === 'osc' && <OscView />}
          {tab === 'settings' && <SettingsView />}
        </main>
      </div>
      <ToastHost />
    </div>
  )
}
