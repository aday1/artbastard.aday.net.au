const { spawn } = require('child_process');

const BASE_URL = 'http://127.0.0.1:3030';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const requestJson = async (path, options = {}) => {
  const response = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });

  const text = await response.text();
  let body = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }

  return { status: response.status, body };
};

const expectStatus = (result, expected, context) => {
  if (result.status !== expected) {
    throw new Error(`${context} expected ${expected}, received ${result.status}`);
  }
};

const waitForServer = async (timeoutMs = 20000) => {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const result = await requestJson('/api/health');
      if (result.status === 200) {
        return;
      }
    } catch {
      // Keep polling until timeout.
    }
    await sleep(500);
  }
  throw new Error('Timed out waiting for server startup');
};

const startServer = () =>
  spawn('node', ['dist/server.js'], {
    cwd: process.cwd(),
    stdio: ['ignore', 'pipe', 'pipe'],
    env: process.env,
  });

const stopServer = (processHandle) =>
  new Promise((resolve) => {
    if (!processHandle || processHandle.killed) {
      resolve();
      return;
    }

    processHandle.once('exit', () => resolve());
    processHandle.kill('SIGTERM');
    setTimeout(() => resolve(), 5000);
  });

const run = async () => {
  const server = startServer();
  let snapshots = null;

  server.stdout.on('data', () => {});
  server.stderr.on('data', () => {});

  try {
    await waitForServer();

    const stateSnapshot = await requestJson('/api/state');
    const configSnapshot = await requestJson('/api/config');
    const scenesSnapshot = await requestJson('/api/scenes');

    expectStatus(stateSnapshot, 200, 'GET /api/state');
    expectStatus(configSnapshot, 200, 'GET /api/config');
    expectStatus(scenesSnapshot, 200, 'GET /api/scenes');

    snapshots = {
      state: stateSnapshot.body,
      config: configSnapshot.body,
      scenes: scenesSnapshot.body,
    };

    expectStatus(
      await requestJson('/api/config', {
        method: 'POST',
        body: JSON.stringify({
          masterIntensity: 0.41,
          blackout: false,
          strobe: false,
          fog: 0.15,
          strobeRate: 19,
          tapTempo: 121,
        }),
      }),
      200,
      'POST /api/config'
    );

    expectStatus(
      await requestJson('/api/state', {
        method: 'POST',
        body: JSON.stringify({
          dmxChannels: Array.from({ length: 512 }, (_, i) => {
            if (i === 0) return 1;
            if (i === 1) return 2;
            if (i === 2) return 3;
            return 0;
          }),
        }),
      }),
      200,
      'POST /api/state'
    );

    expectStatus(
      await requestJson('/api/scenes', {
        method: 'POST',
        body: JSON.stringify([{ name: 'ApiContractSmokeScene', channels: [1, 2, 3] }]),
      }),
      200,
      'POST /api/scenes'
    );

    expectStatus(await requestJson('/api/state', { method: 'DELETE' }), 200, 'DELETE /api/state');
    expectStatus(await requestJson('/api/config', { method: 'DELETE' }), 200, 'DELETE /api/config');
    expectStatus(await requestJson('/api/scenes', { method: 'DELETE' }), 200, 'DELETE /api/scenes');

    const postResetScenes = await requestJson('/api/scenes');
    expectStatus(postResetScenes, 200, 'GET /api/scenes after reset');
    if (!Array.isArray(postResetScenes.body) || postResetScenes.body.length !== 0) {
      throw new Error('Expected scenes to be empty after reset');
    }

    const factoryResetCheck = await requestJson('/api/factory-reset-check');
    expectStatus(factoryResetCheck, 200, 'GET /api/factory-reset-check');
    if (!factoryResetCheck.body || factoryResetCheck.body.factoryReset !== true) {
      throw new Error('Expected factory reset marker to be true after reset endpoints');
    }

    expectStatus(
      await requestJson('/api/config', {
        method: 'POST',
        body: JSON.stringify(snapshots.config),
      }),
      200,
      'POST /api/config restore'
    );

    expectStatus(
      await requestJson('/api/state', {
        method: 'POST',
        body: JSON.stringify(snapshots.state),
      }),
      200,
      'POST /api/state restore'
    );

    expectStatus(
      await requestJson('/api/scenes', {
        method: 'POST',
        body: JSON.stringify(snapshots.scenes),
      }),
      200,
      'POST /api/scenes restore'
    );

    expectStatus(await requestJson('/api/state'), 200, 'GET /api/state post-restore');
    expectStatus(await requestJson('/api/config'), 200, 'GET /api/config post-restore');
    expectStatus(await requestJson('/api/scenes'), 200, 'GET /api/scenes post-restore');

    process.stdout.write('API contract smoke test passed\n');
  } finally {
    if (snapshots) {
      try {
        await requestJson('/api/config', { method: 'POST', body: JSON.stringify(snapshots.config) });
        await requestJson('/api/state', { method: 'POST', body: JSON.stringify(snapshots.state) });
        await requestJson('/api/scenes', { method: 'POST', body: JSON.stringify(snapshots.scenes) });
      } catch {
        // Best effort restoration in finally.
      }
    }
    await stopServer(server);
  }
};

run().catch((error) => {
  process.stderr.write(`API contract smoke test failed: ${error.message}\n`);
  process.exit(1);
});
