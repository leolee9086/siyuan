# Electron 模块导入调查报告

## 调查目标

条件编译清理后，如何安全地在浏览器构建中避免 electron 依赖解析失败。

## 一、Webpack 配置关键差异

| 配置文件 | target | BROWSER | MOBILE | externals | resolve.fallback | resolve.alias |
|----------|--------|---------|--------|-----------|-----------------|---------------|
| webpack.config.js (Electron桌面) | `electron-renderer` | false | false | 无 | 无 | `sharp$: false`, `onnxruntime-node$: false` |
| webpack.desktop.js (浏览器桌面) | 未设置(默认web) | true | false | 无 | `path: path-browserify` | 无 |
| webpack.mobile.js (浏览器移动) | 未设置(默认web) | true | true | 无 | `path: path-browserify` | 无 |
| webpack.export.js (导出) | 未设置(默认web) | true | TS:true/JS:false | 无 | `path: path-browserify` | 无 |

### 关键发现

1. **Electron 构建**：`target: "electron-renderer"` 使 webpack 隐式将 `electron` 视为外部模块，无需 `externals` 配置
2. **浏览器构建**：三个配置均无 `target`（默认 `web`），无 `externals`，完全依赖 `ifdef-loader` + `/// #if !BROWSER` 在编译时移除 electron 导入
3. **所有配置**均使用 `ifdef-loader`，但只有浏览器构建设置 `BROWSER: true`
4. **PatchResolverPlugin**：所有配置均使用，支持 `.patch.ts` 文件覆盖，可作为平台差异化的辅助手段

## 二、Electron 导入现状分类

### A. 有 `/// #if !BROWSER` 保护的 ES import（约25处）

ifdef-loader 在 `BROWSER=true` 时移除整个块，webpack 不会看到这些 import。

代表文件：`menus/workspace.ts`, `layout/topBar.ts`, `boot/onGetConfig.ts`, `config/keymap.ts` 等。

### B. 无保护的 ES import（约5处）

这些文件位于 `window/` 目录和少数其他位置，仅在 Electron 构建中使用：

- `window/setHeader.ts` — `import { ipcRenderer } from "electron"`
- `window/init.ts` — `import { ipcRenderer, webFrame } from "electron"`
- `window/closeWin.ts` — `import { ipcRenderer } from "electron"`
- `protyle/undo/index.ts` — `import { ipcRenderer } from "electron"`（无保护！）

`window/` 下的文件仅被 Electron 入口 `webpack.config.js` 引用（entry: `./src/window/index.ts`），浏览器构建不包含此入口，因此不会被打包。

`protyle/undo/index.ts` 是例外——它被所有构建共享，但其 electron import 无 `/// #if !BROWSER` 保护。当前能构建成功可能是因为该 import 实际上在某个更大的 `/// #if` 块内，或者是近期引入的 bug。

### C. 适配层中的运行时 require（3处）

- `platform/electron/ipcRenderer.ts` — `require("electron").ipcRenderer`
- `platform/electron/shell.ts` — `require("electron").shell`
- `menus/commonMenuItem.openMenu.ts` — `window.require && window.require("electron")`

这些 `require` 调用同样会被 webpack 在构建时解析。当前适配层文件如果被浏览器构建引入，`require("electron")` 会导致构建失败。

## 三、核心问题

移除 `/// #if !BROWSER` 后：
1. ES `import { ipcRenderer } from "electron"` 会被 webpack 静态分析并尝试解析 electron 模块
2. 浏览器构建中 `target` 为 `web`，webpack 不知道 electron 是外部模块
3. electron 依赖 `fs`、`path` 等 Node.js 模块，解析链式失败
4. `require("electron")` 同样被 webpack 静态分析，不能绕过问题

## 四、解决方案评估

### 方案 A：webpack externals

在浏览器构建配置中添加：
```js
externals: { electron: "commonjs2 electron" }
```

- **效果**：webpack 不解析 electron，输出中保留 `require("electron")` 原样
- **问题**：`target: "web"` 下，webpack 生成的外部模块包装代码会在 bundle 初始化时执行 `require("electron")`，而浏览器环境无 `require` 函数，**即使代码路径有运行时守卫也会失败**
- **评估**：❌ 不可行（除非配合其他手段处理 require 不存在的问题）

### 方案 B：webpack resolve.alias 指向空模块

```js
resolve: {
    alias: { electron: false }  // 或指向空 shim 文件
}
```

