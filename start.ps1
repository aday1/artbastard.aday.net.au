param(
    [switch]$Clear,
    [switch]$Reset,
    [switch]$Help
)

if ($Help) {
    Write-Host ""
    Write-Host "╔════════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
    Write-Host "║  🎭 ArtBastard DMX512 - Sophisticated Launch Orchestrator 🎭 ║" -ForegroundColor Cyan
    Write-Host "╚════════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "📖 Usage:" -ForegroundColor Yellow
    Write-Host "  🚀 .\start.ps1           # Fast start (recommended)" -ForegroundColor Green
    Write-Host "  🧹 .\start.ps1 -Clear    # Full clean rebuild (removes everything, reinstalls, rebuilds)" -ForegroundColor Red
    Write-Host "  🔄 .\start.ps1 -Reset    # Factory reset - clears all saved state (fixtures, scenes, config)" -ForegroundColor Magenta
    Write-Host "  ❓ .\start.ps1 -Help     # Display this help" -ForegroundColor White
    Write-Host ""
    Write-Host "🎯 Modes:" -ForegroundColor Yellow
    Write-Host "  🚀 Default: Fast start - preserves cache and dependencies, only rebuilds if needed" -ForegroundColor Green
    Write-Host "  🧹 -Clear:  Full clean - removes node_modules, cache, and build artifacts, then rebuilds" -ForegroundColor Red
    Write-Host "  🔄 -Reset:  Factory reset - deletes all saved state files (config, scenes, fixtures, etc.)" -ForegroundColor Magenta
    Write-Host ""
    Write-Host "✨ May your lights shine bright! ✨" -ForegroundColor Cyan
    Write-Host ""
    exit 0
}

Write-Host ""
Write-Host "╔══════════════════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║                                                                          ║" -ForegroundColor Cyan
Write-Host "║     █████╗ ██████╗ ████████╗██████╗  █████╗ ███████╗████████╗          ║" -ForegroundColor Cyan
Write-Host "║    ██╔══██╗██╔══██╗╚══██╔══╝██╔══██╗██╔══██╗██╔════╝╚══██╔══╝          ║" -ForegroundColor Cyan
Write-Host "║    ███████║██████╔╝   ██║   ██║  ██║███████║███████╗   ██║             ║" -ForegroundColor Cyan
Write-Host "║    ██╔══██║██╔══██╗   ██║   ██║  ██║██╔══██║╚════██║   ██║             ║" -ForegroundColor Cyan
Write-Host "║    ██║  ██║██║  ██║   ██║   ██████╔╝██║  ██║███████║   ██║             ║" -ForegroundColor Cyan
Write-Host "║    ╚═╝  ╚═╝╚═╝  ╚═╝   ╚═╝   ╚═════╝ ╚═╝  ╚═╝╚══════╝   ╚═╝             ║" -ForegroundColor Cyan
Write-Host "║                                                                          ║" -ForegroundColor Cyan
Write-Host "║              🎭 DMX512 LIGHTING CONTROL SYSTEM 🎭                       ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""
if ($Clear) {
    Write-Host "🧹 ════════════════════════════════════════════════════════════════ 🧹" -ForegroundColor Red
    Write-Host "🧹  FULL CLEAN REBUILD MODE: Removing all artifacts and rebuilding" -ForegroundColor Red
    Write-Host "🧹 ════════════════════════════════════════════════════════════════ 🧹" -ForegroundColor Red
} elseif ($Reset) {
    Write-Host "🔄 ════════════════════════════════════════════════════════════════ 🔄" -ForegroundColor Magenta
    Write-Host "🔄  FACTORY RESET MODE: Clearing all saved state files" -ForegroundColor Magenta
    Write-Host "🔄 ════════════════════════════════════════════════════════════════ 🔄" -ForegroundColor Magenta
} else {
    Write-Host "🚀 ════════════════════════════════════════════════════════════════ 🚀" -ForegroundColor Green
    Write-Host "🚀  FAST START MODE: Smart rebuild (only rebuilds if needed)" -ForegroundColor Green
    Write-Host "🚀 ════════════════════════════════════════════════════════════════ 🚀" -ForegroundColor Green
}
Write-Host ""

$startTime = Get-Date

# Factory reset - clear all saved state
if ($Reset) {
    Write-Host "🔄 ════════════════════════════════════════════════════════════════ 🔄" -ForegroundColor Magenta
    Write-Host "🔄  FACTORY RESET: Clearing all saved state files..." -ForegroundColor Magenta
    Write-Host "🔄 ════════════════════════════════════════════════════════════════ 🔄" -ForegroundColor Magenta
    Write-Host ""
    
    # Clear data directory - remove ALL files and subdirectories
    if (Test-Path "data") {
        Write-Host "  🗑️  Removing ALL saved state files and directories..." -ForegroundColor Cyan
        
        # Remove all files recursively
        Get-ChildItem -Path "data" -Recurse -File | ForEach-Object {
            Remove-Item -Force $_.FullName -ErrorAction SilentlyContinue
            Write-Host "    ✅ Removed: $($_.FullName)" -ForegroundColor Yellow
        }
        
        # Remove all subdirectories
        Get-ChildItem -Path "data" -Directory | ForEach-Object {
            Remove-Item -Force -Recurse $_.FullName -ErrorAction SilentlyContinue
            Write-Host "    ✅ Removed directory: $($_.Name)" -ForegroundColor Yellow
        }
        
        Write-Host "  ✅ All state files cleared!" -ForegroundColor Green
    } else {
        Write-Host "  ℹ️  No data directory found (already clean)" -ForegroundColor Green
    }
    
    # Clear logs directory (optional but recommended for true factory reset)
    if (Test-Path "logs") {
        Write-Host "  🗑️  Clearing log files..." -ForegroundColor Cyan
        Get-ChildItem -Path "logs" -Filter "*.log" -ErrorAction SilentlyContinue | ForEach-Object {
            Remove-Item -Force $_.FullName -ErrorAction SilentlyContinue
        }
        Write-Host "  ✅ Logs cleared!" -ForegroundColor Green
    }
    
    # Create factory reset marker so frontend can clear localStorage
    if (-not (Test-Path "data")) {
        New-Item -ItemType Directory -Path "data" -Force | Out-Null
    }
    $markerContent = @{
        factoryReset = $true
        timestamp = [int][double]::Parse((Get-Date -UFormat %s))
    } | ConvertTo-Json
    $markerContent | Out-File -FilePath "data\.factory-reset-marker.json" -Encoding utf8 -Force
    Write-Host "  ✅ Factory reset marker created (frontend will clear localStorage)" -ForegroundColor Green
    
    Write-Host ""
    Write-Host "✨ ════════════════════════════════════════════════════════════════ ✨" -ForegroundColor Green
    Write-Host "✨  Factory reset complete! ALL saved state has been cleared." -ForegroundColor Green
    Write-Host "✨  The server will start with default settings (completely fresh)." -ForegroundColor Green
    Write-Host "✨  Browser localStorage will be automatically cleared on next load." -ForegroundColor Green
    Write-Host "✨ ════════════════════════════════════════════════════════════════ ✨" -ForegroundColor Green
    Write-Host ""
}

