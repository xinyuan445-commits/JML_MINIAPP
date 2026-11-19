$ErrorActionPreference = 'Stop'

$productionDirectory = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$launchers = @(
    Get-CimInstance Win32_Process | Where-Object {
        $_.Name -eq 'node.exe' -and
        $_.CommandLine -match 'scripts[/\\]start-with-webapi\.js'
    }
)

if ($launchers.Count -gt 1) {
    throw 'Multiple production launchers found; restart aborted.'
}

if ($launchers.Count -eq 1) {
    & taskkill.exe /PID $launchers[0].ProcessId /T /F | Out-Null
}

$npm = (Get-Command npm.cmd).Source
Start-Process -FilePath $npm -ArgumentList 'start' -WorkingDirectory $productionDirectory -WindowStyle Hidden

$deadline = [DateTime]::UtcNow.AddSeconds(45)
do {
    Start-Sleep -Milliseconds 500
    try {
        $health = Invoke-RestMethod -Uri 'http://127.0.0.1:5001/healthz' -TimeoutSec 2
    } catch {
        $health = $null
    }
} until ($health.status -eq 'ok' -or [DateTime]::UtcNow -ge $deadline)

if ($health.status -ne 'ok' -or $health.oidc_enabled -ne $true) {
    throw 'Production WebAPI did not restart with OIDC enabled.'
}
