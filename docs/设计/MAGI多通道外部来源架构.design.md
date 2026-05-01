# MAGI 多通道外部来源架构设计

> **状态**: 草稿 (Draft)
> **版本**: v0.1.0
> **更新日期**: 2026-04-30
> **关联**: `MAGI_NERV_Avatar池化与内外工具隔离.design.md`、`MAGI认知架构.design.md`、`MAGI_Go后端落实工程设计.design.md`

---

## 1. 目标与边界

### 1.1 目标

1. 建立**通道无关的外部来源接入框架**，使微信、Discord、Telegram 等 IM 渠道能以统一契约接入 MAGI。
2. 为每个通道提供**独立可配置的可信度管控**（TrustBase / RiskLevel / 黑白名单），安全基线必须默认最低。
3. 外部来源消息**强制走 Avatar 路径**，禁止直接进入三贤人决策主循环。
4. 新增通道只需实现 `ChannelAdapter` 接口并注册，**无需改动 MAGI 核心路由**。

### 1.2 非目标

1. 不改变 Trinity / 三贤人的认知策略本身。
2. 不改变现有内部来源（Guardian, SystemCron）的鉴权流程。
3. 不改变现有对外 OpenAI-compatible 接口契约。
4. 不在本设计阶段定义前端 UI 交互细节。

---

## 2. 术语定义

| 术语 | 定义 |
|------|------|
| **通道 (Channel)** | 一个外部 IM/消息平台，如微信、Discord、Telegram |
| **通道适配器 (ChannelAdapter)** | 实现与特定 IM 平台通信的接口实现 |
| **InboundMessage** | 通道适配器收到的标准化入站消息 |
| **OutboundMessage** | MAGI 决策后返回给通道适配器的出站消息 |
| **通道注册表 (ChannelRegistry)** | 管理所有已注册通道适配器的全局注册表 |
| **可信度配置 (TrustConfig)** | 每个通道独立配置的信任基线、风险等级、黑白名单 |
| **来源会话键 (SourceSessionKey)** | 格式 `channel:account:user` 的三级会话隔离键 |

---

## 3. 总体架构

```
                     +-----------+
                     |   MAGI    |
                     |  Core     |
                     +-----+-----+
                           |
              +------------+------------+
              |            |            |
         Inbound      Outbound      Trust Config
         Bridge       Router        Manager
              |            |            |
              +-----+------+            |
                    |                   |
            ChannelRegistry             |
                    |                   |
     +--------------+--------------+    |
     |              |              |    |
+----v-----+  +----v-----+  +----v-----+--+
| WeChat   |  | Discord  |  | Telegram   |
| Adapter  |  | Adapter  |  | Adapter    |
+----------+  +----------+  +------------+
     |              |              |
 WeChat iLink   Discord Bot    Telegram Bot
    API            API            API
```

### 3.1 核心数据流

```
外部用户发消息
    ↓
[Channel Adapter] 长轮询/WebSocket 收到消息
    ↓
适配为 InboundMessage (通道无关)
    ↓
[Inbound Bridge] → TrustConfig 查询 trust/risk → RequestSourceContext
    ↓
黑白名单前置过滤
    ↓
DispatcherTask → dispQueue → handleMagiTask()
    ↓
coordinateDecision():
  DirectResponseAllowed=false → avatar.DispatchForSource()
    ↓
Avatar 处理 → 主导者回复
    ↓
[Outbound Router] 按 sourceCtx.Channel 分发
    ↓
[Channel Adapter].SendMessage()
    ↓
外部用户收到回复
```

### 3.2 关键约束

1. 外部来源不得直接触发 Trinity Direct 响应（`DirectResponseAllowed` 强制为 `false`）。
2. Channel 名称必须归一化到白名单枚举，禁止自由文本标签进入 LLM 输入（参见 `MAGI_NERV_Avatar池化设计` 4.2.1）。
3. trust/risk 的值以服务端配置为准，请求方无法通过伪造信号抬升。

---

## 4. 通道适配器接口

### 4.1 ChannelAdapter 接口

