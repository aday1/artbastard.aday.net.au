#!/usr/bin/env node
'use strict';

// Linux-only native regression. Enumerates ports; never opens a MIDI port,
// sends messages, creates a virtual device, or requests garbage collection.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { createRequire } = require('node:module');
const { patchedSource } = require('./patch-easymidi-lifecycle');

if (process.platform !== 'linux') throw new Error('This check requires Linux ALSA /proc counters');
const filename = process.env.ARTBASTARD_EASYMIDI_SOURCE || require.resolve('easymidi');
const fromEasyMidi = createRequire(filename);
const source = fs.readFileSync(filename, 'utf8');
const nativeVersion = fromEasyMidi('@julusian/midi/package.json').version;
assert.equal(source, patchedSource(source, '3.2.0', nativeVersion), 'Apply the lifecycle patch before native stress testing');
const api = require(filename);

function ownSequencerFds() {
  return fs.readdirSync('/proc/self/fd').filter((fd) => {
    try { return fs.readlinkSync(`/proc/self/fd/${fd}`) === '/dev/snd/seq'; }
    catch { return false; }
  }).length;
}
function clients() {
  return [...fs.readFileSync('/proc/asound/seq/clients', 'utf8').matchAll(/^Client\s+\d+\s*:/gm)].length;
}

const baseline = { processFds: ownSequencerFds(), kernelClients: clients() };
let maximumProcessFds = baseline.processFds;
let minimumKernelClients = baseline.kernelClients;
let maximumKernelClients = baseline.kernelClients;
const iterations = 2000;
for (let i = 0; i < iterations; i++) {
  api.getInputs();
  api.getOutputs();
  const fds = ownSequencerFds();
  const count = clients();
  maximumProcessFds = Math.max(maximumProcessFds, fds);
  minimumKernelClients = Math.min(minimumKernelClients, count);
  maximumKernelClients = Math.max(maximumKernelClients, count);
  assert.equal(fds, baseline.processFds, `native handle leaked after enumeration ${i + 1}`);
}
const after = { processFds: ownSequencerFds(), kernelClients: clients() };
assert.equal(after.processFds, baseline.processFds);
// Other live processes may legitimately enumerate; report global observations
// alongside the exact per-process ownership assertion instead of attributing them.
console.log(JSON.stringify({
  result: 'PASS', enumerations: iterations * 2, baseline, after,
  maximumProcessFds, minimumKernelClients, maximumKernelClients,
  openedMidiPorts: 0, sentMidiMessages: 0, forcedGarbageCollections: 0,
}, null, 2));
