#!/usr/bin/env node
/**
 * LAN bridge smoke: mint token, connect bridge client, set DMX via API, verify fan-out.
 * Run: npm run build-backend-fast && npm run test:bridge-smoke
 */
const { spawn } = require('child_process');
const path = require('path');

const PORT = process.env.PORT || 3030;
const BASE = `http://127.0.0.1:${PORT}`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchJson(url, options = {}) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  const text = await res.text();
  let json = {};
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = { raw: text };
    }
  }
  return { status: res.status, json };
}

const startServer = () =>
  spawn('node', [path.join(__dirname, '..', 'dist', 'server.js')], {
    cwd: path.join(__dirname, '..'),
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, PORT: String(PORT) },
  });

async function waitForServer(timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const h = await fetchJson(`${BASE}/api/health`);
      if (h.status === 200) return;
    } catch {
      /* retry */
    }
    await sleep(500);
  }
  throw new Error('Timed out waiting for server');
}

async function main() {
  const server = startServer();
  let stderr = '';
  server.stderr.on('data', (d) => {
    stderr += d.toString();
  });

  try {
    await waitForServer();
  } catch (err) {
    server.kill('SIGTERM');
    console.error(stderr || err.message);
    process.exit(1);
  }

  const sessRes = await fetchJson(`${BASE}/api/sessions`, {
    method: 'POST',
    body: JSON.stringify({ name: 'Smoke test' }),
  });
  const sessionId = sessRes.json.session?.id || 'default';

  const tokenRes = await fetchJson(`${BASE}/api/bridge/token`, {
    method: 'POST',
    body: JSON.stringify({ bridgeId: 'smoke-bridge', sessionId }),
  });
  if (!tokenRes.json.token) {
    console.error('Token mint failed', tokenRes);
    server.kill('SIGTERM');
    process.exit(1);
  }

  const { io } = require('socket.io-client');
  const bridge = io(BASE, {
    path: '/socket.io',
    transports: ['websocket'],
    auth: { token: tokenRes.json.token, role: 'bridge' },
  });

  await new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('Bridge connect timeout')), 10000);
    bridge.on('connect', () => {
      clearTimeout(t);
      bridge.emit('bridge:hello', { bridgeId: 'smoke-bridge', version: 'smoke', caps: ['artnet', 'ableton-link'] });
      resolve();
    });
    bridge.on('connect_error', (e) => reject(e));
  });

  await sleep(400);

  const statusRes = await fetchJson(`${BASE}/api/bridge/status?sessionId=${encodeURIComponent(sessionId)}`);
  if (!statusRes.json.connected) {
    console.error('Bridge not registered', statusRes.json);
    bridge.disconnect();
    server.kill('SIGTERM');
    process.exit(1);
  }

  let dmxReceived = false;
  bridge.on('bridge:dmx:batch', () => {
    dmxReceived = true;
  });

  await fetchJson(`${BASE}/api/dmx`, {
    method: 'POST',
    body: JSON.stringify({ channel: 0, value: 128, sessionId }),
  });

  await sleep(600);

  bridge.emit('bridge:clock:state', {
    bpm: 128,
    beat: 2,
    bar: 1,
    isPlaying: true,
    source: 'ableton-link',
    linkPeers: 1,
  });

  await sleep(200);

  bridge.disconnect();
  server.kill('SIGTERM');

  if (!dmxReceived) {
    console.error('Bridge did not receive bridge:dmx:batch');
    process.exit(1);
  }

  console.log('bridge-smoke OK: sessions, token+sessionId, connect, registry, DMX fan-out, clock state');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
