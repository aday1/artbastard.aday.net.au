# Quick vcpkg setup script
# Adds vcpkg to PATH for this session and shows status

Write-Host "vcpkg Setup Script" -ForegroundColor Cyan
Write-Host "==================" -ForegroundColor Cyan
Write-Host ""

# Check if vcpkg exists
$vcpkgPath = "C:\vcpkg\vcpkg.exe"
if (-not (Test-Path $vcpkgPath)) {
    Write-Host "[X] vcpkg not found at C:\vcpkg" -ForegroundColor Red
    Write-Host ""
    Write-Host "To install vcpkg:" -ForegroundColor Yellow
    Write-Host "  1. cd C:\" -ForegroundColor White
    Write-Host "  2. git clone https://github.com/microsoft/vcpkg.git" -ForegroundColor White
    Write-Host "  3. cd vcpkg" -ForegroundColor White
    Write-Host "  4. .\bootstrap-vcpkg.bat" -ForegroundColor White
    exit 1
}

Write-Host "[OK] vcpkg found at: C:\vcpkg" -ForegroundColor Green
Write-Host ""

# Add to PATH for this session
$env:Path = "C:\vcpkg;$env:Path"
Write-Host "[OK] Added vcpkg to PATH for this session" -ForegroundColor Green
Write-Host ""

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
        $newUserPath = if ($userPath) { "$userPath;C:\vcpkg" } else { "C:\vcpkg" }
        [System.Environment]::SetEnvironmentVariable("Path", $newUserPath, "User")
        Write-Host "[OK] Added C:\vcpkg to user PATH" -ForegroundColor Green
        Write-Host "    You may need to restart PowerShell for changes to take effect" -ForegroundColor Yellow
    } catch {
        Write-Host "[X] Failed to add to PATH: $_" -ForegroundColor Red
        Write-Host "    Please run PowerShell as Administrator or add manually" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "vcpkg version:" -ForegroundColor Cyan
& vcpkg version

Write-Host ""
Write-Host "Installed OpenCV packages:" -ForegroundColor Cyan
& vcpkg list | Select-String "opencv" | Select-Object -First 10

Write-Host ""
Write-Host "vcpkg is ready to use!" -ForegroundColor Green
Write-Host "You can now run: vcpkg install opencv4:x64-windows" -ForegroundColor Cyan
Write-Host ""
Write-Host "Note: Use 'opencv4' not 'opencv' as the package name" -ForegroundColor Yellow

