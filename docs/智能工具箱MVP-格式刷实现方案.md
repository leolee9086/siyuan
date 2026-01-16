# 智能工具箱 MVP 阶段 1：格式刷 (Style Brush) 实现方案

## 1. 目标概述
本 MVP 旨在验证 **TriggerRegistry** 架构下的“刷子模式 (Brush Mode)”生命周期。通过实现一个经典的“格式刷”，打通从菜单触发、光标随动、到事务化批量修改样式的完整链路。

## 2. 核心功能流程

### 2.1 触发介入 (Gutter Menu Integration)
- **拦截位置**：`app/src/protyle/gutter/buildGutterCommonMenu.ts`
- **逻辑**：
    - 检查当前选中块（`blockElements`）的首个块是否具有 `style` 属性或 `ial` 中的自定义样式。
    - 若存在样式，在菜单末尾注入操作项：`{ label: "格式刷", icon: "#iconBrush", click: () => activateStyleBrush(style) }`。

### 2.2 刷子注册注册与状态机 [SFORGE]
- **标识符**：`s-forge-style-brush`
- **执行参数**：`sourceStyle: string` (暂存的 CSS 样式字符串)
- **状态转移**：
    - **Enter**：
        - 锁定全局 `isBrushActive` 状态。
        - 调用 `modecursor.js` 逻辑，生成随动光标（画笔图标）。
        - 注册全局 `click` 和 `keydown` 监听。
    - **Apply (点击块)**：
        - 检测目标是否为 `[data-node-id]` 块且不带链接属性。
        - 调用 `transaction` API 将 `sourceStyle` 应用到目标块。
    - **Exit**：
        - 捕获到 `Esc` 或右键点击。
        - 检测到重大的上下文切换（如打开了新文档或激活了其他插件浮层）。
        - 清理 UI 并释放光标。

## 3. 技术实现细节

### 3.1 跨组件通信
- 使用 `EventBus` 发送 `s-forge-trigger-brush` 事件，携带 `sourceStyle`。
- `TriggerRegistry` 响应事件并启动 `immediate` 模式下的预处理，随后切换至 `brush` 状态。

### 3.2 样式应用逻辑
- **参考**：`toread/TEColors/source/utils/DOM/blockStyle.js`
- **代码预演**：
    ```typescript
    // 应用于目标块，需通过思源事务以支持撤销
    const applyStyle = (targetId: string, style: string) => {
        const protyle = window.siyuan.ws.app.activeProtyle;
        if (!protyle) return;
        
        transaction(protyle, [{
            action: "setBlockAttrs",
            id: targetId,
            data: { style }
        }]);
    };
    ```

### 3.3 退出拦截器
- 监听 `window` 级的 `mousedown`：
    - 若 `e.button === 2` (右键)，立即 `cancelBrush()`。
    - 若 `e.target` 具有 `data-type="a"` 或 `data-type="block-ref"`，视为“上下文切换触发点”，执行动作后退出模式。

## 4. 文件变更预估
1. `app/src/protyle/gutter/buildGutterCommonMenu.ts`：增加菜单项注入逻辑。
2. `app/src/layout/registry/TriggerRegistry.ts` (新增)：核心管理类。
3. `app/src/protyle/ui/event.ts`：增加画笔模式下的点击分发钩子。

---
*关联主设计方案: [[docs/智能工具箱设计方案.md]]*
