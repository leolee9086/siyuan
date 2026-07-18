# MAGI 后端架构概览

## 核心架构理念

MAGI采用**独立Agent + 消息总线**架构，参考myclaw和nanoClaw的最佳实践：

**MAGI核心组成**（仅4个固定agent）：
- **三贤人（Melchior/Balthazar/Casper）**: 独立agent实例，各自维护上下文
- **Trinity**: 独立agent，负责综合三贤人响应

**架构特点**：
- **消息总线**: 四个agent通过Bus通信，不直接调用
- **Gateway**: 统一管理多来源任务（WebSocket/Cron/内部调用）
- **WebSocket**: 前端独立监听每个agent的事件流

**Avatar说明**：
- Avatar 是所有非 MAGI 且向 MAGI 汇报的协议角色；不限定为某一种运行时或部署位置
- 内部 Avatar 复用上游思源 Agent 系统的普通 Agent；未来外部 Avatar 通过 LLM 转发服务接入
- Avatar不使用独立的权限角色；是否可读写外部目录由后端 capability 决定，capability 不是 Avatar 的必要条件
- 内部 Avatar 通过 `report2magi`、外部 Avatar 通过等价转发适配器向 MAGI 汇报，MAGI 可以读取和分析全部 Avatar 会话历史
- Avatar 只能通过 guardian 或 MAGI 通道通信，禁止 Agent 间直连和向其它角色发送消息

## 架构图

```
┌─────────────────────────────────────────────────────────────┐
│                        Gateway                               │
│  (统一入口：WebSocket/Cron/内部调用)                         │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                     Message Bus                              │
│  (基于Channel的消息路由)                                      │
│                                                               │
│  Channels:                                                    │
│  - "magi"      → MAGI核心（用户输入）                        │
│  - "task_123"  → 内部 Avatar 会话（MAGI创建并绑定）          │
│  - "task_456"  → 外部 Avatar 转发会话（未来接入）             │
└──┬──────────┬──────────┬──────────┬──────────┬─────────────┘
   │          │          │          │          │
   │  MAGI核心（4个固定agent）      │  Avatar（协议角色）
   │          │          │          │          │
   ▼          ▼          ▼          ▼          ▼
┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐
│Melch │  │Balth │  │Casper│  │Trinit│  │Avatar│
│ior   │  │azar  │  │      │  │y     │  │_123  │
└──┬───┘  └──┬───┘  └──┬───┘  └──┬───┘  └──┬───┘
   │         │         │         │         │
   └─────────┴─────────┴─────────┴─────────┘
              │
              ▼
              ┌─────────────┐
              │ Coordinator │
              │ (决策协调)   │
              └─────────────┘
```

图中的 Avatar 通道表示后端路由和会话边界，不表示 Avatar 与其它 Agent 直接通信；所有 Avatar 消息都必须经过 guardian 或 MAGI 的通信 ACL。外部 Avatar 的通道由未来 LLM 转发服务映射。

## 消息总线与接口设计

### 关键设计理念

**对外伪装**：MAGI和已接入的 Avatar 对外通过裸LLM接口伪装；外部 Avatar 由转发服务提供兼容入口
- 前端调用现有的`/api/magi/chat`或`/api/magi/messages`接口
- 后端识别请求，路由到MAGI或Avatar
- 返回标准LLM响应格式

**状态监听**：WebSocket仅用于状态推送
- 前端通过WebSocket监听各agent的状态更新
- 不通过WebSocket发送用户输入
- 实现前端面板的独立显示

### 1. 用户输入 → MAGI（通过LLM接口）

**两个接口**：
- `POST /api/magi/chat`: OpenAI Chat Completion协议（已实现）
- `POST /api/magi/messages`: Claude Messages API协议（已实现）

**作用**：
- `/api/magi/chat`: 接收OpenAI格式的请求，用于兼容OpenAI SDK和相关工具
- `/api/magi/messages`: 接收Claude格式的请求，用于兼容Claude SDK和相关工具
- 两个接口都会路由到MAGI内部的共识决策流程

