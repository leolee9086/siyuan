# 渠道消息落盘与查询设计

## 目标

为 MAGI 提供渠道（微信等 IM 平台）消息的持久化落盘能力，并暴露 `fetch_channel_messages` 工具供 Sage 查询最近消息。

## 核心设计原则

1. **存储格式为超集**：落盘格式是微信、Telegram、Discord、Slack、WhatsApp、钉钉、飞书等 IM 消息格式的超集
2. **利用现有基础设施**：使用已有的 `sqlite3_extended` 驱动（`88250/go-sqlite3` fork），遵循 `assetmeta` 包的 DB 管理范式
3. **零额外依赖**：不引入新库，只用 `database/sql` + 已有的 SQLite 驱动
4. **双向落盘**：入站消息（用户→MAGI）和出站消息（MAGI→用户）都落盘

## 数据库架构

### 数据库文件

```
{TempDir}/s-forge-channel-msgs.db
```

### 表结构

#### channel_messages（主表）

```sql
CREATE TABLE IF NOT EXISTS channel_messages (
    id              TEXT PRIMARY KEY,  -- {channelId}-{accountId}-{nativeMsgId}
    channel_id      TEXT NOT NULL,
    account_id      TEXT NOT NULL,
    user_id         TEXT NOT NULL,
    nickname        TEXT DEFAULT '',
    conversation_id TEXT DEFAULT '',
    direction       TEXT NOT NULL CHECK(direction IN ('inbound','outbound')),
    content_type    TEXT NOT NULL CHECK(content_type IN (
        'text','image','video','audio','file','sticker','location',
        'contact','poll','rich_text','interactive','voice','system','mixed'
    )),
    created_at      INTEGER NOT NULL,
    edited_at       INTEGER DEFAULT 0,
    persisted_at    INTEGER NOT NULL,
    text_content    TEXT DEFAULT '',
    rich_body       TEXT DEFAULT '',
    media_json      TEXT DEFAULT '[]',
    reply_to_id     TEXT DEFAULT '',
    thread_id       TEXT DEFAULT '',
    mentions_json   TEXT DEFAULT '[]',
    reactions_json  TEXT DEFAULT '[]',
    location_json   TEXT DEFAULT '{}',
    contact_json    TEXT DEFAULT '{}',
    poll_json       TEXT DEFAULT '{}',
    sticker_json    TEXT DEFAULT '{}',
    interactive_json TEXT DEFAULT '{}',
    voice_json      TEXT DEFAULT '{}',
    forward_info_json TEXT DEFAULT '{}',
    is_edited       INTEGER DEFAULT 0,
    is_deleted      INTEGER DEFAULT 0,
    is_pinned       INTEGER DEFAULT 0,
    platform_meta_json TEXT DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_cm_channel_time ON channel_messages(channel_id, account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cm_conv_time ON channel_messages(conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cm_user_time ON channel_messages(channel_id, account_id, user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cm_direction ON channel_messages(channel_id, account_id, direction, created_at DESC);
```

#### channel_conversations（元数据表）

```sql
CREATE TABLE IF NOT EXISTS channel_conversations (
    channel_id      TEXT NOT NULL,
    account_id      TEXT NOT NULL,
    conversation_id TEXT NOT NULL,
    total_count     INTEGER DEFAULT 0,
    oldest_at       INTEGER DEFAULT 0,
    newest_at       INTEGER DEFAULT 0,
    PRIMARY KEY (channel_id, account_id, conversation_id)
);
```

## 平台字段映射

| SQL 列 | 微信 | Telegram | Discord | Slack | WhatsApp | 钉钉 | 飞书 |
|--------|------|----------|---------|-------|----------|------|------|
| id | message_id | message_id | id | ts | id | msgId | message_id |
| user_id | from_user_id | from.id | author.id | user | from | senderId | sender.id |
| conversation_id | context_token | chat.id | channel_id | channel | - | openConversationId | chat_id |
| text_content | item.text_item.text | text | content | text | text.body | text.content | content.text |
| reply_to_id | - | reply_to_message.message_id | referenced_message.id | thread_ts | context.id | - | parent_id |
| thread_id | - | message_thread_id | - | thread_ts | - | - | root_id |
| edited_at | - | edit_date | edited_timestamp | edited.ts | - | - | update_time |
| media_json | image/video/file/voice | photo/video/audio/document | attachments | files | image/video/audio/document | file/image/voice | image/file/audio/video |
| mentions_json | - | entities.mention | mentions | <@...> | atUsers | mentions | - |
| reactions_json | - | - | reactions | reactions | - | - | reactions |
| forward_info_json | - | forward_from | message_reference | - | - | - | - |
| voice_json | voice_item.text/playtime | voice | - | - | - | voice_recognition | - |
| sticker_json | - | sticker | sticker_items | - | sticker | - | sticker |
| location_json | - | location | - | - | location | - | location |
| contact_json | - | contact | - | - | contacts | - | - |
| poll_json | - | poll | poll | - | - | - | - |
| interactive_json | - | reply_markup | components | blocks | interactive | action_card | interactive |

## API

### MessageStore

```go
// 全局实例生命周期
func InitMessageStore() error
func CloseMessageStore()
func GlobalMessageStore() *MessageStore

// 写入
func (s *MessageStore) SaveInbound(ctx context.Context, msg *InboundMessage) error
func (s *MessageStore) SaveOutbound(ctx context.Context, msg *OutboundMessage) error

// 查询
func (s *MessageStore) Query(ctx context.Context, opts QueryOptions) (*QueryResult, error)
```

### QueryOptions

```go
type QueryOptions struct {
    ChannelID string
    AccountID string
    UserID    string          // 可选
    Direction MessageDirection // 可选
    Limit     int             // 默认20, 最大200
    Before    int64           // 游标 unix ms
    After     int64           // 游标
}
```

## 落盘 Hook 点

### 入站（WeChat 适配器）

`channel/wechat/adapter.go:runMonitor()` — 在 `channel.GlobalBridge().Push()` 之后调用 `SaveInbound()`

### 出站（send_channel_message）

`coordinator/send_channel_message.go:executeSendChannelMessage()` — 在 `adapter.SendMessage()` 成功后调用 `SaveOutbound()`

## 工具定义

### fetch_channel_messages

```
描述: 查看指定渠道的最近消息记录。先使用 list_magi_channels 确认 channelId/accountId。

参数:
  channelId  (必填) 渠道ID，如 wechat
  accountId  (必填) 账号ID
  userId     (可选) 按用户筛选
  limit      (可选) 返回条数，默认20，最大100
  before     (可选) 游标，获取此时间(unix ms)之前的消息
  direction  (可选) inbound/outbound

返回:
  {
    ok, messages[{id, channelId, accountId, userId, nickname, direction,
                  contentType, text, media[], createdAt, replyToId, ...}],
    total, hasMore, oldestAt, newestAt
  }
```

## 文件清单

| 文件 | 职责 |
|------|------|
| `channel/message_store_types.go` | PersistedMessage、QueryOptions 等类型定义 |
| `channel/message_store.go` | MessageStore SQLite 实现 |
| `config/config.go` | 添加工具常量 + Build*ToolDef |
| `coordinator/fetch_channel_messages.go` | 工具执行器 |
| `channel/wechat/adapter.go` | 接入入站落盘 |
| `coordinator/send_channel_message.go` | 接入出站落盘 |
| `coordinator/collector_sage.go` | 注册 executor |
| `config/manager.go` | 加入默认工具集 |
