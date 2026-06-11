# Project YAML Round-Trip

ArtBastard stores the live rig in JSON server-side (`data/fixtures.json`,
`data/groups.json`, `data/scenes.json`, `data/acts.json`, plus MIDI mappings in
`data/config.json`). The **Project YAML** panel in Settings exposes the same
state as five hand-editable YAML files so you can diff a rig in git, edit it in
any text editor, and share setups losslessly.

## TL;DR

Open `Settings → Project YAML`:

- **Download fixtures.yaml / groups.yaml / scenes.yaml / acts.yaml / bindings.yaml** —
  each is a single section of the rig.
- **Download all 5** — convenience: fires all five downloads in sequence.
- **Import &lt;section&gt; YAML** — picks a file and replaces the matching server-side
  state. Re-emits live updates to all connected clients.

Or use the backend directly:

```bash
# Export
curl http://localhost:3030/api/project/export?section=fixtures > fixtures.yaml
curl http://localhost:3030/api/project/export/bundle | jq .   # all 5 as JSON map

# Import
curl -X POST http://localhost:3030/api/project/import \
  -H 'Content-Type: application/json' \
  -d "$(jq -Rs --arg s fixtures '{section: $s, yamlText: .}' < fixtures.yaml)"
```

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
DMX channel → MIDI input mapping.
```yaml
midiMappings:
  '1': { channel: 0, note: 36 }
  '2': { channel: 0, controller: 7 }
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

## Why YAML and not JSON

ArtBastard's data-driven config preference: features and configuration belong
in human-readable, diff-friendly files. Hardcoded TS arrays mean every
template tweak is a code change. JSON is machine-friendly but YAML's
block-mapping syntax is easier to skim and edit at scale. The same preference
drives `DOCS/midi/*.md`, `DOCS/fixtures/library/*.md`, `DOCS/scenes/packs/*.md`,
`DOCS/acts/packs/*.md` → all generate TypeScript at build time via
`scripts/buildSpecs.mjs`.
