// Server-side act (cue sequence) playback. Runs on the server so playback
// never depends on a browser tab being open or unthrottled.
import type { Act, ActStatus, Scene } from '../shared/types'

interface ActsHost {
  getActs(): Act[]
  getScenes(): Scene[]
  recallScene(scene: Scene, fadeMs: number): void
  onStatus(status: ActStatus): void
}

export class ActsEngine {
  private host: ActsHost
  private timer: NodeJS.Timeout | null = null
  status: ActStatus = { actId: null, stepIndex: 0, playing: false, stepStartedAt: 0 }

  constructor(host: ActsHost) {
    this.host = host
  }

  play(actId: string, stepIndex = 0) {
    const act = this.host.getActs().find((a) => a.id === actId)
    if (!act || act.steps.length === 0) return
    this.clearTimer()
    this.status = { actId, stepIndex: Math.min(stepIndex, act.steps.length - 1), playing: true, stepStartedAt: Date.now() }
    this.runStep()
  }

  stop() {
    this.clearTimer()
    if (this.status.playing || this.status.actId) {
      this.status = { actId: null, stepIndex: 0, playing: false, stepStartedAt: 0 }
      this.host.onStatus(this.status)
    }
  }

  next() { this.jump(1) }
  prev() { this.jump(-1) }

  private jump(delta: number) {
    if (!this.status.actId) return
    const act = this.host.getActs().find((a) => a.id === this.status.actId)
    if (!act || act.steps.length === 0) return
    const n = act.steps.length
    const idx = ((this.status.stepIndex + delta) % n + n) % n
    this.clearTimer()
    this.status = { ...this.status, stepIndex: idx, stepStartedAt: Date.now() }
    if (this.status.playing) {
      this.runStep()
    } else {
      // paused scrub: recall the step but do not schedule advance
      this.recallCurrent(act)
      this.host.onStatus(this.status)
    }
  }

  /** Called when acts are edited: keep playback sane. */
  actsUpdated() {
    if (!this.status.actId) return
    const act = this.host.getActs().find((a) => a.id === this.status.actId)
    if (!act || act.steps.length === 0) {
      this.stop()
    } else if (this.status.stepIndex >= act.steps.length) {
      this.status = { ...this.status, stepIndex: 0 }
      this.host.onStatus(this.status)
    }
  }

  private recallCurrent(act: Act) {
    const step = act.steps[this.status.stepIndex]
    if (!step) return
    const scene = this.host.getScenes().find((s) => s.id === step.sceneId)
    if (scene) this.host.recallScene(scene, step.fadeMs)
  }

  private runStep() {
    const act = this.host.getActs().find((a) => a.id === this.status.actId)
    if (!act || act.steps.length === 0) { this.stop(); return }
    const step = act.steps[this.status.stepIndex]
    this.recallCurrent(act)
    this.host.onStatus(this.status)
    const dwellMs = Math.max(50, step.fadeMs + step.holdMs)
    this.timer = setTimeout(() => {
      const isLast = this.status.stepIndex >= act.steps.length - 1
      if (isLast && !act.loop) {
        this.status = { ...this.status, playing: false }
        this.host.onStatus(this.status)
        return
      }
      this.status = {
        ...this.status,
        stepIndex: isLast ? 0 : this.status.stepIndex + 1,
        stepStartedAt: Date.now(),
      }
      this.runStep()
    }, dwellMs)
  }

  private clearTimer() {
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
  }
}
