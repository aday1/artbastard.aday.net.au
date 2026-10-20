'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
const { test } = require('node:test');
const { MidiHotplugMonitor, resolveMidiInputName, forgetMidiInputIdentity } = require(path.resolve(
  process.env.ARTBASTARD_TEST_DIST || path.join(__dirname, '..', 'dist'),
  'midiHotplug.js'
));

const OLD = 'Akai APC40:Akai APC40 MIDI 1 24:0';
const NEW = 'Akai APC40:Akai APC40 MIDI 1 28:0';
const OTHER = 'Akai APC40:Akai APC40 MIDI 1 32:0';
const THROUGH = 'Midi Through:Midi Through Port-0 14:0';

function fakeMidi({ configured = [OLD], available = [OLD], defaults = () => [] } = {}) {
  const state = {
    configured,
    available,
    active: new Map(),
    connected: [],
    closed: [],
    interfaces: [],
    errors: [],
    enumerationError: null,
    connectError: null,
  };
  const monitor = new MidiHotplugMonitor({
    platform: 'linux',
    listInputs: () => {
      if (state.enumerationError) throw state.enumerationError;
      return [...state.available];
    },
    activeInputs: () => [...state.active.keys()],
    isInputOpen: (name) => state.active.get(name)?.open === true,
    configuredInputs: () => [...state.configured],
    defaultInputs: defaults,
    connect: async (name) => {
      state.connected.push(name);
      if (state.connectError) throw state.connectError;
      assert.ok(state.available.includes(name));
      state.active.set(name, { open: true });
      return true;
    },
    disconnect: (name) => {
      state.closed.push(name);
      state.active.delete(name);
    },
    interfacesChanged: (names) => state.interfaces.push([...names]),
    reportError: (error) => state.errors.push(error),
  });
  return { monitor, state };
}

test('unplug removes stale handles, reports no active hardware, then reconnects a renamed ALSA port', async () => {
  const { monitor, state } = fakeMidi();
  await monitor.reconcile();
  assert.deepEqual(monitor.observedActiveInputs(), [OLD]);
  state.available = [THROUGH];
  assert.deepEqual(monitor.observedActiveInputs(), [], 'health must change before the next polling tick');
  await monitor.reconcile();
  assert.deepEqual(state.closed, [OLD]);
  assert.deepEqual([...state.active.keys()], []);
  await monitor.reconcile();
  assert.deepEqual(state.connected, [OLD], 'absent devices must not be opened repeatedly');
  state.available = [THROUGH, NEW];
  await monitor.reconcile();
  assert.deepEqual(state.connected, [OLD, NEW]);
  assert.deepEqual(monitor.observedActiveInputs(), [NEW]);
  await monitor.reconcile();
  assert.deepEqual(state.connected, [OLD, NEW], 'saved and remembered aliases must not double-open');
});

test('suffix recovery requires an exact, unique stable device/port name', () => {
  assert.equal(resolveMidiInputName(OLD, [NEW], 'linux'), NEW);
  assert.equal(resolveMidiInputName(OLD, [NEW, OTHER], 'linux'), undefined);
  assert.equal(resolveMidiInputName(OLD, ['Other APC40:Akai APC40 MIDI 1 28:0'], 'linux'), undefined);
  assert.equal(resolveMidiInputName(OLD, ['Akai APC40:Akai APC40 MIDI 2 28:1'], 'linux'), undefined);
  assert.equal(resolveMidiInputName(OLD, [NEW], 'win32'), undefined);
  assert.equal(resolveMidiInputName(OLD, [OLD, NEW], 'linux'), OLD);
  assert.equal(resolveMidiInputName('Akai APC40:Akai APC40 MIDI 1', [NEW], 'linux'), undefined);
});

test('Forget removes persisted aliases after ALSA renumbering without removing another device or port', () => {
  const separatePort = 'Akai APC40:Akai APC40 MIDI 2 28:1';
  assert.deepEqual(forgetMidiInputIdentity([OLD, NEW, THROUGH, separatePort], NEW, 'linux'), [THROUGH, separatePort]);
  assert.deepEqual(forgetMidiInputIdentity([OLD, NEW], NEW, 'win32'), [OLD]);
});

test('ambiguous replacement devices are not opened', async () => {
  const { monitor, state } = fakeMidi({ available: [NEW, OTHER] });
  await monitor.reconcile();
  assert.deepEqual(state.connected, []);
});

