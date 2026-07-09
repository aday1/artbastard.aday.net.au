// App shell: top bar (connection, master, blackout), nav rail, toasts.
import { useStore, actions, type Tab } from '../state'
import { Fader } from './controls'

const ICONS: Record<Tab, JSX.Element> = {
  channels: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 4v16M12 4v16M18 4v16" /><circle cx="6" cy="14" r="2.4" fill="currentColor" /><circle cx="12" cy="8" r="2.4" fill="currentColor" /><circle cx="18" cy="16" r="2.4" fill="currentColor" /></svg>,
  fixtures: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 3h6v7a3 3 0 0 1-6 0V3z" /><path d="M12 13v4M8 21h8M12 17l-4 4M12 17l4 4" /></svg>,
  scenes: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="8" height="8" rx="1.5" /><rect x="13" y="3" width="8" height="8" rx="1.5" /><rect x="3" y="13" width="8" height="8" rx="1.5" /><rect x="13" y="13" width="8" height="8" rx="1.5" /></svg>,
  acts: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 4l14 8-14 8V4z" fill="currentColor" stroke="none" /></svg>,
  midi: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9" /><circle cx="12" cy="7" r="1.3" fill="currentColor" /><circle cx="7.5" cy="9.5" r="1.3" fill="currentColor" /><circle cx="16.5" cy="9.5" r="1.3" fill="currentColor" /><circle cx="9" cy="14.5" r="1.3" fill="currentColor" /><circle cx="15" cy="14.5" r="1.3" fill="currentColor" /></svg>,
  osc: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 12h3l3-7 4 14 3-7h7" /></svg>,
  settings: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3" /><path d="M19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.5-2.4 1a7 7 0 0 0-2-1.2L14 3h-4l-.5 2.6a7 7 0 0 0-2 1.2l-2.4-1-2 3.5 2 1.5A7 7 0 0 0 5 12a7 7 0 0 0 .1 1.2l-2 1.5 2 3.5 2.4-1a7 7 0 0 0 2 1.2L10 21h4l.5-2.6a7 7 0 0 0 2-1.2l2.4 1 2-3.5-2-1.5A7 7 0 0 0 19 12z" /></svg>,
}

const TABS: { id: Tab; label: string; key: string }[] = [
  { id: 'channels', label: 'Channels', key: '1' },
  { id: 'fixtures', label: 'Fixtures', key: '2' },
  { id: 'scenes', label: 'Scenes', key: '3' },
  { id: 'acts', label: 'Acts', key: '4' },
  { id: 'midi', label: 'MIDI', key: '5' },
  { id: 'osc', label: 'OSC', key: '6' },
  { id: 'settings', label: 'Setup', key: '7' },
]

const LANE = (() => {
  const host = window.location.hostname
  if (host.includes('-dev')) return 'DEV'
  if (/^(localhost|127\.|192\.168\.|10\.)/.test(host)) return 'LOCAL'
  return 'LIVE'
})()

export function TopBar() {
  const connected = useStore((s) => s.connected)
  const artnetOk = useStore((s) => s.artnetOk)
  const artnetEnabled = useStore((s) => s.config?.artnet.enabled ?? true)
  const master = useStore((s) => s.master)
  const blackout = useStore((s) => s.blackout)

  return (
    <header className="topbar">
      <div className="brand">Art<em>Bastard</em></div>
      <span className={`lane lane-${LANE.toLowerCase()}`}>{LANE}</span>
      <div className="leds">
        <span className={`led ${connected ? 'on' : 'err'}`}><i />srv</span>
        <span className={`led ${!artnetEnabled ? '' : artnetOk ? 'on' : 'err'}`} title={artnetEnabled ? '' : 'Art-Net disabled'}><i />net</span>
      </div>
      <div className="master-wrap">
        <label>Master</label>
        <Fader horizontal value={master} onChange={actions.setMaster} ariaLabel="Grand master" />
        <span className="master-value">{Math.round((master / 255) * 100)}%</span>
      </div>
      <div className="topbar-actions">
        <button
          className="btn"
          onPointerDown={() => actions.flash(true)}
          onPointerUp={() => actions.flash(false)}
          onPointerLeave={() => actions.flash(false)}
          title="Momentary full on (hold) - key: F"
        >
          Flash
        </button>
        <button
          className={`btn btn-blackout${blackout ? ' engaged' : ''}`}
          onClick={actions.toggleBlackout}
          title="Toggle blackout - key: B"
        >
          {blackout ? 'BLACKOUT ●' : 'Blackout'}
        </button>
      </div>
    </header>
  )
}

export function NavRail() {
  const tab = useStore((s) => s.tab)
  return (
    <nav className="nav">
      {TABS.map((t) => (
        <button key={t.id} className={tab === t.id ? 'active' : ''} onClick={() => actions.setTab(t.id)}>
          {ICONS[t.id]}
          <span>{t.label}</span>
          <span className="key-hint">{t.key}</span>
        </button>
      ))}
    </nav>
  )
}

export function ToastHost() {
  const toasts = useStore((s) => s.toasts)
  return (
    <div className="toasts">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.kind}`}>{t.text}</div>
      ))}
    </div>
  )
}
