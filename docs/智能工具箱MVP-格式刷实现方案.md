# 智能工具箱 MVP 阶段 1：格式刷 (Style Brush) 实现方案

## 1. 目标概述
本 MVP 旨在验证 **TriggerRegistry** 架构下的“刷子模式 (Brush Mode)”生命周期。通过实现一个经典的“格式刷”，打通从菜单触发、光标随动、到事务化批量修改样式的完整链路。

## 2. 核心功能流程

### 2.1 触发介入 (Gutter Menu Integration)
- **拦截位置**：`app/src/protyle/gutter/buildGutterCommonMenu.ts`
- **逻辑**：
- **拦截位置**：`app/src/protyle/gutter/buildGutterCommonMenu.ts`
- **逻辑**：
    - 在 `buildGutterStyleBrushMenu.ts` 中实现菜单项构建逻辑。
    - 检查当前块（`nodeElement`）是否具有 `style` 属性。
    - 若存在样式，在菜单中注入操作项：`{ label: "复制外观", icon: "#iconFormat", click: () => 激活样式刷子(style) }`。
- **状态**：✅ 已完成

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
        - 移除画笔光标，清理全局点击拦截器。
- **状态**：✅ 已完成

## 3. 技术实现细节

### 3.1 跨组件通信
- 使用 `EventBus` 发送 `s-forge-trigger-brush` 事件，携带 `sourceStyle`。
- `TriggerRegistry` 响应事件并启动 `immediate` 模式下的预处理，随后切换至 `brush` 状态。

### 3.2 样式应用逻辑
- **参考**：`toread/TEColors/source/utils/DOM/blockStyle.js`
- **代码预演**：
    ```typescript
    // 应用于目标块，目前使用的是内核 API
    // 未来可迁入事务以支持更平滑的撤销
    export async function 应用样式(targetId: string, style: string): Promise<boolean> {
        try {
            await fetchPost("/api/attr/setBlockAttrs", {
                id: targetId,
                attrs: { style }
            });
            return true;
        } catch (e) {
            return false;
        }
    }
    ```
- **状态**：✅ 已完成 (采用内核 API 实现)

### 3.3 退出拦截器
- 监听 `window` 级的 `mousedown`：
    - 若 `e.button === 2` (右键)，立即 `cancelBrush()`。
    - 若 `e.target` 具有 `data-type="a"` 或 `data-type="block-ref"`，视为“上下文切换触发点”，执行动作后退出模式。

## 4. 文件变更清单（已完成）
| 文件路径 | 用途 | 状态 |
|---------|------|------|
| `app/src/protyle/gutter/buildGutterCommonMenu.ts` | 注入菜单入口 | ✅ 已完成 |
| `app/src/protyle/gutter/buildGutterStyleBrushMenu.ts` | 格式刷专用菜单项构建 | ✅ 已完成 |
| `app/src/protyle/gutter/styleBrush.ts` | 核心逻辑 - 主模块入口 | ✅ 已完成 |
| `app/src/protyle/gutter/styleBrush.impl.ts` | 核心逻辑 - 实现细节 | ✅ 已完成 |
| `app/src/protyle/gutter/styleBrush.guard.ts` | 类型守卫 | ✅ 已完成 |
| `app/src/registry/TriggerRegistry.ts` | 触发器注册表核心 | ✅ 已完成 |
| `app/src/registry/TriggerRegistry.types.ts` | 类型定义 | ✅ 已完成 |
| `app/src/registry/TriggerRegistry.cursor.ts` | 光标管理模块 | ✅ 已完成 |
| `app/src/registry/TriggerRegistry.guard.ts` | 类型守卫 | ✅ 已完成 |

---

## 5. 当前进度 (Current Progress)

MVP 阶段 1 **已全部完成**。

### 已验证特性：
- **TriggerRegistry 注册机制**：能够成功注册 `brush` 模式的触发器。
- **刷子生命周期管理**：`onEnter`、`onExit` 钩子能正确处理光标切换和组件清理。
- **状态机流转**：能够正确处理“激活 -> 应用 -> 退出”的完整链条。
- **Gutter 菜单集成**：实现了上下文感知的菜单项显示（仅在有样式时显示）。

### 遗留问题/待优化：
- **同步撤销**：目前使用 `/api/attr/setBlockAttrs`，虽然也有撤销历史，但不如客户端事务流水（Transaction）平滑。
- **跨窗口支持**：目前事件监听绑定在 `getGlobalWindow()`，需要确保在多窗口环境下依然稳定。

---
*关联主设计方案: [[docs/智能工具箱设计方案.md]]*
