# Go Agent 核心设计 (集成于 S-forge)

## 1. 概述 (Overview)

**目标**: 将 `nanoClaw` 的 ReAct 架构移植到 S-forge 的 `kernel` 层，构建一个高性能、安全且具备持久记忆的通用 Agent 运行时。

**核心原则**:
1.  **通用性 (Generic)**: 核心引擎不绑定任何特定人格 ，人格通过配置和文档加载。
2.  **安全性 (Security)**: 内置多层级沙箱 (FileSystem, Shell, Network).
3.  **有状态 (Stateful)**: 通过 `Session` 和 `Memory` 维持长短期记忆。sa
4.  **Siyuan 原生 (Native)**: 深度集成 Siyuan 笔记作为长期记忆存储。

## 2. 核心架构 (Core Architecture)

包路径: `kernel/agent`

### 2.1 数据结构

```go
// Agent 是核心运行时引擎
type Agent struct {
    LLM           *openai.Client
    Memory        MemoryStore        // 混合记忆存储
    Tools         *ToolRegistry      // 工具注册表
    Security      *SecurityGuard     // 安全守卫
    ContextMgr    *ContextManager    // 上下文与预算管理
    Cache         *SessionCache      // 工具结果缓存
}

// Persona 定义代理的人格 (Siyuan Native)
// 此时 Persona 不再是一个简单的静态配置，而是指向一个 Siyuan 文档 (Soul Document)
// 运行时通过解析该文档的 Block 属性 (custom-chat-role, custom-ai-persona) 动态构建
type Persona struct {
    DocID        string   // Siyuan Document ID (The "Body" anchor)
    Name         string   // e.g., "Zhi"
    SystemPrompt string   // 动态聚合 custom-chat-role=system 的块
    Tools        []Tool   // 动态加载 JavaScript 代码块作为工具
    MemoryRoot   string   // 记忆根节点 ID
}

// 参见 docs/设计/AI-Persona.design.md 获取完整映射逻辑

// Session 管理多轮对话状态
type Session struct {
    ID           string
    PersonaID    string           // 关联的人格
    History      []openai.ChatCompletionMessage
    Budget       *BudgetTracker   // 实时预算追踪
    CreatedAt    time.Time
    LastAccess   time.Time
    Variables    map[string]any   // 会话级临时变量
}

// BudgetTracker 跟踪资源消耗
type BudgetTracker struct {
    MaxIterations    int // e.g., 15
    MaxTokens        int // e.g., 50000
    MaxToolsPerMin   int // e.g., 20
    
    CurrentIter      int
    TokenUsage       int
    ToolCallsWindow  []time.Time // 用于计算速率
}
```

### 2.2 运行循环 (RunLoop)

Go 原生并发模式实现的 ReAct 循环：

1.  **初始化**:
    - 加载 `Session`。
    - 加载 `Persona` 配置。
    - `ContextManager` 构建初始 Prompt (System + Memories + History)。

2.  **迭代循环 (Thinking Loop)**:
    - **Check**: `BudgetTracker` 检查 (Token, 迭代次数, 速率)。
    - **Observe**: 获取 LLM 响应。
    - **Decide**:
        - 文本响应 -> Stream back to User -> **Break**。
        - 工具调用 -> **Continue**。
    - **Act**:
        - `SecurityGuard` 验证工具参数。
        - `ToolRegistry` 执行工具 (Async/Sync)。
        - 结果处理: 截断超长输出，存入 History。
    - **Reflect** (Optional): 周期性总结当前状态 (如迭代 > 10 次)。

3.  **收尾 (Finalize)**:
    - 异步触发 `MemoryStore` 的事实提取 (Extract Facts)。
    - 保存 Session 状态。

## 3. 记忆系统 (Memory System)

采用分层混合存储架构：

### 3.1 短期记忆 (Working Memory)
- **实现**: `Session.History` (内存 + SQL/Gob 持久化)。
- **策略**: 滑动窗口 (Sliding Window) + 关键信息摘要 (Summarization)。
- **ContextManager**: 负责在 Token 超限时智能裁剪历史消息。

### 3.2 中期记忆 (Fact Store)
- **实现**: `kernel/vectordb` (Vamana 引擎)。
- **Collection**: `agent_facts`。
- **内容**: 从对话中自动提取的事实 (User Preferences, Project Details)。
- **检索**: 每次会话开始时，根据 User Query 进行语义检索 (Top-K)。

### 3.3 长期记忆 (Knowledge Base) - Siyuan Native
- **实现**: Siyuan 笔记系统 (The Brain)。
- **Soul Document**: 
    - "织" (Zhi) 的核心定义文档。
    - **System Prompt Blocks**: 具有 `custom-chat-role=system` 属性的块，定义自我认知、核心指令。
    - **Tool Blocks**: 嵌入的 JavaScript 代码块，定义"身体"能力 (Function Calling)。
- **Memory Blocks**:
    - Soul Document 中的普通文本块视为"核心记忆" (Core Memories)。
    - 通过双链 (Ref) 关联的文档视为"关联记忆" (Associative Memories)。
- **Retrieval**:
    - **Active Recall**: Agent 主动调用 `memory_search` 工具查询 Siyuan 数据库。
    - **Passive Context**: 运行时自动加载 Soul Document 的最近更新作为 Short-term context。

