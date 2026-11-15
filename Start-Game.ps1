param([switch]$NoBrowser, [ValidateRange(1024,65525)][int]$Port = 8000)
$ErrorActionPreference = 'Stop'
$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) {
    Write-Host 'PLAY NICE needs Node.js for its local server. Install Node.js, or use Python: python -m http.server 8000 --bind 127.0.0.1'
    Read-Host 'Press Enter to close'
    exit 1
}
$selectedPort = $null
foreach ($candidatePort in $Port..($Port + 9)) {
    try {
        $health = Invoke-RestMethod -Uri "http://127.0.0.1:$candidatePort/health" -TimeoutSec 1
        if ($health.game -eq 'PLAY NICE' -and $health.build -eq '5.0.0-stealth' -and $health.root -eq $PSScriptRoot) { $selectedPort = $candidatePort; break }
    } catch { }
    $occupied = Get-NetTCPConnection -LocalPort $candidatePort -State Listen -ErrorAction SilentlyContinue
    if (-not $occupied) {
        $serverPath = Join-Path $PSScriptRoot 'tools\server.mjs'
        $outLog = Join-Path $env:TEMP "play-nice-$candidatePort-out.log"
        $errLog = Join-Path $env:TEMP "play-nice-$candidatePort-error.log"
        Start-Process -FilePath $node.Source -ArgumentList @(('"' + $serverPath + '"'), "$candidatePort") -WorkingDirectory $PSScriptRoot -WindowStyle Hidden -RedirectStandardOutput $outLog -RedirectStandardError $errLog | Out-Null
        for ($attempt = 0; $attempt -lt 20; $attempt++) {
            Start-Sleep -Milliseconds 200
            try {
                $health = Invoke-RestMethod -Uri "http://127.0.0.1:$candidatePort/health" -TimeoutSec 1
                if ($health.game -eq 'PLAY NICE' -and $health.build -eq '5.0.0-stealth' -and $health.root -eq $PSScriptRoot) { $selectedPort = $candidatePort; break }
            } catch { }
        }
        if ($null -ne $selectedPort) { break }
    }
}
if ($null -eq $selectedPort) { throw "The local server could not start on ports $Port-$($Port + 9). Check the play-nice logs in your temporary folder." }
$address = "http://127.0.0.1:$selectedPort/"
Write-Host "PLAY NICE is running at $address"
if (-not $NoBrowser) { Start-Process $address }