```go
package channel

import (
    "context"
    "time"
)

// ChannelAdapter 是所有外部消息通道必须实现的接口。
// 每个实现封装一个特定 IM 平台（微信/Discord/Telegram）的通信细节。
type ChannelAdapter interface {
    // ID 返回通道唯一标识符，如 "wechat"、"discord"、"telegram"
    ID() string

    // Start 启动消息接收循环（长轮询 / WebSocket 等）。
    // 必须是非阻塞的（在 goroutine 内部运行循环）。
    // 返回的 error 表示启动失败（如配置错误、认证失败）。
    Start(ctx context.Context) error

    // Stop 优雅停止消息接收循环。
    Stop(ctx context.Context) error

    // SendMessage 发送出站消息到 IM 平台。
    // msg 包含目标用户、内容、媒体附件等。
    SendMessage(ctx context.Context, msg *OutboundMessage) error

    // Status 返回通道当前运行状态。
    Status() ChannelStatus

    // TrustConfig 返回此通道的信任配置。
    // 实现方可以在此方法中注入通道特定的信任默认值。
    TrustConfig() *TrustConfig
}

type ChannelStatus struct {
    ID            string    `json:"id"`
    Connected     bool      `json:"connected"`
    AccountID     string    `json:"accountId,omitempty"`
    UserCount     int       `json:"userCount"`
    LastMessageAt time.Time `json:"lastMessageAt"`
    Error         string    `json:"error,omitempty"`
}

type ChannelState int

const (
    ChannelStateDisconnected ChannelState = iota
    ChannelStateConnecting
    ChannelStateConnected
    ChannelStateError
)
```

### 4.2 通用消息类型

```go
package channel

// InboundMessage 通道无关的标准化入站消息。
type InboundMessage struct {
    // ChannelID 来源通道标识
    ChannelID string `json:"channelId"`
    // AccountID 通道内的账号标识（如微信账号 ID）
    AccountID string `json:"accountId"`
    // UserID 来源用户在 IM 平台中的 ID
    UserID string `json:"userId"`
    // Nickname 用户在 IM 平台中的昵称
    Nickname string `json:"nickname,omitempty"`
    // Text 文本内容
    Text string `json:"text,omitempty"`
    // Media 媒体附件列表
    Media []MediaAttachment `json:"media,omitempty"`
    // ConversationToken 会话令牌（如微信的 context_token）
    ConversationToken string `json:"conversationToken,omitempty"`
    // Raw 原始消息，供调试/审计
    Raw interface{} `json:"-"`

    // Timestamp 消息时间戳（Unix 毫秒）
    Timestamp int64 `json:"timestamp"`
}

type MediaAttachment struct {
    Type       MediaType `json:"type"` // image/video/audio/file
    URL        string    `json:"url,omitempty"`
    Data       []byte    `json:"-"`
    MIMEType   string    `json:"mimeType,omitempty"`
    FileName   string    `json:"fileName,omitempty"`
    FileSize   int64     `json:"fileSize,omitempty"`
    RawMeta    interface{} `json:"-"`
}

type MediaType string

const (
    MediaTypeImage MediaType = "image"
    MediaTypeVideo MediaType = "video"
    MediaTypeAudio MediaType = "audio"
    MediaTypeFile  MediaType = "file"
)

// OutboundMessage 通道无关的标准化出站消息。
type OutboundMessage struct {
    // ChannelID 目标通道标识
    ChannelID string `json:"channelId"`
    // AccountID 目标通道内的账号标识
    AccountID string `json:"accountId"`
    // UserID 目标用户 ID
    UserID string `json:"userId"`
    // Text 文本回复内容
    Text string `json:"text,omitempty"`
    // Media 媒体附件
    Media []MediaAttachment `json:"media,omitempty"`
    // ConversationToken 会话令牌（回复时必须回传）
    ConversationToken string `json:"conversationToken,omitempty"`
}
```

### 4.3 通道注册表

```go
package channel

import "sync"

// Registry 管理所有已注册的通道适配器。
type Registry struct {
    mu       sync.RWMutex
    adapters map[string]ChannelAdapter
}

var globalRegistry = &Registry{
    adapters: make(map[string]ChannelAdapter),
}

// Register 注册一个通道适配器。ID 冲突时 panic。
func Register(adapter ChannelAdapter) {
    globalRegistry.mu.Lock()
    defer globalRegistry.mu.Unlock()
    id := adapter.ID()
    if _, exists := globalRegistry.adapters[id]; exists {
        panic("channel adapter already registered: " + id)
    }
    globalRegistry.adapters[id] = adapter
}

// Get 按 ID 获取通道适配器。
func Get(id string) (ChannelAdapter, bool) {
    globalRegistry.mu.RLock()
    defer globalRegistry.mu.RUnlock()
    a, ok := globalRegistry.adapters[id]
    return a, ok
}

// All 返回所有已注册的通道适配器。
func All() []ChannelAdapter {
    globalRegistry.mu.RLock()
    defer globalRegistry.mu.RUnlock()
    result := make([]ChannelAdapter, 0, len(globalRegistry.adapters))
    for _, a := range globalRegistry.adapters {
        result = append(result, a)
    }
    return result
}
```