## 4. 工具系统 (Tool System) - "Body" Capabilities

### 4.1 混合工具链 (Hybrid Toolchain - Instincts & Sub-Agents)

Agent 的工具不再局限于简单的函数调用，而是被视为 **Sub-Agents (子代理)** 或 **Instincts (本能)**。

-   **Philosophy (哲学)**:
    -   **Trinity (显意识)**: 决定 **"意图" (Intent)** (e.g. "把这个功能实现了")。
    -   **Sub-Agents (本能)**: 负责 **"实现" (Implementation)** (e.g. 思考每一行代码怎么写)。
    -   就像人类走路不需要思考每块肌肉的收缩一样，Trinity 调用工具时，只是触发了一个"本能"，具体的执行细节由专门的小模型/逻辑闭环完成。

#### 4.1.1 Instincts (本能 - Kernel Native Tools)
由 Go 实现，暴露给 JS 环境。相当于"神经反射"或"硬件驱动"。
-   `fs`: 文件系统操作 (受限)。
-   `cmd`: Shell 命令执行 (受限)。
-   `siyuan`: Kernel 内部 API (Block/SQL/Search)。

#### 4.1.2 Sub-Agents (子代理 - Cognitive Tools)
定义在 Soul Document 中的 JavaScript 代码块，或者是专门的微型 Agent。
-   **Coder**: 专门的 Coding Agent，接收需求，输出 diff。
-   **Searcher**: 专门的搜索 Agent，负责总结搜索结果。
-   **Vision**: 视觉识别模型。
*这些子代理在 Trinity 看来是"原子化"的，直接返回最终结果。*

### 4.2 核心工具集 (Kernel Layer)

1.  **Senses (感知)**:
    - `NoteRead(id)`: "看"笔记。
    - `ScreenRead()`: (未来) "看"屏幕内容 (OCR/Accessibility)。
    - `UserListen()`: "听"用户消息 (Gateway)。

2.  **Actions (行动)**:
    - `NoteWrite(id, content)`: "写"笔记 (思考/记录)。
    - `MsgSend(content)`: "说"话。
    - `CmdExec(command)`: "动"手 (Shell)。

3.  **Meta (元能力)**:
    - `SelfUpdate(blockID, newContent)`: "自我进化" (修改自己的 System Prompt 或代码)。

## 5. 上下文与预算管理 (Context Manager)

负责解决 "Token 有限" 和 "记忆无限" 的冲突。

- **Token Budgeting**:
    - 实时计算 Prompt Token 消耗。
    - 当接近 Model Limit (e.g. 128k) 时，触发 `PruneStrategy`。
- **PruneStrategy (裁剪策略)**:
    1.  **Trim**: 移除最早的对话轮次 (保留 System Prompt)。
    2.  **Compress**: 将中间轮次的 "Tool Call + Output" 压缩为单行摘要 (e.g., "Executed ls, listed 5 files").
    3.  **Summarize**: 对久远的对话生成自然语言摘要。

## 6. 安全沙箱 (Security Guard)

借鉴 `nanoclaw` 的设计，但在 Go 中更严格地实现。

- **FileGuard**:
    - `Chroot` 逻辑模拟: 限制所有文件操作在 `workspace/data` 下。
    - **Blocklist**: `.env`, `conf.json`, `~/.ssh`, `/etc` 等敏感路径硬编码拦截。
- **CmdGuard**:
    - **Allowlist**: 仅允许常用开发命令 (`git`, `go`, `ls`, `grep` 等)。
    - **Confirm**: 危险命令 (`rm`, `mv` 大量文件) 需前端弹窗确认。
- **NetGuard**:
    - 仅允许对特定域名的出站请求 (可通过配置放行)。

## 7. 认知内核接口 (Ghost Interface)

Shell 通过统一接口与认知内核 (Ghost) 交互。Ghost 的内部实现（MAGI 三贤人、ATF 同步率、Seraph 调节等）对 Shell 完全透明——Shell 将 Ghost 视为一个增强版的 LLM。

> **Ghost 内部设计详见**: [MAGI认知架构.design.md](MAGI认知架构.design.md)
> **ATF 数学模型详见**: [ATF数学模型.design.md](ATF数学模型.design.md)

### 7.1 接口定义

```go
// Ghost 对 Shell 暴露的唯一接口
type Ghost interface {
    // Think 接收用户消息 + 上下文，返回响应
    // 内部经过 MAGI 决策流程，但对调用方透明
    Think(ctx Context, messages []Message) (Response, error)
}

type Response struct {
    Text       string      // 最终响应文本
    ToolCalls  []ToolCall  // 工具调用请求（由 Shell 执行）
    Metadata   GhostMeta   // 可选的诊断信息（SyncRate, ATF 等）
}

type GhostMeta struct {
    SyncRate   float64     // 当前同步率 ρ（仅诊断用途）
    ATFStrength float64    // 当前 ATF 强度 F（仅诊断用途）
    Mode       string      // "reflex" | "deliberate"（反射弧 or 慢思考）
}
```

### 7.2 交互协议

