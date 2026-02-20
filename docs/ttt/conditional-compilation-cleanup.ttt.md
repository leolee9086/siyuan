# 条件编译清理计划

> **创建时间**: 2026-02-20
> **状态**: 规划中
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

### 阶段 0：前置准备

- [ ] 创建 `docs/规程/代码质量/前端条件编译清理.procedure.md` 并获得批准
- [ ] 建立 bundle 体积基线（记录当前各构建目标的产物大小）

### 阶段 1：基础设施

- [ ] 创建 `app/src/platform/index.ts` 平台检测模块
- [ ] 创建 Electron API 适配层（封装 `ipcRenderer` 等调用）
- [ ] 验证平台检测在所有四个构建目标中正确工作

### 阶段 2：低风险清理（模式 D — 函数级）

- [ ] 识别所有函数级条件编译的使用点
- [ ] 逐个替换为运行时平台守卫
- [ ] 每个模块替换后验证构建和基本功能

### 阶段 3：中等风险清理（模式 B/C — 代码块级）

- [ ] 按模块分批处理（优先处理 `util/`、`config/` 等低耦合模块）
- [ ] 替换平台特定代码块和互斥分支为运行时 `if` 判断
- [ ] 每批次验证构建

### 阶段 4：高风险清理（模式 A — 平台特定导入）

- [ ] 将 `electron` 相关导入迁移到适配层
- [ ] 替换所有 `/// #if !BROWSER` + `import` 模式
- [ ] 全面回归测试

### 阶段 5：收尾

- [ ] 移除 `ifdef-loader` 依赖和 webpack 配置中的 ifdef 相关配置
- [ ] 对比 bundle 体积变化，评估是否需要优化
- [ ] 更新相关文档

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
| - | 创建前端条件编译清理规程 | 待开始 |
