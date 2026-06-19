param(
  [string]$OutDir = ".local-ssl",
  [string[]]$DnsNames = @("localhost", "holybell10", "holybell10.local", "artbastard.local"),
  [string[]]$IpAddresses = @("127.0.0.1", "192.168.1.10", "192.168.1.11", "100.73.20.4", "10.13.37.54")
)

$ErrorActionPreference = "Stop"
Import-Module Microsoft.PowerShell.Security -ErrorAction Stop
Import-Module PKI -ErrorAction SilentlyContinue

$rootSubject = "CN=ArtBastard Local Dev CA"
$serverSubject = "CN=artbastard.local"
$resolvedOutDir = Resolve-Path -LiteralPath "." | ForEach-Object { Join-Path $_.Path $OutDir }
New-Item -ItemType Directory -Force -Path $resolvedOutDir | Out-Null

$passphrasePath = Join-Path $resolvedOutDir "artbastard-local.passphrase.txt"
if (-not (Test-Path -LiteralPath $passphrasePath)) {
  $passphrase = ([Guid]::NewGuid().ToString("N") + [Guid]::NewGuid().ToString("N"))
  Set-Content -LiteralPath $passphrasePath -Value $passphrase -Encoding ASCII -NoNewline
} else {
  $passphrase = Get-Content -LiteralPath $passphrasePath -Raw
}
$securePassphrase = New-Object System.Security.SecureString
foreach ($char in $passphrase.ToCharArray()) {
  $securePassphrase.AppendChar($char)
}
$securePassphrase.MakeReadOnly()

$rootCert = Get-ChildItem Cert:\CurrentUser\My |
  Where-Object { $_.Subject -eq $rootSubject -and $_.HasPrivateKey } |
  Sort-Object NotAfter -Descending |
  Select-Object -First 1

if (-not $rootCert) {
  $rootCert = New-SelfSignedCertificate `
    -Type Custom `
    -Subject $rootSubject `
    -KeyAlgorithm RSA `
    -KeyLength 2048 `
    -HashAlgorithm SHA256 `
    -KeyUsage CertSign, CRLSign, DigitalSignature `
    -TextExtension @("2.5.29.19={critical}{text}ca=1&pathlength=1") `
    -CertStoreLocation Cert:\CurrentUser\My `
    -NotAfter (Get-Date).AddYears(5)
}

$rootCerPath = Join-Path $resolvedOutDir "artbastard-local-root-ca.cer"
Export-Certificate -Cert $rootCert -FilePath $rootCerPath -Force | Out-Null
Import-Certificate -FilePath $rootCerPath -CertStoreLocation Cert:\CurrentUser\Root | Out-Null

$dnsEntries = $DnsNames |
  Where-Object { $_ -and $_.Trim() } |
  ForEach-Object { $_.Trim().ToLowerInvariant() } |
  Sort-Object -Unique

$ipEntries = $IpAddresses |
  Where-Object { $_ -and $_.Trim() } |
  ForEach-Object { $_.Trim() } |
  Sort-Object -Unique

$sanParts = @()
$sanParts += $dnsEntries | ForEach-Object { "dns=$_" }
$sanParts += $ipEntries | ForEach-Object { "ipaddress=$_" }
$sanExtension = "2.5.29.17={text}" + ($sanParts -join "&")

$existingServerCerts = Get-ChildItem Cert:\CurrentUser\My |
  Where-Object { $_.Subject -eq $serverSubject -and $_.Issuer -eq $rootCert.Subject } |
  Sort-Object NotAfter -Descending

foreach ($cert in $existingServerCerts) {
  Remove-Item -LiteralPath ("Cert:\CurrentUser\My\" + $cert.Thumbprint) -ErrorAction SilentlyContinue
}

$serverCert = New-SelfSignedCertificate `
  -Type Custom `
  -Subject $serverSubject `
  -Signer $rootCert `
  -KeyAlgorithm RSA `
  -KeyLength 2048 `
  -HashAlgorithm SHA256 `
  -KeyUsage DigitalSignature, KeyEncipherment `
  -TextExtension @("2.5.29.37={text}1.3.6.1.5.5.7.3.1", $sanExtension) `
  -CertStoreLocation Cert:\CurrentUser\My `
  -KeyExportPolicy Exportable `
  -NotAfter (Get-Date).AddYears(2)

$pfxPath = Join-Path $resolvedOutDir "artbastard-local.pfx"
Export-PfxCertificate -Cert $serverCert -FilePath $pfxPath -Password $securePassphrase -Force | Out-Null

[pscustomobject]@{
  PfxPath = $pfxPath
  PassphrasePath = $passphrasePath
  RootCertificatePath = $rootCerPath
  DnsNames = $dnsEntries
  IpAddresses = $ipEntries
  Thumbprint = $serverCert.Thumbprint
} | ConvertTo-Json -Depth 3
