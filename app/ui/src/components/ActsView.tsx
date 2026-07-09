// Acts: step sequences of scenes (fade + hold), played back on the server.
import { useState } from 'react'
import { useStore, actions, toast } from '../state'
import type { Act, ActStep } from '../../../shared/types'

const uid = () => `act-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`

export function ActsView() {
  const acts = useStore((s) => s.acts)
  const scenes = useStore((s) => s.scenes)
  const status = useStore((s) => s.actStatus)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const act = acts.find((a) => a.id === selectedId) ?? acts.find((a) => a.id === status.actId) ?? acts[0] ?? null

  const updateAct = (patch: Partial<Act>) => {
    if (!act) return
    actions.setActs(acts.map((a) => (a.id === act.id ? { ...a, ...patch } : a)))
  }
  const updateStep = (i: number, patch: Partial<ActStep>) => {
    if (!act) return
    updateAct({ steps: act.steps.map((s, j) => (j === i ? { ...s, ...patch } : s)) })
  }
  const moveStep = (i: number, dir: -1 | 1) => {
    if (!act) return
    const j = i + dir
    if (j < 0 || j >= act.steps.length) return
    const steps = act.steps.slice()
    ;[steps[i], steps[j]] = [steps[j], steps[i]]
    updateAct({ steps })
  }

  const addAct = () => {
    const name = window.prompt('Act name', `Act ${acts.length + 1}`)
    if (!name) return
    const created: Act = { id: uid(), name, steps: [], loop: true }
    actions.setActs([...acts, created])
    setSelectedId(created.id)
  }

  const addStep = () => {
    if (!act) return
    if (scenes.length === 0) { toast('info', 'Save some scenes first — acts sequence scenes.'); return }
    updateAct({ steps: [...act.steps, { sceneId: scenes[0].id, fadeMs: 1000, holdMs: 2000 }] })
  }

  const isCurrent = (i: number) => status.actId === act?.id && status.stepIndex === i

  return (
    <div className="acts-layout">
      <div>
        <button className="btn accent" style={{ width: '100%', marginBottom: 10 }} onClick={addAct}>+ New act</button>
        {acts.length === 0 && (
          <div className="panel muted">
            An act is a sequence of scenes with fade and hold times — a chase, a show block, a whole set.
            Playback runs on the server, so it keeps going even if you close this window.
          </div>
        )}
        {acts.map((a) => (
          <div key={a.id} className={`act-item${act?.id === a.id ? ' selected' : ''}`} onClick={() => setSelectedId(a.id)}>
            <span>{a.name} <span className="muted">({a.steps.length})</span></span>
            {status.actId === a.id && status.playing && <span className="playing">▶ playing</span>}
          </div>
        ))}
      </div>

      {act ? (
        <div className="panel">
          <div className="transport">
            {status.actId === act.id && status.playing ? (
              <button className="btn active" onClick={actions.actStop}>■ Stop</button>
            ) : (
              <button className="btn accent" onClick={() => actions.actPlay(act.id)} disabled={act.steps.length === 0}>▶ Play</button>
            )}
            <button className="btn" onClick={actions.actPrev} disabled={status.actId !== act.id}>⏮ Prev</button>
            <button className="btn" onClick={actions.actNext} disabled={status.actId !== act.id}>⏭ Next</button>
            <label className="row" style={{ gap: 6 }}>
              <input type="checkbox" checked={act.loop} onChange={(e) => updateAct({ loop: e.target.checked })} />
              Loop
            </label>
            <span className="spacer" style={{ flex: 1 }} />
            <input
              type="text"
              defaultValue={act.name}
              key={`${act.id}-${act.name}`}
              onBlur={(e) => { if (e.target.value.trim()) updateAct({ name: e.target.value.trim() }) }}
              style={{ width: 160 }}
              aria-label="Act name"
            />
            <button
              className="btn small danger"
              onClick={() => {
                if (!window.confirm(`Delete act "${act.name}"?`)) return
                if (status.actId === act.id) actions.actStop()
                actions.setActs(acts.filter((a) => a.id !== act.id))
                setSelectedId(null)
              }}
            >
              Delete act
            </button>
          </div>

          <table className="steps-table">
            <thead>
              <tr><th style={{ width: 30 }}>#</th><th>Scene</th><th>Fade ms</th><th>Hold ms</th><th style={{ width: 130 }} /></tr>
            </thead>
            <tbody>
              {act.steps.map((step, i) => (
                <tr key={i} className={isCurrent(i) ? 'current' : ''}>
                  <td className="mono muted">{isCurrent(i) ? '▶' : i + 1}</td>
                  <td>
                    <select value={step.sceneId} onChange={(e) => updateStep(i, { sceneId: e.target.value })}>
                      {scenes.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                      {!scenes.some((s) => s.id === step.sceneId) && <option value={step.sceneId}>(missing scene)</option>}
                    </select>
                  </td>
                  <td><input type="number" min={0} step={100} value={step.fadeMs} onChange={(e) => updateStep(i, { fadeMs: Number(e.target.value) || 0 })} /></td>
                  <td><input type="number" min={0} step={100} value={step.holdMs} onChange={(e) => updateStep(i, { holdMs: Number(e.target.value) || 0 })} /></td>
                  <td>
                    <div className="row" style={{ flexWrap: 'nowrap' }}>
                      <button className="btn small" onClick={() => moveStep(i, -1)} disabled={i === 0}>↑</button>
                      <button className="btn small" onClick={() => moveStep(i, 1)} disabled={i === act.steps.length - 1}>↓</button>
                      <button className="btn small" onClick={() => actions.actPlay(act.id, i)} title="Play from here">▶</button>
                      <button className="btn small danger" onClick={() => updateAct({ steps: act.steps.filter((_, j) => j !== i) })}>✕</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button className="btn small" style={{ marginTop: 10 }} onClick={addStep}>+ Add step</button>
        </div>
      ) : (
        <div className="panel muted">Create an act to start sequencing scenes.</div>
      )}
    </div>
  )
}
