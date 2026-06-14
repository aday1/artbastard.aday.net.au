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

function Write-SplashWindowScript {
    $panelDir = Join-Path $env:TEMP "ArtBastardLauncher"
    if (-not (Test-Path -LiteralPath $panelDir)) {
        New-Item -ItemType Directory -Force -Path $panelDir | Out-Null
    }

    $splashScriptPath = Join-Path $panelDir "splash-window.ps1"
    $splashScript = @'
param(
    [Parameter(Mandatory = $true)]
    [string]$ImagePath,
    [int]$Seconds = 5
)

$ErrorActionPreference = "Stop"
if (-not (Test-Path -LiteralPath $ImagePath)) { exit 0 }

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$image = [System.Drawing.Image]::FromFile($ImagePath)
$form = New-Object System.Windows.Forms.Form
$form.Text = "ArtBastard"
$form.FormBorderStyle = [System.Windows.Forms.FormBorderStyle]::None
$form.StartPosition = [System.Windows.Forms.FormStartPosition]::CenterScreen
$form.TopMost = $true
$form.BackColor = [System.Drawing.Color]::Black
$form.Width = [Math]::Min(960, [System.Windows.Forms.Screen]::PrimaryScreen.WorkingArea.Width - 80)
$form.Height = [Math]::Min(540, [System.Windows.Forms.Screen]::PrimaryScreen.WorkingArea.Height - 80)

$picture = New-Object System.Windows.Forms.PictureBox
$picture.Dock = [System.Windows.Forms.DockStyle]::Fill
$picture.Image = $image
$picture.SizeMode = [System.Windows.Forms.PictureBoxSizeMode]::Zoom
$form.Controls.Add($picture)

$label = New-Object System.Windows.Forms.Label
$label.Text = "ARTBASTARD LOCAL RIG LAUNCHER"
$label.Dock = [System.Windows.Forms.DockStyle]::Bottom
$label.Height = 34
$label.TextAlign = [System.Drawing.ContentAlignment]::MiddleCenter
$label.Font = New-Object System.Drawing.Font("Consolas", 12, [System.Drawing.FontStyle]::Bold)
$label.ForeColor = [System.Drawing.Color]::FromArgb(242, 220, 180)
$label.BackColor = [System.Drawing.Color]::FromArgb(28, 18, 36)
$form.Controls.Add($label)

$timer = New-Object System.Windows.Forms.Timer
$timer.Interval = [Math]::Max(1, $Seconds) * 1000
$timer.Add_Tick({ $timer.Stop(); $form.Close() })
$form.Add_Shown({ $timer.Start(); $form.Activate() })
$form.Add_FormClosed({ $timer.Dispose(); $image.Dispose() })
[System.Windows.Forms.Application]::Run($form)
'@

    Set-Content -LiteralPath $splashScriptPath -Value $splashScript -Encoding UTF8
    return $splashScriptPath
}

function Start-SplashWindow {
    if (-not (Test-Path -LiteralPath $splashPath)) { return }
    try {
        $splashScriptPath = Write-SplashWindowScript
        Start-Process -FilePath "powershell.exe" -WindowStyle Hidden -ArgumentList @(
            "-NoProfile",
            "-STA",
            "-ExecutionPolicy", "Bypass",
            "-File", $splashScriptPath,
            "-ImagePath", $splashPath,
            "-Seconds", "5"
        ) | Out-Null
    } catch {
        Write-Host "Splash image could not be displayed: $($_.Exception.Message)" -ForegroundColor Yellow
    }
}

