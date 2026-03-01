# esbuild作为Go后端内嵌编译服务 - 技术可行性调研

调研日期：2026-02-22
状态：**已完结** — 原始问题不需要，最终架构已确定

> 已排除方案的详细分析见 [`esbuild-feasibility-research-alternatives-archive.md`](esbuild-feasibility-research-alternatives-archive.md)

## A. 当前项目Vue/SCSS使用范围

### A.1 Vue SFC文件统计

共发现约 **30个** `.vue` 文件，分布如下：

| 目录 | 文件数 | 说明 |
|------|--------|------|
| `app/src/components/` | ~18 | 通用UI组件（对话框、工具栏、面板等） |
| `app/src/components/common/` | ~6 | 基础组件（TextField、DialogContent等） |
| `app/src/components/masonry/` | ~4 | 瀑布流布局组件 |
| `app/src/components/panels/` | ~6 | 面板组件（文档、dock、图片编辑器等） |
| `app/src/config/ai/` | 1 | ModelScopeConfig.vue |
| `app/src/sforge/panel/` | 2 | SmartToolbox相关 |
| `app/src/protyle/gutter/menus/` | 1 | AI图片生成进度 |
| `app/src/asset/components/` | 2 | 资产卡片/瀑布流对话框 |

**所有Vue SFC均使用 `<script setup lang="ts">`**，无纯JS或其他lang变体。

### A.2 Vue SFC中的特殊用法

1. **条件编译指令**：部分Vue文件使用 `/// #if !MOBILE`、`/// #if !BROWSER` 等条件编译指令（如 `dockPanel.vue`、`PDFviewer.vue`）。当前由webpack的 `PatchResolverPlugin` 处理。
2. **Scoped SCSS**：4个Vue文件使用了 `<style lang="scss" scoped>`：
   - `imageEditor.vue`
   - `SelectionWrapper.vue`
   - `VirtualMasonryGrid.vue`
   - `SelectionBox.vue`

### A.3 SCSS文件统计

SCSS文件集中在 `app/src/assets/scss/` 目录，共约 **45个** `.scss` 文件，另有1个独立的 `imageEditor.scss`。

结构：
- `base.scss` / `mobile.scss` / `export.scss` — 3个入口文件
- `business/` — 15个业务样式
- `component/` — 15个组件样式
- `protyle/` — 5个编辑器样式
- `util/` — 6个工具样式（mixin、function、keyframes等）
- `pdf/` / `pickr/` / `viewerjs/` — 第三方样式适配
- `main/` — 2个主布局样式

**SCSS特性使用情况**：
- 大量使用 `@use` 模块系统（非旧式 `@import`）
- 使用 `@use ... as *` 命名空间
- 使用 mixin（`@include mixin.text-clamp()`）
- 使用嵌套、变量、`@extend`
- 使用 CSS 自定义属性（`var(--b3-*)`）

### A.4 Webpack配置分析

当前 `webpack.config.js` 的关键配置：

| 功能 | 实现方式 |
|------|----------|
| Vue SFC编译 | `vue-loader` + `VueLoaderPlugin` |
| TypeScript | `esbuild-loader`（已在用esbuild） |
| SCSS | `sass-loader` → `css-loader` → `MiniCssExtractPlugin.loader` / `vue-style-loader` |
| 压缩 | `EsbuildPlugin`（已在用esbuild） |
| 条件编译 | `PatchResolverPlugin`（自定义webpack插件） |
| 路径别名 | `@` → `src/`，Vue别名 |
| 多目标构建 | `build.targets.json` 定义多个构建目标 |
| DefinePlugin | `SIYUAN_VERSION`、`NODE_ENV`、`__VUE_OPTIONS_API__`、`__VUE_PROD_DEVTOOLS__` |

**关键发现**：项目已经在webpack中使用 `esbuild-loader` 处理TS和JS压缩，说明esbuild的TS处理能力已被验证。