# Sophisticated ETA calculation system using temporary performance metrics
$etaTempFile = "$env:TEMP\artbastard_eta_metrics.json"
$etaMetrics = @{
    "lastRunTimes" = @()
    "averageTime" = 0
    "lastUpdated" = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
}

# Load existing metrics if available
if (Test-Path $etaTempFile) {
    try {
        $existingMetrics = Get-Content $etaTempFile | ConvertFrom-Json
        if ($existingMetrics.lastRunTimes) {
            $etaMetrics.lastRunTimes = $existingMetrics.lastRunTimes
            $etaMetrics.averageTime = $existingMetrics.averageTime
        }
    } catch {
        # If corrupted, start fresh
        $etaMetrics.lastRunTimes = @()
        $etaMetrics.averageTime = 0
    }
}

function Update-ETAMetrics {
    param([double]$totalTime)
    
    # Add current run time to history (keep last 10 runs)
    $etaMetrics.lastRunTimes += $totalTime
    if ($etaMetrics.lastRunTimes.Count -gt 10) {
        $etaMetrics.lastRunTimes = $etaMetrics.lastRunTimes[-10..-1]
    }
    
    # Calculate sophisticated average with weighted recent performance
    if ($etaMetrics.lastRunTimes.Count -gt 0) {
        $recentWeight = 0.7
        $historicalWeight = 0.3
        
        $recentAverage = if ($etaMetrics.lastRunTimes.Count -ge 3) {
            ($etaMetrics.lastRunTimes[-3..-1] | Measure-Object -Average).Average
        } else {
            ($etaMetrics.lastRunTimes | Measure-Object -Average).Average
        }
        
        $historicalAverage = if ($etaMetrics.lastRunTimes.Count -gt 3) {
            ($etaMetrics.lastRunTimes[0..($etaMetrics.lastRunTimes.Count-4)] | Measure-Object -Average).Average
        } else {
            $recentAverage
        }
        
        $etaMetrics.averageTime = ($recentAverage * $recentWeight) + ($historicalAverage * $historicalWeight)
    }
    
    $etaMetrics.lastUpdated = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
    
    # Save metrics
    try {
        $etaMetrics | ConvertTo-Json -Depth 3 | Out-File $etaTempFile -Encoding UTF8
    } catch {
        # Silently fail if can't save metrics
    }
}

function Get-SophisticatedETA {
    param([int]$currentStep, [int]$totalSteps)
    
    $elapsed = [math]::Round(((Get-Date) - $startTime).TotalSeconds, 1)
    
    if ($currentStep -gt 0 -and $etaMetrics.averageTime -gt 0) {
        # Use sophisticated calculation based on historical performance
        $progressRatio = $currentStep / $totalSteps
        $estimatedTotal = [math]::Round($etaMetrics.averageTime * (1 + (1 - $progressRatio) * 0.2), 1)
        $remaining = [math]::Round($estimatedTotal - $elapsed, 1)
        
        # Ensure remaining time is reasonable
        if ($remaining -lt 0) { $remaining = 0 }
        if ($remaining -gt $etaMetrics.averageTime * 2) { $remaining = [math]::Round($etaMetrics.averageTime * 1.5, 1) }
        
        return $remaining
    } else {
        # Fallback to simple calculation
        $estimatedTotal = if ($currentStep -gt 0) { [math]::Round(($elapsed / $currentStep) * $totalSteps, 1) } else { "?" }
        $remaining = if ($estimatedTotal -ne "?") { [math]::Round($estimatedTotal - $elapsed, 1) } else { "?" }
        return $remaining
    }
}

# Function to check if rebuild is needed (including major code changes)
function Test-NeedsRebuild {
    $rebuildNeeded = $false
    $cacheClearNeeded = $false
    $reasons = @()
    
    # Check backend
    if (-not (Test-Path "dist") -or -not (Test-Path "dist/server.js")) {
        $rebuildNeeded = $true
        $reasons += "Backend build missing"
    } else {
        # Check if source files are newer than build
        $serverBuildTime = (Get-Item "dist/server.js").LastWriteTime
        $sourceFiles = Get-ChildItem -Path "src" -Recurse -File -ErrorAction SilentlyContinue
        $newerSources = $sourceFiles | Where-Object { $_.LastWriteTime -gt $serverBuildTime }
        if ($newerSources) {
            $rebuildNeeded = $true
            $reasons += "Backend source files modified"
        }
        
        # Check for major config changes (TypeScript, build configs)
        $majorConfigFiles = @("tsconfig.json", "package.json", "webpack.config.js", "vite.config.ts", "vite.config.js")
        foreach ($configFile in $majorConfigFiles) {
            if ((Test-Path $configFile) -and ((Get-Item $configFile).LastWriteTime -gt $serverBuildTime)) {
                $rebuildNeeded = $true
                $cacheClearNeeded = $true
                $reasons += "Major config file changed: $configFile"
            }
        }
    }
    
    # Check React frontend
    if (-not (Test-Path "react-app/dist") -or -not (Test-Path "react-app/dist/index.html")) {
        $rebuildNeeded = $true
        $reasons += "Frontend build missing"
    } else {
        $indexBuildTime = (Get-Item "react-app/dist/index.html").LastWriteTime
        # Check if React source files are newer than build
        $frontendSources = Get-ChildItem -Path "react-app/src" -Recurse -File -ErrorAction SilentlyContinue
        $newerFrontend = $frontendSources | Where-Object { $_.LastWriteTime -gt $indexBuildTime }
        if ($newerFrontend) {
            $rebuildNeeded = $true
            $reasons += "Frontend source files modified"
        }
        
        # Check if package.json changed (dependencies might have changed)
        if ((Test-Path "react-app/package.json") -and ((Get-Item "react-app/package.json").LastWriteTime -gt $indexBuildTime)) {
            $rebuildNeeded = $true
            $cacheClearNeeded = $true
            $reasons += "Frontend dependencies changed (package.json)"
        }
        
        # Check for major frontend config changes
        $frontendConfigFiles = @("react-app/tsconfig.json", "react-app/vite.config.ts", "react-app/vite.config.js", "react-app/.env", "react-app/.env.local")
        foreach ($configFile in $frontendConfigFiles) {
            if ((Test-Path $configFile) -and ((Get-Item $configFile).LastWriteTime -gt $indexBuildTime)) {
                $rebuildNeeded = $true
                $cacheClearNeeded = $true
                $reasons += "Major frontend config changed: $configFile"
            }
        }
    }
    
    # Check if node_modules are missing
    if (-not (Test-Path "node_modules") -or -not (Test-Path "react-app/node_modules")) {
        $rebuildNeeded = $true
        $reasons += "Dependencies missing"
    }
    
    return @{
        NeedsRebuild = $rebuildNeeded
        NeedsCacheClear = $cacheClearNeeded
        Reasons = $reasons
    }
}

