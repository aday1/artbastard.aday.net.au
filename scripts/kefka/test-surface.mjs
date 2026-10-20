/**
 * Browser/API integration against an isolated fake HTTP server.
 * Uses only Node built-ins plus Chromium; never contacts ArtBastard or Art-Net.
 */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const publicDir = fileURLToPath(new URL('../../react-app/public/', import.meta.url));
const profile = await mkdtemp(path.join(tmpdir(), 'artbastard-deck-test-'));
let channels = Array(512).fill(0);
const mutations = [];
let holdStateReads = false;
const heldStateReads = [];
const server = createServer(async (request, response) => {
  try {
    if (request.url.startsWith('/api/')) {
      response.setHeader('Content-Type', 'application/json');
      if (request.url === '/api/kefka/surfaces' && request.method === 'GET') {
        response.end('{"enabled":false}');
        return;
      }
      if (request.method === 'GET') {
        assert.equal(request.url, '/api/state', 'Unexpected fake API GET');
        // Capture at request time to reproduce an old state response arriving
        // after a successful POST. Tests explicitly release these responses.
        const snapshot = JSON.stringify({ dmxChannels: channels, scenes: [{ name: 'Test scene', channelValues: [12] }], channelNames: {}, artNetConfig: { ip: 'TEST ONLY' } });
        if (holdStateReads) await new Promise(resolve => heldStateReads.push(resolve));
        response.end(snapshot);
        return;
      }
      let body = '';
      for await (const chunk of request) body += chunk;
      const data = JSON.parse(body);
      mutations.push({ path: request.url, data });
      if (request.url === '/api/dmx') channels[data.channel] = data.value;
      else if (request.url === '/api/dmx/batch') for (const [channel, value] of Object.entries(data)) channels[Number(channel)] = value;
      else if (request.url === '/api/scenes/load') channels[0] = 12;
      response.end('{"success":true}');
      return;
    }
    const name = request.url.split('?')[0].slice(1);
    if (!/^[a-z-]+\.(html|css|mjs)$/.test(name)) {
      response.writeHead(404).end();
      return;
    }
    response.setHeader('Content-Type', name.endsWith('.html') ? 'text/html' : name.endsWith('.css') ? 'text/css' : 'text/javascript');
    response.end(await readFile(path.join(publicDir, name)));
  } catch (error) {
    response.writeHead(500).end(String(error));
  }
});
await new Promise((resolve, reject) => {
  server.once('error', reject);
  server.listen(0, '127.0.0.1', resolve);
});
const base = `http://127.0.0.1:${server.address().port}`;
const chrome = spawn(process.env.CHROMIUM || 'chromium', [
  '--headless=new', '--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu',
  '--remote-debugging-port=0', '--no-first-run', '--no-default-browser-check',
  '--window-size=1280,800', `--user-data-dir=${profile}`, 'about:blank',
], { stdio: ['ignore', 'ignore', 'pipe'] });
let socket;
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
try {
  const debugUrl = await new Promise((resolve, reject) => {
    let output = '';
    const timeout = setTimeout(() => reject(new Error(`Chromium did not start: ${output.slice(-1500)}`)), 15000);
    chrome.on('error', reject);
    chrome.stderr.on('data', chunk => {
      output += chunk;
      const match = output.match(/DevTools listening on (ws:\/\/[^\s]+)/);
      if (match) { clearTimeout(timeout); resolve(match[1]); }
    });
  });
  const debugBase = debugUrl.replace(/^ws:/, 'http:').split('/devtools/')[0];
  const pages = await fetch(`${debugBase}/json/list`).then(response => response.json());
  socket = new WebSocket(pages.find(page => page.type === 'page').webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  let sequence = 0;
  const pending = new Map();
  socket.onmessage = event => {
    const message = JSON.parse(event.data);
    if (!message.id) return;
    const item = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) item.reject(new Error(JSON.stringify(message.error)));
    else item.resolve(message.result);
  };
  function cdp(method, params = {}) {
    const id = ++sequence;
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      socket.send(JSON.stringify({ id, method, params }));
    });
  }
  async function evaluate(expression) {
    const result = await cdp('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
    return result.result.value;
  }
  async function until(expression, message) {
    for (let i = 0; i < 60; i++) {
      if (await evaluate(expression)) return;
      await wait(50);
    }
    throw new Error(message);
  }
  async function untilServer(predicate, message, timeoutMs = 3000) {
    for (let i = 0; i < Math.ceil(timeoutMs / 50); i++) {
      if (predicate()) return;
      await wait(50);
    }
    throw new Error(message);
  }
  await cdp('Page.enable');
  await cdp('Emulation.setFocusEmulationEnabled', { enabled: true });
  await cdp('Page.addScriptToEvaluateOnNewDocument', { source: `
    window.EventSource = class { constructor() { window.testNativeStream = this; } };
    window.testNative = (buttons, overrides = {}) => window.testNativeStream.onmessage({data: JSON.stringify({
      connected: true, nativeAllowed: true, nativeReason: null,
      pad: {connection: '1:1', buttons: Array.from({length: 16}, (_, i) => buttons.includes(i) ? 1 : 0)},
      ...overrides
    })});
    window.testButtons = [3]; // Held Y on connection must never arm.
    window.testPadConnected = true;
    window.testPadId = 'Isolated test pad';
    Object.defineProperty(navigator, 'getGamepads', { value: () => window.testPadConnected ? [{
      connected: true, mapping: 'standard', id: window.testPadId, index: 0,
      buttons: Array.from({length: 16}, (_, i) => ({value: window.testButtons.includes(i) ? 1 : 0}))
    }] : [] });
  ` });
  await cdp('Page.navigate', { url: `${base}/deck-control.html` });
  await cdp('Page.bringToFront');
  await until(`document.getElementById('controller')?.textContent.includes('release all buttons')`, 'Controller did not initialize');
  assert.equal(mutations.length, 0, 'Opening the surface must not write DMX');
  assert.equal(await evaluate(`document.getElementById('arm').getAttribute('aria-pressed')`), 'false');
  await evaluate('window.testButtons = []');
  await wait(100);
  await evaluate('window.testButtons = [3]');
  await until(`document.getElementById('arm').getAttribute('aria-pressed') === 'true'`, 'Y did not arm');
  await evaluate('window.testButtons = []');
  await wait(50);
  await evaluate('window.testButtons = [6,12]');
  await until(`document.getElementById('value').textContent === '1'`, 'LT+up did not set channel');
  await evaluate('window.testButtons = []');
  assert.deepEqual(mutations[0], { path: '/api/dmx', data: { channel: 0, value: 1 } });
  await until(`!document.getElementById('recall').disabled`, 'Recall did not become available');
  await evaluate('window.testButtons = [6,0]');
  await until(`document.getElementById('value').textContent === '12'`, 'Scene recall failed');
  await evaluate('window.testButtons = []');
  assert.ok(mutations.some(item => item.path === '/api/scenes/load' && item.data.name === 'Test scene'));
  await wait(80);
  await evaluate('window.testButtons = [2]');
  await until(`document.getElementById('value').textContent === '0'`, 'Blackout failed');
  await evaluate('window.testButtons = []');
  const zero = mutations.find(item => item.path === '/api/dmx/batch');
  assert.equal(Object.keys(zero.data).length, 512);
  assert.ok(Object.values(zero.data).every(value => value === 0));
  assert.equal(await evaluate(`document.getElementById('arm').getAttribute('aria-pressed')`), 'false');
  await wait(80);
  await evaluate('window.testButtons = [3]');
  await until(`document.getElementById('arm').getAttribute('aria-pressed') === 'true'`, 'Could not rearm');
  await evaluate(`window.dispatchEvent(new Event('blur')); window.testButtons = [6,12]`);
  const count = mutations.length;
  await wait(300);
  assert.equal(mutations.length, count, 'Focus loss must prevent output');
  assert.equal(await evaluate(`document.getElementById('arm').getAttribute('aria-pressed')`), 'false');
  // Disconnected pad + touch-only controls must remain useful.
  await evaluate('window.testPadConnected = false; window.testButtons = []');
  await wait(80);
  await evaluate(`document.getElementById('arm').click()`);
  await until(`document.getElementById('arm').getAttribute('aria-pressed') === 'true'`, 'Touch-only arm failed');
  await evaluate(`document.querySelector('[data-adjust="1"]').click()`);
  await until(`document.getElementById('value').textContent === '1'`, 'Touch-only adjustment failed');
  // Exercise the actual native bridge JSON shape, including source-switch disarm.
  const beforeNative = mutations.length;
  await evaluate('window.testNative([3])');
  await wait(80);
  assert.equal(await evaluate(`document.getElementById('arm').getAttribute('aria-pressed')`), 'false');
  assert.equal(mutations.length, beforeNative, 'A native reader attaching while Y held must be silent');
  await evaluate('window.testNative([])');
  await wait(50);
  await evaluate('window.testNative([3])');
  await until(`document.getElementById('arm').getAttribute('aria-pressed') === 'true'`, 'Native Y did not arm');
  await evaluate('window.testNative([])');
  await wait(50);
  await evaluate('window.testNative([6,12])');
  await until(`document.getElementById('value').textContent === '2'`, 'Native LT+up did not write');
  await evaluate('window.testNative([])');
  assert.deepEqual(mutations.at(-1), { path: '/api/dmx', data: { channel: 0, value: 2 } });
  // A focused browser page must not bypass desktop ownership through either
  // the SSE payload or a browser copy of the built-in Steam Deck gamepad.
  const beforeDenied = mutations.length;
  await evaluate(`window.testPadConnected = true; window.testPadId = 'Steam Deck (Vendor: 28de Product: 1205)'`);
  for (const reason of ['Deck desktop mode', 'Deck mapper is not running', 'Focus the ArtBastard Deck launcher window']) {
    await evaluate(`window.testNative([3], {nativeAllowed: false, nativeReason: ${JSON.stringify(reason)}}); window.testButtons = [3]`);
    await wait(80);
    assert.equal(await evaluate(`document.getElementById('arm').getAttribute('aria-pressed')`), 'false');
    await evaluate(`window.testNative([6,12], {nativeAllowed: false}); window.testButtons = [6,12]`);
    await wait(80);
    assert.equal(mutations.length, beforeDenied, `${reason} must suppress native and built-in Gamepad output`);
  }
  await evaluate(`window.testNativeStream.onerror(); window.testButtons = [3]`);
  await wait(80);
  assert.equal(await evaluate(`document.getElementById('arm').getAttribute('aria-pressed')`), 'false',
    'Missing helper must not fall back to built-in browser Gamepad');
  // A genuine external pad remains usable after native mode is denied.
  await evaluate(`window.testPadId = 'External USB gamepad'; window.testButtons = []`);
  await wait(80);
  await evaluate(`window.testButtons = [3]`);
  await until(`document.getElementById('arm').getAttribute('aria-pressed') === 'true'`, 'External gamepad was incorrectly blocked');
  await evaluate(`window.testPadConnected = false; window.testButtons = []; window.testNative([3])`);
  await wait(80);
  assert.equal(await evaluate(`document.getElementById('arm').getAttribute('aria-pressed')`), 'false',
    'Re-entering native mode with held Y must require neutral');
  assert.equal(mutations.length, beforeDenied, 'Mode handoffs must not write DMX');
  // Regression: a pre-write poll returning late must not leave the channel at
  // zero or enable edits before an authoritative post-write read finishes.
  await evaluate(`window.testNativeStream.onmessage({data:'{"pad":null}'})`);
  // Source changes are consumed in requestAnimationFrame, which may be delayed
  // under build/browser load. Await the handoff before attempting touch arming.
  await until(`document.getElementById('controller').textContent.startsWith('Touch controls') &&
    !document.getElementById('arm').disabled`, 'Native controller detach was not processed');
  await evaluate(`document.getElementById('next').click(); document.getElementById('arm').click()`);
  await until(`document.getElementById('arm').getAttribute('aria-pressed') === 'true'`, 'Could not arm for delayed-state regression');
  const beforeDelayed = mutations.length;
  holdStateReads = true;
  await untilServer(() => heldStateReads.length === 1, 'Periodic state read was not captured');
  await evaluate(`document.querySelector('[data-adjust="1"]').click()`);
  await untilServer(() => mutations.length === beforeDelayed + 1, 'First delayed-state adjustment was not sent');
  await wait(80); // Allow the POST response to arrive while its old GET is held.
  assert.equal(await evaluate(`document.querySelector('[data-adjust="1"]').disabled`), true,
    'Edits must remain disabled while a pre-write state read is outstanding');
  heldStateReads.shift()();
  await untilServer(() => heldStateReads.length === 1, 'A distinct post-write state read was not requested');
  assert.equal(await evaluate(`document.querySelector('[data-adjust="1"]').disabled`), true,
    'Edits must remain disabled until the authoritative state read finishes');
  holdStateReads = false;
  heldStateReads.shift()();
  await until(`document.getElementById('value').textContent === '1' && !document.querySelector('[data-adjust="1"]').disabled`,
    'Fresh state did not unblock editing with the confirmed value');
  await evaluate(`document.querySelector('[data-adjust="1"]').click()`);
  await until(`document.getElementById('value').textContent === '2' && !document.querySelector('[data-adjust="1"]').disabled`,
    'Second increment did not use the confirmed value');
  assert.deepEqual(mutations.slice(beforeDelayed).map(item => item.data), [
    { channel: 1, value: 1 }, { channel: 1, value: 2 },
  ], 'Two deliberate +1 presses must send 1 then 2 even with an old read in flight');
  // State reconciliation must not delay blackout behind a slow GET.
  holdStateReads = true;
  await evaluate(`document.querySelector('[data-adjust="1"]').click()`);
  await untilServer(() => heldStateReads.length === 1, 'Post-write read was not held for blackout regression');
  const beforeBlackout = mutations.length;
  await evaluate(`document.getElementById('blackout').click()`);
  await untilServer(() => mutations.length === beforeBlackout + 1, 'Blackout waited behind a state read', 500);
  assert.equal(mutations.at(-1).path, '/api/dmx/batch');
  assert.ok(channels.every(value => value === 0), 'Blackout must reach the server before any held GET is released');
  holdStateReads = false;
  heldStateReads.shift()();
  await until(`document.getElementById('value').textContent === '0'`, 'Blackout state did not reconcile after the slow read');
  assert.equal(await evaluate(`document.getElementById('arm').getAttribute('aria-pressed')`), 'false');
  if (process.env.SCREENSHOT) {
    const capture = await cdp('Page.captureScreenshot', { format: 'png' });
    await writeFile(process.env.SCREENSHOT, Buffer.from(capture.data, 'base64'));
  }
  console.log(`Deck surface integration passed (${mutations.length} deliberate writes, all to fake API).`);
} finally {
  socket?.close();
  chrome.kill();
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
  await new Promise(resolve => chrome.exitCode !== null ? resolve() : chrome.once('exit', resolve));
  await rm(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
}
