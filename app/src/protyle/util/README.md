# Protyle Util 核心工具模块说明

`app/src/protyle/util` 目录包含了 Protyle 编辑器底层的各种实用工具函数。这些函数涵盖了光标选取管理、DOM 树检索、跨平台兼容性处理、复制粘贴逻辑等核心功能。

## 核心文件功能说明

### 1. 光标与选取 (Selection)
- **[selection.ts](file:///d:/dev/siyuan-note/app/src/protyle/util/selection.ts)**
  这是编辑器最核心的文件之一。
  - **选取定位**: 提供 `getEditorRange`、`getSelectionPosition` 等函数来精确获取和计算光标在编辑器中的坐标。
  - **焦点管理**: `focusBlock`、`focusByRange` 等函数用于控制编辑器内块的聚焦。
  - **偏移量计算**: `getSelectionOffset` 用于计算字符级别的光标偏移，这对于撤销重做及后端同步至关重要。
  - **特殊处理**: 包含针对表格、代码块及 `wbr`（用于保持光标位置的占位符）的特殊 focus 逻辑。

### 2. DOM 检索 (DOM Traversal)
- **[hasClosest.ts](file:///d:/dev/siyuan-note/app/src/protyle/util/hasClosest.ts)**
  提供了一系列高效查找“最近父节点”的工具函数。
  - **多维度查找**: 支持按 `id` (`hasClosestBlock`)、类名 (`hasClosestByClassName`)、标签名 (`hasClosestByTag`) 及任意属性 (`hasClosestByAttribute`) 向上检索。
  - **顶级查找**: `hasTopClosestBy...` 系列函数会一直向上检索直到遇到编辑器的根容器（`protyle-wysiwyg`），这在处理嵌套块逻辑（如嵌入块、属性视图）时非常有用。

### 3. 环境与兼容性 (Compatibility)
- **[compatibility.ts](file:///d:/dev/siyuan-note/app/src/protyle/util/compatibility.ts)**
  处理不同操作系统（Windows/macOS/Linux/Android/iOS/Harmony）及不同浏览器间的差异。
  - **平台识别**: `isMac`、`isIPhone`、`isInAndroid` 等简单的布尔检查函数。
  - **原生对接**: 封装了移动端（JSAndroid / JSHarmony / Webkit MessageHandlers）的剪贴板读写、文件下载、外部链接打开等接口。
  - **快捷键转换**: `updateHotkeyTip` 将编辑器内部的 Mac 风格快捷键（如 ⌘）自动转换为适合当前平台的展示方式（如 Ctrl+...）。

### 4. 其它核心工具
- **[onGet.ts](file:///d:/dev/siyuan-note/app/src/protyle/util/onGet.ts)**: 处理从服务器获取内容后的各种初始化工作（如数学公式渲染、代码块高亮）。
- **[paste.ts](file:///d:/dev/siyuan-note/app/src/protyle/util/paste.ts)**: 处理及其复杂的剪切板内容解析逻辑（支持从各种编辑器或网页粘贴 HTML/Markdown）。
- **[hotKey.ts](file:///d:/dev/siyuan-note/app/src/protyle/util/hotKey.ts)**: 编辑器快捷键的分发与注册。
- **[setEditMode.ts](file:///d:/dev/siyuan-note/app/src/protyle/util/setEditMode.ts)**: 切换块的编辑状态（WYSIWYG 模式与源代码预览模式）。

---

## 模块设计模式
- **原子化**: 大部分函数都是无副作用的原子工具，易于在整个 `protyle` 模块中复用。
- **容错性**: 由于直接操作 DOM，大部分函数都包含严谨的 `element.nodeType` 检查和空值保护。
- **跨端一致性**: 通过 `compatibility.ts` 屏蔽了底层环境差异，使得上层 UI 逻辑可以保持简洁。
