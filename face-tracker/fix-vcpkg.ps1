# Fix vcpkg PATH setup
# Run this script to add vcpkg to your PATH permanently

Write-Host "vcpkg PATH Setup" -ForegroundColor Cyan
Write-Host "================" -ForegroundColor Cyan
Write-Host ""

$vcpkgPath = "C:\vcpkg"
$vcpkgExe = "$vcpkgPath\vcpkg.exe"

if (-not (Test-Path $vcpkgExe)) {
    Write-Host "[X] vcpkg not found at: $vcpkgPath" -ForegroundColor Red
    Write-Host ""
    Write-Host "To install vcpkg:" -ForegroundColor Yellow
    Write-Host "  1. cd C:\" -ForegroundColor White
    Write-Host "  2. git clone https://github.com/microsoft/vcpkg.git" -ForegroundColor White
    Write-Host "  3. cd vcpkg" -ForegroundColor White
    Write-Host "  4. .\bootstrap-vcpkg.bat" -ForegroundColor White
    exit 1
}

Write-Host "[OK] vcpkg found at: $vcpkgPath" -ForegroundColor Green
Write-Host ""

# Add to PATH for current session
$env:Path = "$vcpkgPath;$env:Path"
Write-Host "[OK] Added vcpkg to PATH for this session" -ForegroundColor Green

# Check if already in system PATH
$machinePath = [System.Environment]::GetEnvironmentVariable("Path", "Machine")
$userPath = [System.Environment]::GetEnvironmentVariable("Path", "User")
$inPath = ($machinePath -match "vcpkg") -or ($userPath -match "vcpkg")

if ($inPath) {
    Write-Host "[OK] vcpkg is already in system PATH" -ForegroundColor Green
} else {
    Write-Host "[!] vcpkg is NOT in system PATH" -ForegroundColor Yellow
    Write-Host "    Adding to user PATH..." -ForegroundColor Cyan
    
    try {
        $newUserPath = if ($userPath) { "$userPath;$vcpkgPath" } else { $vcpkgPath }
        [System.Environment]::SetEnvironmentVariable("Path", $newUserPath, "User")
        Write-Host "[OK] Added $vcpkgPath to user PATH" -ForegroundColor Green
        Write-Host "    You may need to restart PowerShell for changes to take effect" -ForegroundColor Yellow
    } catch {
        Write-Host "[X] Failed to add to PATH: $_" -ForegroundColor Red
        Write-Host "    Please run PowerShell as Administrator" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "Testing vcpkg command..." -ForegroundColor Cyan
try {
    $version = & vcpkg version
    Write-Host "[OK] vcpkg is working!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Installed OpenCV packages:" -ForegroundColor Cyan
    & vcpkg list | Select-String "opencv4" | Select-Object -First 5
    Write-Host ""
    Write-Host "[OK] vcpkg is ready to use!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Note: Use 'opencv4' not 'opencv' as the package name" -ForegroundColor Yellow
    Write-Host "Example: vcpkg install opencv4:x64-windows" -ForegroundColor Cyan
} catch {
    Write-Host "[X] vcpkg command failed: $_" -ForegroundColor Red
    Write-Host "    Try restarting PowerShell after running this script" -ForegroundColor Yellow
}