**流程示例（以/api/magi/chat为例）**：
```go
// 前端调用（OpenAI格式）
POST /api/magi/chat
{
  "model": "gpt-4",
  "messages": [{"role": "user", "content": "帮我分析这个问题"}]
}

// 后端处理（kernel/api/magi.go）
func magiChat(c *gin.Context) {
    // 1. 解析请求
    var req openai.ChatCompletionRequest
    c.ShouldBindJSON(&req)
    
    // 2. 发送到Bus（内部路由）
    bus.Send(InboundMessage{
        Channel:   "http",
        Target:    "magi",
        SessionID: extractSessionID(req),
        Content:   extractUserMessage(req.Messages),
    })
    
    // 3. Coordinator处理（内部共识决策）
    // 4. 返回标准LLM响应
    c.JSON(200, openai.ChatCompletionResponse{...})
}
```

### 2. MAGI派出或复用Avatar

**触发**：MAGI决策需要普通 Agent 执行任务

**流程**：
```go
// 内部 Avatar：MAGI通过上游 Agent 系统创建或复用普通 Agent 会话
tool := tools.GetTool("create_avatar")
avatarID := tool.Execute(ctx, map[string]interface{}{
    "task": "监控GitHub仓库",
    "channel": "github_monitor",
})

// 后端为 Avatar 会话绑定 owner、任务上下文和必要 capability
// Avatar 通过 report2magi 向 MAGI 汇报，不与其它 Agent 直连
// 外部 Avatar：由未来 LLM 转发服务建立等价受控报告通道
```

### 3. Avatar响应（通过LLM接口）

**接口**：内部 Avatar 复用上游 Agent 的标准会话接口；外部 Avatar 通过 LLM 转发服务的兼容接口接入

**流程**：
```go
// 前端或 MAGI 调用（指定已授权的 Avatar 会话）
POST /api/magi/chat
{
  "model": "gpt-4",
  "messages": [...],
  "metadata": {"session_id": "avatar-session"}
}

// 后端路由到Avatar
func magiChat(c *gin.Context) {
    sessionID := extractAuthorizedSessionID(req)
    // 后端校验 guardian owner 与 session capability 后路由到普通 Agent
    bus.Send(InboundMessage{Target: "avatar", SessionID: sessionID, ...})
}
```

### 4. WebSocket状态监听

**接口**：`WS /api/magi/ws`

**用途**：仅用于推送状态，不接收用户输入

**流程**：
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
    
    bus.Subscribe("balthazar_status", func(msg OutboundMessage) {
        conn.Send(WSMessage{
            Type: "agent_status",
            Agent: "balthazar",
            Data: msg,
        })
    })
    
    // ... 其他agent
    
    // 不接收用户输入，只推送状态
    for {
        select {
        case <-conn.Done():
            return
        }
    }
}
```

**推送的状态类型**：
- `agent_thinking`: Agent开始思考
- `agent_tool_call`: Agent调用工具
- `agent_response`: Agent响应完成
- `vote_start`: 投票开始
- `vote_result`: 投票结果

## 目录结构

```
kernel/magi/
├── bus/              # 消息总线（参考myclaw）
├── agent/            # Agent运行时（参考nanoClaw）
├── sages/            # 三贤人独立实现
│   ├── melchior/
│   ├── balthazar/
│   ├── casper/
│   └── trinity/
├── coordinator/      # 决策协调器
├── gateway/          # Gateway编排
├── tools/            # 工具注册系统
├── security/         # 安全防护
├── config/           # 配置管理
└── types/            # 类型定义
```

## 核心流程

### 1. 正常决策流程

```
用户输入 → Gateway → Bus.Inbound
    ↓
Coordinator 接收消息
    ↓
并发启动三个agent（通过Bus）
    ├─→ Melchior.Run()
    ├─→ Balthazar.Run()
    └─→ Casper.Run()
    ↓
收集响应（通过Bus.Outbound）
    ↓
检查 Melchior.RequiresDeliberation
    ↓ (false)
Trinity.Synthesize(三贤人响应)
    ↓
返回最终响应（通过Bus）
```

### 2. 审慎决策流程

```
Melchior.RequiresDeliberation = true
    ↓
启动投票（通过Bus）
    ├─→ Balthazar.Vote()
    └─→ Casper.Vote()
    ↓
计算投票结果（≥2/3通过）
    ↓
Trinity.Synthesize(三贤人响应 + 投票结果)
    ↓
