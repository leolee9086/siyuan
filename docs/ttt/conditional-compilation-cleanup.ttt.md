# 条件编译清理计划

> **创建时间**: 2026-02-20
> **完成时间**: 2026-02-20
> **状态**: ✅ 已完成
> **前置调研**: [conditional-compilation-investigation.md](./conditional-compilation-investigation.md)

## 0. 规程检查结果

**未找到适用规程。** 现有规程中：

- `代码质量/代码拆分与模块化.procedure.md` — 明确排除"功能重构"场景
- `代码质量/lint错误修复.procedure.md` — 明确排除"大规模代码重构"场景

**前置要求：需要先创建 `docs/规程/代码质量/前端条件编译清理.procedure.md` 规程，经批准后方可开始执行。**

---

## 1. 当前问题分析

### 1.1 条件编译机制

项目使用 `ifdef-loader` webpack loader，通过 `/// #if` / `/// #endif` 预处理指令实现条件编译，基于两个布尔标志：

| 标志 | 含义 |
|------|------|
| `BROWSER` | 是否运行在浏览器环境（非 Electron） |
| `MOBILE` | 是否为移动端 |

四个构建目标：

| webpack配置 | BROWSER | MOBILE | 平台 |
|---|---|---|---|
| webpack.config.js | false | false | Electron桌面端 |
| webpack.desktop.js | true | false | 浏览器桌面端 |
| webpack.mobile.js | true | true | 浏览器移动端 |
| webpack.export.js | true | mixed | 导出功能 |

### 1.2 具体问题

1. **编译时代码消除不可见**：`/// #if` 指令在源码层面不可见于 TypeScript 编译器，IDE 无法进行死代码分析，类型检查覆盖不完整
2. **非标准语法**：依赖特定 webpack loader，与标准 TypeScript/JavaScript 工具链不兼容
3. **维护困难**：300+ 处散布在整个代码库中，条件分支的正确性完全依赖人工审查
4. **隐式互斥分支**：`/// #if MOBILE` 和 `/// #if !MOBILE` 并列但无显式 else 关系，容易遗漏分支
5. **平台特定导入**：`electron` 等模块的条件导入在非 Electron 构建中被静默移除，但 TypeScript 仍会尝试解析

### 1.3 使用模式分类

根据调研，条件编译的使用可归为四类：

| 模式 | 示例 | 频率 | 清理难度 |
|------|------|------|---------|
| A. 平台特定导入 | `/// #if !BROWSER` + `import { ipcRenderer }` | 中 | 高 |
| B. 平台特定代码块 | `/// #if MOBILE` + 单行/多行代码 | 极高 | 中 |
| C. 互斥分支 | `/// #if MOBILE` ... `/// #if !MOBILE` | 高 | 中 |
| D. 函数级条件编译 | 整个函数被 `/// #if` 包裹 | 低 | 低 |

---

## 2. 替代方案设计

### 2.1 核心思路

用**类型安全的运行时平台检测**替代编译时代码消除。

### 2.2 平台检测模块

创建一个集中的平台检测模块，在应用启动时确定平台类型：

```typescript
// app/src/platform/index.ts

export type Platform = "electron" | "browser-desktop" | "browser-mobile";

/** 运行时平台检测，应用启动时调用一次 */
function detectPlatform(): Platform {
  // 检测逻辑基于现有 webpack 构建矩阵的语义
  // 具体实现由执行子任务决定
}

export const platform: Platform = detectPlatform();

export const isBrowser: boolean = platform !== "electron";
export const isMobile: boolean = platform === "browser-mobile";
export const isElectron: boolean = platform === "electron";
```

### 2.3 平台特定导入处理（模式 A）

`electron` 模块的条件导入是最复杂的场景。替代方案：

- 使用动态 `import()` 或 `require()` 在运行时按需加载
- 将 Electron API 调用封装到平台适配层，非 Electron 环境提供空实现或抛出错误

### 2.4 平台分支处理（模式 B/C）

将 `/// #if` 分支替换为运行时 `if` 判断：

```typescript
// 替换前
/// #if MOBILE
reloadLocation();
/// #endif

// 替换后
if (isMobile) {
  reloadLocation();
}
```

### 2.5 函数级条件编译处理（模式 D）

整个函数被条件编译包裹的情况，改为在函数内部进行平台守卫：

```typescript
// 替换前
/// #if !BROWSER
export const getLocalFiles = async () => { ... };
/// #endif

// 替换后
export const getLocalFiles = async () => {
  if (isBrowser) {
    throw new Error("getLocalFiles is not available in browser environment");
  }
  // ... 原有实现
};
```

### 2.6 Tree-shaking 考量

运行时分支不会被编译时消除，会增加最终 bundle 体积。评估策略：

- 对于小型代码块（模式 B/C），体积影响可忽略
- 对于大型平台特定模块（模式 A/D），考虑保留动态 import 或 webpack 别名方案
- 需要在清理过程中实测 bundle 体积变化

---

## 3. 分阶段清理步骤

