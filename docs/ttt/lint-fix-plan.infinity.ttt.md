# Lint 错误修复计划 执行跟踪 (TikTocTak)

> **任务类型**: 🔄 无限滚动任务
> **目标**: 系统性消除项目中的 lint 错误，包括超长文件拆分和规则修复

创建时间: 2026-02-23T05:54Z
最后更新: 2026-02-26T04:58Z
状态: P0-P3拆分+校验全部完成，进入lint错误修复阶段

## 现状概览

| 指标 | 数值 |
|------|------|
| 有问题文件 | 850 / 1082 |
| 总错误 | 30,385 |
| 备份/旧文件错误 | ~955 (3个文件) |
| 实际需修复错误 | ~29,430 |

## 核心原则: 先拆分，后修复

超长文件必须先拆分再修复其他lint错误。原因：
- 在大文件上修复 else/forEach/注释等错误后再拆分 = 返工
- 拆分后每个小文件独立修复，任务可并行、可追踪
- 拆分本身就能消除 `code-size/max-lines` 错误

## 超长文件清单 (限制 300 行)

| 优先级 | 文件 | 行数 | 超标倍数 | lint错误数 |
|--------|------|------|---------|-----------|
| P0 | src/protyle/wysiwyg/index.ts | 3132 | 10.4x | 1002 |
| P0 | src/protyle/render/av/openMenuPanel.ts | 1743 | 5.8x | 440 |
| P0 | src/protyle/wysiwyg/transaction.ts | 1561 | 5.2x | 556 |
| P1 | src/protyle/render/av/cell.ts | 1255 | 4.2x | 540 |
| P1 | src/protyle/hint/index.ts | 1092 | 3.6x | 350 |
| P1 | src/layout/Wnd.ts | 1089 | 3.6x | 360 |
| P2 | src/protyle/render/av/render.ts | 899 | 3.0x | 302 |
| P2 | src/protyle/render/av/filter.ts | 892 | 3.0x | 314 |
| P2 | src/protyle/util/selection.ts | 804 | 2.7x | 302 |
| P2 | src/mobile/util/keyboardToolbar.ts | 784 | 2.6x | 313 |
| P3 | src/config/repos.ts | 632 | 2.1x | 273 |
| P3 | src/emoji/index.ts | ~600+ | ~2x | 295 |
| P3 | src/history/history.ts | ~600+ | ~2x | 277 |
| P3 | src/mobile/dock/MobileFiles.ts | ~600+ | ~2x | 289 |
| P3 | src/mobile/menu/search.ts | ~600+ | ~2x | 268 |
| P3 | src/mobile/dock/MobileOutline.ts | ~600+ | ~2x | 266 |

## 修复批次计划

### 批次 0: 配置清理

- [ ] 将 `*.backup.ts`、`*.old.ts` 加入 eslint ignores（消除 ~955 无效错误）
- [ ] 重新运行 lint 确认基线

### 批次 1: P0 超长文件拆分 ✅ 完成

每个文件需先创建专门的 ttt 文档（`docs/ttt/split-<模块名>.ttt.md`），分析文件结构、确定拆分方案后再执行拆分：

- [x] `src/protyle/wysiwyg/index.ts` 3132→284行 → ttt: `split-wysiwyg-index.ttt.md`
- [x] `src/protyle/render/av/openMenuPanel.ts` 1743→257行 → ttt: `split-av-openMenuPanel.ttt.md`
- [x] `src/protyle/wysiwyg/transaction.ts` 1561→194行 → ttt: `split-wysiwyg-transaction.ttt.md`

#### P0 校验 ✅ 完成 (2026-02-24T10:46Z)

- wysiwyg/index.ts：通过
- openMenuPanel.ts：发现4个问题已修复（closeCB同步、update-icon赋值、动画参数、isMobile导入）
- transaction.ts：通过（条件编译已替换为运行时检查，用户确认绝对不能存在条件编译）
- 条件编译全局扫描：`app/src/` 下 0 个实际条件编译指令残留，10处注释引用（均为说明性文字，位于 `platform/index.ts`、`platform/electron/ipcRenderer.ts`、`platform/electron/shell.ts`、`block/Panel.render.ts`、`block/Panel.ts`）

### 批次 2: P1 超长文件拆分 ✅ 完成

每个文件同样需要专门 ttt：

- [x] `src/protyle/render/av/cell.ts` (1255行) → ttt: `split-av-cell.ttt.md`
- [x] `src/protyle/hint/index.ts` (1092行) → ttt: `split-hint-index.ttt.md`
- [x] `src/layout/Wnd.ts` (1089行) → ttt: `split-layout-Wnd.ttt.md`

### 批次 3: P2 超长文件拆分 ✅ 完成

每个文件同样需要专门 ttt：

- [x] `src/protyle/render/av/render.ts` (899行) → ttt: `split-av-render.ttt.md`
- [x] `src/protyle/render/av/filter.ts` (892行) → ttt: `split-av-filter.ttt.md`
- [x] `src/protyle/util/selection.ts` (804行) → ttt: `split-selection.ttt.md`
- [x] `src/mobile/util/keyboardToolbar.ts` (784行) → ttt: `split-keyboardToolbar.ttt.md`