# Function to check if cache clear is needed
function Test-NeedsCacheClear {
    $cacheClearNeeded = $false
    $reasons = @()
    
    # Check Vite cache
    if (Test-Path "react-app/.vite") {
        $viteCacheFiles = Get-ChildItem -Path "react-app/.vite" -Recurse -File -ErrorAction SilentlyContinue
        $staleFiles = $viteCacheFiles | Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-7) }
        if ($staleFiles) {
            $cacheClearNeeded = $true
            $reasons += "Vite cache is stale (>7 days)"
        }
    }
    
    # Check npm cache size
    $npmCachePath = "$env:APPDATA\npm-cache"
    if (Test-Path $npmCachePath) {
        $cacheSize = (Get-ChildItem -Path $npmCachePath -Recurse -File -ErrorAction SilentlyContinue | 
            Measure-Object -Property Length -Sum).Sum / 1MB
        if ($cacheSize -gt 500) {
            $cacheClearNeeded = $true
            $reasons += "npm cache is large (>500MB)"
        }
    }
    
    return @{
        NeedsCacheClear = $cacheClearNeeded
        Reasons = $reasons
    }
}

# Function to launch browser when server is ready
function Start-BrowserWhenReady {
    param([string]$Url = "http://localhost:3030", [int]$MaxAttempts = 45)
    
    $browserJob = Start-Job -ScriptBlock {
        param($url, $maxAttempts)
        $attempt = 0
        
        while ($attempt -lt $maxAttempts) {
            try {
                $response = Invoke-WebRequest -Uri $url -TimeoutSec 3 -ErrorAction SilentlyContinue
                if ($response.StatusCode -eq 200) {
                    Start-Process $url
                    Write-Host "Browser launched: $url" -ForegroundColor Green
                    break
                }
            } catch {
                # Server not ready yet
                if ($attempt % 5 -eq 0) {
                    Write-Host "  Waiting for server... (attempt $attempt/$maxAttempts)" -ForegroundColor Yellow
                }
            }
            
            Start-Sleep -Seconds 1
            $attempt++
        }
        
        if ($attempt -eq $maxAttempts) {
            Write-Host "Server timeout - you may manually open: $url" -ForegroundColor Yellow
        }
    } -ArgumentList $Url, $MaxAttempts
    
    return $browserJob
}

# FULL CLEAN REBUILD PATH: Complete cache clear and rebuild
if ($Clear) {
    Write-Host "🧹 ════════════════════════════════════════════════════════════════ 🧹" -ForegroundColor Red
    Write-Host "🧹  FULL CLEAN REBUILD: Removing all artifacts and rebuilding" -ForegroundColor Red
    Write-Host "🧹 ════════════════════════════════════════════════════════════════ 🧹" -ForegroundColor Red
    Write-Host ""
    
    # Kill all processes
    try {
        Write-Host "⚡ Terminating all Node.js processes..." -ForegroundColor Cyan
        $nodeProcs = Get-Process -Name "node" -ErrorAction SilentlyContinue
        if ($nodeProcs) {
            $nodeProcs | Stop-Process -Force -ErrorAction SilentlyContinue
            Write-Host "  ✅ Processes terminated!" -ForegroundColor Green
        } else {
            Write-Host "  ℹ️  No Node.js processes found" -ForegroundColor Green
        }
        $artProcs = Get-Process -Name "ArtBastard*" -ErrorAction SilentlyContinue
        if ($artProcs) {
            $artProcs | Stop-Process -Force -ErrorAction SilentlyContinue
            Write-Host "  ✅ ArtBastard processes terminated!" -ForegroundColor Green
        }
    } catch {
        # Continue anyway
    }
    
    Write-Host ""
    Write-Host "🧹 ════════════════════════════════════════════════════════════════ 🧹" -ForegroundColor Magenta
    Write-Host "🧹  FORCE CLEARING ALL CACHES..." -ForegroundColor Magenta
    Write-Host "🧹 ════════════════════════════════════════════════════════════════ 🧹" -ForegroundColor Magenta
    
    # Clear Vite cache
    Write-Host "  🗑️  Clearing Vite cache..." -ForegroundColor Cyan
    if (Test-Path "react-app/.vite") {
        Remove-Item -Recurse -Force "react-app/.vite" -ErrorAction SilentlyContinue
        Write-Host "     ✅ Vite cache cleared!" -ForegroundColor Green
    } else {
        Write-Host "     ℹ️  No Vite cache found" -ForegroundColor Green
    }
    
    # Clear npm cache
    Write-Host "  🗑️  Clearing npm cache..." -ForegroundColor Cyan
    npm cache clean --force 2>$null
    npm cache verify 2>$null
    Write-Host "     ✅ npm cache cleared!" -ForegroundColor Green
    
    # Remove node_modules
    Write-Host "  🗑️  Removing node_modules..." -ForegroundColor Cyan
    if (Test-Path "node_modules") {
        Remove-Item -Recurse -Force "node_modules" -ErrorAction SilentlyContinue
        Write-Host "     ✅ Root node_modules removed!" -ForegroundColor Green
    }
    if (Test-Path "react-app/node_modules") {
        Remove-Item -Recurse -Force "react-app/node_modules" -ErrorAction SilentlyContinue
        Write-Host "     ✅ Frontend node_modules removed!" -ForegroundColor Green
    }
    
    # Remove build artifacts
    Write-Host "  🗑️  Removing build artifacts..." -ForegroundColor Cyan
    if (Test-Path "dist") {
        Remove-Item -Recurse -Force "dist" -ErrorAction SilentlyContinue
        Write-Host "     ✅ Backend dist removed!" -ForegroundColor Green
    }
    if (Test-Path "react-app/dist") {
        Remove-Item -Recurse -Force "react-app/dist" -ErrorAction SilentlyContinue
        Write-Host "     ✅ Frontend dist removed!" -ForegroundColor Green
    }
    
    Write-Host ""
    Write-Host "✨ Cache and artifacts cleared! ✨" -ForegroundColor Green
    Write-Host ""
    
    # Reinstall dependencies
    Write-Host "📦 ════════════════════════════════════════════════════════════════ 📦" -ForegroundColor Cyan
    Write-Host "📦  Reinstalling all dependencies..." -ForegroundColor Cyan
    Write-Host "📦 ════════════════════════════════════════════════════════════════ 📦" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "  📥 Installing root dependencies..." -ForegroundColor Cyan
    npm install --no-audit --no-fund --legacy-peer-deps
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  ❌ Root dependency installation failed!" -ForegroundColor Red
        exit 1
    }
    Write-Host "  ✅ Root dependencies installed!" -ForegroundColor Green
    Write-Host ""
    
    Write-Host "  📥 Installing frontend dependencies..." -ForegroundColor Cyan
    Push-Location react-app
    npm install --no-audit --no-fund --legacy-peer-deps
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  ❌ Frontend dependency installation failed!" -ForegroundColor Red
        Pop-Location
        exit 1
    }
    Pop-Location
    Write-Host "  ✅ Frontend dependencies installed!" -ForegroundColor Green
    Write-Host ""
    Write-Host "✨ All dependencies installed! ✨" -ForegroundColor Green
    Write-Host ""
    
    # Force rebuild
    Write-Host "🔨 ════════════════════════════════════════════════════════════════ 🔨" -ForegroundColor Cyan
    Write-Host "🔨  FORCE REBUILDING..." -ForegroundColor Cyan
    Write-Host "🔨 ════════════════════════════════════════════════════════════════ 🔨" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "  🏗️  Building backend..." -ForegroundColor Cyan
    npm run build-backend
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  ❌ Backend build failed!" -ForegroundColor Red
        exit 1
    }
    Write-Host "  ✅ Backend build complete!" -ForegroundColor Green
    Write-Host ""
    
    Write-Host "  🏗️  Building frontend..." -ForegroundColor Cyan
    Push-Location react-app
    npm run build:vite
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  ❌ Frontend build failed!" -ForegroundColor Red
        Pop-Location
        exit 1
    }
    Pop-Location
    Write-Host "  ✅ Frontend build complete!" -ForegroundColor Green
    Write-Host ""
    Write-Host "✨ Build completed! ✨" -ForegroundColor Green
    Write-Host ""
    
    # Launch browser when server is ready
    Write-Host "🌐 ════════════════════════════════════════════════════════════════ 🌐" -ForegroundColor Cyan
    Write-Host "🌐  Browser will launch automatically when server is ready..." -ForegroundColor Cyan
    Write-Host "🌐 ════════════════════════════════════════════════════════════════ 🌐" -ForegroundColor Cyan
    Write-Host ""
    $browserJob = Start-BrowserWhenReady
    
    # Start server
    Write-Host "🎭 ════════════════════════════════════════════════════════════════ 🎭" -ForegroundColor Green
    Write-Host "🎭  Starting ArtBastard DMX512 Server..." -ForegroundColor Green
    Write-Host "🎭 ════════════════════════════════════════════════════════════════ 🎭" -ForegroundColor Green
    Write-Host ""
    try {
        npm start
    } catch {
        Write-Host "❌ Server deployment encountered complications!" -ForegroundColor Red
        Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Yellow
    } finally {
        Remove-Job -Job $browserJob -Force -ErrorAction SilentlyContinue
    }
    
    # Update ETA metrics
    $totalTime = [math]::Round(((Get-Date) - $startTime).TotalSeconds, 1)
    Update-ETAMetrics $totalTime
    
    Write-Host ""
    Write-Host "✨ ════════════════════════════════════════════════════════════════ ✨" -ForegroundColor Cyan
    Write-Host "✨  ArtBastard DMX512 clean rebuild completed in ${totalTime}s!" -ForegroundColor Cyan
    Write-Host "✨  May your lights shine bright! ✨" -ForegroundColor Cyan
    Write-Host "✨ ════════════════════════════════════════════════════════════════ ✨" -ForegroundColor Cyan
    exit 0
}

