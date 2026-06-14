param(
    [string]$InstallRoot = "$env:USERPROFILE\Desktop\artbastard.aday.net.au",
    [string]$ShortcutName = "ArtBastard Launcher",
    [string]$RepoUrl = "https://github.com/aday1/artbastard.aday.net.au.git",
    [string]$DefaultArtNetHost = "192.168.1.199",
    [int]$Port = 3030
)

$ErrorActionPreference = "Stop"

$launcherDir = Join-Path $InstallRoot "ops\windows\launcher"
$launcherPath = Join-Path $launcherDir "Launch-ArtBastardLocal.ps1"
$desktopShortcut = Join-Path ([Environment]::GetFolderPath("Desktop")) "$ShortcutName.lnk"

function Write-Step {
    param([string]$Message)
    Write-Host ""
    Write-Host "== $Message" -ForegroundColor Cyan
}

function Require-Command {
    param([string]$Name, [string]$InstallHint)
    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "$Name is required. $InstallHint"
    }
}

function Ensure-Repo {
    if (Test-Path (Join-Path $InstallRoot ".git")) {
        return
    }

    Write-Step "Cloning ArtBastard"
    $parent = Split-Path -Parent $InstallRoot
    if (-not (Test-Path $parent)) {
        New-Item -ItemType Directory -Path $parent | Out-Null
    }
    git clone $RepoUrl $InstallRoot
    if ($LASTEXITCODE -ne 0) {
        throw "git clone failed."
    }
}

function Ensure-Node20 {
    Write-Step "Checking Node.js"
    $nodeVersion = (& node --version 2>$null)
    if ($nodeVersion -match "^v(2[0-9]|[3-9][0-9])\.") {
        Write-Host "Node OK: $nodeVersion" -ForegroundColor Green
        return
    }

    if (Get-Command volta -ErrorAction SilentlyContinue) {
        Write-Host "Installing Node 20 and npm 10 with Volta..." -ForegroundColor Yellow
        volta install node@20 npm@10
        if ($LASTEXITCODE -ne 0) {
            throw "Volta could not install Node 20."
        }
        return
    }

    throw "ArtBastard requires Node 20+. Install Node 20 or Volta, then rerun this installer."
}

function Ensure-Dependencies {
    Write-Step "Checking dependencies"
    Push-Location $InstallRoot
    try {
        if (-not (Test-Path "node_modules")) {
            npm ci
            if ($LASTEXITCODE -ne 0) { throw "npm ci failed in repo root." }
        }
        if (-not (Test-Path "react-app\node_modules")) {
            npm --prefix react-app ci
            if ($LASTEXITCODE -ne 0) { throw "npm ci failed in react-app." }
        }
    } finally {
        Pop-Location
    }
}

function Write-Launcher {
    New-Item -ItemType Directory -Force -Path $launcherDir | Out-Null

    $bundledLauncherDir = Join-Path $PSScriptRoot "launcher"
    $bundledLauncherPath = Join-Path $bundledLauncherDir "Launch-ArtBastardLocal.ps1"
    if (Test-Path $bundledLauncherPath) {
        $sourceResolved = (Resolve-Path -LiteralPath $bundledLauncherPath).Path
        $targetResolved = if (Test-Path $launcherPath) { (Resolve-Path -LiteralPath $launcherPath).Path } else { $launcherPath }

        if ($sourceResolved -ne $targetResolved) {
            Copy-Item -LiteralPath $bundledLauncherPath -Destination $launcherPath -Force
        }

        $assetSource = Join-Path $bundledLauncherDir "assets"
        if (Test-Path $assetSource) {
            $assetTarget = Join-Path $launcherDir "assets"
            $assetSourceResolved = (Resolve-Path -LiteralPath $assetSource).Path
            $assetTargetResolved = if (Test-Path $assetTarget) { (Resolve-Path -LiteralPath $assetTarget).Path } else { $assetTarget }
            if ($assetSourceResolved -ne $assetTargetResolved) {
                Copy-Item -LiteralPath $assetSource -Destination $launcherDir -Recurse -Force
            }
        }

        Write-Host "Launcher installed from bundled ops\windows\launcher files." -ForegroundColor Green
        return
    }

    $launcher = @'
param(
    [ValidateSet("ask", "main", "dev")]
    [string]$Branch = "main",
    [int]$Port = 3030
)

$ErrorActionPreference = "Stop"
$repoPath = Split-Path -Parent (Split-Path -Parent (Split-Path -Parent $PSScriptRoot))
$repoUrl = "https://github.com/aday1/artbastard.aday.net.au.git"
$defaultArtNetHost = "192.168.1.199"
$defaultArtNetPort = 6454
$defaultOscReceivePort = 8000
$defaultOscSendPort = 8000

function Write-Step {
    param([string]$Message, [ConsoleColor]$Color = [ConsoleColor]::Cyan)
    Write-Host ""
    Write-Host "== $Message" -ForegroundColor $Color
}

function Show-Splash {
    Write-Host ""
    Write-Host "     _         _   ____            _                _ " -ForegroundColor Magenta
    Write-Host "    / \   _ __| |_| __ )  __ _ ___| |_ __ _ _ __ __| |" -ForegroundColor Magenta
    Write-Host "   / _ \ | '__| __|  _ \ / _` / __| __/ _` | '__/ _` |" -ForegroundColor Cyan
    Write-Host "  / ___ \| |  | |_| |_) | (_| \__ \ || (_| | | | (_| |" -ForegroundColor Cyan
    Write-Host " /_/   \_\_|   \__|____/ \__,_|___/\__\__,_|_|  \__,_|" -ForegroundColor Yellow
    Write-Host ""
}

function Invoke-Git {
    param([string[]]$Arguments)
    & git @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "git $($Arguments -join ' ') failed with exit code $LASTEXITCODE"
    }
}

