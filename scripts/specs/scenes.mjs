// Scene seed pack MD → TS codegen.
// MD format (one file per pack) — pack metadata in frontmatter, the list of
// template IDs the pack includes in the `templates` array. Template bodies
// remain in react-app/src/scenes/sceneSeedGenerator.ts (SMART_TEMPLATES) until
// they're migrated to MD individually.
//
// Frontmatter:
//   spec: scene-pack
//   id: <pack id> (matches SceneSeedPackId)
//   label: <display label>
//   description: <one-line description>
//   templates: [tpl-id-1, tpl-id-2, ...]   # subset of SMART_TEMPLATES ids
//
// Emits react-app/src/scenes/generated/seedPacks.ts.

import { readdirSync, statSync, writeFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';

import { splitFrontmatter, generatedHeader, jsonPretty, makeAssert } from './shared/mdParser.mjs';

const assert = makeAssert('scenes');

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
    return raw
      .replace(/^\[|\]$/g, '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

function buildPack(file) {
  const src = readFileSync(file, 'utf8');
  const { frontmatter } = splitFrontmatter(src);
  assert(frontmatter?.spec === 'scene-pack', file, `frontmatter "spec" must equal "scene-pack"`);
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
  const banner = generatedHeader('scripts/specs/scenes.mjs');
  const packMetaList = packs.map((p) => ({ id: p.id, label: p.label, description: p.description }));
  const templateIdsByPack = Object.fromEntries(packs.map((p) => [p.id, p.templates]));
  return (
    banner +
    `\nexport interface SceneSeedPackMeta {\n  id: string;\n  label: string;\n  description: string;\n}\n\n` +
    `export const MD_SCENE_SEED_PACKS: SceneSeedPackMeta[] = ${jsonPretty(packMetaList)};\n\n` +
    `export const MD_SCENE_PACK_TEMPLATE_IDS: Record<string, string[]> = ${jsonPretty(templateIdsByPack)};\n`
  );
}

function writeIfChanged(file, contents) {
  const prev = existsSync(file) ? readFileSync(file, 'utf8') : null;
  if (prev === contents) return false;
  writeFileSync(file, contents, 'utf8');
  return true;
}

export function buildScenes({ rootDir }) {
  const docsDir = resolve(rootDir, 'DOCS/scenes/packs');
  const outDir = resolve(rootDir, 'react-app/src/scenes/generated');
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
  const files = listMdFiles(docsDir);
  const packs = files.map(buildPack);
  const out = join(outDir, 'seedPacks.ts');
  const changed = writeIfChanged(out, emitTs(packs));
  return { outDir, files: [out], written: changed ? 1 : 0, packCount: packs.length };
}