1. **Shell → Ghost**: 发送用户消息 + 工具执行结果 + 上下文。
2. **Ghost → Shell**: 返回响应文本 和/或 工具调用请求。
3. **Shell 执行工具** → 将结果反馈给 Ghost → 循环直到 Ghost 返回纯文本响应。

Shell 不感知 Ghost 内部的三贤人竞争、Global Broadcast、Seraph 干预等机制。Ghost 可以是 MAGI 系统，也可以退化为单一 LLM 调用——Shell 的行为不变。

### 7.3 反馈分发 (Feedback Dispatch)

Ghost 内部需要 Shell 返回的工具执行结果，但不同内部组件需要不同粒度的信息。Shell 只需返回完整结果，Ghost 内部自行分发：

| Shell 返回 | Ghost 内部分发 |
|-----------|--------------|
| 完整工具执行结果 | Melchior: 详细内容 |
| | Balthazar: 成功/失败状态 + 情感影响 |
| | Casper: 完整结果（受工作记忆限制） |

分发逻辑是 Ghost 的内部实现细节，Shell 无需关心。

## 8. 实施计划 (Roadmap)

1.  **Infrastructure (`kernel/agent`)**: 定义结构体，实现 `Session` 和 `ContextManager`。
2.  **Soul Engine**: 实现 `Persona` 加载器 (解析 Siyuan 文档) 和 JS 运行时 (goja)。
3.  **LLM Connector**: 封装 `go-openai`，实现基础 Chat Loop (System 1)。
4.  **Cognitive Loop**: 实现 Ghost 接口及 MAGI 内部机制（详见 [MAGI认知架构.design.md](MAGI认知架构.design.md)）。
5.  **Tooling Layer**: 实现 `ToolRegistry` 和基础的文件/Shell 工具 + Siyuan Native Tools。
6.  **Memory System**: 集成 `kernel/vectordb` 实现记忆存取。
7.  **API & UI**: 暴露 `/api/agent` 端点，前端适配。

## 9. nanoClaw → kernel 移植调研

> 调研时间: 2026-02-09 (第二次，基于完整源码阅读)
> 状态: 调研完成

### 一、nanoClaw 代码概览

#### 1.1 技术栈

- **语言**: Python 3.11+，全异步 (asyncio)
- **依赖** (pyproject.toml):
  - `aiohttp>=3.9` — HTTP 客户端/服务端 (LLM API 调用 + Dashboard)
  - `python-telegram-bot>=20.0` — Telegram 通道
  - `click>=8.0` — CLI 框架
  - `pydantic>=2.0` — 配置校验
  - `html2text>=2024.2` — HTML→Markdown 转换
  - `croniter>=1.3` — Cron 表达式解析
- **可选依赖**: `chromadb>=0.4` (语义搜索，实际代码中未使用)
- **存储**: 单一 SQLite 数据库 (`nanoclaw.db`)，启用 FTS5 + WAL 模式
- **代码量**: 约 2800 行 Python (不含测试)

#### 1.2 目录结构与模块职责

```
nanoclaw/
├── core/           # 核心引擎 (~900 行)
│   ├── agent.py    # Agent 主循环: ReAct 模式, 工具并行执行, 会话缓存, 自动升级
│   ├── config.py   # Pydantic v2 配置模型, 多 LLM 提供商, JSON 文件加载
│   ├── context.py  # 上下文构建: 动态工具选择, 自适应历史窗口, 输出压缩
│   ├── llm.py      # LLM 客户端: OpenRouter/Anthropic/OpenAI/DeepSeek, 连接池, 重试
│   └── logger.py   # 日志配置
├── security/       # 安全层 (~650 行)
│   ├── sandbox.py  # FileGuard (路径验证+符号链接防护) + ShellSandbox (三级命令过滤)
│   ├── prompt_guard.py  # 提示注入检测 (NFKC 归一化, 30+ 正则模式)
│   ├── budget.py   # SessionBudget (迭代/token/工具调用/shell/超时 限制)
│   ├── audit.py    # AuditLog (HMAC-SHA256 完整性校验, SQLite 存储)
│   └── doctor.py   # SecurityDoctor (8 项安全自检)
├── tools/          # 工具层 (~400 行)
│   ├── registry.py # 装饰器注册, OpenAI 格式 schema 生成, 技能自动加载
│   ├── files.py    # file_read/file_write/file_list (O_NOFOLLOW 防护)
│   ├── shell.py    # shell_exec (委托 ShellSandbox)
│   ├── web.py      # web_search (Brave API) + web_fetch (SSRF 防护)
│   ├── memory_tools.py  # memory_save/memory_search
│   └── spawn.py    # spawn_task (后台子 Agent, 并发限制 3)
├── memory/         # 记忆层 (~200 行)
│   └── store.py    # SQLite 持久化: messages + memories + FTS5 + 去重
├── channels/       # 通道层 (~350 行)
│   ├── gateway.py  # 中央消息路由, 信号处理, 优雅关闭
│   ├── telegram.py # Telegram 轮询, 白名单, InlineKeyboard 确认, 消息分片
│   └── console.py  # 控制台通道
├── cron/           # 定时任务 (~150 行)
│   └── scheduler.py # 持久化定时任务 (cron 表达式 + 间隔秒数)
├── dashboard/      # 管理面板 (~150 行)
│   ├── server.py   # aiohttp 服务, Bearer 认证, REST API
│   └── index.html  # 单页面 HTML
├── skills/         # 内置技能 (~200 行)
│   ├── loader.py   # 技能自动发现 (文件权限校验)
│   ├── weather.py, github.py, news.py, summarize_url.py, timezones.py
│   └── (用户可在 ~/.nanoclaw/skills/ 放置自定义技能)
└── cli/            # CLI 入口
    └── main.py     # Click CLI (init/serve/chat/status/doctor/cron/config)
```

