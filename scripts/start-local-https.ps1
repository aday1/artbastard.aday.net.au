$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")
Set-Location -LiteralPath $repoRoot

$sslDir = Join-Path $repoRoot ".local-ssl"
$pfxPath = Join-Path $sslDir "artbastard-local.pfx"
$passphrasePath = Join-Path $sslDir "artbastard-local.passphrase.txt"
$rootCertificatePath = Join-Path $sslDir "artbastard-local-root-ca.cer"

$ips = New-Object System.Collections.Generic.List[string]
$ips.Add("127.0.0.1")
$ips.Add("100.73.20.4")
$ips.Add("10.13.37.54")

Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
  Where-Object { $_.IPAddress -and $_.IPAddress -ne "127.0.0.1" -and $_.IPAddress -notlike "169.254.*" } |
  ForEach-Object {
    if (-not $ips.Contains($_.IPAddress)) {
      $ips.Add($_.IPAddress)
    }
  }

if (-not (Test-Path -LiteralPath $pfxPath) -or
    -not (Test-Path -LiteralPath $passphrasePath) -or
    -not (Test-Path -LiteralPath $rootCertificatePath)) {
  $certInfoRaw = & (Join-Path $PSScriptRoot "New-ArtBastardLocalCertificate.ps1") `
    -OutDir ".local-ssl" `
    -DnsNames @("localhost", "holybell10", "holybell10.local", "artbastard.local") `
    -IpAddresses $ips.ToArray()

  $certInfo = $certInfoRaw | ConvertFrom-Json
  $pfxPath = $certInfo.PfxPath
  $passphrasePath = $certInfo.PassphrasePath
  $rootCertificatePath = $certInfo.RootCertificatePath
}

$env:ARTBASTARD_HTTPS = "1"
$env:ARTBASTARD_HTTPS_PFX = $pfxPath
$env:ARTBASTARD_HTTPS_PFX_PASSPHRASE = Get-Content -LiteralPath $passphrasePath -Raw
if (-not $env:PORT) {
  $env:PORT = "3030"
}

Write-Host "ArtBastard HTTPS cert:"
Write-Host "  PFX: $pfxPath"
Write-Host "  Root CA for phones: $rootCertificatePath"
Write-Host "  SAN IPs: $($ips.ToArray() -join ', ')"
Write-Host "Starting HTTPS backend on port $env:PORT ..."

node dist/server.js