## B. 原始问题否定：为什么esbuild嵌入Go不需要

### B.1 核心否定理由

**esbuild Go API无法独立完成前端编译**，因为两个关键依赖没有Go原生实现：

| 依赖 | 现状 | 阻塞原因 |
|------|------|----------|
| Vue SFC编译 | `@vue/compiler-sfc`（纯JS实现） | template→render函数编译、`<script setup>`语法糖、scoped CSS处理均无Go实现 |
| SCSS编译 | dart-sass（Dart实现）/ libsass（C++，已停维） | 项目大量使用 `@use` 模块系统，libsass不支持；无Go原生SCSS编译器 |

要在Go中解决这两个问题，必须嵌入JS引擎（v8go/goja/quickjs-go），但这引出了关键洞察：

### B.2 关键洞察

**Electron已经提供了完整的V8+Node.js环境。**

s-forge绝对特化为桌面端（MAGI认知架构的计算需求超出移动端能力），Electron是确定的运行环境。Node.js能力通过preload脚本机械化封装后暴露给Renderer：

- `@vue/compiler-sfc` 直接作为npm依赖使用
- `sass` 直接作为npm依赖使用
- webpack/esbuild/vite 直接在Electron Node.js中运行
- Node.js全量API通过preload封装暴露，TS定义已存在，封装工作完全机械化
- **在Go中再嵌入V8是冗余**

### B.3 已排除方案一览

| 方案 | 排除原因 |
|------|----------|
| esbuild嵌入Go | Vue SFC和SCSS无Go原生实现，且Electron已提供JS运行时 |
| v8go（Go嵌入V8） | Electron已有V8，冗余；+30-50MB体积 |
| Bun主运行时 | Electron已有Node.js，冗余；不支持Android/iOS |
| vue3-sfc-loader（浏览器端编译） | Electron main process已有Node.js，无需浏览器端运行时编译 |
| Go端调用dart-sass CLI | 需额外分发~50MB二进制，Electron可直接用sass npm包 |
| libsass CGO绑定 | 已停止维护，不支持 `@use` 模块系统 |
| 消除Vue SFC依赖 | 重构工作量大，且动机已不存在 |
| 移动端原生应用 | MAGI计算需求超出移动端能力，通过浏览器远程访问即可 |
| Docker容器化 | 桌面端绝对特化，无需容器化 |

> 各方案详细分析见 [归档文档](esbuild-feasibility-research-alternatives-archive.md)

## C. 最终架构：Electron(多Renderer) + Go kernel(系统网关)

### C.1 Electron的重新定位

- ~~应用框架~~ → **多Renderer定制浏览器**
- Main Process = **管理中心**（进程生命周期、窗口管理），不是运行环境
- **Renderer₁** = 特制Node环境（通过preload全量封装Node.js API），负责编译/工具链
- **Renderer₂₃₄₅₆...** = 特制浏览器窗口（纯Web前端UI）
- 其它端（手机/平板等）= **纯网页客户端**，完全放弃原生应用

### C.2 Renderer₁：特制Node环境

- `contextIsolation: true` + `nodeIntegration: false`（安全前提不变）
- preload脚本通过 `contextBridge.exposeInMainWorld()` 暴露Node.js **全量API**
- 封装方式：简单粗暴的参数验证 + 透传，TS定义已存在，工作量可观但完全机械化
- 承载前端编译（`@vue/compiler-sfc`、`sass`、webpack/esbuild/vite）
- 承载JS脚本执行沙箱（AI编写的JS代码）
- **承载MAGI认知引擎**（三贤人并发决策、Trinity综合、ATF同步率、Seraph监控）——本质是复杂TS逻辑，放在JS运行时比Go更自然

### C.3 安全边界

