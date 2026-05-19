# ArtBastard MIDI Controller Templates

ArtBastard ships factory-tuned mapping templates for two popular controllers.
You can apply either template from the UI (Settings > MIDI > Apply Template)
or via REST.

## REST endpoint

```
POST /api/midi/controller-template
Content-Type: application/json
{ "template": "xtouch" }
```

Allowed values: `xtouch`, `apc40`. Response is `200 OK` with the resulting
mapping summary, or `400` if the template name is unknown.

The endpoint is idempotent: applying the same template twice replaces any
prior bindings the template owned and leaves user-mapped MIDI Learn entries
on other controls untouched.

## Behringer X-Touch (Mackie mode)

The X-Touch template assumes the device is in Mackie mode (long-press the
Set button while powering on, then release). The defaults are:

- Faders 1-8: pitch-bend on MIDI channels 1-8 -> SuperControl dimmer per
  fixture group, plus DMX channels 1-8.
- Master fader: pitch-bend on channel 9 -> Master brightness.
- V-Pots 1-8: CC 16-23 -> SuperControl pan / tilt / RGB axes.
- Buttons row 1 (Rec): scene save shortcuts.
- Buttons row 2 (Solo): scene trigger shortcuts.
- Buttons row 3 (Mute): clip launcher row 1 cells.
- Buttons row 4 (Select): SuperControl fixture selection.
- Transport: ACT triggers (play / stop / next / prev / pause toggle).
- Scribble strips: SysEx labels are pushed showing the DMX channel name.
- Jog wheel: scrub the timeline playhead.

Pitch-bend support is needed because Mackie faders use pitch-bend natively.

### Scribble strip SysEx update

The template emits the standard X-Touch SysEx string on every label change:

```
F0 00 00 66 14 12 <strip_index> <text_bytes> F7
```

`<strip_index>` is 0..7, `<text_bytes>` is up to 14 ASCII bytes (padded with
spaces). The application sends an update whenever the underlying DMX
channel name changes (rename, fixture template apply, scene capture).

## Akai APC40 MK1

The APC40 template assumes the device is in mode 0 (factory). Mappings:

- Pad grid (8x5): cells trigger the corresponding clip launcher cells.
- Track buttons (8): SuperControl axis selection (R / G / B / W / Pan /
  Tilt / Dimmer / Strobe).
- Cue level knobs: SuperControl axis fine adjust.
- Device knobs: master pan / tilt and master colour.
- Crossfader: master brightness (alternative to MIDI Learn).
- Scene buttons (5): trigger scene rows.
- Stop / Play / Record: ACT triggers.

Pitch-bend on MIDI channel 1 is also wired to master brightness for
controllers that send pitch-bend on the crossfader.

## Custom mappings on top of templates

After applying a template, MIDI Learn (the orange Learn buttons in the UI)
still works. Custom learns are stored as user mappings and are not touched
when you re-apply a template. To clear everything, run a factory reset:

```
DELETE /api/config
```

then re-apply the template you want.

## Verification

- Watch the MIDI Monitor (Help > MIDI Setup or the toggle at the top right)
  to confirm messages arrive.
- For pitch-bend, look for messages with type `pitchwheel` and a 14-bit
  value that maps to 0..16383.
- For SysEx strip labels, observe the X-Touch's scribble strip updating as
  you rename channels in the UI.
