# MAGI LLM伪装接口设计要求调研报告

> **调研时间**: 2026-03-07  
> **调研目的**: 明确MAGI对外接口的"伪装"设计理念，避免违反设计原则  
> **紧急程度**: 最高优先级

## 执行摘要

MAGI系统采用**"对外伪装"**设计理念：对外通过标准LLM接口伪装，隐藏内部三贤人共识决策机制。HTTP接口必须完全模拟OpenAI/Claude标准接口，仅返回最终共识结果；内部决策过程通过独立的WebSocket通道推送给前端监控面板。

---

## 一、核心设计理念

### 1.1 "对外伪装"原则

**来源**: [`docs/设计/MAGI/ARCHITECTURE.md`](../设计/MAGI/ARCHITECTURE.md) 第58-65行

**核心理念**：
- MAGI和Avatar对外通过**裸LLM接口伪装**
- 前端调用现有的`/api/magi/chat`或`/api/magi/messages`接口
- 后端识别请求，路由到MAGI或Avatar
- **返回标准LLM响应格式**

**设计意图**：
1. 对外接口完全兼容OpenAI/Claude SDK
2. 隐藏MAGI内部的三贤人架构
3. 隐藏Trinity统合机制
4. 隐藏投票决策流程
5. 使MAGI可以无缝替换标准LLM服务

---

## 二、HTTP接口设计要求

### 2.1 接口定义

**已实现的接口** (来自 [`kernel/api/router.go`](../../kernel/api/router.go)):
```go
POST /api/s-forge/magi/v1/chat/completions  // OpenAI Chat Completion协议
POST /api/s-forge/magi/v1/messages          // Claude Messages API协议
GET  /api/s-forge/magi/v1/models            // 模型列表
```

### 2.2 请求格式

**必须接受**：
- OpenAI标准格式：`openai.ChatCompletionRequest`
- Claude标准格式：Anthropic Messages API格式

**示例** (来自 ARCHITECTURE.md 第82-89行):
```json
POST /api/magi/chat
{
  "model": "gpt-4",
  "messages": [{"role": "user", "content": "帮我分析这个问题"}]
}
```

### 2.3 响应格式

**必须返回**：标准LLM响应格式

**OpenAI格式** (来自 [`kernel/api/magi.go`](../../kernel/api/magi.go) 第163-178行):
```json
{
  "id": "chatcmpl-magi-xxxx",
  "object": "chat.completion",
  "created": 1234567890,
  "model": "gpt-4",
  "choices": [{
    "index": 0,
    "message": {
      "role": "assistant",
      "content": "最终共识内容"
    },
    "finish_reason": "stop"
  }]
}
```

**禁止返回**：
- ❌ 三贤人的独立响应
- ❌ Trinity统合过程
- ❌ 投票详情
- ❌ 任何MAGI内部结构信息

### 2.4 流式响应

**支持SSE流式** (来自 magi.go 第183-250行):
- 必须遵循OpenAI SSE格式
- 每个chunk必须是标准`ChatCompletionStreamResponse`
- 最终发送`[DONE]`标记

**禁止**：
- ❌ 在流式响应中暴露三贤人的独立chunk
- ❌ 在流式响应中暴露投票进度

---

## 三、WebSocket接口设计要求

### 3.1 接口职责

**来源**: ARCHITECTURE.md 第163-209行, WEBSOCKET_PROTOCOL.md

**核心原则**：
- **单向推送**: WebSocket仅用于后端→前端的状态推送
- **用户输入分离**: 用户输入通过HTTP接口提交
- **流式支持**: 支持贤者响应的流式chunk推送
- **会话隔离**: 通过sessionId隔离多用户

### 3.2 推送内容范围

**允许推送** (来自 WEBSOCKET_PROTOCOL.md 第68-368行):

1. **轮次事件**:
   - `ROUND_STARTED`: 轮次开始
   - `ROUND_FAILED`: 轮次失败

2. **贤者响应事件**:
   - `SEEL_REPLY_STARTED`: 贤者开始响应
   - `SEEL_REPLY_CHUNK`: 贤者流式chunk
   - `SEEL_REPLY_COMPLETED`: 贤者响应完成
   - `SEEL_REPLY_FAILED`: 贤者响应失败

