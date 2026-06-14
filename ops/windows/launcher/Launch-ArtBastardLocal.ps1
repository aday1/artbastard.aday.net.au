param(
    [ValidateSet("ask", "main", "dev")]
    [string]$Branch = "main",
    [int]$Port = 3030
)

$ErrorActionPreference = "Stop"

$repoUrl = "https://github.com/aday1/artbastard.aday.net.au.git"
$artnetHost = "192.168.1.199"
$defaultOscReceivePort = 8000
$defaultOscSendPort = 8000
$defaultArtNetPort = 6454
$splashPath = Join-Path $PSScriptRoot "assets\artbastard-launcher-splash.png"
$script:OfflineMode = $false
$script:CodeUpdatedThisRun = $false

function Resolve-RepoPath {
    $bundledRepoRoot = Split-Path -Parent (Split-Path -Parent (Split-Path -Parent $PSScriptRoot))
    $candidates = @(
        $bundledRepoRoot,
        "C:\Users\Ultima\Desktop\Active Projects\artbastard.aday.net.au",
        "C:\Users\Ultima\Desktop\artbastard.aday.net.au",
        (Join-Path (Split-Path -Parent $PSScriptRoot) "artbastard.aday.net.au")
    )

    foreach ($candidate in $candidates) {
        if (Test-Path (Join-Path $candidate ".git")) {
            return $candidate
        }
    }

    return $candidates[0]
}

$repoPath = Resolve-RepoPath

function Write-Step {
    param([string]$Message, [ConsoleColor]$Color = [ConsoleColor]::Cyan)
    Write-Host ""
    Write-Host "== $Message" -ForegroundColor $Color
}

function Show-Splash {
    Write-Host ""
    Write-Host "======================================================================" -ForegroundColor DarkMagenta
    Write-Host "      ARTBASTARD LOCAL RIG LAUNCHER" -ForegroundColor Magenta
    Write-Host "      LIVE/main | Server MIDI first | OSC + Art-Net + DMX" -ForegroundColor Cyan
    Write-Host "======================================================================" -ForegroundColor DarkMagenta
    Write-Host "   _         _   ____            _                _ " -ForegroundColor Magenta
    Write-Host "  / \   _ __| |_| __ )  __ _ ___| |_ __ _ _ __ __| |" -ForegroundColor Magenta
    Write-Host " / _ \ | '__| __|  _ \ / _` / __| __/ _` | '__/ _` |" -ForegroundColor Cyan
    Write-Host "/ ___ \| |  | |_| |_) | (_| \__ \ || (_| | | | (_| |" -ForegroundColor Cyan
    Write-Host "\_/   \_\_|   \__|____/ \__,_|___/\__\__,_|_|  \__,_|" -ForegroundColor Yellow
    Write-Host "======================================================================" -ForegroundColor DarkMagenta
    Write-Host "Default launch: LIVE branch, git fetch/pull, MIDI setup, local server." -ForegroundColor Green
    Write-Host "Controller policy: APC40/X-Touch auto-map on server; ROLI server claim first." -ForegroundColor Green
    Write-Host ""
    if (Test-Path $splashPath) {
        Write-Host "Splash art: $splashPath" -ForegroundColor DarkGray
    }
}

function Format-Age {
    param([datetime]$Timestamp)

    $age = (Get-Date) - $Timestamp
    if ($age.TotalSeconds -lt 60) { return "just now" }
    if ($age.TotalMinutes -lt 60) { return "{0:N0} min ago" -f $age.TotalMinutes }
    if ($age.TotalHours -lt 48) { return "{0:N1} hr ago" -f $age.TotalHours }
    return "{0:N1} days ago" -f $age.TotalDays
}

function Get-ArtifactAgeText {
    param(
        [string]$Label,
        [string]$Path
    )

    if (-not (Test-Path -LiteralPath $Path)) {
        return "${Label}: missing"
    }

    $item = Get-Item -LiteralPath $Path
    return "${Label}: $(Format-Age -Timestamp $item.LastWriteTime) ($($item.LastWriteTime.ToString('yyyy-MM-dd HH:mm')))"
}

function Invoke-Git {
    param([string[]]$Arguments)
    & git @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "git $($Arguments -join ' ') failed with exit code $LASTEXITCODE"
    }
}

function Write-Countdown {
    param(
        [string]$Message,
        [int]$Seconds = 5
    )

    Write-Host ""
    for ($remaining = $Seconds; $remaining -gt 0; $remaining--) {
        Write-Host "$Message in $remaining..." -ForegroundColor Yellow
        Start-Sleep -Seconds 1
    }
}

