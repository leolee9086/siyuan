[CmdletBinding()]
param(
    [switch]$Elevated,
    [switch]$Race,
    [string]$RepositoryRoot = "",
    [string]$SessionRoot = ""
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

if ($RepositoryRoot -eq "") {
    $RepositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
}
$RepositoryRoot = [IO.Path]::GetFullPath($RepositoryRoot)
$AllowedRoot = [IO.Path]::GetFullPath((Join-Path $RepositoryRoot ".dev-workspace\temp\go-test"))
if ($SessionRoot -eq "") {
    $RunName = "windows-symlink-uac-{0}-{1}" -f (Get-Date -Format "yyyyMMdd-HHmmss"), $PID
    $SessionRoot = Join-Path $AllowedRoot $RunName
}
$SessionRoot = [IO.Path]::GetFullPath($SessionRoot)

$AllowedPrefix = $AllowedRoot.TrimEnd([IO.Path]::DirectorySeparatorChar) + [IO.Path]::DirectorySeparatorChar
if (-not $SessionRoot.StartsWith($AllowedPrefix, [StringComparison]::OrdinalIgnoreCase)) {
    throw "Session root leaves repository test boundary: $SessionRoot"
}
if (-not [string]::Equals([IO.Path]::GetPathRoot($RepositoryRoot), [IO.Path]::GetPathRoot($SessionRoot),
        [StringComparison]::OrdinalIgnoreCase)) {
    throw "Session root is on a different volume: repo=$RepositoryRoot session=$SessionRoot"
}

New-Item -ItemType Directory -Force -Path $SessionRoot | Out-Null
$LogPath = Join-Path $SessionRoot "test.log"
$EvidencePath = Join-Path $SessionRoot "evidence.json"

if (-not $Elevated) {
    $PowerShellPath = (Get-Process -Id $PID).Path
    $Arguments = @(
        "-NoProfile",
        "-ExecutionPolicy", "Bypass",
        "-File", ('"{0}"' -f $PSCommandPath),
        "-Elevated",
        "-RepositoryRoot", ('"{0}"' -f $RepositoryRoot),
        "-SessionRoot", ('"{0}"' -f $SessionRoot)
    )
    if ($Race) {
        $Arguments += "-Race"
    }
    $Process = Start-Process -FilePath $PowerShellPath -Verb RunAs -ArgumentList $Arguments `
        -WindowStyle Hidden -Wait -PassThru
    if (Test-Path -LiteralPath $LogPath) {
        Get-Content -LiteralPath $LogPath
    }
    Write-Output "Evidence: $EvidencePath"
    exit $Process.ExitCode
}

$Identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$Principal = [Security.Principal.WindowsPrincipal]::new($Identity)
$IsElevated = $Principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $IsElevated) {
    throw "The UAC child process is not elevated"
}

$TempPath = Join-Path $SessionRoot "temp"
$GoTempPath = Join-Path $SessionRoot "go-build"
New-Item -ItemType Directory -Force -Path $TempPath, $GoTempPath | Out-Null
$env:TEMP = $TempPath
$env:TMP = $TempPath
$env:GOTMPDIR = $GoTempPath
$env:SFORGE_TEST_REQUIRE_REAL_SYMLINK = "1"
$env:SFORGE_TEST_TEMP_ROOT = $SessionRoot
$env:SFORGE_TEST_REPO_ROOT = $RepositoryRoot
$env:SFORGE_TEST_DIRECTORY_REPARSE = Join-Path $RepositoryRoot "app\node_modules\vue"
$env:SFORGE_TEST_DIRECTORY_REPARSE_ROOT = Join-Path $RepositoryRoot "app\node_modules"
$env:SFORGE_TEST_DIRECTORY_REPARSE_CHILD = "package.json"
if (-not (Test-Path -LiteralPath $env:SFORGE_TEST_DIRECTORY_REPARSE)) {
    throw "Required pnpm junction fixture is missing: $env:SFORGE_TEST_DIRECTORY_REPARSE"
}

$StartedAt = Get-Date
$SymbolicLinkExitCode = 1
$JunctionExitCode = 1
$RaceExitCode = 0
$Skipped = @()
$KernelRoot = Join-Path $RepositoryRoot "kernel"
Push-Location $KernelRoot
try {
    "repo=$RepositoryRoot" | Set-Content -LiteralPath $LogPath
    "session=$SessionRoot" | Add-Content -LiteralPath $LogPath
    "temp=$env:TEMP" | Add-Content -LiteralPath $LogPath
    "gotmpdir=$env:GOTMPDIR" | Add-Content -LiteralPath $LogPath
    "uacElevated=$IsElevated" | Add-Content -LiteralPath $LogPath

    & go test ./internal/testutil/symlinkfixture ./fswalk ./filebrowser ./mcp/tools ./assetmeta ./cache `
        -run '(SymbolicLink|Symlink|Links|Linked)' -count=1 -v 2>&1 | Tee-Object -FilePath $LogPath -Append
    $SymbolicLinkExitCode = $LASTEXITCODE

    if ($SymbolicLinkExitCode -eq 0) {
        & go test ./fswalk ./filebrowser ./mcp/tools `
            -run '(DirectoryReparse|Junction)' -count=1 -v 2>&1 | Tee-Object -FilePath $LogPath -Append
        $JunctionExitCode = $LASTEXITCODE
    }
    if ($Race -and $SymbolicLinkExitCode -eq 0 -and $JunctionExitCode -eq 0) {
        & go test -race ./internal/testutil/symlinkfixture ./fswalk ./filebrowser ./mcp/tools ./assetmeta ./cache `
            -run '(SymbolicLink|Symlink|Links|Linked)' -count=1 -v 2>&1 | Tee-Object -FilePath $LogPath -Append
        $RaceExitCode = $LASTEXITCODE
    }
    $Skipped = @(Select-String -LiteralPath $LogPath -Pattern '^\s*--- SKIP:' | ForEach-Object { $_.Line })
} finally {
    Pop-Location
}

$ExitCode = 0
if ($SymbolicLinkExitCode -ne 0 -or $Skipped.Count -ne 0 -or $JunctionExitCode -ne 0 -or $RaceExitCode -ne 0) {
    $ExitCode = 1
}
$CleanupErrors = @()
foreach ($GeneratedPath in @($TempPath, $GoTempPath)) {
    if (-not (Test-Path -LiteralPath $GeneratedPath)) {
        continue
    }
    try {
        Remove-Item -LiteralPath $GeneratedPath -Recurse -Force -ErrorAction Stop
        if (Test-Path -LiteralPath $GeneratedPath) {
            $CleanupErrors += "temporary path still exists: $GeneratedPath"
        }
    } catch {
        $CleanupErrors += "failed to remove temporary path $GeneratedPath`: $($_.Exception.Message)"
    }
}
if ($CleanupErrors.Count -ne 0) {
    $ExitCode = 1
}
$Evidence = [ordered]@{
    startedAt = $StartedAt.ToString("o")
    finishedAt = (Get-Date).ToString("o")
    repositoryRoot = $RepositoryRoot
    sessionRoot = $SessionRoot
    temp = $env:TEMP
    goTemp = $env:GOTMPDIR
    processElevated = $IsElevated
    strictSymbolicLink = $true
    symbolicLinkExitCode = $SymbolicLinkExitCode
    symbolicLinkSkips = $Skipped
    junctionExitCode = $JunctionExitCode
    raceRequested = [bool]$Race
    raceExitCode = $RaceExitCode
    cleanupCompleted = ($CleanupErrors.Count -eq 0)
    cleanupErrors = $CleanupErrors
    exitCode = $ExitCode
}
$Evidence | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $EvidencePath
exit $ExitCode