3. **投票事件**:
   - `SEEL_VOTE_UPDATED`: 投票进度更新

4. **统合事件**:
   - `TRINITY_SYNTHESIS_COMPLETED`: Trinity统合完成
   - `CONSENSUS_EMITTED`: 共识消息发出

### 3.3 消息格式

**统一格式** (来自 WEBSOCKET_PROTOCOL.md 第29-44行):
```json
{
  "cmd": "magiEvent",
  "eventType": "SEEL_REPLY_CHUNK",
  "sessionId": "session-uuid-here",
  "data": {
    "eventId": "magi-event-1234567890-1",
    "seq": 1,
    "roundId": "round-1234567890-1",
    "timestamp": 1234567890000,
    ...
  }
}
```

### 3.4 禁止行为

**禁止通过WebSocket**：
- ❌ 接收用户输入（用户输入必须走HTTP）
- ❌ 执行命令或控制指令
- ❌ 修改MAGI状态

---

## 四、信息暴露边界

### 4.1 允许暴露的信息

**通过HTTP接口**：
- ✅ 最终共识结果（Trinity统合后的输出）
- ✅ 标准LLM元数据（model, created, id等）
- ✅ 标准错误信息（符合OpenAI/Claude格式）

**通过WebSocket接口**：
- ✅ 三贤人的独立响应内容
- ✅ 三贤人的响应状态（streaming/success/failed）
- ✅ 投票进度和结果
- ✅ Trinity统合过程
- ✅ 轮次状态和时间戳

### 4.2 必须隐藏的信息

**在HTTP接口中**：
- ❌ 三贤人的存在和名称
- ❌ Trinity的存在和统合逻辑
- ❌ 投票机制和决策流程
- ❌ 内部消息总线结构
- ❌ Agent运行时细节
- ❌ Coordinator协调逻辑

**在所有对外接口中**：
- ❌ 系统内部错误堆栈
- ❌ 配置信息（API Key等）
- ❌ 内部文件路径
- ❌ 数据库结构

---

## 五、正确的集成方案

### 5.1 架构流程

**来源**: ARCHITECTURE.md 第71-109行

```
用户请求 → HTTP接口 (/api/s-forge/magi/v1/chat/completions)
    ↓
解析标准LLM请求
    ↓
路由到MAGI Coordinator (内部)
    ↓
三贤人并发决策 (内部)
    ↓
Trinity统合 (内部)
    ↓
返回标准LLM响应 (对外伪装)

同时：
内部决策过程 → WebSocket → 前端监控面板
```

### 5.2 代码实现模式

**HTTP接口处理器** (参考 ARCHITECTURE.md 第92-108行):

```go
func magiChat(c *gin.Context) {
    // 1. 解析标准LLM请求
    var req openai.ChatCompletionRequest
    c.ShouldBindJSON(&req)
    
    // 2. 发送到内部Bus（隐藏内部结构）
    bus.Send(InboundMessage{
        Channel:   "http",
        Target:    "magi",
        SessionID: extractSessionID(req),
        Content:   extractUserMessage(req.Messages),
    })
    
    // 3. Coordinator内部处理（三贤人+Trinity）
    // 4. 返回标准LLM响应（对外伪装）
    c.JSON(200, openai.ChatCompletionResponse{
        ID: "chatcmpl-magi-xxx",
        Object: "chat.completion",
        Model: req.Model,
        Choices: [{
            Message: {
                Role: "assistant",
                Content: "最终共识内容" // 仅返回Trinity统合结果
            }
        }]
    })
}
```

### 5.3 WebSocket推送模式

**来源**: ARCHITECTURE.md 第313-342行

```go
func magiWebSocket(c *gin.Context) {
    conn := upgradeToWebSocket(c)
    
    // 订阅所有agent的状态事件
    bus.Subscribe("melchior_status", func(msg OutboundMessage) {
        conn.Send(WSMessage{
            Type: "agent_status",
            Agent: "melchior",
            Data: msg,
        })
    })
    
    // 不接收用户输入，只推送状态
    for {
        select {
        case <-conn.Done():
            return
        }
    }
}
```

