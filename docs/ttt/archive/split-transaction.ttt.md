# 拆分 wysiwyg/transaction.ts

创建时间: 2026-02-24T06:34Z
状态: 待执行
相关规程: `docs/规程/代码质量/超长文件拆分.procedure.md`

## 现状

| 指标 | 数值 |
|------|------|
| 当前行数 | 1561 |
| 限制行数 | 300 |
| 超标倍数 | 5.2x |
| 优先级 | P0 |

## 文件结构分析

### 导入区 (1-24)

24行，24个外部依赖导入。

### 内部函数

| 函数 | 行范围 | 行数 | 说明 |
|------|--------|------|------|
| `removeTopElement` | 25-61 | 37 | 移除顶层元素，处理空文档 |
| `promiseTransaction` | 64-273 | 210 | 执行事务请求+处理响应中的操作（含嵌入块/反链更新） |
| `updateEmbed` | 275-317 | 43 | 更新嵌入块内容 |
| `deleteBlock` | 319-341 | 23 | 删除块+更新嵌入块 |
| `updateBlock` | 344-379 | 36 | 更新块DOM+焦点+渲染 |
| `removeUnfoldRepeatBlock` | 1077-1083 | 7 | 移除展开时重复块 |
| `processFold` | 1450-1522 | 73 | 处理折叠/展开标题 |

### 导出函数

| 函数 | 行范围 | 行数 | 说明 |
|------|--------|------|------|
| `onTransaction` | 382-941 | 560 | **最大函数**，处理推送和撤销的操作分发 |
| `turnsIntoOneTransaction` | 943-1075 | 133 | 多块合并为一个容器（超级块/引述块/列表等） |
| `turnsIntoTransaction` | 1085-1253 | 169 | 块类型转换（标题/段落/列表等） |
| `turnsOneInto` | 1255-1350 | 96 | 单块类型转换（取消引述/列表/标注等） |
| `transaction` | 1353-1448 | 96 | **核心入口**，事务提交+防抖+undo管理 |
| `updateTransaction` | 1524-1537 | 14 | 简单更新事务封装 |
| `updateBatchTransaction` | 1539-1561 | 23 | 批量更新事务封装 |

### onTransaction 内部action分支 (382-941)

| action | 行范围 | 行数 |
|--------|--------|------|
| setAttrs | 389-397 | 9 |
| unfoldHeading | 399-432 | 34 |
| foldHeading | 434-470 | 37 |
| delete | 472-491 | 20 |
| update | 493-535 | 43 |
| updateAttrs | 537-658 | 122 |
| move | 659-783 | 125 |
| insert | 785-897 | 113 |
| append | 899-904 | 6 |
| AV系列操作 | 906-933 | 28 |
| doUpdateUpdated | 935-940 | 6 |

## 拆分方案

遵循"从内向外"原则：提取 `onTransaction` 内部各action处理逻辑为独立函数，提取turns系列函数到独立文件。主文件保留 `transaction`、`updateTransaction`、`updateBatchTransaction` 和事务队列逻辑。

### 拆分文件清单

| # | 文件名 | 来源 | 预估行数 |
|---|--------|------|---------|
| 1 | `transaction.ts` | 核心入口：`transaction` + `promiseTransaction` + `updateTransaction` + `updateBatchTransaction` + 模块级变量 | ~280 |
| 2 | `transaction.onTransaction.ts` | `onTransaction` 函数骨架 + `deleteBlock` + `updateBlock` + `updateEmbed` + `removeTopElement` + `removeUnfoldRepeatBlock` | ~300 |
| 3 | `transaction.onTransaction.attrs.ts` | `onTransaction` 中 `updateAttrs` 分支逻辑（122行，最大单分支） | ~130 |
| 4 | `transaction.onTransaction.move.ts` | `onTransaction` 中 `move` 分支逻辑（125行） | ~130 |
| 5 | `transaction.onTransaction.insert.ts` | `onTransaction` 中 `insert` 分支逻辑（113行） | ~120 |
| 6 | `transaction.fold.ts` | `processFold` 函数（73行）+ fold/unfold相关辅助 | ~80 |
| 7 | `transaction.turns.ts` | `turnsIntoOneTransaction` + `turnsIntoTransaction` + `turnsOneInto`（合计398行） | ~300 |

