# CalibURRouter 架构分析：状态空间切割 vs 传统事件分发

## 📊 核心机制对比

### 1. CalibURRouter 的状态空间切割机制

#### 核心思想
将键盘事件处理问题转化为**集合论问题**：
- **全集 (Universe)**: 所有可能的输入状态
- **子集 (Split)**: 从全集中切割出特定模式
- **剩余集 (Remain)**: 处理未被显式切割的部分

#### 工作流程
```typescript
// 1. 定义状态空间全集
const listRouter = calibur.universe(ListStateSchema)
    // 2. 切割子集并注册处理器
    .split(
        type({ isListKey: "true", currentType: "'NodeParagraph'" }),
        () => LIST_COMMANDS.TRANSFORM_TO_UL
    )
    // 3. 处理剩余情况
    .remain(() => LIST_COMMANDS.IGNORE)
    // 4. 构建分发器
    .build();

// 5. 使用：输入状态 → 输出命令
const command = listRouter(state);
```

#### 关键特性
- ✅ **声明式**：描述"什么情况做什么"，而非"如何判断"
- ✅ **类型安全**：编译时 + 运行时双重类型检查
- ✅ **可组合**：支持子路由器嵌套
- ✅ **可测试**：纯函数，无副作用

---

### 2. 旧机制：命令式 if/else 链

#### 实现方式
```typescript
// 旧的 listTransformMiddleware 实现
export const listTransformMiddleware = async (event, protyle, nodeElement, range, controller) => {
    const isMatchList = matchHotKey(window.siyuan.config.keymap.editor.insert.list.custom, event);
    const isMatchCheck = matchHotKey(window.siyuan.config.keymap.editor.insert.check.custom, event);
    const isMatchOList = matchHotKey(window.siyuan.config.keymap.editor.insert["ordered-list"].custom, event);
    const isMatchQuote = matchHotKey(window.siyuan.config.keymap.editor.insert.quote.custom, event);

    if (isMatchList || isMatchOList || isMatchCheck || isMatchQuote) {
        const selectsElement = Array.from(protyle.wysiwyg.element.querySelectorAll(".protyle-wysiwyg--select"));
        if (selectsElement.length === 0) {
            selectsElement.push(nodeElement);
        }
        if (selectsElement.length === 1) {
            const subType = selectsElement[0].dataset.subtype;
            const type = selectsElement[0].dataset.type;
            if (isMatchQuote) {
                if (["NodeHeading", "NodeParagraph", "NodeList"].includes(type)) {
                    turnsIntoOneTransaction({ protyle, selectsElement, type: "Blocks2Blockquote" });
                } else {
                    protyle.hint.splitChar = "/";
                    protyle.hint.lastIndex = -1;
                    protyle.hint.fill(">" + Lute.Caret, protyle);
                }
            } else {
                if (type === "NodeParagraph") {
                    turnsIntoOneTransaction({
                        protyle, selectsElement,
                        type: isMatchCheck ? "Blocks2TLs" : (isMatchList ? "Blocks2ULs" : "Blocks2OLs")
                    });
                } else if (type === "NodeList") {
                    const id = selectsElement[0].dataset.nodeId;
                    if (subType === "o" && (isMatchList || isMatchCheck)) {
                        turnsOneInto({ protyle, nodeElement: selectsElement[0], id, type: isMatchCheck ? "UL2TL" : "OL2UL" });
                    } else if (subType === "t" && (isMatchList || isMatchOList)) {
                        turnsOneInto({ protyle, nodeElement: selectsElement[0], id, type: isMatchList ? "TL2UL" : "TL2OL" });
                    } else if (subType === "u" && (isMatchCheck || isMatchOList)) {
                        turnsOneInto({ protyle, nodeElement: selectsElement[0], id, type: isMatchCheck ? "OL2TL" : "UL2OL" });
                    }
                } else {
                    protyle.hint.splitChar = "/";
                    protyle.hint.lastIndex = -1;
                    protyle.hint.fill((isMatchCheck ? "- [ ] " : (isMatchList ? "- " : "1. ")) + Lute.Caret, protyle);
                }
            }
        } else {
            let isList = false;
            let isContinue = false;
            selectsElement.find((item, index) => {
                if (item.classList.contains("li")) {
                    isList = true;
                    return true;
                }
                if (item.nextElementSibling && selectsElement[index + 1] &&
                    item.nextElementSibling === selectsElement[index + 1]) {
                    isContinue = true;
                } else if (index !== selectsElement.length - 1) {
                    isContinue = false;
                    return true;
                }
            });
            if (!isList && isContinue) {
                turnsIntoOneTransaction({
                    protyle, selectsElement,
                    type: isMatchQuote ? "Blocks2Blockquote" : (isMatchCheck ? "Blocks2TLs" : (isMatchList ? "Blocks2ULs" : "Blocks2OLs"))
                });
            }
        }
        event.preventDefault();
        event.stopPropagation();
        controller.abort("列表类型转换操作");
        return;
    }
};
```

