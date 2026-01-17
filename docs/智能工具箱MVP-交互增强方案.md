# 智能工具箱 MVP - 交互增强方案：富交互与上下文分类

## 1. 目标概述
本阶段旨在增强智能工具箱的交互能力，重点解决单一点击交互的局限性。通过引入“多态交互 (Polymorphic Interaction)”，使同一个工具条目能够根据用户的点击方式（如 `Ctrl+Click`、`Shift+Click`）执行不同的操作变体。

首个验证场景为 **格式刷 (Style Brush)** 的批量应用功能：
- **默认行为 (Click)**：点击单个块应用样式。
- **增强行为 (Ctrl+Click)**：点击任意块时，对当前所有 **已选中** 的块批量应用样式。

## 2. 架构变更

### 2.1 TriggerRegistry 类型扩展
需要扩展 `ITriggerRegistration` 的 `onApply` 签名，使其能够接收原始事件对象，从而判断修饰键状态。

**变更前**：
```typescript
onApply: (target: Element, context: IGlobalContext, isSecondary: boolean) => void;
```

**变更后**：
```typescript
onApply: (target: Element, context: IGlobalContext, options: { 
    isSecondary: boolean; 
    originalEvent?: MouseEvent | KeyboardEvent;
}) => void;
```

### 2.2 事件分发层
修改 `TriggerRegistry.handler.ts` 中的 `创建应用处理器`，将原生 `MouseEvent` 透传给 `onApply`。

## 3. 业务实现：格式刷批量应用

### 3.1 逻辑流程
1. 用户在 **刷子模式** 下按住 `Ctrl` 点击某个块。
2. `styleBrush.ts` 的 `onApply` 被触发。
3. 检查 `originalEvent.ctrlKey` 是否为 `true`。
4. 若为 `true`：
    - 获取当前 Protyle 实例。
    - 查找所有具有 `.protyle-wysiwyg--select` 样式的块 ID。
    - 若无选中块，退化为对当前点击块的操作。
    - 遍历所有选中块 ID，调用 `应用样式(id, style)`。
5. 若为 `false`：
    - 执行原有的单块应用逻辑。

### 3.2 批量操作优化
由于批量应用可能涉及大量网络请求，应考虑并发控制或后续改为事务 API (Transaction)。当前 MVP 阶段先使用 `Promise.all` 并发调用 `/api/attr/setBlockAttrs`。

## 4. 文件变更清单

| 文件路径 | 变更内容 |
|---------|---------|
| `app/src/registry/TriggerRegistry.types.ts` | 更新 `ITriggerRegistration.onApply` 签名，引入 `originalEvent`。 |
| `app/src/registry/TriggerRegistry.handler.ts` | 更新事件处理器，透传 `MouseEvent`。 |
| `app/src/protyle/gutter/styleBrush.ts` | 更新 `注册样式刷子` 和 `注册并激活自定义样式刷子` 的 `onApply` 实现，增加批量应用逻辑。 |

## 5. 后续计划
完成此交互增强后，将继续：
- 完善语义化分词驱动。
- 开发 UI 面板的滚动优化。
