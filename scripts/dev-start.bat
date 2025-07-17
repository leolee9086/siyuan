@echo off
chcp 65001 >nul
echo.
echo 🚀 SiYuan 开发环境启动脚本
echo 版本: 1.0.0
echo 作者: 织
echo.

echo === 检查依赖 ===
echo 检查 Go...
go version >nul 2>&1
if errorlevel 1 (
    echo ❌ Go 未安装或不在 PATH 中
    pause
    exit /b 1
)
echo ✅ Go 已安装

echo 检查 pnpm...
pnpm --version >nul 2>&1
if errorlevel 1 (
    echo ❌ pnpm 未安装或不在 PATH 中
    pause
    exit /b 1
)
echo ✅ pnpm 已安装

echo === 编译内核 ===
cd kernel
echo 编译内核 (Windows/amd64)...
set GO111MODULE=on
set GOPROXY=https://mirrors.aliyun.com/goproxy/
set CGO_ENABLED=0
set GOOS=windows
set GOARCH=amd64

go build --tags fts5 -o "../app/kernel/SiYuan-Kernel.exe" -ldflags "-s -w -H=windowsgui" .
if errorlevel 1 (
    echo ❌ 内核编译失败
    pause
    exit /b 1
)
echo ✅ 内核编译完成
cd ..

echo === 启动内核 ===
cd app\kernel
echo 启动内核: SiYuan-Kernel.exe
echo 工作目录: ..
echo 模式: dev
echo.
echo 按 Ctrl+C 停止内核
echo.

SiYuan-Kernel.exe --wd=.. --mode=dev
if errorlevel 1 (
    echo ❌ 内核异常退出
) else (
    echo ✅ 内核正常退出
)

pause 