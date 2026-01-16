# 思源笔记 Block (内容块) 操作模块

`app/src/block` 目录负责思源笔记中核心元素——“内容块”的高级操作逻辑、交互面板（Panel）以及弹出层（Popover）管理。

## 目录结构与功能说明

### 1. 块属性与面板
- **[Panel.ts](file:///d:/dev/siyuan-note/app/src/block/Panel.ts)**
  块属性设置面板的核心实现。处理块的属性编辑（如 ID、自定义属性、命名、别名等）以及面板的生命周期管理。
- **[Panel.render.ts](file:///d:/dev/siyuan-note/app/src/block/Panel.render.ts)**
  负责块面板内容的渲染逻辑。
- **[Panel.actions.ts](file:///d:/dev/siyuan-note/app/src/block/Panel.actions.ts)**
  枚举并处理面板中的各类交互动作（如点击保存、触发事件等）。

### 2. 交互弹出层
- **[popover.ts](file:///d:/dev/siyuan-note/app/src/block/popover.ts)**
  管理内容块相关的弹出层交互。例如鼠标悬停在块链接上时的即时预览窗口。
- **[popover/](file:///d:/dev/siyuan-note/app/src/block/popover/)**
  子目录包含了弹出层的具体子组件逻辑。

### 3. 工具类
- **[util.ts](file:///d:/dev/siyuan-note/app/src/block/util.ts)**
  提供对块进行操作的各种通用工具函数，如块查找、ID 验证、DOM 到块数据的转换等。

---

## 注意事项
- 本目录紧密依赖 Protyle 编辑器内核。
- 弹出层（Popover）的显示控制逻辑较为复杂，涉及位置计算与 z-index 冲突处理，修改时建议参考 `util.ts` 中的辅助计算函数。