- **效果**：webpack 将 `electron` 解析为空模块，`import { ipcRenderer } from "electron"` 得到 `undefined`
- **优点**：构建不会失败
- **问题**：所有从 electron 导入的符号变为 `undefined`，如果代码路径未正确守卫会静默失败而非明确报错
- **评估**：⚠️ 可行但有风险，需要确保所有使用点都有运行时检查

### 方案 C：`__non_webpack_require__` 绕过 webpack

将适配层中的 `require("electron")` 改为：
```ts
_ipcRenderer = __non_webpack_require__("electron").ipcRenderer;
```

- **效果**：webpack 完全忽略此 require，输出中保留原始 `require()` 调用
- **优点**：Electron 环境中 `require` 可用（Node.js 集成），浏览器中代码路径被守卫不会执行
- **问题**：仅适用于 `require` 形式，不能解决 ES `import` 语句；需要 TypeScript 类型声明
- **评估**：✅ 适合适配层内部使用，但不能单独解决所有 import

### 方案 D：仅对 import 语句保留 `/// #if`

保留 `/// #if !BROWSER` 仅包裹 `import` 语句，函数体内改用运行时检查 + 适配层调用。

- **优点**：最小化条件编译范围，逻辑代码完全运行时化
- **问题**：仍依赖 ifdef-loader，没有完全消除条件编译
- **评估**：❌ 不可接受——任何保留条件编译的方案均被否决

### 方案 E（推荐）：适配层 + `__non_webpack_require__` 组合

1. **适配层**（已有 `platform/electron/ipcRenderer.ts` 和 `shell.ts`）扩展覆盖所有 electron API（`webFrame`, `webUtils`, `clipboard`, `FileFilter` 等）
2. 适配层内部使用 `__non_webpack_require__("electron")` 替代 `require("electron")`，彻底绕过 webpack 解析
3. 所有业务代码从适配层导入，不再直接 `import from "electron"`
4. 移除所有 `/// #if !BROWSER` 包裹的 electron import 块，改为从适配层导入 + 运行时守卫

**优点**：
- 完全消除 electron 相关的条件编译
- webpack 不会尝试解析 electron（`__non_webpack_require__` 对 webpack 不可见）
- 运行时守卫提供明确的错误信息
- 类型安全（适配层提供 TypeScript 类型）

**需要的工作**：
- 扩展适配层，增加 `webFrame`, `webUtils`, `clipboard` 等封装
- 迁移约 25-30 个文件的 electron 直接导入
- 为 `__non_webpack_require__` 添加 TypeScript 类型声明

### 方案 F：resolve.alias + 空 shim + 适配层

浏览器构建中：
```js
resolve: {
    alias: { electron: path.resolve(__dirname, "src/platform/electron/electron-browser-shim.ts") }
}
```

shim 文件导出所有 electron API 的空实现/抛错实现。

- **优点**：ES import 语句无需修改即可构建通过；shim 可提供明确的错误信息
- **问题**：需要维护 shim 文件与 electron API 的同步；所有 import 都会被重定向，包括适配层的
- **评估**：⚠️ 可行，但 shim 维护成本较高

## 五、结论与建议

**推荐方案 E**（适配层 + `__non_webpack_require__`），理由：

1. 已有 `ipcRenderer` 和 `shell` 适配层，模式已验证
2. `__non_webpack_require__` 是 webpack 官方支持的机制，零风险
3. 完全消除 electron 相关条件编译，符合清理目标
4. 不需要修改任何 webpack 配置文件
5. 运行时守卫 + `isElectron` 检测已就绪（`platform/index.ts`）

**需要额外封装的 electron API**（基于搜索结果）：
- `webFrame`（`layout/Wnd.ts`, `layout/topBar.ts`, `boot/onGetConfig.ts`, `window/init.ts`）
- `webUtils`（`protyle/util/dnd/onDrop.ts`, `protyle/render/av/blockAttr.ts`）
- `clipboard`（`protyle/util/compatibility.ts`）
- `FileFilter` 类型（`menus/navigation.ts`）

**注意事项**：
- `protyle/undo/index.ts` 中的无保护 electron import 是潜在 bug，需优先处理
- `protyle/export/index.ts` 中模板字符串内的 `require("electron")` 是运行时代码（注入到 HTML），不受 webpack 解析影响，无需处理
- `window/` 目录下的文件仅被 Electron 入口引用，可最后处理或保持原样
