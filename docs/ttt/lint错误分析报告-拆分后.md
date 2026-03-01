# Lint错误分析报告（拆分后）

> 生成时间: 2026-02-24T21:53Z
> 扫描工具: `pnpm lint:top` + `pnpm lint:rules`

## 总览对比

| 指标 | 拆分前 | 拆分后 | 变化 |
|------|--------|--------|------|
| 总错误数 | 30,385 | 29,368 | -1,017 (-3.3%) |
| 总警告数 | - | 243 | - |
| 有问题文件数 | 850 | 905 | +55 (+6.5%) |
| 扫描文件总数 | - | 1,146 | - |

文件数增加是因为大文件拆分为多个小文件，每个子文件继承了原文件的lint错误。错误总数减少约1,017个，可能是拆分过程中部分代码被清理或重构。

## 错误最多的前20个文件

| # | 错误数 | 文件路径 |
|---|--------|----------|
| 1 | 331 | src/layout/dock/index.backup.ts |
| 2 | 265 | src/protyle/render/av/action.ts |
| 3 | 258 | src/card/openCard.ts |
| 4 | 257 | src/dialog/processSystem.ts |
| 5 | 256 | src/layout/dock/Graph.ts |
| 6 | 247 | src/layout/dock/Backlink.ts |
| 7 | 244 | src/protyle/util/table.ts |
| 8 | 230 | src/protyle/util/paste.ts |
| 9 | 218 | src/menus/workspace.ts |
| 10 | 211 | src/protyle/util/compatibility.ts |
| 11 | 210 | src/boot/globalEvent/keydown.ts |
| 12 | 202 | src/protyle/render/av/blockAttr.ts |
| 13 | 196 | src/mobile/settings/about.remote.ts |
| 14 | 190 | src/protyle/render/av/col.ts |
| 15 | 188 | src/config/keymap.ts |
| 16 | 183 | src/mobile/util/keyboardToolbar.ts |
| 17 | 181 | src/protyle/wysiwyg/remove.ts |
| 18 | 179 | src/protyle/render/av/select.ts |
| 19 | 178 | src/protyle/wysiwyg/index.mousedown.dragSelect.ts |
| 20 | 171 | src/config/repos.provider.ts |

注：#1 index.backup.ts 是备份文件，不应计入实际统计。

## 主要错误类型分布

| # | 规则ID | 错误数 | 占比 |
|---|--------|--------|------|
| 1 | no-restricted-syntax | 12,460 | 43.1% |
| 2 | require-if-comment/require-if-comment | 5,139 | 17.8% |
| 3 | no-restricted-globals | 3,373 | 11.7% |
| 4 | function-comment/require-function-comment | 2,838 | 9.8% |
| 5 | require-async-export/require-async-export | 1,704 | 5.9% |
| 6 | no-inline-callback/no-inline-callback | 1,462 | 5.1% |
| 7 | code-size/max-lines-per-function | 629 | 2.2% |
| 8 | @typescript-eslint/no-explicit-any | 249 | 0.9% |
| 9 | function-comment/require-type-comment | 234 | 0.8% |
| 10 | @typescript-eslint/no-unused-vars | 209 (警告) | 0.7% |
| 11 | no-large-inline-array/no-large-inline-array | 207 | 0.7% |
| 12 | no-trivial-wrapper/no-trivial-wrapper | 167 | 0.6% |
| 13 | no-alias-usage/no-alias-usage | 151 | 0.5% |
| 14 | require-timeout-comment/require-timeout-comment | 101 | 0.3% |
| 15 | code-size/max-lines | 101 | 0.3% |

前6种规则占总错误的93.4%。其余13种规则合计不到2%。

## 错误分类

### 代码注释类（占比 28.6%，约8,211个）
- `require-if-comment`: 5,139 — if语句缺少注释
- `function-comment/require-function-comment`: 2,838 — 函数缺少注释
- `function-comment/require-type-comment`: 234 — 类型缺少注释

### 代码风格/限制类（占比 54.8%，约15,833个）
- `no-restricted-syntax`: 12,460 — 使用了受限语法
- `no-restricted-globals`: 3,373 — 使用了受限全局变量

### 代码结构类（占比 13.2%，约3,795个）
- `require-async-export/require-async-export`: 1,704 — 异步导出要求
- `no-inline-callback/no-inline-callback`: 1,462 — 内联回调
- `code-size/max-lines-per-function`: 629 — 函数过长

### 其他（占比 3.4%）
- TypeScript相关、数组、别名、超时注释等