- Renderer₁ preload层：参数验证，防止恶意调用，但不限制Node.js能力范围
- Renderer₂₃₄₅₆...：纯Web沙箱，无Node.js访问，仅通过HTTP与Go kernel通信
- 所有**业务数据操作**（文件存储、同步、搜索、数据库）经过Go kernel HTTP API
- MAGI认知逻辑在Renderer₁中运行，Shell行动层的**系统操作**（文件、进程、网络）通过Go kernel执行
- Go kernel提供裸LLM转发（llama.cpp推理、API代理），MAGI在Renderer₁侧编排调用
- 远程浏览器客户端：与Renderer₂₃₄₅₆享有相同的安全隔离（纯HTTP）

### C.4 目标架构

```
桌面端 (Electron = 多Renderer定制浏览器)
┌───────────────────────────────────────────────────────┐
│  Electron                                             │
│  ┌──────────────┐                                     │
│  │ Main Process │  管理中心：进程生命周期、窗口管理      │
│  └──┬───────┬───┘                                     │
│     │       │                                         │
│     ▼       ▼                                         │
│  ┌────────────────────┐  ┌─────────────────────────┐  │
│  │ Renderer₁          │  │ Renderer₂₃₄₅₆...       │  │
│  │ (特制Node环境)      │  │ (特制浏览器窗口)         │  │
│  │                    │  │                         │  │
│  │ preload: Node.js   │  │ - 纯Web前端 (Vue 3+TS)  │  │
│  │ 全量API封装         │  │ - 无Node.js访问          │  │
│  │                    │  │ - 仅HTTP通信             │  │
│  │ - MAGI认知引擎      │  │                         │  │
│  │   (三贤人/Trinity/  │  │                         │  │
│  │    ATF/Seraph)     │  │                         │  │
│  │ - 前端编译          │  │                         │  │
│  │   (Vue SFC/SCSS)   │  │                         │  │
│  │ - JS脚本执行沙箱    │  │                         │  │
│  │ - bundler          │  │                         │  │
│  └────────┬───────────┘  └────────┬────────────────┘  │
│           │                      │                    │
│           └──────────┬───────────┘                    │
│                      │ HTTP only                      │
│                      ▼                                │
│  ┌────────────────────────────────────────────────┐   │
│  │  Go Kernel (系统网关)  每个工作空间一个实例        │   │
│  │  - 数据存储/同步  - 裸LLM转发(llama.cpp/API代理) │   │
│  │  - Shell系统操作   - 搜索/向量DB                 │   │
│  └────────────────────────────────────────────────┘   │
└───────────────────────────────────────────────────────┘

远程访问 (纯网页客户端，完全放弃原生应用)
┌──────────────┐     HTTP     ┌──────────────┐
│ 任意浏览器    │ ──────────► │ Go Kernel    │
│ (手机/平板等) │             │ :6806        │
└──────────────┘             └──────────────┘
```

### C.5 职责划分

| 层 | 职责 | 技术 |
|----|------|------|
| Electron Main | 管理中心：进程生命周期、窗口管理 | Node.js |
| Renderer₁ (特制Node环境) | MAGI认知引擎（三贤人/Trinity/ATF/Seraph）、前端编译、JS脚本沙箱 | preload全量封装Node.js API（参数验证+透传） |
| Renderer₂₃₄₅₆ (特制浏览器) | 纯Web前端UI | Vue 3 + TS，仅HTTP通信 |
| Go Kernel (系统网关) | 数据存储/同步、裸LLM转发(llama.cpp/API代理)、Shell系统操作、搜索/向量DB | Go + HTTP API（每工作空间一个实例） |
| 远程浏览器 | 纯网页客户端（完全放弃原生应用） | 标准HTTP |

### C.6 MAGI分层说明

MAGI认知引擎的逻辑（三贤人并发决策、Trinity综合、ATF同步率计算、Seraph精神卫生监控）本质是复杂的TS逻辑，放在Renderer₁的JS运行时比Go更自然。Go kernel退化为：

