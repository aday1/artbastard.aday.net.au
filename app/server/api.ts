// HTTP + Socket.IO API, engine tick loop, and OSC routing.
import type { Express, Request, Response } from 'express'
import type { Server as SocketServer, Socket } from 'socket.io'
import { DmxEngine } from './dmx'
import { ActsEngine } from './acts'
import { ArtNetSender } from './artnet'
import { OscEndpoint, type OscMessage } from './osc'
import { Store } from './store'
import { DMX_CHANNELS } from '../shared/types'
import type {
  Act, ActPlayMsg, AppConfig, ArtNetConfig, ChannelPair, Fixture, Group, InitState,
  MidiMapping, OscConfig, RecallSceneMsg, SaveSceneMsg, Scene, SceneMetaMsg, SetChannelsMsg,
} from '../shared/types'

export const VERSION = '6.0.0'

const TICK_MS = 25
const KEEPALIVE_MS = 900

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const str = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v.slice(0, 200) : fallback)

function sanitizePairs(raw: unknown): ChannelPair[] {
  if (!Array.isArray(raw)) return []
  const pairs: ChannelPair[] = []
  for (const item of raw) {
    if (Array.isArray(item) && isNum(item[0]) && isNum(item[1])) pairs.push([item[0], item[1]])
    if (pairs.length >= DMX_CHANNELS) break
  }
  return pairs
}

function sanitizeFixtures(raw: unknown): Fixture[] | null {
  if (!Array.isArray(raw)) return null
  const out: Fixture[] = []
  for (const f of raw.slice(0, 256)) {
    if (!f || typeof f !== 'object') continue
    const fx = f as Record<string, unknown>
    if (!Array.isArray(fx.channels)) continue
    out.push({
      id: str(fx.id) || `fx-${Math.random().toString(36).slice(2, 9)}`,
      name: str(fx.name, 'Fixture'),
      profileId: fx.profileId ? str(fx.profileId) : undefined,
      startAddress: Math.max(1, Math.min(DMX_CHANNELS, isNum(fx.startAddress) ? Math.round(fx.startAddress) : 1)),
      channels: (fx.channels as unknown[]).slice(0, 64).map((c) => {
        const ch = (c ?? {}) as Record<string, unknown>
        return { name: str(ch.name, 'ch'), role: (str(ch.role, 'other') as Fixture['channels'][number]['role']) }
      }),
    })
  }
  return out
}

function sanitizeActs(raw: unknown): Act[] | null {
  if (!Array.isArray(raw)) return null
  return raw.slice(0, 128).flatMap((a) => {
    if (!a || typeof a !== 'object') return []
    const act = a as Record<string, unknown>
    const steps = Array.isArray(act.steps) ? act.steps : []
    return [{
      id: str(act.id) || `act-${Math.random().toString(36).slice(2, 9)}`,
      name: str(act.name, 'Act'),
      loop: Boolean(act.loop),
      steps: steps.slice(0, 512).flatMap((s) => {
        const step = (s ?? {}) as Record<string, unknown>
        if (!step.sceneId) return []
        return [{
          sceneId: str(step.sceneId),
          fadeMs: Math.max(0, Math.min(600000, isNum(step.fadeMs) ? step.fadeMs : 1000)),
          holdMs: Math.max(0, Math.min(6000000, isNum(step.holdMs) ? step.holdMs : 2000)),
        }]
      }),
    }]
  })
}

function sanitizeGroups(raw: unknown): Group[] | null {
  if (!Array.isArray(raw)) return null
  return raw.slice(0, 128).flatMap((g) => {
    if (!g || typeof g !== 'object') return []
    const grp = g as Record<string, unknown>
    return [{
      id: str(grp.id) || `grp-${Math.random().toString(36).slice(2, 9)}`,
      name: str(grp.name, 'Group'),
      fixtureIds: Array.isArray(grp.fixtureIds) ? grp.fixtureIds.slice(0, 256).map((x) => str(x)) : [],
    }]
  })
}

export class Controller {
  engine = new DmxEngine()
  store = new Store()
  artnet: ArtNetSender
  osc: OscEndpoint
  acts: ActsEngine
  private io: SocketServer
  private lastArtnetSend = 0
  private oscListening = false
  private oscError: string | null = null