function Show-Splash {
    Start-SplashWindow
    Write-Host ""
    Write-Host "======================================================================" -ForegroundColor DarkMagenta
    Write-Host "  ARTBASTARD LOCAL RIG LAUNCHER" -ForegroundColor Magenta
    Write-Host "  LIVE/main | Server MIDI first | OSC + Art-Net + DMX" -ForegroundColor Cyan
    Write-Host "======================================================================" -ForegroundColor DarkMagenta
    Write-Host "  PHOTONIC CONSOLE ONLINE" -ForegroundColor Yellow
    Write-Host "  Rig control, live logs, MIDI ownership, and local browser launch." -ForegroundColor Cyan
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

function Get-PreferredBrowser {
    $candidates = @(
        @{ Name = "Microsoft Edge"; Path = Join-Path ${env:ProgramFiles} "Microsoft\Edge\Application\msedge.exe" },
        @{ Name = "Microsoft Edge"; Path = Join-Path ${env:ProgramFiles(x86)} "Microsoft\Edge\Application\msedge.exe" },
        @{ Name = "Google Chrome"; Path = Join-Path ${env:ProgramFiles} "Google\Chrome\Application\chrome.exe" },
        @{ Name = "Google Chrome"; Path = Join-Path ${env:ProgramFiles(x86)} "Google\Chrome\Application\chrome.exe" },
        @{ Name = "Google Chrome"; Path = Join-Path $env:LOCALAPPDATA "Google\Chrome\Application\chrome.exe" }
    )

    foreach ($candidate in $candidates) {
        if ($candidate.Path -and (Test-Path -LiteralPath $candidate.Path)) {
            return [pscustomobject]$candidate
        }
    }

    return $null
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
            Where-Object { $_.FriendlyName -match "MIDI|APC|Launch|X-Touch|Akai|Novation|Korg|Roland|Behringer|Arturia|Bome|LoopBe|TouchOSC|teVirtualMIDI|ipMIDI" } |
            Select-Object -ExpandProperty FriendlyName -Unique |
            Sort-Object
    }

    if ($windowsDevices.Count -gt 0) {
        Write-Host "Windows MIDI/controller probe OK; matching devices:" -ForegroundColor Green
        $windowsDevices | Select-Object -First 24 | ForEach-Object { Write-Host "  - $_" }
        if ($windowsDevices.Count -gt 24) {
            Write-Host "  ... $($windowsDevices.Count - 24) more MIDI-ish Windows devices hidden" -ForegroundColor DarkGray
        }
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
    try {
        $probe = $probeResult | ConvertFrom-Json
        if ($probe.error) {
            Write-Host "  Error: $($probe.error)" -ForegroundColor Yellow
        } else {
            Write-Host "  Inputs ($(@($probe.inputs).Count)):" -ForegroundColor Cyan
            @($probe.inputs) | ForEach-Object { Write-Host "    - $_" }
            Write-Host "  Outputs ($(@($probe.outputs).Count)):" -ForegroundColor Cyan
            @($probe.outputs) | ForEach-Object { Write-Host "    - $_" }
        }
    } catch {
        Write-Host $probeResult
    }
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
    [ValidateSet("all", "midi", "rig", "server", "dmx", "osc")]
    [string]$Mode = "all"
)

$ErrorActionPreference = "Continue"
$patterns = @{
    all = "."
    midi = "\[(MIDI|OSC|DMX|ARTNET|TOUCHOSC)\]"
    rig = "\[(SERVER|SYSTEM|WARN|ERROR|CLOCK)\]|ROLI|APC|screensaver|Ableton|ArtNet|RtMidi"
    server = "\[(SERVER|SYSTEM|WARN|ERROR)\]"
    dmx = "\[(DMX|ARTNET)\]"
    osc = "\[(OSC|TOUCHOSC)\]"
}
$titles = @{
    all = "All server log"
    midi = "MIDI / OSC / DMX"
    rig = "ROLI / APC / warnings"
    server = "Server / system"
    dmx = "DMX / Art-Net"
    osc = "OSC / TouchOSC"
}

function Write-ColoredLogLine {
    param([string]$Line)

    $displayTime = (Get-Date).ToString('HH:mm:ss')
    $displayType = 'LOG'
    $displayMessage = $Line

    $match = [regex]::Match($Line, '^(?<iso>\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z) - \[(?<type>[^\]]+)\] (?<message>.*)$')
    if ($match.Success) {
        $displayType = $match.Groups['type'].Value
        $displayMessage = $match.Groups['message'].Value
        try {
            $displayTime = ([datetimeoffset]::Parse($match.Groups['iso'].Value)).ToLocalTime().ToString('HH:mm:ss')
        } catch { }
    }

    $color = [ConsoleColor]::Gray
    if ($displayType -eq 'ERROR') { $color = [ConsoleColor]::Red }
    elseif ($displayType -eq 'WARN') { $color = [ConsoleColor]::Yellow }
    elseif ($displayType -eq 'MIDI') { $color = [ConsoleColor]::Yellow }
    elseif ($displayType -eq 'OSC' -or $displayType -eq 'TOUCHOSC') { $color = [ConsoleColor]::Green }
    elseif ($displayType -eq 'DMX') { $color = [ConsoleColor]::DarkCyan }
    elseif ($displayType -eq 'ARTNET') { $color = [ConsoleColor]::Cyan }
    elseif ($displayType -eq 'SERVER') { $color = [ConsoleColor]::Magenta }
    elseif ($displayType -eq 'SYSTEM') { $color = [ConsoleColor]::White }
    elseif ($displayType -eq 'CLOCK') { $color = [ConsoleColor]::DarkMagenta }
    elseif ($displayMessage -match 'ROLI|APC|screensaver') { $color = [ConsoleColor]::DarkYellow }

    Write-Host -NoNewline $displayTime -ForegroundColor DarkGray
    Write-Host -NoNewline (' [{0,-7}] ' -f $displayType) -ForegroundColor $color
    Write-Host $displayMessage -ForegroundColor $color
}

try { $Host.UI.RawUI.WindowTitle = "ArtBastard - $($titles[$Mode])" } catch { }
Write-Host "================================================================" -ForegroundColor DarkMagenta
Write-Host "  ArtBastard $($titles[$Mode])" -ForegroundColor Magenta
Write-Host "================================================================" -ForegroundColor DarkMagenta
Write-Host "Local timestamps: HH:mm:ss | source: $LogPath" -ForegroundColor DarkGray
Write-Host "Resize panes with mouse drag or Alt+Shift+Arrow. Use Rig Control for layouts." -ForegroundColor Cyan
Write-Host ""

if (-not (Test-Path -LiteralPath $LogPath)) {
    New-Item -ItemType File -Force -Path $LogPath | Out-Null
}

Get-Content -LiteralPath $LogPath -Wait -Tail 120 | Where-Object { $_ -match $patterns[$Mode] } | ForEach-Object { Write-ColoredLogLine $_ }
'@

    Set-Content -LiteralPath $panelScriptPath -Value $panelScript -Encoding UTF8
    return $panelScriptPath
}