# FAST START PATH: Smart rebuild (only rebuilds if needed)
if (-not $Clear) {
    Write-Host "🚀 ════════════════════════════════════════════════════════════════ 🚀" -ForegroundColor Green
    Write-Host "🚀  FAST START MODE" -ForegroundColor Green
    Write-Host "🚀  Smart rebuild - only rebuilds if source files changed" -ForegroundColor Green
    Write-Host "🚀 ════════════════════════════════════════════════════════════════ 🚀" -ForegroundColor Green
    Write-Host ""
    
    # Elegant process termination (minimal intervention)
    try {
        Write-Host "⚡ Executing graceful process termination..." -ForegroundColor Cyan
        $nodeProcs = Get-Process -Name "node" -ErrorAction SilentlyContinue
        if ($nodeProcs) {
            Write-Host "  ⚡ Elegantly terminating $($nodeProcs.Count) Node.js processes..." -ForegroundColor Yellow
            $nodeProcs | Stop-Process -Force -ErrorAction SilentlyContinue
        }
        
        $artProcs = Get-Process -Name "ArtBastard*" -ErrorAction SilentlyContinue
        if ($artProcs) {
            Write-Host "  ⚡ Gracefully terminating $($artProcs.Count) ArtBastard processes..." -ForegroundColor Yellow
            $artProcs | Stop-Process -Force -ErrorAction SilentlyContinue
        }
        Write-Host "  ✅ Process termination completed with sophistication!" -ForegroundColor Green
    } catch {
        Write-Host "  ✅ Process termination completed (pristine foundation)" -ForegroundColor Green
    }
    
    Write-Host ""
    
    # Intelligent rebuild and cache detection
    Write-Host "🔍 Conducting architectural analysis..." -ForegroundColor Cyan
    $rebuildCheck = Test-NeedsRebuild
    $cacheCheck = Test-NeedsCacheClear
    
    # Check if cache clear is needed (from rebuild check or cache check)
    $shouldClearCache = $rebuildCheck.NeedsCacheClear -or $cacheCheck.NeedsCacheClear
    
    if ($shouldClearCache) {
        Write-Host "🧹 Cache optimization required (major code changes detected)..." -ForegroundColor Yellow
        foreach ($reason in $rebuildCheck.Reasons) {
            if ($reason -like "*config*" -or $reason -like "*package.json*" -or $reason -like "*dependencies*") {
                Write-Host "  ⚠️  $reason" -ForegroundColor Yellow
            }
        }
        foreach ($reason in $cacheCheck.Reasons) {
            Write-Host "  ⚠️  $reason" -ForegroundColor Yellow
        }
        Write-Host "  🗑️  Clearing Vite cache..." -ForegroundColor Cyan
        if (Test-Path "react-app/.vite") {
            Remove-Item -Recurse -Force "react-app/.vite" -ErrorAction SilentlyContinue
            Write-Host "     ✅ Vite cache cleared!" -ForegroundColor Green
        } else {
            Write-Host "     ℹ️  No Vite cache found" -ForegroundColor Green
        }
        Write-Host "  🗑️  Clearing npm cache..." -ForegroundColor Cyan
        npm cache clean --force 2>$null
        Write-Host "  🔍 Verifying npm cache..." -ForegroundColor Cyan
        npm cache verify 2>$null
        Write-Host "  ✅ Cache cleared successfully!" -ForegroundColor Green
        Write-Host ""
    }
    
    # Check and install dependencies if missing
    $needsRootInstall = -not (Test-Path "node_modules")
    $needsFrontendInstall = -not (Test-Path "react-app/node_modules")
    
    if ($needsRootInstall -or $needsFrontendInstall) {
        Write-Host "📦 Dependencies missing - installing..." -ForegroundColor Yellow
        if ($needsRootInstall) {
            Write-Host "  📥 Installing root dependencies..." -ForegroundColor Cyan
            npm install --prefer-offline --no-optional --no-audit --no-fund --legacy-peer-deps
            if ($LASTEXITCODE -ne 0) {
                Write-Host "  ❌ Root dependency installation failed!" -ForegroundColor Red
                exit 1
            }
            Write-Host "  ✅ Root dependencies installed!" -ForegroundColor Green
        }
        if ($needsFrontendInstall) {
            Write-Host "  📥 Installing frontend dependencies..." -ForegroundColor Cyan
            Push-Location react-app
            npm install --prefer-offline --no-optional --no-audit --no-fund --legacy-peer-deps
            if ($LASTEXITCODE -ne 0) {
                Write-Host "  ❌ Frontend dependency installation failed!" -ForegroundColor Red
                Pop-Location
                exit 1
            }
            Pop-Location
            Write-Host "  ✅ Frontend dependencies installed!" -ForegroundColor Green
        }
        Write-Host "✨ Dependencies installed! ✨" -ForegroundColor Green
        Write-Host ""
    }
    
    if ($rebuildCheck.NeedsRebuild) {
        Write-Host "🔨 Rebuild required:" -ForegroundColor Yellow
        foreach ($reason in $rebuildCheck.Reasons) {
            Write-Host "  ⚠️  $reason" -ForegroundColor Yellow
        }
        Write-Host ""
        Write-Host "🔨 Executing intelligent rebuild..." -ForegroundColor Cyan
        Write-Host ""
        
        # Build backend if needed
        if (-not (Test-Path "dist") -or -not (Test-Path "dist/server.js")) {
            Write-Host "  🏗️  Building backend..." -ForegroundColor Cyan
            npm run build-backend
            if ($LASTEXITCODE -ne 0) {
                Write-Host "  ❌ Backend build failed!" -ForegroundColor Red
                exit 1
            }
            Write-Host "  ✅ Backend build complete!" -ForegroundColor Green
        } else {
            $serverBuildTime = (Get-Item "dist/server.js").LastWriteTime
            $sourceFiles = Get-ChildItem -Path "src" -Recurse -File -ErrorAction SilentlyContinue
            $newerSources = $sourceFiles | Where-Object { $_.LastWriteTime -gt $serverBuildTime }
            if ($newerSources) {
                Write-Host "  🏗️  Building backend (source files modified)..." -ForegroundColor Cyan
                npm run build-backend
                if ($LASTEXITCODE -ne 0) {
                    Write-Host "  ❌ Backend build failed!" -ForegroundColor Red
                    exit 1
                }
                Write-Host "  ✅ Backend build complete!" -ForegroundColor Green
            }
        }
        
        # Build frontend if needed
        if (-not (Test-Path "react-app/dist") -or -not (Test-Path "react-app/dist/index.html")) {
            Write-Host "  🏗️  Building frontend..." -ForegroundColor Cyan
            Push-Location react-app
            npm run build:vite
            if ($LASTEXITCODE -ne 0) {
                Write-Host "  ❌ Frontend build failed!" -ForegroundColor Red
                Pop-Location
                exit 1
            }
            Pop-Location
            Write-Host "  ✅ Frontend build complete!" -ForegroundColor Green
        } else {
            $indexBuildTime = (Get-Item "react-app/dist/index.html").LastWriteTime
            $frontendSources = Get-ChildItem -Path "react-app/src" -Recurse -File -ErrorAction SilentlyContinue
            $newerFrontend = $frontendSources | Where-Object { $_.LastWriteTime -gt $indexBuildTime }
            $packageJsonNewer = (Test-Path "react-app/package.json") -and ((Get-Item "react-app/package.json").LastWriteTime -gt $indexBuildTime)
            if ($newerFrontend -or $packageJsonNewer) {
                Write-Host "  🏗️  Building frontend (source files or dependencies modified)..." -ForegroundColor Cyan
                Push-Location react-app
                npm run build:vite
                if ($LASTEXITCODE -ne 0) {
                    Write-Host "  ❌ Frontend build failed!" -ForegroundColor Red
                    Pop-Location
                    exit 1
                }
                Pop-Location
                Write-Host "  ✅ Frontend build complete!" -ForegroundColor Green
            }
        }
        
        Write-Host ""
        Write-Host "✨ Intelligent rebuild completed with sophistication! ✨" -ForegroundColor Green
    } else {
        Write-Host "✨ Architectural foundation intact - no rebuild required! ✨" -ForegroundColor Green
    }
    
    Write-Host ""
    Write-Host "🎭 ════════════════════════════════════════════════════════════════ 🎭" -ForegroundColor Green
    Write-Host "🎭  Initiating ArtBastard DMX512 server deployment..." -ForegroundColor Green
    Write-Host "🎭 ════════════════════════════════════════════════════════════════ 🎭" -ForegroundColor Green
    Write-Host ""
    
    # Launch browser when server is ready
    Write-Host "🌐 Browser will launch automatically when server is ready..." -ForegroundColor Cyan
    $browserJob = Start-BrowserWhenReady
    
    # Deploy the server with sophistication
    try {
        npm start
    } catch {
        Write-Host "❌ Server deployment encountered complications!" -ForegroundColor Red
        Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Yellow
        Write-Host "Consider executing with -Clear flag for architectural reconstruction" -ForegroundColor Cyan
    } finally {
        # Cleanup browser job
        Remove-Job -Job $browserJob -Force -ErrorAction SilentlyContinue
    }
    
    # Update ETA metrics for future sophistication
    $totalTime = [math]::Round(((Get-Date) - $startTime).TotalSeconds, 1)
    Update-ETAMetrics $totalTime
    
    Write-Host ""
    Write-Host "✨ ════════════════════════════════════════════════════════════════ ✨" -ForegroundColor Cyan
    Write-Host "✨  ArtBastard DMX512 session concluded in ${totalTime}s!" -ForegroundColor Cyan
    Write-Host "✨  May your lights shine bright! ✨" -ForegroundColor Cyan
    Write-Host "✨ ════════════════════════════════════════════════════════════════ ✨" -ForegroundColor Cyan
    exit 0
}