  constructor(io: SocketServer) {
    this.io = io
    const { state } = this.store

    // restore last look
    if (Array.isArray(state.dmx) && state.dmx.length) {
      const pairs: ChannelPair[] = []
      state.dmx.slice(0, DMX_CHANNELS).forEach((v, i) => { if (isNum(v) && v > 0) pairs.push([i, v]) })
      this.engine.setChannels(pairs)
    }
    this.engine.setMaster(isNum(state.master) ? state.master : 255)
    this.engine.setPatch(state.fixtures)

    this.artnet = new ArtNetSender(state.config.artnet, (ok, error) => {
      this.io.emit('artnet', { ok, error })
    })
    this.osc = new OscEndpoint(
      state.config.osc,
      (msg, from) => this.handleOsc(msg, from),
      (listening, error) => {
        this.oscListening = listening
        this.oscError = error
        this.io.emit('oscStatus', { listening, error })
      },
    )
    this.acts = new ActsEngine({
      getActs: () => this.store.state.acts,
      getScenes: () => this.store.state.scenes,
      recallScene: (scene, fadeMs) => this.recallScene(scene, fadeMs),
      onStatus: (status) => this.io.emit('actStatus', status),
    })

    setInterval(() => this.tick(), TICK_MS)
    // persist current look periodically (cheap; store debounces)
    setInterval(() => {
      this.store.state.dmx = Array.from(this.engine.base)
      this.store.state.master = this.engine.master
      this.store.save()
    }, 5000)
  }

  private tick() {
    const { changedBase, outputChanged } = this.engine.tick()
    if (changedBase.length) {
      this.io.emit('dmx', changedBase)
      if (this.store.state.config.osc.sendEnabled) {
        for (const [ch, v] of changedBase.slice(0, 64)) this.osc.send(`/dmx/${ch + 1}`, [v / 255])
      }
    }
    const now = Date.now()
    if (outputChanged || now - this.lastArtnetSend > KEEPALIVE_MS) {
      this.artnet.send(this.engine.output)
      this.lastArtnetSend = now
    }
  }

  recallScene(scene: Scene, fadeMs?: number) {
    this.engine.applyLook(scene.values, fadeMs ?? scene.fadeMs)
    this.io.emit('sceneRecalled', { id: scene.id, fadeMs: fadeMs ?? scene.fadeMs })
  }

  initState(): InitState {
    const { state } = this.store
    return {
      version: VERSION,
      dmx: Array.from(this.engine.base),
      master: this.engine.master,
      blackout: this.engine.blackout,
      fixtures: state.fixtures,
      groups: state.groups,
      scenes: state.scenes,
      acts: state.acts,
      actStatus: this.acts.status,
      config: state.config,
      artnetOk: this.artnet.status.ok,
    }
  }

  // ---------- OSC ----------
  private handleOsc(msg: OscMessage, from: string) {
    const value = isNum(msg.args[0]) ? (msg.args[0] as number) : 1
    const to255 = (v: number) => (v <= 1 ? Math.round(v * 255) : Math.round(v))
    let mapped: string | null = null

    const dmxMatch = msg.address.match(/^\/dmx\/(\d+)$/) || msg.address.match(/^\/\d+\/dmx(\d+)$/)
    if (dmxMatch) {
      const ch = parseInt(dmxMatch[1], 10) - 1
      this.engine.setChannels([[ch, to255(value)]])
      mapped = `ch ${ch + 1} = ${to255(value)}`
    } else if (msg.address === '/master') {
      this.engine.setMaster(to255(value))
      this.io.emit('master', this.engine.master)
      mapped = `master = ${to255(value)}`
    } else if (msg.address === '/blackout') {
      this.engine.setBlackout(value >= 0.5)
      this.io.emit('blackout', this.engine.blackout)
      mapped = `blackout ${value >= 0.5 ? 'on' : 'off'}`
    } else {
      const sceneMatch = msg.address.match(/^\/scene\/(\d+)$/)
      const actMatch = msg.address.match(/^\/act\/(\d+)$/)
      if (sceneMatch && value >= 0.5) {
        const scene = this.store.state.scenes[parseInt(sceneMatch[1], 10) - 1]
        if (scene) { this.recallScene(scene); mapped = `scene "${scene.name}"` }
      } else if (actMatch) {
        const act = this.store.state.acts[parseInt(actMatch[1], 10) - 1]
        if (act) {
          if (value >= 0.5) { this.acts.play(act.id); mapped = `act "${act.name}" play` }
          else { this.acts.stop(); mapped = 'act stop' }
        }
      }
    }
    this.io.emit('oscIn', { address: msg.address, args: msg.args, from, mapped, at: Date.now() })
  }

  get oscStatus() {
    return { listening: this.oscListening, error: this.oscError }
  }

