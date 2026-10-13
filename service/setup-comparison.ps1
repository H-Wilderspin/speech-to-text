# Run on the personal Windows x64 PC. No administrator session is required.
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$runtimeDirectory = Join-Path $projectRoot 'research/private/comparison-service'
$environmentDirectory = Join-Path $projectRoot 'research/private/service-venv'
$python = Join-Path $environmentDirectory 'Scripts/python.exe'

function Invoke-Checked([string]$Executable, [string[]]$Arguments) {
    & $Executable @Arguments
    if ($LASTEXITCODE -ne 0) { throw "Setup step failed (exit $LASTEXITCODE). See the message above; setup can be rerun." }
}

# Fail before large downloads when the network has the known tunnel-discovery issue.
Write-Output 'Checking Cloudflare DNS discovery...'
$records = @(Resolve-DnsName '_v2-origintunneld._tcp.argotunnel.com' -Type SRV -DnsOnly)
if (!($records | Where-Object { $_.Type -eq 'SRV' })) {
    throw 'No Cloudflare tunnel-server SRV records were returned. Use the personal PC on its unmanaged home connection. See service/README.md for DNS checks.'
}
$machine = Get-CimInstance Win32_ComputerSystem
Write-Output ('Available hardware: {0}, {1:N1} GB installed RAM. Processing uses CPU.' -f $machine.SystemType, ($machine.TotalPhysicalMemory / 1GB))
if ($machine.SystemType -notmatch 'x64') { throw 'This setup supports Windows x64. ARM64/32-bit Windows has not been validated.' }
if ($machine.TotalPhysicalMemory -lt 16GB) { Write-Warning 'This PC has less than 16 GB RAM. Model loading and processing may be limited; this is not a tested minimum.' }

Push-Location $projectRoot
try {
    if (!(Test-Path -LiteralPath $python)) {
        if (!(Get-Command py -ErrorAction SilentlyContinue)) { throw 'Install Python 3.13 (64-bit) with the Windows Python launcher, reopen PowerShell, then retry. See service/WINDOWS-SETUP.md.' }
        Invoke-Checked 'py' @('-3.13', '-c', 'import sys, struct; assert sys.version_info[:2] == (3, 13) and struct.calcsize(''P'') == 8, ''Python 3.13 x64 is required''')
        Invoke-Checked 'py' @('-3.13', '-m', 'venv', $environmentDirectory)
    }
    Invoke-Checked $python @('-c', 'import sys, struct; assert sys.version_info[:2] == (3, 13) and struct.calcsize(''P'') == 8, ''Existing environment must use Python 3.13 x64''')
    Invoke-Checked $python @('-m', 'pip', 'install', '-r', 'service/requirements-windows.txt')
    Invoke-Checked $python @('-m', 'pip', 'check')

    New-Item -ItemType Directory -Force -Path $runtimeDirectory | Out-Null
    $tunnel = Join-Path $runtimeDirectory 'cloudflared.exe'
    $expectedHash = '86aee4017b26625cee8484c113558f48effa4cd47f7aa05fcf425604e5d2b23c'
    if (!(Test-Path -LiteralPath $tunnel)) {
        $download = Join-Path $runtimeDirectory 'cloudflared.download'
        Invoke-WebRequest -UseBasicParsing -Uri 'https://github.com/cloudflare/cloudflared/releases/download/2026.10.0/cloudflared-windows-amd64.exe' -OutFile $download
        if ((Get-FileHash -LiteralPath $download -Algorithm SHA256).Hash.ToLower() -ne $expectedHash) { throw 'Cloudflare download checksum mismatch. The file has not been installed.' }
        Move-Item -LiteralPath $download -Destination $tunnel
    }
    if ((Get-FileHash -LiteralPath $tunnel -Algorithm SHA256).Hash.ToLower() -ne $expectedHash) { throw 'Existing Cloudflare client checksum mismatch. See service/README.md.' }

    & $python -c 'from huggingface_hub import get_token; import sys; sys.exit(0 if get_token() else 10)'
    if ($LASTEXITCODE -eq 10) {
        Write-Output 'Sign into your Hugging Face account using a read token. Accept Community-1 access first; see service/WINDOWS-SETUP.md. Answer No to saving it as a Git credential.'
        Invoke-Checked (Join-Path $environmentDirectory 'Scripts/hf.exe') @('auth', 'login')
    } elseif ($LASTEXITCODE -ne 0) { throw 'Could not check Hugging Face login.' }
    Invoke-Checked $python @('-m', 'service.prepare')
    Write-Output 'Setup finished. Run: powershell -NoProfile -ExecutionPolicy Bypass -File service/start-comparison.ps1'
} finally { Pop-Location }
