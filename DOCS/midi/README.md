# MIDI Specs (Source of Truth)

The MD files in this directory are the **single source of truth** for MIDI
controller behavior in ArtBastard. They are parsed at build time by
`scripts/buildMidiSpecs.mjs` and compiled into TypeScript modules under
`react-app/src/midi/generated/`. Application code imports the generated
modules; never edit them directly.

## Workflow

1. Edit the relevant `.md` file in `DOCS/midi/`.
2. Run `npm run build-midi-specs` (or `npm run build`).
3. The generator validates the spec and rewrites
   `react-app/src/midi/generated/*.ts`.
4. Commit both the MD edit and the regenerated TS file together so the diff is
   reviewable.

If validation fails the build fails fast with the file and field path that is
wrong; the previously generated TS is left intact so the dev server keeps
running.

## Files

| File                       | Purpose                                                                 |
|----------------------------|-------------------------------------------------------------------------|
| `apc40.md`                 | APC40 models, detection, init SysEx, grid, scene naming, all bindings.  |
| `led-feedback.md`          | LED velocity constants and per-control behavior rules.                  |
| `device-detection.md`      | Substring patterns mapping device name → controller kind.               |
| `super-control-roles.md`   | Device Control role priority + Track Control role assignment.           |
| `roli-color-picker.md`     | 2nd-Roli color picker modes (wheel, palette) and palette generation.    |

## Format

Each file is YAML frontmatter (between `---` fences) followed by Markdown body
with one or more `## Section` headings. Sections whose body is a pipe table are
parsed as structured data; freeform Markdown is treated as commentary and
ignored by the generator.

YAML supports the small subset used in these files:

- scalar strings, numbers, booleans, `null`
- block lists (`- value`)
- block maps (`key: value`, nested by indentation)
- `~` and `null` for null

Hex byte literals in YAML strings use the `'F0 47 ...'` form (space-separated)
or the `0x..` form in tables.

## Why MD?

ArtBastard's MIDI behavior is dense, visual, and table-shaped. Markdown tables
keep the bindings inspectable in any editor and on GitHub, surface diffs as
human edits, and let non-coders propose changes. Codegen keeps the runtime
fast and type-safe.
