# MAGI 后端项目详细结构设计

## 架构核心理念

**关键认知**：MAGI的三贤人（Melchior/Balthazar/Casper）和Trinity是MAGI核心实例；Avatar是所有非 MAGI 且向 MAGI 汇报的协议角色。内部 Avatar 复用上游思源 Agent 系统的普通 Agent 会话，未来外部 Avatar 通过 LLM 转发服务接入；Avatar 不是 MAGI 内部的特殊运行时。它们：
- 各自维护独立的上下文和状态
- MAGI 核心实例通过消息总线通信；Avatar 消息经过 guardian 或 MAGI 的通信 ACL
- 可以并发执行，异步协作
- 前端面板独立监听每个agent的状态

**参考实践**：
- **myclaw**: 消息总线 + Gateway编排模式
- **nanoClaw**: 独立agent + ReAct循环 + 安全沙盒

## 现有实现分析

### 已有基础设施

kernel已经实现了MAGI的基础代理功能：

- **`kernel/api/magi.go`**: OpenAI Chat Completion代理
- **`kernel/api/magi_messages.go`**: Claude Messages API代理
- **队列机制**: 使用channel实现串行处理，保障Trinity上下文注入单线程原则
- **流式支持**: SSE流式响应处理
- **多Provider支持**: OpenAI和Claude

### 现有架构特点

1. **任务队列**: 使用`magiQueue`确保串行处理
2. **配置集成**: 复用`model.Conf.AI.OpenAI.*`配置
3. **客户端复用**: 使用`util.NewOpenAIClient`
4. **日志系统**: 使用`github.com/siyuan-note/logging`

## 新模块目录结构（基于独立Agent架构）

**设计原则**：
1. 三贤人、Trinity 和 Avatar 都通过明确的 Agent 会话边界运行；内部 Avatar复用上游普通 Agent，外部 Avatar 使用转发适配器
2. MAGI 核心通过消息总线（Bus）进行通信；Avatar 的消息必须经过 guardian 或 MAGI 的通信 ACL，不允许 Agent 间直连
3. 复用现有LLM客户端和API基础设施
4. 参考myclaw的Gateway编排 + nanoClaw的Agent实现

```
kernel/magi/
├── README.md                    # 项目概述
├── STRUCTURE.md                 # 本文件：详细结构设计
│
├── bus/                         # 消息总线（参考myclaw）
│   ├── bus.go                  # 消息总线核心
│   ├── message.go              # 消息信封定义
│   └── session.go              # 会话管理
│
├── agent/                       # Agent运行时（参考nanoClaw）
│   ├── agent.go                # Agent接口和基础实现
│   ├── context.go              # Agent上下文管理
│   ├── react.go                # ReAct循环实现
│   └── memory.go               # Agent记忆管理
│
├── sages/                       # 三贤人Agent实现
│   ├── melchior/               # Melchior（理性决策者）
│   │   ├── agent.go           # Melchior agent实现
│   │   ├── prompts.go         # 系统提示词
│   │   └── tools.go           # 专属工具集
│   ├── balthazar/              # Balthazar（感性决策者）
│   │   ├── agent.go
│   │   ├── prompts.go
│   │   └── tools.go
│   ├── casper/                 # Casper（直觉决策者）
│   │   ├── agent.go
│   │   ├── prompts.go
│   │   └── tools.go
│   └── trinity/                # Trinity（统合者）
│       ├── agent.go
│       ├── prompts.go
│       └── synthesis.go       # 综合逻辑
│
├── coordinator/                 # 决策协调器
│   ├── coordinator.go          # 主协调器
│   ├── collector.go            # 并发响应收集
│   ├── voter.go                # 投票管理
│   └── deliberation.go         # 审慎决策判断
│
├── gateway/                     # Gateway编排（参考myclaw）
│   ├── gateway.go              # Gateway主入口
│   ├── router.go               # 消息路由
│   └── dispatcher.go           # 任务分发
│
├── tools/                       # 工具注册系统（参考nanoClaw）
│   ├── registry.go             # 工具注册表
│   ├── executor.go             # 工具执行器
│   └── builtin/                # 内置工具
│       ├── siyuan.go          # 思源API工具
│       ├── file.go            # 文件操作
│       └── web.go             # 网络工具
│
├── security/                    # 安全防护（参考nanoClaw）
│   ├── prompt_guard.go         # 提示注入防护
│   ├── sandbox.go              # 命令沙盒
│   └── budget.go               # Token预算控制
│
├── config/                      # 配置管理
│   ├── seel.go                 # SEEL配置
│   └── loader.go               # 配置加载器
│
└── types/                       # 类型定义
    ├── message.go              # 消息类型
    ├── agent.go                # Agent类型
    └── config.go               # 配置类型
```