function Get-BranchChoice {
    if ($Branch -ne "ask") { return $Branch }
    Write-Host "ArtBastard branch:" -ForegroundColor Magenta
    Write-Host "  1. LIVE  (main)"
    Write-Host "  2. DEV   (dev)"
    do { $choice = Read-Host "Choose 1 or 2" } until ($choice -in @("1", "2", "main", "dev", "LIVE", "DEV", "live"))
    if ($choice -in @("2", "dev", "DEV")) { return "dev" }
    return "main"
}

function Test-InternetAvailable {
    try {
        $null = & ping.exe -n 1 -w 1200 github.com 2>$null
        return $LASTEXITCODE -eq 0
    } catch {
        return $false
    }
}

function Get-ArtBastardConfig {
    $defaults = [ordered]@{
        artNetIp = $defaultArtNetHost
        artNetPort = $defaultArtNetPort
        oscReceivePort = $defaultOscReceivePort
        oscSendHost = "127.0.0.1"
        oscSendPort = $defaultOscSendPort
        oscSendEnabled = $false
        oscAssignments = 0
    }

    $configPath = Join-Path $repoPath "data\config.json"
    if (-not (Test-Path $configPath)) { return [pscustomobject]$defaults }

    try {
        $config = Get-Content -LiteralPath $configPath -Raw | ConvertFrom-Json
        if ($config.artNetConfig) {
            if ($config.artNetConfig.ip) { $defaults.artNetIp = [string]$config.artNetConfig.ip }
            if ($config.artNetConfig.port) { $defaults.artNetPort = [int]$config.artNetConfig.port }
        }
        if ($config.oscConfig) {
            if ($config.oscConfig.port) { $defaults.oscReceivePort = [int]$config.oscConfig.port }
            if ($config.oscConfig.sendHost) { $defaults.oscSendHost = [string]$config.oscConfig.sendHost }
            elseif ($config.oscConfig.host) { $defaults.oscSendHost = [string]$config.oscConfig.host }
            if ($config.oscConfig.sendPort) { $defaults.oscSendPort = [int]$config.oscConfig.sendPort }
            elseif ($config.oscConfig.port) { $defaults.oscSendPort = [int]$config.oscConfig.port }
            if ($null -ne $config.oscConfig.sendEnabled) { $defaults.oscSendEnabled = [bool]$config.oscConfig.sendEnabled }
        }
        if ($config.oscAssignments) {
            $defaults.oscAssignments = @($config.oscAssignments | Where-Object { $_ -and "$_".Trim() }).Count
        }
    } catch {
        Write-Host "Could not parse data\config.json; using defaults." -ForegroundColor Yellow
    }

    return [pscustomobject]$defaults
}

function Sync-Branch {
    param([string]$SelectedBranch)

    Write-Step "Updating $SelectedBranch"
    Set-Location $repoPath
    $onlineGit = $true
    try {
        Invoke-Git @("fetch", "origin", "--prune")
    } catch {
        $onlineGit = $false
        Write-Host "GitHub is not reachable; using local checkout." -ForegroundColor Yellow
    }

    $dirty = (& git status --porcelain)
    if ($dirty) {
        $stamp = Get-Date -Format "yyyyMMdd-HHmmss"
        Write-Host "Local changes detected; stashing before branch switch." -ForegroundColor Yellow
        Invoke-Git @("stash", "push", "-u", "-m", "ArtBastard launcher autosave $stamp")
    }

    if (git branch --list $SelectedBranch) {
        Invoke-Git @("switch", $SelectedBranch)
    } elseif ($onlineGit) {
        Invoke-Git @("switch", "-c", $SelectedBranch, "origin/$SelectedBranch")
    } else {
        throw "Local branch '$SelectedBranch' does not exist. Connect once to fetch it."
    }

    if ($onlineGit) {
        Invoke-Git @("pull", "--ff-only", "origin", $SelectedBranch)
    } else {
        $localCommit = (& git rev-parse --short HEAD)
        Write-Host "Offline mode: running local $SelectedBranch at $localCommit." -ForegroundColor Green
    }
}

