'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
const { test } = require('node:test');
const dist = process.env.ARTBASTARD_TEST_DIST || path.join(__dirname, '..', 'dist');
const { MidiAlsaSubscriptions, parseAlsaListing } = require(path.resolve(dist, 'midiAlsaSubscriptions.js'));
const { MidiHotplugMonitor } = require(path.resolve(dist, 'midiHotplug.js'));
const NAME = 'Akai APC40:Akai APC40 MIDI 1 28:0';
const PID = 611476;

function fixture({ platform = 'linux' } = {}) {
  const state = {
    ownerReads: 0, procReads: 0, warnings: [], failOwners: false, failProc: false,
    ports: [{ address: '28:0', clientName: 'Akai APC40', portName: 'Akai APC40 MIDI 1', to: [], from: [] }],
  };
  function listing(format) {
    return state.ports.map((port) => {
      const [client, number] = port.address.split(':');
      const attrs = port.pid ? `type=user,pid=${port.pid}` : 'type=kernel,card=3';
      return format === 'aconnect'
        ? `client ${client}: '${port.clientName}' [${attrs}]\n    ${number} '${port.portName.padEnd(16)}'\n` +
          `\tConnecting To: ${port.to.map((address) => address + '[real:0]').join(', ')}\n` +
          `\tConnected From: ${port.from.join(', ')}\n`
        : `Client ${client} : "${port.clientName}" [${port.pid ? 'User' : 'Kernel'} Legacy]\n` +
          `  Port ${number} : "${port.portName}" (RWeX) [In/Out]\n` +
          `    Connecting To: ${port.to.join(', ')}\n` +
          `    Connected From: ${port.from.map((address) => address + '[r:0]').join(', ')}\n`;
    }).join('');
  }
  const tracker = new MidiAlsaSubscriptions({
    platform, pid: PID,
    readOwners: () => { state.ownerReads++; if (state.failOwners) throw new Error('no aconnect'); return listing('aconnect'); },
    readSubscriptions: () => { state.procReads++; if (state.failProc) throw new Error('no proc'); return listing('proc'); },
    reportUnavailable: (message) => state.warnings.push(message),
  });
  function add(direction, { address = direction === 'input' ? '128:0' : '129:0', pid = PID, remember = true } = {}) {
    const before = tracker.captureOwnership();
    const physical = state.ports[0];
    const port = {
      address, pid, clientName: `RtMidi ${direction === 'input' ? 'Input' : 'Output'} Client`,
      portName: `RtMidi ${direction === 'input' ? 'Input' : 'Output'}`,
      to: direction === 'output' ? ['28:0'] : [], from: direction === 'input' ? ['28:0'] : [],
    };
    state.ports.push(port);
    physical[direction === 'input' ? 'to' : 'from'].push(address);
    if (remember) tracker.remember(NAME, direction, NAME, before);
    return port;
  }
  function breakLink(direction) {
    const physical = state.ports[0];
    const own = state.ports.find((port) => port.address === (direction === 'input' ? '128:0' : '129:0'));
    physical[direction === 'input' ? 'to' : 'from'] = [];
    own[direction === 'input' ? 'from' : 'to'] = [];
  }
  return { state, tracker, listing, add, breakLink };
}

test('actual proc and aconnect formats parse PID ownership, padded names and queue annotations', () => {
  const { listing, add } = fixture();
  add('input'); add('output');
  const owned = parseAlsaListing(listing('aconnect'), 'aconnect');
  const proc = parseAlsaListing(listing('proc'), 'proc');
  assert.equal(owned.get('128:0').pid, PID);
  assert.equal(owned.get('128:0').portName, 'RtMidi Input');
  assert.equal(proc.get('128:0').pid, undefined, 'proc does not establish ownership');
  assert.deepEqual([...owned.get('129:0').to], ['28:0']);
  assert.deepEqual([...proc.get('28:0').from], ['129:0']);
  assert.equal(parseAlsaListing('unexpected command output', 'aconnect'), null);
});

test('healthy exact owned input/output stay verified without spawning on the read path', () => {
  const { tracker, state, add } = fixture();
  add('input'); add('output');
  const reads = state.ownerReads;
  for (let i = 0; i < 100; i++) assert.deepEqual(tracker.status(NAME), { input: true, output: true });
  assert.equal(state.ownerReads, reads);
  assert.equal(state.procReads, 100);
});