---

## 5. 可信度配置系统

### 5.1 配置结构

```go
package trust

// Config 整个多通道可信度配置。
type Config struct {
    Version  int                    `json:"version"`
    Channels map[string]ChannelConfig `json:"channels"`
}

// ChannelConfig 单个通道的信任配置。
type ChannelConfig struct {
    Enabled      bool                   `json:"enabled"`
    DefaultTrust TrustLevel             `json:"defaultTrust"` // low/medium/high
    DefaultRisk  RiskLevel              `json:"defaultRisk"`  // low/medium/high
    PerAccount   map[string]AccountConfig `json:"perAccount,omitempty"`
}

// AccountConfig 通道内某个账号的配置。
type AccountConfig struct {
    DefaultTrust TrustLevel              `json:"defaultTrust,omitempty"`
    DefaultRisk  RiskLevel               `json:"defaultRisk,omitempty"`
    AllowList    []string                `json:"allowList,omitempty"`   // 用户 ID 白名单
    BlockList    []string                `json:"blockList,omitempty"`   // 用户 ID 黑名单
    PerUser      map[string]UserOverride `json:"perUser,omitempty"`
}

// UserOverride 单个用户的信任覆盖。
type UserOverride struct {
    TrustBase *TrustLevel `json:"trustBase,omitempty"` // 覆盖 trust
    RiskLevel *RiskLevel  `json:"riskLevel,omitempty"`  // 覆盖 risk
    Blocked   bool        `json:"blocked,omitempty"`    // 强制拉黑
    Nickname  string      `json:"nickname,omitempty"`
}

type TrustLevel string
const (
    TrustLow    TrustLevel = "low"
    TrustMedium TrustLevel = "medium"
    TrustHigh   TrustLevel = "high"
)

type RiskLevel string
const (
    RiskLow    RiskLevel = "low"
    RiskMedium RiskLevel = "medium"
    RiskHigh   RiskLevel = "high"
)
```

### 5.2 安全基线规则

| 条件 | TrustBase | RiskLevel |
|------|-----------|-----------|
| 通道未配置 | `low` | `high` |
| 通道禁用 | 丢弃消息，不处理 | - |
| 用户在黑名单 | 丢弃消息，不处理 | - |
| 用户在白名单 | 通道默认值 or `medium`（取更高者） | 通道默认值 |
| 用户有 UserOverride | 按覆盖值 | 按覆盖值 |
| 以上皆非 | 通道默认值 | 通道默认值 |

### 5.3 配置持久化

- 存储路径: `~/.openclaw/channel-trust.json`
- 首次启动自动生成默认配置（所有通道 Trust=low, Risk=high）
- 支持运行时热重载（文件变更自动重新加载或在 `PUT` API 时触发）
- 配置变更不中断正在处理的消息

### 5.4 防抬升机制

复用 `magi_source.go` 的 `resolveTrustLevel()` 函数：
- 请求方提交的 trust/risk 只能用于**声明**，不决定最终值
- 最终值以配置为准，冲突时记录 warn 日志并将值降级为配置值
- 实现位于 `resolveTrustLevel()` 中：payload 值与 profile 值不同时，返回 profile 值 + conflict 标记

---

## 6. 来源上下文映射

### 6.1 InboundMessage → RequestSourceContext