function Get-BranchChoice {
    if ($Branch -ne "ask") {
        return $Branch
    }

    Write-Host ""
    Write-Host "ArtBastard branch:" -ForegroundColor Magenta
    Write-Host "  1. LIVE  (main)"
    Write-Host "  2. DEV   (dev)"
    Write-Host ""

    do {
        $choice = Read-Host "Choose 1 or 2"
    } until ($choice -in @("1", "2", "main", "dev", "LIVE", "DEV", "live"))

    if ($choice -in @("2", "dev", "DEV")) {
        return "dev"
    }

    return "main"
}

function Test-Command {
    param([string]$Name)
    return [bool](Get-Command $Name -ErrorAction SilentlyContinue)
}

function Ensure-Repo {
    if (Test-Path (Join-Path $repoPath ".git")) {
        return
    }

    if (-not (Test-InternetAvailable)) {
        throw "ArtBastard is not cloned yet and internet is offline. Connect once so the launcher can clone it."
    }

    Write-Step "Cloning ArtBastard"
    $parent = Split-Path -Parent $repoPath
    if (-not (Test-Path $parent)) {
        New-Item -ItemType Directory -Path $parent | Out-Null
    }

    Invoke-Git @("clone", $repoUrl, $repoPath)
}

function Ensure-NodeRuntime {
    Write-Step "Checking Node runtime"

    if (Test-Command "volta") {
        $nodeVersion = (& node --version 2>$null)
        if (-not $nodeVersion -or -not ($nodeVersion -match "^v(2[0-9]|[3-9][0-9])\.")) {
            Write-Host "Installing Node 20 with Volta..." -ForegroundColor Yellow
            & volta install node@20 npm@10
            if ($LASTEXITCODE -ne 0) {
                throw "Volta could not install Node 20."
            }
        }
    }

    $nodeVersion = (& node --version 2>$null)
    if (-not $nodeVersion -or -not ($nodeVersion -match "^v(2[0-9]|[3-9][0-9])\.")) {
        throw "ArtBastard needs Node 20+. Current node is '$nodeVersion'. Install Node 20 or run 'volta install node@20 npm@10'."
    }

    Write-Host "Node: $nodeVersion" -ForegroundColor Green
}

function Sync-Branch {
    param([string]$SelectedBranch)

    Write-Step "Updating $SelectedBranch"
    Set-Location $repoPath

    $onlineGit = Test-InternetAvailable
    $script:OfflineMode = -not $onlineGit
    $beforeCommit = (& git rev-parse HEAD 2>$null)

    if ($onlineGit) {
        try {
            Invoke-Git @("fetch", "origin", "--prune")
        } catch {
            $onlineGit = $false
            $script:OfflineMode = $true
            Write-Host "GitHub is not reachable; using the local checkout already on disk." -ForegroundColor Yellow
        }
    } else {
        Write-Host "Offline mode: skipping GitHub fetch and using the local checkout already on disk." -ForegroundColor Yellow
    }

    $dirty = (& git status --porcelain)
    if ($dirty) {
        $stamp = Get-Date -Format "yyyyMMdd-HHmmss"
        Write-Host "Local changes detected; stashing before branch switch." -ForegroundColor Yellow
        Invoke-Git @("stash", "push", "-u", "-m", "ArtBastard launcher autosave $stamp")
    }

    $localBranchExists = (& git branch --list $SelectedBranch)
    if ($localBranchExists) {
        Invoke-Git @("switch", $SelectedBranch)
    } else {
        if ($onlineGit) {
            Invoke-Git @("switch", "-c", $SelectedBranch, "origin/$SelectedBranch")
        } else {
            throw "The local '$SelectedBranch' branch does not exist yet. Connect to the internet once to fetch it."
        }
    }

    if ($onlineGit) {
        Invoke-Git @("pull", "--ff-only", "origin", $SelectedBranch)
        $afterCommit = (& git rev-parse HEAD 2>$null)
        if ($beforeCommit -and $afterCommit -and $beforeCommit -ne $afterCommit) {
            $script:CodeUpdatedThisRun = $true
            Write-Host "New ArtBastard code pulled. Startup will rebuild from source as needed." -ForegroundColor Green
        } else {
            Write-Host "No new code found. Fast local startup path is available." -ForegroundColor Green
        }
    } else {
        $localCommit = (& git rev-parse --short HEAD)
        Write-Host "Offline mode: running local $SelectedBranch at $localCommit." -ForegroundColor Green
    }
}

