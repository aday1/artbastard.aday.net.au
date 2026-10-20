#!/usr/bin/env node
/**
 * Isolated launcher contract checks. Imports no ArtBastard runtime, sends no DMX,
 * and replaces process execution with a recorder.
 * Run after the backend build: node scripts/kefka/test-launcher.js
 */
const assert = require('node:assert/strict');
const http = require('node:http');
const express = require('express');
const {
  createKefkaSurfaceRouter,
  isKefkaEnabled,
  isKefkaLaunchOrigin,
  isKefkaLoopback,
} = require('../../dist/kefkaLauncher');

async function main() {
  for (const address of ['127.0.0.1', '127.2.3.4', '::1', '::ffff:127.0.0.1']) {
    assert.equal(isKefkaLoopback(address), true, address);
    assert.equal(isKefkaEnabled({ ARTBASTARD_KEFKA: '1' }, address), true, address);
  }
  for (const address of [undefined, '', 'localhost', '192.168.1.7', '::ffff:192.168.1.7', '127.evil', '127.0.0.999']) {
    assert.equal(isKefkaLoopback(address), false, String(address));
    assert.equal(isKefkaEnabled({ ARTBASTARD_KEFKA: '1' }, address), false, String(address));
  }
  for (const optIn of [undefined, '', '0', 'true']) {
    assert.equal(isKefkaEnabled({ ARTBASTARD_KEFKA: optIn }, '127.0.0.1'), false);
  }
  assert.equal(isKefkaLaunchOrigin({}, 'localhost:3030', 'http://localhost:3030'), true);
  assert.equal(isKefkaLaunchOrigin({ PORT: '4040' }, 'localhost:4040', 'http://localhost:4040'), true);
  assert.equal(isKefkaLaunchOrigin({ PORT: '4040' }, 'localhost:3030', 'http://localhost:3030'), false);

  const environment = { ARTBASTARD_KEFKA: '1', PORT: '3030' };
  const launches = [];
  let failLaunch = false;
  const app = express();
  // Deliberately trust proxies: launcher authorization must still use the socket.
  app.set('trust proxy', true);
  app.use(express.json());
  app.use('/api/kefka/surfaces', createKefkaSurfaceRouter({
    environment,
    homeDirectory: '/isolated-test-home',
    runFile: async (...args) => {
      launches.push(args);
      if (failLaunch) throw new Error('PRIVATE PATH /secret/launcher and stderr');
    },
  }));
  const server = http.createServer(app);
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  async function request(method, suffix = '', headers = {}, body) {
    return new Promise((resolve, reject) => {
      const req = http.request({
        host: '127.0.0.1',
        port: server.address().port,
        method,
        path: `/api/kefka/surfaces${suffix}`,
        headers: { Host: '127.0.0.1:3030', ...headers },
      }, response => {
        let data = '';
        response.setEncoding('utf8');
        response.on('data', chunk => { data += chunk; });
        response.on('end', () => resolve({
          status: response.statusCode, headers: response.headers, data: JSON.parse(data),
        }));
      });
      req.on('error', reject);
      req.end(body);
    });
  }
  try {
    const status = await request('GET');
    assert.deepEqual(status.data, { enabled: true });
    assert.equal(status.headers['cache-control'], 'no-store');
    assert.equal(launches.length, 0);

    for (const [surface, host] of [['deck', '127.0.0.1:3030'], ['console', 'localhost:3030']]) {
      const result = await request('POST', `/${surface}`, {
        Host: host, Origin: `http://${host}`, 'Content-Type': 'application/json',
      }, JSON.stringify({ command: '/bin/sh', args: ['-c', 'ignored'], surface: 'ignored' }));
      assert.equal(result.status, 200);
      assert.deepEqual(result.data, { success: true });
      assert.deepEqual(launches.at(-1), [
        `/isolated-test-home/.local/bin/artbastard-${surface}-open`,
        [],
        { timeout: 10000, maxBuffer: 65536, shell: false },
      ]);
    }
    const acceptedLaunchCount = launches.length;
    for (const headers of [
      {},
      { Origin: 'null' },
      { Origin: 'http://attacker.test:3030' },
      { Origin: 'http://127.0.0.1:3030.attacker.test' },
      { Origin: 'http://127.0.0.1:3030/' },
      { Origin: 'https://127.0.0.1:3030' },
      { Origin: 'http://127.0.0.1:4040' },
      { Origin: 'http://localhost:3030' },
      { Host: 'attacker.test:3030', Origin: 'http://attacker.test:3030' },
      { Host: 'attacker.test:3030', Origin: 'http://127.0.0.1:3030' },
      { Origin: 'http://attacker.test', 'X-Forwarded-Host': '127.0.0.1:3030', 'X-Forwarded-For': '127.0.0.1' },
    ]) {
      const result = await request('POST', '/deck', headers);
      assert.equal(result.status, 403, JSON.stringify(headers));
      assert.deepEqual(result.data, { success: false, error: 'Local surface launch unavailable' });
    }
    for (const surface of ['shell', '__proto__', 'constructor', '../deck', 'deck;touch /tmp/forbidden']) {
      const result = await request('POST', `/${encodeURIComponent(surface)}`, { Origin: 'http://127.0.0.1:3030' });
      assert.equal(result.status, 400, surface);
    }
    assert.equal(launches.length, acceptedLaunchCount, 'Rejected requests must never execute a launcher');

    environment.ARTBASTARD_KEFKA = '0';
    assert.deepEqual((await request('GET')).data, { enabled: false });
    assert.equal((await request('POST', '/deck', { Origin: 'http://127.0.0.1:3030' })).status, 403);
    assert.equal(launches.length, acceptedLaunchCount);

    environment.ARTBASTARD_KEFKA = '1';
    failLaunch = true;
    const failure = await request('POST', '/console', { Origin: 'http://127.0.0.1:3030' });
    assert.equal(failure.status, 503);
    assert.deepEqual(failure.data, { success: false, error: 'Surface launch failed' });
    console.log('Kefka launcher checks passed (fixed commands, loopback/opt-in/origin gates, generic failures; no hardware).');
  } finally {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