#### 1.3 核心架构与模块依赖

**依赖关系** (基于实际 import 分析):

```
Gateway ──→ Agent ──→ LLMClient (core/llm.py)
  │           │──→ MemoryStore (memory/store.py)
  │           │──→ ToolRegistry (tools/registry.py) ──→ 各工具模块
  │           │──→ AuditLog (security/audit.py)
  │           │──→ SessionBudget (security/budget.py)
  │           │──→ PromptGuard (security/prompt_guard.py)
  │           └──→ ContextBuilder (core/context.py)
  │
  ├──→ TelegramChannel (channels/telegram.py)
  ├──→ Scheduler (cron/scheduler.py)
  └──→ Dashboard (dashboard/server.py)
```

**全局单例模式**: 所有核心组件通过 `get_xxx()` / `set_xxx()` 管理全局实例，延迟初始化。

**关键设计特征**:
- Agent.run() 是同步入口，内部 for 循环实现 ReAct 迭代
- 工具并行执行通过 `asyncio.gather()` 实现
- 自动升级机制: 迭代 ≥4 次时注入内部 nudge 提示
- 记忆提取通过 `asyncio.create_task()` 后台异步执行
- SessionCache 提供 TTL 缓存，file_write 时自动失效 file_read 缓存
- LLM 客户端内部处理 OpenAI↔Anthropic 格式转换 (`_adapt_for_anthropic`)
- DeepSeek 复用 OpenAI 客户端代码，仅替换 base_url

### 二、kernel 目标环境概览

#### 2.1 技术栈

- **语言**: Go 1.25.4
- **Web 框架**: gin-gonic/gin
- **存储**: SQLite (通过 go-sqlite3)
- **LLM 库**: `sashabaranov/go-openai` (已在 kernel/model/ai.go 中使用)
- **已有 AI 模块**: model/ai.go (ChatGPT 简单封装)、embedding (Ollama 向量嵌入)、vectordb (Vamana/HNSW)

#### 2.2 可复用基础设施

| 设施 | 位置 | 文件数 | 与 Agent 的关系 |
|------|------|--------|----------------|
| HTTP 服务 | `kernel/server/` | 3 | Dashboard/API 端点直接复用 gin 路由 |
| API 层 | `kernel/api/` | 50+ | 已有 ai.go、cronjob.go、embedding.go、vector.go |
| AI 模型调用 | `kernel/model/ai.go` | 1 | 已有 go-openai 集成，但仅支持 OpenAI 格式 |
| 定时任务 | `kernel/cronjob/` | 12 | yaegi Go 脚本解释执行、安全沙箱、存储层 |
| 嵌入向量 | `kernel/embedding/` | 3 | Ollama 集成，可用于记忆语义搜索 |
| 向量数据库 | `kernel/vectordb/` | 30+ | Vamana/HNSW 索引，BBQ 量化，磁盘存储 |
| SQL 层 | `kernel/sql/` | - | SQLite 数据库管理，FTS5 支持 |
| 配置系统 | `kernel/conf/` | 22 | Go 结构体配置，JSON 序列化 |
| 工具库 | `kernel/util/` | - | 通用工具函数 |

### 三、移植工作项清单

#### 3.1 核心引擎 (新建 `kernel/agent/`)

| # | 工作项 | nanoClaw 源 | kernel 实现方案 | 复杂度 | 行数估算 |
|---|--------|-------------|----------------|--------|---------|
| 1 | 配置模型 | `core/config.py` (243行, 12个 Pydantic model) | Go struct + `encoding/json`，扩展 `kernel/conf/` | 低 | ~150 |
| 2 | LLM 客户端 | `core/llm.py` (409行, 3个 provider) | 扩展现有 `go-openai`；Anthropic 需自建适配层 | **高** | ~400 |
| 3 | 上下文构建器 | `core/context.py` (238行) | Go 直译，纯逻辑无外部依赖 | 低 | ~200 |
| 4 | 工具注册表 | `tools/registry.py` (294行, 装饰器模式) | Go `interface` + `sync.Map` 注册表 | 中 | ~200 |
| 5 | Agent 主循环 | `core/agent.py` (543行, ReAct 核心) | Go for 循环 + `sync.WaitGroup` 并行工具执行 | **高** | ~450 |
| 6 | SessionCache | `core/agent.py` 内嵌 (57行) | Go `sync.Map` + TTL 过期 | 低 | ~60 |

#### 3.2 安全层 (新建 `kernel/agent/security/`)

