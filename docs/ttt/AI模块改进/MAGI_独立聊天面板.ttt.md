# MAGI 独立聊天面板 执行跟踪 (TikTocTak)

> **目标**: 为 MAGI 系统构建独立的 Agent 聊天面板，替代对外部客户端（ChatBox 等）的依赖。
> - 支持流式输出（SSE）、Markdown 渲染、代码高亮
> - 支持 tool_use 可视化（Agent 工具调用过程展示）
> - 移动端优先设计，全端适配
> - 视觉风格遵循 EVA 新世纪福音战士美学（参考 `d:\dev\siyuan-note\toread\MAGI` 下的组件）
>
> **设计文档**: [MAGI独立聊天面板.design.md](../设计/MAGI独立聊天面板.design.md)
>
> **流程**: 这是一个滚动更新的执行路线图。
> 1. 从"近期计划"中认领一个任务。
> 2. 完成开发和测试。
> 3. 将其移动到"已归档/已完成"区域。
> 4. 将"中期计划"中的条目提升到"近期计划"。

## 核心原则

1. **不依赖思源笔记特性**：聊天面板是独立模块，不与编辑器耦合
2. **自己搓组件**：不使用第三方聊天 UI 库，保证 EVA 视觉风格的完整性
3. **接口复用**：直接调用已实现的 `/api/s-forge/magi/v1/chat/completions` 接口
4. **渐进增强**：先做基础聊天，再逐步加入 tool_use 可视化和三贤人面板

## 维护说明

- **负责人**: 织
- **更新频率**: 每次任务状态变更时更新

---

## 近期计划 (P0)

### [ ] 基础聊天功能
- [ ] P0 创建 `MagiChat.vue` 主页面骨架
  - 消息列表 + 输入区域 + 状态栏
- [ ] P0 实现 `ChatMessage.vue` 消息气泡组件（参考: `d:\dev\siyuan-note\toread\MAGI\components\MessageBubble.vue`）
  - 用户消息（右对齐、青色边框）
  - AI 回复（左对齐、绿色边框）
  - 系统消息（居中、黄色）
- [ ] P0 实现 `ChatInput.vue` 输入组件
  - Enter 发送、Shift+Enter 换行
  - 加载中禁用状态
- [ ] P0 实现 SSE 流式请求与逐字渲染
  - fetch API 发送请求
  - ReadableStream 逐 chunk 解析
  - 流式打字光标 `█` 闪烁动画
- [ ] P0 实现 `ChatHeader.vue` 状态栏
  - 连接状态 LED、模型名称

### [ ] EVA 视觉风格
- [ ] P0 深色背景 + 网格纹理 + 扫描线动画
- [ ] P0 霓虹发光效果（text-shadow）
- [ ] P0 消息气泡样式（参考 `d:\dev\siyuan-note\toread\MAGI\components\MessageBubble.vue` 和 `d:\dev\siyuan-note\toread\MAGI\components\MagiMainPanel.vue`）
- [ ] P1 自定义滚动条（青色主题）

### [ ] 路由挂载
- [ ] P0 确定挂载方式（独立页面 vs 侧边栏 Dock）
- [ ] P0 注册路由或 Dock 面板

---

## 中期计划 (P1)

### [ ] Markdown 渲染
- [ ] 集成 markdown-it 或 Lute 渲染器
- [ ] 代码块语法高亮（highlight.js）
- [ ] 行内代码、链接、列表等基础排版

### [ ] Tool Use 可视化
- [ ] tool_call 气泡（紫色边框，显示工具名 + 参数折叠）
- [ ] tool_result 气泡（灰色边框，显示执行结果折叠）
- [ ] 工具调用进度指示

### [ ] 思考内容折叠
- [ ] 识别 `<think>` 标签
- [ ] 可折叠展开的思考过程区域
- [ ] 参考 `d:\dev\siyuan-note\toread\MAGI\components\MessageBubble.vue` 的 think-section 实现

### [ ] 移动端适配
- [ ] 消息气泡宽度 95%
- [ ] 输入框底部固定 + 安全区适配
- [ ] Header 折叠为单行模式

---

## 长期计划 (P2)

### [ ] 对话持久化
- [ ] 每条消息自动写入思源日记（Callout 块）
- [ ] 历史会话加载

### [ ] 三贤人面板集成
- [ ] 拆分模式：显示 MELCHIOR / BALTHASAR / CASPER 独立回复
- [ ] 合并模式：显示 Trinity 共识结果
- [ ] 同步率指示器

### [ ] 会话管理
- [ ] 多会话切换
- [ ] 历史记录搜索
- [ ] 会话导出

### [ ] 语音输入
- [ ] 移动端语音识别集成

---

## 已归档/已完成

（暂无）

---

## 先决条件（已完成）

- [x] MAGI 后端 API 端点 `/api/s-forge/magi/v1/chat/completions`
- [x] Claude 原生流式接口（go-anthropic/v2 CreateMessagesStream）
- [x] OpenAI ↔ Claude tool_use 协议双向转换层
- [x] SSE 格式标准化（data: 带空格）
