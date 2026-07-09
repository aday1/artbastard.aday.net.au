// 512-channel grid with per-channel subscriptions, selection, and multi-edit.
import React, { useMemo, useState } from 'react'
import { useStore, actions, buildPatchMap } from '../state'
import { Fader, EditableValue } from './controls'
import { DMX_CHANNELS } from '../../../shared/types'

type Filter = 'patched' | 'active' | 'all'

const ChannelStrip = React.memo(function ChannelStrip({ ch, label }: { ch: number; label: string | null }) {
  const value = useStore((s) => s.dmx[ch])
  const selected = useStore((s) => s.selection.includes(ch))

  const onHeadClick = (e: React.MouseEvent) => {
    if (e.shiftKey) actions.selectChannel(ch, 'range')
    else if (e.ctrlKey || e.metaKey) actions.selectChannel(ch, 'toggle')
    else actions.selectChannel(ch, selected ? 'toggle' : 'only')
  }

  return (
    <div className={`strip${selected ? ' selected' : ''}${label ? ' patched' : ''}`}>
      <div className="strip-head" onClick={onHeadClick} title="Click: select · Shift: range · Ctrl: add">
        {ch + 1}
      </div>
      <Fader value={value} onChange={(v) => actions.setChannel(ch, v)} ariaLabel={`Channel ${ch + 1}`} />
      <EditableValue className={`strip-value${value > 0 ? ' hot' : ''}`} value={value} onChange={(v) => actions.setChannel(ch, v)} />
      <div className={`strip-label${label ? ' has' : ''}`} title={label ?? ''}>{label ?? '—'}</div>
    </div>
  )
})

function SelectionBar() {
  const selection = useStore((s) => s.selection)
  if (selection.length === 0) return null

  const setAll = (v: number) => actions.setChannels(selection.map((ch) => [ch, v]))
  return (
    <div className="selection-bar">
      <strong>{selection.length} selected</strong>
      <div style={{ width: 180 }}>
        <Fader horizontal value={useStore.getState().dmx[selection[selection.length - 1]] ?? 0} onChange={setAll} ariaLabel="Set selected channels" />
      </div>
      <button className="btn small" onClick={() => setAll(255)}>Full</button>
      <button className="btn small" onClick={() => setAll(128)}>50%</button>
      <button className="btn small" onClick={() => setAll(0)}>Off</button>
      <button className="btn small" onClick={actions.clearSelection}>Deselect (Esc)</button>
    </div>
  )
}

export function ChannelsView() {
  const fixtures = useStore((s) => s.fixtures)
  const [filter, setFilter] = useState<Filter>(() => (localStorage.getItem('ab.chanFilter') as Filter) || 'all')
  // subscribe to a cheap activity signature so 'active' filter refreshes as levels move
  const activeCount = useStore((s) => (filter === 'active' ? s.dmx.reduce((n, v) => n + (v > 0 ? 1 : 0), 0) : 0))

  const patchMap = useMemo(() => buildPatchMap(fixtures), [fixtures])

  const visible = useMemo(() => {
    const state = useStore.getState()
    const list: number[] = []
    for (let ch = 0; ch < DMX_CHANNELS; ch++) {
      if (filter === 'patched' && !patchMap[ch]) continue
      if (filter === 'active' && !(state.dmx[ch] > 0 || patchMap[ch] || state.selection.includes(ch))) continue
      list.push(ch)
    }
    return list
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, patchMap, activeCount])

  const pickFilter = (f: Filter) => {
    localStorage.setItem('ab.chanFilter', f)
    setFilter(f)
  }

  return (
    <div>
      <div className="chan-toolbar">
        {(['all', 'patched', 'active'] as Filter[]).map((f) => (
          <button key={f} className={`btn small${filter === f ? ' active' : ''}`} onClick={() => pickFilter(f)}>
            {f === 'all' ? 'All 512' : f === 'patched' ? 'Patched' : 'In use'}
          </button>
        ))}
        <span className="spacer" />
        <span className="muted">drag faders · scroll wheel = ±5 · click number to select · double up with Shift for ranges</span>
        <button className="btn small accent" onClick={actions.quickSaveScene} title="Capture current look as a scene - key: S">
          + Save scene
        </button>
      </div>
      {visible.length === 0 ? (
        <div className="panel muted">
          {filter === 'patched'
            ? 'Nothing patched yet. Head to the Fixtures tab to patch your rig, or switch the filter to All 512.'
            : 'Nothing to show.'}
        </div>
      ) : (
        <div className="chan-grid">
          {visible.map((ch) => (
            <ChannelStrip key={ch} ch={ch} label={patchMap[ch]?.label ?? null} />
          ))}
        </div>
      )}
      <SelectionBar />
    </div>
  )
}
