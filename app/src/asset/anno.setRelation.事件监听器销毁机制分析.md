# anno.setRelation.ts 事件监听器销毁机制审阅

## 审阅时间
2026-01-05 22:31

## 问题概述

当前 `anno.setRelation.ts` 文件中存在**事件监听器泄漏问题**。在 [setupDialogEventListeners](file:///d:/dev/siyuan-note/app/src/asset/anno.setRelation.ts#L166-L174) 函数中添加的事件监听器没有清理机制，当对话框被销毁时这些监听器仍然存在，可能导致内存泄漏。

## 当前问题

### 1. 事件监听器未清理

```typescript
// 第 168-173 行
inputElement.addEventListener("keydown", (event: KeyboardEvent) => {
    handleKeydownEvent(event, inputElement, configItem, pdf, config, dialog, rectElement);
});
dialog.element.addEventListener("click", (event: Event) => {
    handleClickEvent(event, configItem, pdf, config, dialog, rectElement);
});
```

**问题**：
- 这些监听器在对话框关闭后不会自动移除
- 如果对话框频繁打开/关闭，会累积大量未清理的监听器
- 虽然 DOM 元素被销毁后监听器会被垃圾回收，但闭包仍然持有 `pdf`、`config`、`rectElement` 等对象的引用，可能延迟内存回收

### 2. 代码注释已指出问题

第 164 行的注释明确指出：
> @问题/改进: 事件监听器没有清理机制，如果对话框频繁创建销毁可能造成内存泄漏。建议在对话框销毁时移除监听器。

## 解决方案：使用 AbortSignal

### 方案一：利用 AbortSignal 统一管理（推荐）

**优点**：
- ✅ 现代化的解决方案，浏览器原生支持
- ✅ 自动清理所有监听器，无需手动 removeEventListener
- ✅ 代码更简洁，易于维护
- ✅ 支持一次性清理多个监听器

**实现示例**：

```typescript
const setupDialogEventListeners = (
    inputElement: HTMLInputElement, 
    configItem: IPdfAnno, 
    pdf: IPdfInstance, 
    config: Record<string, IPdfAnno>, 
    dialog: Dialog, 
    rectElement: HTMLElement
) => {
    // 创建 AbortController
    const abortController = new AbortController();
    const signal = abortController.signal;
    
    inputElement.focus();
    
    // 使用 signal 选项添加监听器
    inputElement.addEventListener("keydown", (event: KeyboardEvent) => {
        handleKeydownEvent(event, inputElement, configItem, pdf, config, dialog, rectElement);
    }, { signal });
    
    dialog.element.addEventListener("click", (event: Event) => {
        handleClickEvent(event, configItem, pdf, config, dialog, rectElement);
    }, { signal });
    
    // 可以为对话框添加销毁回调
    // 假设 Dialog 类提供了 onDestroy 或类似机制
    // dialog.onDestroy(() => abortController.abort());
    
    // 或者返回清理函数
    return () => abortController.abort();
};
```

### 方案二：检查 Dialog 类的生命周期钩子

需要检查 `Dialog` 类（在 `../dialog` 中）是否提供了销毁回调机制，例如：
- `onDestroy` / `onClose` 钩子
- `destroy()` 方法
- 自定义事件

如果有，可以在对话框销毁时调用 `abortController.abort()`。

### 方案三：传统方案 - 手动 removeEventListener

如果不使用 AbortSignal，需要：

```typescript
const setupDialogEventListeners = (...) => {
    const keydownHandler = (event: KeyboardEvent) => {
        handleKeydownEvent(event, inputElement, configItem, pdf, config, dialog, rectElement);
    };
    
    const clickHandler = (event: Event) => {
        handleClickEvent(event, configItem, pdf, config, dialog, rectElement);
    };
    
    inputElement.addEventListener("keydown", keydownHandler);
    dialog.element.addEventListener("click", clickHandler);
    
    // 返回清理函数
    return () => {
        inputElement.removeEventListener("keydown", keydownHandler);
        dialog.element.removeEventListener("click", clickHandler);
    };
};
```

## 实施建议

### 第一步：调查 Dialog 类

查看 `../dialog` 中 `Dialog` 类的实现，确定：
1. 是否有销毁/关闭回调机制？
2. 对话框关闭时 DOM 元素是如何处理的？
3. 是否已有其他地方使用了 AbortSignal？

### 第二步：实施修复

推荐使用 **AbortSignal 方案**，理由：
- 浏览器兼容性好（所有现代浏览器都支持）
- 代码更简洁
- 符合现代 Web 标准
- 统一的清理机制

### 第三步：验证效果

修复后应验证：
1. 对话框关闭后监听器是否被正确清理
2. 频繁打开/关闭对话框是否造成内存泄漏
3. 功能是否正常工作

## 其他发现

### 相关文件可能也有类似问题

根据代码注释（第 142 行）：
> @问题/改进: 每次都创建新对话框可能造成资源浪费，可以考虑复用对话框实例并更新内容。

如果改为复用对话框，事件监听器的管理会更加重要，需要在每次打开时清理旧监听器并添加新的。

### 浏览器兼容性

AbortSignal 在 addEventListener 中的使用兼容性：
- Chrome: 90+
- Firefox: 57+
- Safari: 15+
- Edge: 90+

如果项目需要支持更老的浏览器，可能需要使用传统方案或 polyfill。

## 总结

✅ **可以且应该使用 AbortSignal 机制**来统一管理事件监听器的销毁。

**下一步行动**：
1. 查看 `Dialog` 类的实现，确定销毁时机
2. 修改 `setupDialogEventListeners` 函数使用 AbortSignal
3. 在对话框销毁时调用 `abort()`
4. 测试验证修复效果

---

## ✅ 实施结果 (2026-01-05 22:39)

### 已完成的改进

#### 1. 为 Dialog 类添加 `listen` 方法

在 [index.ts](file:///d:/dev/siyuan-note/app/src/dialog/index.ts#L243-L277) 中实现：

```typescript
public listen(
    target: EventTarget,
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: AddEventListenerOptions | boolean
): void {
    const listenerOptions = typeof options === "boolean" 
        ? { capture: options, signal: this.abortController.signal }
        : { ...options, signal: this.abortController.signal };
    
    target.addEventListener(type, listener, listenerOptions);
}
```

**实现要点**：
- 在构造函数中创建 `AbortController` 实例
- `listen` 方法自动将 `signal` 添加到监听器选项中
- 在 `destroy` 方法中调用 `this.abortController.abort()` 统一清理所有监听器

#### 2. 修改 anno.setRelation.ts 使用新 API

在 [anno.setRelation.ts](file:///d:/dev/siyuan-note/app/src/asset/anno.setRelation.ts#L168-L176) 中：

```typescript
const setupDialogEventListeners = (...) => {
    inputElement.focus();
    dialog.listen(inputElement, "keydown", (event) => {
        handleKeydownEvent(event, inputElement, configItem, pdf, config, dialog, rectElement);
    });
    dialog.listen(dialog.element, "click", (event) => {
        handleClickEvent(event, configItem, pdf, config, dialog, rectElement);
    });
};
```

**改进点**：
- 不再使用 `addEventListener` 直接添加监听器
- 使用 `dialog.listen` 方法，监听器生命周期与对话框绑定
- 移除了"事件监听器可能造成内存泄漏"的注释，问题已解决

#### 3. 添加类型守卫

为了兼容 `EventListenerOrEventListenerObject` 类型，在 [handleKeydownEvent](file:///d:/dev/siyuan-note/app/src/asset/anno.setRelation.ts#L84-L94) 中添加了类型守卫：

```typescript
const handleKeydownEvent = (event: Event, ...) => {
    if (!(event instanceof KeyboardEvent)) {
        return;
    }
    // ... 处理逻辑
};
```

### 优势总结

1. **统一管理**：所有通过 `dialog.listen` 添加的监听器都会在对话框销毁时自动清理
2. **防止内存泄漏**：不再需要手动管理 `removeEventListener`
3. **代码简洁**：调用者无需关心清理逻辑
4. **易于扩展**：其他使用 Dialog 的地方也可以使用这个方法

### 适用范围

这个模式可以推广到项目中所有使用 `Dialog` 类的地方，统一解决事件监听器的生命周期管理问题。

---

审阅人：织  
优先级：中（存在潜在内存泄漏，但影响可能不会立即显现）  
~~建议修复时间：下次重构此模块时一并处理~~  
**✅ 已修复时间：2026-01-05 22:39**
