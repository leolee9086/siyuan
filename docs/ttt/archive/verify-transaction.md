# transaction.ts 拆分校验报告

## 校验范围
- 原始文件: `app/src/protyle/wysiwyg/transaction.ts.backup` (1568行)
- 拆分产物: 8个文件

## 一、函数覆盖校验

| 原始函数 | 原始行号 | 拆分位置 | 状态 |
|---------|---------|---------|------|
| `removeTopElement` | L26-62 | `transaction.ts` L10-46 | ✅ |
| `promiseTransaction` | L65-276 | `transaction.promise.ts` L21-230 | ⚠️ 见问题1 |
| `updateEmbed` | L278-319 | `transaction.promise.ts` L232-274 | ✅ |
| `deleteBlock` | L322-345 | `transaction.onTransaction.ts` L18-41 | ✅ |
| `updateBlock` | L347-382 | `transaction.onTransaction.ts` L43-78 | ✅ |
| `onTransaction` | L385-948 | `transaction.onTransaction.ts` L81-290 | ✅ |
| `turnsIntoOneTransaction` | L950-1082 | `transaction.turns.ts` L14-146 | ✅ |
| `removeUnfoldRepeatBlock` | L1084-1090 | `transaction.fold.ts` L12-18 | ✅ |
| `turnsIntoTransaction` | L1092-1259 | `transaction.turns.ts` L148-316 | ✅ |
| `turnsOneInto` | L1262-1357 | `transaction.turns.ts` L318-413 | ✅ |
| `transactionsTimeout` | L1359 | `transaction.ts` L59 | ✅ |
| `transaction` | L1360-1455 | `transaction.ts` L60-155 | ✅ |
| `processFold` | L1457-1529 | `transaction.fold.ts` L20-92 | ✅ |
| `updateTransaction` | L1531-1544 | `transaction.ts` L157-170 | ✅ |
| `updateBatchTransaction` | L1546-1567 | `transaction.ts` L172-193 | ✅ |

全部15个函数/变量均已覆盖，无遗漏。

## 二、onTransaction 11个action分支校验

| action | 原始行号 | 拆分位置 | 状态 |
|--------|---------|---------|------|
| `setAttrs` | L392-401 | `onTransaction.ts` L88-97 | ✅ |
| `unfoldHeading` | L402-436 | `onTransaction.ts` L98-132 | ✅ |
| `foldHeading` | L437-474 | `onTransaction.ts` L133-170 | ✅ |
| `delete` | L475-494 | `onTransaction.ts` L171-190 | ✅ |
| `update` | L496-538 | `onTransaction.ts` L192-234 | ✅ |
| `updateAttrs` | L540-662 | 委托至 `onTransaction.attrs.ts` | ✅ |
| `move` | L664-790 | 委托至 `onTransaction.move.ts` | ✅ |
| `insert` | L792-904 | 委托至 `onTransaction.insert.ts` | ✅ |
| `append` | L906-911 | `onTransaction.ts` L248-253 | ✅ |
| AV操作数组 | L913-925 | `onTransaction.ts` L255-283 | ✅ |
| `doUpdateUpdated` | L942-947 | `onTransaction.ts` L284-289 | ✅ |

全部11个分支均已覆盖。

## 三、发现的问题

### 问题1: 条件编译指令被替换为运行时检查（3处）

**严重程度**: 中等 — 功能等价但构建行为不同

#### 1a. `promiseTransaction` 中的 `/// #if MOBILE`
- 原始 (L88-94): `/// #if MOBILE ... /// #endif` 包裹 toolbarSync 逻辑
- 拆分 (`transaction.promise.ts` L44-48): 改为 `if (isMobile && ...)` 运行时判断
- 影响: 非移动端构建中该代码不再被 tree-shake 移除，而是包含在产物中做运行时判断

#### 1b. `handleMove` 中的 `/// #if !MOBILE`
- 原始 (L668-687): `/// #if !MOBILE ... /// #endif` 包裹 getAllModels/blockPanels 逻辑
- 拆分 (`transaction.onTransaction.move.ts` L15-32): 改为 `if (!isMobile && ...)` 运行时判断
- 影响: 移动端构建中 `getAllModels` 等桌面端模块不再被 tree-shake 移除

#### 1c. `handleUpdateAttrs` 中的 `/// #if MOBILE`
- 原始 (L603-605): `/// #if MOBILE protyle = window.siyuan.mobile.editor.protyle; /// #endif`
- 拆分 (`transaction.onTransaction.attrs.ts` L69): 改为 `const bgProtyle = isMobile ? window.siyuan.mobile.editor.protyle : protyle;`
- 影响: 同1a，且引入了新变量 `bgProtyle` 替代原始的参数重赋值，逻辑等价但实现方式不同

### 问题2: `removeTopElement` 可见性变更

- 原始: `const removeTopElement`（模块私有）
- 拆分: `export const removeTopElement`（已导出）
- 原因: `transaction.promise.ts` 和 `transaction.onTransaction.move.ts` 需要引用
- 影响: 扩大了公共API表面，但为拆分所必需

### 问题3: 循环依赖

- `transaction.ts` 导入 `promiseTransaction` ← `transaction.promise.ts`
- `transaction.promise.ts` 导入 `transaction`, `removeTopElement` ← `transaction.ts`
- 代码中已标注注释 "circular import — safe because only used at runtime inside callbacks"
- 影响: ES模块中运行时安全，但增加了模块耦合度

### 问题4: re-export 完整性

`transaction.ts` 的 re-export 覆盖了所有原始导出函数:
- `turnsIntoOneTransaction`, `turnsIntoTransaction`, `turnsOneInto` ✅
- `processFold`, `removeUnfoldRepeatBlock` ✅
- `onTransaction` ✅
- `transaction`, `updateTransaction`, `updateBatchTransaction` (直接定义) ✅
- `removeTopElement` (直接定义并导出) ✅

原始未导出的 `updateEmbed`, `deleteBlock`, `updateBlock` 在拆分后仍为内部使用，未暴露到主入口。✅

## 四、结论

**校验结果: 有问题，需要评估是否修复**

- 函数覆盖: 完整，无遗漏
- action分支: 完整，全部11个分支已覆盖
- 逻辑一致性: 代码逻辑完全一致，无逻辑缺失
- 条件编译: 3处 `/// #if` 指令被替换为运行时 `isMobile` 检查，这改变了构建产物的 tree-shaking 行为。如果项目正在进行条件编译迁移则可接受，否则需要恢复条件编译指令。
