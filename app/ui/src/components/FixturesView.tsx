// Fixture patching + role-aware live controls (intensity, color, pan/tilt, extras).
import React, { useMemo, useState } from 'react'
import { useStore, actions, findConflicts, nextFreeAddress, toast } from '../state'
import { PROFILES, ROLE_OPTIONS } from '../profiles'
import { Fader, XYPad } from './controls'
import type { ChannelRole, Fixture, FixtureChannel } from '../../../shared/types'

const uid = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`

const SWATCHES = ['#ff0000', '#ff7f00', '#ffff00', '#00ff00', '#00ffff', '#0000ff', '#7f00ff', '#ff00ff', '#ffffff', '#ffb469', '#69b4ff', '#000000']

function PatchForm() {
  const fixtures = useStore((s) => s.fixtures)
  const [profileId, setProfileId] = useState(PROFILES[1].id)
  const [name, setName] = useState('')
  const [count, setCount] = useState(1)
  const [address, setAddress] = useState<number | ''>('')

  const profile = PROFILES.find((p) => p.id === profileId) ?? PROFILES[0]

  const add = () => {
    const list = [...fixtures]
    let addr = address === '' ? nextFreeAddress(list, profile.channels.length) : address
    const base = name.trim() || profile.name.replace(/\s*\(\d+ch\)$/, '')
    for (let i = 0; i < Math.max(1, Math.min(64, count)); i++) {
      const existing = list.filter((f) => f.name.startsWith(base)).length
      list.push({
        id: uid('fx'),
        name: count > 1 || existing > 0 ? `${base} ${existing + 1}` : base,
        profileId: profile.id,
        startAddress: addr,
        channels: profile.channels.map((c) => ({ ...c })),
      })
      addr += profile.channels.length
      if (addr + profile.channels.length - 1 > 512) break
    }
    actions.setFixtures(list)
    toast('ok', `Patched ${Math.min(count, list.length - fixtures.length)} fixture(s)`)
    setName('')
    setAddress('')
  }

  return (
    <div className="panel">
      <h3>Patch a fixture</h3>
      <div className="row">
        <div className="field" style={{ flex: 1, minWidth: 170 }}>
          <span>Profile</span>
          <select value={profileId} onChange={(e) => setProfileId(e.target.value)}>
            {PROFILES.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div className="field" style={{ flex: 1, minWidth: 130 }}>
          <span>Name (optional)</span>
          <input type="text" value={name} placeholder="e.g. Stage L" onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="field">
          <span>Address (auto)</span>
          <input
            type="number" min={1} max={512} value={address}
            placeholder={String(nextFreeAddress(fixtures, profile.channels.length))}
            onChange={(e) => setAddress(e.target.value === '' ? '' : Number(e.target.value))}
          />
        </div>
        <div className="field">
          <span>Qty</span>
          <input type="number" min={1} max={64} value={count} onChange={(e) => setCount(Number(e.target.value) || 1)} />
        </div>
        <button className="btn accent" style={{ alignSelf: 'flex-end' }} onClick={add}>Patch</button>
      </div>
    </div>
  )
}

function FixtureList() {
  const fixtures = useStore((s) => s.fixtures)
  const selectedIds = useStore((s) => s.selectedFixtureIds)
  const conflicts = useMemo(() => findConflicts(fixtures), [fixtures])

  const remove = (fx: Fixture) => {
    if (!window.confirm(`Remove "${fx.name}" from the patch?`)) return
    actions.setFixtures(fixtures.filter((f) => f.id !== fx.id))
    useStore.setState((s) => ({ selectedFixtureIds: s.selectedFixtureIds.filter((id) => id !== fx.id) }))
  }
  const move = (fx: Fixture, addr: number) => {
    actions.setFixtures(fixtures.map((f) => (f.id === fx.id ? { ...f, startAddress: Math.max(1, Math.min(512, addr)) } : f)))
  }

  if (fixtures.length === 0) {
    return <div className="panel muted" style={{ marginTop: 12 }}>No fixtures patched. Add one above — it takes five seconds.</div>
  }

  return (
    <div style={{ marginTop: 12 }}>
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 6 }}>
        <span className="muted">{fixtures.length} fixture(s) · click to control · Ctrl-click multi-select</span>
        {conflicts.size > 0 && <span style={{ color: 'var(--danger)', fontSize: 12 }}>⚠ address overlap</span>}
      </div>
      {fixtures.map((fx) => {
        const end = fx.startAddress + fx.channels.length - 1
        return (
          <div
            key={fx.id}
            className={`fixture-item${selectedIds.includes(fx.id) ? ' selected' : ''}${conflicts.has(fx.id) ? ' conflict' : ''}`}
            onClick={(e) => actions.selectFixture(fx.id, e.ctrlKey || e.metaKey)}
          >
            <span className="addr">
              <input
                type="number" min={1} max={512} value={fx.startAddress}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => move(fx, Number(e.target.value) || 1)}
                style={{ width: 62, minHeight: 28, padding: '2px 4px' }}
              />
              –{end}
            </span>
            <span className="name">{fx.name}</span>
            <span className="kind">{fx.channels.length}ch</span>
            <button className="btn small danger" onClick={(e) => { e.stopPropagation(); remove(fx) }}>✕</button>
          </div>
        )
      })}
      <GroupsPanel />
    </div>
  )
}

function GroupsPanel() {
  const groups = useStore((s) => s.groups)
  const fixtures = useStore((s) => s.fixtures)
  const selectedIds = useStore((s) => s.selectedFixtureIds)

  const createGroup = () => {
    if (selectedIds.length === 0) { toast('info', 'Select fixtures first (Ctrl-click for several)'); return }
    const name = window.prompt('Group name', `Group ${groups.length + 1}`)
    if (!name) return
    actions.setGroups([...groups, { id: uid('grp'), name, fixtureIds: selectedIds }])
  }

  return (
    <div className="panel" style={{ marginTop: 12 }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h3 style={{ margin: 0 }}>Groups</h3>
        <button className="btn small" onClick={createGroup}>+ Group from selection</button>
      </div>
      {groups.length === 0 && <div className="muted" style={{ marginTop: 8 }}>Group fixtures to grab them as one (and to map MIDI faders to whole groups).</div>}
      {groups.map((g) => (
        <div key={g.id} className="row" style={{ marginTop: 8 }}>
          <button
            className="btn small"
            style={{ minWidth: 110, textAlign: 'left' }}
            onClick={() => useStore.setState({ selectedFixtureIds: g.fixtureIds.filter((id) => fixtures.some((f) => f.id === id)) })}
            title="Select this group's fixtures"
          >
            {g.name} <span className="muted">({g.fixtureIds.length})</span>
          </button>
          <div style={{ flex: 1, maxWidth: 260 }}>
            <Fader horizontal value={0} onChange={(v) => actions.setGroupLevel(g.id, v)} ariaLabel={`${g.name} intensity`} />
          </div>
          <button className="btn small danger" onClick={() => actions.setGroups(groups.filter((x) => x.id !== g.id))}>✕</button>
        </div>
      ))}
    </div>
  )
}

/** Channel editor for one fixture (rename channels / change roles / add / remove). */
function ChannelEditor({ fixture }: { fixture: Fixture }) {
  const fixtures = useStore((s) => s.fixtures)
  const update = (channels: FixtureChannel[]) =>
    actions.setFixtures(fixtures.map((f) => (f.id === fixture.id ? { ...f, channels } : f)))

  return (
    <div className="panel" style={{ marginTop: 12 }}>
      <h3>Channel layout · {fixture.name}</h3>
      {fixture.channels.map((ch, i) => (
        <div className="row" key={i} style={{ marginBottom: 6 }}>
          <span className="mono muted" style={{ width: 34 }}>{fixture.startAddress + i}</span>
          <input type="text" value={ch.name} style={{ width: 130 }}
            onChange={(e) => update(fixture.channels.map((c, j) => (j === i ? { ...c, name: e.target.value } : c)))} />
          <select value={ch.role}
            onChange={(e) => update(fixture.channels.map((c, j) => (j === i ? { ...c, role: e.target.value as ChannelRole } : c)))}>
            {ROLE_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
          <button className="btn small danger" onClick={() => update(fixture.channels.filter((_, j) => j !== i))}>✕</button>
        </div>
      ))}
      <button className="btn small" onClick={() => update([...fixture.channels, { name: `Ch ${fixture.channels.length + 1}`, role: 'other' }])}>
        + Add channel
      </button>
    </div>
  )
}

/** Live controls for current fixture selection, grouped by role. */
function FixtureControls() {
  const fixtures = useStore((s) => s.fixtures)
  const selectedIds = useStore((s) => s.selectedFixtureIds)
  const dmx = useStore((s) => s.dmx)
  const [showEditor, setShowEditor] = useState(false)

  const selected = fixtures.filter((f) => selectedIds.includes(f.id))
  if (selected.length === 0) {
    return <div className="panel muted">Select a fixture on the left to control it. Ctrl-click to grab several at once.</div>
  }

  const addrOf = (f: Fixture, role: ChannelRole) => {
    const i = f.channels.findIndex((c) => c.role === role)
    return i >= 0 ? f.startAddress - 1 + i : null
  }
  const collect = (role: ChannelRole) => selected.map((f) => addrOf(f, role)).filter((a): a is number => a !== null)

  const intensity = collect('intensity')
  const reds = collect('red'); const greens = collect('green'); const blues = collect('blue')
  const whites = collect('white'); const ambers = collect('amber'); const uvs = collect('uv')
  const pans = collect('pan'); const tilts = collect('tilt')
  const hasColor = reds.length > 0 && greens.length > 0 && blues.length > 0
  const hasPanTilt = pans.length > 0 && tilts.length > 0

  // extra channels: everything not covered by dedicated controls
  const covered: ChannelRole[] = ['intensity', 'red', 'green', 'blue', 'pan', 'tilt', 'pan_fine', 'tilt_fine']
  const extras: { addr: number; label: string }[] = []
  for (const f of selected) {
    f.channels.forEach((c, i) => {
      if (!covered.includes(c.role)) {
        extras.push({ addr: f.startAddress - 1 + i, label: selected.length > 1 ? `${f.name}·${c.name}` : c.name })
      }
    })
  }

  const setAll = (addrs: number[], v: number) => actions.setChannels(addrs.map((a) => [a, v]))
  const applyColor = (hex: string) => {
    const r = parseInt(hex.slice(1, 3), 16); const g = parseInt(hex.slice(3, 5), 16); const b = parseInt(hex.slice(5, 7), 16)
    actions.setChannels([
      ...reds.map((a) => [a, r] as [number, number]),
      ...greens.map((a) => [a, g] as [number, number]),
      ...blues.map((a) => [a, b] as [number, number]),
    ])
  }

  const firstVal = (addrs: number[]) => (addrs.length ? dmx[addrs[0]] : 0)

  return (
    <div>
      <div className="panel">
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
          <h3 style={{ margin: 0 }}>
            {selected.length === 1 ? selected[0].name : `${selected.length} fixtures`}
          </h3>
          <div className="row">
            {intensity.length > 0 && (
              <>
                <button className="btn small" onClick={() => setAll(intensity, 255)}>Full</button>
                <button className="btn small" onClick={() => setAll(intensity, 0)}>Out</button>
              </>
            )}
            {selected.length === 1 && (
              <button className={`btn small${showEditor ? ' active' : ''}`} onClick={() => setShowEditor(!showEditor)}>
                Edit channels
              </button>
            )}
          </div>
        </div>
        <div className="controls-grid">
          {intensity.length > 0 && (
            <div className="control-block">
              <span>Intensity</span>
              <Fader value={firstVal(intensity)} onChange={(v) => setAll(intensity, v)} ariaLabel="Intensity" />
            </div>
          )}
          {hasColor && (
            <div className="control-block">
              <span>Color</span>
              <div className="swatches">
                {SWATCHES.map((c) => (
                  <div key={c} className="swatch" style={{ background: c }} onClick={() => applyColor(c)} title={c} />
                ))}
              </div>
              <input
                type="color"
                style={{ width: '100%', height: 38, background: 'none', border: '1px solid var(--line)', borderRadius: 6, cursor: 'pointer' }}
                onChange={(e) => applyColor(e.target.value)}
                title="Pick any color"
              />
              <div className="row">
                {[{ a: reds, l: 'R' }, { a: greens, l: 'G' }, { a: blues, l: 'B' }, { a: whites, l: 'W' }, { a: ambers, l: 'A' }, { a: uvs, l: 'UV' }]
                  .filter((x) => x.a.length > 0)
                  .map((x) => (
                    <div key={x.l} className="control-block">
                      <span>{x.l}</span>
                      <Fader value={firstVal(x.a)} onChange={(v) => setAll(x.a, v)} ariaLabel={x.l} />
                    </div>
                  ))}
              </div>
            </div>
          )}
          {hasPanTilt && (
            <div className="control-block">
              <span>Pan / Tilt <span className="muted">(shift = fine)</span></span>
              <XYPad
                x={firstVal(pans)}
                y={firstVal(tilts)}
                onChange={(x, y) => actions.setChannels([
                  ...pans.map((a) => [a, x] as [number, number]),
                  ...tilts.map((a) => [a, y] as [number, number]),
                ])}
              />
              <div className="row">
                <button className="btn small" onClick={() => actions.setChannels([...pans.map((a) => [a, 128] as [number, number]), ...tilts.map((a) => [a, 128] as [number, number])])}>Center</button>
              </div>
            </div>
          )}
          {extras.map((ex) => (
            <div key={ex.addr} className="control-block">
              <span title={ex.label}>{ex.label.length > 14 ? ex.label.slice(0, 13) + '…' : ex.label}</span>
              <Fader value={dmx[ex.addr]} onChange={(v) => actions.setChannel(ex.addr, v)} ariaLabel={ex.label} />
              <span className="mono muted" style={{ fontSize: 11 }}>{dmx[ex.addr]}</span>
            </div>
          ))}
        </div>
      </div>
      {showEditor && selected.length === 1 && <ChannelEditor fixture={selected[0]} />}
    </div>
  )
}

export function FixturesView() {
  return (
    <div className="fixtures-layout">
      <div>
        <PatchForm />
        <FixtureList />
      </div>
      <FixtureControls />
    </div>
  )
}
