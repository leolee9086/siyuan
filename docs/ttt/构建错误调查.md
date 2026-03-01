# 构建错误调查报告

日期: 2026-02-20

## 运行的命令

1. `cd app ; pnpm dev` (webpack --mode development) — 退出码 1（因 watch 模式被手动终止）
2. `cd app ; pnpm build:app` (webpack --mode production) — 退出码 0
3. `cd app ; pnpm build:mobile` (webpack --mode production --config webpack.mobile.js) — 退出码 0
4. `cd app ; pnpm build:desktop` (webpack --mode production --config webpack.desktop.js) — 退出码 0
5. `cd app ; pnpm build:export` (webpack --mode production --config webpack.export.js) — 退出码 0

所有构建均成功完成（无 error），但存在 warnings。

## 错误数量统计

| 构建目标 | errors | warnings（导入缺失） | warnings（资源大小） |
|----------|--------|----------------------|---------------------|
| dev (主配置) | 0 | 6 | 0 |
| build:app | 0 | 6 | 0 |
| build:mobile | 0 | 3 | 2 |
| build:desktop | 0 | 2 | 2 |
| build:export | 0 | 3 | 2 |

去重后，导入缺失类 warnings 共涉及 3 个源文件、5 个缺失导出。

## Warning 分类

### 类别 A：缺失导出 — commonMenuItem.ts → editor/util

源文件: `src/menus/commonMenuItem.ts`
导入来源: `../editor/util`

| 缺失导出 | 行号 | 出现的构建目标 |
|----------|------|---------------|
| `openAsset` | 490, 499 (dev/build:app); 477, 486 (desktop) | dev, build:app, build:desktop |
| `openBy` | 516, 524, 533, 542 (dev/build:app) | dev, build:app |

`../editor/util` 模块实际仅导出 `openFile`。

### 类别 B：缺失导出 — layout 相关模块 → getAll

源文件及缺失导出:

| 源文件 | 缺失导出 | 导入来源 | 出现的构建目标 |
|--------|----------|----------|---------------|
| `src/layout/layout-deserialization.layout.ts:22` | `getAllTabs` | `./getAll` | build:mobile, build:export |
| `src/layout/layout-serialization.ts:133` | `getAllModels` | `./getAll` | build:mobile, build:export |
| `src/layout/window-utils.ts:126` | `getAllWnds` | `./getAll` | build:mobile, build:export |

`./getAll` 模块实际仅导出 `getAllEditor`。

### 类别 C：资源大小超限（非代码问题，忽略）

build:mobile、build:desktop、build:export 均有 asset/entrypoint size limit warnings，属于 webpack 性能提示，非代码错误。

## 总结

所有构建 warning 均为**缺失导出（missing export）**问题，分两组：

1. `commonMenuItem.ts` 引用了 `editor/util` 中不存在的 `openAsset` 和 `openBy`（6 处引用）
2. layout 相关文件引用了 `getAll` 中不存在的 `getAllTabs`、`getAllModels`、`getAllWnds`（3 处引用）

这些很可能是合并冲突后，函数被重命名或移除但引用未同步更新导致的。
