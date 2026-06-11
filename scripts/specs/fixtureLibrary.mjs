// Fixture library MD → TS codegen.
// Reads DOCS/fixtures/library/*.md (frontmatter + per-mode tables) and emits
// react-app/src/fixtures/library/generated/mdFixtureLibraryEntries.ts with a
// typed `mdFixtureLibraryEntries: FixtureLibraryEntry[]` array. The runtime
// catalog (entries.ts) merges these with any remaining hand-authored TS
// entries so migration can happen incrementally.

import { readdirSync, statSync, writeFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';

import { readSpecFile, splitFrontmatter, generatedHeader, jsonPretty, makeAssert } from './shared/mdParser.mjs';

const assert = makeAssert('fixture-library');

function listMdFiles(dir) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...listMdFiles(full));
    else if (entry.toLowerCase().endsWith('.md')) out.push(full);
  }
  return out.sort();
}

function parseTagsField(raw) {
  if (Array.isArray(raw)) return raw.map((x) => String(x).trim()).filter(Boolean);
  if (typeof raw === 'string') {
    return raw
      .replace(/^\[|\]$/g, '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

function parseChannelRow(row, file) {
  const name = row.name || '';
  const type = row.type || 'other';
  assert(name, file, `mode table row missing "name" column`);
  const ranges = [];
  const min = row.min !== undefined && row.min !== '' ? Number(row.min) : undefined;
  const max = row.max !== undefined && row.max !== '' ? Number(row.max) : undefined;
  const description = row.description || '';
  if (min !== undefined && max !== undefined) {
    ranges.push({ min, max, description });
  }
  const channel = { name, type };
  if (ranges.length) channel.ranges = ranges;
  return channel;
}

function buildMode(modeName, tableRows, file) {
  const channels = tableRows.map((row) => parseChannelRow(row, file));
  return {
    name: modeName,
    channels: channels.length,
    channelData: channels,
  };
}

function parseModeSections(body) {
  const lines = body.split(/\r?\n/);
  const sections = [];
  let current = null;
  const flush = () => {
    if (current) sections.push(current);
    current = null;
  };
  for (const line of lines) {
    const heading = line.match(/^##\s+Mode:\s+(.+?)\s*$/i);
    if (heading) {
      flush();
      current = { name: heading[1].trim(), tableLines: [] };
      continue;
    }
    if (!current) continue;
    if (/^##\s+/.test(line)) {
      flush();
      continue;
    }
    if (line.trim().startsWith('|')) current.tableLines.push(line);
  }
  flush();
  return sections.map((section) => ({
    name: section.name,
    rows: parseTableLines(section.tableLines),
  })).filter((section) => section.rows.length);
}

function parseTableLines(lines) {
  if (lines.length < 2) return [];
  const header = splitRow(lines[0]);
  const sep = splitRow(lines[1]);
  if (!sep.every((c) => /^:?-+:?$/.test(c.trim()))) return [];
  const rows = [];
  for (let i = 2; i < lines.length; i++) {
    const cells = splitRow(lines[i]);
    if (!cells.length) continue;
    const row = {};
    header.forEach((h, idx) => {
      row[h.trim()] = (cells[idx] ?? '').trim();
    });
    rows.push(row);
  }
  return rows;
}

function splitRow(line) {
  const trimmed = line.trim();
  if (!trimmed.startsWith('|') || !trimmed.endsWith('|')) return [];
  return trimmed.slice(1, -1).split('|').map((c) => c.trim());
}

function buildEntry(file) {
  const src = readFileSync(file, 'utf8');
  const { frontmatter, body } = splitFrontmatter(src);
  assert(frontmatter?.spec === 'fixture-library', file, `frontmatter "spec" must equal "fixture-library"`);
  assert(frontmatter.id, file, `frontmatter missing "id"`);
  assert(frontmatter.catalogId, file, `frontmatter missing "catalogId"`);
  assert(frontmatter.name, file, `frontmatter missing "name"`);

  const modeSections = parseModeSections(body);
  const modes = modeSections.map((section) => buildMode(section.name, section.rows, file));

  if (Array.isArray(frontmatter.modes)) {
    for (const fmMode of frontmatter.modes) {
      modes.push({
        name: fmMode.name,
        channels: fmMode.channels ?? (Array.isArray(fmMode.channelData) ? fmMode.channelData.length : 0),
        channelData: fmMode.channelData || [],
      });
    }
  }

  assert(modes.length > 0, file, `at least one "## Mode: <name>" table or frontmatter mode is required`);

  const entry = {
    id: String(frontmatter.id),
    catalogId: String(frontmatter.catalogId),
    name: String(frontmatter.name),
    defaultNamePrefix: String(frontmatter.defaultNamePrefix || frontmatter.name),
    type: String(frontmatter.type || 'Fixture'),
    category: String(frontmatter.category || 'Generic'),
    manufacturer: String(frontmatter.manufacturer || 'Generic'),
    modes,
    tags: parseTagsField(frontmatter.tags),
  };
  if (frontmatter.model) entry.model = String(frontmatter.model);
  if (frontmatter.modelConfidence) entry.modelConfidence = String(frontmatter.modelConfidence);
  if (frontmatter.photoUrl) entry.photoUrl = String(frontmatter.photoUrl);
  if (frontmatter.documentationPath) entry.documentationPath = String(frontmatter.documentationPath);
  if (frontmatter.notes) entry.notes = String(frontmatter.notes);
  if (frontmatter.addressing) entry.addressing = frontmatter.addressing;
  return entry;
}

function emitTs(entries) {
  const banner = generatedHeader('scripts/specs/fixtureLibrary.mjs');
  const body = `import type { FixtureLibraryEntry } from '../types';\n\nexport const mdFixtureLibraryEntries: FixtureLibraryEntry[] = ${jsonPretty(entries)};\n`;
  return banner + '\n' + body;
}

function writeIfChanged(file, contents) {
  const prev = existsSync(file) ? readFileSync(file, 'utf8') : null;
  if (prev === contents) return false;
  writeFileSync(file, contents, 'utf8');
  return true;
}

export function buildFixtureLibrary({ rootDir }) {
  const docsDir = resolve(rootDir, 'DOCS/fixtures/library');
  const outDir = resolve(rootDir, 'react-app/src/fixtures/library/generated');
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

  const files = listMdFiles(docsDir);
  const entries = files.map(buildEntry);

  const out = join(outDir, 'mdFixtureLibraryEntries.ts');
  const changed = writeIfChanged(out, emitTs(entries));
  return { outDir, files: [out], written: changed ? 1 : 0, entryCount: entries.length };
}