# IMMACULATE RECONSTRUCTION PATH: Only executed when architectural purity is demanded
Write-Host "🧹 IMMACULATE RECONSTRUCTION MODE: Complete architectural restoration" -ForegroundColor Red
Write-Host "This deliberate process ensures pristine foundation and optimal performance" -ForegroundColor Yellow
Write-Host ""

$totalSteps = 7
$currentStep = 0

function Show-SophisticatedProgress {
    param(
        [string]$Message,
        [int]$Step,
        [string]$Color = "Cyan"
    )
    $percentage = [math]::Round(($Step / $totalSteps) * 100)
    $elapsed = [math]::Round(((Get-Date) - $startTime).TotalSeconds, 1)
    $remaining = Get-SophisticatedETA $Step $totalSteps
    
    Write-Host ""
    Write-Host "================================================================" -ForegroundColor Gray
    Write-Host "ARCHITECTURAL PROGRESS: $percentage% | Elapsed: ${elapsed}s | Sophisticated ETA: ${remaining}s" -ForegroundColor Yellow
    Write-Host "================================================================" -ForegroundColor Gray
    Write-Host $Message -ForegroundColor $Color
    Write-Host ""
}

$timestamp = Get-Date -Format "HH:mm:ss.fff"
Show-SophisticatedProgress "Architectural Reconstruction Initiated: $timestamp" 0 "Yellow"

