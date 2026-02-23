# Model 循环依赖调查

## 错误现象

```
Uncaught ReferenceError: Cannot access 'Model' before initialization
    at Module.Model (Model.ts:3:52)
    at eval (Backlink.ts:16:31)
```

## 1. 残留条件编译指令

搜索 `app/src/` 中的 `/// #if` / `/// #endif`，发现：

- `app/src/config/about.remote.ts` — 仍包含完整的 `/// #if !BROWSER` / `/// #endif` 指令块（第2-4行、第302-310行、第402-414行、第422-435行）
- 其余文件中的 `/// #if` 仅出现在注释中（说明性文字），不是实际指令

**结论**：`about.remote.ts` 是遗漏的残留文件，但它不是本次循环依赖错误的直接原因。

## 2. 循环依赖链完整路径

```
Model.ts:4  →  import { kernelError, reloadSync } from "../dialog/processSystem"
    processSystem.ts:5  →  import { getDockByType } from "../layout/tabUtil"
        tabUtil.ts:14  →  import { Backlink } from "./dock/Backlink"
            Backlink.ts:2  →  import { Model } from "../Model"  ← 回到起点
```

**执行顺序分析**：
1. 某入口（如 `index.ts:3`）首次 import `Model`
2. JS 引擎开始求值 `Model.ts`，遇到第4行 import `processSystem`
3. 求值 `processSystem.ts`，遇到第5行 import `tabUtil`
4. 求值 `tabUtil.ts`，遇到第14行 import `Backlink`
5. 求值 `Backlink.ts`，遇到第2行 import `Model` — 此时 `Model.ts` 尚未完成求值
6. `Model` 是 `class` 声明（TDZ），访问未初始化的绑定 → **ReferenceError**

注意：`index.ts` 本身也存在 `Model ↔ App` 的双向依赖（`index.ts:3` import Model，`Model.ts:5` import App from index），但这不是触发错误的直接路径。

## 3. 根因分析

这个循环依赖链**预先存在**，并非移除 ifdef-loader 直接引入。

关键点：ifdef-loader 在 webpack 构建时会根据条件删除代码块。如果之前某些 import 语句位于 `/// #if` 块内，ifdef-loader 会在特定构建目标下移除它们，从而打断循环链。移除 ifdef-loader 后，所有 import 语句都会被保留，循环链完整暴露。

但从当前代码看，循环链上的4个 import 都不在任何条件编译块内，因此更可能的情况是：
- 这个循环依赖一直存在，但 webpack 的模块求值顺序在有 ifdef-loader 时恰好不触发 TDZ 错误
- 移除 ifdef-loader 改变了模块图的拓扑结构（因为条件删除的代码现在保留了），导致求值顺序变化，暴露了这个潜在问题

## 4. 修复建议

### 方案A：延迟导入（最小改动）
在 `processSystem.ts` 中将 `getDockByType` 改为延迟导入（在函数体内 `import()`），打断循环链。

### 方案B：拆分 tabUtil.ts
`tabUtil.ts` 同时导入了大量 dock 组件（Backlink、Bookmark、Tag、Graph 等），是循环依赖的汇聚点。将 `getDockByType` 等不依赖具体 dock 类型的工具函数拆分到独立文件。

### 方案C：拆分 Model.ts 的依赖
`Model.ts` 作为基类不应依赖 `processSystem` 这样的高层模块。将 `kernelError`、`reloadSync` 的调用改为回调注入或事件机制。

**推荐**：方案A 最小改动，方案C 最彻底。