返回最终响应
```

## 关键设计决策

### 1. 为什么使用消息总线？

- **解耦**: agent之间不直接依赖，通过消息通信
- **可观测**: 前端可以独立监听每个agent的状态
- **可扩展**: 新增agent无需修改现有代码
- **并发安全**: Bus保证消息传递的线程安全

### 2. 为什么每个贤人是独立agent？

- **独立上下文**: 每个贤人维护自己的对话历史
- **差异化工具**: 不同贤人有不同的工具集
- **并发执行**: 三贤人可以真正并行思考
- **前端监听**: 前端面板可以独立显示每个贤人的状态

### 3. 参考实践的应用

**从myclaw学习**:
- 消息总线设计（Inbound/Outbound/Subscribe）
- Gateway编排模式（统一管理多来源）
- 消息信封格式（Channel/SenderID/SessionID）

**从nanoClaw学习**:
- ReAct循环实现（自动升级机制）
- 并行工具执行（asyncio.gather模式）
- 安全防护体系（PromptGuard/Sandbox/Budget）
- 智能历史窗口（分层截断策略）
- 动态工具注入（按需加载工具）

## 与现有代码集成

### 复用现有基础设施

- **LLM客户端**: 复用`util.NewOpenAIClient`
- **配置系统**: 复用`model.Conf.AI.OpenAI.*`
- **日志系统**: 复用`github.com/siyuan-note/logging`
- **队列机制**: 复用现有`magiQueue`模式

### WebSocket集成

**关键设计**：共识决策是MAGI内部结构，不暴露独立API接口。

在`kernel/api/`中新增：
```go
// magiWebSocket 处理MAGI WebSocket连接
func magiWebSocket(c *gin.Context) {
    // 1. 升级为WebSocket连接
    conn := upgradeToWebSocket(c)
    
    // 2. 注册到Bus（订阅所有agent事件）
    bus.Subscribe("melchior", func(msg OutboundMessage) {
        conn.Send(msg) // 推送Melchior事件
    })
    bus.Subscribe("balthazar", func(msg OutboundMessage) {
        conn.Send(msg) // 推送Balthazar事件
    })
    bus.Subscribe("casper", func(msg OutboundMessage) {
        conn.Send(msg) // 推送Casper事件
    })
    bus.Subscribe("trinity", func(msg OutboundMessage) {
        conn.Send(msg) // 推送Trinity事件
    })
    
    // 3. 接收用户输入，发送到Bus
    for {
        userInput := conn.Receive()
        bus.Send(InboundMessage{
            Channel: "websocket",
            Content: userInput,
            SessionID: conn.SessionID,
        })
    }
}
```

**事件流**：
```
前端 → WebSocket → Bus.Inbound → Coordinator
                                      ↓
                                  三贤人并发
                                      ↓
                    Bus.Outbound ← 各agent响应
                         ↓
                    WebSocket → 前端（独立监听各agent）
```

## 实现优先级

### Phase 1: 基础设施（T0.1完成）
- [x] 项目结构设计
- [x] 架构文档编写

### Phase 2: 核心模块
- [ ] bus包：消息总线
- [ ] agent包：Agent运行时
- [ ] types包：类型定义

### Phase 3: Agent实现
- [ ] Melchior agent
- [ ] Balthazar agent
- [ ] Casper agent
- [ ] Trinity agent

### Phase 4: 决策协调
- [ ] Coordinator
- [ ] Collector（并发收集）
- [ ] Voter（投票管理）

### Phase 5: 集成测试
- [ ] 单元测试
- [ ] 集成测试
- [ ] 对比测试（与前端实现）

## 关键约束

1. **决策逻辑不变**: 与前端实现完全一致
2. **审慎决策入口**: 严格只看Melchior工具调用的`requiresDeliberation`
3. **禁止语义兜底**: 不允许后端新增语义判断规则
4. **协议角色落地**: Avatar覆盖内部普通 Agent 与未来外部转发 Agent，不创建专用 Avatar 运行时
5. **通信边界**: Avatar 只能经过 guardian 或 MAGI 通道通信，Agent-Agent 直连禁止
6. **历史分析**: MAGI可以读取和分析全部 Avatar 会话历史，但不能因此取得外部目录 capability
