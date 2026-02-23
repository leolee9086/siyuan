# 后端编译服务调查报告

日期: 2026-02-22

## 一、当前构建流程概述

### 1.1 整体架构

项目采用三阶段串行构建：**Go内核编译 → 前端Webpack打包 → Electron安装包生成**。

入口有三层：
- `build.js`（根目录）：Node.js一键构建脚本，自动检测平台，串行执行三阶段
- `scripts/{win-build.bat, linux-build.sh, darwin-build.sh}`：平台原生构建脚本，支持 `--target` 参数选择架构
- `app/package.json` scripts：前端构建和打包命令

### 1.2 前端构建

- 工具链：Webpack + esbuild-loader + Vue Loader
- 配置：`app/webpack.config.js` 读取 `app/build.targets.json` 定义的4个构建目标
- 构建目标：
  | 目标 | 平台 | 入口 | 输出目录 |
  |------|------|------|----------|
  | app | electron | index.ts, window/index.ts | stage/build/app |
  | desktop | web | index.ts | stage/build/desktop |
  | mobile | web | mobile/index.ts | stage/build/mobile |
  | export | web (library/UMD) | protyle/method.ts | stage/build/export |
- `pnpm run build` 默认构建全部4个目标；也可 `build:app` 等单独构建

### 1.3 后端（Go内核）构建

- 模块路径：`github.com/siyuan-note/siyuan/kernel`，Go 1.25.4
- 构建命令：`go build --tags fts5 -v -o <output> -ldflags "-s -w" .`
- CGO_ENABLED=1（依赖SQLite FTS5）
- 输出二进制名：`SiYuan-Kernel`（Windows加.exe）
- 输出目录按平台命名：kernel（win-amd64）、kernel-arm64、kernel-darwin、kernel-darwin-arm64、kernel-linux、kernel-linux-arm64
- Windows构建额外步骤：`goversioninfo` 生成资源文件；arm64需要交叉编译器
- Linux构建使用musl静态链接（`-buildmode=pie -extldflags -static-pie`）

### 1.4 Electron打包

- 工具：electron-builder，每个平台/架构有独立的 yml 配置
- Windows额外支持 APPX（Microsoft Store）打包
- 通过 `pnpm run dist*` 系列命令触发

## 二、相关设计文档摘要

### 2.1 `docs/设计/并行构建方案.md`

**内容**：Vamana向量索引的并行构建方案，与项目编译构建无关。描述的是向量数据库索引的分片并行+合并策略、节点级锁设计。

### 2.2 `docs/分析/构建性能优化方案.review.md`

**内容**：Vamana索引构建性能优化（100K向量164秒→目标<60秒），同样与项目编译构建无关。涉及距离计算优化、内存分配复用、循环展开。

### 2.3 `docs/分析/并行构建锁策略问题.review.md`

**内容**：Vamana并行构建的锁争用问题分析，与项目编译构建无关。

### 2.4 `docs/ttt/build-errors-investigation.md`

**内容**：前端构建warning调查（2026-02-20）。所有构建目标均成功，但存在缺失导出warning（commonMenuItem.ts引用不存在的openAsset/openBy，layout模块引用不存在的getAllTabs/getAllModels/getAllWnds）。

### 2.5 `docs/ttt/build-fix-warnings.ttt.md`

**内容**：上述warning的修复记录，已完成。通过修正导入路径和添加条件编译守卫解决。

### 2.6 `BUILD_README.md`

**内容**：一键构建指南，描述 `build.js` 的使用方法和环境要求。

## 三、现有规程中与构建相关的内容

在 `docs/规程/` 目录下，未发现专门针对"构建/编译服务"的规程。现有规程覆盖：
- 代码质量（lint、条件编译清理、代码拆分、类型守卫重构等）
- 测试与修复（Go测试编写、前端测试执行）
- 后端开发（Go模块实现）
- 文档管理
- 性能优化

**结论**：不存在构建流程相关的规程。

## 四、基于代码观察的痛点

### 4.1 `build.js` 中的冗余清理列表

```javascript
const dirsToClean = [
    'app/build',
    'app/kernel',
    'app/kernel',  // 重复6次
    ...
];
```
`app/kernel` 被重复列出7次，明显是复制粘贴错误。应该清理的是各平台kernel目录（kernel-arm64、kernel-darwin等），但实际只清理了 `app/kernel`。对比平台脚本（如 `win-build.bat` 正确清理了 kernel 和 kernel-arm64），`build.js` 的清理逻辑不完整。

### 4.2 `build.js` 使用 `process.chdir()` 切换目录

`buildKernel` 函数中使用 `process.chdir(kernelDir)` 然后又切回，这种模式脆弱且容易出错（异常路径下目录可能不正确）。平台脚本使用 `cd` 命令更安全。

### 4.3 构建脚本重复逻辑

`build.js` 和三个平台脚本（win-build.bat、linux-build.sh、darwin-build.sh）存在大量重复的构建逻辑。`build.js` 只支持当前平台单架构构建，而平台脚本支持多架构。两套脚本的能力不对等，维护成本高。

### 4.4 Go代理硬编码

所有构建脚本中 `GOPROXY=https://mirrors.aliyun.com/goproxy/` 为硬编码的中国镜像地址，非中国区开发者使用会有问题。

### 4.5 Windows arm64交叉编译器路径硬编码

`win-build.bat` 中 `CC="D:/Program Files/llvm-mingw-20240518-ucrt-x86_64/bin/aarch64-w64-mingw32-gcc.exe"` 为绝对路径硬编码。

### 4.6 前端构建无增量能力

`pnpm run build` 每次全量构建4个目标，无法选择性跳过未变更的目标。开发模式（dev）支持watch，但生产构建不支持增量。

### 4.7 前后端构建串行

当前三阶段完全串行。Go内核编译和前端Webpack打包之间无依赖关系，理论上可以并行执行以缩短总构建时间。