#### 问题分析
- ❌ **命令式**：充满 if/else 嵌套，难以理解意图
- ❌ **状态分散**：DOM 查询、数据提取、逻辑判断混在一起
- ❌ **难以测试**：需要模拟 DOM、事件、Protyle 实例
- ❌ **难以维护**：修改一个条件可能影响多个分支
- ❌ **性能问题**：每次都要遍历所有条件

---

### 3. 常见富文本编辑器的实现方式

#### 方案 A: ProseMirror 的 Keymap 插件

```typescript
import { keymap } from "prosemirror-keymap";

const myKeymap = keymap({
    "Mod-b": toggleStrong,
    "Mod-i": toggleEm,
    "Mod-Enter": (state, dispatch) => {
        // 处理逻辑
        return true; // 表示已处理
    }
});
```

**特点**：
- ✅ 简洁的键绑定语法
- ✅ 返回 boolean 表示是否处理
- ⚠️ 无状态匹配：只能基于快捷键，不能基于编辑器状态
- ⚠️ 无类型安全：运行时才知道是否匹配

#### 方案 B: Slate.js 的事件处理

```typescript
const MyEditor = () => {
    const editor = useSlate();
    
    const handleKeyDown = (event) => {
        if (event.key === 'Enter' && event.ctrlKey) {
            event.preventDefault();
            // 处理逻辑
            return;
        }
        
        if (event.key === 'Tab') {
            event.preventDefault();
            if (isInCodeBlock(editor)) {
                insertTab(editor);
            } else if (isInList(editor)) {
                indentList(editor);
            }
            return;
        }
        
        // ... 更多条件
    };
    
    return <Editable onKeyDown={handleKeyDown} />;
};
```

**特点**：
- ✅ 灵活：可以访问完整的编辑器状态
- ❌ 命令式：充满 if/else 嵌套
- ❌ 难以测试：需要模拟 React 组件和编辑器实例
- ❌ 难以复用：逻辑分散在各个组件中

#### 方案 C: Quill.js 的模块系统

```typescript
class Keyboard extends Module {
    constructor(quill, options) {
        super(quill, options);
        this.addBinding({ key: 'Enter' }, this.handleEnter);
        this.addBinding({ key: 'Tab' }, this.handleTab);
    }
    
    handleEnter(range, context) {
        if (context.format.list) {
            // 处理列表中的回车
        } else if (context.format.code) {
            // 处理代码块中的回车
        }
    }
}
```

**特点**：
- ✅ 模块化：逻辑封装在模块中
- ✅ 上下文感知：可以访问格式信息
- ⚠️ 半命令式：仍然需要 if/else 判断
- ⚠️ 扩展性有限：难以处理复杂的状态组合

---

## 🎯 CalibURRouter 的优势

### 1. 声明式 vs 命令式

**旧机制（命令式）**：
```typescript
if (isMatchList || isMatchOList || isMatchCheck || isMatchQuote) {
    if (selectsElement.length === 1) {
        if (type === "NodeParagraph") {
            if (isMatchQuote) {
                // 执行 A
            } else {
                // 执行 B
            }
        } else if (type === "NodeList") {
            if (subType === "o" && (isMatchList || isMatchCheck)) {
                // 执行 C
            }
            // ... 更多嵌套
        }
    }
}
```

**CalibURRouter（声明式）**：
```typescript
calibur.universe(StateSchema)
    .split(type({ isQuoteKey: "true", currentType: "'NodeParagraph'" }), executeA)
    .split(type({ isListKey: "true", currentType: "'NodeParagraph'" }), executeB)
    .split(type({ isListKey: "true", currentType: "'NodeList'", currentSubtype: "'o'" }), executeC)
    .remain(executeDefault)
    .build();
```

**对比**：
- 声明式：一眼看出所有可能的状态和对应的处理
- 命令式：需要追踪嵌套逻辑才能理解完整流程

### 2. 类型安全

**旧机制**：
```typescript
const type = selectsElement[0].dataset.type; // string | undefined
const subType = selectsElement[0].dataset.subtype; // string | undefined

// 运行时才知道是否有效
if (type === "NodeList") {
    if (subType === "o") { // 可能是 undefined
        // ...
    }
}
```

**CalibURRouter**：
```typescript
// 编译时类型检查
const StateSchema = type({
    currentType: "'NodeParagraph' | 'NodeList' | 'NodeHeading'",
    currentSubtype: "'u' | 'o' | 't' | null"
});

// 运行时类型验证
.split(
    type({ currentType: "'NodeList'", currentSubtype: "'o'" }),
    (state) => {
        // state.currentType 类型是 "NodeList"
        // state.currentSubtype 类型是 "o"
        // TypeScript 自动收窄类型
    }
)
```

**对比**：
- CalibURRouter：编译时 + 运行时双重保护
- 旧机制：只能靠人工检查和运行时错误