function Ensure-NodeRuntime {
    Write-Step "Checking Node runtime"
    $nodeVersion = (& node --version 2>$null)
    if (-not $nodeVersion -or -not ($nodeVersion -match "^v(2[0-9]|[3-9][0-9])\.")) {
        if (Get-Command volta -ErrorAction SilentlyContinue) {
            volta install node@20 npm@10
            if ($LASTEXITCODE -ne 0) { throw "Volta could not install Node 20." }
            $nodeVersion = (& node --version 2>$null)
        }
    }
    if (-not $nodeVersion -or -not ($nodeVersion -match "^v(2[0-9]|[3-9][0-9])\.")) {
        throw "ArtBastard needs Node 20+. Current node is '$nodeVersion'."
    }
    Write-Host "Node: $nodeVersion" -ForegroundColor Green
}

function Ensure-Dependencies {
    Write-Step "Checking dependencies"
    Set-Location $repoPath
    if (-not (Test-Path "node_modules")) {
        if (-not (Test-InternetAvailable)) { throw "Backend dependencies are missing and internet is offline." }
        npm ci
        if ($LASTEXITCODE -ne 0) { throw "npm ci failed in repo root." }
    } else {
        Write-Host "Backend dependencies present." -ForegroundColor Green
    }
    if (-not (Test-Path "react-app\node_modules")) {
        if (-not (Test-InternetAvailable)) { throw "Frontend dependencies are missing and internet is offline." }
        npm --prefix react-app ci
        if ($LASTEXITCODE -ne 0) { throw "npm ci failed in react-app." }
    } else {
        Write-Host "Frontend dependencies present." -ForegroundColor Green
    }
}

function Show-LaunchSummary {
    param([string]$SelectedBranch)
    $cfg = Get-ArtBastardConfig
    $url = "http://localhost:$Port"
    Write-Step "Launch diagnostics"
    Write-Host "Branch: $SelectedBranch" -ForegroundColor Green
    Write-Host "HTTP UI/API: $url" -ForegroundColor Green
    Write-Host "Socket.IO: same origin as HTTP, websocket/polling on port $Port" -ForegroundColor Green
    Write-Host "Art-Net: $($cfg.artNetIp):$($cfg.artNetPort) UDP" -ForegroundColor Green
    Write-Host "OSC receive: 0.0.0.0:$($cfg.oscReceivePort) UDP" -ForegroundColor Green
    if ($cfg.oscSendEnabled) {
        Write-Host "OSC send: enabled -> $($cfg.oscSendHost):$($cfg.oscSendPort) UDP" -ForegroundColor Green
    } else {
        Write-Host "OSC send: disabled unless enabled in ArtBastard settings" -ForegroundColor Yellow
    }
    Write-Host "OSC assignments configured: $($cfg.oscAssignments)" -ForegroundColor Green
    Write-Host "HTTPS note: local HTTP on localhost is OK for Web MIDI in Edge/Chrome because localhost is a secure context." -ForegroundColor Cyan
    Write-Host "OSC and Art-Net are handled by the local Node backend over UDP; they do not require HTTPS." -ForegroundColor Cyan
}

function Show-ArtNetStatus {
    $cfg = Get-ArtBastardConfig
    Write-Step "Checking Art-Net node $($cfg.artNetIp)"
    $pingOutput = & ping.exe -n 2 -w 1000 $cfg.artNetIp 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Ping OK: Art-Net target $($cfg.artNetIp) answered." -ForegroundColor Green
        ($pingOutput | Where-Object { $_ -match "Reply from|Packets:" }) | ForEach-Object { Write-Host "  $_" -ForegroundColor DarkGray }
    } else {
        Write-Host "Ping failed: Art-Net target $($cfg.artNetIp) did not answer." -ForegroundColor Yellow
    }
    Write-Host "Configured Art-Net UDP port: $($cfg.artNetPort)" -ForegroundColor Green
}