  // ---------- mutations shared by socket + http ----------
  saveScene(msg: SaveSceneMsg): Scene {
    const { state } = this.store
    const existing = msg.id ? state.scenes.find((s) => s.id === msg.id) : undefined
    if (existing) {
      existing.values = this.engine.captureLook()
      if (msg.name) existing.name = str(msg.name)
      if (isNum(msg.fadeMs)) existing.fadeMs = msg.fadeMs
      this.store.save()
      this.io.emit('scenes', state.scenes)
      return existing
    }
    const scene: Scene = {
      id: `scene-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      name: str(msg.name) || `Scene ${state.scenes.length + 1}`,
      values: this.engine.captureLook(),
      fadeMs: isNum(msg.fadeMs) ? msg.fadeMs : 1000,
      createdAt: Date.now(),
    }
    state.scenes.push(scene)
    this.store.save()
    this.io.emit('scenes', state.scenes)
    return scene
  }

  setFixtures(fixtures: Fixture[]) {
    this.store.state.fixtures = fixtures
    this.engine.setPatch(fixtures)
    this.store.save()
    this.io.emit('fixtures', fixtures)
  }

  setGroupLevel(groupId: string, value: number) {
    const group = this.store.state.groups.find((g) => g.id === groupId)
    if (!group) return
    const pairs: ChannelPair[] = []
    for (const fxId of group.fixtureIds) {
      const fixture = this.store.state.fixtures.find((f) => f.id === fxId)
      if (!fixture) continue
      const intensityIdx = fixture.channels.findIndex((c) => c.role === 'intensity')
      if (intensityIdx >= 0) {
        pairs.push([fixture.startAddress - 1 + intensityIdx, value])
      } else {
        fixture.channels.forEach((c, i) => {
          if (['red', 'green', 'blue', 'white', 'amber', 'uv'].includes(c.role)) {
            pairs.push([fixture.startAddress - 1 + i, value])
          }
        })
      }
    }
    this.engine.setChannels(pairs)
  }

  // ---------- socket wiring ----------
  attachSocket(socket: Socket) {
    socket.emit('init', this.initState())

    socket.on('setChannels', (msg: SetChannelsMsg) => {
      this.engine.setChannels(sanitizePairs(msg?.pairs), isNum(msg?.fadeMs) ? msg.fadeMs : 0)
    })
    socket.on('setMaster', (value: number) => {
      if (!isNum(value)) return
      this.engine.setMaster(value)
      socket.broadcast.emit('master', this.engine.master)
    })
    socket.on('setBlackout', (on: boolean) => {
      this.engine.setBlackout(Boolean(on))
      this.io.emit('blackout', this.engine.blackout)
    })
    socket.on('flash', (on: boolean) => this.engine.setFlash(Boolean(on)))

    socket.on('saveScene', (msg: SaveSceneMsg, ack?: (scene: Scene) => void) => {
      const scene = this.saveScene(msg ?? {})
      ack?.(scene)
    })
    socket.on('recallScene', (msg: RecallSceneMsg) => {
      const scene = this.store.state.scenes.find((s) => s.id === msg?.id)
      if (scene) this.recallScene(scene, isNum(msg?.fadeMs) ? msg.fadeMs : undefined)
    })
    socket.on('sceneMeta', (msg: SceneMetaMsg) => {
      const scene = this.store.state.scenes.find((s) => s.id === msg?.id)
      if (!scene) return
      if (msg.name !== undefined) scene.name = str(msg.name, scene.name)
      if (isNum(msg.fadeMs)) scene.fadeMs = Math.max(0, msg.fadeMs)
      this.store.save()
      this.io.emit('scenes', this.store.state.scenes)
    })
    socket.on('deleteScene', (id: string) => {
      const { state } = this.store
      state.scenes = state.scenes.filter((s) => s.id !== id)
      state.acts = state.acts.map((a) => ({ ...a, steps: a.steps.filter((st) => st.sceneId !== id) }))
      this.acts.actsUpdated()
      this.store.save()
      this.io.emit('scenes', state.scenes)
      this.io.emit('acts', state.acts)
    })

    socket.on('setFixtures', (raw: unknown) => {
      const fixtures = sanitizeFixtures(raw)
      if (fixtures) this.setFixtures(fixtures)
    })
    socket.on('setGroups', (raw: unknown) => {
      const groups = sanitizeGroups(raw)
      if (!groups) return
      this.store.state.groups = groups
      this.store.save()
      this.io.emit('groups', groups)
    })
    socket.on('setGroupLevel', (msg: { groupId: string; value: number }) => {
      if (msg && isNum(msg.value)) this.setGroupLevel(str(msg.groupId), msg.value)
    })

    socket.on('setActs', (raw: unknown) => {
      const acts = sanitizeActs(raw)
      if (!acts) return
      this.store.state.acts = acts
      this.acts.actsUpdated()
      this.store.save()
      this.io.emit('acts', acts)
    })
    socket.on('actPlay', (msg: ActPlayMsg) => {
      if (msg?.actId) this.acts.play(str(msg.actId), isNum(msg.stepIndex) ? msg.stepIndex : 0)
    })
    socket.on('actStop', () => this.acts.stop())
    socket.on('actNext', () => this.acts.next())
    socket.on('actPrev', () => this.acts.prev())

    socket.on('setArtnet', (raw: Partial<ArtNetConfig>) => {
      const cfg = this.store.state.config
      cfg.artnet = {
        enabled: raw?.enabled !== undefined ? Boolean(raw.enabled) : cfg.artnet.enabled,
        ip: str(raw?.ip, cfg.artnet.ip),
        port: isNum(raw?.port) ? raw.port : cfg.artnet.port,
        net: isNum(raw?.net) ? raw.net : cfg.artnet.net,
        subnet: isNum(raw?.subnet) ? raw.subnet : cfg.artnet.subnet,
        universe: isNum(raw?.universe) ? raw.universe : cfg.artnet.universe,
      }
      this.artnet.setConfig(cfg.artnet)
      this.store.save()
      this.io.emit('config', cfg)
    })
    socket.on('setOsc', (raw: Partial<OscConfig>) => {
      const cfg = this.store.state.config
      cfg.osc = {
        enabled: raw?.enabled !== undefined ? Boolean(raw.enabled) : cfg.osc.enabled,
        listenPort: isNum(raw?.listenPort) ? raw.listenPort : cfg.osc.listenPort,
        sendEnabled: raw?.sendEnabled !== undefined ? Boolean(raw.sendEnabled) : cfg.osc.sendEnabled,
        sendHost: str(raw?.sendHost, cfg.osc.sendHost),
        sendPort: isNum(raw?.sendPort) ? raw.sendPort : cfg.osc.sendPort,
      }
      this.osc.setConfig(cfg.osc)
      this.store.save()
      this.io.emit('config', cfg)
    })
    socket.on('setMidiMappings', (raw: unknown) => {
      if (!Array.isArray(raw)) return
      this.store.state.config.midiMappings = raw.slice(0, 512) as MidiMapping[]
      this.store.save()
      this.io.emit('config', this.store.state.config)
    })

    socket.on('factoryReset', () => {
      const { state } = this.store
      state.fixtures = []; state.groups = []; state.scenes = []; state.acts = []
      state.config = { ...state.config, midiMappings: [] }
      this.acts.stop()
      this.engine.setPatch([])
      this.engine.applyLook({}, 0)
      this.store.flush()
      this.io.emit('init', this.initState())
    })
  }

  // ---------- http wiring ----------
  attachHttp(app: Express) {
    app.get('/api/health', (_req, res) => res.json({ ok: true, version: VERSION }))
    app.get('/api/state', (_req, res) => res.json(this.initState()))
    app.post('/api/dmx', (req: Request, res: Response) => {
      const { channel, value } = req.body ?? {}
      if (!isNum(channel) || !isNum(value)) return res.status(400).json({ error: 'channel and value required (0-based, 0-255)' })
      this.engine.setChannels([[channel, value]])
      return res.json({ ok: true })
    })
    app.post('/api/dmx/batch', (req: Request, res: Response) => {
      const pairs = sanitizePairs(req.body?.pairs)
      const map = req.body?.channels
      if (map && typeof map === 'object') {
        for (const [k, v] of Object.entries(map)) {
          if (isNum(Number(k)) && isNum(v)) pairs.push([Number(k), v as number])
        }
      }
      this.engine.setChannels(pairs, isNum(req.body?.fadeMs) ? req.body.fadeMs : 0)
      return res.json({ ok: true, applied: pairs.length })
    })
    app.get('/api/scenes', (_req, res) => res.json(this.store.state.scenes))
    app.post('/api/scenes/:id/recall', (req: Request, res: Response) => {
      const scene = this.store.state.scenes.find((s) => s.id === req.params.id || s.name === req.params.id)
      if (!scene) return res.status(404).json({ error: 'scene not found' })
      this.recallScene(scene, isNum(req.body?.fadeMs) ? req.body.fadeMs : undefined)
      return res.json({ ok: true })
    })
  }
}
