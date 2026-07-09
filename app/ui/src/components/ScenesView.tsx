// Scene cards: one-tap recall, inline rename/fade, update-from-live, delete.
import { useStore, actions } from '../state'

export function ScenesView() {
  const scenes = useStore((s) => s.scenes)
  const lastRecalled = useStore((s) => s.lastRecalledSceneId)

  return (
    <div>
      <div className="chan-toolbar">
        <button className="btn accent" onClick={actions.quickSaveScene} title="Key: S">+ Save current look</button>
        <span className="muted">Tap a scene to recall it with its fade. “Update” re-captures the live look into that scene.</span>
      </div>
      {scenes.length === 0 ? (
        <div className="panel muted">
          No scenes yet. Set a look (Channels or Fixtures tab), then hit <strong>Save current look</strong> —
          every non-zero channel is captured. Recalling a scene fades to exactly that look.
        </div>
      ) : (
        <div className="scene-grid">
          {scenes.map((scene, i) => (
            <div key={scene.id} className={`scene-card${lastRecalled === scene.id ? ' active' : ''}`}>
              <button className="scene-recall" onClick={() => actions.recallScene(scene.id)} title={`Recall (slot ${i + 1})`}>
                {scene.name}
              </button>
              <div className="meta">
                <input
                  type="text"
                  defaultValue={scene.name}
                  key={`${scene.id}-name-${scene.name}`}
                  onBlur={(e) => { if (e.target.value !== scene.name) actions.sceneMeta(scene.id, { name: e.target.value }) }}
                  style={{ flex: 1, minWidth: 60 }}
                  aria-label="Scene name"
                />
                <input
                  type="number"
                  min={0} step={100}
                  defaultValue={scene.fadeMs}
                  key={`${scene.id}-fade-${scene.fadeMs}`}
                  onBlur={(e) => actions.sceneMeta(scene.id, { fadeMs: Number(e.target.value) || 0 })}
                  title="Fade time (ms)"
                  aria-label="Fade ms"
                />
                <span className="muted" style={{ fontSize: 11 }}>ms</span>
              </div>
              <div className="scene-actions">
                <button className="btn small" onClick={() => actions.saveSceneOver(scene.id)} title="Overwrite with the current live look">
                  Update
                </button>
                <button className="btn small" onClick={() => actions.recallScene(scene.id, 0)} title="Recall instantly (no fade)">
                  Snap
                </button>
                <button
                  className="btn small danger"
                  style={{ marginLeft: 'auto' }}
                  onClick={() => { if (window.confirm(`Delete scene "${scene.name}"?`)) actions.deleteScene(scene.id) }}
                >
                  ✕
                </button>
              </div>
              <span className="muted" style={{ fontSize: 11 }}>
                slot {i + 1} · {Object.keys(scene.values).length} ch
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