function Show-MidiStatus {
    Write-Step "Polling MIDI controllers"
    $devices = @()
    if (Get-Command Get-PnpDevice -ErrorAction SilentlyContinue) {
        $devices = Get-PnpDevice -PresentOnly -ErrorAction SilentlyContinue |
            Where-Object { $_.FriendlyName -match "MIDI|APC|Launch|X-Touch|Akai|Novation|Korg|Roland|Behringer|Arturia|DJ|Controller|TouchOSC|LoopBe|Bome" } |
            Select-Object -ExpandProperty FriendlyName -Unique
    }
    if ($devices.Count -gt 0) {
        Write-Host "Windows MIDI/controller probe OK; matching devices:" -ForegroundColor Green
        $devices | ForEach-Object { Write-Host "  - $_" }
    } else {
        Write-Host "No obvious MIDI controller names found in Windows PnP." -ForegroundColor Yellow
    }

    $midiProbe = @"
try {
  const midi = require("@julusian/midi");
  const input = new midi.Input();
  const output = new midi.Output();
  const inputs = Array.from({ length: input.getPortCount() }, (_, i) => input.getPortName(i));
  const outputs = Array.from({ length: output.getPortCount() }, (_, i) => output.getPortName(i));
  input.closePort();
  output.closePort();
  console.log(JSON.stringify({ inputs, outputs }, null, 2));
} catch (err) {
  console.log(JSON.stringify({ error: err.message }, null, 2));
}
"@
    Write-Host "Node MIDI probe result:" -ForegroundColor Green
    Write-Host ($midiProbe | node)
}

function Start-ArtBastard {
    Write-Step "Launching ArtBastard"
    Set-Location $repoPath
    $url = "http://localhost:$Port"
    $edge = "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe"
    if (Test-Path $edge) {
        Write-Host "Preferred Web MIDI browser: Microsoft Edge" -ForegroundColor Green
        Write-Host "Opening $url in Edge; localhost HTTP is sufficient for Web MIDI secure-context rules." -ForegroundColor Cyan
        Start-Job -ScriptBlock {
            param($BrowserPath, $ReadyUrl)
            for ($attempt = 0; $attempt -lt 60; $attempt++) {
                try {
                    Invoke-WebRequest -Uri $ReadyUrl -UseBasicParsing -TimeoutSec 1 | Out-Null
                    Start-Process -FilePath $BrowserPath -ArgumentList $ReadyUrl
                    return
                } catch {
                    Start-Sleep -Seconds 1
                }
            }
        } -ArgumentList $edge, $url | Out-Null
    } else {
        Write-Host "Microsoft Edge not found; ArtBastard will use the default browser." -ForegroundColor Yellow
    }
    Write-Host "Starting on $url" -ForegroundColor Green
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $repoPath "start.ps1") -Port $Port -MidiSelect
}

try {
    Show-Splash
    if (-not (Get-Command git -ErrorAction SilentlyContinue)) { throw "git is not available on PATH." }
    $selectedBranch = Get-BranchChoice
    Ensure-NodeRuntime
    Sync-Branch -SelectedBranch $selectedBranch
    Ensure-Dependencies
    Show-LaunchSummary -SelectedBranch $selectedBranch
    Show-ArtNetStatus
    Show-MidiStatus
    Start-ArtBastard
} catch {
    Write-Host ""
    Write-Host "Launcher stopped: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Press Enter to close." -ForegroundColor DarkGray
    [void][Console]::ReadLine()
    exit 1
}
'@

    Set-Content -LiteralPath $launcherPath -Value $launcher -Encoding UTF8
}

function New-Shortcut {
    Write-Step "Creating desktop shortcut"
    $shell = New-Object -ComObject WScript.Shell
    $shortcut = $shell.CreateShortcut($desktopShortcut)
    $shortcut.TargetPath = "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe"
    $shortcut.Arguments = "-NoProfile -ExecutionPolicy Bypass -File `"$launcherPath`" -Branch main -Port $Port"
    $shortcut.WorkingDirectory = $launcherDir
    $launcherIcon = Join-Path $launcherDir "assets\artbastard-launcher.ico"
    if (Test-Path $launcherIcon) {
        $shortcut.IconLocation = $launcherIcon
    } else {
        $shortcut.IconLocation = "$env:SystemRoot\System32\shell32.dll,220"
    }
    $shortcut.Description = "Launch ArtBastard LIVE/main, update from git, run MIDI setup, show log panes, then start locally."
    $shortcut.Save()
    Write-Host "Shortcut ready: $desktopShortcut" -ForegroundColor Green
}

try {
    Write-Host "ArtBastard Local Launcher Installer" -ForegroundColor Magenta
    Require-Command "git" "Install Git for Windows: https://git-scm.com/download/win"
    Ensure-Repo
    Ensure-Node20
    Ensure-Dependencies
    Write-Launcher
    New-Shortcut
    Write-Host ""
    Write-Host "Done. Use '$ShortcutName' on your Desktop to choose LIVE or DEV and launch locally." -ForegroundColor Green
    Write-Host "Offline note: after this install, normal launching works without internet unless dependencies are deleted." -ForegroundColor Cyan
} catch {
    Write-Host ""
    Write-Host "Installer stopped: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