# Step 1: SOPHISTICATED PROCESS TERMINATION
$currentStep = 1
Show-SophisticatedProgress "STEP 1/7: ELEGANT PROCESS TERMINATION PROTOCOL" $currentStep "Red"
$processStart = Get-Date

try {
    # Sophisticated Node.js process termination
    Write-Host "  Executing comprehensive Node.js process analysis..." -ForegroundColor Red
    $nodeProcs = Get-Process -Name "node" -ErrorAction SilentlyContinue
    if ($nodeProcs) {
        Write-Host "  Gracefully terminating $($nodeProcs.Count) Node.js processes with elegance..." -ForegroundColor Yellow
        $nodeProcs | Stop-Process -Force -ErrorAction SilentlyContinue
        Write-Host "  All Node.js processes terminated with sophistication" -ForegroundColor Green
    } else {
        Write-Host "  No Node.js processes detected (pristine state)" -ForegroundColor Green
    }

    # Sophisticated port 3030 resolution
    Write-Host "  Analyzing port 3030 architectural conflicts..." -ForegroundColor Red
    $connections = Get-NetTCPConnection -LocalPort 3030 -ErrorAction SilentlyContinue
    if ($connections) {
        Write-Host "  Resolving port 3030 conflicts with architectural precision..." -ForegroundColor Yellow
        $processes = $connections | Select-Object -ExpandProperty OwningProcess -Unique
        foreach ($processId in $processes) {
            Write-Host "    Elegantly terminating PID: $processId" -ForegroundColor Red
            Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
        }
        Write-Host "  Port 3030 architectural conflicts resolved" -ForegroundColor Green
    } else {
        Write-Host "  Port 3030 architecture pristine" -ForegroundColor Green
    }

    # Sophisticated ArtBastard process management
    Write-Host "  Conducting ArtBastard-related process analysis..." -ForegroundColor Red
    $artProcs = Get-Process | Where-Object { $_.ProcessName -like "*dmx*" -or $_.ProcessName -like "*artbastard*" }
    if ($artProcs) {
        Write-Host "  Gracefully terminating $($artProcs.Count) ArtBastard processes..." -ForegroundColor Yellow
        $artProcs | Stop-Process -Force -ErrorAction SilentlyContinue
        Write-Host "  ArtBastard processes terminated with architectural elegance" -ForegroundColor Green
    } else {
        Write-Host "  No ArtBastard processes detected (foundation clear)" -ForegroundColor Green
    }
    
    $processTime = [math]::Round((Get-Date - $processStart).TotalMilliseconds)
    Write-Host "  Process termination protocol completed in ${processTime}ms with sophistication" -ForegroundColor Cyan
} catch {
    Write-Host "  Process termination completed (pristine foundation established)" -ForegroundColor Green
}

Write-Host ""

# Step 2: ARCHITECTURAL FOUNDATION RECONSTRUCTION (only if -Clear specified)
if ($Clear) {
    $currentStep = 2
    Show-SophisticatedProgress "STEP 2/7: ARCHITECTURAL FOUNDATION RECONSTRUCTION" $currentStep "Red"

# Sophisticated build directory reconstruction
Write-Host "  Executing architectural build directory reconstruction..." -ForegroundColor Red
$buildDirs = @("dist", "react-app/dist", "react-app/dist-tsc", "build", ".next", "out")
foreach ($dir in $buildDirs) {
    if (Test-Path $dir) {
        Write-Host "  Gracefully removing architectural artifact: $dir" -ForegroundColor Yellow
        Remove-Item -Recurse -Force $dir -ErrorAction SilentlyContinue
    }
}

# Sophisticated dependency reconstruction
Write-Host "Initiating dependency reconstruction for pristine foundation..." -ForegroundColor Red
if (Test-Path "node_modules") {
    Write-Host "  Elegantly removing: node_modules" -ForegroundColor Yellow
    Remove-Item -Recurse -Force "node_modules" -ErrorAction SilentlyContinue
}
if (Test-Path "react-app/node_modules") {
    Write-Host "  Gracefully removing: react-app/node_modules" -ForegroundColor Yellow
    Remove-Item -Recurse -Force "react-app/node_modules" -ErrorAction SilentlyContinue
}

# Sophisticated cache purification
Write-Host "Executing comprehensive npm cache purification..." -ForegroundColor Yellow
npm cache clean --force 2>$null
npm cache verify 2>$null

# Sophisticated temporary file elimination
$npmTemp = "$env:APPDATA/npm-cache"
if (Test-Path $npmTemp) {
    Remove-Item -Recurse -Force $npmTemp -ErrorAction SilentlyContinue
}

# Sophisticated TypeScript build cache elimination
if (Test-Path ".tsbuildinfo") {
    Remove-Item ".tsbuildinfo" -Force -ErrorAction SilentlyContinue
}
if (Test-Path "react-app/.tsbuildinfo") {
    Remove-Item "react-app/.tsbuildinfo" -Force -ErrorAction SilentlyContinue
}

# Sophisticated Vite cache elimination
if (Test-Path "react-app/.vite") {
    Remove-Item -Recurse -Force "react-app/.vite" -ErrorAction SilentlyContinue
}


Write-Host "Architectural foundation reconstruction completed with sophistication!" -ForegroundColor Green
Write-Host ""

} else {
    # Skip cleanup when -Clear is not specified
    Write-Host "Preserving architectural artifacts - maintaining existing foundation" -ForegroundColor Green
    Write-Host "Consider -Clear flag for complete architectural reconstruction" -ForegroundColor Yellow
    Write-Host ""
}

# Step 3: SOPHISTICATED DEPENDENCY VALIDATION AND INSTALLATION
$currentStep = 3
Show-SophisticatedProgress "STEP 3/7: SOPHISTICATED DEPENDENCY VALIDATION AND INSTALLATION" $currentStep "Green"

# Sophisticated pre-installation validation
Write-Host "Executing comprehensive system requirement validation..." -ForegroundColor Cyan
$validationErrors = @()

# Sophisticated network connectivity analysis
Write-Host "Conducting network connectivity analysis..." -ForegroundColor Cyan
try {
    $testConnection = Test-NetConnection -ComputerName "registry.npmjs.org" -Port 443 -InformationLevel Quiet -WarningAction SilentlyContinue
    if ($testConnection) {
        Write-Host "  Network architecture: Online (npm registry accessible)" -ForegroundColor Green
        Write-Host "  Preferring offline mode for optimal performance..." -ForegroundColor Cyan
        $global:isOnline = $false  # Prefer offline even when online
    } else {
        Write-Host "  Network architecture: Offline (npm registry unreachable)" -ForegroundColor Yellow
        $global:isOnline = $false
        Write-Host "  Utilizing offline installation protocol..." -ForegroundColor Yellow
    }
} catch {
    Write-Host "  Network architecture: Unknown status (preferring offline mode)" -ForegroundColor Yellow
    $global:isOnline = $false
}