| # | 工作项 | nanoClaw 源 | kernel 实现方案 | 复杂度 | 行数估算 |
|---|--------|-------------|----------------|--------|---------|
| 7 | PromptGuard | `security/prompt_guard.py` (136行, 30+正则) | Go `regexp` + `golang.org/x/text/unicode/norm` NFKC | 低 | ~120 |
| 8 | SessionBudget | `security/budget.py` (161行) | Go struct，纯逻辑 | 低 | ~100 |
| 9 | FileGuard | `security/sandbox.py` 前半 (177行) | Go `filepath.Rel` + `os.Lstat` 符号链接检查 | 低 | ~120 |
| 10 | ShellSandbox | `security/sandbox.py` 后半 (253行, 三级过滤) | Go `regexp` + `os/exec`；可参考 `kernel/cronjob/safe_stdlib.go` | 中 | ~200 |
| 11 | AuditLog | `security/audit.py` (329行, HMAC) | Go `crypto/hmac` + `crypto/sha256` + SQLite | 中 | ~250 |
| 12 | SecurityDoctor | `security/doctor.py` (355行, 8项检查) | Go 实现，逻辑简单 | 低 | ~200 |

#### 3.3 存储与记忆 (新建 `kernel/agent/memory/`)

| # | 工作项 | nanoClaw 源 | kernel 实现方案 | 复杂度 | 行数估算 |
|---|--------|-------------|----------------|--------|---------|
| 13 | MemoryStore | `memory/store.py` (385行, SQLite+FTS5) | 复用 `kernel/sql` 基础设施；新建 agent 专用表 | 中 | ~300 |
| 14 | 语义搜索升级 | nanoClaw 仅用 FTS5 | 可选: 集成 `kernel/embedding` + `kernel/vectordb` | 中 | ~150 |

#### 3.4 工具实现 (新建 `kernel/agent/tools/`)

| # | 工作项 | nanoClaw 源 | kernel 实现方案 | 复杂度 | 行数估算 |
|---|--------|-------------|----------------|--------|---------|
| 15 | 文件工具 | `tools/files.py` (158行) | Go `os` 包，复用 FileGuard | 低 | ~120 |
| 16 | Shell 工具 | `tools/shell.py` (60行) | Go `os/exec`，委托 ShellSandbox | 低 | ~50 |
| 17 | Web 搜索 | `tools/web.py` 前半 (129行, Brave API) | Go `net/http`，需处理速率限制 | 中 | ~120 |
| 18 | Web 抓取 | `tools/web.py` 后半 (103行, SSRF防护) | Go `net/http` + HTML→Text；需 SSRF 防护 (DNS 解析检查) | 中 | ~150 |
| 19 | 记忆工具 | `tools/memory_tools.py` | Go 薄封装，委托 MemoryStore | 低 | ~40 |
| 20 | 后台任务 | `tools/spawn.py` (79行) | Go goroutine + `sync` 信号量 | 低 | ~60 |

#### 3.5 通道与调度

| # | 工作项 | nanoClaw 源 | kernel 实现方案 | 复杂度 | 行数估算 |
|---|--------|-------------|----------------|--------|---------|
| 21 | Gateway | `channels/gateway.py` (201行) | Go 消息路由，集成 gin 中间件 | 中 | ~150 |
| 22 | HTTP API 通道 | 无直接对应 | 新增 `/api/agent/chat` 端点，复用 `kernel/api/` 模式 | 低 | ~80 |
| 23 | Telegram 通道 | `channels/telegram.py` (219行) | 可选: Go `telegram-bot-api` 库 | 中 | ~200 |
| 24 | Cron 调度器 | `cron/scheduler.py` (259行) | 扩展 `kernel/cronjob/`，新增 agent 消息触发 | 低 | ~100 |
| 25 | Dashboard API | `dashboard/server.py` (250行) | 新增 gin 路由组 `/api/agent/admin/*` | 低 | ~100 |

#### 3.6 技能系统

| # | 工作项 | nanoClaw 源 | kernel 实现方案 | 复杂度 | 行数估算 |
|---|--------|-------------|----------------|--------|---------|
| 26 | 技能加载器 | `skills/loader.py` (101行) | 方案 A: yaegi 解释执行 (复用 cronjob)；方案 B: 编译时注册 | 中 | ~80 |
| 27 | 内置技能 | `skills/*.py` (~200行) | Go 实现，按需移植 | 低 | ~150 |

### 四、技术难点和风险点

#### 4.1 高风险

1. **Anthropic Messages API 适配** (源: `core/llm.py` L243-L310)
   - nanoClaw 的 `_adapt_for_anthropic()` 包含完整的 OpenAI→Anthropic 格式转换
   - 涉及: system 消息提取、tool_result 角色映射、tool_use content block 构建、arguments 字符串/对象双态解析
   - kernel 现有 `go-openai` 库仅支持 OpenAI 格式，Anthropic 需完全自建
   - **建议**: 考虑使用统一的 OpenAI 兼容格式 (通过 OpenRouter 代理所有提供商)，避免维护多格式转换

2. **Agent ReAct 循环的并发安全** (源: `core/agent.py` L101-L274)
   - Python 版利用 asyncio 单线程事件循环天然避免竞态
   - Go 版工具并行执行 (`sync.WaitGroup`) 需处理: messages 切片并发追加、SessionCache 并发读写、SessionTracker 计数器原子操作
   - 自动升级逻辑 (迭代≥4次注入 nudge) 需在循环中正确维护状态
   - 后台记忆提取 (`asyncio.create_task` → `go func()`) 需确保 MemoryStore 并发安全

