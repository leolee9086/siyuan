# 思源笔记一键构建指南

本项目提供了一个一键构建脚本，可以自动完成思源笔记的整个构建过程，包括内核编译、前端构建和安装包打包。

## 使用方法

### 方法一：使用pnpm（推荐）

在项目根目录下执行：

```bash
cd app
pnpm run build:all
```

### 方法二：直接使用Node

在项目根目录下执行：

```bash
node build.js
```

## 构建流程

脚本会自动执行以下步骤：

1. **检测平台**：自动识别当前操作系统和架构
2. **清理构建目录**：删除之前的构建文件
3. **构建Go内核**：编译对应平台的内核程序
4. **构建前端应用**：编译和打包前端代码
5. **构建Electron安装包**：生成最终的安装包

## 支持的平台

- Windows (x64, arm64)
- macOS (x64, arm64)
- Linux (x64, arm64)

## 环境要求

- Node.js (建议使用最新LTS版本)
- pnpm
- Go (用于编译内核)
- 对于不同平台的构建，需要相应的环境

## 构建输出

构建完成后，安装包会生成在 `app/build` 目录中，文件名格式为 `siyuan-${version}-${os}.${ext}`。

## 常见问题

### 1. macOS构建失败

macOS构建需要额外的证书和配置文件，请确保：
- 已安装有效的开发者证书
- 配置了正确的provisioning profile文件
- 设置了entitlements文件

### 2. Linux构建依赖问题

Linux构建可能需要安装额外的依赖包：
```bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get install -y build-essential libnss3-dev

# CentOS/RHEL
sudo yum groupinstall -y "Development Tools"
sudo yum install -y nss-devel
```

### 3. Windows构建问题

Windows构建可能需要安装Visual Studio Build Tools或Visual Studio Community。

## 高级用法

### 查看帮助信息

```bash
node build.js --help
```

### 手动指定平台

脚本会自动检测平台，如需手动指定，可以修改脚本中的平台检测逻辑。

## 注意事项

1. 首次构建可能需要较长时间，因为需要下载Electron二进制文件
2. 构建过程会使用中国镜像源加速下载
3. 如果构建失败，请检查环境配置和依赖安装
4. macOS构建需要在macOS系统上进行

## 技术细节

- 使用electron-builder进行打包
- 使用webpack进行前端构建
- 使用Go进行内核编译
- 支持多平台交叉编译

## 许可证

本项目遵循AGPL-3.0许可证。