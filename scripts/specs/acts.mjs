// ACT seed pack MD → TS codegen. Same pragmatic shape as scenes.mjs: pack
// metadata in MD frontmatter, template bodies (STARTER_TEMPLATES,
// PERFORMANCE_TEMPLATES) stay in actSeedGenerator.ts for now and get filtered
// by id at seed time.

import { readdirSync, statSync, writeFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';

import { splitFrontmatter, generatedHeader, jsonPretty, makeAssert } from './shared/mdParser.mjs';

const assert = makeAssert('acts');

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

function parseListField(raw) {
  if (Array.isArray(raw)) return raw.map((x) => String(x).trim()).filter(Boolean);
  if (typeof raw === 'string') {
    return raw.replace(/^\[|\]$/g, '').split(',').map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

function buildPack(file) {
  const src = readFileSync(file, 'utf8');
  const { frontmatter } = splitFrontmatter(src);
  assert(frontmatter?.spec === 'act-pack', file, `frontmatter "spec" must equal "act-pack"`);
  assert(frontmatter.id, file, `frontmatter missing "id"`);
  assert(frontmatter.label, file, `frontmatter missing "label"`);
  const templates = parseListField(frontmatter.templates);
  assert(templates.length > 0, file, `frontmatter must include non-empty "templates" array`);
  return {
    id: String(frontmatter.id),
    label: String(frontmatter.label),
    description: String(frontmatter.description || ''),
    templates,
  };
}

function emitTs(packs) {
  const banner = generatedHeader('scripts/specs/acts.mjs');
  const packMeta = packs.map((p) => ({ id: p.id, label: p.label, description: p.description }));
  const templateIds = Object.fromEntries(packs.map((p) => [p.id, p.templates]));
  return (
    banner +
    `\nexport interface ActSeedPackMeta {\n  id: string;\n  label: string;\n  description: string;\n}\n\n` +
    `export const MD_ACT_SEED_PACKS: ActSeedPackMeta[] = ${jsonPretty(packMeta)};\n\n` +
    `export const MD_ACT_PACK_TEMPLATE_IDS: Record<string, string[]> = ${jsonPretty(templateIds)};\n`
  );
}

function writeIfChanged(file, contents) {
  const prev = existsSync(file) ? readFileSync(file, 'utf8') : null;
  if (prev === contents) return false;
  writeFileSync(file, contents, 'utf8');
  return true;
}

export function buildActs({ rootDir }) {
  const docsDir = resolve(rootDir, 'DOCS/acts/packs');
  const outDir = resolve(rootDir, 'react-app/src/acts/generated');
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
  const files = listMdFiles(docsDir);
  const packs = files.map(buildPack);
  const out = join(outDir, 'seedPacks.ts');
  const changed = writeIfChanged(out, emitTs(packs));
  return { outDir, files: [out], written: changed ? 1 : 0, packCount: packs.length };
}
