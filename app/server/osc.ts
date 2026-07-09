// Minimal, dependency-free OSC 1.0 codec + UDP endpoint.
import dgram from 'node:dgram'
import type { OscConfig } from '../shared/types'

export type OscArg = number | string
export interface OscMessage { address: string; args: OscArg[] }

const pad4 = (n: number) => (n + 3) & ~3

function readString(buf: Buffer, offset: number): [string, number] {
  const end = buf.indexOf(0, offset)
  const str = buf.toString('ascii', offset, end === -1 ? buf.length : end)
  return [str, pad4((end === -1 ? buf.length : end) + 1)]
}

export function parseOscPacket(buf: Buffer): OscMessage[] {
  try {
    if (buf.length >= 8 && buf.toString('ascii', 0, 7) === '#bundle') {
      const messages: OscMessage[] = []
      let offset = 16 // "#bundle\0" + 8-byte timetag
      while (offset + 4 <= buf.length) {
        const size = buf.readUInt32BE(offset)
        offset += 4
        if (size <= 0 || offset + size > buf.length) break
        messages.push(...parseOscPacket(buf.subarray(offset, offset + size)))
        offset += size
      }
      return messages
    }
    let offset = 0
    const [address, afterAddr] = readString(buf, offset)
    if (!address.startsWith('/')) return []
    offset = afterAddr
    let typeTags = ''
    if (offset < buf.length && buf[offset] === 0x2c /* ',' */) {
      const [tags, afterTags] = readString(buf, offset)
      typeTags = tags.slice(1)
      offset = afterTags
    }
    const args: OscArg[] = []
    for (const tag of typeTags) {
      switch (tag) {
        case 'i': args.push(buf.readInt32BE(offset)); offset += 4; break
        case 'f': args.push(buf.readFloatBE(offset)); offset += 4; break
        case 'd': args.push(buf.readDoubleBE(offset)); offset += 8; break
        case 's': {
          const [s, next] = readString(buf, offset)
          args.push(s); offset = next; break
        }
        case 'T': args.push(1); break
        case 'F': args.push(0); break
        default: return [{ address, args }] // unsupported tag: stop parsing args
      }
    }
    return [{ address, args }]
  } catch {
    return []
  }
}

export function encodeOscMessage(address: string, args: OscArg[]): Buffer {
  const chunks: Buffer[] = []
  const writeString = (s: string) => {
    const b = Buffer.alloc(pad4(s.length + 1))
    b.write(s, 'ascii')
    chunks.push(b)
  }
  writeString(address)
  writeString(',' + args.map((a) => (typeof a === 'string' ? 's' : 'f')).join(''))
  for (const arg of args) {
    if (typeof arg === 'string') {
      writeString(arg)
    } else {
      const b = Buffer.alloc(4)
      b.writeFloatBE(arg)
      chunks.push(b)
    }
  }
  return Buffer.concat(chunks)
}

export class OscEndpoint {
  private server: dgram.Socket | null = null
  private sender: dgram.Socket
  private config: OscConfig
  private onMessage: (msg: OscMessage, from: string) => void
  private onStatus: (listening: boolean, error: string | null) => void

  constructor(
    config: OscConfig,
    onMessage: (msg: OscMessage, from: string) => void,
    onStatus: (listening: boolean, error: string | null) => void,
  ) {
    this.config = config
    this.onMessage = onMessage
    this.onStatus = onStatus
    this.sender = dgram.createSocket('udp4')
    this.sender.on('error', () => { /* sender errors are non-fatal */ })
    this.open()
  }

  setConfig(config: OscConfig) {
    this.config = config
    this.open()
  }

  private open() {
    if (this.server) {
      try { this.server.close() } catch { /* ignore */ }
      this.server = null
    }
    if (!this.config.enabled) {
      this.onStatus(false, null)
      return
    }
    try {
      this.server = dgram.createSocket('udp4')
      this.server.on('error', (err) => {
        this.onStatus(false, err.message)
        try { this.server?.close() } catch { /* ignore */ }
        this.server = null
      })
      this.server.on('message', (data, rinfo) => {
        for (const msg of parseOscPacket(data)) this.onMessage(msg, `${rinfo.address}:${rinfo.port}`)
      })
      this.server.bind(this.config.listenPort, () => this.onStatus(true, null))
    } catch (err) {
      this.onStatus(false, err instanceof Error ? err.message : String(err))
    }
  }

  send(address: string, args: OscArg[]) {
    if (!this.config.sendEnabled || !this.config.sendHost) return
    const buf = encodeOscMessage(address, args)
    this.sender.send(buf, this.config.sendPort, this.config.sendHost, () => { /* fire and forget */ })
  }

  close() {
    try { this.server?.close() } catch { /* ignore */ }
    try { this.sender.close() } catch { /* ignore */ }
  }
}
