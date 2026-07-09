// End-to-end: boots the built server (dist/server.js) on a scratch port with a
// scratch data dir, then exercises HTTP + socket + OSC + Art-Net for real.
// Run: npm run test:e2e
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import dgram from 'node:dgram'
import os from 'node:os'
import path from 'node:path'
import fs from 'node:fs'
import { spawn, type ChildProcess } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { io, type Socket } from 'socket.io-client'
import { encodeOscMessage } from './osc'

const PORT = Number(process.env.E2E_PORT) || 3040
const BASE = `http://127.0.0.1:${PORT}`
let socket: Socket
let server: ChildProcess

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))
const once = <T = unknown>(event: string, timeoutMs = 3000): Promise<T> =>
  new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`timeout waiting for ${event}`)), timeoutMs)
    socket.once(event, (payload: T) => { clearTimeout(t); resolve(payload) })
  })

before(async () => {
  const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ab-e2e-'))
  server = spawn(process.execPath, [path.join(appRoot, 'dist', 'server.js')], {
    env: { ...process.env, PORT: String(PORT), ARTBASTARD_DATA: dataDir },
    stdio: 'ignore',
  })
  let up = false
  for (let i = 0; i < 40 && !up; i++) {
    await wait(150)
    try {
      const res = await fetch(`${BASE}/api/health`)
      up = res.ok
    } catch { /* not up yet */ }
  }
  if (!up) throw new Error('server did not come up - did you run npm run build:server first?')

  socket = io(BASE, { transports: ['websocket'] })
  await new Promise<void>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('socket connect timeout')), 4000)
    socket.on('connect', () => { clearTimeout(t); resolve() })
  })
  await once('init')
})

after(() => {
  socket?.close()
  server?.kill()
})

test('http api sets channels', async () => {
  const res = await fetch(`${BASE}/api/dmx`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ channel: 100, value: 222 }),
  })
  assert.equal(res.status, 200)
  await wait(80)
  const state = await (await fetch(`${BASE}/api/state`)).json() as { dmx: number[] }
  assert.equal(state.dmx[100], 222)
})

test('socket channel set broadcasts', async () => {
  const pairsPromise = once<[number, number][]>('dmx')
  socket.emit('setChannels', { pairs: [[5, 123]] })
  const pairs = await pairsPromise
  assert.ok(pairs.some(([ch, v]) => ch === 5 && v === 123))
})

test('scene save + recall roundtrip with fade', async () => {
  socket.emit('setChannels', { pairs: [[10, 200], [11, 150]] })
  await wait(60)
  const scene = await new Promise<{ id: string; values: Record<number, number> }>((resolve) =>
    socket.emit('saveScene', { name: 'e2e look', fadeMs: 100 }, resolve))
  assert.equal(scene.values[10], 200)

  socket.emit('setChannels', { pairs: [[10, 0], [11, 0], [12, 99]] })
  await wait(60)
  socket.emit('recallScene', { id: scene.id })
  await wait(300)
  const state = await (await fetch(`${BASE}/api/state`)).json() as { dmx: number[] }
  assert.equal(state.dmx[10], 200, 'scene channel restored')
  assert.equal(state.dmx[12], 0, 'non-scene channel zeroed by full-look recall')
})

test('act playback advances on the server', async () => {
  socket.emit('setChannels', { pairs: [[20, 255]] })
  await wait(60)
  const sceneA = await new Promise<{ id: string }>((r) => socket.emit('saveScene', { name: 'A' }, r))
  socket.emit('setChannels', { pairs: [[20, 0], [21, 255]] })
  await wait(60)
  const sceneB = await new Promise<{ id: string }>((r) => socket.emit('saveScene', { name: 'B' }, r))

  socket.emit('setActs', [{
    id: 'act-e2e', name: 'E2E', loop: true,
    steps: [
      { sceneId: sceneA.id, fadeMs: 0, holdMs: 120 },
      { sceneId: sceneB.id, fadeMs: 0, holdMs: 120 },
    ],
  }])
  await once('acts')

  socket.emit('actPlay', { actId: 'act-e2e' })
  const s1 = await once<{ stepIndex: number; playing: boolean }>('actStatus')
  assert.equal(s1.playing, true)
  const s2 = await once<{ stepIndex: number }>('actStatus')
  assert.equal(s2.stepIndex, (s1.stepIndex + 1) % 2, 'advanced to next step')
  socket.emit('actStop')
  await once('actStatus')
})

test('osc input sets channels', async () => {
  socket.emit('setOsc', { enabled: true, listenPort: 57191 })
  await wait(250)
  const udp = dgram.createSocket('udp4')
  udp.send(encodeOscMessage('/dmx/300', [0.5]), 57191, '127.0.0.1')
  await wait(250)
  udp.close()
  const state = await (await fetch(`${BASE}/api/state`)).json() as { dmx: number[] }
  assert.equal(state.dmx[299], 128)
})

test('artnet frames arrive at the node', async () => {
  const received: Buffer[] = []
  const listener = dgram.createSocket({ type: 'udp4', reuseAddr: true })
  await new Promise<void>((resolve) => listener.bind(6455, '127.0.0.1', resolve))
  listener.on('message', (m) => received.push(m))

  socket.emit('setArtnet', { enabled: true, ip: '127.0.0.1', port: 6455 })
  socket.emit('setChannels', { pairs: [[0, 77]] })
  await wait(400)
  listener.close()

  assert.ok(received.length > 0, 'received art-net packets')
  const pkt = received[received.length - 1]
  assert.equal(pkt.toString('ascii', 0, 7), 'Art-Net')
  assert.equal(pkt.readUInt16LE(8), 0x5000, 'ArtDMX opcode')
  assert.equal(pkt.readUInt16BE(16), 512, 'full frame length')
  assert.equal(pkt[18], 77, 'channel 1 value on the wire')
})
