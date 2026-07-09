// DMX universe engine: base values, per-channel fades, role-aware grand master,
// blackout, and dirty-tracked output for Art-Net + socket broadcast.
import { DMX_CHANNELS, MASTERED_ROLES } from '../shared/types'
import type { ChannelPair, ChannelRole, Fixture } from '../shared/types'

const clamp = (v: number) => (v < 0 ? 0 : v > 255 ? 255 : Math.round(v))

interface Fade {
  from: number
  to: number
  startAt: number
  durMs: number
}

export class DmxEngine {
  /** Operator-set look values (0-255), before master/blackout. */
  readonly base = new Uint8Array(DMX_CHANNELS)
  /** What actually goes out on the wire. */
  readonly output = new Uint8Array(DMX_CHANNELS)

  master = 255
  blackout = false
  private flashing = false

  private fades = new Map<number, Fade>()
  /** channel -> role, rebuilt when the patch changes. Unpatched = undefined. */
  private roles: (ChannelRole | undefined)[] = new Array(DMX_CHANNELS).fill(undefined)
  private masteredCache: boolean[] = new Array(DMX_CHANNELS).fill(true)

  private dirtyBase = new Set<number>()
  private outputDirty = true

  /** Rebuild channel->role map from the fixture patch. */
  setPatch(fixtures: Fixture[]) {
    this.roles.fill(undefined)
    for (const fixture of fixtures) {
      fixture.channels.forEach((ch, i) => {
        const addr = fixture.startAddress - 1 + i
        if (addr >= 0 && addr < DMX_CHANNELS) this.roles[addr] = ch.role
      })
    }
    for (let i = 0; i < DMX_CHANNELS; i++) {
      const role = this.roles[i]
      // Unpatched channels are treated as dimmers (mastered). Position/beam roles are never scaled.
      this.masteredCache[i] = role === undefined || MASTERED_ROLES.includes(role)
    }
    this.outputDirty = true
  }

  setChannels(pairs: ChannelPair[], fadeMs = 0) {
    const now = Date.now()
    for (const [ch, value] of pairs) {
      if (ch < 0 || ch >= DMX_CHANNELS) continue
      const target = clamp(value)
      if (fadeMs > 15) {
        this.fades.set(ch, { from: this.base[ch], to: target, startAt: now, durMs: fadeMs })
      } else {
        this.fades.delete(ch)
        if (this.base[ch] !== target) {
          this.base[ch] = target
          this.dirtyBase.add(ch)
          this.outputDirty = true
        }
      }
    }
  }

  /** Full-look recall: captured channels fade to their values, all other non-zero channels fade to 0. */
  applyLook(values: Record<number, number>, fadeMs: number) {
    const pairs: ChannelPair[] = []
    const included = new Set<number>()
    for (const key of Object.keys(values)) {
      const ch = Number(key)
      if (Number.isInteger(ch) && ch >= 0 && ch < DMX_CHANNELS) {
        included.add(ch)
        pairs.push([ch, values[ch as unknown as keyof typeof values] as number])
      }
    }
    for (let ch = 0; ch < DMX_CHANNELS; ch++) {
      if (!included.has(ch) && (this.base[ch] !== 0 || this.fades.has(ch))) pairs.push([ch, 0])
    }
    this.setChannels(pairs, fadeMs)
  }

  /** Capture the current look: every non-zero base channel. */
  captureLook(): Record<number, number> {
    const values: Record<number, number> = {}
    for (let ch = 0; ch < DMX_CHANNELS; ch++) {
      const fade = this.fades.get(ch)
      const value = fade ? fade.to : this.base[ch]
      if (value > 0) values[ch] = value
    }
    return values
  }

  setMaster(value: number) {
    const v = clamp(value)
    if (v !== this.master) {
      this.master = v
      this.outputDirty = true
    }
  }

  setBlackout(on: boolean) {
    if (on !== this.blackout) {
      this.blackout = on
      this.outputDirty = true
    }
  }

  setFlash(on: boolean) {
    if (on !== this.flashing) {
      this.flashing = on
      this.outputDirty = true
    }
  }

  /**
   * Advance fades and recompute output. Returns base-value changes to broadcast,
   * plus whether the wire frame changed.
   */
  tick(now = Date.now()): { changedBase: ChannelPair[]; outputChanged: boolean } {
    for (const [ch, fade] of this.fades) {
      const t = fade.durMs <= 0 ? 1 : (now - fade.startAt) / fade.durMs
      const value = t >= 1 ? fade.to : clamp(fade.from + (fade.to - fade.from) * t)
      if (t >= 1) this.fades.delete(ch)
      if (this.base[ch] !== value) {
        this.base[ch] = value
        this.dirtyBase.add(ch)
        this.outputDirty = true
      }
    }

    let outputChanged = false
    if (this.outputDirty) {
      for (let i = 0; i < DMX_CHANNELS; i++) {
        let v = this.base[i]
        if (this.flashing && this.masteredCache[i] && this.roles[i] !== undefined) {
          v = 255
        } else if (this.masteredCache[i]) {
          v = this.blackout ? 0 : Math.round((v * this.master) / 255)
        } else if (this.blackout) {
          // position/beam channels hold during blackout; intensity is already 0
          v = this.base[i]
        }
        if (this.output[i] !== v) {
          this.output[i] = v
          outputChanged = true
        }
      }
      this.outputDirty = false
    }

    const changedBase: ChannelPair[] = []
    for (const ch of this.dirtyBase) changedBase.push([ch, this.base[ch]])
    this.dirtyBase.clear()
    return { changedBase, outputChanged }
  }

  get fadesActive() {
    return this.fades.size > 0
  }
}