---

## 六、现有实现的问题分析

### 6.1 当前HTTP接口实现

**文件**: [`kernel/api/magi.go`](../../kernel/api/magi.go)

**当前行为**：
- ✅ 正确：接受标准OpenAI/Claude请求格式
- ✅ 正确：返回标准LLM响应格式
- ✅ 正确：支持流式SSE响应
- ⚠️ 问题：直接透传到底层LLM，未经过MAGI共识决策

**当前实现** (第91-116行):
```go
func handleMagiTask(task *MagiRequest) {
    // 直接调用 util.ChatGPT，绕过了MAGI决策流程
    client := util.NewOpenAIClient(...)
    
    if req.Stream {
        magiChatStream(c, msg, contextMsgs, client, req)
    } else {
        magiChatSync(c, msg, contextMsgs, client, req)
    }
}
```

### 6.2 正确的集成方式

**应该改为**：
```go
func handleMagiTask(task *MagiRequest) {
    // 1. 路由到MAGI Coordinator
    result := coordinator.ProcessUserInput(
        task.Ctx.Request.Context(),
        extractSessionID(task.Req),
        extractUserMessage(task.Req.Messages),
    )
    
    // 2. 返回标准LLM格式（隐藏内部决策过程）
    if task.Req.Stream {
        streamStandardLLMResponse(task.Ctx, result)
    } else {
        returnStandardLLMResponse(task.Ctx, result)
    }
}
```

---

## 七、T4.0.2任务的正确方案

### 7.1 任务目标回顾

**T4.0.2**: 集成HTTP接口到MAGI决策流程

### 7.2 正确的实现方案

**步骤1**: 保持HTTP接口签名不变
- 继续使用 `/api/s-forge/magi/v1/chat/completions`
- 继续接受标准OpenAI请求格式
- 继续返回标准OpenAI响应格式

**步骤2**: 修改内部路由逻辑
```go
// kernel/api/magi.go
func handleMagiTask(task *MagiRequest) {
    defer close(task.DoneChan)
    
    // 提取用户输入
    userInput := extractUserMessage(task.Req.Messages)
    sessionID := extractOrCreateSessionID(task.Ctx)
    
    // 路由到MAGI Coordinator（内部决策）
    ctx := task.Ctx.Request.Context()
    result, err := coordinator.ProcessChat(ctx, sessionID, userInput)
    
    if err != nil {
        task.Ctx.JSON(500, gin.H{"error": err.Error()})
        return
    }
    
    // 返回标准LLM格式（对外伪装）
    if task.Req.Stream {
        streamAsOpenAI(task.Ctx, result, task.Req.Model)
    } else {
        returnAsOpenAI(task.Ctx, result, task.Req.Model)
    }
}
```

**步骤3**: Coordinator返回统一结果
```go
// kernel/magi/coordinator/coordinator.go
type ConsensusResult struct {
    Content string        // Trinity统合的最终内容
    Metadata map[string]interface{} // 可选元数据
}

func (c *Coordinator) ProcessChat(ctx context.Context, sessionID, input string) (*ConsensusResult, error) {
    // 1. 三贤人并发决策（内部）
    // 2. Trinity统合（内部）
    // 3. 返回最终共识
    return &ConsensusResult{
        Content: trinityOutput,
    }, nil
}
```

**步骤4**: WebSocket独立推送
- HTTP接口和WebSocket完全解耦
- HTTP返回最终结果
- WebSocket推送决策过程

---

## 八、关键约束和检查清单

### 8.1 HTTP接口检查清单

**请求处理**：
- [ ] 接受标准OpenAI/Claude请求格式
- [ ] 支持`messages`数组
- [ ] 支持`model`参数
- [ ] 支持`stream`参数
- [ ] 支持`tools`参数（如需要）

**响应格式**：
- [ ] 返回标准`ChatCompletionResponse`
- [ ] 包含`id`, `object`, `created`, `model`字段
- [ ] `choices[0].message.content`为最终共识内容
- [ ] 流式响应遵循SSE格式
- [ ] 错误响应符合OpenAI格式

