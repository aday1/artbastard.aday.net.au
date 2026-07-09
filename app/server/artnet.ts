// Minimal, dependency-free Art-Net (ArtDMX) sender over UDP.
import dgram from 'node:dgram'
import type { ArtNetConfig } from '../shared/types'

const HEADER = Buffer.from('Art-Net\0', 'ascii')
const OP_DMX = 0x5000
const PROT_VER = 14

export class ArtNetSender {
  private socket: dgram.Socket | null = null
  private sequence = 1
  private config: ArtNetConfig
  private lastError: string | null = null
  private lastOkAt = 0
  private onStatus: (ok: boolean, error: string | null) => void

  constructor(config: ArtNetConfig, onStatus: (ok: boolean, error: string | null) => void) {
    this.config = config
    this.onStatus = onStatus
    this.open()
  }

  private open() {
    this.close()
    try {
      this.socket = dgram.createSocket('udp4')
      this.socket.on('error', (err) => this.fail(err.message))
      this.socket.bind(() => {
        try { this.socket?.setBroadcast(true) } catch { /* not fatal */ }
      })
    } catch (err) {
      this.fail(err instanceof Error ? err.message : String(err))
    }
  }

  setConfig(config: ArtNetConfig) {
    this.config = config
    this.lastError = null
    this.open()
  }

  get status() {
    return { ok: this.lastError === null, error: this.lastError, lastOkAt: this.lastOkAt }
  }

  private fail(message: string) {
    const changed = this.lastError !== message
    this.lastError = message
    if (changed) this.onStatus(false, message)
  }

  /** Send a full 512-channel frame. */
  send(data: Uint8Array) {
    if (!this.config.enabled || !this.socket) return
    const packet = Buffer.alloc(18 + 512)
    HEADER.copy(packet, 0)
    packet.writeUInt16LE(OP_DMX, 8)
    packet.writeUInt16BE(PROT_VER, 10)
    packet[12] = this.sequence
    this.sequence = this.sequence >= 255 ? 1 : this.sequence + 1
    packet[13] = 0 // physical
    // 15-bit port address: net(7) | subnet(4) | universe(4)
    packet[14] = ((this.config.subnet & 0x0f) << 4) | (this.config.universe & 0x0f)
    packet[15] = this.config.net & 0x7f
    packet.writeUInt16BE(512, 16)
    Buffer.from(data.buffer, data.byteOffset, 512).copy(packet, 18)
    this.socket.send(packet, this.config.port || 6454, this.config.ip, (err) => {
      if (err) {
        this.fail(err.message)
      } else {
        this.lastOkAt = Date.now()
        if (this.lastError !== null) {
          this.lastError = null
          this.onStatus(true, null)
        }
      }
    })
  }

  close() {
    try { this.socket?.close() } catch { /* already closed */ }
    this.socket = null
  }
}