test('manual disconnect suppresses saved and remembered reconnection across ALSA renumbering', async () => {
  const { monitor, state } = fakeMidi();
  await monitor.reconcile();
  monitor.suppressConnection(OLD);
  state.active.delete(OLD); // The public disconnect operation closes the handle.
  await monitor.reconcile();
  state.available = [NEW];
  await monitor.reconcile();
  assert.deepEqual(state.connected, [OLD]);
  monitor.rememberConnection(NEW); // A later explicit user connection opts back in.
  state.active.set(NEW, { open: true });
  state.available = [];
  await monitor.reconcile();
  state.available = [NEW];
  await monitor.reconcile();
  assert.deepEqual(state.connected, [OLD, NEW]);
});

test('clearing auto-connect does not immediately reopen through smart defaults', async () => {
  const { monitor, state } = fakeMidi({
    configured: [],
    defaults: (available) => available.filter((name) => name.includes('APC40')),
  });
  await monitor.reconcile();
  monitor.clearAutoConnect();
  state.active.clear();
  state.available = [NEW];
  await monitor.reconcile();
  assert.deepEqual(state.connected, [OLD]);
  state.configured = [NEW]; // A subsequent explicit saved choice is allowed after opt-in.
  monitor.rememberConnection(NEW);
  await monitor.reconcile();
  assert.deepEqual(state.connected, [OLD, NEW]);
});

test('smart defaults discover a recognized controller arriving after startup, without opening MIDI Through', async () => {
  const { monitor, state } = fakeMidi({
    available: [THROUGH],
    configured: [],
    defaults: (available) => available.filter((name) => name.includes('APC40')),
  });
  await monitor.reconcile();
  assert.deepEqual(state.connected, []);
  state.available = [THROUGH, NEW];
  await monitor.reconcile();
  assert.deepEqual(state.connected, [NEW]);
  assert.deepEqual(state.interfaces, [[THROUGH], [THROUGH, NEW]]);
});

test('enumeration failure does not destroy handles and does not claim hardware is connected', async () => {
  const { monitor, state } = fakeMidi();
  await monitor.reconcile();
  state.enumerationError = new Error('temporary ALSA enumeration failure');
  assert.deepEqual(monitor.observedActiveInputs(), []);
  await monitor.reconcile();
  assert.deepEqual(state.closed, []);
  assert.ok(state.active.has(OLD));
  assert.equal(state.errors.length, 1);
  state.enumerationError = null;
  await monitor.reconcile();
  assert.deepEqual(monitor.observedActiveInputs(), [OLD]);
  assert.deepEqual(state.connected, [OLD]);
});

test('a closed handle for a present port is replaced', async () => {
  const { monitor, state } = fakeMidi();
  await monitor.reconcile();
  state.active.get(OLD).open = false;
  assert.deepEqual(monitor.observedActiveInputs(), []);
  await monitor.reconcile();
  assert.deepEqual(state.closed, [OLD]);
  assert.deepEqual(state.connected, [OLD, OLD]);
  assert.deepEqual(monitor.observedActiveInputs(), [OLD]);
});

test('a connection failure is retried on a later reconciliation', async () => {
  const { monitor, state } = fakeMidi();
  state.connectError = new Error('temporarily busy');
  await monitor.reconcile();
  assert.deepEqual(monitor.observedActiveInputs(), []);
  state.connectError = null;
  await monitor.reconcile();
  assert.deepEqual(monitor.observedActiveInputs(), [OLD]);
  assert.equal(state.connected.length, 2);
});

test('concurrent polling shares one in-flight connection attempt', async () => {
  let release;
  let opens = 0;
  const monitor = new MidiHotplugMonitor({
    platform: 'linux',
    listInputs: () => [OLD],
    activeInputs: () => [],
    isInputOpen: () => false,
    configuredInputs: () => [OLD],
    defaultInputs: () => [],
    connect: async () => {
      opens += 1;
      await new Promise((resolve) => { release = resolve; });
      return true;
    },
    disconnect: () => {},
  });
  const first = monitor.reconcile();
  const second = monitor.reconcile();
  assert.equal(first, second);
  assert.equal(opens, 1);
  release();
  await Promise.all([first, second]);
});

test('manual disconnect while an automatic connection is pending remains opted out', async () => {
  let release;
  const closed = [];
  const monitor = new MidiHotplugMonitor({
    platform: 'linux',
    listInputs: () => [OLD],
    activeInputs: () => [],
    isInputOpen: () => false,
    configuredInputs: () => [OLD],
    defaultInputs: () => [],
    connect: async () => {
      await new Promise((resolve) => { release = resolve; });
      return true;
    },
    disconnect: (name) => closed.push(name),
  });
  const pending = monitor.reconcile();
  monitor.suppressConnection(OLD);
  release();
  await pending;
  assert.deepEqual(closed, [OLD]);
  await monitor.reconcile();
  assert.deepEqual(closed, [OLD]);
});
