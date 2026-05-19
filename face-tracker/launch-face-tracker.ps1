param(
    [switch]$Build,
    [switch]$Help,
    [switch]$NoElevate,
    [int]$CameraIndex = -1,
    [string]$ConfigPath = "face-tracker-config.json"
)

# Check if running as Administrator
function Test-Administrator {
    $currentUser = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($currentUser)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

# Elevate to Administrator if needed
if (-not $NoElevate -and -not (Test-Administrator)) {
    Write-Host "ArtBastard Face Tracker - Windows Launcher" -ForegroundColor Cyan
    Write-Host "==========================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "[!] This script requires Administrator privileges" -ForegroundColor Yellow
    Write-Host "  Elevating to Administrator..." -ForegroundColor Cyan
    Write-Host ""
    
    # Build arguments string
    $arguments = "-NoProfile -ExecutionPolicy Bypass -NoExit -File `"$($MyInvocation.MyCommand.Path)`""
    if ($Build) { $arguments += " -Build" }
    if ($Help) { $arguments += " -Help" }
    $arguments += " -NoElevate"  # Prevent infinite loop
    if ($CameraIndex -ge 0) { $arguments += " -CameraIndex $CameraIndex" }
    if ($ConfigPath -ne "face-tracker-config.json") { $arguments += " -ConfigPath `"$ConfigPath`"" }
    
    try {
        Write-Host "Opening new Administrator window..." -ForegroundColor Cyan
        Start-Process powershell.exe -Verb RunAs -ArgumentList $arguments
        exit 0
    } catch {
        Write-Host "[X] Failed to elevate to Administrator: $_" -ForegroundColor Red
        Write-Host "Please right-click and select 'Run as Administrator'" -ForegroundColor Yellow
        exit 1
    }
}

if ($Help) {
    Write-Host "ArtBastard Face Tracker - Windows Launch Script" -ForegroundColor Cyan
    Write-Host "===============================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Usage:" -ForegroundColor Yellow
    Write-Host "  .\launch-face-tracker.ps1           # Launch face tracker (builds if needed)" -ForegroundColor Green
    Write-Host "  .\launch-face-tracker.ps1 -Build     # Force rebuild" -ForegroundColor Green
    Write-Host "  .\launch-face-tracker.ps1 -CameraIndex 1  # Use camera 1 instead of default" -ForegroundColor Green
    Write-Host ""
    Write-Host "Requirements:" -ForegroundColor Yellow
    Write-Host "  - CMake 3.12+" -ForegroundColor White
    Write-Host "  - Visual Studio 2019+ with C++ tools" -ForegroundColor White
    Write-Host "  - OpenCV 4.x (via vcpkg or manual install)" -ForegroundColor White
    Write-Host "  - libcurl (usually comes with OpenCV/vcpkg)" -ForegroundColor White
    Write-Host ""
    exit 0
}

Write-Host "ArtBastard Face Tracker - Windows Launcher" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

if (Test-Administrator) {
    Write-Host "[OK] Running as Administrator" -ForegroundColor Green
} else {
    Write-Host "[!] Not running as Administrator (some operations may fail)" -ForegroundColor Yellow
}
Write-Host ""

$ErrorActionPreference = "Stop"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Push-Location $scriptDir

# Check if DMX server is running
Write-Host "Checking DMX server connection..." -ForegroundColor Cyan
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3030/api/status" -TimeoutSec 2 -ErrorAction Stop
    Write-Host "  [OK] DMX server is running" -ForegroundColor Green
} catch {
    Write-Host "  [!] DMX server not responding at http://localhost:3030" -ForegroundColor Yellow
    Write-Host "  Please start the DMX server first:" -ForegroundColor Yellow
    Write-Host "    cd ..; npm start" -ForegroundColor White
    Write-Host ""
    $continue = Read-Host "Continue anyway? (y/n)"
    if ($continue -ne "y") {
        Write-Host "Exiting. Please start the DMX server first." -ForegroundColor Red
        exit 1
    }
}

Write-Host ""

# Check for required tools
Write-Host "Checking dependencies..." -ForegroundColor Cyan

# Check CMake
$cmakeFound = $false
$cmakePath = $null

# First try PATH
try {
    $cmakeVersion = & cmake --version 2>&1 | Select-Object -First 1
    if ($cmakeVersion -match "version (\d+)\.(\d+)") {
        $major = [int]$matches[1]
        $minor = [int]$matches[2]
        if ($major -gt 3 -or ($major -eq 3 -and $minor -ge 12)) {
            $cmakeExe = Get-Command cmake -ErrorAction SilentlyContinue
            $cmakePath = if ($cmakeExe) { $cmakeExe.Source } else { "PATH" }
            Write-Host "  [OK] CMake $($matches[0])" -ForegroundColor Green
            $cmakeFound = $true
        }
    }
} catch {
    # Not in PATH, check common installation locations
    $cmakePaths = @(
        "${env:ProgramFiles}\CMake\bin\cmake.exe",
        "${env:ProgramFiles(x86)}\CMake\bin\cmake.exe",
        "$env:LOCALAPPDATA\Programs\CMake\bin\cmake.exe",
        "${env:ProgramFiles}\Git\usr\bin\cmake.exe"  # Sometimes bundled with Git
    )
    
    foreach ($path in $cmakePaths) {
        if (Test-Path $path) {
            try {
                $cmakeVersion = & $path --version 2>&1 | Select-Object -First 1
                if ($cmakeVersion -match "version (\d+)\.(\d+)") {
                    $major = [int]$matches[1]
                    $minor = [int]$matches[2]
                    if ($major -gt 3 -or ($major -eq 3 -and $minor -ge 12)) {
                        Write-Host "  [OK] CMake $($matches[0]) found at: $path" -ForegroundColor Green
                        Write-Host "    Adding to PATH for this session..." -ForegroundColor Yellow
                        $env:Path = "$(Split-Path $path -Parent);$env:Path"
                        $cmakePath = $path
                        $cmakeFound = $true
                        break
                    }
                }
            } catch {
                continue
            }
        }
    }
    
    if (-not $cmakeFound) {
        Write-Host "  [X] CMake not found in PATH or common locations" -ForegroundColor Red
    }
}

