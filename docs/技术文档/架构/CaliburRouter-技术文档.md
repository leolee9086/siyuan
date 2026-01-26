# CaliburRouter 事件分发模式技术文档

## 概述

本文档介绍在思源笔记编辑器（Protyle）中引入的全新事件分发模式——**CaliburRouter**。该模式利用 `calibur-router` 库，基于集论和模式匹配来处理复杂的键盘事件分发逻辑，旨在取代传统的嵌套 `if-else` 结构，提高代码的可读性、可维护性和类型安全性。

### 核心特性

1.  **声明式路由**：通过定义状态空间和分割规则来描述业务逻辑，而非编写过程式代码。
2.  **状态与行为分离**：将“当前是什么状态”的判断与“应该执行什么操作”的逻辑解耦。
3.  **类型安全**：结合 `arktype` 进行运行时和编译时类型检查，防止状态定义错误。
4.  **逻辑可视化**：路由定义即为逻辑目录，一眼即可洞察所有分支逻辑。

---

## 背景与问题

在富文本编辑器中，按键事件的处理通常非常复杂。一个按键（如 `Enter`）的行为可能由十几个因素决定：当前是否在列表里？是否选中了代码块？是否在表格中？是否按下了修饰键？

### 传统模式 (Legacy Pattern)

以 `keydown.list.ts` 为典型代表，传统模式使用多层嵌套的 `if-else` 来判断逻辑：

```typescript
export const legacyMiddleware = async (event, protyle, node) => {
    // 1. 快捷键判断
    if (matchHotKey("...")) {
        // 2. DOM 状态判断
        if (selectElements.length > 0) {
            // 3. 连续性判断
            if (isContinuous) {
                // ... 业务逻辑 A
            }
        } else if (node.classList.contains("li")) {
            // ... 业务逻辑 B
        }
    }
}
```

**缺点**：
- **逻辑混杂**：判断条件与执行代码纠缠在一起，难以一眼看出触发某个逻辑的确切条件。
- **扩展困难**：新增一种情况时，需要在复杂的 `if-else` 丛林中小心翼翼地寻找插入点。
- **可读性差**：代码行数膨胀后，维护成本极高。

---

## 架构设计

CaliburRouter 模式将事件处理重构为三个阶段：**状态提取** -> **路由决策** -> **命令执行**。

```mermaid
graph LR
    Input[输入: Event, Node, Protyle] --> Extractor[状态提取器]
    Extractor --> State[纯状态对象 (Plain Object)]
    State --> Router{Calibur Router}
    Router -- 模式匹配 --> Command[指令字符串]
    Command --> Executor[执行器]
    Executor --> Action[业务操作]
```

### 1. 状态提取 (State Extraction)

将复杂的 DOM 对象、事件对象转换为简单的、扁平的 Plain Object（POJO）。

```typescript
const state = {
    isIncludesHotKey: matchHotKey("⌥↩", event),
    hasNonCodeBlock: selectElements.some(el => !el.classList.contains("code-block")),
    // ... 其他相关状态
};
```

### 2. 路由决策 (Router Decision)

使用 `calibur-router` 定义状态空间及其对应的动作指令。这是核心逻辑所在。

```typescript
const router = calibur.universe(DataType) // 定义全集
    .split(ConditionA, () => "ACTION_A")  // 剥离出情况 A
    .split(ConditionB, () => "ACTION_B")  // 剥离出情况 B
    .remain(() => "IGNORE")               // 剩余情况
    .build();
```

### 3. 命令执行 (Command Execution)

根据路由返回的指令字符串（如 `"SHOW_MENU"`），调用对应的独立函数。

---

## 案例分析：Alt+Enter 处理

以 `app/src/protyle/wysiwyg/keydown.altEnter.ts` 为例，展示如何使用该模式。

### 1. 定义状态与路由

首先定义该业务场景关心的所有状态字段（Schema），并构建决策树。

```typescript
import { calibur } from "calibur-router";
import { type } from "arktype";

// 定义路由
const altEnterRouter = calibur.universe(type({
    isIncludesHotKey: "boolean", // 是否按下了快捷键
    hasNonCodeBlock: "boolean"   // 选区是否包含非代码块
}))
    // 规则 1: 快捷键匹配且全是代码块 -> 显示语言菜单
    .split(
        type({ isIncludesHotKey: "true", hasNonCodeBlock: "false" }),
        () => "SHOW_CODE_LANGUAGE"
    )
    // 规则 2: 快捷键匹配且有非代码块 -> 添加子列表
    .split(
        type({ isIncludesHotKey: "true", hasNonCodeBlock: "true" }),
        () => "ADD_SUB_LIST"
    )
    // 其他情况 -> 忽略
    .remain(() => "IGNORE")
    .build();
```

### 2. 中间件实现

在中间件函数中，只负责准备数据和分发。

```typescript
export const altEnterMiddleware = async (event, protyle, nodeElement, range, controller) => {
    // 1. 状态提取 (辅助函数)
    const selectElements = getSelectElements(protyle, nodeElement);
    const hasNonCodeBlock = selectElements.some(item => !item.classList.contains("code-block"));
    
    // 2. 路由匹配
    const command = altEnterRouter({
        isIncludesHotKey: matchHotKey("⌥↩", event),
        hasNonCodeBlock
    });

    // 3. 执行命令
    if (command === "SHOW_CODE_LANGUAGE") {
        showCodeLanguage(protyle, selectElements, event, controller);
        return;
    }

    if (command === "ADD_SUB_LIST") {
        addSubList(protyle, nodeElement, range);
        // ... 阻止默认行为
        return;
    }
};
```

---

## 优势与收益

| 维度 | 传统模式 | CaliburRouter 模式 |
| :--- | :--- | :--- |
| **可读性** | 需通读代码理解逻辑流 | 路由定义即文档，一目了然 |
| **完备性** | 容易遗漏边缘情况 | 基于集论 (Split/Remain)，保证覆盖所有情况 |
| **调试** | 需在复杂的 DOM 环境中调试 | 可独立测试路由逻辑 (纯函数) |
| **修改风险** | 修改一处可能影响其他分支 | 逻辑分支隔离，修改安心 |

## 最佳实践

1.  **保持状态扁平**：状态对象的层级应尽可能浅，最好是一层扁平的属性，便于路由匹配。
2.  **纯路由代码**：`Router` 定义中不要包含副作用（如修改 DOM），只返回字符串指令。
3.  **原子化状态**：如果通过组合两个状态能得出第三个状态，尽量在状态提取阶段算好，而不是在路由中去组合判断。
4.  **逐步迁移**：对于新的复杂交互逻辑推荐使用此模式；针对旧代码，可在重构复杂模块（如 `keydown.enter.ts`）时引入。