**禁止行为**：
- [ ] 不在响应中暴露三贤人信息
- [ ] 不在响应中暴露Trinity统合过程
- [ ] 不在响应中暴露投票详情
- [ ] 不在响应中暴露内部错误堆栈

### 8.2 WebSocket接口检查清单

**推送内容**：
- [ ] 推送轮次开始/结束事件
- [ ] 推送三贤人响应事件
- [ ] 推送投票进度事件
- [ ] 推送Trinity统合事件
- [ ] 推送共识发出事件

**禁止行为**：
- [ ] 不通过WebSocket接收用户输入
- [ ] 不通过WebSocket执行控制命令
- [ ] 不推送敏感配置信息

---

## 九、设计文档索引

### 9.1 核心设计文档

1. **[`docs/设计/MAGI/ARCHITECTURE.md`](../设计/MAGI/ARCHITECTURE.md)**
   - 第58-65行: 对外伪装设计理念
   - 第71-109行: HTTP接口设计
   - 第163-209行: WebSocket状态监听

2. **[`docs/技术文档/MAGI/WEBSOCKET_PROTOCOL.md`](../技术文档/MAGI/WEBSOCKET_PROTOCOL.md)**
   - 第1-25行: 协议概述和架构原则
   - 第68-368行: 事件类型定义
   - 第479-537行: 完整决策流程示例

3. **[`docs/设计/MAGI_Go后端落实工程设计.design.md`](../../docs/设计/MAGI_Go后端落实工程设计.design.md)**
   - 第1-12行: 核心目标与基础原则
   - 第35-103行: 核心机制演进与架构落地

### 9.2 实现参考

1. **[`kernel/api/magi.go`](../../kernel/api/magi.go)**
   - 当前HTTP接口实现
   - 需要修改以集成Coordinator

2. **[`kernel/api/router.go`](../../kernel/api/router.go)**
   - 第586-590行: 路由定义

---

## 十、结论与建议

### 10.1 核心结论

**MAGI的"对外伪装"设计理念**：
1. HTTP接口必须完全模拟标准LLM接口
2. 仅返回Trinity统合后的最终共识
3. 隐藏所有内部决策机制
4. 通过独立WebSocket推送决策过程给监控面板

### 10.2 T4.0.2任务的正确方向

**正确方案**：
- ✅ 保持HTTP接口签名不变（标准LLM格式）
- ✅ 修改内部路由，调用Coordinator
- ✅ 返回标准LLM响应（仅包含最终共识）
- ✅ WebSocket独立推送决策过程

**错误方案**：
- ❌ 在HTTP响应中暴露三贤人响应
- ❌ 在HTTP响应中暴露投票详情
- ❌ 创建新的非标准接口
- ❌ 通过HTTP返回MAGI内部结构

### 10.3 实施建议

1. **立即修改**: 将`handleMagiTask`改为调用Coordinator
2. **保持伪装**: 确保HTTP响应完全符合OpenAI格式
3. **分离关注**: HTTP负责最终结果，WebSocket负责过程监控
4. **测试验证**: 使用OpenAI SDK测试接口兼容性

---

## 附录：术语对照

| 术语 | 含义 | 对外暴露 |
|------|------|----------|
| Melchior | 理性贤者 | ❌ HTTP隐藏 / ✅ WebSocket可见 |
| Balthazar | 情感贤者 | ❌ HTTP隐藏 / ✅ WebSocket可见 |
| Casper | 直觉贤者 | ❌ HTTP隐藏 / ✅ WebSocket可见 |
| Trinity | 统合者 | ❌ HTTP隐藏 / ✅ WebSocket可见 |
| Coordinator | 决策协调器 | ❌ 完全隐藏 |
| Consensus | 共识结果 | ✅ HTTP返回 / ✅ WebSocket推送 |
| Deliberation | 审慎决策/投票 | ❌ HTTP隐藏 / ✅ WebSocket可见 |

---

**调研完成时间**: 2026-03-07 10:18
**调研人员**: MAGI后端开发团队
**文档版本**: v1.0
