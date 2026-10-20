'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { EventEmitter } = require('node:events');
const { test } = require('node:test');
const { patchedSource } = require('./patch-easymidi-lifecycle');

const source = fs.readFileSync(process.env.ARTBASTARD_EASYMIDI_SOURCE || require.resolve('easymidi'), 'utf8');
const patched = patchedSource(source, '3.2.0', '3.6.1');

function fixture({ fail, ports = ['APC40', 'APC40', 'Clock'] } = {}) {
  const state = { alive: new Set(), created: 0, destroyed: 0, destroyCalls: 0, messages: [] };
  class Handle extends EventEmitter {
    constructor(kind) {
      super();
      this.kind = kind;
      this.open = false;
      state.alive.add(this);
      state.created++;
    }
    check(operation) {
      if (!state.alive.has(this)) throw new Error('Native handle already destroyed');
      if (fail?.(operation, this, state)) throw new Error(`Native ${operation} failure`);
    }
    ignoreTypes() { this.check('ignoreTypes'); }
    getPortCount() { this.check('getPortCount'); return ports.length; }
    getPortName(index) { this.check('getPortName'); return ports[index]; }
    openPort(index) { this.check('openPort'); this.port = index; this.open = true; }
    openVirtualPort() { this.check('openVirtualPort'); this.open = true; }
    isPortOpen() { this.check('isPortOpen'); return this.open; }
    closePort() { this.check('closePort'); this.open = false; }
    destroy() {
      state.destroyCalls++;
      if (state.alive.delete(this)) {
        this.open = false;
        state.destroyed++;
      }
    }
    sendMessage(bytes) { this.check('sendMessage'); state.messages.push(bytes); }
  }
  const midi = {
    input: class extends Handle { constructor() { super('input'); } },
    output: class extends Handle { constructor() { super('output'); } },
  };
  const context = {
    module: { exports: {} },
    require: (id) => {
      if (id === '@julusian/midi') return midi;
      if (id === 'events') return require('node:events');
      throw new Error(`Unexpected require ${id}`);
    },
  };
  // The opt-in baseline mode proves these assertions fail on the original
  // dependency without opening native hardware or depending on garbage collection.
  vm.runInNewContext(process.env.ARTBASTARD_TEST_UNPATCHED ? source : patched, context);
  return { api: context.module.exports, state };
}

test('enumeration destroys every temporary native handle without changing duplicate names', () => {
  const { api, state } = fixture();
  for (let i = 0; i < 1000; i++) {
    assert.equal(JSON.stringify(api.getInputs()), JSON.stringify(['APC40', 'APC401', 'Clock']));
    assert.equal(JSON.stringify(api.getOutputs()), JSON.stringify(['APC40', 'APC401', 'Clock']));
  }
  assert.equal(state.created, 2000);
  assert.equal(state.alive.size, 0);
  assert.equal(state.destroyed, 2000);
});

for (const kind of ['Input', 'Output']) {
  for (const operation of ['getPortCount', 'getPortName']) {
    test(`${kind} enumeration releases its handle when ${operation} throws`, () => {
      const { api, state } = fixture({ fail: (name) => name === operation });
      assert.throws(() => api[`get${kind}s`](), /Native/);
      assert.equal(state.alive.size, 0);
    });
  }
  test(`${kind} internal enumeration, close, repeated close and closed status preserve ownership`, () => {
    const { api, state } = fixture();
    for (let i = 0; i < 100; i++) {
      const port = new api[kind]('APC401');
      assert.equal(port.isPortOpen(), true);
      assert.equal(state.alive.size, 1, 'the constructor must release its internal enumeration handle');
      assert.equal([...state.alive][0].port, 1, 'duplicate-name selection must still resolve');
      port.close();
      assert.equal(port.isPortOpen(), false);
      const calls = state.destroyCalls;
      port.close();
      assert.equal(state.destroyCalls, calls, 'close is idempotent');
      assert.equal(state.alive.size, 0);
    }
    assert.equal(state.created, state.destroyed);
  });
  test(`${kind} missing device and constructor failures release every owned handle`, () => {
    {
      const { api, state } = fixture();
      assert.throws(() => new api[kind]('Missing'), /No MIDI/);
      assert.equal(state.alive.size, 0);
    }
    for (const operation of ['getPortCount', 'getPortName', 'openPort', 'openVirtualPort']) {
      const { api, state } = fixture({ fail: (name) => name === operation });
      assert.throws(() => new api[kind]('APC40', operation === 'openVirtualPort'), /Native/);
      assert.equal(state.alive.size, 0, operation);
    }
    // Enumeration succeeds, then the owning port's subsequent count fails.
    const { api, state } = fixture({
      fail: (name, handle, current) => name === 'getPortCount' && current.destroyed === 1,
    });
    assert.throws(() => new api[kind]('APC40'), /Native/);
    assert.equal(state.alive.size, 0);
  });
}

test('input setup failure releases its allocation before enumeration', () => {
  const { api, state } = fixture({ fail: (name) => name === 'ignoreTypes' });
  assert.throws(() => new api.Input('APC40'), /ignoreTypes/);
  assert.equal(state.alive.size, 0);
});

test('virtual ports remain usable and release both allocation and enumeration handles', () => {
  const { api, state } = fixture();
  const input = new api.Input('Test Input', true);
  const output = new api.Output('Test Output', true);
  const messages = [];
  input.on('cc', (message) => messages.push(message));
  const nativeInput = [...state.alive].find((handle) => handle.kind === 'input');
  nativeInput.emit('message', 0, [0xb0, 7, 64]);
  output.send('cc', { channel: 0, controller: 7, value: 64 });
  assert.equal(messages[0].value, 64);
  assert.equal(JSON.stringify(state.messages), JSON.stringify([[0xb0, 7, 64]]));
  input.close();
  output.close();
  assert.equal(state.alive.size, 0);
});

test('patch is idempotent and refuses unknown versions or modified dependency source', () => {
  assert.equal(patchedSource(patched, '3.2.0', '3.6.1'), patched);
  assert.throws(() => patchedSource(source, '3.2.1', '3.6.1'), /requires/);
  assert.throws(() => patchedSource(source, '3.2.0', '3.6.2'), /requires/);
  assert.throws(() => patchedSource(source + '\n// unknown change', '3.2.0', '3.6.1'), /unfamiliar/);
  assert.throws(() => patchedSource(patched + '\n// unknown change', '3.2.0', '3.6.1'), /unfamiliar/);
});
