#!/bin/bash

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${PURPLE}🚀 SiYuan 开发环境启动脚本${NC}"
echo -e "${CYAN}版本: 1.0.0${NC}"
echo -e "${CYAN}作者: 织${NC}"
echo

# 检测操作系统
if [[ "$OSTYPE" == "darwin"* ]]; then
    PLATFORM="darwin"
    EXECUTABLE="SiYuan-Kernel"
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    PLATFORM="linux"
    EXECUTABLE="SiYuan-Kernel"
else
    echo -e "${RED}❌ 不支持的操作系统: $OSTYPE${NC}"
    exit 1
fi

# 检测架构
ARCH=$(uname -m)
if [[ "$ARCH" == "x86_64" ]]; then
    GOARCH="amd64"
elif [[ "$ARCH" == "arm64" || "$ARCH" == "aarch64" ]]; then
    GOARCH="arm64"
else
    echo -e "${RED}❌ 不支持的架构: $ARCH${NC}"
    exit 1
fi

echo -e "${BLUE}ℹ️  检测到平台: $PLATFORM ($GOARCH)${NC}"

echo -e "\n${CYAN}=== 检查依赖 ===${NC}"

# 检查 Go
if ! command -v go &> /dev/null; then
    echo -e "${RED}❌ Go 未安装或不在 PATH 中${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Go: $(go version)${NC}"

# 检查 pnpm
if ! command -v pnpm &> /dev/null; then
    echo -e "${RED}❌ pnpm 未安装或不在 PATH 中${NC}"
    exit 1
fi
echo -e "${GREEN}✅ pnpm: $(pnpm --version)${NC}"

# 检查必要目录
if [[ ! -d "kernel" ]]; then
    echo -e "${RED}❌ 目录不存在: kernel${NC}"
    exit 1
fi

if [[ ! -d "app" ]]; then
    echo -e "${RED}❌ 目录不存在: app${NC}"
    exit 1
fi

echo -e "${GREEN}✅ 依赖检查完成${NC}"

echo -e "\n${CYAN}=== 编译内核 ===${NC}"

# 确保输出目录存在
mkdir -p app/kernel

# 设置环境变量
export GO111MODULE=on
export GOPROXY=https://mirrors.aliyun.com/goproxy/
export CGO_ENABLED=0
export GOOS=$PLATFORM
export GOARCH=$GOARCH

echo -e "${BLUE}ℹ️  编译内核 ($PLATFORM/$GOARCH)...${NC}"

cd kernel

if go build --tags fts5 -o "../app/kernel/$EXECUTABLE" -ldflags "-s -w" .; then
    echo -e "${GREEN}✅ 内核编译完成: app/kernel/$EXECUTABLE${NC}"
else
    echo -e "${RED}❌ 内核编译失败${NC}"
    exit 1
fi

cd ..

echo -e "\n${CYAN}=== 启动内核 ===${NC}"

KERNEL_PATH="app/kernel/$EXECUTABLE"
APP_DIR="app"

if [[ ! -f "$KERNEL_PATH" ]]; then
    echo -e "${RED}❌ 内核文件不存在: $KERNEL_PATH${NC}"
    exit 1
fi

echo -e "${BLUE}ℹ️  启动内核: $KERNEL_PATH${NC}"
echo -e "${BLUE}ℹ️  工作目录: $APP_DIR${NC}"
echo -e "${BLUE}ℹ️  模式: dev${NC}"
echo
echo -e "${YELLOW}⚠️  按 Ctrl+C 停止内核${NC}"
echo

cd "$APP_DIR"

# 启动内核
./kernel/$EXECUTABLE --wd=.. --mode=dev

EXIT_CODE=$?
if [[ $EXIT_CODE -eq 0 ]]; then
    echo -e "${GREEN}✅ 内核正常退出${NC}"
else
    echo -e "${RED}❌ 内核异常退出，代码: $EXIT_CODE${NC}"
fi 