```go
func BuildSourceCtxFromInbound(msg *InboundMessage, trustCfg *trust.Config) *types.RequestSourceContext {
    channelID := msg.ChannelID
    accountID := msg.AccountID
    userID := msg.UserID

    // 1. 获取通道配置
    chanCfg := trustCfg.ForChannel(channelID, accountID)

    // 2. 黑白名单检查
    if chanCfg.IsBlocked(userID) {
        return nil // 丢弃
    }

    // 3. 计算 trust/risk
    trustBase := chanCfg.ResolveTrust(userID)
    riskLevel := chanCfg.ResolveRisk(userID)

    // 4. 构建来源会话键
    sourceSessionKey := fmt.Sprintf("%s:%s:%s", channelID, accountID, userID)

    return &types.RequestSourceContext{
        Channel:               types.SourceChannelExternalAgent,
        PrincipalID:           userID,
        IdentityID:            accountID + ":" + userID,
        Nickname:              msg.Nickname,
        InterfaceID:           channelID + "-" + accountID,
        InterfaceKind:         channelID + "-bot",
        SourceSessionKey:      sourceSessionKey,
        DirectResponseAllowed: false,
        TrustBase:             trustBase,
        RiskLevel:             riskLevel,
        AuthStrength:          types.AuthStrengthMedium,
        ModelIntent:           "general",
        RawAttributes: map[string]string{
            "channelId":   channelID,
            "accountId":   accountID,
            "userId":      userID,
            "requestSource": channelID,
        },
    }
}
```

### 6.2 通道 ID 归一化

所有通道 ID 在进入 `SourceChannel` 时统一映射：
- `wechat` → `external-agent`
- `discord` → `external-agent`
- `telegram` → `external-agent`
- 未知通道 ID → `unknown`

`parseSourceChannel()` 枚举扩展（在 `magi_source.go` 中）：

```go
func parseSourceChannel(raw string) (types.SourceChannel, bool) {
    switch strings.ToLower(strings.TrimSpace(raw)) {
    case "guardian":
        return types.SourceChannelGuardian, true
    case "external-agent", "external_agent", "external",
         "wechat", "discord", "telegram", "slack":
        return types.SourceChannelExternalAgent, true
    case "system-cron", "system_cron", "cron":
        return types.SourceChannelSystemCron, true
    case "unknown":
        return types.SourceChannelUnknown, true
    default:
        return "", false
    }
}
```

---

## 7. 入站桥接与出站路由

### 7.1 Inbound Bridge

每个通道适配器收到消息后调用 `channel.InboundBridge.Push()`：

```go
package channel

// InboundBridge 将通道适配器的入站消息桥接到 MAGI 调度队列。
type InboundBridge struct {
    queue      *DispatcherRingQueue
    trustMgr   *trust.Manager
    sessionMgr *session.SessionManager
}

func (b *InboundBridge) Push(ctx context.Context, msg *InboundMessage) error {
    // 1. 查询信任配置
    trustCfg := b.trustMgr.GetConfig()

    // 2. 构建来源上下文（含黑白名单检查）
    sourceCtx := BuildSourceCtxFromInbound(msg, trustCfg)
    if sourceCtx == nil {
        return ErrMessageBlocked // 黑名单/禁用通道，静默丢弃
    }

    // 3. 构造 DispatcherTask
    task := &DispatcherTask{
        Type:      TaskTypeUserMessage,
        SessionID: resolveSession(b.sessionMgr, sourceCtx),
        SourceCtx: sourceCtx,
        RequestCtx: ctx,
        ResultChan: make(chan MagiTaskResult, 1),
    }

    // 4. 入队
    return b.queue.Push(task)
}
```

### 7.2 Outbound Router

MAGI 决策完成后，按 `sourceCtx.Channel` 路由回对应通道适配器：

```go
package channel

// OutboundRouter 将 MAGI 决策结果分发回对应通道。
type OutboundRouter struct {
    registry *Registry
}

func (r *OutboundRouter) Dispatch(ctx context.Context, sourceCtx *types.RequestSourceContext, reply string) error {
    channelID := extractChannelID(sourceCtx)
    adapter, ok := r.registry.Get(channelID)
    if !ok {
        return fmt.Errorf("channel adapter not found: %s", channelID)
    }

    outbound := &OutboundMessage{
        ChannelID:         channelID,
        AccountID:         sourceCtx.IdentityID,
        UserID:            sourceCtx.PrincipalID,
        Text:              reply,
        ConversationToken: extractConversationToken(sourceCtx),
    }
    return adapter.SendMessage(ctx, outbound)
}
```

---

## 8. 会话管理

### 8.1 来源会话键三级隔离

```
格式: <channelID>:<accountID>:<userID>
示例: wechat:wx_account_1:wx_user_abc123
示例: discord:bot_1:discord_user_456
```

每个唯一的来源会话键绑定一个固定的 MAGI 会话 ID：
- 同一用户的后续消息自动路由到同一会话
- 不同通道/账号/用户之间的会话完全隔离
- 会话管理器中的映射持久化（重启可恢复）

