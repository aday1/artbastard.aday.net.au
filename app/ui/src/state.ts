// Client state: one zustand store, one socket, optimistic faders with echo suppression.
import { create } from 'zustand'
import { io, type Socket } from 'socket.io-client'
import { DMX_CHANNELS } from '../../shared/types'
import type {
  Act, ActStatus, AppConfig, ChannelPair, Fixture, Group, InitState, MidiMapping, Scene,
} from '../../shared/types'

export type Tab = 'channels' | 'fixtures' | 'scenes' | 'acts' | 'midi' | 'osc' | 'settings'

export interface Toast { id: number; kind: 'info' | 'ok' | 'error'; text: string }
export interface OscLogEntry { address: string; args: (number | string)[]; mapped: string | null; at: number }

interface AppState {
  connected: boolean
  version: string
  tab: Tab
  dmx: number[]
  master: number
  blackout: boolean
  fixtures: Fixture[]
  groups: Group[]
  scenes: Scene[]
  acts: Act[]
  actStatus: ActStatus
  config: AppConfig | null
  artnetOk: boolean
  artnetError: string | null
  oscListening: boolean
  oscError: string | null
  oscLog: OscLogEntry[]
  lastRecalledSceneId: string | null
  selection: number[]           // selected channel indexes (0-based)
  selectedFixtureIds: string[]
  toasts: Toast[]
  midiEnabled: boolean
  midiInputs: string[]
  midiLearn: { label: string; targetJson: string } | null
  midiActivity: string | null
}

export const useStore = create<AppState>(() => ({
  connected: false,
  version: '',
  tab: (localStorage.getItem('ab.tab') as Tab) || 'fixtures',
  dmx: new Array(DMX_CHANNELS).fill(0),
  master: 255,
  blackout: false,
  fixtures: [],
  groups: [],
  scenes: [],
  acts: [],
  actStatus: { actId: null, stepIndex: 0, playing: false, stepStartedAt: 0 },
  config: null,
  artnetOk: true,
  artnetError: null,
  oscListening: false,
  oscError: null,
  oscLog: [],
  lastRecalledSceneId: null,
  selection: [],
  selectedFixtureIds: [],
  toasts: [],
  midiEnabled: false,
  midiInputs: [],
  midiLearn: null,
  midiActivity: null,
}))