#### 4.2 中风险

3. **SSRF 防护的 DNS 解析** (源: `tools/web.py` L20-L46)
   - nanoClaw 通过 `socket.getaddrinfo` + `ipaddress` 模块检查 DNS 解析结果是否为私有 IP
   - Go 中需用 `net.LookupHost` + `net.ParseIP` 实现等效检查
   - 需处理 DNS rebinding 攻击: 解析和请求之间 IP 可能变化

4. **Shell 沙箱的跨平台适配** (源: `security/sandbox.py` L179-L393)
   - nanoClaw 的 ShellSandbox 硬编码 Unix PATH (`/usr/local/bin:/usr/bin:/bin`)
   - kernel 运行在 Windows/macOS/Linux，需平台特定的 PATH 和环境变量处理
   - 命令过滤正则 (40+ 条) 中部分为 Unix 特有 (`rm -rf /`, `chmod 777`)，Windows 需等效规则

5. **工具输出的提示注入防护** (源: `security/prompt_guard.py`)
   - 30+ 正则模式需逐一验证在 Go `regexp` 语法下的兼容性
   - NFKC Unicode 归一化需引入 `golang.org/x/text/unicode/norm` 包
   - 工具输出包装为 `<tool_result trust="untrusted">` 格式需确保 LLM 正确解析

#### 4.3 低风险

6. **SQLite FTS5**: kernel 已有 `go-sqlite3` 基础设施，FTS5 扩展默认启用
7. **配置系统**: nanoClaw 的 Pydantic 模型可直接映射为 Go struct + JSON tag
8. **Dashboard/Cron**: kernel 已有 gin 路由和 cronjob 基础设施，仅需新增路由
9. **SessionBudget**: 纯数值比较逻辑，无外部依赖
10. **文件工具**: Go 标准库 `os` 包功能完备，`O_NOFOLLOW` 在 Unix 上可用 (Windows 无符号链接风险)

### 五、架构决策点

| 决策项 | 选项 | 依据 |
|--------|------|------|
| LLM 提供商策略 | A: 多提供商原生适配 (如 nanoClaw)<br>B: 统一走 OpenAI 兼容格式 | nanoClaw 的 Anthropic 适配层 (`_adapt_for_anthropic`) 约 70 行，维护成本高；kernel 已有 `go-openai`，OpenRouter 可代理所有提供商 |
| 记忆搜索引擎 | A: FTS5 文本匹配 (如 nanoClaw)<br>B: 向量语义搜索 | kernel 已有 `embedding/` + `vectordb/`，语义搜索质量远优于 FTS5；建议 FTS5 作为 fallback |
| 技能系统 | A: yaegi 解释执行<br>B: 编译时注册 | kernel/cronjob 已有 yaegi 沙箱；编译时注册更安全但不灵活 |
| Telegram 通道 | A: 移植<br>B: 不移植 | kernel 是桌面应用后端，HTTP API 通道是必须的；Telegram 可作为可选扩展 |
| CLI | 不移植 | kernel 通过 HTTP API 交互，CLI 无必要 |
| 全局单例模式 | 不沿用 | nanoClaw 的 `get_xxx()`/`set_xxx()` 模式在 Go 中应改为依赖注入 |

### 六、工作量估算

| 类别 | 行数估算 | 说明 |
|------|---------|------|
| 核心引擎 (3.1) | ~1460 | 配置+LLM+上下文+注册表+Agent循环+缓存 |
| 安全层 (3.2) | ~990 | PromptGuard+Budget+FileGuard+Shell+Audit+Doctor |
| 存储与记忆 (3.3) | ~450 | MemoryStore + 语义搜索升级 |
| 工具实现 (3.4) | ~540 | 文件+Shell+Web+记忆+后台任务 |
| 通道与调度 (3.5) | ~630 | Gateway+HTTP API+Telegram+Cron+Dashboard |
| 技能系统 (3.6) | ~230 | 加载器+内置技能 |
| **合计** | **~4300** | nanoClaw ~2800 行 Python → ~4300 行 Go (1.54x 膨胀系数) |

