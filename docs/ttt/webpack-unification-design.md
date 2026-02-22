# Webpack 配置统一设计方案（过渡方案）

> 基于 webpack-config-analysis.md 的分析结果
> 终极目标：去打包化，由 Go 核心内置 esbuild/esm.sh 作为编译服务。本方案是过渡步骤。

## 0. 设计原则

**构建目标定义与构建工具分离。** `build.targets.json` 描述"构建什么"，是构建工具无关的纯数据。webpack.config.js 是当前的适配器，未来被 Go 编译服务替代时，`build.targets.json` 原样保留。

## 1. 目标结构

```
app/
  build.targets.json         ← 构建目标定义（工具无关，未来 Go 编译服务直接消费）
  webpack.config.js          ← webpack 适配器（过渡期使用，替代原4个文件）
  webpack.patchResolver.js   ← 保持不变
```

## 2. 构建目标定义 build.targets.json

纯数据，不含任何 webpack 概念。描述每个构建目标的入口、产出、平台和 HTML 页面：

```json
{
    "app": {
        "platform": "electron",
        "entry": {
            "main": "./src/index.ts",
            "window": "./src/window/index.ts"
        },
        "outputDir": "stage/build/app",
        "publicPath": "auto",
        "html": [
            { "chunks": ["main"], "filename": "index.html", "template": "src/assets/template/app/index.tpl" },
            { "chunks": ["window"], "filename": "window.html", "template": "src/assets/template/app/window.tpl" }
        ],
        "excludeModules": ["sharp", "onnxruntime-node"]
    },
    "desktop": {
        "platform": "web",
        "entry": { "main": "./src/index.ts" },
        "outputDir": "stage/build/desktop",
        "publicPath": "/stage/build/desktop/",
        "html": [
            { "chunks": ["main"], "filename": "index.html", "template": "src/assets/template/desktop/index.tpl" }
        ]
    },
    "mobile": {
        "platform": "web",
        "entry": { "main": "./src/mobile/index.ts" },
        "outputDir": "stage/build/mobile",
        "publicPath": "/stage/build/mobile/",
        "html": [
            { "chunks": ["main"], "filename": "index.html", "template": "src/assets/template/mobile/index.tpl" }
        ]
    },
    "export": {
        "platform": "web",
        "entry": { "protyle-method": "./src/protyle/method.ts" },
        "outputDir": "stage/build/export",
        "publicPath": "auto",
        "library": { "name": "Protyle", "format": "umd", "export": "default" },
        "html": []
    }
}
```

字段语义：
- `platform`：`"electron"` | `"web"`，决定运行环境
- `entry`：入口文件映射
- `outputDir`：构建产物输出目录
- `publicPath`：资源引用前缀
- `html`：HTML 页面列表（空数组 = 无 HTML 输出）
- `library`：库导出配置（仅 export 目标需要）
- `excludeModules`：需要排除的 Node.js 原生模块（仅 electron 目标需要）

## 3. webpack 适配器 webpack.config.js

适配器职责：读取 `build.targets.json`，将工具无关的目标定义翻译为 webpack 配置。所有 webpack 特有概念（loader、plugin、resolve.fallback 等）仅存在于此文件内部。

```js
// webpack.config.js — 核心骨架
const targets = require("./build.targets.json");

function createConfig(targetName, argv) {
    const t = targets[targetName];
    const isProd = argv.mode === "production";
    const isElectron = t.platform === "electron";
    return {
        name: targetName,
        target: isElectron ? "electron-renderer" : "web",
        entry: t.entry,
        output: buildOutput(t),
        resolve: buildResolve(t, isElectron),
        // ... mode/watch/devtool/optimization/module/plugins
    };
}

module.exports = (env, argv) => {
    if (env?.target) return createConfig(env.target, argv);
    return Object.keys(targets).map(name => createConfig(name, argv));
};
```

适配器内部的翻译规则（均为 webpack 特有逻辑，不污染 targets.json）：

### 3.1 targets.json → webpack 翻译规则

| targets.json 字段 | webpack 翻译 |
|---|---|
| `platform: "electron"` | `target: "electron-renderer"`，不设 `resolve.fallback` |
| `platform: "web"` | `target: "web"`，`resolve.fallback.path` → `path-browserify` |
| `excludeModules` | 转为 `resolve.alias: { "sharp$": false, ... }` |
| `library` | 转为 `output.library`/`output.libraryTarget`/`output.libraryExport` |
| `html` 数组 | 每项生成一个 `HtmlWebpackPlugin` 实例 |
| `html` 非空 | 添加 `.tpl` 的 html-loader 规则，`include` 从 html[].template 派生 |

所有目标共享的 webpack 特有配置（硬编码在适配器中，不进入 targets.json）：
- `resolve.alias["@"]` → `src`
- `resolve.alias["vue"]` → `vue/dist/vue.esm-bundler.js`（web 平台）
- 所有 loader 规则（vue-loader、esbuild-loader、sass-loader、file-loader）
- 所有公共 plugin（DefinePlugin、VueLoaderPlugin、MiniCssExtractPlugin、PatchResolverPlugin、CleanWebpackPlugin）
- `optimization.minimize` 统一为 `isProd`

## 4. Bug 修复

| Bug | 修复方式 |
|---|---|
| webpack.config.js `.js` 规则重复 | 统一配置中只写一次 |
| webpack.desktop.js 缺少 `@` alias | 统一配置中所有目标都有 `@` alias |
| optimization.minimize 不一致 | 统一为 `isProd`，即 `argv.mode === "production"` |

## 5. npm scripts 更新

```json
{
    "dev": "webpack --mode development",
    "dev:app": "webpack --mode development --env target=app",
    "dev:desktop": "webpack --mode development --env target=desktop",
    "dev:mobile": "webpack --mode development --env target=mobile",
    "dev:export": "webpack --mode development --env target=export",
    "build": "webpack --mode production",
    "build:app": "webpack --mode production --env target=app",
    "build:desktop": "webpack --mode production --env target=desktop",
    "build:mobile": "webpack --mode production --env target=mobile",
    "build:export": "webpack --mode production --env target=export"
}
```

- `dev` / `build`：不传 `--env target`，触发配置数组模式，同时构建所有目标
- `dev:xxx` / `build:xxx`：传 `--env target=xxx`，仅构建单个目标
- `--config` 参数不再需要，因为只有一个 `webpack.config.js`

## 6. 迁移步骤

1. 创建 `build.targets.json`
2. 重写 `webpack.config.js` 为适配器（消费 targets.json）
3. 更新 `package.json` 的 scripts
4. 删除 `webpack.desktop.js`、`webpack.mobile.js`、`webpack.export.js`
5. 逐目标验证构建：`pnpm build && pnpm build:app`
6. 对比构建产物确认无回归

## 7. 设计决策说明

- **为什么用 JSON 而非 JS 定义目标**：JSON 是语言无关的纯数据，Go 编译服务可直接 `json.Unmarshal` 消费，无需理解 JS 语义。这是为去打包化铺路的关键决策
- **为什么不用 webpack-merge**：差异已收敛为参数化数据，不需要配置合并库；且减少 webpack 生态依赖有利于未来迁移
- **path fallback 策略**：所有 web target 统一使用 path-browserify；electron target 不设 fallback。分析文档已证明行为一致性
- **target: electron-renderer 保留**：虽然分析表明可能可以统一为 web，但涉及运行时行为验证，风险较高，本次不改动
- **去打包化路径**：`build.targets.json` → webpack 适配器（当前）→ Go esbuild 适配器（未来），目标定义不变，只替换适配器