// ---------- toasts ----------
let toastSeq = 1
export function toast(kind: Toast['kind'], text: string) {
  const id = toastSeq++
  useStore.setState((s) => ({ toasts: [...s.toasts.slice(-3), { id, kind, text }] }))
  setTimeout(() => useStore.setState((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 3200)
}

// ---------- socket ----------
export let socket: Socket

/** channels currently controlled locally (drag in progress or just sent) - incoming echoes ignored */
const localHold = new Map<number, number>() // ch -> holdUntil epoch ms
const HOLD_MS = 350

let pendingPairs = new Map<number, number>()
let flushTimer: number | null = null

function flushPending() {
  flushTimer = null
  if (!pendingPairs.size) return
  const pairs: ChannelPair[] = []
  for (const [ch, v] of pendingPairs) pairs.push([ch, v])
  pendingPairs = new Map()
  socket.emit('setChannels', { pairs })
}

export function connectSocket() {
  if (socket) return
  socket = io({ transports: ['websocket', 'polling'] })

  socket.on('connect', () => useStore.setState({ connected: true }))
  socket.on('disconnect', () => useStore.setState({ connected: false }))

  socket.on('init', (init: InitState) => {
    useStore.setState({
      version: init.version,
      dmx: init.dmx,
      master: init.master,
      blackout: init.blackout,
      fixtures: init.fixtures,
      groups: init.groups,
      scenes: init.scenes,
      acts: init.acts,
      actStatus: init.actStatus,
      config: init.config,
      artnetOk: init.artnetOk,
    })
  })

  socket.on('dmx', (pairs: ChannelPair[]) => {
    const now = Date.now()
    useStore.setState((s) => {
      const dmx = s.dmx.slice()
      for (const [ch, v] of pairs) {
        const hold = localHold.get(ch)
        if (hold && hold > now) continue
        if (ch >= 0 && ch < DMX_CHANNELS) dmx[ch] = v
      }
      return { dmx }
    })
  })

  socket.on('master', (master: number) => useStore.setState({ master }))
  socket.on('blackout', (blackout: boolean) => useStore.setState({ blackout }))
  socket.on('scenes', (scenes: Scene[]) => useStore.setState({ scenes }))
  socket.on('fixtures', (fixtures: Fixture[]) => useStore.setState({ fixtures }))
  socket.on('groups', (groups: Group[]) => useStore.setState({ groups }))
  socket.on('acts', (acts: Act[]) => useStore.setState({ acts }))
  socket.on('actStatus', (actStatus: ActStatus) => useStore.setState({ actStatus }))
  socket.on('config', (config: AppConfig) => useStore.setState({ config }))
  socket.on('artnet', ({ ok, error }: { ok: boolean; error: string | null }) => {
    useStore.setState({ artnetOk: ok, artnetError: error })
    if (!ok && error) toast('error', `Art-Net: ${error}`)
  })
  socket.on('oscStatus', ({ listening, error }: { listening: boolean; error: string | null }) =>
    useStore.setState({ oscListening: listening, oscError: error }))
  socket.on('oscIn', (entry: OscLogEntry) =>
    useStore.setState((s) => ({ oscLog: [entry, ...s.oscLog].slice(0, 60) })))
  socket.on('sceneRecalled', ({ id }: { id: string }) => useStore.setState({ lastRecalledSceneId: id }))
}

// ---------- actions ----------
export const actions = {
  setTab(tab: Tab) {
    localStorage.setItem('ab.tab', tab)
    useStore.setState({ tab })
  },

  /** Optimistic local set + throttled batch emit. */
  setChannel(ch: number, value: number) {
    const v = Math.max(0, Math.min(255, Math.round(value)))
    localHold.set(ch, Date.now() + HOLD_MS)
    useStore.setState((s) => {
      if (s.dmx[ch] === v) return {}
      const dmx = s.dmx.slice()
      dmx[ch] = v
      return { dmx }
    })
    pendingPairs.set(ch, v)
    if (flushTimer === null) flushTimer = window.setTimeout(flushPending, 28)
  },

  setChannels(pairs: ChannelPair[]) {
    const now = Date.now()
    useStore.setState((s) => {
      const dmx = s.dmx.slice()
      for (const [ch, v] of pairs) {
        const clamped = Math.max(0, Math.min(255, Math.round(v)))
        localHold.set(ch, now + HOLD_MS)
        dmx[ch] = clamped
        pendingPairs.set(ch, clamped)
      }
      return { dmx }
    })
    if (flushTimer === null) flushTimer = window.setTimeout(flushPending, 28)
  },

  setMaster(value: number) {
    const v = Math.max(0, Math.min(255, Math.round(value)))
    useStore.setState({ master: v })
    socket.emit('setMaster', v)
  },

  toggleBlackout() {
    socket.emit('setBlackout', !useStore.getState().blackout)
  },

  flash(on: boolean) {
    socket.emit('flash', on)
  },

  quickSaveScene() {
    socket.emit('saveScene', {}, (scene: Scene) => toast('ok', `Saved "${scene.name}"`))
  },

  saveSceneOver(id: string) {
    socket.emit('saveScene', { id }, (scene: Scene) => toast('ok', `Updated "${scene.name}"`))
  },

  recallScene(id: string, fadeMs?: number) {
    socket.emit('recallScene', { id, fadeMs })
  },

  recallSceneSlot(slot: number) {
    const scene = useStore.getState().scenes[slot]
    if (scene) socket.emit('recallScene', { id: scene.id })
  },

  sceneMeta(id: string, meta: { name?: string; fadeMs?: number }) {
    socket.emit('sceneMeta', { id, ...meta })
  },

  deleteScene(id: string) {
    socket.emit('deleteScene', id)
  },

  setFixtures(fixtures: Fixture[]) {
    useStore.setState({ fixtures })
    socket.emit('setFixtures', fixtures)
  },

  setGroups(groups: Group[]) {
    useStore.setState({ groups })
    socket.emit('setGroups', groups)
  },

  setGroupLevel(groupId: string, value: number) {
    socket.emit('setGroupLevel', { groupId, value })
  },

  setActs(acts: Act[]) {
    useStore.setState({ acts })
    socket.emit('setActs', acts)
  },

  actPlay(actId: string, stepIndex?: number) { socket.emit('actPlay', { actId, stepIndex }) },
  actStop() { socket.emit('actStop') },
  actNext() { socket.emit('actNext') },
  actPrev() { socket.emit('actPrev') },

  setArtnet(cfg: Partial<AppConfig['artnet']>) { socket.emit('setArtnet', cfg) },
  setOsc(cfg: Partial<AppConfig['osc']>) { socket.emit('setOsc', cfg) },

  setMidiMappings(mappings: MidiMapping[]) {
    useStore.setState((s) => (s.config ? { config: { ...s.config, midiMappings: mappings } } : {}))
    socket.emit('setMidiMappings', mappings)
  },

  selectChannel(ch: number, mode: 'toggle' | 'range' | 'only') {
    useStore.setState((s) => {
      if (mode === 'only') return { selection: [ch] }
      if (mode === 'toggle') {
        return s.selection.includes(ch)
          ? { selection: s.selection.filter((c) => c !== ch) }
          : { selection: [...s.selection, ch] }
      }
      // range from last selected
      const last = s.selection[s.selection.length - 1]
      if (last === undefined) return { selection: [ch] }
      const [a, b] = last < ch ? [last, ch] : [ch, last]
      const range: number[] = []
      for (let i = a; i <= b; i++) range.push(i)
      return { selection: Array.from(new Set([...s.selection, ...range])) }
    })
  },

  clearSelection() { useStore.setState({ selection: [] }) },

  selectFixture(id: string, additive: boolean) {
    useStore.setState((s) => {
      if (!additive) return { selectedFixtureIds: s.selectedFixtureIds.length === 1 && s.selectedFixtureIds[0] === id ? [] : [id] }
      return s.selectedFixtureIds.includes(id)
        ? { selectedFixtureIds: s.selectedFixtureIds.filter((f) => f !== id) }
        : { selectedFixtureIds: [...s.selectedFixtureIds, id] }
    })
  },

  factoryReset() { socket.emit('factoryReset') },
}

// ---------- derived helpers ----------
export interface PatchInfo { fixture: Fixture; channelIndex: number; label: string; role: string }

/** channel(0-based) -> patch info, for strip labels + conflict detection */
export function buildPatchMap(fixtures: Fixture[]): (PatchInfo | null)[] {
  const map: (PatchInfo | null)[] = new Array(DMX_CHANNELS).fill(null)
  for (const fixture of fixtures) {
    fixture.channels.forEach((ch, i) => {
      const addr = fixture.startAddress - 1 + i
      if (addr >= 0 && addr < DMX_CHANNELS) {
        map[addr] = { fixture, channelIndex: i, label: `${fixture.name} · ${ch.name}`, role: ch.role }
      }
    })
  }
  return map
}

export function fixtureAddressRange(f: Fixture): [number, number] {
  return [f.startAddress, f.startAddress + f.channels.length - 1]
}

export function findConflicts(fixtures: Fixture[]): Set<string> {
  const owner = new Array<string | null>(DMX_CHANNELS).fill(null)
  const conflicted = new Set<string>()
  for (const f of fixtures) {
    for (let i = 0; i < f.channels.length; i++) {
      const addr = f.startAddress - 1 + i
      if (addr < 0 || addr >= DMX_CHANNELS) { conflicted.add(f.id); continue }
      const existing = owner[addr]
      if (existing && existing !== f.id) {
        conflicted.add(f.id)
        conflicted.add(existing)
      }
      owner[addr] = f.id
    }
  }
  return conflicted
}

export function nextFreeAddress(fixtures: Fixture[], channelCount: number): number {
  const used = new Array(DMX_CHANNELS).fill(false)
  for (const f of fixtures) {
    for (let i = 0; i < f.channels.length; i++) {
      const addr = f.startAddress - 1 + i
      if (addr >= 0 && addr < DMX_CHANNELS) used[addr] = true
    }
  }
  for (let start = 0; start + channelCount <= DMX_CHANNELS; start++) {
    let free = true
    for (let i = 0; i < channelCount; i++) {
      if (used[start + i]) { free = false; break }
    }
    if (free) return start + 1
  }
  return 1
}
