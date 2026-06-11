// Shared MD/YAML helpers for data-driven spec codegen.
// Used by all per-domain builders under scripts/specs/.
//
// Zero npm deps on purpose — we control the YAML subset and table syntax used
// in DOCS/*/*.md.

import { readFileSync } from 'node:fs';

// ─── Tiny YAML parser ───────────────────────────────────────────────────────

export function parseYaml(text) {
  const lines = text.split(/\r?\n/);
  const root = {};
  const stack = [{ indent: -1, value: root, keyForNext: null }];

  let i = 0;
  while (i < lines.length) {
    let line = lines[i];
    const commentIdx = stripCommentIdx(line);
    if (commentIdx >= 0) line = line.slice(0, commentIdx);
    if (!line.trim()) { i++; continue; }

    const indent = line.match(/^ */)[0].length;
    const trimmed = line.slice(indent);

    while (stack.length > 1 && indent <= stack[stack.length - 1].indent) {
      stack.pop();
    }
    const parent = stack[stack.length - 1];

    if (trimmed.startsWith('- ')) {
      const itemText = trimmed.slice(2).trim();
      const list = ensureList(parent);
      if (itemText === '' || itemText === '|') {
        const obj = {};
        list.push(obj);
        stack.push({ indent, value: obj, keyForNext: null });
      } else if (itemText.includes(':') && !looksLikeScalar(itemText)) {
        const obj = {};
        list.push(obj);
        const [k, v] = splitKv(itemText);
        if (v === '') {
          stack.push({ indent, value: obj, keyForNext: k });
        } else {
          obj[k] = parseScalar(v);
          stack.push({ indent, value: obj, keyForNext: null });
        }
      } else {
        list.push(parseScalar(itemText));
      }
      i++;
      continue;
    }

    const [k, v] = splitKv(trimmed);
    const container = parent.value;
    if (v === '' || v === undefined) {
      const peek = peekNonBlank(lines, i + 1);
      if (peek && peek.text.startsWith('- ')) {
        const list = [];
        setKey(parent, container, k, list);
        stack.push({ indent: indent + 0, value: { __list: list }, keyForNext: null });
      } else {
        const obj = {};
        setKey(parent, container, k, obj);
        stack.push({ indent, value: obj, keyForNext: null });
      }
    } else {
      setKey(parent, container, k, parseScalar(v));
    }
    i++;
  }

  return root;
}

function ensureList(frame) {
  if (Array.isArray(frame.value)) return frame.value;
  if (frame.value && Array.isArray(frame.value.__list)) return frame.value.__list;
  throw new Error('YAML: list item without a list context');
}

function setKey(parent, container, k, v) {
  if (container && container.__list) {
    throw new Error(`YAML: unexpected map key "${k}" inside a list context`);
  }
  if (parent.keyForNext !== null && parent.keyForNext !== undefined) {
    container[parent.keyForNext][k] = v;
  } else {
    container[k] = v;
  }
}

function splitKv(line) {
  const idx = line.indexOf(':');
  if (idx < 0) return [line, ''];
  return [line.slice(0, idx).trim(), line.slice(idx + 1).trim()];
}

function looksLikeScalar(s) {
  return /^['"\-]|^\d/.test(s);
}

function stripCommentIdx(line) {
  let inStr = false;
  let quote = '';
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inStr) {
      if (ch === quote) inStr = false;
    } else {
      if (ch === "'" || ch === '"') { inStr = true; quote = ch; }
      else if (ch === '#' && (i === 0 || /\s/.test(line[i - 1]))) return i;
    }
  }
  return -1;
}

export function parseScalar(raw) {
  let s = raw.trim();
  if (s === '' || s === '~' || s === 'null') return null;
  if (s === 'true') return true;
  if (s === 'false') return false;
  if (s.startsWith("'") && s.endsWith("'")) return s.slice(1, -1);
  if (s.startsWith('"') && s.endsWith('"')) return s.slice(1, -1);
  if (s.startsWith('[') && s.endsWith(']')) {
    const inner = s.slice(1, -1).trim();
    if (!inner) return [];
    return inner.split(',').map((p) => parseScalar(p.trim()));
  }
  if (/^0x[0-9a-fA-F]+$/.test(s)) return parseInt(s, 16);
  if (/^-?\d+$/.test(s)) return parseInt(s, 10);
  if (/^-?\d+\.\d+$/.test(s)) return parseFloat(s);
  return s;
}

