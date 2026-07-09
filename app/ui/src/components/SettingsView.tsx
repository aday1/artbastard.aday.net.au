// Settings: Art-Net output, shortcuts reference, danger zone.
import { useStore, actions } from '../state'

export function SettingsView() {
  const config = useStore((s) => s.config?.artnet)
  const artnetOk = useStore((s) => s.artnetOk)
  const artnetError = useStore((s) => s.artnetError)
  const version = useStore((s) => s.version)

  if (!config) return null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 720 }}>
      <div className="panel">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h3 style={{ margin: 0 }}>Art-Net output</h3>
          <span className={`led ${config.enabled ? (artnetOk ? 'on' : 'err') : ''}`}>
            <i />{config.enabled ? (artnetOk ? 'sending' : (artnetError ?? 'error')) : 'disabled'}
          </span>
        </div>
        <div className="row" style={{ marginTop: 10 }}>
          <label className="row" style={{ gap: 6 }}>
            <input type="checkbox" checked={config.enabled} onChange={(e) => actions.setArtnet({ enabled: e.target.checked })} />
            Enable
          </label>
          <div className="field" style={{ minWidth: 170 }}>
            <span>Node IP (or broadcast)</span>
            <input type="text" defaultValue={config.ip} key={`ip-${config.ip}`}
              onBlur={(e) => actions.setArtnet({ ip: e.target.value.trim() })} />
          </div>
          <div className="field"><span>Port</span>
            <input type="number" defaultValue={config.port} key={`port-${config.port}`}
              onBlur={(e) => actions.setArtnet({ port: Number(e.target.value) || 6454 })} /></div>
          <div className="field"><span>Net</span>
            <input type="number" min={0} max={127} defaultValue={config.net} key={`net-${config.net}`}
              onBlur={(e) => actions.setArtnet({ net: Number(e.target.value) || 0 })} /></div>
          <div className="field"><span>Subnet</span>
            <input type="number" min={0} max={15} defaultValue={config.subnet} key={`sub-${config.subnet}`}
              onBlur={(e) => actions.setArtnet({ subnet: Number(e.target.value) || 0 })} /></div>
          <div className="field"><span>Universe</span>
            <input type="number" min={0} max={15} defaultValue={config.universe} key={`uni-${config.universe}`}
              onBlur={(e) => actions.setArtnet({ universe: Number(e.target.value) || 0 })} /></div>
        </div>
        <p className="muted" style={{ marginBottom: 0 }}>
          Frames go out at up to 40/s while anything changes, with a keep-alive refresh about once a second.
          Use <span className="mono">255.255.255.255</span> to broadcast to every node on the LAN.
        </p>
      </div>

      <div className="panel">
        <h3>Keyboard shortcuts</h3>
        <table className="map-table">
          <tbody>
            <tr><td className="mono">1 – 7</td><td>switch tabs</td></tr>
            <tr><td className="mono">B</td><td>toggle blackout</td></tr>
            <tr><td className="mono">F (hold)</td><td>flash — full on while held</td></tr>
            <tr><td className="mono">S</td><td>save current look as a scene</td></tr>
            <tr><td className="mono">Esc</td><td>clear channel selection</td></tr>
            <tr><td className="mono">↑ ↓ / wheel</td><td>nudge focused fader (Shift = fine)</td></tr>
          </tbody>
        </table>
      </div>

      <div className="panel">
        <h3>Danger zone</h3>
        <button
          className="btn danger"
          onClick={() => {
            if (window.confirm('Factory reset: delete all fixtures, groups, scenes, acts and MIDI mappings?')) actions.factoryReset()
          }}
        >
          Factory reset
        </button>
        <span className="muted" style={{ marginLeft: 10 }}>Art-Net/OSC settings are kept.</span>
      </div>

      <div className="muted" style={{ fontSize: 12 }}>
        ArtBastard v{version} · DMX512 over Art-Net · data lives in <span className="mono">app/data/state.json</span>
      </div>
    </div>
  )
}
