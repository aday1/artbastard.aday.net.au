# Project YAML Round-Trip

ArtBastard stores the live rig in JSON server-side (`data/fixtures/<Category>/*.json`,
`data/fixture-data.json`, `data/scenes.json`, `data/acts.json`, and
`data/config.json`). The **Project YAML** panel in Settings exposes the same
state as eight hand-editable YAML files so you can diff a rig in git, edit it in
any text editor, and share setups losslessly — including a full clean-install
restore.

## TL;DR

Open `Settings → Project YAML`:

- **Download fixtures / groups / scenes / acts / bindings / config / layout / presets** —
  each is a single section of the rig.
- **Download all (full backup)** — convenience: fires all eight downloads in sequence.
- **Import &lt;section&gt; YAML** — picks a file and replaces the matching state.
  Server-side sections re-emit live updates to all connected clients;
  `presets` writes the browser localStorage envelope and asks you to reload.

Or use the backend directly:

```bash
# Export
curl http://localhost:3030/api/project/export?section=fixtures > fixtures.yaml
curl http://localhost:3030/api/project/export/bundle | jq .   # all server sections as JSON map

# Import
curl -X POST http://localhost:3030/api/project/import \
  -H 'Content-Type: application/json' \
  -d "$(jq -Rs --arg s fixtures '{section: $s, yamlText: .}' < fixtures.yaml)"
```

`presets` is browser-side only (Zustand-persisted localStorage) and has no
backend endpoint — the Settings UI handles it directly.

## Sections

### `fixtures.yaml`
```yaml
fixtures:
  - id: fx-mover-01
    name: Mover SR
    type: moving-head
    manufacturer: Generic
    model: 7-channel RGBW
    templateId: rgbw-par-can         # ↔ DOCS/fixtures/library/*.md catalogId
    mode: 7-channel rgbw + dimmer + strobe + macro
    startAddress: 1
    channels:
      - { name: Dimmer, type: dimmer, dmxAddress: 1 }
      - { name: Red,    type: red,    dmxAddress: 2 }
      # ...
    tags: [front, mover]
```

Saved fixtures are written to `data/fixtures/<Category>/<id>.json`. The loader
scans subdirectories recursively, so categories can be reorganised on disk
without code changes.

### `groups.yaml`
Groups reference fixtures by **id** (not positional index). Re-imports
gracefully drop ids that don't resolve in the current rig and surface a
warning.
```yaml
groups:
  - id: grp-movers
    name: FOH Movers
    fixtureIds: [fx-mover-01, fx-mover-02]
    masterValue: 200
```

### `scenes.yaml`
```yaml
scenes:
  - name: Red Slow
    oscAddress: /scene/red-slow
    channelValues: [0, 255, 0, 0, 0, ...]
    seed:
      generatedBy: artbastard-scene-seeder
      packId: smart-starter-40
      # ...
```

### `acts.yaml`
```yaml
acts:
  - id: seed-act-starter-acts-color-warmup
    name: ACT Seed 01 - Color Warmup
    loopMode: none
    steps:
      - sceneName: Warm Wash
        duration: 7000
        transitionDuration: 1200
    triggers:
      - { id: ..., type: osc, address: /act/seed/color-warmup/play, action: play, enabled: true }
```

### `bindings.yaml`
DMX channel → MIDI input mapping (subset of `data/config.json`).
```yaml
midiMappings:
  '1': { channel: 0, note: 36 }
  '2': { channel: 0, controller: 7 }
```

### `config.yaml`
The rest of `data/config.json` — Art-Net output, OSC routing, per-channel
ranges, auto-connect MIDI device list. MIDI mappings are excluded (they live
in `bindings.yaml`) so the two sections stay orthogonal.
```yaml
config:
  artNetConfig:
    ip: 192.168.1.199
    subnet: 0
    universe: 0
    port: 6454
  oscConfig:
    host: 127.0.0.1
    port: 8000
  oscAssignments:
    - /1/dmx1
    - /1/dmx2
    # ...
  channelRanges:
    - { min: 0, max: 255 }
    # ... 512 entries
  autoConnectMidiDevices: []
```

### `layout.yaml`
Stage map and master sliders from `data/fixture-data.json`.
```yaml
fixtureLayout:
  - { id: fx-mover-01, x: 120, y: 80 }
masterSliders:
  - { id: master-1, name: FOH Master, value: 200, targetType: group, targetId: grp-movers }
```

### `presets.yaml`
Browser-side preset library (the same data the Preset panel manages). Stored
as the Zustand `artbastard-presets` localStorage envelope. Import writes the
envelope back; reload the page so the store re-hydrates.
```yaml
presets:
  - id: pst-warm-wash
    name: Warm Wash
    category: looks
    dmxValues: { 1: 200, 2: 180, 3: 100 }
    isFavorite: true
    tags: [warm]
categories:
  - favorites
  - looks
```

## Hand-editing rules

1. **Don't rename ids.** Names and labels are free-form; ids are the stable
   handles other sections reference. Renaming an id orphans references in
   other YAML files.
2. **Groups are id-based.** Adding a fixture to a group means appending its id
   to `fixtureIds`. Wrong id → import warning, fixture dropped silently from
   that group.
3. **`channelValues` is a 512-element array** (or shorter — missing trailing
   channels are treated as 0). Each value is 0-255.
4. **Imports are full-section replaces**, not merges. Export the section, edit,
   re-import. The server re-broadcasts the new state to all clients live.
5. **Presets need a reload.** The Zustand store only re-reads localStorage on
   mount; the import notification will remind you.

## Why YAML and not JSON

ArtBastard's data-driven config preference: features and configuration belong
in human-readable, diff-friendly files. Hardcoded TS arrays mean every
template tweak is a code change. JSON is machine-friendly but YAML's
block-mapping syntax is easier to skim and edit at scale. The same preference
drives `DOCS/midi/*.md`, `DOCS/fixtures/library/*.md`, `DOCS/scenes/packs/*.md`,
`DOCS/acts/packs/*.md` → all generate TypeScript at build time via
`scripts/buildSpecs.mjs`.