**关键变化**：
- **bus/**: 新增消息总线，所有agent通过它通信
- **agent/**: 新增通用agent运行时，提供ReAct循环等基础能力
- **sages/**: 每个贤人独立目录，包含agent实现、提示词、专属工具
- **gateway/**: 新增Gateway层，统一管理多来源任务
- **tools/**: 新增工具注册系统，支持动态工具注入
- **security/**: 新增安全防护层

## 核心模块设计

### 1. types 包 - 类型定义

**职责**: 定义所有数据结构

**关键类型**:
```go
// Message 消息结构（复用openai.ChatCompletionMessage）
type Message = openai.ChatCompletionMessage

// SEELConfig SEEL配置
type SEELConfig struct {
    Version        string  `json:"version"`
    SyncThreshold  float64 `json:"syncThreshold"`
    MemorySize     int     `json:"memorySize"`
    EnableVoting   bool    `json:"enableVoting"`
}

// SageResponse 贤者响应
type SageResponse struct {
    SageName             string
    Content              string
    ToolCalls            []openai.ToolCall
    RequiresDeliberation bool
}

// VoteDecision 投票决策
type VoteDecision struct {
    Approve bool
    Reason  string
}
```

### 2. config 包 - 配置管理

**职责**: 管理SEEL配置，对应前端 `core/marduk.ts`

**核心接口**:
```go
type Manager interface {
    GetSEELConfig() (*types.SEELConfig, error)
    ValidateSynchronization(syncRate float64) bool
}
```

**实现要点**:
- 从思源笔记存储加载SEEL配置
- 验证同步率阈值
- 线程安全访问

### 3. sage 包 - 贤者实例

**职责**: 管理四个贤者，对应前端 `core/wise/mockWise.subclass.ts`

**核心接口**:
```go
type Sage interface {
    GetName() string
    GetSystemPrompt() string
    GenerateResponse(ctx context.Context, client *openai.Client,
                     userInput string, history []types.Message) (*types.SageResponse, error)
    Vote(ctx context.Context, client *openai.Client,
         proposal string, context string) (*types.VoteDecision, error)
}
```

**贤者定义**:
- **Melchior**: 理性决策者，判断是否需要审慎决策
- **Balthazar**: 感性决策者，参与投票
- **Casper**: 直觉决策者，参与投票
- **Trinity**: 统合者，综合三贤人响应

**实现要点**:
- 复用`util.NewOpenAIClient`
- 每个贤者有独立系统提示词
- 管理各自的上下文历史（memorySize限制）
- 支持并发调用

### 4. consensus 包 - 共识决策

**职责**: 协调决策流程，对应前端 `composables/magiConsensus.ts`

**核心流程**:
```go
type Coordinator interface {
    ProcessUserInput(ctx context.Context, userInput string,
                     history []types.Message) (string, error)
}
```

**决策流程**:
1. **并发收集** (`collector.go`): 同时请求Melchior、Balthazar、Casper
2. **审慎判断** (`deliberation.go`): 检查Melchior的`requiresDeliberation`
3. **投票流程** (`voter.go`): 如需审慎，执行投票（≥2/3通过）
4. **Trinity统合**: 综合响应生成最终答案

**关键约束**:
- 审慎决策入口：严格只看Melchior工具调用的`requiresDeliberation`
- 禁止语义兜底：不允许通过关键词、正则等介入
- 投票阈值：≥2/3通过

### 5. stream 包 - 流式处理

**职责**: 处理流式响应，对应前端 `utils/streamProcessor.ts`

**核心功能**:
- 解析工具调用
- 识别Trinity speak工具
- 提取`requiresDeliberation`标记

**实现要点**:
- 复用现有SSE流式处理
- 正确解析JSON格式的工具调用

### 6. prompts 包 - 提示词模板

**职责**: 管理提示词，对应前端 `prompts/`

**提示词类型**:
- 各贤者系统提示词
- 投票评审提示词
- Trinity统合提示词

**实现方式**:
```go
const MelchiorSystemPrompt = `你是Melchior...`
```

## 数据流设计

### 正常决策流程

```
用户输入
    ↓
consensus.Coordinator.ProcessUserInput()
    ↓
consensus.Collector (goroutine并发)
    ├─→ Melchior.GenerateResponse()
    ├─→ Balthazar.GenerateResponse()
    └─→ Casper.GenerateResponse()
    ↓
consensus.Deliberation.Check()
    ↓ (requiresDeliberation=false)
Trinity.GenerateResponse(三贤人响应)
    ↓
返回最终响应
```

### 审慎决策流程

```
Melchior响应包含 requiresDeliberation=true
    ↓
consensus.Voter.ExecuteVoting()
    ├─→ Balthazar.Vote()
    └─→ Casper.Vote()
    ↓
计算投票结果 (≥2/3)
    ↓ (通过)
Trinity.GenerateResponse(三贤人响应 + 投票结果)
    ↓
返回最终响应
```

## 与现有代码集成

### API层集成

在`kernel/api/`中新增：

```go
// magiConsensus 处理MAGI共识决策请求
func magiConsensus(c *gin.Context) {
    // 1. 解析请求
    // 2. 调用 consensus.Coordinator
    // 3. 返回响应（支持流式）
}
```

### 配置集成

复用现有配置：
- `model.Conf.AI.OpenAI.*`: LLM配置
- 新增SEEL配置存储在思源笔记中

### 队列集成

复用现有队列机制：
```go
var magiConsensusQueue = make(chan *MagiConsensusRequest, 100)
```

## 并发控制设计

### 响应收集并发

```go
func (c *Collector) CollectResponses(ctx context.Context,
    sages []sage.Sage, input string) ([]types.SageResponse, error) {
    
    respChan := make(chan types.SageResponse, len(sages))
    errChan := make(chan error, len(sages))
    
    for _, s := range sages {
        go func(sage sage.Sage) {
            resp, err := sage.GenerateResponse(ctx, client, input, history)
            if err != nil {
                errChan <- err
                return
            }
            respChan <- resp
        }(s)
    }
    
    // 收集结果...
}
```

### 超时控制

```go
ctx, cancel := context.WithTimeout(context.Background(),
    time.Duration(model.Conf.AI.OpenAI.APITimeout)*time.Second)
defer cancel()
```

## 错误处理

### 错误类型

```go
var (
    ErrConfigNotFound = errors.New("SEEL config not found")
    ErrSyncRateLow = errors.New("sync rate below threshold")
    ErrVoteFailed = errors.New("voting failed")
    ErrLLMTimeout = errors.New("LLM timeout")
)
```

### 错误传播

- LLM错误：记录日志，返回错误响应
- 配置错误：使用默认配置
- 超时错误：取消context，清理资源

## 测试策略

### 单元测试

每个包都有`_test.go`文件：
- 使用mock接口隔离测试
- 测试覆盖率目标：>80%

### 对比测试

- 记录前端实现的输入输出
- Go实现必须产生相同结果
- 验证决策逻辑一致性

## 部署集成

### API端点

```
POST /api/magi/chat          # 现有OpenAI代理
POST /api/magi/messages      # 现有Claude代理
POST /api/magi/consensus     # 新增：共识决策
WS   /api/magi/ws            # 新增：WebSocket（Phase 3）
```

### 路由注册

在`kernel/api/router.go`中：
```go
group.POST("/magi/consensus", magiConsensus)
```

## 迁移路径

### Phase 1: 核心决策逻辑（当前）

1. 实现types、config、sage包
2. 实现consensus包
3. 实现stream包
4. 单元测试验证

### Phase 2: API集成

1. 在`kernel/api/`中实现consensus接口
2. 集成到路由
3. 集成测试

### Phase 3: WebSocket支持

1. 实现WebSocket服务
2. 前端适配
3. 端到端测试

### Phase 4: 前端切换

1. 前端改造为WebSocket模式
2. 对比测试
3. 全量切换

## 关键约束重申

1. **决策逻辑不变**: 与前端实现完全一致
2. **审慎决策入口**: 严格只看Melchior工具调用的`requiresDeliberation`
3. **禁止语义兜底**: 不允许后端新增语义判断
4. **复用现有基础设施**: 不重复造轮子
5. **保持简洁**: 最小化代码量

## 1. types 包 - 类型定义

**职责**：定义所有数据结构，确保类型安全

**关键类型**：
- `Message`: 消息结构（对应前端Message）
- `SEELConfig`: SEEL配置结构
- `SageResponse`: 贤者响应结构
- `ToolCall`: 工具调用结构
- `VoteResult`: 投票结果结构
- `WSMessage`: WebSocket消息结构

**设计原则**：
- 使用Go struct tag支持JSON序列化
- 与前端TypeScript类型保持一致
- 使用指针类型表示可选字段

### 2. config 包 - 配置管理

**职责**：管理SEEL配置，对应前端 `core/marduk.ts`

**核心接口**：
```go
type Manager interface {
    GetSEELConfig() (*types.SEELConfig, error)
    ValidateSynchronization(syncRate float64) bool
    LoadLatestConfig() error
}
```

**实现要点**：
- 从思源笔记存储中加载SEEL配置
- 验证同步率阈值
- 支持配置热更新
- 线程安全的配置访问

### 3. llm 包 - LLM通信

**职责**：封装LLM API调用，对应前端 `core/wise/mockWise.ts`

**核心接口**：
```go
type Client interface {
    ChatStream(ctx context.Context, messages []types.Message, model string) (<-chan StreamChunk, error)
    Chat(ctx context.Context, messages []types.Message, model string) (string, error)
}
```

**实现要点**：
- 使用 `github.com/sashabaranov/go-openai` 库
- 支持SSE流式响应
- 实现请求重试机制
- 支持context超时控制
- 管理上下文消息历史（memorySize限制）

### 4. stream 包 - 流式处理

**职责**：处理SSE流，对应前端 `utils/streamProcessor.ts`

**核心功能**：
- 解析SSE chunk（`data: [DONE]` 等）
- 提取工具调用（tool_calls）
- 识别Trinity speak工具
- 组装完整消息

**实现要点**：
- 使用channel传递流式数据
- 正确处理流结束标记
- 提取并解析JSON格式的工具调用
- 保持与前端完全一致的解析逻辑

### 5. sage 包 - 贤者实例

**职责**：管理四个贤者实例，对应前端 `core/wise/mockWise.subclass.ts`

**贤者定义**：
- **Melchior**: 理性决策者，负责判断是否需要审慎决策
- **Balthazar**: 感性决策者，参与投票
- **Casper**: 直觉决策者，参与投票
- **Trinity**: 统合者，综合三贤人响应生成最终答案

**核心接口**：
```go
type Sage interface {
    GetName() string
    GenerateResponse(ctx context.Context, userInput string, history []types.Message) (*types.SageResponse, error)
    Vote(ctx context.Context, proposal string, context string) (string, error)
}
```

**实现要点**：
- 每个贤者有独立的系统提示词
- 管理各自的上下文历史
- 支持并发调用
- 正确提取工具调用信息

### 6. consensus 包 - 共识决策

**职责**：协调决策流程，对应前端 `composables/magiConsensus.ts`

**核心流程**：
1. **响应收集** (`collector.go`): 并发收集三贤人响应
2. **审慎判断** (`deliberation.go`): 检查Melchior的`requiresDeliberation`标记
3. **投票流程** (`voter.go`): 如需审慎决策，执行投票（≥2/3通过）
4. **Trinity统合** (`trinity_summary.go`): 综合响应生成最终答案

**关键决策点**：
- **审慎决策入口**：严格只看Melchior工具调用中的`requiresDeliberation`信号
- **禁止语义兜底**：不允许通过正文关键词、正则、规则引擎等介入决策
- **投票阈值**：≥2/3（即至少2票）通过

**实现要点**：
- 使用goroutine实现并发响应收集
- 使用channel同步响应结果
- 实现超时控制
- 保持与前端完全一致的决策逻辑

### 7. websocket 包 - WebSocket服务

**职责**：提供WebSocket服务，推送状态更新到前端

**核心功能**：
- 连接管理（建立、维护、断开）
- 会话管理（用户会话、消息历史）
- 消息路由（接收前端请求，路由到决策流程）
- 状态推送（贤者响应、流式chunk、投票进度、错误）

**消息类型**：
- `sage_response`: 贤者响应
- `stream_chunk`: 流式内容块
- `vote_start`: 投票开始
- `vote_result`: 投票结果
- `trinity_summary`: Trinity统合结果
- `error`: 错误信息

**实现要点**：
- 使用 `github.com/gorilla/websocket`
- 实现心跳机制
- 支持断线重连
- 线程安全的连接管理

### 8. prompts 包 - 提示词模板

**职责**：管理提示词模板，对应前端 `prompts/`

**提示词类型**：
- 系统提示词（各贤者的人格设定）
- 投票提示词（评审决策的提示词）
- Trinity统合提示词（综合响应的提示词）

**实现要点**：
- 使用Go常量或嵌入文件
- 支持模板变量替换
- 与前端提示词保持同步

### 9. internal 包 - 内部工具

**职责**：提供通用工具函数

**功能**：
- 错误定义和包装
- 日志记录封装
- 上下文管理辅助
- 通用工具函数

## 数据流设计

### 正常决策流程

```
用户输入 (WebSocket)
    ↓
消息路由 (websocket.router)
    ↓
决策协调器 (consensus.coordinator)
    ↓
并发收集响应 (consensus.collector)
    ├─→ Melchior.GenerateResponse()
    ├─→ Balthazar.GenerateResponse()
    └─→ Casper.GenerateResponse()
    ↓
检查审慎决策标记 (consensus.deliberation)
    ↓
Trinity统合 (consensus.trinity_summary)
    ↓
推送最终响应 (websocket.pusher)
```

### 审慎决策流程

```
Melchior响应包含 requiresDeliberation=true
    ↓
投票管理器 (consensus.voter)
    ├─→ Balthazar.Vote()
    └─→ Casper.Vote()
    ↓
计算投票结果 (≥2/3通过)
    ↓
根据投票结果决定是否执行
    ↓
Trinity统合
    ↓
推送最终响应
```

## 并发控制设计

### 响应收集并发

```go
// 使用goroutine + channel模式
func collectResponses(ctx context.Context, sages []Sage, input string) ([]SageResponse, error) {
    respChan := make(chan SageResponse, len(sages))
    errChan := make(chan error, len(sages))
    
    for _, sage := range sages {
        go func(s Sage) {
            resp, err := s.GenerateResponse(ctx, input, history)
            if err != nil {
                errChan <- err
                return
            }
            respChan <- resp
        }(sage)
    }
    
    // 收集结果...
}
```

### 流式推送

```go
// 使用channel传递流式数据
func streamToWebSocket(ctx context.Context, streamChan <-chan StreamChunk, conn *Connection) {
    for {
        select {
        case chunk := <-streamChan:
            conn.Send(WSMessage{Type: "stream_chunk", Data: chunk})
        case <-ctx.Done():
            return
        }
    }
}
```

## 错误处理设计

### 错误类型

```go
var (
    ErrConfigNotFound = errors.New("SEEL config not found")
    ErrSyncRateLow = errors.New("synchronization rate below threshold")
    ErrLLMTimeout = errors.New("LLM request timeout")
    ErrVoteFailed = errors.New("voting failed to reach consensus")
)
```

### 错误传播

- LLM错误：通过WebSocket推送错误消息到前端
- 配置错误：记录日志，返回默认配置
- 网络错误：实现重试机制
- 超时错误：取消context，清理资源

## 测试策略

### 单元测试

- 每个包都有对应的`_test.go`文件
- 使用mock接口进行隔离测试
- 测试覆盖率目标：>80%

### 集成测试

- 完整决策流程测试
- WebSocket通信测试
- 并发场景测试

### 对比测试

- 记录前端实现的输入输出
- Go实现必须产生相同结果
- 使用快照测试验证一致性

## 性能优化考虑

### 连接池

- 复用HTTP连接到LLM API
- 使用`http.Client`的连接池

### 缓存

- 缓存SEEL配置（带过期时间）
- 缓存提示词模板

### 并发控制

- 限制并发LLM请求数量
- 使用worker pool模式

### 内存管理

- 及时关闭channel
- 清理过期会话
- 限制消息历史长度

## 部署集成

### 与kernel集成

- 在`kernel/api/router.go`中注册WebSocket路由
- 在`kernel/model`中集成配置管理
- 复用kernel的日志系统

### API端点

```
POST /api/magi/chat          # HTTP聊天接口（兼容现有）
WS   /api/magi/ws            # WebSocket接口（新增）
GET  /api/magi/config        # 获取配置
POST /api/magi/config        # 更新配置
```

## 迁移路径

### Phase 1: 后端实现

1. 实现types、config、llm、stream包
2. 实现sage包（四个贤者）
3. 实现consensus包（决策逻辑）
4. 单元测试验证

### Phase 2: WebSocket服务

1. 实现websocket包
2. 集成到kernel路由
3. 集成测试验证

### Phase 3: 前端适配

1. 前端创建WebSocket客户端
2. 改造useMagi为WebSocket模式
3. 端到端测试验证

### Phase 4: 上线切换

1. 灰度发布（部分用户使用新后端）
2. 对比测试（验证决策一致性）
3. 全量切换
4. 移除前端旧代码

## 关键约束

1. **决策逻辑不变**：所有决策逻辑必须与前端完全一致
2. **审慎决策入口**：严格只看Melchior工具调用的`requiresDeliberation`
3. **禁止语义兜底**：不允许后端新增任何语义判断规则
4. **前端兼容**：前端仅需改造通信层，状态管理接口不变
5. **性能要求**：响应时间不超过前端实现的1.2倍