### 拆分后目录结构

```
app/src/protyle/wysiwyg/
├── transaction.ts                          ← 主文件（事务核心）
├── transaction.onTransaction.ts            ← onTransaction骨架+小辅助函数
├── transaction.onTransaction.attrs.ts      ← updateAttrs分支
├── transaction.onTransaction.move.ts       ← move分支
├── transaction.onTransaction.insert.ts     ← insert分支
├── transaction.fold.ts                     ← 折叠处理
├── transaction.turns.ts                    ← 块类型转换系列
├── ... (已有文件不变)
```

### 导出模式

各拆分文件导出处理函数，由主文件或 `onTransaction` 骨架导入调用：

```typescript
// transaction.onTransaction.attrs.ts
export function handleUpdateAttrs(protyle: IProtyle, operation: IOperation, updateElements: Element[]): void

// transaction.onTransaction.move.ts
export function handleMove(protyle: IProtyle, operation: IOperation, updateElements: Element[], isUndo: boolean): void

// transaction.onTransaction.insert.ts
export function handleInsert(protyle: IProtyle, operation: IOperation, isUndo: boolean): void

// transaction.onTransaction.ts 中
export const onTransaction = (protyle, operation, isUndo) => {
    // ... setAttrs/fold/delete/update 小分支保留
    if (operation.action === "updateAttrs") { handleUpdateAttrs(...); return; }
    if (operation.action === "move") { handleMove(...); return; }
    if (operation.action === "insert") { handleInsert(...); return; }
    // ...
};
```

### 拆分顺序建议

1. 第1批: `transaction.turns.ts` — 三个turns函数完全独立，无闭包共享
2. 第2批: `transaction.fold.ts` — `processFold` 独立性高
3. 第3批: `transaction.onTransaction.attrs.ts` + `transaction.onTransaction.move.ts` + `transaction.onTransaction.insert.ts` — 提取onTransaction大分支
4. 第4批: `transaction.onTransaction.ts` — 重组onTransaction骨架+小辅助函数
5. 第5批: 精简 `transaction.ts` 主文件
6. 每批完成后构建验证

### 约束

- 不改变任何导出函数的公共接口
- 不改变运行时行为
- 拆分后每个文件不超过300行
- 不在拆分过程中修复其他lint错误
- 不产生循环依赖

## 近期任务

- [x] 创建 `transaction.turns.ts`，提取 turnsIntoOneTransaction + turnsIntoTransaction + turnsOneInto
- [x] 创建 `transaction.fold.ts`，提取 processFold + removeUnfoldRepeatBlock
- [ ] 创建 `transaction.onTransaction.attrs.ts`，提取 updateAttrs 分支
- [ ] 创建 `transaction.onTransaction.move.ts`，提取 move 分支
- [ ] 创建 `transaction.onTransaction.insert.ts`，提取 insert 分支
- [ ] 创建 `transaction.onTransaction.ts`，重组 onTransaction 骨架 + deleteBlock/updateBlock/updateEmbed/removeTopElement/removeUnfoldRepeatBlock
- [ ] 精简 `transaction.ts` 主文件
- [ ] 构建验证（pnpm build 无新增错误）

## 失败记录

### batch1 (2026-02-24)
- apply_diff 仅匹配了 `turnsIntoOneTransaction` 声明首行但未删除函数体（约408行），导致文件损坏（重复的 `let transactionsTimeout` 声明 + 残留旧函数体）。原因：SEARCH 块只包含了一行而非整个待删除区域。用户手动修复后继续。教训：删除大段代码时，SEARCH 块必须包含完整的待删除内容。
