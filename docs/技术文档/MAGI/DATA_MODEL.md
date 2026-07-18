# MAGI 后端数据模型设计

> **版本**: v1.0.0  
> **创建时间**: 2026-03-06  
> **状态**: 已完成

## 概述

本文档定义MAGI后端的Go数据结构，对应前端TypeScript类型定义。所有结构体支持JSON序列化，便于WebSocket通信和配置存储。

## 核心数据模型

### 1. 消息类型 (`types/types.go`)

#### Message - MAGI消息

对应前端 `MagiMessage`，表示系统中的一条聊天消息。

```go
type Message struct {
    ID        string                 `json:"id"`
    Type      MessageType            `json:"type"`
    Content   string                 `json:"content"`
    Status    MessageStatus          `json:"status"`
    Timestamp int64                  `json:"timestamp"` // Unix毫秒
    Meta      map[string]interface{} `json:"meta,omitempty"`
}
```

**字段说明**:
- `ID`: 消息唯一标识，格式如 `melchior-1234567890-0`
- `Type`: 消息类型（user/ai/melchior/balthazar/casper/consensus/vote/error/system）
- `Content`: 消息内容
- `Status`: 消息状态（streaming/success/error/pending）
- `Timestamp`: Unix毫秒时间戳
- `Meta`: 附加元数据，如审慎决策信息

#### ContextMessage - 上下文消息

对应前端 `ContextMessage`，用于LLM请求的消息历史。

```go
type ContextMessage struct {
    Role      MessageRole            `json:"role"`
    Content   string                 `json:"content"`
    ToolCalls []ToolCall             `json:"tool_calls,omitempty"`
    ToolID    string                 `json:"tool_call_id,omitempty"`
    Meta      map[string]interface{} `json:"meta,omitempty"`
}
```

**字段说明**:
- `Role`: 消息角色（user/assistant/system/tool）
- `Content`: 消息内容
- `ToolCalls`: 工具调用列表（assistant角色）
- `ToolID`: 工具调用ID（tool角色）

#### SageResponse - 贤者响应

对应前端 `SageResponse`，封装单个贤者的响应结果。

```go
type SageResponse struct {
    Content              string `json:"content"`
    Seel                 string `json:"seel"`
    DisplayName          string `json:"displayName"`
    RequiresDeliberation bool   `json:"requiresDeliberation,omitempty"`
    UsedToolCall         bool   `json:"usedToolCall,omitempty"`
    DeliberationReason   string `json:"deliberationReason,omitempty"`
}
```

**字段说明**:
- `Content`: 贤者响应内容
- `Seel`: 贤者内部名称（melchior/balthazar/casper）
- `DisplayName`: 贤者显示名称（Melchior/Balthazar/Casper）
- `RequiresDeliberation`: 是否需要审慎决策（仅Melchior）
- `UsedToolCall`: 是否使用了工具调用
- `DeliberationReason`: 审慎决策原因

#### VoteResult - 投票结果

对应前端 `VoteResult`，表示三贤人的投票结果。

```go
type VoteResult struct {
    Melchior  VoteDecision `json:"melchior"`
    Balthazar VoteDecision `json:"balthazar"`
    Casper    VoteDecision `json:"casper"`
    Passed    bool         `json:"passed"`
    Round     int          `json:"round"`
}
```

**字段说明**:
- `Melchior/Balthazar/Casper`: 各贤者的投票决定（"批准"/"否决"）
- `Passed`: 是否通过（≥2/3批准）
- `Round`: 投票轮次

### 2. 流式处理类型

#### StreamChunk - SSE流式chunk

OpenAI兼容的流式响应格式。

```go
type StreamChunk struct {
    ID      string        `json:"id,omitempty"`
    Object  string        `json:"object,omitempty"`
    Created int64         `json:"created,omitempty"`
    Model   string        `json:"model,omitempty"`
    Choices []ChunkChoice `json:"choices,omitempty"`
}
```

#### StreamResult - 流式处理结果

对应前端 `StreamResult`，封装流处理完成后的结果。

```go
type StreamResult struct {
    Content              string              `json:"content"`
    Success              bool                `json:"success"`
    HasToolCalls         bool                `json:"hasToolCalls,omitempty"`
    ToolCallNames        []string            `json:"toolCallNames,omitempty"`
    InternalToolMessages []string            `json:"internalToolMessages,omitempty"`
    ToolArgumentsByName  map[string][]string `json:"toolArgumentsByName,omitempty"`
}
```

### 3. 工具调用类型

#### DeliberationSignal - 审慎决策信号

