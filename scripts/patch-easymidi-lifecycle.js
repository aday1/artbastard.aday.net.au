#!/usr/bin/env node
'use strict';

// EasyMIDI 3.2.0 closes ports but retains the native RtMidi clients. Frequent
// enumeration can exhaust ALSA's client slots before JavaScript collects them.
// Patch the dependency itself so its constructors' lexical getInputs/getOutputs
// calls and every application consumer share the same deterministic cleanup.
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');

const EASYMIDI_VERSION = '3.2.0';
const NATIVE_VERSION = '3.6.1';
const ORIGINAL_SHA256 = 'c4b4189ef120c481a5f31e5aec92c7cc218fd8219e5a2805be626d17aed4ccaf';
const PATCHED_SHA256 = '2f3aa744403db0fc1461b2c99b75d8b92cd3293fde5858133cdc71f01710fc8c';
const hash = (source) => crypto.createHash('sha256').update(source).digest('hex');

function replaceOnce(source, before, after) {
  if (!source.includes(before) || source.indexOf(before) !== source.lastIndexOf(before)) {
    throw new Error('EasyMIDI lifecycle patch: expected source fragment was not unique');
  }
  return source.replace(before, after);
}

function patchedSource(source, easyVersion, nativeVersion) {
  if (easyVersion !== EASYMIDI_VERSION || nativeVersion !== NATIVE_VERSION) {
    throw new Error(`EasyMIDI lifecycle patch requires easymidi ${EASYMIDI_VERSION} and @julusian/midi ${NATIVE_VERSION}; found ${easyVersion} / ${nativeVersion}. Review the patch before upgrading.`);
  }
  if (hash(source) === PATCHED_SHA256) return source;
  if (hash(source) !== ORIGINAL_SHA256) {
    throw new Error('EasyMIDI lifecycle patch: unfamiliar dependency source; refusing to modify it');
  }

  for (const kind of ['input', 'output']) {
    // Each constructor owns a separate native handle, including when enumeration
    // or openPort fails because a USB device disappears during construction.
    const allocation = `    this._${kind} = new midi.${kind}();\n`;
    const start = source.indexOf(allocation) + allocation.length;
    const end = source.indexOf('\n  }\n\n  close() {', start);
    if (start < allocation.length || end < start) throw new Error('Cannot locate EasyMIDI constructor');
    const body = source.slice(start, end);
    source = source.slice(0, start) + '    try {\n' +
      body.split('\n').map((line) => `  ${line}`).join('\n') +
      `\n    } catch (error) {\n      try { this._${kind}.destroy(); } finally { throw error; }\n    }` +
      source.slice(end);
    source = replaceOnce(source,
      `  close() {\n    this._${kind}.closePort();\n  }\n\n  isPortOpen() {\n    return this._${kind}.isPortOpen();\n  }`,
      `  close() {\n    if (!this._closed) {\n      this._${kind}.destroy();\n      this._closed = true;\n    }\n  }\n\n  isPortOpen() {\n    return !this._closed && this._${kind}.isPortOpen();\n  }`);

    const plural = `${kind}s`;
    const enumerationStart = `  const ${kind} = new midi.${kind}();\n`;
    source = replaceOnce(source, enumerationStart, enumerationStart + '  try {\n');
    source = replaceOnce(source,
      `  ${kind}.closePort();\n  return ${plural};\n}`,
      `  return ${plural};\n  } finally {\n    ${kind}.destroy();\n  }\n}`);
  }
  return '// ArtBastard: deterministic native MIDI lifetime; see scripts/patch-easymidi-lifecycle.js.\n' + source;
}

function patchInstalledDependency(repoRoot = path.join(__dirname, '..')) {
  const fromProject = createRequire(path.join(path.resolve(repoRoot), 'package.json'));
  const filename = fromProject.resolve('easymidi');
  const fromEasyMidi = createRequire(filename);
  const easyVersion = JSON.parse(fs.readFileSync(fromProject.resolve('easymidi/package.json'), 'utf8')).version;
  const nativeVersion = JSON.parse(fs.readFileSync(fromEasyMidi.resolve('@julusian/midi/package.json'), 'utf8')).version;
  const source = fs.readFileSync(filename, 'utf8');
  const patched = patchedSource(source, easyVersion, nativeVersion);
  if (patched === source) return false;
  // Validate everything before replacing the dependency file.
  fs.writeFileSync(filename, patched);
  return true;
}

if (require.main === module) {
  const changed = patchInstalledDependency(process.argv[2]);
  console.log(`EasyMIDI native handle cleanup ${changed ? 'applied' : 'already applied'}.`);
}

module.exports = { patchedSource, patchInstalledDependency };
