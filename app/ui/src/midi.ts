// Web MIDI: device handling, MIDI Learn, mapping execution, APC40 template + LED feedback.
// Mappings persist on the server (config.midiMappings) so they survive reloads and machines.
import { useStore, actions, toast } from './state'
import type { MidiMapping, MidiTarget } from '../../shared/types'

let access: MIDIAccess | null = null
let mappingIndex = new Map<string, MidiMapping>()
const keyOf = (kind: 'cc' | 'note', ch: number, code: number) => `${kind}:${ch}:${code}`

const uid = () => `map-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`

export function describeTarget(t: MidiTarget): string {
  switch (t.kind) {
    case 'dmx': return `DMX ch ${t.channel + 1}`
    case 'master': return 'Grand master'
    case 'blackout': return 'Blackout (toggle)'
    case 'flash': return 'Flash (hold)'
    case 'scene': return `Scene: ${useStore.getState().scenes.find((s) => s.id === t.sceneId)?.name ?? t.sceneId}`
    case 'sceneSlot': return `Scene slot ${t.slot + 1}`
    case 'act': return `Act: ${useStore.getState().acts.find((a) => a.id === t.actId)?.name ?? t.actId}`
    case 'group': return `Group: ${useStore.getState().groups.find((g) => g.id === t.groupId)?.name ?? t.groupId}`
  }
}

function rebuildIndex() {
  const mappings = useStore.getState().config?.midiMappings ?? []
  mappingIndex = new Map(mappings.map((m) => [keyOf(m.kind, m.midiChannel, m.code), m]))
}
useStore.subscribe((s, prev) => {
  if (s.config?.midiMappings !== prev.config?.midiMappings) rebuildIndex()
  if (s.scenes !== prev.scenes || s.lastRecalledSceneId !== prev.lastRecalledSceneId) sendApcLeds()
})

function execute(mapping: MidiMapping, kind: 'cc' | 'noteon' | 'noteoff', value: number) {
  const t = mapping.target
  const v255 = Math.round((value / 127) * 255)
  switch (t.kind) {
    case 'dmx':
      if (kind === 'cc') actions.setChannel(t.channel, v255)
      else actions.setChannel(t.channel, kind === 'noteon' ? 255 : 0)
      break
    case 'master':
      if (kind !== 'noteoff') actions.setMaster(kind === 'cc' ? v255 : 255)
      break
    case 'blackout':
      if (kind === 'noteon' || (kind === 'cc' && value > 63)) actions.toggleBlackout()
      break
    case 'flash':
      if (kind === 'cc') actions.flash(value > 63)
      else actions.flash(kind === 'noteon')
      break
    case 'scene':
      if (kind === 'noteon' || (kind === 'cc' && value > 63)) actions.recallScene(t.sceneId)
      break
    case 'sceneSlot':
      if (kind === 'noteon' || (kind === 'cc' && value > 63)) actions.recallSceneSlot(t.slot)
      break
    case 'act': {
      if (kind === 'noteon' || (kind === 'cc' && value > 63)) {
        const st = useStore.getState().actStatus
        if (st.actId === t.actId && st.playing) actions.actStop()
        else actions.actPlay(t.actId)
      }
      break
    }
    case 'group':
      if (kind === 'cc') actions.setGroupLevel(t.groupId, v255)
      else if (kind === 'noteon') actions.setGroupLevel(t.groupId, 255)
      else actions.setGroupLevel(t.groupId, 0)
      break
  }
}

function onMidiMessage(e: MIDIMessageEvent) {
  const data = e.data
  if (!data || data.length < 3) return
  const type = data[0] & 0xf0
  const ch = data[0] & 0x0f
  const code = data[1]
  const value = data[2]

  let kind: 'cc' | 'noteon' | 'noteoff'
  if (type === 0xb0) kind = 'cc'
  else if (type === 0x90 && value > 0) kind = 'noteon'
  else if (type === 0x80 || (type === 0x90 && value === 0)) kind = 'noteoff'
  else return

  useStore.setState({
    midiActivity: `${kind === 'cc' ? 'CC' : 'Note'} ${code} ch ${ch + 1} = ${value}`,
  })

  const learn = useStore.getState().midiLearn
  if (learn && (kind === 'cc' || kind === 'noteon')) {
    const target = JSON.parse(learn.targetJson) as MidiTarget
    const mapping: MidiMapping = { id: uid(), kind: kind === 'cc' ? 'cc' : 'note', midiChannel: ch, code, target }
    const existing = (useStore.getState().config?.midiMappings ?? [])
      .filter((m) => !(m.kind === mapping.kind && m.midiChannel === ch && m.code === code))
    actions.setMidiMappings([...existing, mapping])
    useStore.setState({ midiLearn: null })
    toast('ok', `Mapped ${kind === 'cc' ? 'CC' : 'note'} ${code} → ${learn.label}`)
    return
  }

  const mapping = mappingIndex.get(keyOf(kind === 'cc' ? 'cc' : 'note', ch, code))
  if (mapping) execute(mapping, kind, value)
}

