# 架构审阅：styleBrush.impl.ts 光标管理职责错位

## 问题描述

`styleBrush.impl.ts` 实现了本应由全局刷子管理器（TriggerRegistry）负责的光标元素管理功能。这违反了**单一职责原则**，导致：

1. **代码耦合**：具体刷子实现知道太多 UI 实现细节
2. **重复代码**：如果有其他刷子类型，需要复制光标管理逻辑
3. **不一致风险**：不同刷子可能有不同的光标管理实现

## 当前错误实现（styleBrush.impl.ts）

### 应移除的代码

```typescript
// 第 104-123 行：光标元素创建
export function 创建光标元素(): HTMLElement { ... }

// 第 131-134 行：光标位置更新
function 更新光标位置(cursor: HTMLElement, x: number, y: number): void { ... }

// 第 147-151 行：鼠标移动处理器
function 创建鼠标移动处理器(cursorElement: HTMLElement): (e: MouseEvent) => void { ... }

// 第 233-253 行和 258-284 行：事件监听管理（部分）
export function 设置事件监听(cursorElement: HTMLElement): void { ... }
export function 清理事件监听(): void { ... }
```

## TriggerRegistry 已有基础设施

- `IBrushSession.cursorElement` - 存储光标元素
- `设置刷子光标(element)` - 设置光标元素
- `退出刷子()` 中的 `session.cursorElement?.remove()` - 自动清理
- `注册刷子清理函数()` - 注册自定义清理逻辑

## 修复方案

### 方案 A：增强 TriggerRegistry（推荐）

在 TriggerRegistry 中增加：

```typescript
// 1. 新增光标管理函数
export function 创建刷子光标(html?: string, cssVars?: Record<string, string>): HTMLElement | null {
    const session = 获取刷子会话();
    if (!session) return null;
    
    const registration = 获取触发器(session.triggerType);
    const cursorHTML = html ?? registration?.cursorHTML;
    
    if (!cursorHTML) return null;
    
    const cursor = document.createElement("div");
    cursor.className = "sforge-brush-cursor";
    cursor.innerHTML = cursorHTML;
    // 应用通用样式
    cursor.style.cssText = `
        position: fixed;
        pointer-events: none;
        z-index: 99999;
        transform: translate(-50%, -50%);
        opacity: 0.9;
        filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));
    `;
    
    document.body.appendChild(cursor);
    设置刷子光标(cursor);
    
    return cursor;
}

// 2. 新增光标位置更新
export function 更新刷子光标位置(x: number, y: number): void {
    const session = 获取刷子会话();
    if (session?.cursorElement) {
        session.cursorElement.style.left = `${x}px`;
        session.cursorElement.style.top = `${y}px`;
    }
}

// 3. 将鼠标移动监听整合到 激活刷子 流程中
export function 激活刷子(type: string, params: unknown): boolean {
    // ... 现有逻辑 ...
    
    // 自动设置光标跟随（如果注册时提供了 cursorHTML）
    const cursor = 创建刷子光标();
    if (cursor) {
        const handler = (e: MouseEvent) => 更新刷子光标位置(e.clientX, e.clientY);
        window.addEventListener("mousemove", handler);
        注册刷子清理函数(() => window.removeEventListener("mousemove", handler));
    }
    
    // 自动注册 Esc 和右键退出
    const keyHandler = (e: KeyboardEvent) => {
        if (e.key === "Escape") { e.preventDefault(); 退出刷子(); }
    };
    const mouseHandler = (e: MouseEvent) => {
        if (e.button === 2) { e.preventDefault(); 退出刷子(); }  
    };
    window.addEventListener("keydown", keyHandler, true);
    window.addEventListener("mousedown", mouseHandler, true);
    注册刷子清理函数(() => {
        window.removeEventListener("keydown", keyHandler, true);
        window.removeEventListener("mousedown", mouseHandler, true);
    });
    
    // ...
}
```

### 方案 B：提取为独立模块

创建 `brushCursorManager.ts`，TriggerRegistry 调用该模块。

## styleBrush.impl.ts 重构后

重构后，样式刷子只需关注**样式提取和应用**的业务逻辑：

```typescript
// styleBrush.impl.ts 应该只包含：
export function 提取DOM样式(element: Element): string | null { ... }
export async function 提取块样式(element: Element): Promise<string | null> { ... }
export async function 应用样式(targetId: string, style: string): Promise<boolean> { ... }

// 点击处理器只处理业务逻辑，不管光标
function 创建点击处理器(): (e: MouseEvent) => void {
    return (e: MouseEvent) => {
        // 仅处理应用样式的逻辑
        // 不涉及光标管理
    };
}

// onEnter/onExit 回调简化
export function 样式刷子进入(params: unknown): void {
    // 只注册点击处理器
    const clickHandler = 创建点击处理器();
    添加窗口事件监听("click", clickHandler, true);
    注册刷子清理函数(() => 移除窗口事件监听("click", clickHandler, true));
}

export function 样式刷子退出(): void {
    // 业务清理（如有）
}
```

## 任务清单

- [ ] 在 TriggerRegistry 中添加光标管理 API
- [ ] 将通用事件监听（Esc/右键退出）移到 TriggerRegistry
- [ ] 重构 styleBrush.impl.ts，移除光标相关代码
- [ ] 更新 styleBrush.ts 中的 `注册样式刷子` 使用新 API
- [ ] 添加测试确保刷子功能正常

## 相关文件

- `app/src/protyle/gutter/styleBrush.impl.ts` - 需要重构
- `app/src/registry/TriggerRegistry.ts` - 需要增强
- `app/src/registry/TriggerRegistry.types.ts` - 可能需要更新类型

---
**审阅日期**: 2026-01-17
**审阅人**: 织
