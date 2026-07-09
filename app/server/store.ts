// JSON persistence with debounced atomic writes + one-time legacy config import.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Act, AppConfig, Fixture, Group, Scene } from '../shared/types'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
// dist/server.js -> app/data ; server/store.ts (tsx dev) -> app/data
const APP_ROOT = path.resolve(__dirname, '..')
export const DATA_DIR = process.env.ARTBASTARD_DATA || path.join(APP_ROOT, 'data')
const LEGACY_CONFIG_CANDIDATES = [
  path.join(DATA_DIR, 'config.json'),
  path.resolve(APP_ROOT, '..', 'data', 'config.json'),
]

export const defaultConfig = (): AppConfig => ({
  artnet: { enabled: true, ip: '255.255.255.255', port: 6454, net: 0, subnet: 0, universe: 0 },
  osc: { enabled: false, listenPort: 57121, sendEnabled: false, sendHost: '127.0.0.1', sendPort: 57120 },
  midiMappings: [],
})

export interface PersistedState {
  config: AppConfig
  fixtures: Fixture[]
  groups: Group[]
  scenes: Scene[]
  acts: Act[]
  /** last look, restored on boot so a restart doesn't blackout the rig */
  dmx: number[]
  master: number
}

function readJson<T>(file: string, fallback: T): T {
  try {
    if (!fs.existsSync(file)) return fallback
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'))
    return { ...fallback, ...parsed }
  } catch (err) {
    console.warn(`[store] could not read ${path.basename(file)}: ${err instanceof Error ? err.message : err}`)
    return fallback
  }
}

export class Store {
  state: PersistedState
  private file = path.join(DATA_DIR, 'state.json')
  private writeTimer: NodeJS.Timeout | null = null

  constructor() {
    fs.mkdirSync(DATA_DIR, { recursive: true })
    const fallback: PersistedState = {
      config: defaultConfig(),
      fixtures: [],
      groups: [],
      scenes: [],
      acts: [],
      dmx: [],
      master: 255,
    }
    this.state = readJson(this.file, fallback)
    // deep-merge config so new fields get defaults after upgrades
    this.state.config = {
      ...defaultConfig(),
      ...this.state.config,
      artnet: { ...defaultConfig().artnet, ...this.state.config?.artnet },
      osc: { ...defaultConfig().osc, ...this.state.config?.osc },
      midiMappings: this.state.config?.midiMappings ?? [],
    }
    this.importLegacyConfig()
  }

  /** First boot only: pull Art-Net settings from the v5 data/config.json if present. */
  private importLegacyConfig() {
    if (fs.existsSync(this.file)) return
    try {
      const legacyFile = LEGACY_CONFIG_CANDIDATES.find((f) => fs.existsSync(f))
      if (!legacyFile) return
      const legacy = JSON.parse(fs.readFileSync(legacyFile, 'utf8'))
      const artnet = legacy?.artNetConfig
      if (artnet?.ip) {
        this.state.config.artnet = {
          ...this.state.config.artnet,
          ip: String(artnet.ip),
          port: Number(artnet.port) || 6454,
          net: Number(artnet.net) || 0,
          subnet: Number(artnet.subnet) || 0,
          universe: Number(artnet.universe) || 0,
        }
        console.log(`[store] imported legacy Art-Net config (${artnet.ip})`)
        this.save()
      }
    } catch {
      /* legacy import is best-effort */
    }
  }

  save() {
    if (this.writeTimer) return
    this.writeTimer = setTimeout(() => {
      this.writeTimer = null
      this.flush()
    }, 400)
  }

  flush() {
    if (this.writeTimer) {
      clearTimeout(this.writeTimer)
      this.writeTimer = null
    }
    try {
      const tmp = this.file + '.tmp'
      fs.writeFileSync(tmp, JSON.stringify(this.state, null, 1))
      fs.renameSync(tmp, this.file)
    } catch (err) {
      console.error(`[store] save failed: ${err instanceof Error ? err.message : err}`)
    }
  }
}
