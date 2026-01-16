# Protyle 编辑器核心模块说明

`app/src/protyle` 是思源笔记（SiYuan）的核心编辑器模块，这是一个基于块（Block-based）的所见即所得（WYSIWYG）Markdown 编辑器。

## 目录索引

为了便于理解和维护，我们对以下核心子模块进行了详细说明：

### 🧱 核心架构
- **[WYSIWYG 编辑器](file:///d:/dev/siyuan-note/app/src/protyle/wysiwyg/README.md)**: 编辑器主容器、事务同步系统及按键分发逻辑。
- **[Render 渲染逻辑](file:///d:/dev/siyuan-note/app/src/protyle/render/README.md)**: 块搜索嵌入（SQL/JS/语义）、代码高亮及数学公式渲染。
- **[Undo 撤销管理](file:///d:/dev/siyuan-note/app/src/protyle/undo/README.md)** (待详述): 管理编辑器本地的历史记录（区别于后端的块历史）。

### 🛠️ 工具与插件
- **[Toolbar 工具栏](file:///d:/dev/siyuan-note/app/src/protyle/toolbar/README.md)**: 动态浮动菜单、内联标记（加粗/链接）及插件扩展接口。
- **[Hint 补全提示](file:///d:/dev/siyuan-note/app/src/protyle/hint/README.md)**: 斜杠命令、块引用联想及 Emoji 补全。
- **[Utils 工具集](file:///d:/dev/siyuan-note/app/src/protyle/util/README.md)**: 选取（Selection）管理、跨平台兼容性及路径处理等原子操作。

### 🎨 UI 组件
- **[UI 初始化](file:///d:/dev/siyuan-note/app/src/protyle/ui/README.md)**: 编辑器基础 DOM 布局、图标初始化及事件绑定。
- **[Gutter 侧栏](file:///d:/dev/siyuan-note/app/src/protyle/gutter/README.md)** (待详述): 块标操作、折叠逻辑及侧边栏指示。

---

## 整体协作流程

1. **初始化**: `initUI.ts` 创建基础 DOM。
2. **加载内容**: `wysiwyg/index.ts` 通过监听 `transaction.ts` 获取后端数据并渲染。
3. **用户操作**:
   - 输入文本：由 `wysiwyg/input.ts` 处理。
   - 快捷键：由 `wysiwyg/keydown.ts` 分发。
   - 联想补全：由 `hint/index.ts` 捕获输入动态弹出提示。
   - 选中操作：由 `toolbar/index.ts` 弹出格式化工具。
4. **状态同步**: 所有变更通过 `wysiwyg/transaction.ts` 转换为原子操作（Operations）并同步到后端数据库。

---

## 技术细节注意事项

- **选取管理**: 全局共用 `protyle.toolbar.range`，所有针对文本的修改需先通过 `util/selection.ts` 重新定位光标。
- **数据一致性**: 编辑器不直接操作底层文件，而是通过“事务”操作数据库中的块。务必保证 DOM 状态与 `updated` 属性的一致性。
- **跨平台**: 区分 `Constants.MOBILE` 及系统类型（Mac/Win），处理不同的按键映射（Cmd vs Ctrl）。
