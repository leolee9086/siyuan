# 列表转换功能测试指南

## 📋 测试目标

验证新的 CalibURRouter 实现的 `listTransformMiddleware` 是否正确处理所有列表类型转换操作。

## 🎯 测试策略

本指南提供**两种测试方法**：

1. **单元测试（推荐优先）** - 使用 Mock 状态测试路由规则，无需 DOM 层
2. **集成测试** - 在真实编辑器环境中手动测试完整流程

### 为什么优先单元测试？

CalibURRouter 的核心优势是**高度可测性**：
- ✅ 路由器是纯函数，输入状态 → 输出命令
- ✅ 无需模拟 DOM、事件、Protyle 实例
- ✅ 测试速度快，覆盖率高
- ✅ 可以精确验证每条路由规则

---

## 🧪 方法 1: 单元测试（Mock 状态）

### 测试环境设置

创建测试文件 `app/src/protyle/wysiwyg/keydown.list/__tests__/router.transform.test.ts`：

```typescript
import { describe, it, expect } from "vitest";
import { transformRouter } from "../router.transform";
import { LIST_COMMANDS } from "../commands";
import type { TransformState } from "../types";

/**
 * 状态工厂函数 - 创建测试用的 Mock 状态
 */
const createMockState = (overrides: Partial<TransformState> = {}): TransformState => ({
    // 默认值：单选 + 段落 + 未按任何转换键
    isSingleSelect: true,
    currentType: "NodeParagraph",
    currentSubtype: null,
    selectCount: 1,
    isContinuousSelection: true,
    hasListItem: false,
    isListKey: false,
    isOListKey: false,
    isCheckKey: false,
    isQuoteKey: false,
    // 覆盖默认值
    ...overrides
});
```

### 测试用例：段落转换

```typescript
describe("transformRouter - 段落转换", () => {
    it("规则 2: 段落 + 无序列表键 → TRANSFORM_TO_UL", () => {
        const state = createMockState({
            currentType: "NodeParagraph",
            isListKey: true
        });
        expect(transformRouter(state)).toBe(LIST_COMMANDS.TRANSFORM_TO_UL);
    });

    it("规则 3: 段落 + 有序列表键 → TRANSFORM_TO_OL", () => {
        const state = createMockState({
            currentType: "NodeParagraph",
            isOListKey: true
        });
        expect(transformRouter(state)).toBe(LIST_COMMANDS.TRANSFORM_TO_OL);
    });

    it("规则 4: 段落 + 任务列表键 → TRANSFORM_TO_TL", () => {
        const state = createMockState({
            currentType: "NodeParagraph",
            isCheckKey: true
        });
        expect(transformRouter(state)).toBe(LIST_COMMANDS.TRANSFORM_TO_TL);
    });

    it("规则 5: 段落 + 引用键 → TRANSFORM_TO_QUOTE", () => {
        const state = createMockState({
            currentType: "NodeParagraph",
            isQuoteKey: true
        });
        expect(transformRouter(state)).toBe(LIST_COMMANDS.TRANSFORM_TO_QUOTE);
    });
});
```

### 测试用例：列表互转

```typescript
describe("transformRouter - 列表类型互转", () => {
    it("规则 6: 无序列表 + 有序列表键 → TRANSFORM_TO_OL", () => {
        const state = createMockState({
            currentType: "NodeList",
            currentSubtype: "u",
            isOListKey: true
        });
        expect(transformRouter(state)).toBe(LIST_COMMANDS.TRANSFORM_TO_OL);
    });

    it("规则 7: 无序列表 + 任务列表键 → TRANSFORM_TO_TL", () => {
        const state = createMockState({
            currentType: "NodeList",
            currentSubtype: "u",
            isCheckKey: true
        });
        expect(transformRouter(state)).toBe(LIST_COMMANDS.TRANSFORM_TO_TL);
    });

    it("规则 8: 有序列表 + 无序列表键 → TRANSFORM_TO_UL", () => {
        const state = createMockState({
            currentType: "NodeList",
            currentSubtype: "o",
            isListKey: true
        });
        expect(transformRouter(state)).toBe(LIST_COMMANDS.TRANSFORM_TO_UL);
    });

    it("规则 9: 有序列表 + 任务列表键 → TRANSFORM_TO_TL", () => {
        const state = createMockState({
            currentType: "NodeList",
            currentSubtype: "o",
            isCheckKey: true
        });
        expect(transformRouter(state)).toBe(LIST_COMMANDS.TRANSFORM_TO_TL);
    });

    it("规则 10: 任务列表 + 无序列表键 → TRANSFORM_TO_UL", () => {
        const state = createMockState({
            currentType: "NodeList",
            currentSubtype: "t",
            isListKey: true
        });
        expect(transformRouter(state)).toBe(LIST_COMMANDS.TRANSFORM_TO_UL);
    });

    it("规则 11: 任务列表 + 有序列表键 → TRANSFORM_TO_OL", () => {
        const state = createMockState({
            currentType: "NodeList",
            currentSubtype: "t",
            isOListKey: true
        });
        expect(transformRouter(state)).toBe(LIST_COMMANDS.TRANSFORM_TO_OL);
    });
});
```