if (-not $cmakeFound) {
    Write-Host ""
    Write-Host "===========================================================" -ForegroundColor Red
    Write-Host "CMake is required but not found!" -ForegroundColor Red
    Write-Host "===========================================================" -ForegroundColor Red
    Write-Host ""
    Write-Host "Installation Options:" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Option 1: Download Installer (Recommended)" -ForegroundColor Cyan
    Write-Host "   Download from: https://cmake.org/download/" -ForegroundColor White
    Write-Host "   Choose 'Windows x64 Installer'" -ForegroundColor White
    Write-Host "   During installation, check 'Add CMake to system PATH'" -ForegroundColor White
    Write-Host ""
    Write-Host "Option 2: Chocolatey Package Manager" -ForegroundColor Cyan
    Write-Host "   Install Chocolatey: https://chocolatey.org/install" -ForegroundColor White
    Write-Host "   Run: choco install cmake" -ForegroundColor White
    Write-Host ""
    Write-Host "Option 3: Winget (Windows 10/11)" -ForegroundColor Cyan
    Write-Host "   Run: winget install Kitware.CMake" -ForegroundColor White
    Write-Host ""
    Write-Host "After installing, restart PowerShell and run this script again." -ForegroundColor Yellow
    Write-Host ""
    
    # Check if Chocolatey is available
    $chocoAvailable = $false
    try {
        $chocoVersion = & choco --version 2>&1
        if ($chocoVersion -and -not ($chocoVersion -match "Error|not found")) {
            $chocoAvailable = $true
            Write-Host "Chocolatey detected! Quick install:" -ForegroundColor Green
            Write-Host "   choco install cmake -y" -ForegroundColor White
            Write-Host ""
            $install = Read-Host "Install CMake now with Chocolatey? (y/n)"
            if ($install -eq "y") {
                Write-Host "Installing CMake via Chocolatey..." -ForegroundColor Cyan
                Write-Host ""
                
                # Check for lock file issues first
                $chocoLibPath = "C:\ProgramData\chocolatey\lib"
                $needsAdmin = $false
                
                if (Test-Path $chocoLibPath) {
                    # Check for the specific lock file mentioned in errors
                    $specificLock = Join-Path $chocoLibPath "bab3e163869a2839d0104093a75ea4486bf0b239"
                    if (Test-Path $specificLock) {
                        Write-Host "[!] Lock file detected: bab3e163869a2839d0104093a75ea4486bf0b239" -ForegroundColor Yellow
                        Write-Host "  Attempting cleanup..." -ForegroundColor Cyan
                        try {
                            Remove-Item $specificLock -Recurse -Force -ErrorAction Stop
                            Write-Host "[OK] Lock file removed successfully" -ForegroundColor Green
                            Start-Sleep -Seconds 1
                        } catch {
                            Write-Host "[X] Could not remove lock file (may need Administrator privileges)" -ForegroundColor Red
                            $needsAdmin = $true
                        }
                    }
                    
                    # Also check for other stale lock files (32-char hex directories older than 10 min)
                    $lockFiles = Get-ChildItem -Path $chocoLibPath -Directory -ErrorAction SilentlyContinue | 
                        Where-Object { 
                            $_.Name -match '^[a-f0-9]{32}$' -and 
                            $_.Name -ne "bab3e163869a2839d0104093a75ea4486bf0b239" -and
                            $_.LastWriteTime -lt (Get-Date).AddMinutes(-10) 
                        }
                    
                    if ($lockFiles) {
                        Write-Host "[!] Additional stale lock files detected. Attempting cleanup..." -ForegroundColor Yellow
                        $cleaned = 0
                        foreach ($lockDir in $lockFiles) {
                            try {
                                Remove-Item $lockDir.FullName -Recurse -Force -ErrorAction Stop
                                $cleaned++
                            } catch {
                                # Skip files that can't be removed
                            }
                        }
                        if ($cleaned -gt 0) {
                            Write-Host "[OK] Removed $cleaned additional stale lock file(s)" -ForegroundColor Green
                            Start-Sleep -Seconds 1
                        }
                    }
                    
                    if ($needsAdmin) {
                        Write-Host ""
                        Write-Host "[!] Administrator privileges may be required" -ForegroundColor Yellow
                        Write-Host "  Try running this script as Administrator, or manually delete:" -ForegroundColor White
                        Write-Host "    $specificLock" -ForegroundColor White
                        Write-Host ""
                        $continue = Read-Host "Continue anyway? (y/n)"
                        if ($continue -ne "y") {
                            exit 1
                        }
                    }
                }
                
                try {
                    # Capture both stdout and stderr
                    $chocoAllOutput = & choco install cmake -y 2>&1
                    $chocoOutput = $chocoAllOutput | Out-String
                    
                    # Extract error messages
                    $errorMessages = $chocoAllOutput | Where-Object { 
                        $_ -is [System.Management.Automation.ErrorRecord] -or 
                        ($_ -is [string] -and ($_ -match "error|Error|ERROR|failed|Failed|FAILED"))
                    } | Out-String
                    
                    # Check for success - either exit code 0 or success message, but NOT if lock file error persists
                    $hasLockError = ($chocoOutput -match "Unable to obtain lock file") -or ($errorMessages -match "Unable to obtain lock file")
                    $installedPackages = ($chocoOutput -match "Chocolatey installed (\d+)/(\d+) packages")
                    $packageCount = if ($installedPackages) { [int]($matches[1]) } else { 0 }
                    $chocoSuccess = -not $hasLockError -and ($LASTEXITCODE -eq 0 -or ($chocoOutput -match "The install of cmake.*was successful") -or ($packageCount -gt 0))
                    
                    if ($chocoSuccess) {
                        Write-Host "[OK] CMake installed successfully!" -ForegroundColor Green
                        Write-Host "Refreshing environment..." -ForegroundColor Cyan
                        
                        # Safely refresh PATH
                        try {
                            $machinePath = $null
                            $userPath = $null
                            
                            # Safely get environment variables with error handling
                            try {
                                $machinePath = [System.Environment]::GetEnvironmentVariable("Path", "Machine")
                            } catch {
                                # Ignore if can't access machine path (common if not admin)
                            }
                            
                            try {
                                $userPath = [System.Environment]::GetEnvironmentVariable("Path", "User")
                            } catch {
                                # Ignore if can't access user path
                            }
                            
                            # Build new PATH safely
                            $pathParts = @()
                            if (-not [string]::IsNullOrWhiteSpace($machinePath)) {
                                $pathParts += $machinePath
                            }
                            if (-not [string]::IsNullOrWhiteSpace($userPath)) {
                                $pathParts += $userPath
                            }
                            
                            if ($pathParts.Count -gt 0) {
                                $newPath = $pathParts -join ";"
                                if (-not [string]::IsNullOrWhiteSpace($newPath)) {
                                    $env:Path = $newPath
                                    Write-Host "[OK] Environment refreshed" -ForegroundColor Green
                                } else {
                                    Write-Host "[!] PATH refresh skipped (empty values)" -ForegroundColor Yellow
                                }
                            } else {
                                Write-Host "[!] Could not refresh PATH (no accessible paths)" -ForegroundColor Yellow
                            }
                        } catch {
                            Write-Host "[!] Could not refresh PATH automatically: $_" -ForegroundColor Yellow
                            Write-Host "  PATH will be updated after restart" -ForegroundColor Yellow
                        }
                        
                        # Try to find CMake in common locations after install
                        Start-Sleep -Seconds 2
                        $cmakePaths = @(
                            "${env:ProgramFiles}\CMake\bin\cmake.exe",
                            "${env:ProgramFiles(x86)}\CMake\bin\cmake.exe",
                            "$env:LOCALAPPDATA\Programs\CMake\bin\cmake.exe"
                        )
                        
                        foreach ($path in $cmakePaths) {
                            if (Test-Path $path) {
                                $env:Path = "$(Split-Path $path -Parent);$env:Path"
                                Write-Host "[OK] CMake added to PATH: $path" -ForegroundColor Green
                                Write-Host ""
                                Write-Host "You can continue now, or restart PowerShell for full PATH update." -ForegroundColor Yellow
                                $cmakeFound = $true
                                break
                            }
                        }
                        
                        if (-not $cmakeFound) {
                            Write-Host ""
                            Write-Host "Please restart PowerShell and run this script again." -ForegroundColor Yellow
                            Write-Host "Or run in a new PowerShell window." -ForegroundColor Yellow
                            exit 1
                        } else {
                            # CMake found, continue with script
                            Write-Host ""
                            Write-Host "Continuing with face tracker setup..." -ForegroundColor Green
                        }
                    } else {
                        Write-Host ""
                        Write-Host "[X] Chocolatey installation failed" -ForegroundColor Red
                        
                        if ($hasLockError) {
                            Write-Host ""
                            Write-Host "Lock file error detected!" -ForegroundColor Red
                            Write-Host ""
                            Write-Host "Solution:" -ForegroundColor Yellow
                            Write-Host "  1. Close any running Chocolatey processes" -ForegroundColor White
                            Write-Host "  2. Run PowerShell as Administrator" -ForegroundColor White
                            Write-Host "  3. Manually delete: C:\ProgramData\chocolatey\lib\bab3e163869a2839d0104093a75ea4486bf0b239" -ForegroundColor White
                            Write-Host "  4. Or run: choco install cmake -y (as Administrator)" -ForegroundColor White
                        } else {
                            Write-Host ""
                            Write-Host "Common issues:" -ForegroundColor Yellow
                            Write-Host "   Network issues (check internet connection)" -ForegroundColor White
                            Write-Host "   Permissions (run PowerShell as Administrator)" -ForegroundColor White
                            Write-Host ""
                            Write-Host "Try manually:" -ForegroundColor Cyan
                            Write-Host "  1. Run PowerShell as Administrator" -ForegroundColor White
                            Write-Host "  2. Run: choco install cmake -y" -ForegroundColor White
                        }
                        Write-Host ""
                        Write-Host "Or use Option 1 (direct download) from above." -ForegroundColor Yellow
                    }
                } catch {
                    Write-Host "[X] Installation error: $_" -ForegroundColor Red
                    Write-Host "Please install manually using one of the options above." -ForegroundColor Yellow
                }
            }
        }
    } catch {
        # Chocolatey not available
    }
    
    # Only exit if CMake is still not found after installation attempts
    if (-not $cmakeFound) {
        exit 1
    }
}

# Check for C++ compiler (Visual Studio)
$compilerFound = $false
$vsVersion = $null

# Try to find MSBuild/Visual Studio
$vsPaths = @(
    "${env:ProgramFiles}\Microsoft Visual Studio\2022\Community\MSBuild\Current\Bin\MSBuild.exe",
    "${env:ProgramFiles}\Microsoft Visual Studio\2022\Professional\MSBuild\Current\Bin\MSBuild.exe",
    "${env:ProgramFiles}\Microsoft Visual Studio\2022\Enterprise\MSBuild\Current\Bin\MSBuild.exe",
    "${env:ProgramFiles(x86)}\Microsoft Visual Studio\2019\Community\MSBuild\Current\Bin\MSBuild.exe",
    "${env:ProgramFiles(x86)}\Microsoft Visual Studio\2019\Professional\MSBuild\Current\Bin\MSBuild.exe",
    "${env:ProgramFiles(x86)}\Microsoft Visual Studio\2019\Enterprise\MSBuild\Current\Bin\MSBuild.exe"
)