### 阶段 0：前置准备 ✅

- [x] 创建 `docs/规程/代码质量/前端条件编译清理.procedure.md` 并获得批准
- [x] 建立 bundle 体积基线（记录当前各构建目标的产物大小）

### 阶段 1：基础设施 ✅

- [x] 创建 `app/src/platform/index.ts` 平台检测模块
- [x] 创建 Electron API 适配层（封装 `ipcRenderer`、`shell` 等）
- [x] 验证平台检测在所有四个构建目标中正确工作

### 阶段 2：低风险清理（模式 D — 函数级） ✅

- [x] 识别所有函数级条件编译的使用点（9处/9文件）
- [x] 逐个替换为运行时平台守卫
- [x] 每个模块替换后验证构建和基本功能

### 阶段 3：中等风险清理（模式 B/C — 代码块级） ✅

- [x] 批次1：util/sync/emoji/history/card/window（20文件）
- [x] 批次2：config/dialog
- [x] 批次3：editor/search
- [x] 批次4：boot/plugin
- [x] 批次5：menus（19文件）
- [x] 批次6：layout
- [x] protyle 全量清理（scroll/undo/ui/export/preview/hint/toolbar/gutter/render/av/breadcrumb/header/util/root/wysiwyg，38+文件）
- [x] 残留清理（ai/asset/block/index/plugin，14文件）

### 阶段 4：高风险清理（模式 A — 平台特定导入） ✅

- [x] 将 `electron` 相关导入迁移到适配层
- [x] 替换所有 `/// #if !BROWSER` + `import` 模式
- [x] 全面回归测试（4个webpack构建目标全部通过）

### 阶段 5：收尾 ✅

- [x] 最终验证：`app/src/` 下零残留条件编译指令（排除 `.remote.ts` 和 `platform/` JSDoc）
- [x] 4个webpack构建目标（app/mobile/desktop/export）全部通过
- [x] 更新相关文档

---

## 4. 风险评估

| 风险 | 严重程度 | 可能性 | 缓解措施 |
|------|---------|--------|---------|
| Electron API 在浏览器环境被调用导致崩溃 | 高 | 中 | 适配层提供安全的空实现或错误提示 |
| Bundle 体积显著增大 | 中 | 低 | 大型平台模块保留动态 import；阶段 5 实测对比 |
| 运行时分支遗漏导致功能异常 | 高 | 中 | 逐模块替换，每次替换后在所有平台验证 |
| 替换过程中引入类型错误 | 中 | 低 | TypeScript 严格模式会捕获大部分问题 |
| 300+ 处修改的工作量导致长期分支 | 中 | 高 | 分阶段提交，每阶段独立可合并 |

---

## 5. 进度记录

| 日期 | 事项 | 状态 |
|------|------|------|
| 2026-02-20 | 完成调研，创建清理计划 | ✅ |
| 2026-02-20 | 创建前端条件编译清理规程 | ✅ |
| 2026-02-20 | 阶段1：平台检测模块 + Electron API 适配层 | ✅ |
| 2026-02-20 | 阶段2：函数级条件编译清理（9处/9文件） | ✅ |
| 2026-02-20 | 阶段3批次1：util/sync/emoji/history/card/window（20文件） | ✅ |
| 2026-02-20 | 阶段3批次2：config/dialog | ✅ |
| 2026-02-20 | 阶段3批次3：editor/search | ✅ |
| 2026-02-20 | 阶段3批次4：boot/plugin | ✅ |
| 2026-02-20 | 阶段3批次5：menus（19文件） | ✅ |
| 2026-02-20 | 阶段3批次6：layout | ✅ |
| 2026-02-20 | 阶段3 protyle 全量清理（38+文件） | ✅ |
| 2026-02-20 | 残留清理：ai/asset/block/index/plugin（14文件） | ✅ |
| 2026-02-20 | 最终验证通过，任务完成 | ✅ |

---

## 6. 最终总结

### 完成统计

- 原始条件编译指令：300+处，分布在75+文件
- 排除项：`config/about.remote.ts`（保留条件编译）
- 最终验证：`app/src/` 下零残留（排除 `.remote.ts` 和 `platform/` JSDoc）
- 构建验证：4个webpack目标（app/mobile/desktop/export）全部通过

### 新增基础设施

- `app/src/platform/index.ts` — 运行时平台检测（isBrowser/isMobile/isElectron/isBrowserDesktop）
- `app/src/platform/platform.types.ts` — Platform 类型定义
- `app/src/platform/electron/` — Electron API 适配层（ipcRenderer/shell/webFrame/webUtils/clipboard），使用 `__non_webpack_require__("electron")` 延迟加载

### 关键问题及解决方案

1. **no-else lint 规则冲突** → 改用 guard clause 模式
2. **electron 静态导入在 browser 构建中失败** → `__non_webpack_require__("electron")` 适配层
3. **fs/path 静态导入暴露** → 同样使用 `__non_webpack_require__`
4. **无空格变体 `///#if` 遗漏** → 二次扫描发现并清理