### 测试用例：多选场景

```typescript
describe("transformRouter - 多选场景", () => {
    it("规则 15: 多选连续 + 无列表项 + 无序列表键 → TRANSFORM_TO_UL", () => {
        const state = createMockState({
            isSingleSelect: false,
            selectCount: 3,
            isContinuousSelection: true,
            hasListItem: false,
            isListKey: true
        });
        expect(transformRouter(state)).toBe(LIST_COMMANDS.TRANSFORM_TO_UL);
    });

    it("规则 16: 多选连续 + 无列表项 + 有序列表键 → TRANSFORM_TO_OL", () => {
        const state = createMockState({
            isSingleSelect: false,
            selectCount: 3,
            isContinuousSelection: true,
            hasListItem: false,
            isOListKey: true
        });
        expect(transformRouter(state)).toBe(LIST_COMMANDS.TRANSFORM_TO_OL);
    });

    it("多选不连续 → IGNORE", () => {
        const state = createMockState({
            isSingleSelect: false,
            selectCount: 3,
            isContinuousSelection: false,
            isListKey: true
        });
        expect(transformRouter(state)).toBe(LIST_COMMANDS.IGNORE);
    });

    it("多选包含列表项 → IGNORE", () => {
        const state = createMockState({
            isSingleSelect: false,
            selectCount: 3,
            isContinuousSelection: true,
            hasListItem: true,
            isListKey: true
        });
        expect(transformRouter(state)).toBe(LIST_COMMANDS.IGNORE);
    });
});
```

### 测试用例：边界情况

```typescript
describe("transformRouter - 边界情况", () => {
    it("规则 1: 未按任何转换键 → IGNORE", () => {
        const state = createMockState({
            currentType: "NodeParagraph",
            isListKey: false,
            isOListKey: false,
            isCheckKey: false,
            isQuoteKey: false
        });
        expect(transformRouter(state)).toBe(LIST_COMMANDS.IGNORE);
    });

    it("规则 12: 标题 + 引用键 → TRANSFORM_TO_QUOTE", () => {
        const state = createMockState({
            currentType: "NodeHeading",
            isQuoteKey: true
        });
        expect(transformRouter(state)).toBe(LIST_COMMANDS.TRANSFORM_TO_QUOTE);
    });

    it("标题 + 列表键 → IGNORE (不支持的转换)", () => {
        const state = createMockState({
            currentType: "NodeHeading",
            isListKey: true
        });
        expect(transformRouter(state)).toBe(LIST_COMMANDS.IGNORE);
    });
});
```

### 运行单元测试

```bash
# 运行所有测试
pnpm test

# 运行特定测试文件
pnpm test router.transform.test.ts

# 监听模式（开发时使用）
pnpm test --watch

# 生成覆盖率报告
pnpm test --coverage
```

### 单元测试检查清单

- [ ] 规则 1: 未按任何转换键 → IGNORE
- [ ] 规则 2-5: 段落转换（4 种类型）
- [ ] 规则 6-11: 列表互转（6 种组合）
- [ ] 规则 12: 标题 → 引用
- [ ] 规则 15-18: 多选连续转换（4 种类型）
- [ ] 边界情况：多选不连续 → IGNORE
- [ ] 边界情况：多选包含列表项 → IGNORE
- [ ] 边界情况：不支持的转换 → IGNORE

