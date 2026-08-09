[CmdletBinding()]
param(
  [string]$Version = ''
)

$ErrorActionPreference = 'Stop'
$repoRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$nativeRoot = [IO.Path]::GetFullPath((Join-Path $repoRoot 'native'))
$webRoot = [IO.Path]::GetFullPath((Join-Path $nativeRoot 'web'))
$distRoot = [IO.Path]::GetFullPath((Join-Path $repoRoot 'dist'))
$releaseRoot = [IO.Path]::GetFullPath((Join-Path $repoRoot 'release'))
$binaryPath = Join-Path $releaseRoot 'd5-tool.exe'
$tempBase = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())
$stagingRoot = Join-Path $tempBase ("d5a-viewer-native-build-{0}-{1}" -f $PID, [Guid]::NewGuid().ToString('N'))
$stagedBinary = Join-Path $stagingRoot 'd5-tool.exe'

function Assert-ChildPath([string]$Candidate, [string]$Parent, [string]$Label) {
  $resolvedCandidate = [IO.Path]::GetFullPath($Candidate)
  $resolvedParent = [IO.Path]::GetFullPath($Parent).TrimEnd([IO.Path]::DirectorySeparatorChar) + [IO.Path]::DirectorySeparatorChar
  if (-not $resolvedCandidate.StartsWith($resolvedParent, [StringComparison]::OrdinalIgnoreCase)) {
    throw "$Label path escapes its expected parent: $resolvedCandidate"
  }
}

Assert-ChildPath $nativeRoot $repoRoot 'native'
Assert-ChildPath $webRoot $nativeRoot 'native/web'
Assert-ChildPath $distRoot $repoRoot 'dist'
Assert-ChildPath $releaseRoot $repoRoot 'release'
Assert-ChildPath $stagingRoot $tempBase 'staging'

if (-not (Test-Path -LiteralPath (Join-Path $distRoot 'index.html') -PathType Leaf)) {
  throw 'dist/index.html is missing; run npm run build:web first'
}
if (-not (Test-Path -LiteralPath (Join-Path $nativeRoot 'go.mod') -PathType Leaf)) {
  throw 'native/go.mod is missing'
}
if ([string]::IsNullOrWhiteSpace($Version)) {
  $package = Get-Content -LiteralPath (Join-Path $repoRoot 'package.json') -Raw | ConvertFrom-Json
  $Version = [string]$package.version
}
if ([string]::IsNullOrWhiteSpace($Version)) {
  throw 'The native version is empty'
}

New-Item -ItemType Directory -Force -Path $webRoot | Out-Null
Get-ChildItem -LiteralPath $webRoot -Force |
  Where-Object { $_.Name -ne 'placeholder.txt' } |
  Remove-Item -Recurse -Force
Copy-Item -Path (Join-Path $distRoot '*') -Destination $webRoot -Recurse -Force
Get-ChildItem -LiteralPath $webRoot -Recurse -File -Filter '*.map' | Remove-Item -Force

New-Item -ItemType Directory -Force -Path $stagingRoot | Out-Null
$previousCgo = $env:CGO_ENABLED
$previousGoos = $env:GOOS
$previousGoarch = $env:GOARCH
try {
  $env:CGO_ENABLED = '0'
  $env:GOOS = 'windows'
  $env:GOARCH = 'amd64'
  Push-Location $nativeRoot
  try {
    & go build -trimpath -buildvcs=false -ldflags "-s -w -X github.com/siyuan-note/siyuan/packages/d5a-viewer/native.version=$Version" -o $stagedBinary ./cmd/d5-tool
    if ($LASTEXITCODE -ne 0) {
      throw "go build failed with exit code $LASTEXITCODE"
    }
  }
  finally {
    Pop-Location
  }
}
finally {
  $env:CGO_ENABLED = $previousCgo
  $env:GOOS = $previousGoos
  $env:GOARCH = $previousGoarch
}

if (-not (Test-Path -LiteralPath $stagedBinary -PathType Leaf)) {
  throw 'Go did not produce the staged executable'
}
$header = [IO.File]::ReadAllBytes($stagedBinary)
if ($header.Length -lt 2 -or $header[0] -ne 0x4d -or $header[1] -ne 0x5a) {
  throw 'The native build is missing the Windows PE marker'
}

New-Item -ItemType Directory -Force -Path $releaseRoot | Out-Null
Get-ChildItem -LiteralPath $releaseRoot -Force | Remove-Item -Recurse -Force
Move-Item -LiteralPath $stagedBinary -Destination $binaryPath
Remove-Item -LiteralPath $stagingRoot -Recurse -Force

$binary = Get-Item -LiteralPath $binaryPath
$sha256 = [Security.Cryptography.SHA256]::Create()
$stream = [IO.File]::OpenRead($binaryPath)
try {
  $hashBytes = $sha256.ComputeHash($stream)
}
finally {
  $stream.Dispose()
  $sha256.Dispose()
}
$hash = ([BitConverter]::ToString($hashBytes)).Replace('-', '').ToLowerInvariant()
Write-Output ("Native single file: {0}" -f $binary.FullName)
Write-Output ("Version: {0} / bytes: {1} / SHA-256: {2}" -f $Version, $binary.Length, $hash)
