#!/usr/bin/env node
// Uses the built backend in temporary storage. Native MIDI is replaced before
// imports, all Art-Net goes to a private loopback socket, and no production data
// or controller is opened. Run after building: node scripts/midi-hotplug-integration-smoke.js
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const net = require('node:net');
const dgram = require('node:dgram');
const { io } = require('socket.io-client');

const root = path.resolve(__dirname, '..');
const OLD = 'Akai APC40:Akai APC40 MIDI 1 24:0';
const NEW = 'Akai APC40:Akai APC40 MIDI 1 28:0';
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function waitFor(check, label) {
  const deadline = Date.now() + 12000;
  let lastError;
  while (Date.now() < deadline) {
    try { if (await check()) return; } catch (error) { lastError = error; }
    await sleep(50);
  }
  throw new Error(`Timed out: ${label}${lastError ? ` (${lastError.message})` : ''}`);
}

async function main() {
  const scratch = await fs.mkdtemp(path.join(os.tmpdir(), 'artbastard-midi-hotplug-'));
  const artnet = dgram.createSocket('udp4');
  const osc = dgram.createSocket('udp4');
  const tcp = net.createServer();
  let child;
  let exited;
  let socket;
  let output = '';
  try {
    artnet.bind(0, '127.0.0.1');
    await once(artnet, 'listening');
    osc.bind(0, '127.0.0.1');
    await once(osc, 'listening');
    const oscPort = osc.address().port;
    osc.close();
    tcp.listen(0, '127.0.0.1');
    await once(tcp, 'listening');
    const httpPort = tcp.address().port;
    await new Promise((resolve) => tcp.close(resolve));
    const base = `http://127.0.0.1:${httpPort}`;
    await fs.cp(path.join(root, 'dist'), path.join(scratch, 'dist'), { recursive: true });
    await fs.symlink(path.join(root, 'node_modules'), path.join(scratch, 'node_modules'), 'dir');
    await fs.mkdir(path.join(scratch, 'data'));
    await fs.mkdir(path.join(scratch, 'logs'));
    const configPath = path.join(scratch, 'data', 'config.json');
    await fs.writeFile(configPath, JSON.stringify({
      autoConnectMidiDevices: [OLD],
      artNetConfig: { ip: '127.0.0.1', port: artnet.address().port, net: 0, subnet: 0, universe: 0, base_refresh_interval: 100 },
      oscConfig: { host: '0.0.0.0', port: oscPort, sendEnabled: false, sendHost: '127.0.0.1', sendPort: 57120 },
    }));
    const portsPath = path.join(scratch, 'fake-ports.json');
    const eventsPath = path.join(scratch, 'fake-events.jsonl');
    const setPorts = async (ports) => {
      await fs.writeFile(portsPath + '.tmp', JSON.stringify(ports));
      await fs.rename(portsPath + '.tmp', portsPath);
    };
    await setPorts([OLD]);
    await fs.writeFile(eventsPath, '');
    const preloadPath = path.join(scratch, 'fake-midi.cjs');
    await fs.writeFile(preloadPath, `
const Module = require('node:module');
const fs = require('node:fs');
const EventEmitter = require('node:events');
const originalLoad = Module._load;
const inputs = new Map();
const available = () => JSON.parse(fs.readFileSync(${JSON.stringify(portsPath)}, 'utf8'));
const record = (event) => fs.appendFileSync(${JSON.stringify(eventsPath)}, JSON.stringify(event) + '\\n');
class Input extends EventEmitter {
  constructor(name) {
    super();
    if (!available().includes(name)) throw new Error('Fake port not present');
    this.name = name; this.open = true;
    inputs.set(name, this); record({ type: 'open-input', name });
  }
  isPortOpen() { return this.open; } // Intentionally stays true across USB removal.
  close() {
    inputs.delete(this.name); this.open = false;
    record({ type: 'close-input', name: this.name });
    if (!available().includes(this.name)) throw new Error('Simulated stale native input close failure');
  }
}
class Output {
  constructor(name) {
    if (!available().includes(name)) throw new Error('Fake output not present');
    this.name = name; record({ type: 'open-output', name });
  }
  send() {}
  close() {
    record({ type: 'close-output', name: this.name });
    if (!available().includes(this.name)) throw new Error('Simulated stale native output close failure');
  }
}
process.on('message', (message) => {
  if (message?.emitMidi) inputs.get(message.emitMidi.name)?.emit('cc', message.emitMidi.message);
});
Module._load = function(request, parent, isMain) {
  if (request === 'easymidi') return { Input, Output, getInputs: available, getOutputs: available };
  if (['@julusian/midi', 'midi', 'abletonlink'].includes(request)) {
    const error = new Error('Native hardware disabled in fake MIDI test'); error.code = 'MODULE_NOT_FOUND'; throw error;
  }
  return originalLoad.apply(this, arguments);
};
`);
    const env = { ...process.env, PORT: String(httpPort), NODE_ENV: 'test', APC40_SERVER_SCREENSAVER: '0', ARTBASTARD_KEFKA: '0' };
    for (const key of Object.keys(env)) {
      if (key.startsWith('ARTBASTARD_HTTPS') || key.startsWith('SSL_')) delete env[key];
    }
    child = spawn(process.execPath, ['--require', preloadPath, path.join(scratch, 'dist', 'server.js')], {
      cwd: scratch, env, stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
    });
    exited = new Promise((resolve) => child.once('exit', resolve));
    const capture = (chunk) => { output = (output + chunk).slice(-20000); };
    child.stdout.on('data', capture);
    child.stderr.on('data', capture);
    const request = async (route, method = 'GET', body) => {
      const response = await fetch(base + route, {
        method, headers: { 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(2500),
      });
      assert.equal(response.status, 200, `${method} ${route}`);
      return response.json();
    };
    const events = async () => (await fs.readFile(eventsPath, 'utf8')).trim().split('\n').filter(Boolean).map(JSON.parse);
    await waitFor(async () => (await request('/api/midi/active')).inputs.includes(OLD), 'initial fake APC40 connection');
    assert.equal((await request('/api/health')).midiDevicesConnected, 1);
    socket = io(base, { transports: ['websocket'], forceNew: true });
    await once(socket, 'connect');

    await setPorts([]);
    assert.equal((await request('/api/health')).midiDevicesConnected, 0);
    await waitFor(async () => {
      const closed = await events();
      return closed.some((event) => event.type === 'close-input' && event.name === OLD)
        && closed.some((event) => event.type === 'close-output' && event.name === OLD);
    }, 'stale input and output cleanup despite close exceptions');
    assert.deepEqual((await request('/api/midi/active')).inputs, []);

    await setPorts([NEW]);
    await waitFor(async () => (await request('/api/midi/active')).inputs.includes(NEW), 'renumbered APC40 recovery');
    assert.equal((await request('/api/health')).midiDevicesConnected, 1);
    const received = [];
    socket.on('midiMessage', (message) => received.push(message));
    child.send({ emitMidi: { name: NEW, message: { _type: 'cc', channel: 0, controller: 7, value: 43 } } });
    await waitFor(() => received.some((message) =>
      message.source === NEW && message.controller === 7 && message.value === 43
    ), 'MIDI event forwarding from the reopened input');

    await request('/api/midi/server/disconnect', 'POST', { inputName: NEW, forget: true });
    assert.deepEqual(JSON.parse(await fs.readFile(configPath, 'utf8')).autoConnectMidiDevices, []);
    await setPorts([]);
    await sleep(2200);
    await setPorts([NEW]);
    await sleep(2200);
    assert.deepEqual((await request('/api/midi/active')).inputs, [], 'manual Forget must not auto-reopen');
    assert.equal((await request('/api/health')).midiDevicesConnected, 0);
    assert.equal((await events()).filter((event) => event.type === 'open-input' && event.name === NEW).length, 1);
    assert.ok((await request('/api/state')).dmxChannels.every((value) => value === 0));
    console.log('PASS: fake MIDI unplug health, stale input/output cleanup, ALSA rename recovery, message forwarding, and persistent Forget; DMX stays zero.');
  } catch (error) {
    console.error(output);
    throw error;
  } finally {
    socket?.disconnect();
    if (child && child.exitCode === null) {
      child.kill('SIGTERM');
      await Promise.race([exited, sleep(6000)]);
      if (child.exitCode === null) {
        child.kill('SIGKILL');
        await exited;
      }
    }
    try { artnet.close(); } catch {}
    try { osc.close(); } catch {}
    try { tcp.close(); } catch {}
    await fs.rm(scratch, { recursive: true, force: true });
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
