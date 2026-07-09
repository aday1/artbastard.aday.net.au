// Engine + codec unit tests: node --test --import tsx server/engine.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DmxEngine } from './dmx'
import { parseOscPacket, encodeOscMessage } from './osc'
import type { Fixture } from '../shared/types'

const mover: Fixture = {
  id: 'm1', name: 'Mover', startAddress: 10,
  channels: [
    { name: 'Pan', role: 'pan' },
    { name: 'Tilt', role: 'tilt' },
    { name: 'Dimmer', role: 'intensity' },
  ],
}

test('set + master scaling is role-aware', () => {
  const e = new DmxEngine()
  e.setPatch([mover])
  e.setChannels([[9, 200], [10, 100], [11, 255]]) // pan, tilt, dimmer (0-based)
  e.tick()
  assert.equal(e.output[9], 200)
  assert.equal(e.output[11], 255)

  e.setMaster(128)
  e.tick()
  assert.equal(e.output[9], 200, 'pan must not scale with master')
  assert.equal(e.output[10], 100, 'tilt must not scale with master')
  assert.equal(e.output[11], Math.round((255 * 128) / 255), 'dimmer scales with master')
})

test('blackout kills intensity but holds position', () => {
  const e = new DmxEngine()
  e.setPatch([mover])
  e.setChannels([[9, 200], [11, 255]])
  e.setBlackout(true)
  e.tick()
  assert.equal(e.output[11], 0)
  assert.equal(e.output[9], 200)
  e.setBlackout(false)
  e.tick()
  assert.equal(e.output[11], 255)
})

test('fades interpolate and complete', async () => {
  const e = new DmxEngine()
  e.setChannels([[0, 0]])
  e.tick()
  e.setChannels([[0, 255]], 100)
  await new Promise((r) => setTimeout(r, 50))
  e.tick()
  const mid = e.base[0]
  assert.ok(mid > 40 && mid < 215, `mid-fade value ${mid} should be between`)
  await new Promise((r) => setTimeout(r, 80))
  e.tick()
  assert.equal(e.base[0], 255)
  assert.equal(e.fadesActive, false)
})

test('applyLook zeroes channels outside the look', () => {
  const e = new DmxEngine()
  e.setChannels([[0, 100], [5, 200]])
  e.tick()
  e.applyLook({ 0: 50 }, 0)
  e.tick()
  assert.equal(e.base[0], 50)
  assert.equal(e.base[5], 0)
})

test('captureLook picks fade targets, not mid-fade values', () => {
  const e = new DmxEngine()
  e.setChannels([[3, 255]], 5000)
  e.tick()
  const look = e.captureLook()
  assert.equal(look[3], 255)
})

test('osc roundtrip + touchosc addresses', () => {
  const buf = encodeOscMessage('/dmx/42', [0.5])
  const [msg] = parseOscPacket(buf)
  assert.equal(msg.address, '/dmx/42')
  assert.ok(Math.abs((msg.args[0] as number) - 0.5) < 1e-6)

  const legacy = parseOscPacket(encodeOscMessage('/1/dmx7', [1]))
  assert.equal(legacy[0].address, '/1/dmx7')
})

test('osc bundle parsing', () => {
  const inner = encodeOscMessage('/master', [0.75])
  const bundle = Buffer.concat([
    Buffer.from('#bundle\0', 'ascii'),
    Buffer.alloc(8), // timetag
    (() => { const b = Buffer.alloc(4); b.writeUInt32BE(inner.length); return b })(),
    inner,
  ])
  const msgs = parseOscPacket(bundle)
  assert.equal(msgs.length, 1)
  assert.equal(msgs[0].address, '/master')
})