function peekNonBlank(lines, from) {
  for (let i = from; i < lines.length; i++) {
    const ln = lines[i];
    const cIdx = stripCommentIdx(ln);
    const text = cIdx >= 0 ? ln.slice(0, cIdx) : ln;
    if (text.trim()) {
      const indent = text.match(/^ */)[0].length;
      return { indent, text: text.slice(indent) };
    }
  }
  return null;
}

// ─── Frontmatter splitter ───────────────────────────────────────────────────

export function splitFrontmatter(src) {
  if (!src.startsWith('---')) return { frontmatter: {}, body: src };
  const end = src.indexOf('\n---', 3);
  if (end < 0) throw new Error('frontmatter missing closing ---');
  const yamlText = src.slice(3, end).replace(/^\r?\n/, '');
  const body = src.slice(end + 4).replace(/^\r?\n/, '');
  return { frontmatter: parseYaml(yamlText), body };
}

// ─── Markdown table parser ──────────────────────────────────────────────────

export function parseTables(body) {
  const out = {};
  const lines = body.split(/\r?\n/);
  let currentHeading = null;
  let tableLines = [];
  const flush = () => {
    if (currentHeading && tableLines.length >= 2) {
      const rows = parseTableBlock(tableLines);
      if (rows.length) out[currentHeading] = rows;
    }
    tableLines = [];
  };
  for (const line of lines) {
    const heading = line.match(/^##\s+(.+?)\s*$/);
    if (heading) {
      flush();
      currentHeading = slugify(heading[1]);
      continue;
    }
    if (currentHeading && line.trim().startsWith('|')) {
      tableLines.push(line);
    } else if (tableLines.length) {
      flush();
    }
  }
  flush();
  return out;
}

function parseTableBlock(lines) {
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

export function slugify(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// ─── Spec file reader ──────────────────────────────────────────────────────

export function readSpecFile(file) {
  const src = readFileSync(file, 'utf8');
  const { frontmatter, body } = splitFrontmatter(src);
  const tables = parseTables(body);
  return { file, frontmatter, tables };
}

// ─── Numeric / aliases parsers shared across domains ────────────────────────

export function parseNumLike(s) {
  if (s == null) return undefined;
  const v = String(s).trim();
  if (/^0x[0-9a-fA-F]+$/.test(v)) return parseInt(v, 16);
  if (/^-?\d+$/.test(v)) return parseInt(v, 10);
  if (/^-?\d+\.\d+$/.test(v)) return parseFloat(v);
  return undefined;
}

export function parseChannels(s) {
  if (s == null) return 'any';
  const v = String(s).trim();
  if (v === 'any') return 'any';
  const range = v.match(/^(\d+)\.\.(\d+)$/);
  if (range) return { kind: 'range', from: +range[1], to: +range[2] };
  const n = parseNumLike(v);
  if (n !== undefined) return { kind: 'single', channel: n };
  throw new Error(`unrecognised channels expression: "${v}"`);
}

export function parseAliases(s) {
  if (!s) return [];
  return String(s).split(',').map((p) => p.trim()).filter(Boolean);
}

// ─── Assertion helper ───────────────────────────────────────────────────────

export function makeAssert(domain) {
  return function assert(cond, file, msg) {
    if (!cond) {
      console.error(`[${domain}] ${file}: ${msg}`);
      process.exit(1);
    }
  };
}

// ─── JSON pretty-printer used by emitters ───────────────────────────────────

export const jsonPretty = (v) => JSON.stringify(v, null, 2);

// ─── Common header for autogenerated files ──────────────────────────────────

export function generatedHeader(scriptName) {
  return `// AUTOGENERATED by ${scriptName} — DO NOT EDIT.\n// Edit the source spec in DOCS/ and run \`npm run build-specs\`.\n`;
}