foreach ($msbuildPath in $vsPaths) {
    if (Test-Path $msbuildPath) {
        $compilerFound = $true
        Write-Host "  [OK] Visual Studio Build Tools found" -ForegroundColor Green
        break
    }
}

if (-not $compilerFound) {
    # Try to find cl.exe directly
    try {
        $clVersion = & cl 2>&1 | Select-Object -First 1
        if ($clVersion -match "Microsoft") {
            $compilerFound = $true
            Write-Host "  [OK] C++ compiler (cl.exe) found" -ForegroundColor Green
        }
    } catch {
        # Compiler not in PATH
    }
}

if (-not $compilerFound) {
    Write-Host "  [X] C++ compiler not found" -ForegroundColor Red
    Write-Host ""
    Write-Host "Visual Studio Build Tools required!" -ForegroundColor Red
    Write-Host "Install from: https://visualstudio.microsoft.com/downloads/" -ForegroundColor Yellow
    Write-Host "  Select 'Desktop development with C++' workload" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Or install Build Tools only:" -ForegroundColor Yellow
    Write-Host "  https://aka.ms/vs/17/release/vs_buildtools.exe" -ForegroundColor Yellow
    exit 1
}

# Check for OpenCV
$opencvFound = $false
$opencvPath = $null

# Check common OpenCV installation paths
# OpenCV can be in root, build, or share directories
$opencvSearchPaths = @(
    # Manual install locations (check root and build subdirectory)
    "${env:ProgramFiles}\opencv",
    "${env:ProgramFiles}\opencv\build",
    "${env:ProgramFiles(x86)}\opencv",
    "${env:ProgramFiles(x86)}\opencv\build",
    "C:\opencv",
    "C:\opencv\build",
    "$env:USERPROFILE\opencv",
    "$env:USERPROFILE\opencv\build",
    # Check environment variable
    $env:OPENCV_DIR,
    # vcpkg locations
    "${env:ProgramFiles}\vcpkg\installed\x64-windows\share\opencv",
    "${env:ProgramFiles}\vcpkg\installed\x86-windows\share\opencv",
    # Chocolatey install location
    "${env:ProgramFiles}\opencv-*\build",
    "${env:ProgramFiles(x86)}\opencv-*\build"
)

# Also check vcpkg path from environment
if ($env:VCPKG_ROOT) {
    $opencvSearchPaths += @(
        "$env:VCPKG_ROOT\installed\x64-windows\share\opencv",
        "$env:VCPKG_ROOT\installed\x86-windows\share\opencv",
        "$env:VCPKG_ROOT\installed\x64-windows-static\share\opencv",
        "$env:VCPKG_ROOT\installed\x86-windows-static\share\opencv"
    )
}

# Search for OpenCVConfig.cmake or opencv-config.cmake
foreach ($path in $opencvSearchPaths) {
    if ($null -eq $path) { continue }
    
    # Handle wildcard paths
    if ($path -match '\*') {
        $resolvedPaths = Get-ChildItem -Path (Split-Path $path -Parent) -Directory -ErrorAction SilentlyContinue |
            Where-Object { $_.Name -match (Split-Path $path -Leaf).Replace('*', '.*') } |
            Select-Object -ExpandProperty FullName
        
        foreach ($resolvedPath in $resolvedPaths) {
            if (Test-Path "$resolvedPath\OpenCVConfig.cmake") {
                $opencvPath = $resolvedPath
                $opencvFound = $true
                Write-Host "  [OK] OpenCV found at: $resolvedPath" -ForegroundColor Green
                break
            } elseif (Test-Path "$resolvedPath\opencv-config.cmake") {
                $opencvPath = $resolvedPath
                $opencvFound = $true
                Write-Host "  [OK] OpenCV found at: $resolvedPath" -ForegroundColor Green
                break
            }
        }
    } else {
        if (Test-Path "$path\OpenCVConfig.cmake") {
            $opencvPath = $path
            $opencvFound = $true
            Write-Host "  [OK] OpenCV found at: $path" -ForegroundColor Green
            break
        } elseif (Test-Path "$path\opencv-config.cmake") {
            $opencvPath = $path
            $opencvFound = $true
            Write-Host "  [OK] OpenCV found at: $path" -ForegroundColor Green
            break
        }
    }
    
    if ($opencvFound) { break }
}

