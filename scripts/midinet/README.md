# Network MIDI: keyboards on other machines as MIDI ports on Kefka

`midinet-bridge.py` runs on the machine the keyboard is plugged into (ULTIMA, Windows, Python 3.13 +
`python-rtmidi`) and streams every port whose name matches `MIDINET_MATCH` (default `Launchkey`) to Kefka.
`midinet-server.js` (user unit `artbastard-midinet.service`, port 18790, address allowlist) turns each one into
an ALSA virtual port pair named `<port> (<HOST>)`, e.g. `Launchkey 49 (ULTIMA)` and
`Launchkey 49 InControl (ULTIMA)`. ArtBastard's server, Chrome's Web MIDI on Kefka (Macroverse) and any ALSA
app see them like a USB controller; messages sent to them (LED feedback) go back to the keyboard. The ports
persist across bridge reconnects.

Windows lets only one program open a MIDI input, so the bridge also mirrors the main keyboard port to a local
loopback port (`LoopBe Internal MIDI` by default) for browsers and apps on ULTIMA.

## ULTIMA

- Script and log: `%LOCALAPPDATA%\kefka-midinet\` (`midinet-bridge.py`, `bridge.log`).
- Started at logon by the scheduled task **Kefka MIDI bridge** (pythonw, restarts on failure). Restart it with
  `Stop-ScheduledTask "Kefka MIDI bridge"; Start-ScheduledTask "Kefka MIDI bridge"`.
- Connects to Kefka's Tailscale address first (set it in `MIDINET_HOST`); ULTIMA reaches Kefka's LAN address only
  through the router, which the allowlist refuses.
- `netsh interface portproxy` forwards `127.0.0.1:3030` and `127.0.0.1:8765` to Kefka, so browsers on ULTIMA
  can use `http://localhost:3030/...` (ArtBastard) and `http://localhost:8765/` (Macroverse) as secure
  contexts, which Web MIDI requires.

## Kefka

- `systemctl --user status artbastard-midinet`; `journalctl --user -u artbastard-midinet -f`.
- ArtBastard connected both ports with `POST /api/midi/server/connect` (`remember: true`), so they are in
  `autoConnectMidiDevices`; the ALSA client numbers change when the service restarts and ArtBastard accepts
  the renamed suffix.
- Incoming messages appear on `/kefka-bench.html` (MIDI list, labelled by device) and in
  `journalctl --user -u artbastard -g Launchkey`. Map controls with MIDI Learn in the console or
  `POST /api/midi/mapping`.
