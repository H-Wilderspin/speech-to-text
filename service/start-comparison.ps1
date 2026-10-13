param([int]$Port = 8765)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$runtimeDirectory = Join-Path $projectRoot 'research/private/comparison-service'
$python = Join-Path $projectRoot 'research/private/service-venv/Scripts/python.exe'
$tunnel = Join-Path $runtimeDirectory 'cloudflared.exe'
New-Item -ItemType Directory -Force -Path $runtimeDirectory | Out-Null
if (!(Test-Path -LiteralPath $python) -or !(Test-Path -LiteralPath $tunnel)) { throw 'Install the comparison environment and Cloudflare client first. See service/README.md.' }
$expectedTunnelHash = '86aee4017b26625cee8484c113558f48effa4cd47f7aa05fcf425604e5d2b23c'
if ((Get-FileHash -LiteralPath $tunnel -Algorithm SHA256).Hash.ToLower() -ne $expectedTunnelHash) { throw 'Unexpected Cloudflare client. Verify its provenance before updating the pinned checksum.' }
$keyPath = Join-Path $runtimeDirectory 'key.txt'
if (!(Test-Path -LiteralPath $keyPath)) {
    $randomBytes = New-Object byte[] 32
    $generator = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    $generator.GetBytes($randomBytes)
    [IO.File]::WriteAllText($keyPath, [Convert]::ToBase64String($randomBytes))
    $generator.Dispose(); [Array]::Clear($randomBytes, 0, $randomBytes.Length)
}
$statePath = Join-Path $runtimeDirectory 'processes.json'
if (Test-Path -LiteralPath $statePath) {
    $previous = Get-Content -LiteralPath $statePath -Raw | ConvertFrom-Json
    foreach ($processId in @($previous.server, $previous.tunnel)) {
        if (Get-Process -Id $processId -ErrorAction SilentlyContinue) { throw 'A previous comparison process is running. Use service/stop-comparison.ps1 first.' }
    }
}
$linkPath = Join-Path $runtimeDirectory 'private-link.txt'
if (Test-Path -LiteralPath $linkPath) { Remove-Item -LiteralPath $linkPath }
$server = Start-Process -FilePath $python -ArgumentList @('-m', 'uvicorn', 'service.app:create_app', '--factory', '--host', '127.0.0.1', '--port', $Port, '--no-access-log', '--log-level', 'warning') -WorkingDirectory $projectRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $runtimeDirectory 'server.out.log') -RedirectStandardError (Join-Path $runtimeDirectory 'server.err.log')
$relay = $null
try {
    $ready = $false
    for ($attempt = 0; $attempt -lt 60; $attempt++) {
        if ($server.HasExited) { throw 'The comparison server stopped. Inspect its private error log.' }
        try { $health = Invoke-RestMethod "http://127.0.0.1:$Port/health"; if ($health.ready) { $ready = $true; break } } catch { Start-Sleep -Seconds 1 }
    }
    if (!$ready) { throw 'The comparison server did not become ready.' }
    $relayLog = Join-Path $runtimeDirectory 'tunnel.err.log'
    $relay = Start-Process -FilePath $tunnel -ArgumentList @('tunnel', '--no-autoupdate', '--url', "http://127.0.0.1:$Port") -WorkingDirectory $projectRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $runtimeDirectory 'tunnel.out.log') -RedirectStandardError $relayLog
    $address = $null
    for ($attempt = 0; $attempt -lt 45; $attempt++) {
        Start-Sleep -Seconds 1
        $log = Get-Content -LiteralPath $relayLog -Raw -ErrorAction SilentlyContinue
        if ($log -match 'https://[a-z0-9-]+\.trycloudflare\.com') { $address = $Matches[0]; break }
        if ($relay.HasExited) { throw 'The HTTPS tunnel stopped.' }
    }
    if (!$address) { throw 'No HTTPS address was assigned.' }
    $connected = $false
    for ($attempt = 0; $attempt -lt 30; $attempt++) {
        Start-Sleep -Seconds 1
        if ($relay.HasExited) { throw 'The HTTPS tunnel stopped before connecting. Inspect research/private/comparison-service/tunnel.err.log.' }
        try { $publicHealth = Invoke-RestMethod ($address + '/health') -TimeoutSec 2; if ($publicHealth.ready) { $connected = $true; break } } catch { }
    }
    if (!$connected) { throw 'The public HTTPS health check failed. The test endpoint is not ready.' }
    $accessCode = [IO.File]::ReadAllText($keyPath).Trim()
    $link = 'https://h-wilderspin.github.io/speech-to-text/compare.html#service=' + [Uri]::EscapeDataString($address) + '&key=' + [Uri]::EscapeDataString($accessCode)
    [IO.File]::WriteAllText($linkPath, $link)
    @{ server = $server.Id; tunnel = $relay.Id; service = $address; port = $Port } | ConvertTo-Json | Set-Content -LiteralPath $statePath
    Write-Output "Comparison service: $address"
    Write-Output 'Private phone link saved in research/private/comparison-service/private-link.txt'
} catch {
    if ($relay -and !$relay.HasExited) { Stop-Process -Id $relay.Id }
    if (!$server.HasExited) { Stop-Process -Id $server.Id }
    # Explain the known discovery failure without dumping private connection logs.
    # Only inspect a log written by this launch, not a stale earlier attempt.
    if ($relay -and (Test-Path -LiteralPath $relayLog)) {
        $failureLog = Get-Content -LiteralPath $relayLog -Raw -ErrorAction SilentlyContinue
        if ($failureLog -match 'SRV only returned 0') {
            throw 'Cloudflare DNS discovery failed: no tunnel-server SRV records were returned. The comparison server has been stopped. Run Resolve-DnsName _v2-origintunneld._tcp.argotunnel.com -Type SRV in your normal PowerShell terminal, then repeat with -Server 1.1.1.1. See service/README.md for the network checks.'
        }
    }
    throw
}