test('rapid same-address reset invalidates retained handles even while native open flags remain true', () => {
  const { tracker, state, add, breakLink } = fixture();
  add('input'); add('output');
  breakLink('input'); breakLink('output');
  assert.equal(state.ports[0].address, '28:0');
  assert.deepEqual(tracker.status(NAME), { input: false, output: false });
});

test('output-only lost subscription is distinguished from healthy input', () => {
  const { tracker, add, breakLink } = fixture();
  add('input'); add('output'); breakLink('output');
  assert.deepEqual(tracker.status(NAME), { input: true, output: false });
});

test('subscriptions owned by another app or another handle in our process cannot mask a stale handle', () => {
  const { tracker, state, add, breakLink } = fixture();
  add('input'); add('output');
  add('input', { address: '130:0', pid: PID + 1, remember: false });
  add('input', { address: '131:0', pid: PID, remember: false });
  breakLink('input');
  state.ports[0].to = ['130:0', '131:0'];
  assert.deepEqual(tracker.status(NAME), { input: false, output: true });
});

test('another PID and ambiguous new handles never establish ownership', () => {
  const one = fixture();
  one.add('input', { pid: PID + 1 });
  assert.deepEqual(one.tracker.status(NAME), {});
  const two = fixture();
  const before = two.tracker.captureOwnership();
  two.add('input', { remember: false });
  two.add('input', { address: '130:0', remember: false });
  two.tracker.remember(NAME, 'input', NAME, before);
  assert.deepEqual(two.tracker.status(NAME), {});
  assert.equal(two.state.warnings.length, 1);
});

test('reused endpoint numbers with changed identity fail verification', () => {
  const { tracker, state, add } = fixture();
  add('input'); add('output');
  state.ports[0].clientName = 'Unrelated device';
  assert.deepEqual(tracker.status(NAME), { input: false, output: false });
});

test('unavailable inspection falls back without reconnect evidence and logs once', () => {
  const { tracker, state, add } = fixture();
  add('input'); add('output');
  state.failProc = true;
  assert.deepEqual(tracker.status(NAME), {});
  assert.deepEqual(tracker.status(NAME), {});
  state.failOwners = true;
  assert.equal(tracker.captureOwnership(), null);
  assert.equal(state.warnings.length, 1);
  tracker.forget(NAME);
  assert.deepEqual(tracker.status(NAME), {});
});

test('other platforms use native checks without invoking Linux readers', () => {
  const { tracker, state } = fixture({ platform: 'win32' });
  assert.equal(tracker.captureOwnership(), null);
  tracker.remember(NAME, 'input', NAME, null);
  assert.deepEqual(tracker.status(NAME), {});
  assert.equal(state.ownerReads, 0);
  assert.equal(state.procReads, 0);
});

for (const lost of ['input', 'output']) {
  test(`monitor reconnects once after ${lost}-only subscription loss and leaves healthy controllers alone`, async () => {
    const { tracker, state, add, breakLink } = fixture();
    add('input'); add('output');
    let active = true, connects = 0, disconnects = 0;
    const monitor = new MidiHotplugMonitor({
      platform: 'linux', listInputs: () => [NAME], activeInputs: () => active ? [NAME] : [],
      isInputOpen: () => {
        const status = tracker.status(NAME);
        return active && status.input !== false && status.output !== false;
      },
      configuredInputs: () => [NAME], defaultInputs: () => [],
      disconnect: () => {
        disconnects++; active = false; tracker.forget(NAME);
        state.ports = [state.ports[0]];
        state.ports[0].from = []; state.ports[0].to = [];
      },
      connect: async () => { connects++; add('input'); add('output'); active = true; return true; },
    });
    for (let i = 0; i < 5; i++) await monitor.reconcile();
    assert.equal(connects, 0);
    breakLink(lost);
    assert.deepEqual(monitor.observedActiveInputs(), []);
    await monitor.reconcile();
    assert.equal(disconnects, 1);
    assert.equal(connects, 1);
    assert.deepEqual(monitor.observedActiveInputs(), [NAME]);
    for (let i = 0; i < 5; i++) await monitor.reconcile();
    assert.equal(connects, 1);
    assert.equal(disconnects, 1);
    state.failProc = true;
    await monitor.reconcile();
    assert.equal(connects, 1, 'inspection failure cannot cause a reconnect loop');
  });
}
