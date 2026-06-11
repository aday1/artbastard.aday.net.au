#!/usr/bin/env node
// Umbrella spec builder. Runs all data-driven codegen domains under DOCS/.
//
// Usage:
//   node scripts/buildSpecs.mjs                # all domains
//   node scripts/buildSpecs.mjs midi           # one domain
//   node scripts/buildSpecs.mjs midi scenes    # subset
//
// Each domain lives in scripts/specs/{domain}.mjs and exports a build({rootDir})
// function. Add new domains by importing them in DOMAINS below.

import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildMidi } from './specs/midi.mjs';
import { buildFixtureLibrary } from './specs/fixtureLibrary.mjs';
import { buildScenes } from './specs/scenes.mjs';
import { buildActs } from './specs/acts.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const DOMAINS = {
  midi: buildMidi,
  fixtureLibrary: buildFixtureLibrary,
  scenes: buildScenes,
  acts: buildActs,
};

function main() {
  const args = process.argv.slice(2).filter((a) => !a.startsWith('-'));
  const requested = args.length ? args : Object.keys(DOMAINS);

  const unknown = requested.filter((d) => !DOMAINS[d]);
  if (unknown.length) {
    console.error(`[buildSpecs] unknown domain(s): ${unknown.join(', ')}`);
    console.error(`[buildSpecs] known domains: ${Object.keys(DOMAINS).join(', ')}`);
    process.exit(1);
  }

  let totalWritten = 0;
  for (const domain of requested) {
    const started = Date.now();
    const result = DOMAINS[domain]({ rootDir: ROOT });
    const ms = Date.now() - started;
    const wrote = result?.written ?? '?';
    const total = result?.files?.length ?? '?';
    console.log(`[buildSpecs:${domain}] ${wrote}/${total} files updated (${ms}ms) → ${result?.outDir ?? ''}`);
    totalWritten += result?.written ?? 0;
  }

  if (requested.length > 1) {
    console.log(`[buildSpecs] ${totalWritten} file(s) updated across ${requested.length} domain(s)`);
  }
}

main();