---

## 🖥️ 方法 2: 集成测试（真实环境）

### 测试前准备

1. **启动思源笔记**
2. **打开开发者工具**（F12 或 Ctrl+Shift+I）
3. **切换到 Console 标签页**，观察日志输出
4. **创建一个新文档**用于测试

## 📝 测试场景

### 场景 1: 段落转换为列表

#### 测试步骤：
1. 在编辑器中输入一段普通文本：`这是一个测试段落`
2. 将光标放在这段文本中
3. 按下快捷键测试转换：

| 快捷键 | 预期结果 | 验证点 |
|--------|----------|--------|
| `Ctrl+L` (或 `Cmd+L`) | 转换为无序列表 | 文本前出现 `•` 符号 |
| `Ctrl+O` (或 `Cmd+O`) | 转换为有序列表 | 文本前出现 `1.` 符号 |
| `Ctrl+Shift+T` | 转换为任务列表 | 文本前出现 `☐` 复选框 |
| `Ctrl+Shift+B` | 转换为引用块 | 文本左侧出现引用线 |

#### 验证方法：
- 检查控制台是否输出类似：`列表类型转换操作`
- 检查块类型是否正确转换
- 检查文本内容是否保持不变

---

### 场景 2: 列表类型之间的转换

#### 测试步骤：
1. 先创建一个无序列表项：`• 无序列表项`
2. 将光标放在列表项中
3. 按下快捷键测试转换：

| 当前类型 | 快捷键 | 预期结果 |
|----------|--------|----------|
| 无序列表 (•) | `Ctrl+O` | 转换为有序列表 (1.) |
| 无序列表 (•) | `Ctrl+Shift+T` | 转换为任务列表 (☐) |
| 有序列表 (1.) | `Ctrl+L` | 转换为无序列表 (•) |
| 有序列表 (1.) | `Ctrl+Shift+T` | 转换为任务列表 (☐) |
| 任务列表 (☐) | `Ctrl+L` | 转换为无序列表 (•) |
| 任务列表 (☐) | `Ctrl+O` | 转换为有序列表 (1.) |

#### 验证方法：
- 检查列表符号是否正确变化
- 检查列表内容是否保持不变
- 检查控制台日志

---

### 场景 3: 标题转换为引用

#### 测试步骤：
1. 创建一个标题：`# 这是一个标题`
2. 将光标放在标题中
3. 按下 `Ctrl+Shift+B` (引用快捷键)

#### 预期结果：
- 标题转换为引用块
- 文本内容保持不变

---

### 场景 4: 多选块转换（连续选择）

#### 测试步骤：
1. 创建多个连续的段落：
   ```
   段落 1
   段落 2
   段落 3
   ```
2. 按住 `Shift` 点击选中这三个段落（或使用 `Shift+↓` 选择）
3. 按下快捷键测试批量转换：

| 快捷键 | 预期结果 |
|--------|----------|
| `Ctrl+L` | 三个段落都转换为无序列表 |
| `Ctrl+O` | 三个段落都转换为有序列表 |
| `Ctrl+Shift+T` | 三个段落都转换为任务列表 |
| `Ctrl+Shift+B` | 三个段落都转换为引用块 |

#### 验证方法：
- 检查所有选中的块是否都被转换
- 检查转换后的顺序是否正确
- 检查控制台日志

---

### 场景 5: 多选块转换（不连续选择 - 应忽略）

#### 测试步骤：
1. 创建多个段落，中间插入其他内容：
   ```
   段落 1
   其他内容
   段落 2
   ```
2. 按住 `Ctrl` 点击选中不连续的段落
3. 按下 `Ctrl+L` 尝试转换

#### 预期结果：
- **不应该**发生转换（因为选择不连续）
- 控制台可能输出 `IGNORE` 命令

---

### 场景 6: 多选包含列表项（应忽略）

#### 测试步骤：
1. 创建混合内容：
   ```
   段落 1
   • 列表项
   段落 2
   ```
2. 选中所有三个块
3. 按下 `Ctrl+L` 尝试转换