function attachInputs() {
  if (!access) return
  const names: string[] = []
  access.inputs.forEach((input) => {
    input.onmidimessage = onMidiMessage
    names.push(`${input.name ?? 'unknown'}`)
  })
  useStore.setState({ midiInputs: names, midiEnabled: true })
  sendApcLeds()
}

export async function initMidi(): Promise<boolean> {
  if (!('requestMIDIAccess' in navigator)) {
    toast('error', 'This browser has no Web MIDI (use Chrome/Edge, or http://localhost)')
    return false
  }
  try {
    access = await navigator.requestMIDIAccess({ sysex: false })
    access.onstatechange = attachInputs
    attachInputs()
    rebuildIndex()
    localStorage.setItem('ab.midi', '1')
    return true
  } catch {
    toast('error', 'MIDI access was denied')
    return false
  }
}

export function autoInitMidi() {
  if (localStorage.getItem('ab.midi') === '1') void initMidi()
}

export function startLearn(target: MidiTarget) {
  useStore.setState({ midiLearn: { label: describeTarget(target), targetJson: JSON.stringify(target) } })
}
export function cancelLearn() {
  useStore.setState({ midiLearn: null })
}

// ---------------- APC40 ----------------
const isApc = (name?: string | null) => /apc40/i.test(name ?? '')
const isApcMk2 = (name?: string | null) => /apc40\s*mk\s*(ii|2)/i.test(name ?? '')

export function hasApc(): boolean {
  let found = false
  access?.inputs.forEach((i) => { if (isApc(i.name)) found = true })
  return found
}

/**
 * Apply the APC40 template:
 *  - 40 clip pads -> scene slots 1-40
 *  - 8 track faders (CC7 ch1-8) -> groups 1-8 if groups exist, else DMX ch 1-8
 *  - master fader (CC14) -> grand master
 *  - scene launch buttons (notes 82-86) -> acts 1-5
 */
export function applyApcTemplate() {
  const state = useStore.getState()
  const mk2 = (() => {
    let found = false
    access?.inputs.forEach((i) => { if (isApcMk2(i.name)) found = true })
    return found
  })()

  const mappings: MidiMapping[] = []
  // clip grid
  for (let slot = 0; slot < 40; slot++) {
    if (mk2) {
      mappings.push({ id: uid(), kind: 'note', midiChannel: 0, code: slot, target: { kind: 'sceneSlot', slot } })
    } else {
      // mk1: notes 53-57 (rows) on channels 0-7 (tracks)
      const row = Math.floor(slot / 8)
      const col = slot % 8
      mappings.push({ id: uid(), kind: 'note', midiChannel: col, code: 53 + row, target: { kind: 'sceneSlot', slot } })
    }
  }
  // track faders
  for (let i = 0; i < 8; i++) {
    const group = state.groups[i]
    mappings.push({
      id: uid(), kind: 'cc', midiChannel: i, code: 7,
      target: group ? { kind: 'group', groupId: group.id } : { kind: 'dmx', channel: i },
    })
  }
  // master fader
  mappings.push({ id: uid(), kind: 'cc', midiChannel: 0, code: 14, target: { kind: 'master' } })
  // scene launch -> acts 1-5
  for (let i = 0; i < 5; i++) {
    const act = state.acts[i]
    if (act) mappings.push({ id: uid(), kind: 'note', midiChannel: 0, code: 82 + i, target: { kind: 'act', actId: act.id } })
  }

  // keep non-APC-conflicting existing mappings out of the way: template replaces everything
  actions.setMidiMappings(mappings)
  toast('ok', `APC40 ${mk2 ? 'mkII ' : ''}template applied (${mappings.length} mappings)`)
  sendApcLeds()
}

/** Pad LEDs: lit where a scene exists, bright/alt color for the last recalled one. */
export function sendApcLeds() {
  if (!access) return
  const { scenes, lastRecalledSceneId, config } = useStore.getState()
  const slotMappings = (config?.midiMappings ?? []).filter((m) => m.target.kind === 'sceneSlot' && m.kind === 'note')
  if (slotMappings.length === 0) return
  access.outputs.forEach((out) => {
    if (!isApc(out.name)) return
    for (const m of slotMappings) {
      const slot = (m.target as { kind: 'sceneSlot'; slot: number }).slot
      const scene = scenes[slot]
      const status = 0x90 | m.midiChannel
      if (!scene) {
        out.send([0x80 | m.midiChannel, m.code, 0])
      } else if (scene.id === lastRecalledSceneId) {
        out.send([status, m.code, 3]) // active: red on mk1, distinct color on mkII
      } else {
        out.send([status, m.code, 1]) // available: green on mk1
      }
    }
  })
}
