#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { closeSync, existsSync, mkdirSync, openSync, rmSync, statSync } from 'node:fs';
import { copyFile, mkdtemp, readdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const repoRoot = path.resolve(new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const mode = (process.argv[2] || 'screenshots').toLowerCase();
const baseUrl = process.argv[4] || process.env.CAPTURE_BASE_URL || 'http://127.0.0.1:3030';
const outArg = process.argv[3];

const screenshotDir = outArg && mode === 'screenshots'
  ? path.resolve(repoRoot, outArg)
  : path.join(os.tmpdir(), `artbastard-demo-screenshots-${timestamp()}`);
const videoDir = outArg && mode === 'videos'
  ? path.resolve(repoRoot, outArg)
  : path.join(repoRoot, 'website', 'videos');

const frameRate = Number(process.env.CAPTURE_FRAMERATE || '12');
const videoBitrate = process.env.CAPTURE_VBITRATE || '800k';
const durationOverride = Number(process.env.CAPTURE_DURATION_SEC || '0');
const clipFilter = new Set((process.env.CAPTURE_CLIP_LIST || '')
  .split(',')
  .map((x) => x.trim())
  .filter(Boolean));

const screenshotSpecs = [
  ['dmx-control', '/', 1600, 1200],
  ['fixture-page', '/#/fixture', 1600, 1200],
  ['scenes-acts-page', '/#/scenes-acts', 1600, 1200],
  ['acts-page', '/#/acts', 1600, 1200],
  ['mobile', '/#/mobile', 430, 932],
  ['settings-page', '/#/settings', 1600, 1200],
];

const videoSpecs = [
  ['dmx-control', '/', 1280, 720, 12, 'sleep:2|pgdn:3|sleep:2|pgup:2'],
  ['fixture-page', '/#/fixture', 1280, 720, 12, 'sleep:3|pgdn:3|sleep:2|pgup:2'],
  ['scenes-acts', '/#/scenes-acts', 1280, 720, 12, 'sleep:3|pgdn:3|sleep:2|pgup:2'],
  ['acts-page', '/#/acts', 1280, 720, 12, 'sleep:3|pgdn:3|sleep:2|pgup:2'],
  ['mobile', '/#/mobile', 430, 932, 10, 'sleep:3|pgdn:2|sleep:2'],
  ['settings-help', '/#/settings', 1280, 720, 12, 'sleep:3|pgdn:3|sleep:2|pgup:2'],
];

const serverLog = path.join(os.tmpdir(), 'artbastard-demo-capture-server.log');
const workRoot = await mkdtemp(path.join(os.tmpdir(), 'artbastard-demo-media-'));
let serverProcess;
let serverLogFd;

try {
  if (!['screenshots', 'videos', 'all'].includes(mode)) {
    throw new Error(`Unknown mode "${mode}". Use screenshots, videos, or all.`);
  }

  const chromePath = findChrome();
  const ffmpegPath = mode === 'videos' || mode === 'all' ? findFfmpeg() : null;

  await ensureServer();

  if (mode === 'screenshots' || mode === 'all') {
    await captureScreenshots(chromePath);
  }

  if (mode === 'videos' || mode === 'all') {
    await captureVideos(chromePath, ffmpegPath);
  }
} finally {
  if (serverProcess) {
    serverProcess.kill();
  }
  if (serverLogFd !== undefined) {
    closeSync(serverLogFd);
  }
  rmSync(workRoot, { recursive: true, force: true });
}

function log(message) {
  console.log(`[capture-demo-media] ${message}`);
}

function timestamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function findChrome() {
  const envPath = process.env.CAPTURE_CHROME;
  const candidates = [
    envPath,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    '/usr/local/bin/google-chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  ].filter(Boolean);

  const found = candidates.find((candidate) => existsSync(candidate));
  if (!found) {
    throw new Error('Chrome/Edge was not found. Set CAPTURE_CHROME to the browser executable.');
  }
  return found;
}

function findFfmpeg() {
  const envPath = process.env.CAPTURE_FFMPEG;
  const candidates = [
    envPath,
    'C:\\Program Files\\Virtual Desktop Streamer\\ffmpeg.exe',
    'C:\\Program Files\\Bitwig Studio\\bin\\ffmpeg.exe',
    '/usr/local/bin/ffmpeg',
    '/usr/bin/ffmpeg',
    '/opt/homebrew/bin/ffmpeg',
  ].filter(Boolean);

  const found = candidates.find((candidate) => existsSync(candidate));
  if (!found) {
    throw new Error('ffmpeg was not found. Set CAPTURE_FFMPEG to regenerate WebM clips.');
  }
  return found;
}

async function ensureServer() {
  if (await waitForHealth(5)) {
    log(`using existing server at ${baseUrl}`);
    return;
  }

  const serverEntry = path.join(repoRoot, 'dist', 'server.js');
  if (!existsSync(serverEntry)) {
    throw new Error('dist/server.js is missing. Run npm run build first.');
  }

  log(`starting backend at ${baseUrl}`);
  serverLogFd = openSync(serverLog, 'w');
  serverProcess = spawn(process.execPath, [serverEntry], {
    cwd: repoRoot,
    stdio: ['ignore', serverLogFd, serverLogFd],
    windowsHide: true,
  });

  if (!(await waitForHealth(45))) {
    throw new Error(`backend did not become healthy; see ${serverLog}`);
  }
}

async function waitForHealth(attempts) {
  for (let i = 0; i < attempts; i += 1) {
    try {
      const response = await fetch(`${baseUrl}/api/health`, { signal: AbortSignal.timeout(1500) });
      if (response.status === 200) return true;
    } catch {
      // keep waiting
    }
    await sleep(1000);
  }
  return false;
}

async function captureScreenshots(chromePath) {
  mkdirSync(screenshotDir, { recursive: true });
  const results = [];

  for (const [name, route, width, height] of screenshotSpecs) {
    const url = `${baseUrl}${route}`;
    const outPath = path.join(screenshotDir, `${name}.png`);
    log(`screenshot ${name}: ${width}x${height} -> ${url}`);
    await withPage(chromePath, url, width, height, async (cdp) => {
      await settlePage(cdp);
      const { data } = await cdp.send('Page.captureScreenshot', {
        format: 'png',
        fromSurface: true,
      });
      await writeFile(outPath, Buffer.from(data, 'base64'));
    });
    results.push(`${name}|path:${outPath}`);
  }

  await writeFile(path.join(screenshotDir, 'capture-results.txt'), `${results.join('\n')}\n`);
  log(`capture_output_dir:${screenshotDir}`);
}

async function captureVideos(chromePath, ffmpegPath) {
  mkdirSync(videoDir, { recursive: true });
  const results = [];

  for (const [name, route, width, height, defaultDuration, recipe] of videoSpecs) {
    if (clipFilter.size && !clipFilter.has(name)) {
      log(`skip clip ${name} (not in CAPTURE_CLIP_LIST)`);
      continue;
    }

    const duration = durationOverride || defaultDuration;
    const url = `${baseUrl}${route}`;
    const clipWork = await mkdtemp(path.join(workRoot, `${name}-`));
    const frameDir = path.join(clipWork, 'frames');
    mkdirSync(frameDir, { recursive: true });
    const videoPath = path.join(videoDir, `${name}.webm`);
    const posterPath = path.join(videoDir, `${name}.jpg`);

    log(`clip ${name}: ${width}x${height} ${duration}s -> ${url}`);
    await withPage(chromePath, url, width, height, async (cdp) => {
      await settlePage(cdp);
      await captureFrameLoop(cdp, frameDir, duration, recipe);
    });

    const firstFrame = path.join(frameDir, 'frame-00001.jpg');
    if (!existsSync(firstFrame)) {
      results.push(`failed\t${name}\tno frames`);
      log(`FAIL clip ${name} (no frames captured)`);
      continue;
    }
    await copyFile(firstFrame, posterPath);
    await encodeWebm(ffmpegPath, frameDir, videoPath);
    const size = statSync(videoPath).size;
    results.push(`ok\t${name}\t${size}b`);
    log(`OK clip ${name} -> ${videoPath} (${size} bytes)`);
  }

  await writeFile(path.join(videoDir, 'capture-results.txt'), `${results.join('\n')}\n`);
  log(`done. results in ${path.join(videoDir, 'capture-results.txt')}`);
}

async function captureFrameLoop(cdp, frameDir, duration, recipe) {
  const intervalMs = 1000 / frameRate;
  const startedAt = Date.now();
  const targetFrames = Math.max(1, Math.round(duration * frameRate));

  const interactions = runInteractions(cdp, recipe);

  for (let frame = 1; frame <= targetFrames; frame += 1) {
    const started = Date.now();
    const { data } = await cdp.send('Page.captureScreenshot', {
      format: 'jpeg',
      quality: 78,
      fromSurface: true,
    });
    await writeFile(
      path.join(frameDir, `frame-${String(frame).padStart(5, '0')}.jpg`),
      Buffer.from(data, 'base64')
    );
    const elapsed = Date.now() - started;
    const nextDueAt = startedAt + frame * intervalMs;
    const remaining = Math.max(0, nextDueAt - Date.now());
    if (elapsed < intervalMs && remaining > 0) {
      await sleep(remaining);
    }
  }

  await interactions.catch(() => undefined);
}

async function runInteractions(cdp, recipe) {
  if (!recipe) return;
  const steps = recipe.split('|').filter(Boolean);
  for (const step of steps) {
    const [kind, rawValue] = step.split(':');
    if (kind === 'sleep') {
      await sleep(Number(rawValue) * 1000);
    } else if (kind === 'pgdn' || kind === 'pgup') {
      const count = Number(rawValue);
      const direction = kind === 'pgdn' ? 1 : -1;
      for (let i = 0; i < count; i += 1) {
        await cdp.send('Runtime.evaluate', {
          expression: `window.scrollBy({ top: Math.round(window.innerHeight * 0.82 * ${direction}), behavior: 'smooth' });`,
        });
        await sleep(650);
      }
    }
  }
}

async function encodeWebm(ffmpegPath, frameDir, outPath) {
  const args = [
    '-y',
    '-hide_banner',
    '-loglevel',
    'error',
    '-framerate',
    String(frameRate),
    '-i',
    path.join(frameDir, 'frame-%05d.jpg'),
    '-c:v',
    'libvpx-vp9',
    '-b:v',
    videoBitrate,
    '-pix_fmt',
    'yuv420p',
    '-an',
    outPath,
  ];
  await run(ffmpegPath, args, { cwd: repoRoot });
}

async function withPage(chromePath, url, width, height, fn) {
  const port = await freePort();
  const profileDir = await mkdtemp(path.join(os.tmpdir(), 'artbastard-chrome-'));
  const chrome = spawn(chromePath, [
    '--headless=new',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profileDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-gpu',
    '--disable-dev-shm-usage',
    '--disable-features=Translate,TranslateUI,MediaRouter',
    '--autoplay-policy=no-user-gesture-required',
    '--disable-notifications',
    '--hide-scrollbars=false',
    `--window-size=${width},${height}`,
    'about:blank',
  ], {
    cwd: repoRoot,
    stdio: ['ignore', 'ignore', 'ignore'],
    windowsHide: true,
  });

  let cdp;
  try {
    const wsUrl = await waitForDebugger(port);
    cdp = await connectCdp(wsUrl);
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: width < 700,
    });
    await seedCapturePreferences(cdp);
    await navigate(cdp, url);
    await fn(cdp);
  } finally {
    if (cdp) cdp.close();
    chrome.kill();
    await waitForExit(chrome, 3000);
    rmSync(profileDir, { recursive: true, force: true, maxRetries: 8, retryDelay: 250 });
  }
}

async function seedCapturePreferences(cdp) {
  await cdp.send('Page.addScriptToEvaluateOnNewDocument', {
    source: `
      localStorage.setItem('midiMonitorDismissed', 'true');
      localStorage.setItem('oscMonitorDismissed', 'true');
    `,
  }).catch(() => undefined);
}

async function navigate(cdp, url) {
  const load = cdp.once('Page.loadEventFired', 12000).catch(() => undefined);
  await cdp.send('Page.navigate', { url });
  await load;
  await settlePage(cdp);
}

async function settlePage(cdp) {
  await cdp.send('Runtime.evaluate', {
    expression: `
      new Promise((resolve) => {
        const done = () => requestAnimationFrame(() => requestAnimationFrame(resolve));
        if (document.readyState === 'complete') {
          done();
        } else {
          window.addEventListener('load', done, { once: true });
        }
      })
    `,
    awaitPromise: true,
  }).catch(() => undefined);
  await cdp.send('Runtime.evaluate', {
    expression: `document.fonts && document.fonts.ready ? document.fonts.ready.then(() => true) : true`,
    awaitPromise: true,
  }).catch(() => undefined);
  await cdp.send('Runtime.evaluate', { expression: 'window.scrollTo(0, 0)' }).catch(() => undefined);
  await sleep(1500);
}

async function waitForDebugger(port) {
  for (let i = 0; i < 80; i += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/list`, {
        signal: AbortSignal.timeout(500),
      });
      const tabs = await response.json();
      const page = tabs.find((tab) => tab.type === 'page' && tab.webSocketDebuggerUrl);
      if (page) return page.webSocketDebuggerUrl;
    } catch {
      // keep waiting
    }
    await sleep(250);
  }
  throw new Error(`Chrome DevTools did not become available on port ${port}`);
}

function connectCdp(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    const pending = new Map();
    const listeners = new Map();
    let nextId = 1;

    const session = {
      send(method, params = {}) {
        const id = nextId;
        nextId += 1;
        ws.send(JSON.stringify({ id, method, params }));
        return new Promise((res, rej) => pending.set(id, { res, rej }));
      },
      once(method, timeoutMs = 10000) {
        return new Promise((res, rej) => {
          const timer = setTimeout(() => rej(new Error(`Timed out waiting for ${method}`)), timeoutMs);
          const list = listeners.get(method) || [];
          list.push((params) => {
            clearTimeout(timer);
            res(params);
          });
          listeners.set(method, list);
        });
      },
      close() {
        ws.close();
      },
    };

    ws.addEventListener('open', () => resolve(session));
    ws.addEventListener('error', (event) => reject(event.error || new Error('CDP websocket error')));
    ws.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      if (message.id && pending.has(message.id)) {
        const { res, rej } = pending.get(message.id);
        pending.delete(message.id);
        if (message.error) {
          rej(new Error(message.error.message || JSON.stringify(message.error)));
        } else {
          res(message.result || {});
        }
        return;
      }
      if (message.method && listeners.has(message.method)) {
        const list = listeners.get(message.method);
        const listener = list.shift();
        if (list.length === 0) listeners.delete(message.method);
        if (listener) listener(message.params || {});
      }
    });
  });
}

function freePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      server.close(() => resolve(address.port));
    });
    server.on('error', reject);
  });
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { ...options, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    let stderr = '';
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${path.basename(command)} exited ${code}: ${stderr.trim()}`));
      }
    });
  });
}

function waitForExit(child, timeoutMs) {
  return new Promise((resolve) => {
    if (child.exitCode !== null) {
      setTimeout(resolve, 250);
      return;
    }
    const timer = setTimeout(resolve, timeoutMs);
    child.once('exit', () => {
      clearTimeout(timer);
      resolve();
    });
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
