# 比较分支差异的工具脚本
# 使用方法: .\compare-branches.ps1 [选项]

param(
    [string]$Action = "help",
    [string]$Branch1 = "siyuan-naive",
    [string]$Branch2 = "upstream/master"
)

function Show-Help {
    Write-Host "=== 分支比较工具 ===" -ForegroundColor Green
    Write-Host "使用方法:" -ForegroundColor Yellow
    Write-Host "  .\compare-branches.ps1 help          - 显示帮助" -ForegroundColor White
    Write-Host "  .\compare-branches.ps1 files         - 显示修改的文件列表" -ForegroundColor White
    Write-Host "  .\compare-branches.ps1 diff          - 显示详细差异" -ForegroundColor White
    Write-Host "  .\compare-branches.ps1 stats         - 显示统计信息" -ForegroundColor White
    Write-Host "  .\compare-branches.ps1 sync          - 显示需要同步的文件" -ForegroundColor White
    Write-Host ""
    Write-Host "默认比较: $Branch1 vs $Branch2" -ForegroundColor Cyan
}

function Show-ModifiedFiles {
    Write-Host "=== 修改的文件列表 ===" -ForegroundColor Green
    $files = git diff $Branch2 --name-only
    if ($files) {
        $files | ForEach-Object { Write-Host "  $_" -ForegroundColor Yellow }
    } else {
        Write-Host "  没有发现差异" -ForegroundColor Green
    }
}

function Show-DetailedDiff {
    Write-Host "=== 详细差异 ===" -ForegroundColor Green
    git diff $Branch2 --stat
}

function Show-Statistics {
    Write-Host "=== 统计信息 ===" -ForegroundColor Green
    $stats = git diff $Branch2 --stat
    Write-Host $stats
}

function Show-SyncNeeded {
    Write-Host "=== 需要同步的文件 ===" -ForegroundColor Green
    # 获取原版的最新提交
    $upstreamLatest = git rev-parse upstream/master
    $currentCommit = git rev-parse HEAD
    if ($upstreamLatest -eq $currentCommit) {
        Write-Host "  当前分支与原版同步，无需更新" -ForegroundColor Green
    } else {
        Write-Host "  原版有更新，需要同步以下文件:" -ForegroundColor Yellow
        git diff $upstreamLatest --name-only | ForEach-Object { 
            Write-Host "    $_" -ForegroundColor Red 
        }
    }
}

# 主逻辑
switch ($Action.ToLower()) {
    "help" { Show-Help }
    "files" { Show-ModifiedFiles }
    "diff" { Show-DetailedDiff }
    "stats" { Show-Statistics }
    "sync" { Show-SyncNeeded }
    default { Show-Help }
} 