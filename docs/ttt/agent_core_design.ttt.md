# Go Agent 核心设计 (集成于 S-forge)

## 1. 概述 (Overview)

**目标**: 将 `nanoClaw` 的 ReAct 架构移植到 S-forge 的 `kernel` 层，构建一个高性能、安全且具备持久记忆的通用 Agent 运行时。

**核心原则**:
1.  **通用性 (Generic)**: 核心引擎不绑定任何特定人格 ，人格通过配置和文档加载。
2.  **安全性 (Security)**: 内置多层级沙箱 (FileSystem, Shell, Network).
3.  **有状态 (Stateful)**: 通过 `Session` 和 `Memory` 维持长短期记忆。
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

// Persona 定义代理的人格设定 (解耦核心逻辑)
// 运行时从 Siyuan 笔记或 JSON 配置加载
type Persona struct {
    Name         string   // e.g., "Zhi"
    Description  string   // System Prompt 的核心部分
    Instructions []string // 核心指令集
    Tone         string   // 语气风格指导
    Memories     []string // 初始植入记忆 (少量重要事实)
}

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
- **实现**: Siyuan 笔记系统。
- **Persona Document**: 
    - 既然 "织" 是主要人格，指定一个特定的 Document ID 作为 "Persona Profile"。
    - 包含: 自我认知、核心指令、长期积累的经验。
- **Knowledge Documents**:
    - Agent 也就是 "织" 产出的结构化知识 (如教程、总结) 直接作为笔记 Block 存入 Siyuan。
    - 利用 Siyuan 的 `FullTextSearch` 能力进行检索。

## 4. 工具系统 (Tool System)

### 4.1 接口定义

```go
type Tool interface {
    Name() string
    Description() string
    Schema() string // JSON Schema for functional calling
    
    // 执行逻辑
    // args: JSON 格式的参数
    Execute(ctx context.Context, args []byte) (string, error)
    
    // 安全元数据
    Options() ToolOptions
}

type ToolOptions struct {
    IsDangerous  bool // true: 需要用户显式批准 (Human-in-the-loop)
    RequireShell bool // true: 需要 Shell 环境
    ReadOnly     bool // true: 只读操作 (Safe)
    Cacheable    bool // true: 结果可缓存 (e.g., Search)
}
```

### 4.2 核心工具集

1.  **System Tools**:
    - `Shell`: 在隔离环境执行命令 (类似于 `nanoclaw` 的 Tier-2 Sandbox)。
    - `FileSystem`: `ReadFile`, `WriteFile`, `ListDir` (受限于 Workspace)。
    
2.  **Web Tools**:
    - `WebSearch`: 搜索引擎接口。
    - `WebFetch`: 网页内容提取 (Readability)。

3.  **Siyuan Tools** (深度集成):
    - `NoteRead(id)`: 读取 Block 内容/结构。
    - `NoteWrite(parentID, content)`: 写入/追加笔记。
    - `NoteSearch(query)`: 调用 Kernel 的全爱搜索。
    - `GraphQuery(id)`: 查询双链关系。

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

## 7. 实施计划 (Roadmap)

1.  **Infrastructure (`kernel/agent`)**: 定义结构体，实现 `Session` 和 `ContextManager`。
2.  **LLM Connector**: 封装 `go-openai`，实现基础 Chat Loop。
3.  **Tooling Layer**: 实现 `ToolRegistry` 和基础的文件/Shell 工具。
4.  **Siyuan Integration**: 桥接 `kernel/model` 实现笔记读写工具。
5.  **Memory System**: 集成 `kernel/vectordb` 实现记忆存取。
6.  **API & UI**: 暴露 `/api/agent` 端点，前端适配。
