[CmdletBinding()]
param(
  [string]$Binary = ''
)

$ErrorActionPreference = 'Stop'
$repoRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$nativeRoot = Join-Path $repoRoot 'native'
if ([string]::IsNullOrWhiteSpace($Binary)) {
  $Binary = Join-Path $repoRoot 'release\d5-tool.exe'
}
$Binary = [IO.Path]::GetFullPath($Binary)
if (-not (Test-Path -LiteralPath $Binary -PathType Leaf)) {
  throw "The native executable is missing: $Binary"
}

Push-Location $nativeRoot
try {
  & go test -count=1 ./...
  if ($LASTEXITCODE -ne 0) {
    throw "go test failed with exit code $LASTEXITCODE"
  }
  & go vet ./...
  if ($LASTEXITCODE -ne 0) {
    throw "go vet failed with exit code $LASTEXITCODE"
  }
}
finally {
  Pop-Location
}

$verifier = Join-Path $PSScriptRoot 'verify-native-cli.mjs'
& node $verifier $Binary
if ($LASTEXITCODE -ne 0) {
  throw "Native fixture verification failed with exit code $LASTEXITCODE"
}