function Ensure-Dependencies {
    Write-Step "Checking dependencies"
    Set-Location $repoPath

    if (-not (Test-Path (Join-Path $repoPath "node_modules"))) {
        if ($script:OfflineMode) {
            throw "Backend dependencies are missing and internet is offline. Connect once so npm can install them."
        }
        Write-Host "Installing backend dependencies with npm cache preference..." -ForegroundColor Yellow
        & npm ci --prefer-offline --no-audit --no-fund
        if ($LASTEXITCODE -ne 0) { throw "npm ci failed in repo root." }
    } else {
        Write-Host "Backend dependencies present." -ForegroundColor Green
    }

    $reactModules = Join-Path $repoPath "react-app\node_modules"
    if (-not (Test-Path $reactModules)) {
        if ($script:OfflineMode) {
            throw "Frontend dependencies are missing and internet is offline. Connect once so npm can install them."
        }
        Write-Host "Installing frontend dependencies with npm cache preference..." -ForegroundColor Yellow
        & npm --prefix react-app ci --prefer-offline --no-audit --no-fund
        if ($LASTEXITCODE -ne 0) { throw "npm ci failed in react-app." }
    } else {
        Write-Host "Frontend dependencies present." -ForegroundColor Green
    }
}

function Test-InternetAvailable {
    try {
        $githubProbe = & ping.exe -n 1 -w 900 github.com 2>$null
        return $LASTEXITCODE -eq 0
    } catch {
        return $false
    }
}

function Get-ArtBastardConfig {
    $defaults = [ordered]@{
        artNetIp = $artnetHost
        artNetPort = $defaultArtNetPort
        oscReceivePort = $defaultOscReceivePort
        oscSendHost = "127.0.0.1"
        oscSendPort = $defaultOscSendPort
        oscSendEnabled = $false
        oscAssignments = 0
    }

    $configPath = Join-Path $repoPath "data\config.json"
    if (-not (Test-Path $configPath)) {
        return [pscustomobject]$defaults
    }

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
        Write-Host "Could not parse data\config.json; using default launch diagnostics." -ForegroundColor Yellow
    }

    return [pscustomobject]$defaults
}

function Show-LaunchSummary {
    param([string]$SelectedBranch)

    $cfg = Get-ArtBastardConfig
    $url = "http://localhost:$Port"

    Write-Step "Launch diagnostics"
    Write-Host "Branch: $SelectedBranch" -ForegroundColor Green
    Write-Host "HTTP UI/API: $url" -ForegroundColor Green
    Write-Host "Last build age:" -ForegroundColor Cyan
    Write-Host "  $(Get-ArtifactAgeText -Label 'Backend dist/server.js' -Path (Join-Path $repoPath 'dist\server.js'))" -ForegroundColor Cyan
    Write-Host "  $(Get-ArtifactAgeText -Label 'Frontend react-app/dist' -Path (Join-Path $repoPath 'react-app\dist\index.html'))" -ForegroundColor Cyan
    try {
        $commitAge = (& git -C $repoPath log -1 --format=%cr 2>$null)
        if ($commitAge) { Write-Host "  Git commit: $commitAge" -ForegroundColor Cyan }
    } catch { }
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

    if ($script:OfflineMode) {
        Write-Host "Offline mode: skipping Art-Net ping so launch stays quick." -ForegroundColor Yellow
        Write-Host "Configured Art-Net UDP port: $($cfg.artNetPort)" -ForegroundColor Green
        return
    }

    $pingOutput = & ping.exe -n 2 -w 1000 $cfg.artNetIp 2>$null
    $isUp = $LASTEXITCODE -eq 0
    if ($isUp) {
        Write-Host "Ping OK: Art-Net target $($cfg.artNetIp) answered." -ForegroundColor Green
        ($pingOutput | Where-Object { $_ -match "Reply from|Packets:" }) | ForEach-Object { Write-Host "  $_" -ForegroundColor DarkGray }
    } else {
        Write-Host "Ping failed: Art-Net target $($cfg.artNetIp) did not answer." -ForegroundColor Yellow
    }
    Write-Host "Configured Art-Net UDP port: $($cfg.artNetPort)" -ForegroundColor Green
}

function Show-MidiStatus {
    Write-Step "Polling MIDI controllers"

    $windowsDevices = @()
    if (Test-Command "Get-PnpDevice") {
        $windowsDevices = Get-PnpDevice -PresentOnly -ErrorAction SilentlyContinue |
            Where-Object { $_.FriendlyName -match "MIDI|APC|Launch|X-Touch|Akai|Novation|Korg|Roland|Behringer|Arturia|DJ|Controller" } |
            Select-Object -ExpandProperty FriendlyName -Unique
    }

    if ($windowsDevices.Count -gt 0) {
        Write-Host "Windows MIDI/controller probe OK; matching devices:" -ForegroundColor Green
        $windowsDevices | ForEach-Object { Write-Host "  - $_" }
    } else {
        Write-Host "No obvious MIDI controller names found in Windows PnP." -ForegroundColor Yellow
    }

    $midiProbe = @'
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
'@

    $probeResult = $midiProbe | node
    Write-Host "Node MIDI probe result:" -ForegroundColor Green
    Write-Host $probeResult
}

