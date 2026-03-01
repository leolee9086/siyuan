# esbuild调研 - 已排除方案归档

归档日期：2026-02-22
来源：`esbuild-feasibility-research.md` 清理归档

> 以下方案均已在调研过程中被排除，保留详细分析供未来参考。
> 最终结论见主文档。

## B. esbuild Go API能力（已不再需要）

### B.1 核心能力

esbuild Go API (`github.com/evanw/esbuild/pkg/api`) 提供：

| 能力 | Go API支持 | 说明 |
|------|-----------|------|
| Bundle | ✅ `api.Build()` | 完整的模块打包，支持tree-shaking |
| Transform | ✅ `api.Transform()` | 单文件转换（不解析依赖） |
| Serve | ✅ `api.Serve()` | 内置HTTP开发服务器 |
| Watch | ✅ `api.Build()` + Watch选项 | 文件变更监听和增量构建 |
| Incremental | ✅ `Rebuild()` | 增量重建，复用缓存 |

### B.2 插件系统

Go API完整支持插件系统，与JS API的插件接口基本一致：

```go
api.Plugin{
    Name: "my-plugin",
    Setup: func(build api.PluginBuild) {
        build.OnResolve(api.OnResolveOptions{Filter: `\.vue$`}, func(args api.OnResolveArgs) (api.OnResolveResult, error) {
            // 自定义模块解析
        })
        build.OnLoad(api.OnLoadOptions{Filter: `\.vue$`}, func(args api.OnLoadArgs) (api.OnLoadResult, error) {
            // 自定义文件加载和转换
        })
    },
}
```

支持的钩子：`OnResolve`、`OnLoad`、`OnStart`、`OnEnd`。

### B.3 TypeScript支持

| 特性 | 支持程度 |
|------|----------|
| 基本TS语法 | ✅ 完整支持 |
| JSX/TSX | ✅ 完整支持 |
| 装饰器 | ⚠️ 仅支持TC39装饰器（experimentalDecorators不支持） |
| 路径别名 | ✅ 通过 `tsconfig.json` 的 paths 或 esbuild 的 alias |
| `const enum` | ⚠️ 不支持跨文件const enum（单文件内可以） |
| 类型检查 | ❌ esbuild只做转译，不做类型检查 |

### B.4 其他关键能力

- **Define**：支持编译时常量替换（对应webpack的DefinePlugin）
- **Alias**：支持模块别名
- **External**：支持外部模块声明
- **CSS打包**：原生支持CSS import和bundle
- **代码分割**：支持（但仅限ESM格式输出）
- **Source Map**：完整支持

## C. Vue SFC替代方案详情

### 方案A：Go端内嵌V8运行 `@vue/compiler-sfc`

**Go嵌入V8的主要选项**：

| 库 | 特点 | 二进制体积增量 |
|---|------|--------------|
| `rogchap/v8go` | 最成熟的Go V8绑定，CGO，支持多平台 | ~30-50MB |
| `nicholasgasior/goja` | 纯Go实现的ES5.1+引擎，无CGO | 0（纯Go） |
| `nicholasgasior/quickjs-go` | QuickJS的CGO绑定，轻量 | ~1-2MB |

**关键考量——与JS代码执行需求的协同**：

项目当前使用 `yaegi`（Go解释器）执行用户/AI编写的Go脚本。如果未来需要支持AI编写的JS代码执行，则嵌入V8/QuickJS的边际成本大幅降低：同一个JS引擎可同时服务于Vue SFC编译、SCSS编译（sass.js）、AI JS脚本执行。

**排除原因**：Electron已提供完整V8+Node.js环境，在Go中再嵌入V8是冗余。

### 方案B：预编译Vue SFC为纯TS

构建流程分两步：
1. 预处理阶段：用Node.js脚本将 `.vue` 文件编译为 `.ts` + `.css`
2. esbuild阶段：Go端esbuild只处理纯TS和CSS

**排除原因**：仍需Node.js参与预处理，且Electron已提供Node.js，无需将esbuild迁移到Go。

### 方案C：Go端自行实现简化版Vue SFC解析

鉴于项目Vue SFC使用模式统一（全部 `<script setup lang="ts">`），理论上可用Go解析提取三个块。

**排除原因**：template到render函数的编译是Vue编译器核心，无法简单绕过，可行性低。

### 方案D：消除Vue SFC依赖

将30个Vue SFC重构为纯TS（`h()` 函数或JSX）。

**排除原因**：重构工作量大，且原始问题（esbuild嵌入Go）已不需要，消除SFC的动机不存在。

### 方案E：浏览器端运行时编译（vue3-sfc-loader）

`vue3-sfc-loader` 将 `@vue/compiler-sfc` 打包为浏览器可用的运行时库。Go端esbuild处理TS/JS/CSS，浏览器端运行时编译Vue SFC。

