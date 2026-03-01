# 条件编译调查结果

## 1. docs/ 目录顶层结构

```
docs/
├── 分析/
├── 归档/
├── 规程/
├── 技术文档/
├── 技术指南/
├── 设计/
├── 最佳实践/
├── kernel-av-optimization-plans/
├── research/
├── ttt/
└── vectordb/
```

## 2. docs/ttt/ 目录文件列表

### 顶层
- README.md
- AIagent设计.ttt.md, AIagent设计文档拆分.ttt.md
- api请求重构.ttt.md
- build-fix-warnings.ttt.md
- git-merge-origin-dev.ttt.md, git-merge-origin-dev-f3390e37.ttt.md
- 后端关系图引擎增强计划.ttt.md, 后端向量数据库超大规模数据支持计划.ttt.md
- 键盘事件处理重构.ttt.md, 内核优化与维护.ttt.md
- 前端架构迁移.ttt.md, 前端维护.ttt.md, 文档整理任务.ttt.md
- 调查/临时文件: build-errors-investigation.md, conflict-scan-result.md, git-merge-investigation.md, git-merge-verification.md, merge-verification-A/B/C.md, outline-investigation.md

### 子目录
- `archive/`: 性能优化指南文档拆分.ttt.md, lint-top-errors-script.ttt.md
- `frontend/`: 18个前端任务ttt文件
- `input/`: 表格事件处理重构, 代码块事件重构, 键盘事件处理重构-列表归并设计
- `kernel/`: kernel-av相关优化, kernelApiClient迁移
- `vectordb/`: 约35个向量数据库相关ttt和分析文件

## 3. docs/ 目录下的 .procedure.md 文件

```
docs/规程/
├── tiktoctac文档(ttt)编写规程.procedure.md
├── 版本管理/
│   └── 远程分支合并.procedure.md
├── 测试与修复/
│   ├── 后端Go并发bug修复.procedure.md
│   ├── 后端Go测试编写.procedure.md
│   └── 前端测试执行与错误修复.procedure.md
├── 代码质量/
│   ├── 代码拆分与模块化.procedure.md
│   ├── 类型守卫重构.procedure.md
│   ├── API请求重构.procedure.md
│   ├── Go后端代码重构.procedure.md
│   └── lint错误修复.procedure.md
├── 后端开发/
│   └── Go模块实现.procedure.md
├── 文档管理/
│   ├── 文档分类.procedure.md
│   ├── 文档命名.procedure.md
│   └── 文档迁移.procedure.md
└── 性能优化/
    ├── 多阶段任务执行跟踪文档(ttt)编写.procedure.md
    ├── 向量数据库召回率优化.procedure.md
    └── 性能优化.procedure.md
```

共计 17 个规程文件。

## 4. 条件编译使用情况

### 4.1 webpack DefinePlugin 定义的编译时常量

四个 webpack 配置文件均定义了以下常量：

| 常量 | webpack.config.js | webpack.desktop.js | webpack.mobile.js | webpack.export.js |
|------|---|---|---|---|
| `SIYUAN_VERSION` | ✅ `pkg.version` | ✅ `pkg.version` | ✅ `pkg.version` | ✅ `pkg.version` |
| `NODE_ENV` | ✅ `argv.mode` | ✅ `argv.mode` | ✅ `argv.mode` | ✅ `argv.mode` |
| `__VUE_OPTIONS_API__` | ✅ `true` | ✅ `true` | ✅ `true` | ✅ `true` |
| `__VUE_PROD_DEVTOOLS__` | ✅ `false` | ✅ `false` | ✅ `false` | ✅ `false` |

### 4.2 TypeScript 中的常量声明与使用

`app/src/constants.ts` 中：
```typescript
declare const SIYUAN_VERSION: string;
declare const NODE_ENV: string;

const _SIYUAN_VERSION = SIYUAN_VERSION;
const _NODE_ENV = NODE_ENV;

export abstract class Constants {
    public static readonly SIYUAN_VERSION: string = _SIYUAN_VERSION;
    public static readonly NODE_ENV: string = _NODE_ENV;
    // ...
}
```

`Constants.SIYUAN_VERSION` 在整个项目中被广泛使用（35处匹配），主要用于：
- URL 缓存破坏参数 `?v=${Constants.SIYUAN_VERSION}`
- 版本号显示
- 导出 HTML 中的版本标记

`process.env.NODE_ENV` 未在 app/src/ 中直接使用（通过 DefinePlugin 的 `NODE_ENV` 替代）。

### 4.3 `/// #if` 预处理指令（核心条件编译机制）

项目大量使用 `/// #if` / `/// #endif` 预处理指令，这是通过 webpack loader（如 `ifdef-loader` 或类似工具）实现的条件编译。搜索结果超过 300 处匹配。

#### 使用的条件标志

| 标志 | 含义 | 使用频率 |
|------|------|---------|
| `/// #if !MOBILE` | 非移动端代码 | 极高（最常见） |
| `/// #if MOBILE` | 仅移动端代码 | 高 |
| `/// #if !BROWSER` | 非浏览器环境（Electron桌面端） | 高 |
| `/// #if BROWSER` | 仅浏览器环境 | 中 |
| `/// #if BROWSER && !MOBILE` | 浏览器但非移动端（平板） | 低 |

#### 典型使用模式

1. **平台特定导入**：
```typescript
/// #if !BROWSER
import { ipcRenderer } from "electron";
/// #endif
```

2. **平台特定代码块**：
```typescript
/// #if MOBILE
reloadLocation();
/// #endif
```

3. **互斥分支**：
```typescript
/// #if MOBILE
openMobileFileById(app, id, actions);
/// #endif
/// #if !MOBILE  (隐含的 else)
openFileById({ app, id, action: actions });
/// #endif
```

4. **函数级条件编译**：
```typescript
/// #if !BROWSER
export const getLocalFiles = async () => { ... };
/// #endif
```

#### 涉及的主要模块

条件编译遍布整个前端代码库，主要集中在：
- `protyle/` (编辑器核心) - 最密集
- `layout/` (布局系统)
- `editor/` (编辑器工具)
- `search/` (搜索功能)
- `plugin/` (插件系统)
- `util/` (工具函数)
- `mobile/` (移动端)
- `config/` (配置)
- `sync/` (同步)

### 4.4 其他条件编译相关模式

- **`typeof` 环境检查**：182处匹配，但绑大多数是类型守卫（type guard），非环境判断。少数例外：
  - `typeof AudioContext !== "undefined"` (音频API检测)
  - `typeof Buffer !== "undefined"` (Node.js Buffer检测)
  - `typeof Lute === "undefined"` (Lute库加载检测)
  - `typeof speechSynthesis === "undefined"` (语音合成API检测)
  - `typeof window === "undefined" && typeof process !== "undefined"` (Node.js环境检测，在 `executor.helpers.ts`)

- **`window.__SIYUAN__`**：未使用。
- **`__dirname` / `__filename`**：未在 app/src/ 中直接使用。
- **`#ifdef` 等 C 风格预处理指令**：未使用，仅使用 `/// #if` 风格。

## 5. 总结

项目的条件编译体系由两层构成：

1. **webpack DefinePlugin**：定义 `SIYUAN_VERSION`、`NODE_ENV`、Vue 相关标志，在编译时替换为具体值。
2. **`/// #if` 预处理指令**：基于 `MOBILE`、`BROWSER` 标志进行代码块级条件编译，是项目最主要的条件编译机制，使用极其广泛（300+处）。