- **裸LLM转发**：llama.cpp本地推理、远程LLM API代理，不参与认知决策
- **Shell系统操作**：MAGI Shell行动层的文件/进程/网络操作由Go执行，Renderer₁编排调用
- **数据网关**：存储、同步、搜索、向量DB

### C.7 上游兼容策略

**核心原则**：Go层最大化保持与上游SiYuan的一致性，s-forge定制尽量发生在Node层（Renderer₁）。

**Go Kernel的定位**：
- 承载不可避免的特殊系统调用
- 工作空间内的笔记数据和向量数据
- 最大化保持上游SiYuan Go kernel的代码一致性，降低合并成本

**Renderer₁（Node定制层）的策略**：
- s-forge新功能激进引入，不受Go层上游兼容性约束
- 对外伪装为与Go后端原生接口一致的API（对Renderer₂₃₄₅₆透明）
- 可以拦截、增强、替换Go kernel的原生接口，而UI层无感知

**Go层"开天窗"**：
- 当Node定制层需要直接接触笔记数据格式等Go层内部结构时
- 通过微定制给Go kernel添加最小化的专用接口
- 保持微定制的隔离性，不污染上游代码路径

**效果**：
- 上游SiYuan Go kernel更新可以低成本合并
- s-forge定制功能独立演进，不阻塞上游同步
- 必要时的Go层微定制有明确边界，可追踪

### C.8 Docker/NAS无头环境

**问题**：Electron提升到承载MAGI的地位后，Docker/NAS无头环境没有Electron，但Renderer₁的功能（MAGI认知引擎、编译、JS沙箱）仍然需要。

**解法**：Renderer₁的代码本质是Node.js/TS代码。通过preload桥接运行在Electron中只是桌面端的实现方式。同一套代码可以直接作为独立Node.js进程运行。

**运行时抽象**：

```
桌面端                          Docker/NAS端
┌─────────────┐                ┌─────────────┐
│ Electron    │                │ 独立Node.js  │
│ Renderer₁   │                │ 进程         │
│ (preload    │                │ (直接运行    │
│  桥接)      │                │  同一套TS)   │
└──────┬──────┘                └──────┬──────┘
       │                              │
       ▼                              ▼
┌─────────────────────────────────────────┐
│  s-forge Node层（同一套TS代码）           │
│  - MAGI认知引擎                         │
│  - 前端编译 (Vue SFC/SCSS/bundler)      │
│  - JS脚本沙箱                           │
└──────────────────┬──────────────────────┘
                   │ HTTP
                   ▼
┌─────────────────────────────────────────┐
│  Go Kernel (系统网关)                    │
└─────────────────────────────────────────┘
```

**关键设计约束**：
- s-forge Node层代码不得依赖Electron API，只依赖Node.js标准API
- preload层仅是薄适配层（桌面端：contextBridge封装；Docker端：直接调用）
- 这意味着Renderer₁的preload封装不仅是安全层，也是**运行时抽象层**

**Docker部署模式**：
- Go Kernel + 独立Node.js进程（替代Electron Renderer₁）
- 无UI窗口，纯HTTP服务
- 远程浏览器连接访问，与桌面端Renderer₂₃₄₅₆体验一致

### C.9 运行时抽象：preload的等价物是`vm`模块

**问题**：纯Node.js环境中，Electron preload的等价物是什么？

**答案**：`vm`模块。因为preload在Electron中承担**双重角色**：

1. **桥接**：通过`contextBridge.exposeInMainWorld()`暴露受控API给renderer上下文
2. **沙箱**：`contextIsolation`边界本身就是沙箱——Renderer₁中运行的代码（包括MAGI产出的JS代码）只能访问preload显式暴露的API，无法直接触及Node.js

Renderer₁不仅运行编译进程和MAGI自身，还运行**MAGI产出的JS代码**。这些产出代码必须在受控环境中执行。

**`vm`模块提供完全等价的双重能力**：

