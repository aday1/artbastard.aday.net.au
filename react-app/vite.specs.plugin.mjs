// Vite plugin: re-runs scripts/buildSpecs.mjs when any spec MD file changes.
// Watches DOCS/{midi,fixtures,scenes,acts}/**/*.md and regenerates the matching
// TS modules in-process so dev-server reloads pick up edits without restart.

import { spawn } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');
const generatorPath = resolve(repoRoot, 'scripts/buildSpecs.mjs');

const WATCH_DOMAINS = [
  { docsDir: resolve(repoRoot, 'DOCS/midi'),              domain: 'midi' },
  { docsDir: resolve(repoRoot, 'DOCS/fixtures/library'),  domain: 'fixtureLibrary' },
  { docsDir: resolve(repoRoot, 'DOCS/scenes/packs'),      domain: 'scenes' },
  { docsDir: resolve(repoRoot, 'DOCS/acts/packs'),        domain: 'acts' },
];

let running = false;
let queued = null;

function runGenerator(label, domain) {
  if (running) {
    queued = domain;
    return;
  }
  running = true;
  const started = Date.now();
  const args = domain ? [generatorPath, domain] : [generatorPath];
  const child = spawn(process.execPath, args, { cwd: repoRoot, stdio: 'inherit' });
  child.on('exit', (code) => {
    running = false;
    const ms = Date.now() - started;
    if (code === 0) console.log(`[vite-specs] regenerated (${label}, ${ms}ms)`);
    else console.error(`[vite-specs] generator exited with code ${code}`);
    if (queued) {
      const next = queued;
      queued = null;
      runGenerator('coalesced', next);
    }
  });
}

function domainForPath(file) {
  const normalized = file.replace(/\\/g, '/');
  for (const { docsDir, domain } of WATCH_DOMAINS) {
    if (normalized.includes(docsDir.replace(/\\/g, '/'))) return domain;
  }
  return null;
}

export default function specsPlugin() {
  return {
    name: 'artbastard-specs',
    enforce: 'pre',
    buildStart() {
      if (!existsSync(generatorPath)) {
        this.warn(`buildSpecs.mjs not found at ${generatorPath} — skipping spec generation`);
        return;
      }
      runGenerator('buildStart');
    },
    configureServer(server) {
      for (const { docsDir } of WATCH_DOMAINS) {
        if (!existsSync(docsDir)) continue;
        server.watcher.add(`${docsDir}/**/*.md`);
      }
      const handle = (event) => (file) => {
        const domain = domainForPath(file);
        if (!domain) return;
        runGenerator(`${event}:${file.split(/[\\/]/).pop()}`, domain);
      };
      server.watcher.on('change', handle('change'));
      server.watcher.on('add', handle('add'));
    },
  };
}
