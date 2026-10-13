$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$runtimeDirectory = Join-Path $projectRoot 'research/private/comparison-service'
$statePath = Join-Path $runtimeDirectory 'processes.json'
if (!(Test-Path -LiteralPath $statePath)) { Write-Output 'No comparison processes recorded.'; exit }
$state = Get-Content -LiteralPath $statePath -Raw | ConvertFrom-Json
foreach ($item in @(@{ id = $state.tunnel; path = (Join-Path $runtimeDirectory 'cloudflared.exe') }, @{ id = $state.server; path = (Join-Path $projectRoot 'research/private/service-venv/Scripts/python.exe') })) {
    $process = Get-Process -Id $item.id -ErrorAction SilentlyContinue
    # Protect against a stale PID being reused by an unrelated application.
    if ($process -and $process.Path -eq $item.path) { Stop-Process -Id $process.Id }
}
Remove-Item -LiteralPath $statePath
Write-Output 'Comparison service and HTTPS tunnel stopped.'
