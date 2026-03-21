param(
    [string]$WorkspacePath = ".dev-workspace"
)

$ErrorActionPreference = "Stop"

$sourceDir = $PSScriptRoot
$widgetName = "clock-gutter-demo"
$targetDir = Join-Path $WorkspacePath "data/widgets/$widgetName"

if (!(Test-Path (Join-Path $WorkspacePath "data"))) {
    throw "Workspace path '$WorkspacePath' is invalid. Expected '$WorkspacePath/data'."
}

New-Item -ItemType Directory -Path $targetDir -Force | Out-Null

$files = @(
    "widget.json",
    "index.html",
    "main.js",
    "styles.css",
    "README.md"
)

foreach ($file in $files) {
    Copy-Item (Join-Path $sourceDir $file) (Join-Path $targetDir $file) -Force
}

Write-Host "Installed widget '$widgetName' to '$targetDir'" -ForegroundColor Green