| preload角色 | Electron实现 | 纯Node.js (`vm`)等价 |
|------------|-------------|---------------------|
| 隔离上下文 | `contextIsolation: true` | `vm.createContext()` |
| 受控API注入 | `contextBridge.exposeInMainWorld()` | 向context注入指定对象 |
| 沙箱边界 | renderer无法访问Node.js | vm context无法访问宿主环境 |

| 环境 | 宿主层（完整Node.js访问） | 沙箱层（受控API） |
|------|------------------------|-----------------|
| Electron | preload脚本 | renderer窗口（contextIsolation） |
| 纯Node.js | 主进程 | `vm.createContext()`（注入受控API） |

**API一致性保证**：`@types/node` 作为唯一真相源 + 单一工厂函数。

不需要自定义`ISforgeAPI`接口——它只会是`@types/node`的不完整复制品。直接引用`@types/node`的模块类型：

```typescript
// 唯一真相源：@types/node 本身
// 工厂函数返回类型直接引用 Node.js 模块类型
interface SforgeNodeAPI {
  fs: typeof import('fs/promises');
  path: typeof import('path');
  child_process: typeof import('child_process');
  // ... 全量Node.js模块，机械化列举
}

function createSforgeNodeAPI(): SforgeNodeAPI {
  return { fs: require('fs/promises'), path: require('path'), /* ... */ }
}
```

```typescript
// Electron preload：注入机制 = contextBridge
contextBridge.exposeInMainWorld('node', createSforgeNodeAPI())

// 纯Node.js vm：注入机制 = vm.createContext
const ctx = vm.createContext({ node: createSforgeNodeAPI() })
```

同一个工厂、同一份实现。差异**仅在注入机制**（一行代码）。`@types/node`保证类型一致，无需维护额外接口定义。参数验证层可在工厂函数内统一添加。

### C.10 开发环境策略

**标准开发入口不再是Electron app，而是Renderer₁等价物（独立Node.js进程）。**

开发时直接启动Node.js进程运行s-forge Node层代码：

- s-forge Node层模块直接import运行（无需preload桥接）
- HTTP伺服前端资源，浏览器连接作为UI（与Renderer₂₃₄₅₆一致）

**开发流程**：
```
开发时（标准入口）
┌─────────────────────────────────┐
│  Node.js 进程 (直接import模块)   │
│  - s-forge Node层全部代码        │
│  - MAGI / 编译 / JS沙箱(vm)     │
│  - HTTP伺服前端资源              │
└────────────┬────────────────────┘
             │ HTTP
             ▼
┌─────────────────────────────────┐
│  浏览器 (UI)                     │
│  - 与生产环境Renderer₂₃₄₅₆一致  │
└────────────┬────────────────────┘
             │ HTTP
             ▼
┌─────────────────────────────────┐
│  Go Kernel                      │
└─────────────────────────────────┘
```

**优势**：
- 开发不依赖Electron，启动快、调试方便
- 与Docker/NAS部署模式完全一致，开发即生产
- Electron仅在桌面端打包发布时引入，作为纯壳层

### C.11 移动端策略与产品定位

- 产品形态决定用户必然拥有桌面设备，原生移动端额外改进是过度设计
- 移动端保持上游SiYuan已支持的功能，不做额外改进
- 分支移动端重点仅两项：快捷偶发输入、MAGI聊天界面
- 移动端是桌面端的轻量补充，不是独立产品形态

### C.12 建议下一步

1. 实现Renderer₁的preload层Node.js全量API封装（机械化工作，基于TS定义生成参数验证+透传代码）
2. 评估当前webpack配置向esbuild/vite的迁移成本（在Renderer₁中执行）
3. 确保所有业务数据操作走Go kernel HTTP API
4. 设计MAGI认知引擎的TS架构（Renderer₁侧），明确与Go kernel裸LLM转发的接口
5. 建立Go层微定制的管理规范（标记、隔离、文档化）
6. 设计s-forge Node层的运行时抽象接口（确保桌面端/Docker端代码统一）
