#!/usr/bin/env node
/**
 * Exercise the real HTTP -> Art-Net and OSC -> Art-Net paths without fixtures.
 * Copies the built backend into temporary storage, so neither application data
 * nor an already-running ArtBastard server is used. All DMX goes to loopback;
 * native MIDI is stubbed so attached controllers are never opened.
 *
 * Run after building the backend: node scripts/dmx-osc-integration-smoke.js
 */
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const dgram = require('node:dgram');
const fs = require('node:fs/promises');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');
const { once } = require('node:events');

const root = path.resolve(__dirname, '..');
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitFor(check, label, timeoutMs = 12000) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  do {
    try {
      const result = await check();
      if (result) return result;
    } catch (error) {
      lastError = error;
    }
    await sleep(50);
  } while (Date.now() < deadline);
  throw new Error(`Timed out waiting for ${label}${lastError ? `: ${lastError.message}` : ''}`);
}

async function udpReceiver() {
  const socket = dgram.createSocket('udp4');
  const frames = [];
  socket.on('message', (packet, source) => {
    if (packet.length < 18 || packet.toString('ascii', 0, 8) !== 'Art-Net\0') return;
    if (packet.readUInt16LE(8) !== 0x5000) return;
    const length = packet.readUInt16BE(16);
    if (packet.length < 18 + length) return;
    frames.push({
      universe: packet.readUInt16LE(14),
      sourcePort: source.port,
      values: [...packet.subarray(18, 18 + length)],
    });
  });
  socket.bind(0, '127.0.0.1');
  await once(socket, 'listening');
  return { socket, frames, port: socket.address().port };
}

async function freeTcpPort() {
  const server = net.createServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}

function oscFloat(address, value) {
  const string = (text) => {
    const result = Buffer.alloc(Math.ceil((Buffer.byteLength(text) + 1) / 4) * 4);
    result.write(text);
    return result;
  };
  const number = Buffer.alloc(4);
  number.writeFloatBE(value);
  return Buffer.concat([string(address), string(',f'), number]);
}

