# 思源笔记 In-Note Plugin (页内插件) 模块

`app/src/inNotePlugin` 目录实现了“页内脚本/插件”的执行环境。这通常用于在特定的文档页面中按需加载并执行特定的 JavaScript 交互逻辑。

## 目录结构与功能说明

### 1. 编译与加载
- **[compiler.ts](file:///d:/dev/siyuan-note/app/src/inNotePlugin/compiler.ts)**: 负责对页内定义的脚本代码进行预编译或安全校验。
- **[loader.ts](file:///d:/dev/siyuan-note/app/src/inNotePlugin/loader.ts)**: 在文档渲染时，智能识别相关的代码块并触发脚本装载。

### 2. 运行时管理
- **[manager.ts](file:///d:/dev/siyuan-note/app/src/inNotePlugin/manager.ts)**: 页内插件的生命周期中心。负责管理插件示例的启动、参数传递与销毁。
- **[permissionManager.ts](file:///d:/dev/siyuan-note/app/src/inNotePlugin/permissionManager.ts)**: 处理页内脚本的运行权限申请，确保安全性。

---

## 注意事项
- 与全局插件（`app/src/plugin`）不同，本模块更强调脚本与特定文档内容的耦合。
- 页内插件应当运行在受限的沙盒环境中。