### 批次 4: P3 超长文件拆分 ✅ 完成

600+ 行文件，视情况合并或单独创建 ttt：

- [x] `src/history/history.ts` 978→209行
- [x] `src/mobile/dock/MobileOutline.ts` 975→299行
- [x] `src/mobile/menu/search.ts` 917→289行
- [x] `src/emoji/index.ts` 773→226行
- [x] `src/mobile/dock/MobileFiles.ts` 768→277行
- [x] `src/config/repos.ts` 632→175行

#### P3 校验 ✅ 完成 (2026-02-24T21:41Z)

- 发现1个问题：`history.docEvent.ts` 中 `rebuildIndex` 的 `closeModel` 分支缺少 `historyEditor = undefined` 赋值
- 修复方式：新增 `clearHistoryEditor()` 导出函数
- 其余文件：通过

### 批次 5: 拆分后的 lint 错误修复

拆分完成后，对拆分产生的小文件按规则类型批量修复：

#### 5a. 零风险: 注释类
- `require-if-comment` — 为 if 添加注释
- `function-comment/require-function-comment` — 添加 JSDoc
- AI 辅助友好度高，可批量处理

#### 5b. 低风险: 机械替换
- forEach → for...of / map / filter
- DOM 链式调用 → 先声明变量
- 下标后属性访问 → 先声明变量

#### 5c. 低风险: 全局变量封装
- `no-restricted-globals` — 创建 `*.environment.ts` 封装 window 引用

#### 5d. 中风险: 内联回调提取
- `no-inline-callback` — 提取为命名函数

#### 5e. 中风险: 控制流重构
- else 消除 → 卫语句
- 嵌套 if 消除 → 合并条件
- switch 消除 → 对象字面量/Map

#### 5f. 中风险: 类与函数重构
- 私有/静态方法 → 模块级函数
- this 消除 → 参数传递
- 内部函数 → 提取到模块顶层

#### 5g. 低风险: 类型系统迁移
- 类型定义 → 移至 .types.ts
- 类型断言 → 移至 .guard.ts

## 错误规则分类速查

| 规则 | 修复方式 | 可自动修复 | 风险 |
|------|---------|-----------|------|
| code-size/max-lines | 文件拆分 | 否 | 高 |
| code-size/max-lines-per-function | 函数拆分 | 否 | 高 |
| no-restricted-syntax (else) | 卫语句重构 | 否 | 中 |
| no-restricted-syntax (forEach) | for...of替换 | 半自动 | 低 |
| no-restricted-syntax (switch) | 对象字面量 | 否 | 低 |
| no-restricted-syntax (内部函数) | 提取到顶层 | 否 | 中 |
| no-restricted-syntax (DOM链式) | 声明变量 | 否 | 低 |
| no-restricted-syntax (类方法) | 提取模块函数 | 否 | 中 |
| no-restricted-syntax (as断言) | 移至.guard.ts | 否 | 低 |
| no-restricted-syntax (类型定义) | 移至.types.ts | 半自动 | 低 |
| require-if-comment | 添加注释 | 否(AI辅助) | 无 |
| function-comment | 添加JSDoc | 否(AI辅助) | 无 |
| no-restricted-globals | 封装environment | 否 | 低 |
| no-inline-callback | 提取命名函数 | 否 | 低 |
| require-async-export | 添加async导出 | 否 | 低 |
| no-large-inline-array | 提取为常量 | 否 | 低 |

## 规则严格性评估

保留全部规则，但建议评估：
- 下标后属性访问禁止（`arr[0].prop`场景）是否需要添加例外

## 失败教训记录

### P0 拆分阶段 (2026-02-24)

1. `apply_diff` 删除大段代码时，SEARCH 块必须包含完整的待删除内容，不能省略中间部分
2. `apply_diff` 因中文引号 Unicode 编码差异（如 `"` vs `""`）可能导致匹配失败，需注意精确匹配
3. `transaction.ts` 拆分后存在循环依赖（`transaction.ts` ↔ `transaction.promise.ts`），运行时安全但需留意

## 近期任务

- [ ] 批次 0: 配置清理（排除备份文件）
- [x] 批次 1: P0 文件拆分（3个文件全部完成）
- [x] 批次 1 校验: P0 校验（3个文件通过，条件编译全局扫描通过）
- [x] 批次 2: P1 文件拆分（cell.ts / hint/index.ts / Wnd.ts 全部完成）
- [x] 批次 3: P2 文件拆分（render.ts / filter.ts / selection.ts / keyboardToolbar.ts 全部完成）
- [x] 批次 4: P3 文件拆分（history.ts / MobileOutline.ts / search.ts / emoji/index.ts / MobileFiles.ts / repos.ts 全部完成）
- [x] 批次 4 校验: P3 校验（发现并修复1个问题：history.docEvent.ts clearHistoryEditor）
- [ ] 批次 5: lint 错误修复（下一步）