**关键路径**: LLM 客户端 (#2) → Agent 主循环 (#5) → 工具注册表 (#4) → 安全层 → 其余模块

**kernel 可复用部分** (降低约 25% 工作量):
- `go-openai` 库: 省去 OpenAI/OpenRouter 格式解析
- `kernel/sql`: 省去 SQLite 连接管理
- `kernel/cronjob`: 省去 yaegi 沙箱和脚本执行器
- `kernel/embedding` + `kernel/vectordb`: 省去语义搜索基础设施
- `kernel/server` (gin): 省去 HTTP 服务和路由框架

## 10. myclaw 调研 (Go 实现参考)

> 调研时间: 2026-02-10 (基于完整源码阅读)
> 状态: 调研完成
> 项目地址: `toread/myclaw/` — Go 1.24, 基于 agentsdk-go 的个人 AI 助手

### 七、myclaw 代码概览

#### 7.1 技术栈

- **语言**: Go 1.24
- **核心依赖**:
  - `agentsdk-go v0.8.3` — Agent 运行时 SDK (ReAct 循环 + 工具执行)
  - `go-telegram-bot-api/v5` — Telegram 通道
  - `robfig/cron/v3` — Cron 调度
  - `spf13/cobra` — CLI 框架
- **间接依赖**: `anthropic-sdk-go`, `openai-go`, `modelcontextprotocol/go-sdk` (MCP)
- **代码量**: 约 2000 行 Go (不含测试)，结构精简

#### 7.2 目录结构与模块职责

```
myclaw/
├── cmd/myclaw/          # CLI 入口 (~370 行)
│   └── main.go          # cobra CLI: agent (单消息/REPL) | gateway | onboard | status
├── internal/
│   ├── bus/             # 消息总线 (~50 行)
│   │   ├── bus.go       # MessageBus: 带缓冲 channel + 订阅者分发
│   │   └── events.go    # InboundMessage / OutboundMessage 事件定义
│   ├── channel/         # 通道层 (~860 行)
│   │   ├── base.go      # Channel 接口 + BaseChannel (白名单过滤)
│   │   ├── manager.go   # ChannelManager: 多通道注册/启停/订阅
│   │   ├── telegram.go  # Telegram 长轮询 + HTML 格式转换 + 消息分片
│   │   ├── feishu.go    # 飞书 webhook + tenant_access_token 缓存
│   │   └── wecom.go     # 企业微信: AES-CBC 加解密 + response_url 回复 + 重试
│   ├── config/          # 配置 (~190 行)
│   │   └── config.go    # JSON 配置 + 环境变量覆盖，多层级优先级
│   ├── cron/            # 定时任务 (~250 行)
│   │   ├── types.go     # CronJob 类型: cron/every/at 三种调度模式
│   │   └── service.go   # robfig/cron 集成 + JSON 持久化 + tickLoop
│   ├── gateway/         # 网关编排 (~270 行)
│   │   └── gateway.go   # 组装 bus+runtime+channels+cron+heartbeat
│   ├── heartbeat/       # 心跳服务 (~90 行)
│   │   └── service.go   # 定期读取 HEARTBEAT.md 触发 Agent
│   └── memory/          # 记忆系统 (~140 行)
│       └── memory.go    # 文件系统记忆: MEMORY.md (长期) + 日期.md (日志)
└── workspace/           # Agent 人格配置
    ├── AGENTS.md        # Agent 系统提示词
    └── SOUL.md          # Agent 人格定义
```

#### 7.3 核心架构与设计特征

**依赖关系** (基于实际 import 分析):

```
Gateway ──→ agentsdk-go Runtime (外部依赖)
  │           │──→ ModelFactory (Anthropic/OpenAI Provider)
  │           │──→ ProjectRoot (工作空间管理)
  │           │──→ SystemPrompt (从 AGENTS.md + SOUL.md + Memory 构建)
  │           └──→ MaxIterations (预算控制)
  │
  ├──→ MessageBus ──→ Inbound/Outbound channels
  ├──→ ChannelManager ──→ Telegram/Feishu/WeCom channels
  ├──→ CronService ──→ 持久化定时任务
  ├──→ HeartbeatService ──→ HEARTBEAT.md 定期触发
  └──→ MemoryStore ──→ 文件系统记忆存储
```

**关键设计特征**:
- **外部 SDK 依赖**: 核心 Agent 逻辑完全委托给 `agentsdk-go`，myclaw 仅负责编排和通道
- **消息总线模式**: 所有通道通过 MessageBus 解耦，支持多通道并发
- **配置优先级**: JSON 文件 < 环境变量，支持敏感信息外部化
- **人格文件分离**: AGENTS.md (系统提示) + SOUL.md (人格) + Memory 动态组装
- **多通道支持**: Telegram/飞书/企业微信三种通道，各自独立实现
- **定时任务持久化**: JSON 文件存储，支持 cron 表达式和间隔调度
- **优雅关闭**: 信号处理 + context 取消机制

### 八、myclaw vs nanoClaw 对比分析

#### 8.1 架构模式差异

| 维度 | nanoClaw (Python) | myclaw (Go) |
|------|------------------|-------------|
| **核心引擎** | 自建 ReAct 循环 (~543行) | 外部 agentsdk-go SDK |
| **工具系统** | 装饰器注册 + 自动发现 | 完全委托给 agentsdk-go |
| **安全沙箱** | 内置多层级沙箱 (~650行) | 依赖 agentsdk-go 内置安全 |
| **记忆系统** | SQLite + FTS5 (~385行) | 文件系统 (MEMORY.md + 日志) |
| **LLM 适配** | 多提供商原生适配 (~409行) | agentsdk-go 统一接口 |
| **通道系统** | Telegram + Console | Telegram + 飞书 + 企业微信 |
| **配置管理** | Pydantic 模型校验 | Go struct + JSON |
| **并发模型** | asyncio 单线程事件循环 | Go goroutine + channel |

#### 8.2 复杂度对比

| 模块 | nanoClaw 行数 | myclaw 行数 | 复杂度变化 |
|------|--------------|-------------|-----------|
| 核心引擎 | ~900 | ~0 (外部依赖) | **大幅简化** |
| 安全层 | ~650 | ~0 (外部依赖) | **大幅简化** |
| 工具层 | ~400 | ~0 (外部依赖) | **大幅简化** |
| 记忆层 | ~200 | ~140 | 轻微简化 |
| 通道层 | ~350 | ~860 | **复杂度增加** |
| 定时任务 | ~150 | ~250 | 复杂度增加 |
| 配置系统 | ~243 | ~190 | 轻微简化 |
| **总计** | **~2800** | **~2000** | **整体简化** |

#### 8.3 借鉴价值分析

**🟢 高价值借鉴点**:

1. **消息总线架构** (`internal/bus/`)
   - 解耦通道与核心逻辑，支持多通道并发
   - 订阅者模式 + 带缓冲 channel，性能优秀
   - **建议**: kernel 可采用类似模式替代直接 HTTP 调用

2. **配置优先级机制** (`internal/config/config.go`)
   - JSON 文件 < 环境变量的多层级覆盖
   - 敏感信息 (API Key) 外部化最佳实践
   - **建议**: 扩展 `kernel/conf/` 支持环境变量覆盖

3. **企业级通道支持** (`internal/channel/`)
   - 飞书/企业微信的完整实现，包含加解密、重试、缓存
   - 白名单过滤 + 消息去重机制
   - **建议**: kernel 可选择性集成企业通道

4. **人格文件分离** (`workspace/`)
   - AGENTS.md (系统提示) + SOUL.md (人格) 的清晰分工
   - 运行时动态组装，便于人格切换
   - **建议**: kernel 采用类似的人格管理方式

**🟡 中等价值借鉴点**:

5. **定时任务持久化** (`internal/cron/`)
   - JSON 文件存储 + robfig/cron 集成
   - 支持 cron/every/at 三种调度模式
   - **建议**: 可扩展 `kernel/cronjob/` 支持 Agent 消息触发

6. **心跳机制** (`internal/heartbeat/`)
   - 定期读取 HEARTBEAT.md 触发 Agent
   - 简单有效的主动任务触发方式
   - **建议**: kernel 可集成类似的主动触发机制

**🔴 低价值借鉴点**:

7. **外部 SDK 依赖策略**
   - myclaw 完全依赖 agentsdk-go，失去核心控制权
   - 无法深度定制 ReAct 循环和安全策略
   - **不建议**: kernel 应保持核心引擎自主可控

8. **文件系统记忆**
   - 简单的 MEMORY.md + 日期文件存储
   - 缺乏语义搜索和结构化查询能力
   - **不建议**: kernel 已有更优的 vectordb + FTS5 方案

### 九、对 kernel 实现的建议

基于 myclaw 调研，对原有 nanoClaw 移植计划的补充建议：

#### 9.1 架构决策更新

| 决策项 | 原建议 | myclaw 启发 | 更新建议 |
|--------|--------|-------------|----------|
| **通道系统** | HTTP API 为主 | 消息总线 + 多通道 | 采用消息总线架构，支持 HTTP + 企业通道 |
| **配置管理** | 扩展 kernel/conf | 环境变量优先级 | 增加环境变量覆盖机制 |
| **人格管理** | Siyuan 笔记集成 | 文件分离模式 | 支持文件模式作为 Siyuan 的补充 |
| **核心引擎** | 自建 ReAct 循环 | 外部 SDK 依赖 | **坚持自建**，保持核心控制权 |

#### 9.2 新增工作项建议

基于 myclaw 的优秀设计，建议在原有 27 个工作项基础上新增：

| # | 新增工作项 | 参考源 | 复杂度 | 行数估算 |
|---|-----------|--------|--------|---------|
| 28 | 消息总线 | `internal/bus/` | 低 | ~100 |
| 29 | 企业微信通道 | `internal/channel/wecom.go` | 中 | ~300 |
| 30 | 飞书通道 | `internal/channel/feishu.go` | 中 | ~200 |
| 31 | 环境变量配置覆盖 | `internal/config/config.go` | 低 | ~50 |
| 32 | 心跳触发机制 | `internal/heartbeat/` | 低 | ~80 |

**新增工作量**: ~730 行，使总工作量从 ~4300 行增至 ~5030 行

#### 9.3 实施优先级建议

**Phase 0: myclaw 启发的基础设施** (可选，优先级低)
- 消息总线 (#28): 为多通道支持打基础
- 环境变量配置覆盖 (#31): 提升配置灵活性

**Phase 1-6: 按原计划执行** (核心路径不变)
- 保持 nanoClaw 移植的核心架构和工作项优先级
- 自建 ReAct 循环和安全层，确保核心控制权

**Phase 7: 企业通道扩展** (可选)
- 企业微信通道 (#29) + 飞书通道 (#30)
- 心跳触发机制 (#32)

#### 9.4 关键结论

1. **myclaw 验证了 Go 实现的可行性**：2000 行 Go 代码实现完整 Agent 系统
2. **消息总线架构值得借鉴**：解耦通道与核心逻辑，支持多通道并发
3. **外部 SDK 依赖需谨慎**：myclaw 失去核心控制权，kernel 应坚持自建
4. **企业通道有商业价值**：飞书/企业微信的完整实现可提升 kernel 适用性
5. **配置管理可优化**：环境变量覆盖机制提升部署灵活性
