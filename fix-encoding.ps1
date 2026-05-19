$filePath = Resolve-Path 'start.ps1'
$content = [System.IO.File]::ReadAllText($filePath.Path, [System.Text.Encoding]::UTF8)
$utf8WithBom = New-Object System.Text.UTF8Encoding $true
[System.IO.File]::WriteAllText($filePath.Path, $content, $utf8WithBom)
Write-Host "File re-encoded with UTF-8 BOM successfully"