async function main() {
  const scratch = await fs.mkdtemp(path.join(os.tmpdir(), 'artbastard-dmx-osc-'));
  const receivers = [];
  let child;
  let childExit;
  let output = '';
  let oscSender;
  try {
    const initial = await udpReceiver();
    receivers.push(initial);
    const replacement = await udpReceiver();
    receivers.push(replacement);
    const oscReservation = await udpReceiver();
    const oscPort = oscReservation.port;
    oscReservation.socket.close();
    const httpPort = await freeTcpPort();
    const base = `http://127.0.0.1:${httpPort}`;

    await fs.cp(path.join(root, 'dist'), path.join(scratch, 'dist'), { recursive: true });
    await fs.symlink(path.join(root, 'node_modules'), path.join(scratch, 'node_modules'), 'dir');
    await fs.mkdir(path.join(scratch, 'data'));
    await fs.mkdir(path.join(scratch, 'logs'));
    const initialConfig = {
      artNetConfig: {
        ip: '127.0.0.1',
        port: initial.port,
        net: 0,
        subnet: 0,
        universe: 0,
        base_refresh_interval: 100,
      },
      oscConfig: {
        host: '0.0.0.0',
        port: oscPort,
        sendEnabled: false,
        sendHost: '127.0.0.1',
        sendPort: 57120,
      },
      oscAssignments: Array.from({ length: 512 }, (_, index) =>
        index === 1 ? '/deck/test/dimmer' : `/1/dmx${index + 1}`
      ),
    };
    const configPath = path.join(scratch, 'data', 'config.json');
    await fs.writeFile(configPath, JSON.stringify(initialConfig));
    const preload = path.join(scratch, 'isolate-midi.cjs');
    await fs.writeFile(preload, `
const Module = require('node:module');
const originalLoad = Module._load;
// Keep this child away from the production Art-Net listener. The adapter's
// source6454 contract is tested separately; this test checks real routing.
const dgram = require('node:dgram');
const originalCreateSocket = dgram.createSocket;
dgram.createSocket = function(...args) {
  const socket = originalCreateSocket.apply(this, args);
  const bind = socket.bind;
  socket.bind = function(...binding) {
    if (binding[0]?.port === 6454 && binding[0]?.address === '0.0.0.0') {
      binding[0] = { ...binding[0], port: 0, address: '127.0.0.1' };
    }
    return bind.apply(this, binding);
  };
  return socket;
};
class UnavailableMidiPort {
  constructor() { throw new Error('Physical MIDI is disabled in this DMX/OSC test'); }
}
const midi = { getInputs: () => [], getOutputs: () => [], Input: UnavailableMidiPort, Output: UnavailableMidiPort };
Module._load = function(request, parent, isMain) {
  if (request === 'easymidi') return midi;
  if (request === '@julusian/midi' || request === 'midi' || request === 'abletonlink') {
    const error = new Error(request + ' is disabled in this DMX/OSC test');
    error.code = 'MODULE_NOT_FOUND';
    throw error;
  }
  return originalLoad.apply(this, arguments);
};
`);
    const env = { ...process.env, PORT: String(httpPort), NODE_ENV: 'test' };
    for (const key of Object.keys(env)) {
      if (key.startsWith('ARTBASTARD_HTTPS') || key.startsWith('SSL_')) delete env[key];
    }
    child = spawn(process.execPath, ['--require', preload, path.join(scratch, 'dist', 'server.js')], {
      cwd: scratch,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    childExit = new Promise((resolve) => child.once('exit', resolve));
    const capture = (chunk) => {
      output = (output + chunk.toString()).slice(-20000);
    };
    child.stdout.on('data', capture);
    child.stderr.on('data', capture);

    async function request(route, method = 'GET', body) {
      const response = await fetch(base + route, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(2500),
      });
      assert.equal(response.status, 200, `${method} ${route}`);
      return response.json();
    }

    await waitFor(async () => {
      assert.equal(child.exitCode, null, `server exited: ${output}`);
      return (await request('/api/health')).status;
    }, 'isolated server');
    await waitFor(() => output.includes('OSC Receive Port is ready'), 'OSC listener');
    const freshState = await request('/api/state');
    assert.equal(freshState.dmxChannels.length, 512);
    assert.ok(freshState.dmxChannels.every((value) => value === 0), 'fresh startup must be zero');
    await request('/api/dmx/batch', 'POST', Object.fromEntries(
      Array.from({ length: 512 }, (_, channel) => [channel, 0])
    ));
    await waitFor(() => initial.frames.some((frame) => frame.values.length === 512 &&
      frame.values.every((value) => value === 0)), 'zero ArtDMX frame');

    // This is the regression: the old REST handler returned success but changed
    // neither the saved configuration nor the active Art-Net sender.
    const changedConfig = { port: replacement.port, net: 1, subnet: 2, universe: 3 };
    await request('/api/config/artnet', 'POST', changedConfig);
    const saved = JSON.parse(await fs.readFile(configPath, 'utf8'));
    for (const [key, value] of Object.entries(changedConfig)) {
      assert.equal(saved.artNetConfig[key], value, `persisted Art-Net ${key}`);
    }
    assert.equal(saved.artNetConfig.ip, '127.0.0.1', 'partial update preserves destination');
    assert.deepEqual(saved.oscConfig, initialConfig.oscConfig, 'Art-Net edit preserves OSC config');
    const updatedState = await request('/api/state');
    assert.equal(updatedState.artNetConfig.port, replacement.port);
    await request('/api/dmx', 'POST', { channel: 0, value: 73 });
    await waitFor(() => replacement.frames.some((frame) =>
      frame.universe === 0x123 && frame.values[0] === 73
    ), 'REST DMX on the new Art-Net destination and universe');
    const sourcePort = initial.frames[0].sourcePort;
    assert.ok(replacement.frames.every((frame) => frame.sourcePort === sourcePort), 'configuration must reuse the bound socket');
    const oldCount = initial.frames.length;
    await sleep(350);
    assert.equal(initial.frames.length, oldCount, 'old destination must not retain a sender refresh loop');
    for (const destination of [initial, replacement, initial, replacement]) {
      await request('/api/config/artnet', 'POST', { port: destination.port });
      await waitFor(() => destination.frames.at(-1)?.values[0] === 73, 'reconfigured output preserves values');
      await sleep(150);
      const inactive = destination === initial ? replacement : initial;
      const inactiveCount = inactive.frames.length;
      await sleep(250);
      assert.equal(inactive.frames.length, inactiveCount, 'repeated reconfiguration must not leave stale senders');
      assert.ok(destination.frames.every((frame) => frame.sourcePort === sourcePort));
    }
    // Large batches use setDmxChannels: there must be no partially staged frame.
    const beforeBatch = replacement.frames.length;
    const batchValues = Array.from({ length: 512 }, (_, channel) => (channel * 13) % 256);
    await request('/api/dmx/batch', 'POST', Object.fromEntries(batchValues.map((value, channel) => [channel, value])));
    await waitFor(() => replacement.frames.slice(beforeBatch).some((frame) =>
      frame.values.every((value, channel) => value === batchValues[channel])
    ), 'complete512-channel batch');
    assert.ok(replacement.frames.slice(beforeBatch).every((frame) =>
      frame.values.every((value, channel) => value === batchValues[channel])
      || frame.values.every((value, channel) => value === (channel === 0 ? 73 : 0))
    ), 'only whole before/after buffers may be transmitted');
    await request('/api/dmx/batch', 'POST', Object.fromEntries(batchValues.map((_, channel) => [channel, 0])));

    // Normalized OSC is unambiguous; its public channel number is one-based.
    oscSender = dgram.createSocket('udp4');
    for (const [input, expected] of [[0, 0], [0.5, 127], [1, 255]]) {
      const after = replacement.frames.length;
      oscSender.send(oscFloat('/channel/1', input), oscPort, '127.0.0.1');
      await waitFor(() => replacement.frames.slice(after).some((frame) =>
        frame.universe === 0x123 && frame.values[0] === expected
      ), `OSC ${input} -> ArtDMX ${expected}`);
      assert.equal((await request('/api/state')).dmxChannels[0], expected);
    }
    // Assigned addresses previously depended on a browser writing the value
    // back. No browser or Socket.IO client is connected in this test.
    for (const [input, expected] of [[0, 0], [0.5, 128], [64, 129], [128, 128], [1, 255]]) {
      const after = replacement.frames.length;
      oscSender.send(oscFloat('/1/dmx1', input), oscPort, '127.0.0.1');
      await waitFor(() => replacement.frames.slice(after).some((frame) =>
        frame.universe === 0x123 && frame.values[0] === expected
      ), `assigned OSC ${input} -> ArtDMX ${expected} without a browser`);
      assert.equal((await request('/api/state')).dmxChannels[0], expected);
    }
    const after = replacement.frames.length;
    oscSender.send(oscFloat('/deck/test/dimmer', 0.25), oscPort, '127.0.0.1');
    await waitFor(() => replacement.frames.slice(after).some((frame) =>
      frame.universe === 0x123 && frame.values[1] === 64
    ), 'custom saved OSC assignment -> channel 2 without a browser');
    assert.equal((await request('/api/state')).dmxChannels[1], 64);
    await request('/api/dmx/batch', 'POST', { 0: 0, 1: 0 });
    console.log('PASS: isolated zero startup, REST Art-Net persistence/rerouting, direct and assigned headless OSC -> ArtDMX');
  } catch (error) {
    console.error(output);
    throw error;
  } finally {
    if (child && child.exitCode === null) {
      child.kill('SIGTERM');
      await Promise.race([childExit, sleep(6000)]);
      if (child.exitCode === null) {
        child.kill('SIGKILL');
        await childExit;
      }
    }
    if (oscSender) oscSender.close();
    for (const receiver of receivers) receiver.socket.close();
    await fs.rm(scratch, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
