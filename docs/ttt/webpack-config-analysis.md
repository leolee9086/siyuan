# Webpack 配置深度对比分析

> 目标：识别哪些构建时差异可以收敛到运行时行为 + TS 类型可判定，为统一重构提供依据。

## 1. 核心发现：入口文件共享关系

```
src/index.ts ──────┬── webpack.config.js  (electron)
                   └── webpack.desktop.js (browser-desktop)

src/mobile/index.ts ── webpack.mobile.js  (browser-mobile)
src/window/index.ts ── webpack.config.js  (electron 子窗口, 第二entry)
src/protyle/method.ts ─ webpack.export.js (UMD 库导出)
```

**关键事实：`src/index.ts` 已经同时服务于 electron 和 browser-desktop 两个构建目标。**
代码内部已通过 `platform/index.ts` 的运行时检测（`isBrowser`、`isBrowserDesktop`）处理平台差异。
这证明 electron 与 browser-desktop 之间的代码行为差异已经是运行时可判定的。

## 2. 四个配置的逐字段对比

### 2.1 真正的构建目标差异（webpack 层面不可避免）

| 字段 | config.js | desktop.js | mobile.js | export.js |
|---|---|---|---|---|
| target | `electron-renderer` | web(默认) | web(默认) | web(默认) |
| entry | index.ts + window/index.ts | index.ts | mobile/index.ts | protyle/method.ts |
| output.path | stage/build/app | stage/build/desktop | stage/build/mobile | stage/build/export |
| output.publicPath | `auto` | `/stage/build/desktop/` | `/stage/build/mobile/` | `auto` |
| output.library* | 无 | 无 | 无 | UMD `Protyle` |
| resolve.fallback.path | 无 | path-browserify | path-browserify | path-browserify |
| HtmlWebpackPlugin | 2个(index+window) | 1个(index) | 1个(index) | 无 |
| HTML模板 | app/*.tpl | desktop/*.tpl | mobile/*.tpl | 无 |

这些差异可以通过一个统一配置文件 + 构建目标参数来参数化，不需要4个独立文件。

### 2.2 可直接统一的配置（4个文件完全一致）

- **mode/watch/devtool**：逻辑完全一致
- **vue-loader 配置**：完全一致（hoistStatic:false, cacheHandlers:false, isTS:true）
- **esbuild-loader for .ts/.js**：完全一致（target:es2020）
- **DefinePlugin 变量**：完全一致（SIYUAN_VERSION, NODE_ENV, __VUE_OPTIONS_API__, __VUE_PROD_DEVTOOLS__）
- **PatchResolverPlugin**：全部使用
- **VueLoaderPlugin**：全部使用
- **MiniCssExtractPlugin**：全部使用
- **CleanWebpackPlugin**：全部使用（仅 cleanOnceBeforeBuildPatterns 路径不同）

### 2.3 resolve.alias 差异分析

| alias | config.js | desktop.js | mobile.js | export.js | 分析 |
|---|---|---|---|---|---|
| `@` → src | ✅ | ❌缺失 | ✅ | ✅ | desktop缺失疑似bug |
| `vue` → esm-bundler | ❌ | ✅ | ✅ | ✅ | electron不需要，浏览器需要 |
| `sharp$` → false | ✅ | ❌ | ❌ | ❌ | 仅electron需排除 |
| `onnxruntime-node$` → false | ✅ | ❌ | ❌ | ❌ | 仅electron需排除 |

**可参数化**：根据 `target === 'electron-renderer'` 条件决定 alias 集合。

### 2.4 module.rules 差异分析

| 规则 | config.js | desktop.js | mobile.js | export.js | 可统一？ |
|---|---|---|---|---|---|
| .vue | ✅ 一致 | ✅ 一致 | ✅ 一致 | ✅ 一致 | ✅ |
| .tpl | app/*.tpl | desktop/*.tpl | mobile/*.tpl | 无 | 参数化include路径 |
| .ts(x?) | ✅ 一致 | ✅ 一致 | ✅ 一致 | ✅ 一致 | ✅ |
| .js | ✅ 一致(**重复2次**) | ✅ 一致 | ✅ 一致 | ✅ 一致 | ✅ |
| .scss | dev:vue-style/prod:extract | 同左 | 同左 | 始终extract | 参数化 |
| .png/.svg | ✅ | ✅ | ✅ | 无 | 参数化 |

**Bug**：webpack.config.js 第80-107行，`.js` esbuild-loader 规则完全重复定义了两次。

## 3. 入口文件行为深度对比

### 3.1 src/index.ts vs src/window/index.ts（同属 electron 构建）

两者的 `msgCallback` switch/case 高度重叠：

| ws命令 | index.ts | window/index.ts |
|---|---|---|
| setAppearance | ✅ | ✅ |
| setSnippet | ✅ | ✅ |
| setDefRefCount | ✅ | ✅ |
| setRefDynamicText | ✅ | ✅ |
| reloadPlugin | ✅ | ✅ |
| reloadEmojiConf | ✅ | ✅ |
| syncMergeResult | ✅ | ✅ |
| reloaddoc | ✅ | ✅ |
| readonly | ✅ | ✅ |
| setConf | ✅ | ✅ |
| progress | ✅ | ✅ |
| setLocalStorageVal | ✅ | ✅ |
| rename | ✅ | ✅ |
| unmount | ✅ | ✅ |
| removeDoc | ✅ | ✅ |
| statusbar | ✅ | ✅ |
| txerr | ✅ | ✅ |
| syncing | ✅ | ✅ |
| backgroundtask | ✅ | ✅ |
| refreshtheme | ✅ | ✅ |
| openFileById | ✅ | ✅ |
| reloadTag | ✅ | ❌ |
| setLocalShorthandCount | ✅ | ❌ |
| downloadProgress | ✅ | ❌ |

window/index.ts 是 index.ts 的子集（少3个命令），且缺少：
- `bootSync()`
- `account.onSetaccount()`
- Chrome 浏览器检查
- `EventBus` 全局创建
- `openFileByURL` 全局函数

**结论**：window/index.ts 可以通过参数化 index.ts 来消除，运行时通过检测 `body--window` class 或传入参数区分。

### 3.2 src/index.ts vs src/mobile/index.ts

| 维度 | index.ts | mobile/index.ts |
|---|---|---|
| SCSS | base.scss | mobile.scss |
| window.siyuan 结构 | layout/closedTabs/ctrlIsPressed... | mobile/notebooks... |
| ws消息处理 | 内联 switch/case | 委托给 onMessage() |
| UI初始化 | onGetConfig → 桌面布局 | initFramework → 移动布局 |
| 触摸事件 | 无 | touchstart/move/end |
| 键盘工具栏 | 无 | showKeyboardToolbar/hideKeyboardToolbar |
| 全局函数 | openFileByURL | openFileByURL + goBack + reconnectWebSocket + showKeyboardToolbar |

**结论**：mobile 入口与桌面入口的 UI 初始化逻辑完全不同，但共享大量基础设施（Model、fetchPost、Constants、plugin loader 等）。这是真正的行为分歧点。

### 3.3 src/protyle/method.ts（export）

纯粹的渲染方法集合，无 App 类、无 WebSocket、无 UI 初始化。是完全独立的库入口。

## 4. SCSS 入口对比

| 模块 | base.scss(桌面) | mobile.scss | export.scss |
|---|---|---|---|
| util/* | ✅ | ✅ | 部分 |
| component/* | 全部 | 大部分(无tooltips/card/scroll) | 部分 |
| business/* | 全部 | 大部分(无config/resize/asset-*) | 仅history |
| protyle/* | ✅ | ✅ | 仅wysiwyg+attr |
| pdf/* | ✅ | ❌ | ❌ |
| pickr/* | ✅ | ❌ | ❌ |
| main/* | main/main | main/mobile | ❌ |

base.scss 是 mobile.scss 的超集（多出 pdf、pickr、config、resize、asset-card 等桌面专用模块）。

## 5. path 模块使用深度分析

项目中存在两种 `path` 模块使用模式：

### 5.1 `import * as path from "path"`（webpack 解析）

7个文件使用此方式。webpack 在 electron 构建中解析为 Node.js 原生 `path`，在浏览器构建中通过 `resolve.fallback` 解析为 `path-browserify`。

实际调用分析：

| 文件 | 使用的方法 | 是否在 isElectron 保护下 |
|---|---|---|
| util/pathName.ts | `path.posix`（通过 pathPosix() 封装） | 否，但有 fallback |
| search/.../handleListItemClick.ts | `path.join` | ✅ isElectron 保护 |
| search/genSearch.old.ts | `path.join` | ✅ isElectron 保护 |
| protyle/header/openTitleMenu.ts | `path.join` | ✅ isElectron 保护 |
| protyle/gutter/buildGutterAvMenu.ts | `path.join` | ✅ isElectron 保护 |
| boot/globalEvent/searchKeydown.ts | `path.join` | ✅ isElectron 保护 |
| data/kernelAPI/defaultWorkspace.ts | `path.dirname`, `path.join` | ❌ 无保护 |

### 5.2 `__non_webpack_require__("path")`（绕过 webpack）

8处使用，全部在 Electron 专用代码路径中（export、appearance、bazaar、image、onGetConfig 等），运行时直接加载 Node.js 原生模块，与 webpack 解析无关。

### 5.3 行为一致性结论

`path-browserify` 本身就是 POSIX 实现，行为等同于 Node.js 的 `path.posix`。项目中：
- `pathPosix()` 封装已处理了 `path.posix` 不存在的 fallback
- 5/7 个 `import * as path` 的直接调用都在 `isElectron` 保护下，浏览器环境不会执行
- `defaultWorkspace.ts` 的 `path.dirname`/`path.join` 无保护，但 `path-browserify` 对这两个方法的行为与 Node.js `path.posix` 一致（项目中的路径都是 POSIX 风格的 `/` 分隔符）

**结论：`resolve.fallback.path` 不构成本质差异。** 统一为所有构建目标都使用 `path-browserify` 是安全的（electron 构建中 `__non_webpack_require__("path")` 的调用不受影响）。

## 6. 差异分类：构建时必须 vs 可运行时化

### 6.1 构建时必须保留的差异（不可运行时化）

仅以下2项是 webpack 构建层面真正不可避免的：

1. **target: electron-renderer vs web** — 影响 webpack 是否允许 `require('electron')` 等 Node.js 内置模块的静态解析。但注意：项目中 electron 模块的引用已大量迁移到 `__non_webpack_require__` 或 `platform/electron/` 的延迟加载封装，这意味着即使统一为 web target，只要 electron 模块引用不被 webpack 静态解析，也可以工作
2. **output.library（UMD）** — export 构建需要输出为库格式，这是构建产物形态的根本差异

### 6.2 可参数化的差异（一个配置文件 + 构建参数）

以下差异可以通过 `--env target=electron|desktop|mobile|export` 参数化：

1. **entry** — 从 target 参数选择
2. **output.path/publicPath** — 从 target 参数派生
3. **HTML 模板** — 从 target 参数选择
4. **resolve.alias** — 根据 target 条件组合
5. **resolve.fallback.path** — 统一使用 path-browserify（行为一致，见第5节分析）
6. **SCSS 入口** — 由 entry 的 import 决定，不需要 webpack 层面处理

### 6.3 可完全消除的差异（当前是冗余）

1. **DefinePlugin** — 4个配置完全一致
2. **所有 loader 规则** — 完全一致或可简单参数化
3. **公共 plugins** — 完全一致
4. **optimization** — 几乎一致（config.js 的条件 minimize 是唯一微小差异）

## 7. 残留条件编译

`app/src/config/about.remote.ts` 仍包含 `/// #if !BROWSER` 条件编译指令（直接 import electron 模块）。
这是唯一发现的残留条件编译文件，其余已迁移到 `platform/` 运行时检测。

## 8. 关于 target: electron-renderer 的进一步分析

`target: electron-renderer` 的主要作用是让 webpack 知道可以解析 Node.js 内置模块（如 `fs`、`path`、`electron`）。但项目中：

- `electron` 模块的引用已大量迁移到 `platform/electron/` 的延迟加载封装（`ipcRenderer.ts`、`shell.ts`）
- `fs`/`path` 的直接使用全部通过 `__non_webpack_require__` 绕过 webpack 解析
- 通过 `import * as path from "path"` 引入的 `path` 模块，在 electron 构建中由 webpack 解析为 Node.js 原生模块，但如第5节分析，统一为 `path-browserify` 行为一致

这意味着如果将 electron 构建也改为 `target: web` + `resolve.fallback`，需要确认：
1. `platform/electron/` 的延迟 `require('electron')` 不被 webpack 静态分析（当前通过 `__non_webpack_require__` 或动态 import 实现）
2. `sharp$` 和 `onnxruntime-node$` 的 `false` alias 在 web target 下仍然生效

如果以上两点成立，则 **target 差异也可以消除**，4个构建可以完全统一为一个配置文件。

## 9. 发现的 Bug 和不一致

1. **Bug**：webpack.config.js 第80-107行 `.js` esbuild-loader 规则重复定义两次
2. **疑似Bug**：webpack.desktop.js 缺少 `@` alias（其他3个都有）
3. **不一致**：optimization.minimize 在 config.js 中是 `argv.mode === "production"`，其他3个始终 `true`
4. **残留**：about.remote.ts 仍使用条件编译而非运行时检测
