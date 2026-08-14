<#
.SYNOPSIS
    Smoke-test the Kodro MCP server on Windows.

.DESCRIPTION
    Thin wrapper around scripts/smoke_mcp.py. The protocol logic lives there and
    only there: a PowerShell reimplementation and a shell reimplementation would
    drift, and the one that drifted would be the one nobody ran.

    What this adds over calling Python directly is finding an interpreter. A
    stock Windows box has the `py` launcher, a developer box usually has
    `python` on PATH, and a machine with the Microsoft Store alias installed has
    a `python.exe` that opens the Store instead of running anything. Each is
    tried in turn and the first that reports a version wins.

.PARAMETER Entry
    Which invocation to test: all (default), console, or module.

.PARAMETER Verbose
    Echo every JSON-RPC frame.

.EXAMPLE
    .\scripts\smoke_mcp.ps1

.EXAMPLE
    .\scripts\smoke_mcp.ps1 -Entry module -Verbose

.NOTES
    Exit status is 0 only if every check passed on every entry point tried.
    Written for Windows PowerShell 5.1 as well as PowerShell 7, so it avoids
    the `&&`, `||` and ternary operators that 5.1 cannot parse.
#>
[CmdletBinding()]
param(
    [ValidateSet('all', 'console', 'module')]
    [string]$Entry = 'all'
)

$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$driver = Join-Path $PSScriptRoot 'smoke_mcp.py'

if (-not (Test-Path $driver)) {
    Write-Error "Cannot find $driver. Run this from a checkout of the Kodro repository."
    exit 1
}

# The Store alias is a zero-byte reparse point that launches the Microsoft Store
# rather than an interpreter, so presence on PATH is not enough. Ask each
# candidate for its version and take the first that actually answers.
$candidates = @(
    @{ Exe = 'python'; Args = @() },
    @{ Exe = 'py';     Args = @('-3') },
    @{ Exe = 'python3'; Args = @() }
)

$python = $null
foreach ($candidate in $candidates) {
    $command = Get-Command $candidate.Exe -ErrorAction SilentlyContinue
    if ($null -eq $command) { continue }
    try {
        $probe = & $candidate.Exe @($candidate.Args + '--version') 2>&1
        if ($LASTEXITCODE -eq 0 -and "$probe" -match 'Python 3') {
            $python = $candidate
            Write-Host "Using $($candidate.Exe) ($probe)"
            break
        }
    } catch {
        continue
    }
}

if ($null -eq $python) {
    Write-Error 'No working Python 3 interpreter found. Install Python 3.11 or newer.'
    exit 1
}

$driverArgs = @($driver, '--entry', $Entry)
if ($PSBoundParameters['Verbose']) { $driverArgs += '--verbose' }

Push-Location $repoRoot
try {
    & $python.Exe @($python.Args + $driverArgs)
    $code = $LASTEXITCODE
} finally {
    Pop-Location
}

exit $code
