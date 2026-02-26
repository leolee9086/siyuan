# 校验报告：hint/index.ts 拆分

## 校验范围
- 原始文件：`app/src/protyle/hint/index.ts.backup`（1089行）
- 拆分文件：`index.ts`（263行）、`index.fill.ts`、`index.fill.slash.ts`、`index.select.ts`、`index.render.ts`

## 原始方法清单与映射

| 原始方法 | 原始行号 | 拆分位置 | 状态 |
|---------|---------|---------|------|
| constructor | 60-126 | index.ts 26-92 | ✅ 一致 |
| render | 128-210 | index.render.ts handleRender | ✅ 逻辑一致 |
| genLoading | 212-237 | index.ts 98-125 | ⚠️ 条件编译变更 |
| bindUploadEvent | 239-253 | index.ts 127-142 | ✅ 一致 |
| getHTMLByData | 256-275 | index.ts 144-163 | ✅ 一致 |
| genHTML | 277-355 | index.ts 165-245 | ⚠️ 条件编译变更 |
| genSearchHTML | 357-394 | index.render.ts handleGenSearchHTML | ✅ 逻辑一致 |
| genEmojiHTML | 396-443 | index.render.ts handleGenEmojiHTML | ✅ 逻辑一致 |
| fill (av部分) | 456-531 | index.fill.ts handleFillAv | ✅ 逻辑一致 |
| fill (blockRef) | 533-631 | index.fill.ts handleFillContent+子函数 | ✅ 逻辑一致 |
| fill (emoji) | 632-640 | index.fill.ts handleEmoji | ✅ 一致 |
| fill (embed/tag) | 641-652 | index.fill.ts handleEmbedOrTag | ⚠️ isMobile用法变更 |
| fill (slash) | 653-898 | index.fill.slash.ts handleFillSlash | ⚠️ 条件编译变更 |
| select | 901-1028 | index.select.ts handleSelect | ✅ 逻辑一致 |
| fixImageCursor | 1031-1039 | index.fill.slash.ts fixImageCursor | ✅ 一致 |
| getKey | 1041-1087 | index.render.ts getKey | ✅ 逻辑一致(forEach→for...of) |

## 发现的问题

### 问题1：条件编译指令被替换为运行时检查（中等严重）

原始代码使用 `/// #if !MOBILE` / `/// #else` / `/// #endif` 编译时条件编译。
拆分后改为 `if (!isMobile)` / `if (isMobile)` 运行时检查。

影响位置：
- `genLoading`（index.ts 105-120）
- `genHTML`（index.ts 186-200）
- `handleNewSubDoc`（index.fill.slash.ts 176-185）
- `handleRender` 中的斜杠判断（index.render.ts 81）

影响：移动端构建会包含桌面端代码，桌面端构建会包含移动端代码，增大包体积。
运行时行为应等价，但构建产物不同。

### 问题2：isMobile 导入源和用法变更（高严重）

原始：`import { isMobile } from "../../util/functions"` → 调用为 `isMobile()`（函数调用）
拆分：`import {isMobile} from "../../platform"` → 使用为 `isMobile`（布尔值）

影响位置：
- index.render.ts 第81行：`!isMobile` 替代原始 `!isMobile()`
- index.fill.ts 第291行：`isMobile` 替代原始 `isMobile()`
- index.fill.slash.ts 第176/179行：`isMobile` / `!isMobile`

需要确认 `../../platform` 导出的 `isMobile` 是否为布尔常量且语义等价。
如果 `../../util/functions` 的 `isMobile()` 是动态检测而 `../../platform` 的 `isMobile` 是静态值，
则在窗口大小变化等场景下可能产生行为差异。

### 问题3：类成员可见性变更（低严重）

- `enableEmoji`：`private` → `public`
- `source`：`private` → `public`

这是拆分所必需的（外部函数需要访问），但扩大了 API 表面。

### 问题4：openFileById 条件编译守卫移除（中等严重）

原始（第39行）：
```typescript
/// #if !MOBILE
import { openFileById } from "../../editor/utils.openFileById";
/// #endif
```

拆分后（index.fill.slash.ts 第18行）：
```typescript
import {openFileById} from "../../editor/utils.openFileById";
```

无条件导入，移动端构建会引入桌面端模块。

### 问题5：handlePostInsert 重新查询 nodeElement（低严重）

原始代码中 post-insert 逻辑直接使用已被重新赋值的 `nodeElement` 变量。
拆分后 `handlePostInsert` 通过 `querySelector` 重新查询：
```typescript
const nodeElement = protyle.wysiwyg.element.querySelector(
  `[data-node-id="${initialNodeElement.getAttribute("data-node-id")}"]`
) as HTMLElement || initialNodeElement;
```
理论上等价，但增加了一次 DOM 查询。

## 无问题确认

- fill 方法的 else-if 链拆分为独立 if + return，逻辑等价（每个分支都有 return）
- getKey 的 forEach → for...of 改写，逻辑等价
- select 方法的所有分支（Enter/emoji导航/上下/左右）完整保留
- constructor 中的事件监听器完整保留
- 所有注释和 issue 链接保留

## 结论

**校验结果：有问题，需要修复**

主要问题集中在条件编译指令被移除，改为运行时检查。这不是简单的重构等价变换：
1. 问题1+4 导致构建产物包含不必要的代码（包体积增大）
2. 问题2 需要确认 isMobile 的语义是否完全等价
3. 问题3 是拆分的必要代价，可接受

建议：恢复条件编译指令，或确认项目已全面迁移到运行时 isMobile 检查方案。
