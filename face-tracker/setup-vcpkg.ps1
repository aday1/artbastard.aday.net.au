# vcpkg Setup Script for Windows
# This script sets up vcpkg environment variables for the current session

Write-Host "vcpkg Setup Script" -ForegroundColor Cyan
Write-Host "==================" -ForegroundColor Cyan
Write-Host ""

$vcpkgRoot = $null

# Check if VCPKG_ROOT is already set
if ($env:VCPKG_ROOT) {
    $vcpkgRoot = $env:VCPKG_ROOT
    Write-Host "VCPKG_ROOT already set to: $vcpkgRoot" -ForegroundColor Green
} else {
    # Try to find vcpkg
    $vcpkgPaths = @(
        "C:\vcpkg",
        "$env:ProgramFiles\vcpkg",
        "$env:ProgramFiles(x86)\vcpkg",
        "$env:USERPROFILE\vcpkg"
    )
    
    foreach ($path in $vcpkgPaths) {
        if (Test-Path "$path\vcpkg.exe") {
            $vcpkgRoot = $path
            Write-Host "Found vcpkg at: $vcpkgRoot" -ForegroundColor Green
            break
        }
    }
}

if (-not $vcpkgRoot) {
    Write-Host "[X] vcpkg not found!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Install vcpkg:" -ForegroundColor Yellow
    Write-Host "  1. cd C:\" -ForegroundColor White
    Write-Host "  2. git clone https://github.com/microsoft/vcpkg.git" -ForegroundColor White
    Write-Host "  3. cd vcpkg" -ForegroundColor White
    Write-Host "  4. .\bootstrap-vcpkg.bat" -ForegroundColor White
    Write-Host ""
    exit 1
}

# Set environment variables for current session
$env:VCPKG_ROOT = $vcpkgRoot
$env:Path = "$vcpkgRoot;$env:Path"

Write-Host ""
Write-Host "[OK] Environment variables set for this session:" -ForegroundColor Green
Write-Host "  VCPKG_ROOT = $env:VCPKG_ROOT" -ForegroundColor White
Write-Host "  Added to PATH: $vcpkgRoot" -ForegroundColor White
Write-Host ""

# Test vcpkg
Write-Host "Testing vcpkg..." -ForegroundColor Cyan
try {
    $version = & vcpkg version 2>&1
    Write-Host "[OK] vcpkg is working!" -ForegroundColor Green
    Write-Host $version -ForegroundColor Gray
} catch {
    Write-Host "[X] vcpkg not working: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "To make this permanent, run:" -ForegroundColor Yellow
Write-Host "  [Environment]::SetEnvironmentVariable('VCPKG_ROOT', '$vcpkgRoot', 'User')" -ForegroundColor White
Write-Host "  [Environment]::SetEnvironmentVariable('Path', [Environment]::GetEnvironmentVariable('Path', 'User') + ';$vcpkgRoot', 'User')" -ForegroundColor White
Write-Host ""
Write-Host "Or add to your PowerShell profile:" -ForegroundColor Yellow
Write-Host "  `$env:VCPKG_ROOT = '$vcpkgRoot'" -ForegroundColor White
Write-Host "  `$env:Path = '$vcpkgRoot;' + `$env:Path" -ForegroundColor White
Write-Host ""