# If still not found, search recursively in common locations (but limit depth)
if (-not $opencvFound) {
    Write-Host "  Searching for OpenCV in common locations..." -ForegroundColor Yellow
    $searchRoots = @("${env:ProgramFiles}", "${env:ProgramFiles(x86)}", "C:\", $env:USERPROFILE)
    
    foreach ($root in $searchRoots) {
        if (-not (Test-Path $root)) { continue }
        try {
            # Search for OpenCVConfig.cmake with max depth of 3
            $foundConfigs = Get-ChildItem -Path $root -Filter "OpenCVConfig.cmake" -Recurse -Depth 3 -ErrorAction SilentlyContinue |
                Select-Object -First 1 -ExpandProperty DirectoryName
            
            if ($foundConfigs) {
                $opencvPath = $foundConfigs
                $opencvFound = $true
                Write-Host "  [OK] OpenCV found at: $foundConfigs" -ForegroundColor Green
                break
            }
        } catch {
            # Skip if search fails (permissions, etc.)
        }
    }
}

# Check if vcpkg is available and has OpenCV
if (-not $opencvFound) {
    try {
        if ($env:VCPKG_ROOT -or (Test-Path "$env:ProgramFiles\vcpkg")) {
            $vcpkgRoot = if ($env:VCPKG_ROOT) { $env:VCPKG_ROOT } else { "$env:ProgramFiles\vcpkg" }
            Write-Host "  [!] OpenCV not found, but vcpkg detected" -ForegroundColor Yellow
            Write-Host "     Install OpenCV with: vcpkg install opencv curl nlohmann-json" -ForegroundColor Yellow
            Write-Host "     Then set VCPKG_ROOT environment variable" -ForegroundColor Yellow
        }
    } catch {
        # vcpkg not found
    }
}

Write-Host ""

# Check if binary exists
$binaryPath = "build\bin\Release\face-tracker.exe"
$needsBuild = (-not (Test-Path $binaryPath)) -or $Build

if ($needsBuild) {
    Write-Host "Building face tracker..." -ForegroundColor Cyan
    
    if (-not $opencvFound) {
        Write-Host ""
        Write-Host "[!] OpenCV not found in standard locations!" -ForegroundColor Yellow
        Write-Host ""
        
        # Check for vcpkg and offer automatic installation
        $vcpkgFound = $false
        $vcpkgPath = $null
        $vcpkgExe = $null
        
        # Check if vcpkg is in PATH
        try {
            $vcpkgVersion = & vcpkg version 2>&1
            if ($vcpkgVersion -and -not ($vcpkgVersion -match "not found|error")) {
                $vcpkgFound = $true
                $vcpkgExe = "vcpkg"
                Write-Host "[OK] vcpkg found in PATH" -ForegroundColor Green
            }
        } catch {
            # Not in PATH
        }
        
        # Check common vcpkg locations
        if (-not $vcpkgFound) {
            $vcpkgLocations = @(
                $env:VCPKG_ROOT,
                "${env:ProgramFiles}\vcpkg",
                "${env:ProgramFiles(x86)}\vcpkg",
                "C:\vcpkg",
                "$env:USERPROFILE\vcpkg",
                "$env:USERPROFILE\vcpkg\vcpkg"
            )
            
            foreach ($location in $vcpkgLocations) {
                if ($null -eq $location) { continue }
                $vcpkgExePath = Join-Path $location "vcpkg.exe"
                if (Test-Path $vcpkgExePath) {
                    $vcpkgFound = $true
                    $vcpkgPath = $location
                    $vcpkgExe = $vcpkgExePath
                    Write-Host "[OK] vcpkg found at: $location" -ForegroundColor Green
                    break
                }
            }
        }
        
        # Offer automatic installation via vcpkg
        if ($vcpkgFound) {
            Write-Host ""
            Write-Host "vcpkg detected! Would you like to install OpenCV automatically?" -ForegroundColor Cyan
            Write-Host "This will install OpenCV, curl, and nlohmann-json (may take 10-30 minutes)" -ForegroundColor Yellow
            Write-Host ""
            $installOpenCV = Read-Host "Install OpenCV via vcpkg now? (y/n)"
            
            if ($installOpenCV -eq "y") {
                Write-Host ""
                Write-Host "Installing OpenCV via vcpkg..." -ForegroundColor Cyan
                Write-Host "This may take a while. Please be patient..." -ForegroundColor Yellow
                Write-Host ""
                
                try {
                    if ($vcpkgPath) {
                        Push-Location $vcpkgPath
                    }
                    
                    # Install OpenCV and dependencies
                    Write-Host "Running: vcpkg install opencv:x64-windows curl nlohmann-json" -ForegroundColor Cyan
                    & $vcpkgExe install opencv:x64-windows curl nlohmann-json
                    
                    if ($LASTEXITCODE -eq 0) {
                        Write-Host ""
                        Write-Host "[OK] OpenCV installed successfully!" -ForegroundColor Green
                        
                        # Set VCPKG_ROOT if not set
                        if (-not $env:VCPKG_ROOT -and $vcpkgPath) {
                            Write-Host "Setting VCPKG_ROOT environment variable..." -ForegroundColor Cyan
                            try {
                                [System.Environment]::SetEnvironmentVariable("VCPKG_ROOT", $vcpkgPath, "User")
                                $env:VCPKG_ROOT = $vcpkgPath
                                Write-Host "[OK] VCPKG_ROOT set to: $vcpkgPath" -ForegroundColor Green
                            } catch {
                                Write-Host "[!] Could not set VCPKG_ROOT automatically" -ForegroundColor Yellow
                                Write-Host "    Please set it manually: [Environment]::SetEnvironmentVariable('VCPKG_ROOT', '$vcpkgPath', 'User')" -ForegroundColor White
                            }
                        }
                        
                        # Run vcpkg integrate install
                        Write-Host ""
                        Write-Host "Running vcpkg integrate install..." -ForegroundColor Cyan
                        & $vcpkgExe integrate install
                        
                        # Refresh OpenCV search
                        Write-Host ""
                        Write-Host "Searching for installed OpenCV..." -ForegroundColor Cyan
                        if ($vcpkgPath) {
                            $opencvCheckPath = "$vcpkgPath\installed\x64-windows\share\opencv"
                        } elseif ($env:VCPKG_ROOT) {
                            $opencvCheckPath = "$env:VCPKG_ROOT\installed\x64-windows\share\opencv"
                        } else {
                            $opencvCheckPath = "${env:ProgramFiles}\vcpkg\installed\x64-windows\share\opencv"
                        }
                        
                        if (Test-Path "$opencvCheckPath\OpenCVConfig.cmake") {
                            $opencvPath = $opencvCheckPath
                            $opencvFound = $true
                            Write-Host "[OK] OpenCV found at: $opencvCheckPath" -ForegroundColor Green
                        } else {
                            Write-Host "[!] OpenCV installed but not found in expected location" -ForegroundColor Yellow
                            Write-Host "    Searching..." -ForegroundColor Yellow
                            # Re-run the search logic
                            $opencvSearchPaths = @(
                                "$vcpkgPath\installed\x64-windows\share\opencv",
                                "$vcpkgPath\installed\x86-windows\share\opencv"
                            )
                            foreach ($path in $opencvSearchPaths) {
                                if (Test-Path "$path\OpenCVConfig.cmake") {
                                    $opencvPath = $path
                                    $opencvFound = $true
                                    Write-Host "[OK] OpenCV found at: $path" -ForegroundColor Green
                                    break
                                }
                            }
                        }
                        
                        if ($vcpkgPath) {
                            Pop-Location
                        }
                        
                        if ($opencvFound) {
                            Write-Host ""
                            Write-Host "[OK] OpenCV setup complete! Continuing with build..." -ForegroundColor Green
                            Write-Host ""
                        }
                    } else {
                        Write-Host ""
                        Write-Host "[X] OpenCV installation failed!" -ForegroundColor Red
                        Write-Host "    Exit code: $LASTEXITCODE" -ForegroundColor Yellow
                        if ($vcpkgPath) {
                            Pop-Location
                        }
                        $continue = Read-Host "Continue build attempt anyway? (y/n)"
                        if ($continue -ne "y") {
                            exit 1
                        }
                    }
                } catch {
                    Write-Host ""
                    Write-Host "[X] Installation error: $_" -ForegroundColor Red
                    if ($vcpkgPath) {
                        Pop-Location
                    }
                    $continue = Read-Host "Continue build attempt anyway? (y/n)"
                    if ($continue -ne "y") {
                        exit 1
                    }
                }
            } else {
                Write-Host ""
                Write-Host "Installation skipped. Manual installation required:" -ForegroundColor Yellow
                Write-Host "  1. Run: vcpkg install opencv:x64-windows curl nlohmann-json" -ForegroundColor White
                Write-Host "  2. Run: vcpkg integrate install" -ForegroundColor White
                Write-Host ""
                $continue = Read-Host "Continue build attempt anyway? (y/n)"
                if ($continue -ne "y") {
                    exit 1
                }
            }
        } else {
            # No vcpkg found - offer to install automatically
            Write-Host "No vcpkg installation found." -ForegroundColor Yellow
            Write-Host ""
            Write-Host "Would you like to install vcpkg and OpenCV automatically?" -ForegroundColor Cyan
            Write-Host "This will:" -ForegroundColor Yellow
            Write-Host "  1. Clone vcpkg from GitHub to C:\vcpkg" -ForegroundColor White
            Write-Host "  2. Bootstrap vcpkg" -ForegroundColor White
            Write-Host "  3. Install OpenCV, curl, and nlohmann-json (may take 10-30 minutes)" -ForegroundColor White
            Write-Host "  4. Set VCPKG_ROOT environment variable" -ForegroundColor White
            Write-Host "  5. Run vcpkg integrate install" -ForegroundColor White
            Write-Host ""
            Write-Host "Note: Requires Git and may take 10-30 minutes for OpenCV installation." -ForegroundColor Yellow
            Write-Host ""
            $installVcpkg = Read-Host "Install vcpkg and OpenCV automatically? (y/n)"
            
            if ($installVcpkg -eq "y") {
                Write-Host ""
                Write-Host "Installing vcpkg and OpenCV..." -ForegroundColor Cyan
                Write-Host "This may take a while. Please be patient..." -ForegroundColor Yellow
                Write-Host ""
                
                $vcpkgInstallPath = "C:\vcpkg"
                $needsGit = $false
                
                # Check if Git is available
                try {
                    $gitVersion = & git --version 2>&1
                    if (-not $gitVersion -or $gitVersion -match "not found|error") {
                        $needsGit = $true
                    }
                } catch {
                    $needsGit = $true
                }
                
                if ($needsGit) {
                    Write-Host "[!] Git is required but not found!" -ForegroundColor Red
                    Write-Host ""
                    Write-Host "Please install Git from: https://git-scm.com/download/win" -ForegroundColor Yellow
                    Write-Host "Or install via Chocolatey: choco install git -y" -ForegroundColor Yellow
                    Write-Host ""
                    $continue = Read-Host "Continue build attempt anyway? (y/n)"
                    if ($continue -ne "y") {
                        exit 1
                    }
                    # Skip vcpkg installation if no Git
                } else {
                    try {
                        # Step 1: Clone vcpkg if it doesn't exist
                        if (-not (Test-Path $vcpkgInstallPath)) {
                            Write-Host "Step 1/5: Cloning vcpkg from GitHub..." -ForegroundColor Cyan
                            Write-Host "  This may take a few minutes..." -ForegroundColor Yellow
                            & git clone https://github.com/microsoft/vcpkg.git $vcpkgInstallPath
                            if ($LASTEXITCODE -ne 0) {
                                throw "Failed to clone vcpkg (exit code: $LASTEXITCODE)"
                            }
                            Write-Host "[OK] vcpkg cloned successfully" -ForegroundColor Green
                        } else {
                            Write-Host "Step 1/5: vcpkg already exists at $vcpkgInstallPath" -ForegroundColor Green
                        }
                        
                        # Step 2: Bootstrap vcpkg
                        Write-Host ""
                        Write-Host "Step 2/5: Bootstrapping vcpkg..." -ForegroundColor Cyan
                        $bootstrapScript = Join-Path $vcpkgInstallPath "bootstrap-vcpkg.bat"
                        if (-not (Test-Path $bootstrapScript)) {
                            throw "bootstrap-vcpkg.bat not found at $vcpkgInstallPath"
                        }
                        
                        Push-Location $vcpkgInstallPath
                        & cmd /c bootstrap-vcpkg.bat
                        if ($LASTEXITCODE -ne 0) {
                            throw "Failed to bootstrap vcpkg (exit code: $LASTEXITCODE)"
                        }
                        Write-Host "[OK] vcpkg bootstrapped successfully" -ForegroundColor Green
                        
                        # Step 3: Set VCPKG_ROOT environment variable
                        Write-Host ""
                        Write-Host "Step 3/5: Setting VCPKG_ROOT environment variable..." -ForegroundColor Cyan
                        try {
                            [System.Environment]::SetEnvironmentVariable("VCPKG_ROOT", $vcpkgInstallPath, "User")
                            $env:VCPKG_ROOT = $vcpkgInstallPath
                            Write-Host "[OK] VCPKG_ROOT set to: $vcpkgInstallPath" -ForegroundColor Green
                        } catch {
                            Write-Host "[!] Could not set VCPKG_ROOT automatically: $_" -ForegroundColor Yellow
                            Write-Host "    Please set it manually: [Environment]::SetEnvironmentVariable('VCPKG_ROOT', '$vcpkgInstallPath', 'User')" -ForegroundColor White
                        }
                        
                        # Step 4: Install OpenCV and dependencies
                        Write-Host ""
                        Write-Host "Step 4/5: Installing OpenCV and dependencies..." -ForegroundColor Cyan
                        Write-Host "  This may take 10-30 minutes. Please be patient..." -ForegroundColor Yellow
                        Write-Host "  Running: vcpkg install opencv:x64-windows curl nlohmann-json" -ForegroundColor Gray
                        
                        $vcpkgExe = Join-Path $vcpkgInstallPath "vcpkg.exe"
                        & $vcpkgExe install opencv:x64-windows curl nlohmann-json
                        
                        if ($LASTEXITCODE -ne 0) {
                            Write-Host ""
                            Write-Host "[X] OpenCV installation failed!" -ForegroundColor Red
                            Write-Host "    Exit code: $LASTEXITCODE" -ForegroundColor Yellow
                            Pop-Location
                            $continue = Read-Host "Continue build attempt anyway? (y/n)"
                            if ($continue -ne "y") {
                                exit 1
                            }
                        } else {
                            Write-Host "[OK] OpenCV and dependencies installed successfully!" -ForegroundColor Green
                        }
                        
                        # Step 5: Run vcpkg integrate install
                        Write-Host ""
                        Write-Host "Step 5/5: Running vcpkg integrate install..." -ForegroundColor Cyan
                        & $vcpkgExe integrate install
                        if ($LASTEXITCODE -eq 0) {
                            Write-Host "[OK] vcpkg integration complete" -ForegroundColor Green
                        } else {
                            Write-Host "[!] vcpkg integrate failed (exit code: $LASTEXITCODE)" -ForegroundColor Yellow
                            Write-Host "    This is non-critical, but you may need to set CMAKE_TOOLCHAIN_FILE manually" -ForegroundColor Yellow
                        }
                        
                        # Verify OpenCV installation via vcpkg list
                        Write-Host ""
                        Write-Host "Verifying OpenCV installation..." -ForegroundColor Cyan
                        $detectedTriplet = $null
                        try {
                            $vcpkgList = & $vcpkgExe list 2>&1 | Out-String
                            if ($vcpkgList -match "opencv") {
                                Write-Host "[OK] OpenCV is listed in vcpkg packages" -ForegroundColor Green
                                Write-Host "    Installed packages:" -ForegroundColor Gray
                                $opencvLines = $vcpkgList -split "`n" | Where-Object { $_ -match "opencv" }
                                foreach ($line in $opencvLines) {
                                    Write-Host "      $line" -ForegroundColor Gray
                                    # Extract triplet from line like "opencv:x64-windows@4.11.0"
                                    if ($line -match "opencv:([^@]+)") {
                                        $detectedTriplet = $matches[1]
                                        Write-Host "    Detected triplet: $detectedTriplet" -ForegroundColor Green
                                    }
                                }
                            } else {
                                Write-Host "[!] OpenCV not found in vcpkg list - installation may have failed" -ForegroundColor Yellow
                                Write-Host "    Full vcpkg list output:" -ForegroundColor Gray
                                Write-Host $vcpkgList -ForegroundColor Gray
                            }
                        } catch {
                            Write-Host "[!] Could not verify via vcpkg list: $_" -ForegroundColor Yellow
                        }
                        
                        # Search for installed OpenCV more thoroughly
                        Write-Host ""
                        Write-Host "Searching for installed OpenCV..." -ForegroundColor Cyan
                        
                        # Search in all possible vcpkg installation locations
                        $vcpkgTriplets = @("x64-windows", "x86-windows", "x64-windows-static", "x86-windows-static")
                        $searchPaths = @()
                        
                        foreach ($triplet in $vcpkgTriplets) {
                            $searchPaths += "$vcpkgInstallPath\installed\$triplet\share\opencv"
                            $searchPaths += "$vcpkgInstallPath\installed\$triplet"
                        }
                        
                        # Also search recursively in installed directory
                        $installedDir = Join-Path $vcpkgInstallPath "installed"
                        if (Test-Path $installedDir) {
                            Write-Host "    Checking installed directory: $installedDir" -ForegroundColor Gray
                            try {
                                $foundConfigs = Get-ChildItem -Path $installedDir -Filter "OpenCVConfig.cmake" -Recurse -ErrorAction SilentlyContinue |
                                    Select-Object -First 1 -ExpandProperty DirectoryName
                                if ($foundConfigs) {
                                    Write-Host "    Found via recursive search: $foundConfigs" -ForegroundColor Gray
                                    $searchPaths = @($foundConfigs) + $searchPaths
                                }
                            } catch {
                                Write-Host "    Recursive search failed: $_" -ForegroundColor Gray
                            }
                        } else {
                            Write-Host "    [!] Installed directory not found: $installedDir" -ForegroundColor Yellow
                        }
                        
                        # Try each path
                        Write-Host "    Checking $($searchPaths.Count) possible locations..." -ForegroundColor Gray
                        foreach ($checkPath in $searchPaths) {
                            if ($null -eq $checkPath) { continue }
                            if (Test-Path "$checkPath\OpenCVConfig.cmake") {
                                $opencvPath = $checkPath
                                $opencvFound = $true
                                Write-Host "[OK] OpenCV found at: $checkPath" -ForegroundColor Green
                                break
                            } elseif (Test-Path "$checkPath\opencv-config.cmake") {
                                $opencvPath = $checkPath
                                $opencvFound = $true
                                Write-Host "[OK] OpenCV found at: $checkPath" -ForegroundColor Green
                                break
                            }
                        }
                        
                        # List what's actually in the installed directory for debugging
                        if (-not $opencvFound) {
                            Write-Host ""
                            Write-Host "    Debugging: Checking installed directory structure..." -ForegroundColor Yellow
                            if (Test-Path $installedDir) {
                                $tripletDirs = Get-ChildItem -Path $installedDir -Directory -ErrorAction SilentlyContinue
                                if ($tripletDirs) {
                                    Write-Host "    Found triplets:" -ForegroundColor Gray
                                    foreach ($tripletDir in $tripletDirs) {
                                        Write-Host "      - $($tripletDir.Name)" -ForegroundColor Gray
                                        $shareDir = Join-Path $tripletDir.FullName "share"
                                        if (Test-Path $shareDir) {
                                            $sharePackages = Get-ChildItem -Path $shareDir -Directory -ErrorAction SilentlyContinue
                                            if ($sharePackages) {
                                                Write-Host "        Share packages:" -ForegroundColor Gray
                                                foreach ($pkg in $sharePackages) {
                                                    Write-Host "          - $($pkg.Name)" -ForegroundColor Gray
                                                }
                                            }
                                        }
                                    }
                                } else {
                                    Write-Host "    [!] No triplet directories found in $installedDir" -ForegroundColor Yellow
                                }
                            }
                        }
                        
                        Pop-Location
                        
                        # Always try to find and set vcpkg toolchain file (even if OpenCV not found)
                        $toolchainPath = "$vcpkgInstallPath\scripts\buildsystems\vcpkg.cmake"
                        if (Test-Path $toolchainPath) {
                            $script:VCPKG_TOOLCHAIN_FILE = $toolchainPath
                            Write-Host "[OK] Found vcpkg toolchain file: $toolchainPath" -ForegroundColor Green
                            Write-Host "    CMake will use vcpkg to find OpenCV automatically" -ForegroundColor Green
                        }
                        
                        if ($opencvFound) {
                            Write-Host ""
                            Write-Host "[OK] vcpkg and OpenCV setup complete! Continuing with build..." -ForegroundColor Green
                            Write-Host ""
                        } else {
                            Write-Host ""
                            if ($script:VCPKG_TOOLCHAIN_FILE) {
                                Write-Host "[OK] OpenCV installed via vcpkg" -ForegroundColor Green
                                Write-Host "    CMake will find it automatically using toolchain file" -ForegroundColor Green
                            } else {
                                Write-Host "[!] OpenCV installed but could not be found automatically" -ForegroundColor Yellow
                                Write-Host "    Trying to use vcpkg toolchain file..." -ForegroundColor Yellow
                                
                                # Try alternative toolchain locations
                                $altToolchainPaths = @(
                                    "$vcpkgInstallPath\scripts\buildsystems\vcpkg.cmake",
                                    "${env:ProgramFiles}\vcpkg\scripts\buildsystems\vcpkg.cmake",
                                    "${env:ProgramFiles(x86)}\vcpkg\scripts\buildsystems\vcpkg.cmake"
                                )
                                foreach ($altPath in $altToolchainPaths) {
                                    if (Test-Path $altPath) {
                                        $script:VCPKG_TOOLCHAIN_FILE = $altPath
                                        Write-Host "[OK] Found vcpkg toolchain file: $altPath" -ForegroundColor Green
                                        break
                                    }
                                }
                            }
                            Write-Host ""
                        }
                    } catch {
                        Write-Host ""
                        Write-Host "[X] vcpkg installation error: $_" -ForegroundColor Red
                        if ((Get-Location).Path -ne $scriptDir) {
                            Pop-Location
                        }
                        $continue = Read-Host "Continue build attempt anyway? (y/n)"
                        if ($continue -ne "y") {
                            exit 1
                        }
                    }
                }
            } else {
                # User declined automatic installation
                Write-Host ""
                Write-Host "Installation skipped. Manual installation required:" -ForegroundColor Yellow
                Write-Host ""
                Write-Host "Option 1: Install vcpkg and OpenCV manually" -ForegroundColor Cyan
                Write-Host "  1. Clone vcpkg: cd C:\; git clone https://github.com/microsoft/vcpkg.git" -ForegroundColor White
                Write-Host "  2. Bootstrap: cd vcpkg; .\bootstrap-vcpkg.bat" -ForegroundColor White
                Write-Host "  3. Install: .\vcpkg install opencv:x64-windows curl nlohmann-json" -ForegroundColor White
                Write-Host "  4. Set VCPKG_ROOT: [Environment]::SetEnvironmentVariable('VCPKG_ROOT', 'C:\vcpkg', 'User')" -ForegroundColor White
                Write-Host ""
                Write-Host "Option 2: Manual OpenCV download" -ForegroundColor Cyan
                Write-Host "  1. Download from: https://opencv.org/releases/" -ForegroundColor White
                Write-Host "  2. Extract to C:\opencv" -ForegroundColor White
                Write-Host "  3. Set OPENCV_DIR: [Environment]::SetEnvironmentVariable('OPENCV_DIR', 'C:\opencv\build', 'User')" -ForegroundColor White
                Write-Host ""
                $continue = Read-Host "Continue build attempt anyway? (y/n)"
                if ($continue -ne "y") {
                    exit 1
                }
            }
        }
    }
    
    # Create build directory
    if (-not (Test-Path "build")) {
        New-Item -ItemType Directory -Path "build" | Out-Null
    }
    
    Push-Location build
    
    # Clear CMakeCache.txt if OpenCV_DIR is NOTFOUND (forces fresh configuration)
    $cmakeCacheFile = "CMakeCache.txt"
    if (Test-Path $cmakeCacheFile) {
        $cacheContent = Get-Content $cmakeCacheFile -Raw
        if ($cacheContent -match "OpenCV_DIR:.*NOTFOUND") {
            Write-Host "  Clearing CMake cache (OpenCV_DIR was NOTFOUND)..." -ForegroundColor Yellow
            Remove-Item $cmakeCacheFile -Force -ErrorAction SilentlyContinue
            # Also remove CMakeFiles directory to force complete regeneration
            if (Test-Path "CMakeFiles") {
                Remove-Item "CMakeFiles" -Recurse -Force -ErrorAction SilentlyContinue
            }
        }
    }
    
    try {
        Write-Host "  Running CMake..." -ForegroundColor Cyan
        
        # Configure CMake with OpenCV path if found
        $cmakeArgs = @("..")
        
        # Use vcpkg toolchain file if available (best for vcpkg installations)
        # This MUST be set before OpenCV_DIR for vcpkg to work properly
        $toolchainUsed = $false
        
        if ($script:VCPKG_TOOLCHAIN_FILE -and (Test-Path $script:VCPKG_TOOLCHAIN_FILE)) {
            Write-Host "    Using vcpkg toolchain file: $script:VCPKG_TOOLCHAIN_FILE" -ForegroundColor Yellow
            $cmakeArgs += "-DCMAKE_TOOLCHAIN_FILE=$script:VCPKG_TOOLCHAIN_FILE"
            $toolchainUsed = $true
        } elseif ($env:VCPKG_ROOT -and (Test-Path "$env:VCPKG_ROOT\scripts\buildsystems\vcpkg.cmake")) {
            $toolchainFile = "$env:VCPKG_ROOT\scripts\buildsystems\vcpkg.cmake"
            Write-Host "    Using vcpkg toolchain file from VCPKG_ROOT: $toolchainFile" -ForegroundColor Yellow
            $cmakeArgs += "-DCMAKE_TOOLCHAIN_FILE=$toolchainFile"
            $toolchainUsed = $true
        } else {
            # Try to find vcpkg toolchain in common locations
            $toolchainSearchPaths = @(
                "C:\vcpkg\scripts\buildsystems\vcpkg.cmake",
                "${env:ProgramFiles}\vcpkg\scripts\buildsystems\vcpkg.cmake",
                "${env:ProgramFiles(x86)}\vcpkg\scripts\buildsystems\vcpkg.cmake"
            )
            foreach ($searchPath in $toolchainSearchPaths) {
                if (Test-Path $searchPath) {
                    Write-Host "    Using vcpkg toolchain file: $searchPath" -ForegroundColor Yellow
                    $cmakeArgs += "-DCMAKE_TOOLCHAIN_FILE=$searchPath"
                    $toolchainUsed = $true
                    break
                }
            }
        }
        
        if ($toolchainUsed) {
            Write-Host "    Note: Using vcpkg toolchain - CMake will find OpenCV automatically" -ForegroundColor Green
            
            # Set VCPKG_TARGET_TRIPLET if not set (helps vcpkg find packages)
            if (-not $env:VCPKG_TARGET_TRIPLET) {
                # Try to detect from VCPKG_ROOT installed directory
                if ($env:VCPKG_ROOT) {
                    $tripletDirs = Get-ChildItem -Path "$env:VCPKG_ROOT\installed" -Directory -ErrorAction SilentlyContinue |
                        Where-Object { $_.Name -match "x64-windows" } |
                        Select-Object -First 1 -ExpandProperty Name
                    if ($tripletDirs) {
                        $env:VCPKG_TARGET_TRIPLET = $tripletDirs
                        Write-Host "    Setting VCPKG_TARGET_TRIPLET=$tripletDirs" -ForegroundColor Yellow
                        $cmakeArgs += "-DVCPKG_TARGET_TRIPLET=$tripletDirs"
                    }
                } else {
                    # Default to x64-windows
                    $env:VCPKG_TARGET_TRIPLET = "x64-windows"
                    Write-Host "    Setting VCPKG_TARGET_TRIPLET=x64-windows (default)" -ForegroundColor Yellow
                    $cmakeArgs += "-DVCPKG_TARGET_TRIPLET=x64-windows"
                }
            }
        }
        
        # Set OpenCV_DIR if we found it explicitly (only if NOT using toolchain file)
        # If using toolchain file, vcpkg will find OpenCV automatically
        if (-not $toolchainUsed) {
            if ($opencvPath) {
                Write-Host "    Using OpenCV_DIR=$opencvPath" -ForegroundColor Yellow
                $cmakeArgs += "-DOpenCV_DIR=$opencvPath"
            } elseif ($env:OPENCV_DIR) {
                Write-Host "    Using OPENCV_DIR from environment: $env:OPENCV_DIR" -ForegroundColor Yellow
                $cmakeArgs += "-DOpenCV_DIR=$env:OPENCV_DIR"
            } elseif ($env:VCPKG_ROOT) {
                # Try to find OpenCV in vcpkg installation
                $vcpkgOpenCVPaths = @(
                    "$env:VCPKG_ROOT\installed\x64-windows\share\opencv",
                    "$env:VCPKG_ROOT\installed\x86-windows\share\opencv"
                )
                foreach ($vcvkgPath in $vcpkgOpenCVPaths) {
                    if (Test-Path "$vcvkgPath\OpenCVConfig.cmake") {
                        Write-Host "    Found OpenCV in vcpkg: $vcvkgPath" -ForegroundColor Yellow
                        $cmakeArgs += "-DOpenCV_DIR=$vcvkgPath"
                        break
                    }
                }
            } elseif (Test-Path "C:\vcpkg\installed\x64-windows\share\opencv\OpenCVConfig.cmake") {
                $defaultVcpkgPath = "C:\vcpkg\installed\x64-windows\share\opencv"
                Write-Host "    Found OpenCV in default vcpkg location: $defaultVcpkgPath" -ForegroundColor Yellow
                $cmakeArgs += "-DOpenCV_DIR=$defaultVcpkgPath"
            } else {
                Write-Host "    [!] Warning: No OpenCV_DIR set - CMake will search system paths" -ForegroundColor Yellow
            }
        } else {
            Write-Host "    Using vcpkg toolchain - OpenCV_DIR not needed (vcpkg will find it)" -ForegroundColor Green
            
            # Always try to find and set OpenCV_DIR explicitly as a fallback
            # This helps when vcpkg toolchain doesn't work perfectly
            $opencvDirSet = $false
            
            # First, check if we already found OpenCV
            if ($opencvPath) {
                Write-Host "    Also setting OpenCV_DIR=$opencvPath (fallback)" -ForegroundColor Yellow
                $cmakeArgs += "-DOpenCV_DIR=$opencvPath"
                $opencvDirSet = $true
            }
            
            # If not set, try to find it based on VCPKG_ROOT or vcpkg path
            if (-not $opencvDirSet) {
                $triplet = if ($env:VCPKG_TARGET_TRIPLET) { $env:VCPKG_TARGET_TRIPLET } else { "x64-windows" }
                $vcpkgRoots = @()
                
                # Check VCPKG_ROOT from environment
                if ($env:VCPKG_ROOT) {
                    $vcpkgRoots += $env:VCPKG_ROOT
                }
                
                # Check detected vcpkg path from script
                if ($vcpkgPath) {
                    $vcpkgRoots += $vcpkgPath
                }
                
                # Check default vcpkg location
                if (Test-Path "C:\vcpkg") {
                    $vcpkgRoots += "C:\vcpkg"
                }
                
                # Remove duplicates
                $vcpkgRoots = $vcpkgRoots | Select-Object -Unique
                
                # Try each vcpkg root
                foreach ($vcpkgRoot in $vcpkgRoots) {
                    $potentialOpenCVPath = "$vcpkgRoot\installed\$triplet\share\opencv"
                    if (Test-Path "$potentialOpenCVPath\OpenCVConfig.cmake") {
                        Write-Host "    Setting OpenCV_DIR=$potentialOpenCVPath (found in vcpkg)" -ForegroundColor Yellow
                        $cmakeArgs += "-DOpenCV_DIR=$potentialOpenCVPath"
                        $opencvDirSet = $true
                        break
                    }
                }
                
                # If still not found, try searching in common triplet locations
                if (-not $opencvDirSet) {
                    $tripletsToCheck = @("x64-windows", "x86-windows", "x64-windows-static", "x86-windows-static")
                    foreach ($checkTriplet in $tripletsToCheck) {
                        foreach ($vcpkgRoot in $vcpkgRoots) {
                            $potentialOpenCVPath = "$vcpkgRoot\installed\$checkTriplet\share\opencv"
                            if (Test-Path "$potentialOpenCVPath\OpenCVConfig.cmake") {
                                Write-Host "    Setting OpenCV_DIR=$potentialOpenCVPath (found in vcpkg, triplet: $checkTriplet)" -ForegroundColor Yellow
                                $cmakeArgs += "-DOpenCV_DIR=$potentialOpenCVPath"
                                $opencvDirSet = $true
                                break
                            }
                        }
                        if ($opencvDirSet) { break }
                    }
                }
            }
            
            if (-not $opencvDirSet) {
                Write-Host "    [!] Warning: Could not find OpenCV_DIR even with vcpkg toolchain" -ForegroundColor Yellow
                Write-Host "       CMake will try to find it automatically via toolchain" -ForegroundColor Yellow
            }
        }
        
        # Also set CMAKE_PREFIX_PATH if OpenCV path is known
        if ($opencvPath) {
            $cmakePrefixPath = Split-Path $opencvPath -Parent
            if ($cmakePrefixPath) {
                Write-Host "    Using CMAKE_PREFIX_PATH=$cmakePrefixPath" -ForegroundColor Yellow
                $cmakeArgs += "-DCMAKE_PREFIX_PATH=$cmakePrefixPath"
            }
        }
        
        Write-Host "    CMake command: cmake $($cmakeArgs -join ' ')" -ForegroundColor Gray
        & cmake @cmakeArgs 2>&1 | Tee-Object -Variable cmakeOutput
        
        $cmakeOutputStr = $cmakeOutput | Out-String
        
        # Check if CMake configuration actually succeeded (look for success messages)
        $configSuccess = ($cmakeOutputStr -match "Configuring done" -or $cmakeOutputStr -match "Generating done") -and $LASTEXITCODE -eq 0
        
        # Show warnings if any (but don't fail on warnings alone)
        if ($cmakeOutputStr -match "CMake Warning") {
            $warnings = ($cmakeOutputStr -split "`n" | Where-Object { $_ -match "CMake Warning" })
            if ($warnings) {
                Write-Host "" -ForegroundColor Yellow
                Write-Host "  [!] CMake warnings (non-fatal):" -ForegroundColor Yellow
                foreach ($warning in $warnings) {
                    Write-Host "      $warning" -ForegroundColor Yellow
                }
                Write-Host "" -ForegroundColor Yellow
            }
        }
        
        if (-not $configSuccess) {
            # Check if it's specifically an OpenCV error
            if ($cmakeOutputStr -match "Could not find.*OpenCV" -or $cmakeOutputStr -match "FindOpenCV\.cmake") {
                Write-Host "" -ForegroundColor Red
                Write-Host "  [X] OpenCV not found by CMake!" -ForegroundColor Red
                Write-Host ""
                Write-Host "  Debugging information:" -ForegroundColor Yellow
                if ($toolchainUsed) {
                    Write-Host "    - Using vcpkg toolchain file: $($cmakeArgs | Where-Object { $_ -match 'CMAKE_TOOLCHAIN_FILE' })" -ForegroundColor White
                    Write-Host "    - VCPKG_ROOT: $env:VCPKG_ROOT" -ForegroundColor White
                    Write-Host "    - VCPKG_TARGET_TRIPLET: $env:VCPKG_TARGET_TRIPLET" -ForegroundColor White
                    
                    # Check if OpenCV is actually installed
                    if ($env:VCPKG_ROOT) {
                        Write-Host ""
                        Write-Host "    Checking vcpkg installation..." -ForegroundColor Yellow
                        $vcpkgExe = if (Test-Path "$env:VCPKG_ROOT\vcpkg.exe") { "$env:VCPKG_ROOT\vcpkg.exe" } else { "vcpkg" }
                        try {
                            $listOutput = & $vcpkgExe list 2>&1 | Out-String
                            if ($listOutput -match "opencv") {
                                Write-Host "    [OK] OpenCV is installed in vcpkg" -ForegroundColor Green
                                $opencvLines = $listOutput -split "`n" | Where-Object { $_ -match "opencv" }
                                foreach ($line in $opencvLines) {
                                    Write-Host "      $line" -ForegroundColor Gray
                                }
                                
                                # Try to find the actual path
                                Write-Host ""
                                Write-Host "    Searching for OpenCVConfig.cmake..." -ForegroundColor Yellow
                                $triplet = if ($env:VCPKG_TARGET_TRIPLET) { $env:VCPKG_TARGET_TRIPLET } else { "x64-windows" }
                                $opencvSharePath = "$env:VCPKG_ROOT\installed\$triplet\share\opencv"
                                if (Test-Path "$opencvSharePath\OpenCVConfig.cmake") {
                                    Write-Host "    [OK] Found at: $opencvSharePath" -ForegroundColor Green
                                    Write-Host "    Try setting explicitly:" -ForegroundColor Yellow
                                    Write-Host "      -DOpenCV_DIR=$opencvSharePath" -ForegroundColor Cyan
                                } else {
                                    Write-Host "    [!] Not found at: $opencvSharePath" -ForegroundColor Yellow
                                }
                            } else {
                                Write-Host "    [!] OpenCV not found in vcpkg list - may need to reinstall" -ForegroundColor Yellow
                            }
                        } catch {
                            Write-Host "    [!] Could not check vcpkg: $_" -ForegroundColor Yellow
                        }
                    }
                }
                Write-Host ""
                Write-Host "  Solutions:" -ForegroundColor Yellow
                Write-Host "    1. Reinstall OpenCV via vcpkg:" -ForegroundColor White
                Write-Host "       vcpkg remove opencv" -ForegroundColor Cyan
                Write-Host "       vcpkg install opencv:x64-windows" -ForegroundColor Cyan
                Write-Host "" -ForegroundColor White
                Write-Host "    2. Or download OpenCV manually:" -ForegroundColor White
                Write-Host "       - Download from https://opencv.org/releases/" -ForegroundColor Cyan
                Write-Host "       - Extract to C:\opencv" -ForegroundColor Cyan
                Write-Host "       - Set environment variable: OPENCV_DIR=C:\opencv\build" -ForegroundColor Cyan
                Write-Host "" -ForegroundColor White
                Write-Host "    3. Or set OPENCV_DIR manually:" -ForegroundColor White
                if ($env:VCPKG_ROOT) {
                    $suggestedPath = "$env:VCPKG_ROOT\installed\x64-windows\share\opencv"
                    Write-Host "       -DOpenCV_DIR=$suggestedPath" -ForegroundColor Cyan
                } else {
                    Write-Host "       [Environment]::SetEnvironmentVariable('OPENCV_DIR', 'C:\path\to\opencv\build', 'User')" -ForegroundColor Cyan
                }
                Write-Host "" -ForegroundColor White
            }
            Write-Host "" -ForegroundColor Red
            Write-Host "  [X] CMake configuration failed!" -ForegroundColor Red
            Write-Host "      Exit code: $LASTEXITCODE" -ForegroundColor Yellow
            Write-Host "      Full CMake output:" -ForegroundColor Yellow
            Write-Host $cmakeOutputStr -ForegroundColor Gray
            throw "CMake configuration failed with exit code $LASTEXITCODE"
        }
        
        Write-Host "  [OK] CMake configuration successful!" -ForegroundColor Green
        Write-Host ""
        
        Write-Host "  Building..." -ForegroundColor Cyan
        $buildOutput = & cmake --build . --config Release 2>&1 | Tee-Object -Variable buildOutput
        
        if ($LASTEXITCODE -ne 0) {
            $buildOutputStr = $buildOutput | Out-String
            Write-Host "" -ForegroundColor Red
            Write-Host "  [X] Build failed!" -ForegroundColor Red
            Write-Host "      Exit code: $LASTEXITCODE" -ForegroundColor Yellow
            Write-Host "      Build output:" -ForegroundColor Yellow
            Write-Host $buildOutputStr -ForegroundColor Gray
            throw "Build failed with exit code $LASTEXITCODE"
        }
        
        Write-Host "  [OK] Build successful!" -ForegroundColor Green
    } catch {
        Write-Host "  [X] Build failed: $_" -ForegroundColor Red
        Write-Host ""
        Write-Host "Troubleshooting:" -ForegroundColor Yellow
        Write-Host "  1. Make sure OpenCV is installed and OPENCV_DIR is set" -ForegroundColor White
        Write-Host "  2. Try: cmake -DOpenCV_DIR=<path-to-opencv> .." -ForegroundColor White
        Write-Host "  3. Check build/CMakeCache.txt for errors" -ForegroundColor White
        Pop-Location
        exit 1
    } finally {
        Pop-Location
    }
} else {
    Write-Host "[OK] Binary already exists" -ForegroundColor Green
}

Write-Host ""

# Check for required model files
Write-Host "Checking model files..." -ForegroundColor Cyan

$cascadeFile = "haarcascade_frontalface_alt.xml"
$cascadeExists = Test-Path $cascadeFile

if (-not $cascadeExists) {
    Write-Host "  [!] Missing: $cascadeFile" -ForegroundColor Yellow
    Write-Host "     Downloading..." -ForegroundColor Cyan
    
    try {
        $cascadeUrl = "https://raw.githubusercontent.com/opencv/opencv/master/data/haarcascades/haarcascade_frontalface_alt.xml"
        Invoke-WebRequest -Uri $cascadeUrl -OutFile $cascadeFile
        Write-Host "  [OK] Downloaded $cascadeFile" -ForegroundColor Green
        $cascadeExists = $true
    } catch {
        Write-Host "  [X] Failed to download: $_" -ForegroundColor Red
        Write-Host "  Please download manually from:" -ForegroundColor Yellow
        Write-Host "    https://github.com/opencv/opencv/blob/master/data/haarcascades/haarcascade_frontalface_alt.xml" -ForegroundColor White
    }
} else {
    Write-Host "  [OK] Found: $cascadeFile" -ForegroundColor Green
}

# Check for landmark model (optional but recommended)
$landmarkFile = "lbfmodel.yaml"
if (Test-Path $landmarkFile) {
    Write-Host "  [OK] Found: $landmarkFile (optional)" -ForegroundColor Green
} else {
    Write-Host "  [!] Missing: $landmarkFile (optional, basic tracking will work without it)" -ForegroundColor Yellow
}

Write-Host ""

# Check config file
if (-not (Test-Path $ConfigPath)) {
    Write-Host "[!] Config file not found, creating default..." -ForegroundColor Yellow
    $defaultConfig = @{
        dmxApiUrl = "http://localhost:3030/api/dmx/batch"
        panChannel = 1
        tiltChannel = 2
        cameraIndex = 0
        updateRate = 30
        panSensitivity = 1.0
        tiltSensitivity = 1.0
        panOffset = 128
        tiltOffset = 128
        showPreview = $true
        smoothingFactor = 0.8
        brightness = 1.5
        contrast = 1.2
        cameraExposure = -1
        cameraBrightness = -1
        autoExposure = $true
    } | ConvertTo-Json -Depth 10
    
    $defaultConfig | Out-File -FilePath $ConfigPath -Encoding UTF8
    Write-Host "[OK] Created default config: $ConfigPath" -ForegroundColor Green
}

# Override camera index if specified
if ($CameraIndex -ge 0) {
    Write-Host "Updating camera index to $CameraIndex..." -ForegroundColor Cyan
    $config = Get-Content $ConfigPath -Raw | ConvertFrom-Json
    $config.cameraIndex = $CameraIndex
    $config | ConvertTo-Json -Depth 10 | Out-File -FilePath $ConfigPath -Encoding UTF8
    Write-Host "[OK] Updated config" -ForegroundColor Green
}

Write-Host ""

# Verify binary exists
if (-not (Test-Path $binaryPath)) {
    Write-Host "[X] Binary not found at: $binaryPath" -ForegroundColor Red
    Write-Host "Please build first with: .\launch-face-tracker.ps1 -Build" -ForegroundColor Yellow
    Pop-Location
    exit 1
}

# Copy model files to build/bin/Release if needed (for relative path resolution)
$buildBinPath = Split-Path $binaryPath -Parent
if ($cascadeExists -and -not (Test-Path "$buildBinPath\$cascadeFile")) {
    Write-Host "Copying model files to build directory..." -ForegroundColor Cyan
    Copy-Item $cascadeFile -Destination $buildBinPath -ErrorAction SilentlyContinue
    if (Test-Path $landmarkFile) {
        Copy-Item $landmarkFile -Destination $buildBinPath -ErrorAction SilentlyContinue
    }
    Write-Host "[OK] Model files copied" -ForegroundColor Green
}

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Starting Face Tracker..." -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Controls:" -ForegroundColor Yellow
Write-Host "  - Press 'q' or ESC to quit" -ForegroundColor White
Write-Host "  - Adjust camera settings in the preview window" -ForegroundColor White
Write-Host "  - Edit face-tracker-config.json to change DMX channels" -ForegroundColor White
Write-Host ""
Write-Host "Make sure your DMX server is running at http://localhost:3030" -ForegroundColor Cyan
Write-Host ""

# Run the face tracker
try {
    Push-Location (Split-Path $binaryPath -Parent)
    & ".\face-tracker.exe"
} catch {
    Write-Host "[X] Failed to run face tracker: $_" -ForegroundColor Red
} finally {
    Pop-Location
    Pop-Location
}

Write-Host ""
Write-Host "Face tracker exited." -ForegroundColor Cyan