function Write-ControlPanelScript {
    $panelDir = Join-Path $env:TEMP "ArtBastardLauncher"
    if (-not (Test-Path -LiteralPath $panelDir)) {
        New-Item -ItemType Directory -Force -Path $panelDir | Out-Null
    }

    $controlScriptPath = Join-Path $panelDir "rig-control.ps1"
    $controlScript = @'
param(
    [Parameter(Mandatory = $true)]
    [string]$RepoPath,
    [Parameter(Mandatory = $true)]
    [string]$LogPath,
    [Parameter(Mandatory = $true)]
    [string]$LogPanelScriptPath,
    [int]$Port = 3030
)

$ErrorActionPreference = "Continue"

function Write-Rule {
    param([string]$Text = '')
    Write-Host '================================================================' -ForegroundColor DarkMagenta
    if ($Text) { Write-Host ("  {0}" -f $Text) -ForegroundColor Magenta }
}

function Write-ActionLine {
    param(
        [string]$Key,
        [string]$Label,
        [string]$Hint,
        [ConsoleColor]$Color = [ConsoleColor]::Cyan
    )
    Write-Host -NoNewline '[' -ForegroundColor DarkGray
    Write-Host -NoNewline $Key -ForegroundColor $Color
    Write-Host -NoNewline '] ' -ForegroundColor DarkGray
    Write-Host -NoNewline $Label -ForegroundColor $Color
    if ($Hint) { Write-Host "  $Hint" -ForegroundColor DarkGray } else { Write-Host '' }
}

function Format-Uptime {
    param([double]$Seconds)
    $span = [TimeSpan]::FromSeconds([Math]::Max(0, $Seconds))
    if ($span.TotalHours -ge 1) { return ('{0:00}:{1:00}:{2:00}' -f [Math]::Floor($span.TotalHours), $span.Minutes, $span.Seconds) }
    return ('{0:00}:{1:00}' -f $span.Minutes, $span.Seconds)
}

function Invoke-AbApi {
    param(
        [ValidateSet('GET', 'POST', 'DELETE')]
        [string]$Method,
        [string]$Path,
        [object]$Body = $null
    )

    $uri = "http://localhost:$Port/api$Path"
    if ($null -ne $Body) {
        return Invoke-RestMethod -Method $Method -Uri $uri -ContentType 'application/json' -Body ($Body | ConvertTo-Json -Depth 6) -TimeoutSec 8
    }
    return Invoke-RestMethod -Method $Method -Uri $uri -TimeoutSec 8
}

function Show-Status {
    try {
        $health = Invoke-AbApi -Method GET -Path '/health'
        $active = Invoke-AbApi -Method GET -Path '/midi/active'
        $saved = Invoke-AbApi -Method GET -Path '/midi/auto-connect'
        Write-Host -NoNewline 'SERVER     ' -ForegroundColor DarkGray
        Write-Host -NoNewline $health.status.ToUpperInvariant() -ForegroundColor Green
        Write-Host "  sockets:$($health.socketConnections)  uptime:$(Format-Uptime -Seconds $health.uptime)" -ForegroundColor Gray
        Write-Host -NoNewline 'ART-NET    ' -ForegroundColor DarkGray
        $artNetColor = if ($health.artnetStatus -in @('alive', 'reachable')) { [ConsoleColor]::Green } else { [ConsoleColor]::Yellow }
        Write-Host $health.artnetStatus.ToUpperInvariant() -ForegroundColor $artNetColor
        $activeText = if ($active.inputs.Count -gt 0) { $active.inputs -join ', ' } else { '(none)' }
        $savedText = if ($saved.devices.Count -gt 0) { $saved.devices -join ', ' } else { '(none)' }
        Write-Host -NoNewline 'MIDI LIVE  ' -ForegroundColor DarkGray
        Write-Host $activeText -ForegroundColor DarkYellow
        Write-Host -NoNewline 'MIDI BOOT  ' -ForegroundColor DarkGray
        Write-Host $savedText -ForegroundColor DarkYellow
    } catch {
        Write-Host "Server/control API not reachable on port $Port yet: $($_.Exception.Message)" -ForegroundColor Yellow
    }
}

function Select-FromList {
    param([array]$Items, [string]$Prompt)

    if (-not $Items -or $Items.Count -eq 0) {
        Write-Host "No items available." -ForegroundColor Yellow
        return $null
    }

    for ($i = 0; $i -lt $Items.Count; $i++) {
        Write-Host ("  [{0}] {1}" -f ($i + 1), $Items[$i]) -ForegroundColor Gray
    }

    $choice = Read-Host $Prompt
    if ([string]::IsNullOrWhiteSpace($choice)) { return $null }
    $index = 0
    if ([int]::TryParse($choice, [ref]$index) -and $index -ge 1 -and $index -le $Items.Count) {
        return $Items[$index - 1]
    }

    Write-Host "Invalid selection." -ForegroundColor Yellow
    return $null
}

function Get-FirstValue {
    param([object[]]$Values, [object]$Default = '?')
    foreach ($value in $Values) {
        if ($null -ne $value -and "$value" -ne '') { return $value }
    }
    return $Default
}

function Format-ShortText {
    param([object]$Value, [int]$Width = 28)
    $text = if ($null -ne $Value -and "$Value" -ne '') { [string]$Value } else { '(unnamed)' }
    if ($text.Length -gt $Width) { return $text.Substring(0, $Width - 1) + '…' }
    return $text
}

function Connect-ServerMidi {
    try {
        $interfaces = Invoke-AbApi -Method GET -Path '/midi/interfaces'
        $device = Select-FromList -Items @($interfaces.inputs) -Prompt 'Map which MIDI input to server?'
        if (-not $device) { return }

        $rememberAnswer = Read-Host 'Remember this for next startup? [Y/n]'
        $remember = $rememberAnswer -notmatch '^(n|no)$'
        $result = Invoke-AbApi -Method POST -Path '/midi/server/connect' -Body @{ inputName = $device; remember = $remember }
        Write-Host "Mapped to server: $device" -ForegroundColor Green
        Write-Host "Active: $($result.active -join ', ')" -ForegroundColor DarkYellow
    } catch {
        Write-Host "MIDI map failed: $($_.Exception.Message)" -ForegroundColor Red
    }
}

function Disconnect-ServerMidi {
    try {
        $active = Invoke-AbApi -Method GET -Path '/midi/active'
        $devices = @($active.inputs)
        if ($devices.Count -eq 0) {
            Write-Host "No active server MIDI inputs." -ForegroundColor Yellow
            return
        }

        Write-Host "  [A] all active inputs" -ForegroundColor Gray
        for ($i = 0; $i -lt $devices.Count; $i++) {
            Write-Host ("  [{0}] {1}" -f ($i + 1), $devices[$i]) -ForegroundColor Gray
        }

        $choice = Read-Host 'Unmap which server MIDI input?'
        $forgetAnswer = Read-Host 'Also remove from saved startup mapping? [y/N]'
        $forget = $forgetAnswer -match '^(y|yes)$'
        if ($choice -match '^(a|all)$') {
            $forgetText = if ($forget) { 'true' } else { 'false' }
            $result = Invoke-AbApi -Method DELETE -Path "/midi/server/active?forget=$forgetText"
            Write-Host "Unmapped: $($result.disconnected -join ', ')" -ForegroundColor Green
            return
        }

        $index = 0
        if ([int]::TryParse($choice, [ref]$index) -and $index -ge 1 -and $index -le $devices.Count) {
            $device = $devices[$index - 1]
            Invoke-AbApi -Method POST -Path '/midi/server/disconnect' -Body @{ inputName = $device; forget = $forget } | Out-Null
            Write-Host "Unmapped from server: $device" -ForegroundColor Green
        } else {
            Write-Host "Invalid selection." -ForegroundColor Yellow
        }
    } catch {
        Write-Host "MIDI unmap failed: $($_.Exception.Message)" -ForegroundColor Red
    }
}

function Clear-SavedServerMidi {
    $answer = Read-Host 'Clear all saved server MIDI auto-connect devices? [y/N]'
    if ($answer -notmatch '^(y|yes)$') { return }
    try {
        Invoke-AbApi -Method DELETE -Path '/midi/auto-connect' | Out-Null
        Write-Host "Saved server MIDI auto-connect list cleared." -ForegroundColor Green
    } catch {
        Write-Host "Could not clear saved MIDI devices: $($_.Exception.Message)" -ForegroundColor Red
    }
}

function Invoke-FactoryResetFromConsole {
    Write-Host ''
    Write-Host 'FACTORY RESET will clear saved config, scenes, acts, fixtures, stage layout, DMX state, and appearance.' -ForegroundColor Red
    Write-Host 'Logs and bridge token history are preserved by the backend reset endpoint.' -ForegroundColor Yellow
    Write-Host ''
    $confirm = Read-Host 'Type FACTORY RESET to continue'
    if ($confirm -cne 'FACTORY RESET') {
        Write-Host 'Factory reset cancelled.' -ForegroundColor Yellow
        return
    }

    $secondConfirm = Read-Host 'Last check: reset this ArtBastard rig now? [y/N]'
    if ($secondConfirm -notmatch '^(y|yes)$') {
        Write-Host 'Factory reset cancelled.' -ForegroundColor Yellow
        return
    }

    try {
        $result = Invoke-AbApi -Method POST -Path '/factory-reset'
        Write-Host "Factory reset complete. Deleted: $(@($result.deleted).Count), failed: $(@($result.failed).Count)" -ForegroundColor Green
        if (@($result.failed).Count -gt 0) {
            Write-Host 'Some files could not be deleted:' -ForegroundColor Yellow
            @($result.failed) | Select-Object -First 8 | ForEach-Object {
                Write-Host "  - $($_.file): $($_.error)" -ForegroundColor Yellow
            }
        }

        $relaunch = Read-Host 'Relaunch clean server now? [Y/n]'
        if ($relaunch -notmatch '^(n|no)$') {
            Start-CurrentRelaunch
        } else {
            Write-Host 'Current server was reset in place. Refresh browser clients if needed.' -ForegroundColor Cyan
        }
    } catch {
        Write-Host "Factory reset failed: $($_.Exception.Message)" -ForegroundColor Red
    }
}

function Get-SceneNames {
    try {
        $scenes = @(Invoke-AbApi -Method GET -Path '/scenes')
        return @($scenes | Where-Object { $_.name } | ForEach-Object { [string]$_.name })
    } catch {
        return @()
    }
}

function Show-QuickSceneSlots {
    $sceneNames = @(Get-SceneNames | Select-Object -First 9)
    if ($sceneNames.Count -eq 0) { return }

    Write-Host 'QUICK SCENES' -ForegroundColor White
    for ($i = 0; $i -lt $sceneNames.Count; $i++) {
        Write-Host -NoNewline ("[{0}] " -f ($i + 1)) -ForegroundColor Green
        Write-Host $sceneNames[$i] -ForegroundColor Gray
    }
    Write-Host ''
}

function Load-QuickSceneSlot {
    param([int]$Slot)
    $sceneNames = @(Get-SceneNames | Select-Object -First 9)
    if ($Slot -lt 1 -or $Slot -gt $sceneNames.Count) {
        Write-Host "No quick scene assigned to slot $Slot." -ForegroundColor Yellow
        return
    }

    $scene = $sceneNames[$Slot - 1]
    try {
        Invoke-AbApi -Method POST -Path '/scenes/load' -Body @{ name = $scene } | Out-Null
        Write-Host "Loaded quick scene [$Slot]: $scene" -ForegroundColor Green
    } catch {
        Write-Host "Quick scene load failed: $($_.Exception.Message)" -ForegroundColor Red
    }
}

function Show-CurrentLayout {
    try {
        $health = Invoke-AbApi -Method GET -Path '/health'
        $state = Invoke-AbApi -Method GET -Path '/state'
        $activeMidi = Invoke-AbApi -Method GET -Path '/midi/active'
        $savedMidi = Invoke-AbApi -Method GET -Path '/midi/auto-connect'
        $roli = Invoke-AbApi -Method GET -Path '/roli/server/status'
        $screensaver = Invoke-AbApi -Method GET -Path '/screensaver/server/status'

        $fixtures = @($state.fixtures)
        $groups = @($state.groups)
        $fixtureLayout = @($state.fixtureLayout)
        $masterSliders = @($state.masterSliders)
        $scenes = @($state.scenes)

        Write-Rule 'CURRENT LAYOUT'
        Write-Host -NoNewline 'ART-NET    ' -ForegroundColor DarkGray
        $artNetColor = if ($health.artnetStatus -in @('alive', 'reachable')) { [ConsoleColor]::Green } else { [ConsoleColor]::Yellow }
        Write-Host "$($health.artnetStatus.ToUpperInvariant())  $($health.artnetLastPing.ip)" -ForegroundColor $artNetColor

        Write-Host -NoNewline 'SERVER MIDI ' -ForegroundColor DarkGray
        $activeText = if ($activeMidi.inputs.Count -gt 0) { $activeMidi.inputs -join ', ' } else { '(none active)' }
        Write-Host $activeText -ForegroundColor DarkYellow
        Write-Host -NoNewline 'BOOT MIDI   ' -ForegroundColor DarkGray
        $savedText = if ($savedMidi.devices.Count -gt 0) { $savedMidi.devices -join ', ' } else { '(none saved)' }
        Write-Host $savedText -ForegroundColor DarkYellow

        Write-Host -NoNewline 'ROLI        ' -ForegroundColor DarkGray
        $roliName = @($roli.inputName, $roli.outputName) | Where-Object { $_ } | Select-Object -Unique
        $roliText = if ($roli.connected) { "claimed: $($roliName -join ', ')" } else { "not claimed" }
        if ($roli.lastError) { $roliText += " | $($roli.lastError)" }
        elseif ($roli.error) { $roliText += " | $($roli.error)" }
        Write-Host $roliText -ForegroundColor DarkYellow

        Write-Host -NoNewline 'APC40 SS    ' -ForegroundColor DarkGray
        $ssText = "active:$($screensaver.active) outputs:$(@($screensaver.outputNames).Count)"
        if ($screensaver.lastError) { $ssText += " | $($screensaver.lastError)" }
        Write-Host $ssText -ForegroundColor DarkYellow

        Write-Host ''
        Write-Host "Fixtures: $($fixtures.Count) | Groups: $($groups.Count) | Stage placements: $($fixtureLayout.Count) | Master sliders: $($masterSliders.Count) | Scenes: $($scenes.Count)" -ForegroundColor Cyan
        Write-Host 'Stage layout is fixture/project data, not a scene-style load. Import/export it via Project YAML layout/fixtures.' -ForegroundColor DarkGray
        Write-Host ''

        Write-Host 'FIXTURES' -ForegroundColor White
        $fixtures |
            Sort-Object { [int](Get-FirstValue -Values @($_.startAddress, $_.dmxAddress) -Default 9999) } |
            Select-Object -First 16 |
            ForEach-Object {
                $addr = Get-FirstValue -Values @($_.startAddress, $_.dmxAddress) -Default '?'
                $channels = if ($_.channels) { @($_.channels).Count } else { Get-FirstValue -Values @($_.channelCount) -Default '?' }
                $type = Get-FirstValue -Values @($_.type, $_.category) -Default 'fixture'
                Write-Host ("  @{0,-3} {1,-28} {2,3}ch  {3}" -f $addr, (Format-ShortText $_.name 28), $channels, $type) -ForegroundColor Gray
            }
        if ($fixtures.Count -gt 16) { Write-Host "  ... $($fixtures.Count - 16) more fixtures" -ForegroundColor DarkGray }

        if ($groups.Count -gt 0) {
            Write-Host ''
            Write-Host 'GROUPS' -ForegroundColor White
            $groups | Select-Object -First 10 | ForEach-Object {
                $memberCount = if ($_.fixtureIds) { @($_.fixtureIds).Count } elseif ($_.fixtureIndices) { @($_.fixtureIndices).Count } else { 0 }
                Write-Host ("  {0,-28} {1} fixtures" -f (Format-ShortText $_.name 28), $memberCount) -ForegroundColor Gray
            }
            if ($groups.Count -gt 10) { Write-Host "  ... $($groups.Count - 10) more groups" -ForegroundColor DarkGray }
        }
    } catch {
        Write-Host "Current layout failed: $($_.Exception.Message)" -ForegroundColor Red
    }
}

function Load-SceneFromConsole {
    try {
        $sceneNames = @(Get-SceneNames)
        if ($sceneNames.Count -eq 0) {
            Write-Host "No scenes are saved yet." -ForegroundColor Yellow
            return
        }

        $filter = Read-Host 'Filter scenes (Enter for all)'
        if (-not [string]::IsNullOrWhiteSpace($filter)) {
            $sceneNames = @($sceneNames | Where-Object { $_ -match [regex]::Escape($filter) })
        }

        $scene = Select-FromList -Items $sceneNames -Prompt 'Load which scene?'
        if (-not $scene) { return }

        Invoke-AbApi -Method POST -Path '/scenes/load' -Body @{ name = $scene } | Out-Null
        Write-Host "Loaded scene: $scene" -ForegroundColor Green
    } catch {
        Write-Host "Scene load failed: $($_.Exception.Message)" -ForegroundColor Red
    }
}

function Open-StageCanvas {
    $url = "http://localhost:$Port/#/fixture"
    try {
        Start-Process $url
        Write-Host "Opened stage canvas: $url" -ForegroundColor Green
        Write-Host "Stage layout loads with the current fixture project. Saved stage/layout imports live under Settings > Project YAML (layout/fixtures)." -ForegroundColor Cyan
    } catch {
        Write-Host "Could not open stage canvas: $($_.Exception.Message)" -ForegroundColor Red
    }
}

function Start-LauncherUpdate {
    $launcherPath = Join-Path $RepoPath 'ops\windows\launcher\Launch-ArtBastardLocal.ps1'
    if (-not (Test-Path -LiteralPath $launcherPath)) {
        Write-Host "Launcher not found: $launcherPath" -ForegroundColor Red
        return
    }
    Start-Process -FilePath 'powershell.exe' -WindowStyle Maximized -WorkingDirectory (Split-Path -Parent $launcherPath) -ArgumentList @('-NoExit', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $launcherPath, '-Branch', 'main', '-Port', "$Port")
    Write-Host "Started LIVE git update + relaunch in a foreground PowerShell window." -ForegroundColor Green
}

function Start-CurrentRelaunch {
    $startPath = Join-Path $RepoPath 'start.ps1'
    if (-not (Test-Path -LiteralPath $startPath)) {
        Write-Host "start.ps1 not found: $startPath" -ForegroundColor Red
        return
    }
    Start-Process -FilePath 'powershell.exe' -WindowStyle Maximized -WorkingDirectory $RepoPath -ArgumentList @('-NoExit', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $startPath, '-Port', "$Port", '-MidiSelect')
    Write-Host "Started current-code relaunch + MIDI setup in a foreground PowerShell window." -ForegroundColor Green
}

function Open-CustomLogLayout {
    $validModes = @('all', 'midi', 'rig', 'server', 'dmx', 'osc')
    Write-Host "Modes: $($validModes -join ', ')" -ForegroundColor Cyan
    $first = Read-Host 'Right/top panel mode [midi]'
    $second = Read-Host 'Right/middle panel mode [rig]'
    $third = Read-Host 'Right/bottom panel mode [server]'
    if ([string]::IsNullOrWhiteSpace($first)) { $first = 'midi' }
    if ([string]::IsNullOrWhiteSpace($second)) { $second = 'rig' }
    if ([string]::IsNullOrWhiteSpace($third)) { $third = 'server' }
    if ($validModes -notcontains $first -or $validModes -notcontains $second -or $validModes -notcontains $third) {
        Write-Host "Invalid mode. Layout cancelled." -ForegroundColor Yellow
        return
    }

    $wt = Get-Command wt.exe -ErrorAction SilentlyContinue
    if (-not $wt) {
        Write-Host "Windows Terminal not found." -ForegroundColor Yellow
        return
    }

    $args = @(
        '-F', '-w', 'artbastard-local',
        'new-tab', '--title', 'Rig-Control', 'powershell.exe', '-NoExit', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $PSCommandPath, '-RepoPath', $RepoPath, '-LogPath', $LogPath, '-LogPanelScriptPath', $LogPanelScriptPath, '-Port', "$Port",
        ';',
        'split-pane', '-H', '--title', "AB-$first", 'powershell.exe', '-NoExit', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $LogPanelScriptPath, '-LogPath', $LogPath, '-Mode', $first,
        ';',
        'split-pane', '-V', '--title', "AB-$second", 'powershell.exe', '-NoExit', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $LogPanelScriptPath, '-LogPath', $LogPath, '-Mode', $second,
        ';',
        'split-pane', '-V', '--title', "AB-$third", 'powershell.exe', '-NoExit', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $LogPanelScriptPath, '-LogPath', $LogPath, '-Mode', $third
    )
    Start-Process -FilePath $wt.Source -ArgumentList $args
    Write-Host "Opened custom four-panel layout. Resize panes by dragging splitters or Alt+Shift+Arrow." -ForegroundColor Green
}

try { $Host.UI.RawUI.WindowTitle = 'ArtBastard - Rig Control' } catch { }
while ($true) {
    Clear-Host
    Write-Rule 'ARTBASTARD RIG CONTROL'
    Write-Host '  foreground console | local controls | server MIDI owner' -ForegroundColor Cyan
    Write-Rule
    Write-Host "Repo: $RepoPath" -ForegroundColor DarkGray
    Write-Host "Port: $Port" -ForegroundColor DarkGray
    Write-Host 'Resize panes with mouse drag or Alt+Shift+Arrow. Use P to change panel roles.' -ForegroundColor Cyan
    Write-Host ''
    Write-Host 'STATUS' -ForegroundColor White
    Show-Status
    Write-Host ''
    Show-QuickSceneSlots
    Write-Host 'ACTIONS' -ForegroundColor White
    Write-ActionLine 'U' 'Update + relaunch' 'git pull LIVE/main, rebuild if needed' Green
    Write-ActionLine 'R' 'Relaunch current' 'skip git, run start.ps1 with MIDI setup' Green
    Write-ActionLine 'M' 'Map server MIDI' 'claim one input for backend/server console' DarkYellow
    Write-ActionLine 'D' 'Unmap server MIDI' 'release active backend MIDI input(s)' DarkYellow
    Write-ActionLine 'C' 'Clear boot MIDI' 'remove saved server auto-connect list' Yellow
    Write-ActionLine 'F' 'Factory reset' 'clear rig state; requires typed confirmation' Red
    Write-ActionLine 'V' 'Show current layout' 'MIDI, ROLI, Art-Net, fixtures, groups, scene count' White
    Write-ActionLine 'L' 'Load scene' 'choose and fire a saved scene from the console' Green
    Write-ActionLine 'G' 'Stage canvas' 'open fixture/stage map; stage layout comes from project data' Cyan
    Write-ActionLine 'P' 'Panel layout' 'open custom colored panes: all/midi/rig/server/dmx/osc' Cyan
    Write-ActionLine 'S' 'Refresh' 'redraw this control plane' White
    Write-ActionLine 'Q' 'Close pane' 'leave server/log panes running' DarkGray
    Write-Host ''
    $choice = Read-Host 'Choose'
    switch -Regex ($choice) {
        '^(u|U)$' { Start-LauncherUpdate; Pause }
        '^(r|R)$' { Start-CurrentRelaunch; Pause }
        '^(m|M)$' { Connect-ServerMidi; Pause }
        '^(d|D)$' { Disconnect-ServerMidi; Pause }
        '^(c|C)$' { Clear-SavedServerMidi; Pause }
        '^(f|F)$' { Invoke-FactoryResetFromConsole; Pause }
        '^(v|V)$' { Show-CurrentLayout; Pause }
        '^(l|L)$' { Load-SceneFromConsole; Pause }
        '^(g|G)$' { Open-StageCanvas; Pause }
        '^[1-9]$' { Load-QuickSceneSlot -Slot ([int]$choice); Pause }
        '^(p|P)$' { Open-CustomLogLayout; Pause }
        '^(s|S|)$' { }
        '^(q|Q)$' { return }
        default { Write-Host "Unknown choice." -ForegroundColor Yellow; Pause }
    }
}
'@

    Set-Content -LiteralPath $controlScriptPath -Value $controlScript -Encoding UTF8
    return $controlScriptPath
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
    $controlScriptPath = Write-ControlPanelScript
    $wtArgs = @(
        "-F", "-w", "artbastard-local",
        "new-tab", "--title", "Rig-Control", "powershell.exe", "-NoExit", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", $controlScriptPath, "-RepoPath", $repoPath, "-LogPath", $logPath, "-LogPanelScriptPath", $panelScriptPath, "-Port", "$Port",
        ";",
        "split-pane", "-H", "--title", "MIDI-OSC-DMX", "powershell.exe", "-NoExit", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", $panelScriptPath, "-LogPath", $logPath, "-Mode", "midi",
        ";",
        "split-pane", "-V", "--title", "ROLI-APC-warnings", "powershell.exe", "-NoExit", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", $panelScriptPath, "-LogPath", $logPath, "-Mode", "rig",
        ";",
        "split-pane", "-V", "--title", "SERVER-system", "powershell.exe", "-NoExit", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", $panelScriptPath, "-LogPath", $logPath, "-Mode", "server"
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

    $url = "http://localhost:$Port"
    $browser = Get-PreferredBrowser
    if ($browser) {
        Write-Host "Preferred Web MIDI browser: $($browser.Name)" -ForegroundColor Green
        Write-Host "Opening $url in $($browser.Name); localhost HTTP is sufficient for Web MIDI secure-context rules." -ForegroundColor Cyan
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
        } -ArgumentList $browser.Path, $url | Out-Null
    } else {
        Write-Host "No Edge/Chrome executable found in common paths; ArtBastard will use the default browser." -ForegroundColor Yellow
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
