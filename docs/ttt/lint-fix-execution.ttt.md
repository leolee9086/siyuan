# Lint错误修复执行计划

创建时间: 2026-02-24T22:33Z
最后更新: 2026-02-24T22:39Z
状态: 待开始

## 修复策略

按文件修复，从错误最多的文件开始逐个处理。每个文件修复完成后提交git，确保每次提交都是一个完整、可回退的修复单元。

前置步骤：将 `*.backup.ts`、`*.old.ts`、`*.remote.ts` 加入 eslint ignores，排除备份文件后建立干净基线。

## 当前基线

| 指标 | 数值 |
|------|------|
| 总错误数 | 29,368 |
| 总警告数 | 243 |
| 有问题文件数 | 905 |
| 扫描文件总数 | 1,146 |
| 备份文件错误 | ~331 (index.backup.ts) |
| 实际需修复错误 | ~29,037 |

## 错误类型参考

| 规则 | 错误数 | 占比 |
|------|--------|------|
| no-restricted-syntax | 12,460 | 43.1% |
| require-if-comment | 5,139 | 17.8% |
| no-restricted-globals | 3,373 | 11.7% |
| require-function-comment | 2,838 | 9.8% |
| require-async-export | 1,704 | 5.9% |
| no-inline-callback | 1,462 | 5.1% |
| 其余规则合计 | 2,392 | 8.2% |

## 优先修复队列（按错误数降序）

| # | 文件路径 | 错误数 | 状态 |
|---|----------|--------|------|
| 1 | src/protyle/render/av/action.ts | 265 | 待开始 |
| 2 | src/card/openCard.ts | 258 | 待开始 |
| 3 | src/dialog/processSystem.ts | 257 | 待开始 |
| 4 | src/layout/dock/Graph.ts | 256 | 待开始 |
| 5 | src/layout/dock/Backlink.ts | 247 | 待开始 |
| 6 | src/protyle/util/table.ts | 244 | 待开始 |
| 7 | src/protyle/util/paste.ts | 230 | 待开始 |
| 8 | src/menus/workspace.ts | 218 | 待开始 |
| 9 | src/protyle/util/compatibility.ts | 211 | 待开始 |
| 10 | src/boot/globalEvent/keydown.ts | 210 | 待开始 |
| 11 | src/protyle/render/av/blockAttr.ts | 202 | 待开始 |
| 12 | src/protyle/render/av/col.ts | 190 | 待开始 |
| 13 | src/config/keymap.ts | 188 | 待开始 |
| 14 | src/mobile/util/keyboardToolbar.ts | 183 | 待开始 |
| 15 | src/protyle/wysiwyg/remove.ts | 181 | 待开始 |
| 16 | src/protyle/render/av/select.ts | 179 | 待开始 |
| 17 | src/protyle/wysiwyg/index.mousedown.dragSelect.ts | 178 | 待开始 |
| 18 | src/config/repos.provider.ts | 171 | 待开始 |
| 19 | （待补充：配置清理后重新统计第19-20名） | TBD | 待开始 |

注：已排除备份文件 `src/layout/dock/index.backup.ts`（331个错误）和 `src/mobile/settings/about.remote.ts`（196个错误），这两个文件将通过eslint ignores配置排除。队列中前18个文件合计约3,868个错误。

## 进度追踪

| 阶段 | 说明 | 状态 |
|------|------|------|
| 前置：配置清理 | 排除备份文件，建立干净基线 | 待开始 |
| 文件 #1-#5 | 前5个高错误文件 | 待开始 |
| 文件 #6-#10 | 第6-10个文件 | 待开始 |
| 文件 #11-#18 | 第11-18个文件 | 待开始 |
| 剩余文件 | 队列外的887个文件 | 待开始 |

## 失败记录

（暂无）

## 近期任务

- [ ] 前置：配置清理，排除备份文件，重新统计基线
- [ ] #1 src/protyle/render/av/action.ts (265个错误)
- [ ] #2 src/card/openCard.ts (258个错误)
- [ ] #3 src/dialog/processSystem.ts (257个错误)
- [ ] #4 src/layout/dock/Graph.ts (256个错误)
- [ ] #5 src/layout/dock/Backlink.ts (247个错误)
- [ ] #6-#18 继续按队列顺序修复
- [ ] 补充第19-20名文件到队列