Melchior通过 `deliberation_signal` 工具传递的审慎决策信号。

```go
type DeliberationSignal struct {
    RequiresDeliberation bool   `json:"requires_deliberation"`
    Reason               string `json:"reason"`
}
```

#### TrinitySpeakTool - Trinity speak工具

Trinity通过 `speak` 工具输出最终响应。

```go
type TrinitySpeakTool struct {
    Content string `json:"content"`
    Channel string `json:"channel,omitempty"` // "public" | "internal"
}
```

## 配置数据模型

### 4. 配置类型 (`config/config.go`)

#### MardukConfig - Marduk配置

对应前端 `MardukValidatedConfig`，存储LLM API配置。

```go
type MardukConfig struct {
    APIKey      string        `json:"apiKey"`
    BaseURL     string        `json:"baseURL"`
    Model       string        `json:"model"`
    Timeout     time.Duration `json:"timeout"`
    MaxTokens   int           `json:"maxTokens"`
    Temperature float64       `json:"temperature"`
    Meta        *ConfigMeta   `json:"_meta,omitempty"`
}
```

#### SEELConfig - SEEL配置

对应前端 `SEELConfiguration`，定义贤者的静态属性。

```go
type SEELConfig struct {
    Name         string  `json:"name"`
    Color        string  `json:"color"`
    Icon         string  `json:"icon"`
    ResponseType string  `json:"responseType"`
    BaseWeight   float64 `json:"baseWeight"`
}
```

#### AgentConfig - Agent配置

单个Agent的完整配置，包含SEEL配置、Marduk配置和上下文管理参数。

```go
type AgentConfig struct {
    Name           string       `json:"name"`
    SEELConfig     SEELConfig   `json:"seelConfig"`
    MardukConfig   MardukConfig `json:"mardukConfig"`
    MemorySize     int          `json:"memorySize"`
    ContextPercent float64      `json:"contextPercent"`
    SystemPrompt   string       `json:"systemPrompt"`
    Tools          []ToolDef    `json:"tools,omitempty"`
}
```

**上下文管理策略**:
- **Melchior**: `ContextPercent = 0.8`（80%上下文token占用）
- **Balthazar**: `ContextPercent = 0.4`（40%上下文token占用）
- **Casper**: `MemorySize = 7`（固定7条消息）
- **Trinity**: `MemorySize = 3`（固定3条消息）

#### MAGIConfig - MAGI系统配置

完整的MAGI系统配置，包含四个Agent的配置。

```go
type MAGIConfig struct {
    Melchior  AgentConfig `json:"melchior"`
    Balthazar AgentConfig `json:"balthazar"`
    Casper    AgentConfig `json:"casper"`
    Trinity   AgentConfig `json:"trinity"`
}
```

## 会话管理数据模型

### 5. 会话类型 (`coordinator/session.go`)

#### Session - MAGI会话

并发安全的会话管理结构。

```go
type Session struct {
    ID           string                 `json:"id"`
    Status       SessionStatus          `json:"status"`
    CreatedAt    time.Time              `json:"createdAt"`
    LastActiveAt time.Time              `json:"lastActiveAt"`
    CurrentRound *Round                 `json:"currentRound,omitempty"`
    History      []types.ContextMessage `json:"history"`
    mu           sync.RWMutex
}
```

**并发安全方法**:
- `AddMessage(msg)`: 添加消息到历史
- `GetHistory()`: 获取历史副本
- `UpdateStatus(status)`: 更新状态

#### Round - 决策轮次

单次决策流程的状态追踪。

```go
type Round struct {
    ID               string               `json:"id"`
    SessionID        string               `json:"sessionId"`
    Status           RoundStatus          `json:"status"`
    UserInput        string               `json:"userInput"`
    StartedAt        time.Time            `json:"startedAt"`
    CompletedAt      *time.Time           `json:"completedAt,omitempty"`
    SageResponses    []types.SageResponse `json:"sageResponses,omitempty"`
    VoteResult       *types.VoteResult    `json:"voteResult,omitempty"`
    TrinityResponse  string               `json:"trinityResponse,omitempty"`
    ConsensusContent string               `json:"consensusContent,omitempty"`
    Error            string               `json:"error,omitempty"`
}
```

**轮次状态流转**:
```
started → collecting → (voting) → synthesis → completed/failed
```

#### AgentContext - Agent上下文

每个Agent独立维护的消息历史，并发安全。

```go
type AgentContext struct {
    AgentName string                 `json:"agentName"`
    Messages  []types.ContextMessage `json:"messages"`
    mu        sync.RWMutex
}
```

