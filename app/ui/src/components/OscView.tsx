// OSC: server-side UDP in/out, address map cheat-sheet, live activity log.
import { useStore, actions } from '../state'

export function OscView() {
  const config = useStore((s) => s.config?.osc)
  const listening = useStore((s) => s.oscListening)
  const error = useStore((s) => s.oscError)
  const log = useStore((s) => s.oscLog)

  if (!config) return null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 860 }}>
      <div className="panel">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h3 style={{ margin: 0 }}>OSC input</h3>
          <span className={`led ${config.enabled ? (listening ? 'on' : 'err') : ''}`}>
            <i />{config.enabled ? (listening ? `listening udp/${config.listenPort}` : (error ?? 'not listening')) : 'off'}
          </span>
        </div>
        <div className="row" style={{ marginTop: 10 }}>
          <label className="row" style={{ gap: 6 }}>
            <input type="checkbox" checked={config.enabled} onChange={(e) => actions.setOsc({ enabled: e.target.checked })} />
            Enable
          </label>
          <div className="field">
            <span>Listen port</span>
            <input type="number" defaultValue={config.listenPort} key={`lp-${config.listenPort}`}
              onBlur={(e) => actions.setOsc({ listenPort: Number(e.target.value) || 57121 })} />
          </div>
        </div>
        <p className="muted" style={{ marginBottom: 0 }}>
          Point TouchOSC / QLab / anything at this machine on that UDP port.
        </p>
      </div>

      <div className="panel">
        <h3>OSC output (feedback)</h3>
        <div className="row">
          <label className="row" style={{ gap: 6 }}>
            <input type="checkbox" checked={config.sendEnabled} onChange={(e) => actions.setOsc({ sendEnabled: e.target.checked })} />
            Send channel changes as <span className="mono">/dmx/N</span> (float 0-1)
          </label>
          <div className="field">
            <span>Host</span>
            <input type="text" defaultValue={config.sendHost} key={`sh-${config.sendHost}`} style={{ width: 140 }}
              onBlur={(e) => actions.setOsc({ sendHost: e.target.value })} />
          </div>
          <div className="field">
            <span>Port</span>
            <input type="number" defaultValue={config.sendPort} key={`sp-${config.sendPort}`}
              onBlur={(e) => actions.setOsc({ sendPort: Number(e.target.value) || 57120 })} />
          </div>
        </div>
      </div>

      <div className="panel">
        <h3>Address map</h3>
        <table className="map-table">
          <tbody>
            <tr><td>/dmx/1 … /dmx/512</td><td>set channel · float 0-1 or int 0-255</td></tr>
            <tr><td>/1/dmx1 … (TouchOSC legacy)</td><td>same as above</td></tr>
            <tr><td>/master</td><td>grand master · 0-1</td></tr>
            <tr><td>/blackout</td><td>1 = on, 0 = off</td></tr>
            <tr><td>/scene/1 … /scene/N</td><td>recall scene slot N (on 1)</td></tr>
            <tr><td>/act/1 … /act/N</td><td>1 = play act N, 0 = stop</td></tr>
          </tbody>
        </table>
      </div>

      <div className="panel">
        <h3>Activity</h3>
        {log.length === 0 ? (
          <div className="muted">Incoming OSC shows up here live.</div>
        ) : (
          <div className="osc-log">
            {log.map((entry, i) => (
              <div key={`${entry.at}-${i}`}>
                <span className="addr">{entry.address}</span>
                <span>{entry.args.map((a) => (typeof a === 'number' ? +a.toFixed(3) : a)).join(' ')}</span>
                {entry.mapped && <span className="mapped">→ {entry.mapped}</span>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
