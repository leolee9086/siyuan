# SiYuan 开发启动脚本

这个目录包含了用于快速启动 SiYuan 开发环境的脚本。

## 脚本说明

### 1. `dev-start.js` - 跨平台 JavaScript 脚本
- **功能**: 自动检测操作系统，编译内核并启动开发环境
- **支持平台**: Windows, macOS, Linux
- **使用方法**: `node scripts/dev-start.js`

### 2. `dev-start.bat` - Windows 批处理脚本
- **功能**: Windows 专用的开发环境启动脚本
- **使用方法**: 双击运行或 `scripts\dev-start.bat`

### 3. `dev-start.sh` - Unix/Linux/macOS Shell 脚本
- **功能**: Unix 系统专用的开发环境启动脚本
- **使用方法**: `./scripts/dev-start.sh` 或 `bash scripts/dev-start.sh`

## 使用步骤

### 方法一：使用 JavaScript 脚本（推荐）
```bash
# 在项目根目录执行
node scripts/dev-start.js
```

### 方法二：使用平台专用脚本

**Windows:**
```cmd
# 在项目根目录执行
scripts\dev-start.bat
```

**macOS/Linux:**
```bash
# 在项目根目录执行
./scripts/dev-start.sh
# 或者
bash scripts/dev-start.sh
```

## 脚本功能

1. **依赖检查**
   - 检查 Go 是否安装
   - 检查 pnpm 是否安装
   - 检查必要目录是否存在

2. **内核编译**
   - 自动检测操作系统和架构
   - 设置正确的环境变量
   - 编译内核到 `app/kernel/` 目录

3. **启动内核**
   - 以开发模式启动内核
   - 设置正确的工作目录
   - 处理进程信号（Ctrl+C）

## 环境要求

- **Go**: 1.16 或更高版本
- **pnpm**: 6.0 或更高版本
- **Node.js**: 14 或更高版本（仅 JavaScript 脚本需要）

## 故障排除

### 常见问题

1. **Go 未找到**
   - 确保 Go 已正确安装并添加到 PATH
   - 运行 `go version` 验证安装

2. **pnpm 未找到**
   - 安装 pnpm: `npm install -g pnpm`
   - 运行 `pnpm --version` 验证安装

3. **编译失败**
   - 检查 Go 版本是否支持
   - 脚本已禁用 CGO 以避免需要 GCC 编译器
   - 检查网络连接（需要下载依赖）

4. **权限问题（Linux/macOS）**
   - 给脚本添加执行权限: `chmod +x scripts/dev-start.sh`

### 手动编译内核

如果脚本失败，可以手动执行以下步骤：

**Windows:**
```cmd
cd kernel
go build --tags "fts5" -o "../app/kernel/SiYuan-Kernel.exe"
cd ../app/kernel
SiYuan-Kernel.exe --wd=.. --mode=dev
```

**Linux/macOS:**
```bash
cd kernel
go build --tags "fts5" -o "../app/kernel/SiYuan-Kernel"
cd ../app/kernel
./SiYuan-Kernel --wd=.. --mode=dev
```

## 版本信息

- **版本**: 1.0.0
- **作者**: 织
- **更新日期**: 2024年

## 注意事项

- 脚本会自动检测当前操作系统和架构
- 内核文件会输出到 `app/kernel/` 目录
- 开发模式会启用调试功能
- 使用 Ctrl+C 可以安全停止内核进程 