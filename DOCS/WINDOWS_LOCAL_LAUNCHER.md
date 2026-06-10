# Windows Local Launcher

This installer creates a Desktop shortcut for local ArtBastard show control.
It is intended for Windows operators who want one click to choose the LIVE
(`main`) or DEV (`dev`) branch, update when online, verify local hardware, and
launch the browser UI.

## Install

From a PowerShell window:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\ops\windows\Install-ArtBastardLocalLauncher.ps1
```

The installer:

- clones the repo if it is not already present
- checks for Node.js 20+ and can use Volta if installed
- installs root and React dependencies
- installs the bundled `ops\windows\launcher\Launch-ArtBastardLocal.ps1`
- creates `ArtBastard Launcher.lnk` on the Desktop

The bundled launcher can also be run directly:

```powershell
.\ops\windows\launcher\Launch-ArtBastardLocal.ps1
```

## What The Launcher Reports

Before starting the server, the launcher prints:

- selected branch: LIVE/main or DEV/dev
- HTTP UI/API URL and port, normally `http://localhost:3030`
- Socket.IO transport origin and port
- configured Art-Net target and UDP port, normally `192.168.1.199:6454`
- configured OSC receive port, normally UDP `8000`
- OSC send host/port when enabled
- OSC assignment count
- Art-Net ping result
- Windows MIDI/controller device names
- Node MIDI input/output ports from `@julusian/midi`

## HTTPS, MIDI, OSC, And Localhost

You do not need HTTPS for local ArtBastard runs at `http://localhost:3030`.

Chromium browsers, including Microsoft Edge and Chrome, treat `localhost` as a
secure context. That means Web MIDI can work on local HTTP. For non-local
network hostnames or raw LAN IP browser origins, use HTTPS if the browser blocks
Web MIDI permissions.

OSC and Art-Net do not run in the browser. They are handled by the local Node
backend over UDP, so HTTPS is not involved for OSC or Art-Net traffic.

## Offline Behavior

After the installer has completed once, normal launching can work without
internet:

- the repo is already cloned
- Node dependencies are already installed
- the launcher skips GitHub when it cannot reach it
- dependency checks use the existing install and prefer cached npm data
- local Art-Net, OSC, MIDI, and localhost HTTP do not need internet

Internet is still required when:

- first cloning the repo
- first installing missing npm packages
- fetching the latest LIVE/DEV commits
- dependencies were deleted or a clean reinstall is requested

## Relaunch Behavior

The launcher shows a short countdown before handing off to `start.ps1`.

When no new code is found, it uses the fast local start path. When Git pulls new
code or switching LIVE/DEV changes the checkout, it starts ArtBastard with
`-Clear` so the updated code gets a clean rebuild from source.