**排除原因**：Electron main process已有Node.js，可直接使用 `@vue/compiler-sfc`，无需浏览器端运行时编译。

## D. SCSS替代方案详情

### 方案A：Go端调用dart-sass CLI

将 `dart-sass` 二进制文件随应用分发，Go端通过 `exec.Command` 调用。

**排除原因**：需额外分发~50MB二进制；Electron已有Node.js，可直接使用 `sass` npm包。

### 方案B：Go端使用libsass CGO绑定

通过CGO调用libsass（C++实现）。

**排除原因**：libsass已停止维护（2020年后），不支持 `@use` 模块系统（项目大量使用）。

### 方案C：预编译SCSS为CSS

构建时用dart-sass预编译。

**排除原因**：同方案B/D，Electron已提供Node.js环境，无需将SCSS编译迁移到Go。

### 方案D：迁移SCSS为原生CSS

利用CSS自定义属性、CSS嵌套等现代特性替代SCSS。

**排除原因**：项目大量使用 `@use`、mixin、`@extend`，迁移工作量大，且动机不存在。

## 综合评估矩阵（历史参考）

| 维度 | Bun主运行时 | Go esbuild + V8 | Go esbuild + sfc-loader | 预编译 + Go esbuild |
|------|------------|-----------------|------------------------|-------------------|
| TS/JS编译 | ✅ 原生 | ✅ esbuild | ✅ esbuild | ✅ |
| CSS打包 | ✅ 内置bundler | ✅ esbuild | ✅ esbuild | ✅ |
| Vue SFC | ✅ Node生态直接可用 | ✅ V8运行compiler-sfc | ✅ 浏览器端编译 | ✅ Node预编译 |
| SCSS | ✅ sass包直接可用 | ✅ V8运行sass.js | ⚠️ 需预编译/迁移 | ✅ dart-sass |
| 条件编译 | ✅ Bun插件/预处理 | ⚠️ Go插件 | ⚠️ Go插件 | ⚠️ Go插件 |
| JS脚本执行 | ✅ 原生能力 | ✅ 复用V8 | ❌ 需另行解决 | ❌ 需另行解决 |
| 实现复杂度 | ⚠️ 双进程IPC | ⚠️ V8集成+bundle打包 | ✅ 低 | ✅ 低 |
| 二进制体积 | ⚠️ +50-90MB(Bun) | ⚠️ +30-50MB(V8) | ✅ 无增量 | ✅ 无增量 |
| 生态兼容性 | ✅ Node生态完全兼容 | ⚠️ 需预打包JS | ⚠️ 有限 | ✅ |
| 移动端支持 | ❌ Bun不支持Android/iOS | ✅ V8原生支持Android | ✅ 浏览器端兼容 | ✅ 预编译产物可用 |

## 移动端平台分析（历史参考）

### s-forge分支不需要移动端原生应用

MAGI系统的计算需求远超移动端能力：
- 三贤人并发LLM调用（Melchior/Balthazar/Casper三路并行推理 + Trinity综合决策）
- ATF同步率实时计算（5×6人格矩阵EMA更新、Frobenius内积、文体指纹算法）
- llama.cpp本地推理（文体困惑度PPL计算）
- Shell行动层（工具执行、文件系统操作、代码生成）
- Seraph精神卫生监控（持续的人格漂移检测和病理诊断）

目标运行环境是个人电脑或NAS。移动端角色是远程访问客户端（浏览器连接桌面/NAS上的s-forge实例）。

### 当前移动端架构（参考）

- Go kernel 通过 gomobile 编译为 Android `.aar` / iOS `.framework`
- 前端通过 webpack 预编译为静态资源
- 原生 WebView 加载 Go HTTP 服务器伺服的预编译静态资源

## 架构4：Bun主运行时详情

**核心思路**：应用自带Bun运行时，Bun作为前端编译和伺服的主进程，Go kernel退化为微服务。

**Bun内置能力**：Bundler（兼容esbuild插件API）、原生TS支持、Node生态兼容（Vue SFC/SCSS直接可用）、内置HTTP服务器、Watch/HMR、JS脚本执行。

**排除原因**：
1. Electron已提供Node.js，引入Bun是冗余
2. Bun不支持Android/iOS，导致桌面/移动端架构分裂
3. 双进程IPC增加架构复杂度

## v8go单二进制方案详情

**核心思路**：Go + v8go编译为单个二进制文件，每个工作空间运行一个独立实例，免安装。

**排除原因**：
1. Electron已提供V8，在Go中再嵌入V8是冗余
2. 仍需要浏览器/WebView作为UI层，无法真正实现"单二进制"
3. 回到了需要解决UI渲染的问题，而Electron已经解决了这个问题
