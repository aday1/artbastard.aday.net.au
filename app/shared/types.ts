// Shared protocol types between server and UI. This file is the contract.

export type ChannelRole =
  | 'intensity' | 'red' | 'green' | 'blue' | 'white' | 'amber' | 'uv'
  | 'pan' | 'pan_fine' | 'tilt' | 'tilt_fine'
  | 'strobe' | 'gobo' | 'color_wheel' | 'zoom' | 'focus' | 'prism' | 'speed' | 'macro' | 'other'

/** Roles the grand master is allowed to scale. Position/beam roles are never scaled. */
export const MASTERED_ROLES: ChannelRole[] = [
  'intensity', 'red', 'green', 'blue', 'white', 'amber', 'uv',
]

export interface FixtureChannel {
  name: string
  role: ChannelRole
}

export interface FixtureProfile {
  id: string
  name: string
  manufacturer?: string
  channels: FixtureChannel[]
}

export interface Fixture {
  id: string
  name: string
  profileId?: string
  /** 1-based DMX start address */
  startAddress: number
  /** Copied from profile at patch time so fixtures are self-contained */
  channels: FixtureChannel[]
}

export interface Group {
  id: string
  name: string
  fixtureIds: string[]
}

export interface Scene {
  id: string
  name: string
  /** Sparse capture: 0-based channel -> value. Recall is full-look (others fade to 0). */
  values: Record<number, number>
  /** Default fade used when recalling this scene */
  fadeMs: number
  createdAt: number
}

export interface ActStep {
  sceneId: string
  fadeMs: number
  holdMs: number
}

export interface Act {
  id: string
  name: string
  steps: ActStep[]
  loop: boolean
}

export interface ActStatus {
  actId: string | null
  stepIndex: number
  playing: boolean
  /** epoch ms when current step began (fade start) */
  stepStartedAt: number
}

export interface ArtNetConfig {
  enabled: boolean
  ip: string
  port: number
  net: number
  subnet: number
  universe: number
}

export interface OscConfig {
  enabled: boolean
  listenPort: number
  sendEnabled: boolean
  sendHost: string
  sendPort: number
}

export type MidiTarget =
  | { kind: 'dmx'; channel: number }        // 0-based channel
  | { kind: 'master' }
  | { kind: 'blackout' }
  | { kind: 'flash' }
  | { kind: 'scene'; sceneId: string }
  | { kind: 'sceneSlot'; slot: number }     // recall Nth scene (0-based), used by APC pads
  | { kind: 'act'; actId: string }
  | { kind: 'group'; groupId: string }      // group intensity

export interface MidiMapping {
  id: string
  kind: 'cc' | 'note'
  midiChannel: number   // 0-15
  code: number          // CC number or note number
  target: MidiTarget
}

export interface AppConfig {
  artnet: ArtNetConfig
  osc: OscConfig
  midiMappings: MidiMapping[]
}

export interface InitState {
  version: string
  dmx: number[]
  master: number
  blackout: boolean
  fixtures: Fixture[]
  groups: Group[]
  scenes: Scene[]
  acts: Act[]
  actStatus: ActStatus
  config: AppConfig
  artnetOk: boolean
}

/** [channel(0-based), value(0-255)] */
export type ChannelPair = [number, number]

// ---- socket event payloads (client -> server) ----
export interface SetChannelsMsg { pairs: ChannelPair[]; fadeMs?: number }
export interface SaveSceneMsg { name?: string; id?: string; fadeMs?: number }
export interface RecallSceneMsg { id: string; fadeMs?: number }
export interface SceneMetaMsg { id: string; name?: string; fadeMs?: number }
export interface ActPlayMsg { actId: string; stepIndex?: number }

export const DMX_CHANNELS = 512