function Write-LogPanelScript {
    $panelDir = Join-Path $env:TEMP "ArtBastardLauncher"
    if (-not (Test-Path -LiteralPath $panelDir)) {
        New-Item -ItemType Directory -Force -Path $panelDir | Out-Null
    }

    $panelScriptPath = Join-Path $panelDir "log-panel.ps1"
    $panelScript = @'
param(
    [Parameter(Mandatory = $true)]
    [string]$LogPath,
    [ValidateSet("all", "midi", "rig")]
    [string]$Mode = "all"
)

$ErrorActionPreference = "Continue"
$patterns = @{
    all = "."
    midi = "\[(MIDI|OSC|DMX|ARTNET|TOUCHOSC)\]"
    rig = "\[(SERVER|SYSTEM|WARN|ERROR|CLOCK)\]|ROLI|APC|screensaver|Ableton|ArtNet|RtMidi"
}
$titles = @{
    all = "All server log"
    midi = "MIDI / OSC / DMX"
    rig = "ROLI / APC / warnings"
}

try { $Host.UI.RawUI.WindowTitle = "ArtBastard - $($titles[$Mode])" } catch { }
Write-Host "ArtBastard $($titles[$Mode])" -ForegroundColor Magenta
Write-Host "Tailing $LogPath" -ForegroundColor DarkGray
Write-Host ""

if (-not (Test-Path -LiteralPath $LogPath)) {
    New-Item -ItemType File -Force -Path $LogPath | Out-Null
}

Get-Content -LiteralPath $LogPath -Wait -Tail 120 | Where-Object { $_ -match $patterns[$Mode] }
'@

    Set-Content -LiteralPath $panelScriptPath -Value $panelScript -Encoding UTF8
    return $panelScriptPath
}

function Start-LogPanels {
    $wt = Get-Command wt.exe -ErrorAction SilentlyContinue
    if (-not $wt) {
        Write-Host "Windows Terminal not found; live logs remain in this launcher window and in logs\app.log." -ForegroundColor Yellow
        return
    }

    $logsDir = Join-Path $repoPath "logs"
    if (-not (Test-Path -LiteralPath $logsDir)) {
        New-Item -ItemType Directory -Force -Path $logsDir | Out-Null
    }

    $logPath = Join-Path $logsDir "app.log"
    if (-not (Test-Path -LiteralPath $logPath)) {
        New-Item -ItemType File -Force -Path $logPath | Out-Null
    }

    $panelScriptPath = Write-LogPanelScript
    $wtArgs = @(
        "-w", "artbastard-local",
        "new-tab", "--title", "ArtBastard-all", "powershell.exe", "-NoExit", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", $panelScriptPath, "-LogPath", $logPath, "-Mode", "all",
        ";",
        "split-pane", "-H", "--title", "MIDI-OSC-DMX", "powershell.exe", "-NoExit", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", $panelScriptPath, "-LogPath", $logPath, "-Mode", "midi",
        ";",
        "split-pane", "-V", "--title", "ROLI-APC-warnings", "powershell.exe", "-NoExit", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", $panelScriptPath, "-LogPath", $logPath, "-Mode", "rig"
    )

    try {
        Start-Process -FilePath $wt.Source -ArgumentList $wtArgs | Out-Null
        Write-Host "Opened Windows Terminal split panes for live logs." -ForegroundColor Green
    } catch {
        Write-Host "Could not open Windows Terminal log panes: $($_.Exception.Message)" -ForegroundColor Yellow
    }
}

function Start-ArtBastard {
    Write-Step "Launching ArtBastard"
    Set-Location $repoPath

    $edge = "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe"
    $url = "http://localhost:$Port"
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
        Write-Host "Microsoft Edge path not found; ArtBastard will use the default browser." -ForegroundColor Yellow
    }

    $modeNote = if ($script:CodeUpdatedThisRun) {
        "New code was pulled; ArtBastard will run a clean rebuild from scratch"
    } elseif ($script:OfflineMode) {
        "Offline cached launch"
    } else {
        "Fast relaunch"
    }

    Write-Host "Starting on $url" -ForegroundColor Green
    Write-Host $modeNote -ForegroundColor Cyan
    Start-LogPanels
    Write-Host "Leave this window open while running ArtBastard." -ForegroundColor DarkGray
    Write-Countdown -Message "Relaunching ArtBastard" -Seconds 5

    $startArgs = @(
        "-NoProfile",
        "-ExecutionPolicy", "Bypass",
        "-File", (Join-Path $repoPath "start.ps1"),
        "-Port", "$Port",
        "-MidiSelect"
    )
    if ($script:CodeUpdatedThisRun) {
        $startArgs += "-Clear"
    }

    & powershell.exe @startArgs
}

try {
    Show-Splash
    Write-Host "ArtBastard Local Launcher" -ForegroundColor Magenta

    if (-not (Test-Command "git")) {
        throw "git is not available on PATH."
    }

    $selectedBranch = Get-BranchChoice

    Ensure-Repo
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
