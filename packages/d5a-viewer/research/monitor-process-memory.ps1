param(
  [Parameter(Mandatory = $true)]
  [string]$OutputPath,
  [Parameter(Mandatory = $true)]
  [string]$StopPath,
  [string[]]$ProcessName = @('codex', 'msedgewebview2'),
  [int]$IntervalMs = 100
)

$ErrorActionPreference = 'Stop'
$resolvedOutput = [IO.Path]::GetFullPath($OutputPath)
$resolvedStop = [IO.Path]::GetFullPath($StopPath)
$directory = [IO.Path]::GetDirectoryName($resolvedOutput)
[IO.Directory]::CreateDirectory($directory) | Out-Null

'timestampUtc,processCount,totalWorkingSetMB,totalPrivateMB,maxProcessPrivateMB' |
  Set-Content -LiteralPath $resolvedOutput -Encoding utf8

while (-not [IO.File]::Exists($resolvedStop)) {
  $processes = @(Get-Process -Name $ProcessName -ErrorAction SilentlyContinue)
  $workingSet = ($processes | Measure-Object -Property WorkingSet64 -Sum).Sum
  $privateBytes = ($processes | Measure-Object -Property PrivateMemorySize64 -Sum).Sum
  $maximumPrivate = ($processes | Measure-Object -Property PrivateMemorySize64 -Maximum).Maximum
  $line = '{0},{1},{2:F1},{3:F1},{4:F1}' -f @(
    [DateTime]::UtcNow.ToString('O'),
    $processes.Count,
    ($workingSet / 1MB),
    ($privateBytes / 1MB),
    ($maximumPrivate / 1MB)
  )
  Add-Content -LiteralPath $resolvedOutput -Value $line -Encoding utf8
  Start-Sleep -Milliseconds ([Math]::Max(20, $IntervalMs))
}