**并发安全方法**:
- `AddMessage(msg)`: 添加消息
- `GetMessages()`: 获取消息副本
- `TrimToSize(size)`: 裁剪到指定大小

## 配置存储方案

### 配置文件位置

```
{dataStoragePath}/petal/SACKeyManager/_*.json
```

### 配置文件格式

JSON格式，与前端配置兼容：

```json
{
  "apiKey": "sk-xxx",
  "apiModel": "gpt-4",
  "apiBaseURL": "https://api.openai.com/v1",
  "apiTimeout": 60,
  "apiMaxTokens": 2048,
  "apiTemperature": 1.0
}
```

### 配置加载策略

1. 扫描配置目录，按文件名倒序排序
2. 加载最新配置文件
3. 验证必需字段（apiKey/apiModel/apiBaseURL）
4. 转换为 `MardukConfig` 结构
5. 如果加载失败，使用默认配置

### 默认配置

```go
DefaultConfig = MardukConfig{
    APIKey:      "marduk-default",
    BaseURL:     "http://localhost:11434/v1",
    Model:       "lilith-7b",
    Timeout:     60 * time.Second,
    MaxTokens:   2048,
    Temperature: 1.0,
    Meta:        &ConfigMeta{IsDefault: true},
}
```

## 数据验证

### 配置验证

- **URL验证**: 使用 `url.Parse()` 验证 `BaseURL` 格式
- **范围验证**: `Temperature` 限制在 [0, 2] 范围
- **必需字段**: apiKey/apiModel/apiBaseURL 必须存在

### 消息验证

- **ID格式**: `{agent}-{timestamp}-{seq}`
- **时间戳**: Unix毫秒，使用 `time.Now().UnixMilli()`
- **工具调用**: Arguments必须是有效的JSON字符串

## 并发安全设计

### 会话并发安全

- 使用 `sync.RWMutex` 保护 `Session` 的读写
- 所有公共方法都加锁
- 返回历史副本，避免外部修改

### Agent上下文并发安全

- 使用 `sync.RWMutex` 保护 `AgentContext` 的读写
- 支持并发的三贤人响应收集
- 裁剪操作原子化

### WebSocket连接管理

- 使用 `sync.Map` 管理 `sessionID → WebSocket连接` 映射
- 支持多用户并发使用
- 连接断开时自动清理

## 与前端类型对应关系

| Go类型 | 前端类型 | 文件位置 |
|--------|---------|---------|
| `Message` | `MagiMessage` | `app/src/magi/utils/messageFactory.types.ts` |
| `ContextMessage` | `ContextMessage` | `app/src/magi/core/core.types.ts` |
| `SageResponse` | `SageResponse` | `app/src/magi/utils/messageFactory.types.ts` |
| `VoteResult` | `VoteResult` | `app/src/magi/utils/messageFactory.types.ts` |
| `StreamResult` | `StreamResult` | `app/src/magi/utils/messageFactory.types.ts` |
| `MardukConfig` | `MardukValidatedConfig` | `app/src/magi/core/core.types.ts` |
| `SEELConfig` | `SEELConfiguration` | `app/src/magi/core/core.types.ts` |

## 实现注意事项

### Token计数

需要实现token计数功能以支持动态上下文管理：

```go
func CountTokens(messages []ContextMessage, model string) int {
    // 使用tiktoken或类似库计算token数
    // 根据model选择对应的tokenizer
}
```

### 消息历史裁剪

根据Agent配置裁剪消息历史：

```go
func TrimMessagesByTokens(messages []ContextMessage, maxTokens int, model string) []ContextMessage {
    // 从后向前累计token数
    // 保留不超过maxTokens的消息
}
```

### 工具调用解析

从流式响应中提取工具调用：

```go
func ExtractToolCalls(chunks []StreamChunk) []ToolCall {
    // 聚合delta.tool_calls
    // 解析arguments JSON
}
```

## 测试建议

### 单元测试

- 配置加载和验证
- 消息序列化/反序列化
- 并发安全性测试

### 集成测试

- 完整决策流程
- WebSocket消息推送
- 会话管理

### 对比测试

- 与前端实现的输入输出对比
- 确保决策逻辑一致性

## 相关文档

- [WebSocket协议](../WEBSOCKET_PROTOCOL.md)
- [MAGI架构](../ARCHITECTURE.md)
- [TTT文档](../../../docs/ttt/MAGI后端迁移.ttt.md)
- [澄清决策](../../../docs/ttt/MAGI后端实现澄清决策.md)
