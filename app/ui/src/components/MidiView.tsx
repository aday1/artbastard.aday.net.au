// MIDI: enable, learn any control, manage mappings, one-click APC40 template.
import { useState } from 'react'
import { useStore, actions } from '../state'
import { initMidi, startLearn, cancelLearn, describeTarget, applyApcTemplate, hasApc } from '../midi'
import type { MidiTarget } from '../../../shared/types'

function LearnButton({ target, label }: { target: MidiTarget; label?: string }) {
  return (
    <button className="btn small" onClick={() => startLearn(target)} title="Then move a control on your MIDI device">
      {label ?? 'Learn'}
    </button>
  )
}

export function MidiView() {
  const enabled = useStore((s) => s.midiEnabled)
  const inputs = useStore((s) => s.midiInputs)
  const learn = useStore((s) => s.midiLearn)
  const activity = useStore((s) => s.midiActivity)
  const mappings = useStore((s) => s.config?.midiMappings ?? [])
  const scenes = useStore((s) => s.scenes)
  const acts = useStore((s) => s.acts)
  const groups = useStore((s) => s.groups)
  const [dmxCh, setDmxCh] = useState(1)

  if (!enabled) {
    return (
      <div className="panel" style={{ maxWidth: 560 }}>
        <h3>MIDI</h3>
        <p className="muted">
          Map faders, knobs, and pads on any MIDI controller to channels, scenes, master, blackout and more.
          Works over the browser's Web MIDI (Chrome / Edge).
        </p>
        <button className="btn accent" onClick={() => void initMidi()}>Enable MIDI</button>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 900 }}>
      {learn && (
        <div className="learn-hot">
          <strong>Listening…</strong> move a control on your device to map it to <strong>{learn.label}</strong>
          <button className="btn small" style={{ marginLeft: 'auto' }} onClick={cancelLearn}>Cancel</button>
        </div>
      )}

      <div className="panel">
        <h3>Devices</h3>
        {inputs.length === 0
          ? <div className="muted">No MIDI inputs found. Plug a controller in — it will appear automatically.</div>
          : inputs.map((name) => <div key={name} className="row" style={{ padding: '3px 0' }}><span className="led on"><i /></span>{name}</div>)}
        <div className="muted mono" style={{ marginTop: 8, fontSize: 12 }}>last: {activity ?? '—'}</div>
      </div>

      <div className="panel">
        <h3>APC40</h3>
        <p className="muted" style={{ marginTop: 0 }}>
          One click sets up: 40 clip pads → scene slots 1-40 (with LED feedback), track faders →
          {groups.length > 0 ? ' groups 1-8' : ' DMX ch 1-8'}, master fader → grand master, scene-launch buttons → acts 1-5.
        </p>
        <button className="btn accent" onClick={applyApcTemplate} disabled={!hasApc()}>
          {hasApc() ? 'Apply APC40 template' : 'No APC40 detected'}
        </button>
        {!hasApc() && <span className="muted" style={{ marginLeft: 10, fontSize: 12 }}>connect one and this lights up</span>}
      </div>

      <div className="panel">
        <h3>Learn a control</h3>
        <div className="row" style={{ marginBottom: 8 }}>
          <LearnButton target={{ kind: 'master' }} label="Master" />
          <LearnButton target={{ kind: 'blackout' }} label="Blackout" />
          <LearnButton target={{ kind: 'flash' }} label="Flash" />
          <span className="row" style={{ gap: 4 }}>
            <input type="number" min={1} max={512} value={dmxCh} onChange={(e) => setDmxCh(Number(e.target.value) || 1)} style={{ width: 76 }} />
            <LearnButton target={{ kind: 'dmx', channel: Math.max(1, Math.min(512, dmxCh)) - 1 }} label={`DMX ch ${dmxCh}`} />
          </span>
        </div>
        {scenes.length > 0 && (
          <div className="row" style={{ marginBottom: 8 }}>
            <span className="muted" style={{ width: 60 }}>Scenes:</span>
            {scenes.slice(0, 16).map((s) => <LearnButton key={s.id} target={{ kind: 'scene', sceneId: s.id }} label={s.name} />)}
          </div>
        )}
        {acts.length > 0 && (
          <div className="row" style={{ marginBottom: 8 }}>
            <span className="muted" style={{ width: 60 }}>Acts:</span>
            {acts.slice(0, 8).map((a) => <LearnButton key={a.id} target={{ kind: 'act', actId: a.id }} label={a.name} />)}
          </div>
        )}
        {groups.length > 0 && (
          <div className="row">
            <span className="muted" style={{ width: 60 }}>Groups:</span>
            {groups.slice(0, 8).map((g) => <LearnButton key={g.id} target={{ kind: 'group', groupId: g.id }} label={g.name} />)}
          </div>
        )}
      </div>

      <div className="panel">
        <h3>Mappings ({mappings.length})</h3>
        {mappings.length === 0 ? (
          <div className="muted">Nothing mapped yet.</div>
        ) : (
          <table className="map-table">
            <thead><tr><th>Input</th><th>Target</th><th /></tr></thead>
            <tbody>
              {mappings.map((m) => (
                <tr key={m.id}>
                  <td>{m.kind === 'cc' ? 'CC' : 'Note'} {m.code} · ch {m.midiChannel + 1}</td>
                  <td>{describeTarget(m.target)}</td>
                  <td style={{ textAlign: 'right' }}>
                    <button className="btn small danger" onClick={() => actions.setMidiMappings(mappings.filter((x) => x.id !== m.id))}>✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {mappings.length > 0 && (
          <button className="btn small danger" style={{ marginTop: 10 }}
            onClick={() => { if (window.confirm('Remove all MIDI mappings?')) actions.setMidiMappings([]) }}>
            Clear all
          </button>
        )}
      </div>
    </div>
  )
}