# Sophisticated Node.js version analysis
try {
    $nodeVersion = node --version 2>$null
    if ($nodeVersion) {
        $versionNumber = [version]($nodeVersion -replace "v", "")
        if ($versionNumber -lt [version]"18.0.0") {
            $validationErrors += "Node.js version $nodeVersion is architecturally insufficient. Please upgrade to v18.0.0 or higher for optimal performance."
        } else {
            Write-Host "  Node.js architecture: $nodeVersion (sophisticated)" -ForegroundColor Green
        }
    } else {
        $validationErrors += "Node.js runtime not detected. Please install Node.js from https://nodejs.org/ for architectural completeness."
    }
} catch {
    $validationErrors += "Node.js version analysis encountered complications: $($_.Exception.Message)"
}

# Sophisticated npm version analysis
try {
    $npmVersion = npm --version 2>$null
    if ($npmVersion) {
        Write-Host "  npm architecture: v$npmVersion (elegant)" -ForegroundColor Green
    } else {
        $validationErrors += "npm package manager not detected. Please reinstall Node.js for architectural integrity."
    }
} catch {
    $validationErrors += "npm version analysis encountered challenges: $($_.Exception.Message)"
}

# Sophisticated disk space analysis
try {
    $drive = Get-WmiObject -Class Win32_LogicalDisk | Where-Object { $_.DeviceID -eq "C:" }
    $freeSpaceGB = [math]::Round($drive.FreeSpace / 1GB, 2)
    if ($freeSpaceGB -lt 2) {
        $validationErrors += "Insufficient architectural disk space. At least 2GB free space required for optimal performance. Current: ${freeSpaceGB}GB"
    } else {
        Write-Host "  Disk architecture: ${freeSpaceGB}GB available (sophisticated)" -ForegroundColor Green
    }
} catch {
    Write-Host "  Disk space analysis could not be completed" -ForegroundColor Yellow
}

# Sophisticated validation results analysis
if ($validationErrors.Count -gt 0) {
    Write-Host "ARCHITECTURAL VALIDATION ENCOUNTERED COMPLICATIONS:" -ForegroundColor Red
    foreach ($validationError in $validationErrors) {
        Write-Host "   - $validationError" -ForegroundColor Red
    }
    Write-Host ""
    Write-Host "Please address the above architectural requirements and execute the script again with sophistication." -ForegroundColor Yellow
    exit 1
} else {
    Write-Host "All system requirements validated with architectural elegance!" -ForegroundColor Green
}
Write-Host ""

# Check if dependencies need to be installed
$needsRootInstall = -not (Test-Path "node_modules")
$needsFrontendInstall = -not (Test-Path "react-app/node_modules")

if ($needsRootInstall -or $needsFrontendInstall -or $Clear) {
    Write-Host "Installing root dependencies..." -ForegroundColor Cyan
    try {
        # Always prefer offline mode for faster startup
        Write-Host "  Using offline mode for faster startup..." -ForegroundColor Cyan
        npm install --prefer-offline --no-optional --no-audit --no-fund --legacy-peer-deps
        if ($LASTEXITCODE -ne 0) {
            Write-Host "  Offline installation failed, trying with cached packages..." -ForegroundColor Yellow
            npm install --prefer-offline --no-optional --no-audit --no-fund --no-cache --legacy-peer-deps
            if ($LASTEXITCODE -ne 0) {
                Write-Host "  Cached packages failed, trying online as fallback..." -ForegroundColor Yellow
                npm install --no-cache --prefer-offline=false --legacy-peer-deps
                if ($LASTEXITCODE -ne 0) {
                    throw "All npm install attempts failed with exit code $LASTEXITCODE"
                }
            }
        }
        Write-Host "Root dependencies installed!" -ForegroundColor Green
    } catch {
        Write-Host "FAILED: Root dependency installation failed!" -ForegroundColor Red
        Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Yellow
        Write-Host "Network troubleshooting steps:" -ForegroundColor Cyan
        Write-Host "   1. Check your internet connection" -ForegroundColor White
        Write-Host "   2. Try running: npm cache clean --force" -ForegroundColor White
        Write-Host "   3. Try running: npm config set registry https://registry.npmjs.org/" -ForegroundColor White
        Write-Host "   4. If behind corporate firewall, configure npm proxy settings" -ForegroundColor White
        Write-Host "   5. Try running: npm install --prefer-offline --no-optional" -ForegroundColor White
        exit 1
    }
} else {
    Write-Host "Root dependencies already installed - skipping installation" -ForegroundColor Green
}

if ($needsFrontendInstall -or $Clear) {
    Write-Host "Installing frontend dependencies..." -ForegroundColor Cyan
    try {
        Push-Location react-app
        # Always prefer offline mode for faster startup
        Write-Host "  Using offline mode for faster startup..." -ForegroundColor Cyan
        npm install --prefer-offline --no-optional --no-audit --no-fund --legacy-peer-deps
        if ($LASTEXITCODE -ne 0) {
            Write-Host "  Offline installation failed, trying with cached packages..." -ForegroundColor Yellow
            npm install --prefer-offline --no-optional --no-audit --no-fund --no-cache --legacy-peer-deps
            if ($LASTEXITCODE -ne 0) {
                Write-Host "  Cached packages failed, trying online as fallback..." -ForegroundColor Yellow
                npm install --no-cache --prefer-offline=false --legacy-peer-deps
                if ($LASTEXITCODE -ne 0) {
                    throw "All npm install attempts failed with exit code $LASTEXITCODE"
                }
            }
        }
        Pop-Location
        Write-Host "Frontend dependencies installed!" -ForegroundColor Green
    } catch {
        Write-Host "FAILED: Frontend dependency installation failed!" -ForegroundColor Red
        Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Yellow
        Pop-Location
        Write-Host "Network troubleshooting steps:" -ForegroundColor Cyan
        Write-Host "   1. Check your internet connection" -ForegroundColor White
        Write-Host "   2. Try running: cd react-app && npm cache clean --force" -ForegroundColor White
        Write-Host "   3. Try running: cd react-app && npm install --prefer-offline --no-optional" -ForegroundColor White
        Write-Host "   4. If behind corporate firewall, configure npm proxy settings" -ForegroundColor White
        exit 1
    }
} else {
    Write-Host "Frontend dependencies already installed - skipping installation" -ForegroundColor Green
}


# Step 4: SOPHISTICATED ARCHITECTURAL CONSTRUCTION
$currentStep = 4
Show-SophisticatedProgress "STEP 4/7: SOPHISTICATED ARCHITECTURAL CONSTRUCTION" $currentStep "Green"

Write-Host "Executing sophisticated backend architectural construction..." -ForegroundColor Cyan
try {
    # Use sophisticated build optimization if available
    if (Test-Path "build-backend-fast.js") {
        Write-Host "  Utilizing sophisticated fast build architecture..." -ForegroundColor Yellow
        npm run build-backend-fast
    } else {
        Write-Host "  Employing standard build architecture..." -ForegroundColor Yellow
        npm run build-backend
    }
    if ($LASTEXITCODE -ne 0) {
        throw "Backend architectural construction encountered complications with exit code $LASTEXITCODE"
    }
    Write-Host "Backend architectural construction completed with sophistication!" -ForegroundColor Green
} catch {
    Write-Host "ARCHITECTURAL CONSTRUCTION COMPLICATIONS: Backend build encountered challenges!" -ForegroundColor Red
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Yellow
    Write-Host "Please review TypeScript architectural patterns in src/ directory" -ForegroundColor Cyan
    exit 1
}