### 8.2 会话生命周期

- 创建: 首次接收到某来源会话键的消息时创建
- 活跃: 每次消息到来时更新 `LastActiveAt`
- 过期: 超过 `TTL`（默认 24h）无活动后标记为可回收
- 清理: 后台定时 GC 回收过期会话

---

## 9. 错误处理

### 9.1 通道连接错误

| 错误类型 | 行为 |
|----------|------|
| 长轮询超时 | 静默重试（预期行为） |
| 网络断开 | 指数退避重连（1s → 2s → 4s → ... → 60s cap） |
| 认证过期 (errcode -14) | 暂停通道 1 小时后重试 |
| 配置错误 | 记录错误，通道标记为错误状态，不重试 |

### 9.2 消息处理错误

| 场景 | 行为 |
|------|------|
| 黑名单用户 | 静默丢弃，不记录 |
| 队列满 | 返回通道特定的错误提示（如"系统繁忙，请稍后再试"）|
| Avatar 不可用 | 返回"正在准备中，请稍后再试" |
| 决策超时 | 返回"处理超时，请重试" |

---

## 10. 通道实现模板

新增一个通道适配器的最小模板：

```go
package mychannel

import (
    "context"
    "github.com/siyuan-note/siyuan/kernel/nerv/magi/channel"
)

type Adapter struct {
    id      string
    config  *channel.TrustConfig
    status  channel.ChannelStatus
}

func New() *Adapter {
    return &Adapter{
        id: "mychannel",
        config: &channel.TrustConfig{
            DefaultTrust: channel.TrustLow,
            DefaultRisk:  channel.RiskHigh,
        },
    }
}

func (a *Adapter) ID() string                                 { return a.id }
func (a *Adapter) Start(ctx context.Context) error             { /* 启动接收循环 */ }
func (a *Adapter) Stop(ctx context.Context) error              { /* 停止接收循环 */ }
func (a *Adapter) Status() channel.ChannelStatus               { return a.status }
func (a *Adapter) TrustConfig() *channel.TrustConfig           { return a.config }
func (a *Adapter) SendMessage(ctx context.Context, msg *channel.OutboundMessage) error {
    /* 发送消息到 IM 平台 */
    return nil
}

func init() {
    channel.Register(New())
}
```

---

## 11. 现有代码影响范围

| 文件 | 变更类型 | 说明 |
|------|----------|------|
| `kernel/api/magi_identity.go` | 修改 | `magiRequestChannel*` 常量无需新增特化，外部通道统一映射到 `external-agent` |
| `kernel/api/magi_source.go` | 修改 | `parseSourceChannel()` 扩展映射表；`buildArmorSourceProfile()` 检查是否需走外部通道配置 |
| `kernel/api/magi.go` | 修改 | `initMagiCron()` 中启动已注册通道适配器；`handleMagiTask()` 结果路由 |
| `kernel/nerv/magi/types/types.go` | 修改 | 无需新增 `SourceChannelWeChat`，复用 `SourceChannelExternalAgent` |
| `kernel/nerv/magi/channel/` | **新增** | 通道适配器接口、注册表、消息类型、桥接器、路由器的核心定义 |
| `kernel/nerv/magi/channel/trust/` | **新增** | 可信度配置加载、合并、缓存、热更新 |
| `kernel/nerv/magi/channel/wechat/` | **新增** | WeChat iLink 通道适配器实现 |

---

## 12. 与现有 MAGI 来源体系的兼容

### 12.1 已有通道不受影响

- **Guardian (magi-main-ui)**: 仍通过 armor token + workspace session 鉴权，`DirectResponseAllowed=true`
- **Tool calls (claude-code/openai-sdk 等)**: 仍通过 armor token + identity password 鉴权
- **SystemCron**: 仍通过 armor token + cron 专属配置鉴权

### 12.2 新增 SourceChannel 不需要

与最初分析不同，外部 IM 通道**不需要新增 `SourceChannel` 枚举值**。所有外部 IM 通道统一映射为 `SourceChannelExternalAgent`，依赖 `InterfaceKind`（如 `"wechat-bot"`、`"discord-bot"`）在逻辑层面区分。这样保证了 `buildArmorSourceProfile()` 的决策矩阵不做特化修改。

---

**设计制定**: Claude (Architect Mode)
**最后更新**: 2026-04-30
**版本**: v0.1.0
