# 拆分 hint/index.ts

创建时间: 2026-02-24T10:55Z
状态: 待执行
相关规程: `docs/规程/代码质量/超长文件拆分.procedure.md`

## 现状

| 指标 | 数值 |
|------|------|
| 当前行数 | 1092 |
| 限制行数 | 300 |
| 超标倍数 | 3.6x |
| 优先级 | P1 |

## 文件结构分析

### 类: Hint (48-1092)

| 成员 | 行范围 | 行数 | 可见性 | 说明 |
|------|--------|------|--------|------|
| 属性定义 | 49-56 | 8 | mixed | timeId, element, enableSlash, enableEmoji, enableExtend, splitChar, lastIndex, source |
| constructor | 58-124 | 67 | public | 初始化DOM、绑定click事件（含emoji面板交互） |
| render | 126-208 | 83 | public | 渲染提示面板（根据splitChar分发） |
| genLoading | 210-236 | 27 | public | 显示加载动画 |
| bindUploadEvent | 239-253 | 15 | public | 绑定文件上传事件 |
| getHTMLByData | 256-275 | 20 | private | 根据数据生成提示列表HTML |
| genHTML | 277-356 | 80 | public | 生成提示面板HTML并定位 |
| genSearchHTML | 359-395 | 37 | private | 搜索引用块并生成HTML |
| genEmojiHTML | 398-444 | 47 | private | 生成emoji面板HTML |
| **fill** | **448-901** | **454** | **public** | **填充选中值到编辑器（核心拆分目标）** |
| select | 904-1031 | 128 | public | 键盘导航选择（含emoji面板方向键） |
| fixImageCursor | 1034-1041 | 8 | private | 修复图片光标位置 |
| getKey | 1044-1092 | 49 | private | 解析当前行获取提示触发键 |

### fill 方法内部结构 (448-901)

| 逻辑块 | 行范围 | 行数 | 说明 |
|--------|--------|------|------|
| av源处理 | 458-533 | 76 | 属性视图单元格填充（新建文档/替换块） |
| range调整 | 535-573 | 39 | endSplit匹配、lastIndex设置 |
| 新建文件(blockRef) | 576-598 | 23 | 通过块引用新建文档 |
| 块引用插入 | 600-633 | 34 | 插入块引用标记 |
| emoji插入 | 634-642 | 9 | 插入emoji字符 |
| 嵌入/标签/其他 | 643-654 | 12 | 嵌入块、标签等提示 |
| **斜杠命令分发** | **655-901** | **247** | **大量if-else分支处理各种斜杠命令** |

### select 方法内部结构 (904-1031)

| 逻辑块 | 行范围 | 行数 | 说明 |
|--------|--------|------|------|
| Enter处理 | 909-944 | 36 | emoji面板和普通列表的回车确认 |
| emoji方向键导航 | 946-1018 | 73 | 上下左右键在emoji网格中导航 |
| 普通列表上下导航 | 1020-1024 | 5 | 委托upDownHint |
| 左右键关闭 | 1026-1031 | 6 | 左右键关闭提示面板 |

## 拆分方案

遵循"从内向外"原则：提取 fill 和 select 方法的内部逻辑为独立函数，主文件保留类定义和方法骨架。

### 拆分文件清单

| # | 文件名 | 来源 | 预估行数 |
|---|--------|------|---------|
| 1 | `index.ts` | 主文件（类定义+constructor+render+genLoading+bindUploadEvent+getHTMLByData+genHTML+genSearchHTML+genEmojiHTML+getKey+fixImageCursor+方法骨架） | ~280 |
| 2 | `index.fill.ts` | fill方法的av源处理+range调整+块引用+emoji+嵌入标签 | ~200 |
| 3 | `index.fill.slash.ts` | fill方法的斜杠命令分发逻辑 | ~260 |
| 4 | `index.select.ts` | select方法的emoji导航+Enter处理 | ~140 |

### 拆分后目录结构

```
app/src/protyle/hint/
├── index.ts                ← 主文件（类定义+大部分方法）
├── index.fill.ts           ← fill的非斜杠部分
├── index.fill.slash.ts     ← fill的斜杠命令分发
├── index.select.ts         ← select方法逻辑
├── extend.ts               ← 已有文件不变
├── extend.hintRef.ts       ← 已有文件不变
```

### 导出模式

拆分文件导出独立函数，由主文件中的类方法调用：

```typescript
// index.fill.ts
export function handleFillAv(hint: Hint, value: string, protyle: IProtyle): boolean { ... }
export function handleFillBlockRef(hint: Hint, value: string, protyle: IProtyle, ...): boolean { ... }

// index.fill.slash.ts
export function handleFillSlash(hint: Hint, value: string, protyle: IProtyle, nodeElement: HTMLElement, ...): void { ... }

// index.select.ts
export function handleSelect(hint: Hint, event: KeyboardEvent, protyle: IProtyle): boolean { ... }

// index.ts 中
public fill(value: string, protyle: IProtyle, ...) {
    // 前置逻辑
    if (this.source === "av") {
        handleFillAv(this, value, protyle);
        return;
    }
    // range调整...
    if (handleFillBlockRef(this, value, protyle, ...)) return;
    // ...
    handleFillSlash(this, value, protyle, nodeElement, ...);
}
```

### 拆分顺序建议

1. 第1批: `index.select.ts`（最独立，仅处理键盘事件）
2. 第2批: `index.fill.slash.ts`（斜杠命令分发，逻辑自成体系）
3. 第3批: `index.fill.ts`（fill的其余部分）
4. 精简主文件
5. 构建验证

### 约束

- 不改变 Hint 类的公共接口
- 不改变运行时行为
- 拆分后每个文件不超过300行
- 不在拆分过程中修复其他lint错误
- 不产生循环依赖

## 近期任务

- [x] 提取 `index.select.ts` — 148行，3个函数
- [x] 提取 `index.fill.slash.ts` — 378行，含 IFillSlashContext 接口
- [x] 提取 `index.fill.ts` — 294行，修复了 this?.splitChar bug
- [x] 精简主文件 — 480行（仍超300行限制，需后续拆分）
- [x] 构建验证 — pnpm build 通过，仅 asset size 警告
- [x] 主文件进一步拆分至≤300行 — 创建 `index.render.ts`（233行），主文件降至263行

## 失败记录

- ttt 预估主文件精简后~280行，实际480行。原因：constructor(67行)、render(83行)、genHTML(80行)、genEmojiHTML(49行)、genSearchHTML(37行) 等方法体积被低估
- apply_diff 替换 fill 方法体时，旧代码残留在新代码之后（481-1101行），需要 write_to_file 全量重写清理
