# Agent 框架前端调查报告

> **调查范围**: 项目现有 Agent/MAGI 相关前端代码、设计文档、后端配置结构，以及前端技术栈现状。
> **调查目的**: 为 MAGI 独立聊天面板前端实现提供技术基础参考。

---

## 1. 前端技术栈

**项目**: `s-forge` (v3.5.8)，基于 Siyuan 笔记内核的 Electron 应用。

| 技术 | 版本 | 用途 |
|------|------|------|
| TypeScript | ^5.9.3 | 主要开发语言 |
| Vue 3 | ^3.5.22 | UI 组件框架（已在当前分支启用） |
| Webpack 5 | ^5.104.1 | 构建工具 |
| Vitest | ^4.0.6 | 测试框架 |
| ESLint 9 | ^9.15.0 | 代码质量 |
| Zod | ^4.1.12 | 运行时类型校验 |
| `@modelcontextprotocol/sdk` | ^1.20.2 | MCP 协议支持 |
| `@leolee9086/siyuan-kernel-sdk` | link:../kernelSDKTS | 内核 SDK |
| `calibur-router` | link:../packages/caliburRouter | 路由系统 |

**构建目标**: `app`（Electron）、`desktop`（桌面浏览器）、`mobile`（移动端）、`export`（导出）

---

## 2. 后端 Agent 配置结构

**文件**: [`kernel/conf/agent.go`](../../kernel/conf/agent.go)

```go
type AgentConfig struct {
    Enabled       bool   `json:"enabled"`
    SoulDocID     string `json:"soulDocID"`     // 人格文档 ID
    ModelProvider string `json:"modelProvider"` // "openai", "anthropic"
    ModelName     string `json:"modelName"`     // "gpt-4-turbo"
    APIKey        string `json:"apiKey"`
    BaseURL       string `json:"baseURL"`
    MaxTokens     int    `json:"maxTokens"`
}
```

**环境变量支持**:
- `SIYUAN_AGENT_ENABLED`
- `SIYUAN_AGENT_SOUL_ID`
- `SIYUAN_AGENT_API_KEY`
- `SIYUAN_AGENT_BASE_URL`
- `SIYUAN_AGENT_MODEL`
- `SIYUAN_AGENT_MAX_TOKENS`

---

## 3. 已实现的后端 API

**文件**: [`kernel/api/magi.go`](../../kernel/api/magi.go)、[`kernel/api/magi_messages.go`](../../kernel/api/magi_messages.go)

已完成的先决条件（来自 ttt 文档）：
- ✅ MAGI 后端 API 端点 `/api/s-forge/magi/v1/chat/completions`
- ✅ Claude 原生流式接口（go-anthropic/v2 CreateMessagesStream）
- ✅ OpenAI ↔ Claude tool_use 协议双向转换层
- ✅ SSE 格式标准化（`data: ` 带空格）

---

## 4. 现有前端 AI 相关代码

### 4.1 AI 配置 UI

**文件**: [`app/src/config/ai/ai.ts`](../../app/src/config/ai/ai.ts)

已有 OpenAI 配置面板，包含 `apiUserAgent`、`apiBaseURL`、`apiKey` 等字段的输入控件。

### 4.2 AI 请求控制器

**文件**: [`app/src/ai/requestController.impl.ts`](../../app/src/ai/requestController.impl.ts)

已实现 HTTP 请求层，包含 `User-Agent` 注入、`apiUserAgent` 配置传递。

### 4.3 AI 类型定义

**文件**: [`app/src/ai/types.ts`](../../app/src/ai/types.ts)

```typescript
interface AIConfig {
    apiTimeout: number;
    apiUserAgent: string;
    apiVersion?: string;
    // ...
}
```

### 4.4 配置 Schema

**文件**: [`app/src/config/configSchemas/ai.schema.ts`](../../app/src/config/configSchemas/ai.schema.ts)

使用 Zod 进行运行时校验，`apiUserAgent` 字段已有 `min(1)` 约束。

---

## 5. MAGI 前端设计文档摘要

### 5.1 独立聊天面板设计

**文档**: [`docs/设计/MAGI独立聊天面板.design.md`](../设计/MAGI独立聊天面板.design.md)

**组件结构**:
- `MagiChat.vue` — 主页面（消息列表 + 输入区 + 状态栏）
- `ChatMessage.vue` — 消息气泡（支持 user/assistant/system/error/tool_call/tool_result）
- `ChatInput.vue` — 输入区域（Enter 发送，Shift+Enter 换行）
- `ChatHeader.vue` — 状态栏（连接状态 LED + 模型名称）

**视觉风格**: EVA 新世纪福音战士美学
- 背景: `rgba(0,0,0,0.9)` + 青色网格纹理
- 主色: 青色 `#0ff`（用户）、绿色 `#0f0`（AI）
- 字体: `'MS Gothic', monospace`
- 光效: `text-shadow: 0 0 10px currentColor`
- 扫描线动画

**挂载方案（推荐）**: 独立页面 `/stage/magi-chat/`

### 5.2 参考组件位置

`toread/MAGI/` 目录下存在原型验证组件：
- `components/MessageBubble.vue` — 消息气泡参考实现
- `components/MagiMainPanel.vue` — 主面板参考实现
- `index.vue` — 顶层容器参考

---

## 6. TTT 任务状态

### AIagent 设计 TTT

**文档**: [`docs/ttt/AIagent设计.ttt.md`](AIagent设计.ttt.md)

| 阶段 | 状态 |
|------|------|
| Phase 0: TS 原型验证 | 未开始 |
| Phase 1: 核心引擎基础（配置+LLM客户端+上下文构建器） | 未开始 |
| Phase 2: Agent 主循环 + 工具注册表 | 未开始 |
| Phase 3: 安全层 | 未开始 |
| Phase 4: 存储与记忆 + 工具 | 未开始 |
| Phase 5: 通道与调度 | 未开始 |
| Phase 6: 技能系统 | 未开始 |

### MAGI 独立聊天面板 TTT

**文档**: [`docs/ttt/MAGI_独立聊天面板.ttt.md`](MAGI_独立聊天面板.ttt.md)

| 阶段 | 状态 |
|------|------|
| 基础聊天功能（MagiChat.vue 骨架等） | 未开始 |
| EVA 视觉风格 | 未开始 |
| 路由挂载 | 未开始 |
| Markdown 渲染 | 未开始 |
| Tool Use 可视化 | 未开始 |

---

## 7. 关键结论

1. **Vue 3 已可用**: 当前分支已引入 Vue 3，可直接迁移 `toread/MAGI/*.vue` 组件。

2. **后端 API 已就绪**: `/api/s-forge/magi/v1/chat/completions` SSE 流式接口已实现，前端可直接对接。

3. **无现有 MAGI 前端代码**: `app/src` 下尚无任何 MAGI/Agent 专属前端组件，需从零实现。

4. **参考实现在 `toread/MAGI/`**: 原型验证组件已存在，可作为视觉和交互逻辑的直接参考。

5. **推荐目录**: `app/src/magi/` 作为专属目录，存放 `MagiChat.vue`、`ChatMessage.vue`、`ChatInput.vue`、`ChatHeader.vue` 及 `client.ts`。

6. **路由挂载**: 参照 `calibur-router` 体系，注册独立页面路由 `/stage/magi-chat/`。

---

**调查时间**: 2026-02-28