#### 预期结果：
- **不应该**发生转换（因为包含列表项）
- 控制台可能输出 `IGNORE` 命令

---

## 🐛 调试技巧

### 1. 启用详细日志

在控制台中执行：
```javascript
// 查看当前日志级别
window.siyuan.config.keymap
```

### 2. 检查快捷键配置

在控制台中执行：
```javascript
// 查看列表相关快捷键
console.log({
    list: window.siyuan.config.keymap.editor.insert.list.custom,
    orderedList: window.siyuan.config.keymap.editor.insert["ordered-list"].custom,
    check: window.siyuan.config.keymap.editor.insert.check.custom,
    quote: window.siyuan.config.keymap.editor.insert.quote.custom
});
```

### 3. 监控路由决策

在 [`router.transform.ts`](app/src/protyle/wysiwyg/keydown.list/router.transform.ts:66) 中，路由器会根据状态返回命令。你可以在控制台中看到：
- `列表类型转换操作` - 表示转换被触发
- 如果没有输出，可能是快捷键不匹配或状态不符合路由规则

---

## ✅ 测试检查清单

完成以下所有测试项：

- [ ] 段落 → 无序列表
- [ ] 段落 → 有序列表
- [ ] 段落 → 任务列表
- [ ] 段落 → 引用块
- [ ] 无序列表 → 有序列表
- [ ] 无序列表 → 任务列表
- [ ] 有序列表 → 无序列表
- [ ] 有序列表 → 任务列表
- [ ] 任务列表 → 无序列表
- [ ] 任务列表 → 有序列表
- [ ] 标题 → 引用块
- [ ] 多选连续段落 → 无序列表
- [ ] 多选连续段落 → 有序列表
- [ ] 多选连续段落 → 任务列表
- [ ] 多选连续段落 → 引用块
- [ ] 多选不连续段落（应忽略）
- [ ] 多选包含列表项（应忽略）

---

## 🔍 常见问题排查

### 问题 1: 快捷键不生效

**可能原因**：
- 快捷键配置不正确
- 其他插件或中间件拦截了事件

**排查方法**：
1. 检查控制台是否有错误
2. 确认快捷键配置（见上方调试技巧）
3. 检查是否有其他中间件提前 abort 了事件

### 问题 2: 转换结果不正确

**可能原因**：
- 路由规则匹配错误
- 执行器实现有 bug

**排查方法**：
1. 在 [`middlewares/transform.ts`](app/src/protyle/wysiwyg/keydown.list/middlewares/transform.ts:34) 的第 42 行添加断点
2. 检查 `state` 对象的值
3. 检查 `command` 返回值
4. 单步调试执行器

### 问题 3: 控制台没有日志

**可能原因**：
- 事件被提前拦截
- 快捷键不匹配

**排查方法**：
1. 在 [`keydown.ts`](app/src/protyle/wysiwyg/keydown.ts:398) 的第 398 行添加断点
2. 确认是否执行到 `listTransformMiddleware`
3. 检查 `controller.signal.aborted` 状态

---

## 📊 测试报告模板

测试完成后，请填写以下报告：

```
测试日期：____________________
测试人员：____________________

通过的测试场景：
- [ ] 场景 1: 段落转换为列表
- [ ] 场景 2: 列表类型之间的转换
- [ ] 场景 3: 标题转换为引用
- [ ] 场景 4: 多选块转换（连续）
- [ ] 场景 5: 多选块转换（不连续 - 应忽略）
- [ ] 场景 6: 多选包含列表项（应忽略）

发现的问题：
1. ___________________________________________
2. ___________________________________________
3. ___________________________________________

总体评价：
□ 完全正常，可以删除旧代码
□ 有小问题，需要修复
□ 有严重问题，需要回滚
```

---

## 🎯 下一步

测试通过后：
1. ✅ 确认所有场景都正常工作
2. ✅ 删除 [`keydown.list.ts`](app/src/protyle/wysiwyg/keydown.list.ts:1) 中的旧代码
3. ✅ 更新 [`tiktoctak.md`](app/src/protyle/wysiwyg/tiktoctak.md:1) 文档
4. ✅ 提交代码并记录完成情况