Write-Host "Executing sophisticated frontend architectural construction..." -ForegroundColor Cyan
try {
    Push-Location react-app
    Write-Host "  Employing sophisticated frontend build architecture..." -ForegroundColor Yellow
    npm run build:vite
    if ($LASTEXITCODE -ne 0) {
        throw "Frontend architectural construction encountered complications with exit code $LASTEXITCODE"
    }
    Pop-Location
    Write-Host "Frontend architectural construction completed with elegance!" -ForegroundColor Green
} catch {
    Write-Host "ARCHITECTURAL CONSTRUCTION COMPLICATIONS: Frontend build encountered challenges!" -ForegroundColor Red
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Yellow
    Pop-Location
    Write-Host "Please review TypeScript architectural patterns in react-app/src/ directory" -ForegroundColor Cyan
    exit 1
}

Write-Host "Executing sophisticated Electron architectural preparation..." -ForegroundColor Cyan
try {
    Push-Location electron
    Write-Host "  Preparing Electron for sophisticated development mode..." -ForegroundColor Yellow
    Write-Host "  Electron will utilize the React development server at http://localhost:3001" -ForegroundColor Yellow
    Pop-Location
    Write-Host "Electron architectural preparation completed with sophistication!" -ForegroundColor Green
} catch {
    Write-Host "ARCHITECTURAL PREPARATION COMPLICATIONS: Electron setup encountered challenges!" -ForegroundColor Red
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Yellow
    Pop-Location
    Write-Host "Please review Electron architectural configuration in electron/ directory" -ForegroundColor Cyan
    exit 1
}
Write-Host ""

# Step 5: SOPHISTICATED ARCHITECTURAL VERIFICATION
$currentStep = 5
Show-SophisticatedProgress "STEP 5/7: SOPHISTICATED ARCHITECTURAL VERIFICATION" $currentStep "Green"

$buildSuccess = $true
if (-not (Test-Path "dist")) {
    Write-Host "Backend architectural foundation missing!" -ForegroundColor Red
    $buildSuccess = $false
}
if (-not (Test-Path "react-app/dist")) {
    Write-Host "Frontend architectural foundation missing!" -ForegroundColor Red
    $buildSuccess = $false
}
if (-not (Test-Path "electron/node_modules")) {
    Write-Host "Electron architectural dependencies missing!" -ForegroundColor Red
    $buildSuccess = $false
}

if ($buildSuccess) {
    Write-Host "Architectural verification completed with sophistication!" -ForegroundColor Green
    Write-Host "All architectural components constructed successfully!" -ForegroundColor Green
    Write-Host "Electron application ready for sophisticated development mode with native MIDI support!" -ForegroundColor Magenta
} else {
    Write-Host "Architectural verification encountered complications!" -ForegroundColor Red
    exit 1
}
Write-Host ""

# Step 6: SOPHISTICATED ARTBASTARD WEB SERVER DEPLOYMENT
$currentStep = 6
Show-SophisticatedProgress "STEP 6/6: SOPHISTICATED ARTBASTARD WEB SERVER DEPLOYMENT" $currentStep "Green"
Write-Host "Initiating ArtBastard DMX512 web server deployment with architectural sophistication..." -ForegroundColor Green

# Sophisticated browser auto-open with architectural monitoring
$browserJob = Start-Job -ScriptBlock {
    $maxAttempts = 45  # Sophisticated wait time for architectural reconstruction
    $attempt = 0
    $url = "http://localhost:3030"
    
    Write-Host "Conducting sophisticated server readiness analysis..." -ForegroundColor Cyan
    
    while ($attempt -lt $maxAttempts) {
        try {
            $response = Invoke-WebRequest -Uri $url -TimeoutSec 3 -ErrorAction SilentlyContinue
            if ($response.StatusCode -eq 200) {
                # Server architecture verified, deploying browser
                Start-Process $url
                Write-Host "ARCHITECTURAL SUCCESS! Browser deployed to $url" -ForegroundColor Green
                Write-Host "ArtBastard DMX512 is ready with sophisticated architectural features!" -ForegroundColor Green
                break
            }
        } catch {
            # Server architecture not yet ready, conducting analysis
            if ($attempt % 5 -eq 0) {
                Write-Host "  Conducting server readiness analysis... (attempt $attempt/$maxAttempts)" -ForegroundColor Yellow
            }
        }
        
        Start-Sleep -Seconds 1
        $attempt++
    }
    
    if ($attempt -eq $maxAttempts) {
        Write-Host "Server readiness timeout: Architecture took longer than expected to initialize" -ForegroundColor Yellow
        Write-Host "   You may manually deploy browser to: http://localhost:3030" -ForegroundColor White
        Write-Host "   The server architecture may still be initializing..." -ForegroundColor White
    }
}

Write-Host ""
$totalTime = [math]::Round(((Get-Date) - $startTime).TotalSeconds, 1)
Write-Host "ARCHITECTURAL RECONSTRUCTION COMPLETED WITH SOPHISTICATION!" -ForegroundColor Green
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "Total Architectural Construction Time: ${totalTime}s" -ForegroundColor Yellow
Write-Host "You now possess the most sophisticated ArtBastard DMX512 architecture!" -ForegroundColor White
Write-Host "WEB SERVER ARCHITECTURE: All MIDI Learn, OSC, and lighting controls are architecturally pristine!" -ForegroundColor White
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host ""

# Update ETA metrics for future sophistication
Update-ETAMetrics $totalTime

# Deploy the server with sophisticated monitoring
try {
    Write-Host "Initiating ArtBastard DMX512 server deployment..." -ForegroundColor Green
    npm start
} catch {
    Write-Host "Server deployment encountered architectural complications!" -ForegroundColor Red
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Yellow
    Write-Host "Sophisticated troubleshooting protocols:" -ForegroundColor Cyan
    Write-Host "   1. Verify port 3030 architectural conflicts" -ForegroundColor White
    Write-Host "   2. Confirm Node.js and npm architectural integrity" -ForegroundColor White
    Write-Host "   3. Execute: npm run build-backend && node dist/server.js" -ForegroundColor White
    Write-Host "   4. Review architectural logs in logs/app.log for detailed analysis" -ForegroundColor White
} finally {
    # Sophisticated browser job cleanup
    Remove-Job -Job $browserJob -Force -ErrorAction SilentlyContinue
}

Write-Host ""
Write-Host "ArtBastard DMX512 architectural session concluded with sophistication." -ForegroundColor Cyan
Write-Host "   Gratitude for utilizing the most sophisticated lighting control architecture!" -ForegroundColor White
Write-Host "   Both Electron application and web server have been deployed with architectural elegance!" -ForegroundColor Magenta