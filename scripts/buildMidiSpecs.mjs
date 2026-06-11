#!/usr/bin/env node
// Back-compat shim: regenerates only the MIDI specs.
// Prefer `node scripts/buildSpecs.mjs` (umbrella) for new call sites.
//
// Edit DOCS/midi/*.md to change MIDI behavior; this script regenerates the
// TS modules under react-app/src/midi/generated/. The actual parsing and
// emission logic lives in scripts/specs/midi.mjs.

import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildMidi } from './specs/midi.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const result = buildMidi({ rootDir: ROOT });
console.log(`[buildMidiSpecs] wrote ${result.files.length} files → ${result.outDir}`);
