# MAGI WebSocket 协议规范

> **版本**: v1.0.0  
> **创建时间**: 2026-03-06  
> **状态**: 设计阶段

## 概述

本文档定义MAGI后端与前端之间的WebSocket通信协议。该协议用于实时推送MAGI决策流程的状态更新。

### 架构原则

- **单向推送**: WebSocket仅用于后端→前端的状态推送
- **用户输入分离**: 用户输入通过HTTP接口（`POST /api/magi/chat`）提交
- **流式支持**: 支持贤者响应的流式chunk推送
- **会话隔离**: 支持多用户同时使用，通过sessionId隔离

### 连接信息

- **端点**: `ws://[host]:[port]/ws/magi`
- **协议**: WebSocket (RFC 6455)
- **消息格式**: JSON
- **编码**: UTF-8

---

## 基础消息格式

所有WebSocket消息遵循统一的JSON结构：

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

### 顶层字段说明

| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `cmd` | string | ✓ | 固定值 `"magiEvent"`，用于区分MAGI事件与其他WebSocket消息 |
| `eventType` | string | ✓ | 事件类型，见[事件类型定义](#事件类型定义) |
| `sessionId` | string | ✓ | 会话ID，用于多用户隔离 |
| `data` | object | ✓ | 事件载荷，包含事件元数据和业务数据 |

### 事件元数据字段

所有事件的`data`对象都包含以下元数据字段：

| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `eventId` | string | ✓ | 事件唯一标识符，格式：`magi-event-{timestamp}-{seq}` |
| `seq` | number | ✓ | 事件序列号，单调递增 |
| `roundId` | string | ✓ | 轮次ID，格式：`round-{timestamp}-{counter}` |
| `timestamp` | number | ✓ | 事件时间戳（Unix毫秒） |

---

## 事件类型定义

### 1. ROUND_STARTED - 轮次开始

**触发时机**: 用户提交输入后，MAGI系统开始新一轮决策流程

**数据结构**:
```json
{
  "eventId": "magi-event-1234567890-1",
  "seq": 1,
  "roundId": "round-1234567890-1",
  "timestamp": 1234567890000,
  "userInput": "用户输入的问题"
}
```

**字段说明**:
- `userInput` (string): 用户输入的原始文本

---

### 2. SEEL_REPLY_STARTED - 贤者开始响应

**触发时机**: 某个贤者开始生成响应（三贤人并行）

**数据结构**:
```json
{
  "eventId": "magi-event-1234567890-2",
  "seq": 2,
  "roundId": "round-1234567890-1",
  "timestamp": 1234567890100,
  "seelName": "melchior",
  "displayName": "Melchior",
  "userInput": "用户输入的问题",
  "streamMessage": {
    "id": "melchior-1234567890-0",
    "type": "melchior",
    "content": "",
    "status": "streaming",
    "timestamp": 1234567890100
  }
}
```

**字段说明**:
- `seelName` (string): 贤者内部名称 (`melchior` | `balthazar` | `casper`)
- `displayName` (string): 贤者显示名称
- `userInput` (string): 用户输入
- `streamMessage` (object): 初始消息对象，用于前端创建消息占位符

---

### 3. SEEL_REPLY_CHUNK - 贤者流式chunk

**触发时机**: 贤者生成响应的每个chunk（SSE流式推送）

**数据结构**:
```json
{
  "eventId": "magi-event-1234567890-3",
  "seq": 3,
  "roundId": "round-1234567890-1",
  "timestamp": 1234567890150,
  "seelName": "melchior",
  "displayName": "Melchior",
  "message": {
    "id": "melchior-1234567890-0",
    "type": "melchior",
    "content": "当前累积的响应内容...",
    "status": "streaming",
    "timestamp": 1234567890150
  }
}
```

**字段说明**:
- `seelName` (string): 贤者内部名称
- `displayName` (string): 贤者显示名称
- `message` (object): 更新后的消息对象，`content`为累积内容

**注意事项**:
- 前端应根据`message.id`更新对应消息
- `content`为累积内容，非增量chunk

---

### 4. SEEL_REPLY_COMPLETED - 贤者响应完成

**触发时机**: 贤者完成响应生成

**数据结构**:
```json
{
  "eventId": "magi-event-1234567890-4",
  "seq": 4,
  "roundId": "round-1234567890-1",
  "timestamp": 1234567890500,
  "seelName": "melchior",
  "displayName": "Melchior",
  "message": {
    "id": "melchior-1234567890-0",
    "type": "melchior",
    "content": "完整的响应内容",
    "status": "success",
    "timestamp": 1234567890500,
    "meta": {
      "requiresDeliberation": true,
      "reason": "需要审慎决策的原因"
    }
  }
}
```

**字段说明**:
- `message.status` (string): 固定为 `"success"`
- `message.meta` (object, 可选): 元数据，Melchior包含审慎决策信息

**Melchior特殊字段**:
- `meta.requiresDeliberation` (boolean): 是否需要审慎决策
- `meta.reason` (string): 审慎决策原因

---

### 5. SEEL_REPLY_FAILED - 贤者响应失败

**触发时机**: 贤者响应生成失败或超时

**数据结构**:
```json
{
  "eventId": "magi-event-1234567890-5",
  "seq": 5,
  "roundId": "round-1234567890-1",
  "timestamp": 1234567890600,
  "seelName": "balthazar",
  "displayName": "Balthazar",
  "error": "请求超时：30秒内未收到响应"
}
```

**字段说明**:
- `error` (string): 错误描述信息

**常见错误类型**:
- 请求超时
- 网络错误
- API错误
- 模型错误

---

### 6. SEEL_VOTE_UPDATED - 投票进度更新

**触发时机**: 审慎决策流程中的投票状态变化

**数据结构**:

#### 6.1 投票开始
```json
{
  "eventId": "magi-event-1234567890-10",
  "seq": 10,
  "roundId": "round-1234567890-1",
  "timestamp": 1234567891000,
  "progress": 0,
  "proposedAction": "Melchior提出的行动方案",
  "round": 1
}
```

#### 6.2 单个贤者投票完成
```json
{
  "eventId": "magi-event-1234567890-11",
  "seq": 11,
  "roundId": "round-1234567890-1",
  "timestamp": 1234567891200,
  "seelName": "balthazar",
  "displayName": "Balthazar",
  "decision": "批准",
  "progress": 50
}
```

#### 6.3 投票结果汇总
```json
{
  "eventId": "magi-event-1234567890-12",
  "seq": 12,
  "roundId": "round-1234567890-1",
  "timestamp": 1234567891500,
  "progress": 100,
  "details": [
    {
      "name": "Balthazar",
      "decision": "批准"
    },
    {
      "name": "Casper",
      "decision": "批准"
    }
  ]
}
```

#### 6.4 投票失败（超时）
```json
{
  "eventId": "magi-event-1234567890-13",
  "seq": 13,
  "roundId": "round-1234567890-1",
  "timestamp": 1234567891600,
  "error": "投票超时：Casper未在30秒内响应",
  "progress": 50
}
```

**字段说明**:
- `progress` (number, 可选): 投票进度百分比 (0-100)
- `proposedAction` (string, 可选): 提议的行动方案
- `seelName` (string, 可选): 投票的贤者名称
- `displayName` (string, 可选): 贤者显示名称
- `decision` (string, 可选): 投票决定 (`"批准"` | `"否决"`)
- `round` (number, 可选): 投票轮次
- `details` (array, 可选): 投票详情列表
- `error` (string, 可选): 错误信息

---

### 7. DOMINANT_SYNTHESIS_COMPLETED - 主导者统合完成

**触发时机**: 当轮主导者完成对三贤人观点的统合

**数据结构**:
```json
{
  "eventId": "magi-event-1234567890-20",
  "seq": 20,
  "roundId": "round-1234567890-1",
  "timestamp": 1234567892000,
  "content": "主导者统合后的完整响应内容"
}
```

**字段说明**:
- `content` (string): 主导者统合的最终响应

**说明**:
- `DOMINANT_SYNTHESIS_COMPLETED` 是当前唯一的 synthesis 事件名；旧的 `TRINITY_SYNTHESIS_COMPLETED` 不再保留。

---

### 8. CONSENSUS_EMITTED - 共识消息发出

**触发时机**: 向用户展示最终共识消息

**数据结构**:
```json
{
  "eventId": "magi-event-1234567890-21",
  "seq": 21,
  "roundId": "round-1234567890-1",
  "timestamp": 1234567892100,
  "message": {
    "id": "consensus-1234567890-1",
    "type": "consensus",
    "content": "最终共识内容",
    "status": "success",
    "timestamp": 1234567892100
  }
}
```

**字段说明**:
- `message` (object): 共识消息对象
- `message.type` (string): 固定为 `"consensus"`

---

### 9. ROUND_FAILED - 轮次失败

**触发时机**: 整个决策轮次失败

**数据结构**:
```json
{
  "eventId": "magi-event-1234567890-99",
  "seq": 99,
  "roundId": "round-1234567890-1",
  "timestamp": 1234567899999,
  "error": "决策流程失败：少于2个贤人响应成功"
}
```

**字段说明**:
- `error` (string): 失败原因描述

**常见失败原因**:
- 少于2个贤人响应成功
- 主导者统合失败（重试10次后）
- 系统内部错误

---

## 会话管理

### 会话ID生成

- **格式**: UUID v4
- **生成时机**: 用户首次连接WebSocket时
- **传递方式**: 
  1. WebSocket连接建立时通过查询参数传递：`ws://host:port/ws/magi?sessionId=xxx`
  2. 或在首次HTTP请求时由后端生成并返回

### 会话隔离

- 每个WebSocket消息都包含`sessionId`字段
- 前端根据`sessionId`过滤消息，只处理匹配的消息
- 后端维护`sessionId → WebSocket连接`的映射

### 会话生命周期

```mermaid
graph LR
    A[用户连接] --> B[生成sessionId]
    B --> C[建立WebSocket]
    C --> D[接收事件]
    D --> E[用户断开]
    E --> F[清理会话]
```

---

## 错误处理

### 连接错误

**场景**: WebSocket连接失败或断开

**前端处理**:
1. 显示连接错误提示
2. 实施指数退避重连策略
3. 最多重试5次

**重连策略**:
```
延迟序列: 1s, 2s, 4s, 8s, 16s
```

### 消息解析错误

**场景**: 收到无法解析的JSON消息

**前端处理**:
1. 记录错误日志
2. 忽略该消息
3. 继续处理后续消息

### 业务错误

**场景**: 事件中包含`error`字段

**前端处理**:
1. 根据事件类型显示错误信息
2. 更新UI状态为错误状态
3. 允许用户重试

---

## 性能考虑

### 消息频率

- **SEEL_REPLY_CHUNK**: 高频（每50-100ms一次）
- **其他事件**: 低频（每轮次几次）

### 消息大小

- **典型大小**: 1-5 KB
- **最大大小**: 128 KB（受melody配置限制）
- **优化建议**: chunk事件仅传递必要字段

### 并发处理

- 支持多个轮次并发执行
- 通过`roundId`区分不同轮次
- 前端应维护轮次状态映射

---

## 安全考虑

### 认证

- WebSocket连接复用HTTP会话认证
- 通过Cookie或Token验证用户身份

### 授权

- 用户只能接收自己会话的消息
- 后端严格校验`sessionId`归属

### 数据验证

- 后端验证所有事件数据结构
- 前端验证接收到的消息格式

---

## 示例流程

### 完整决策流程（无审慎决策）

```
1. ROUND_STARTED
   ↓
2. SEEL_REPLY_STARTED (Melchior)
3. SEEL_REPLY_STARTED (Balthazar)
4. SEEL_REPLY_STARTED (Casper)
   ↓
5. SEEL_REPLY_CHUNK (Melchior) × N
6. SEEL_REPLY_CHUNK (Balthazar) × N
7. SEEL_REPLY_CHUNK (Casper) × N
   ↓
8. SEEL_REPLY_COMPLETED (Melchior) - requiresDeliberation: false
9. SEEL_REPLY_COMPLETED (Balthazar)
10. SEEL_REPLY_COMPLETED (Casper)
   ↓
11. DOMINANT_SYNTHESIS_COMPLETED
   ↓
12. CONSENSUS_EMITTED
```

### 完整决策流程（含审慎决策）

```
1. ROUND_STARTED
   ↓
2-10. [同上，三贤人响应]
   ↓
11. SEEL_REPLY_COMPLETED (Melchior) - requiresDeliberation: true
   ↓
12. SEEL_VOTE_UPDATED (投票开始)
   ↓
13. SEEL_VOTE_UPDATED (Balthazar投票)
14. SEEL_VOTE_UPDATED (Casper投票)
   ↓
15. SEEL_VOTE_UPDATED (投票结果)
   ↓
16. DOMINANT_SYNTHESIS_COMPLETED
   ↓
17. CONSENSUS_EMITTED
```

### 部分失败流程

```
1. ROUND_STARTED
   ↓
2-4. SEEL_REPLY_STARTED × 3
   ↓
5-7. SEEL_REPLY_CHUNK × N
   ↓
8. SEEL_REPLY_COMPLETED (Melchior)
9. SEEL_REPLY_COMPLETED (Balthazar)
10. SEEL_REPLY_FAILED (Casper) - 超时
   ↓
11. DOMINANT_SYNTHESIS_COMPLETED (仅使用2个贤人的响应)
   ↓
12. CONSENSUS_EMITTED
```

---

## 版本历史

| 版本 | 日期 | 变更说明 |
|------|------|----------|
| v1.1.1 | 2026-03-25 | synthesis 事件名统一为 `DOMINANT_SYNTHESIS_COMPLETED`，移除旧 `TRINITY_SYNTHESIS_COMPLETED` 残留 |
| v1.1.0 | 2026-03-25 | synthesis 事件主名迁移为 `DOMINANT_SYNTHESIS_COMPLETED` |
| v1.0.0 | 2026-03-06 | 初始版本，定义基础协议 |

---

## 附录

### 相关文档

- [MAGI后端架构](../ARCHITECTURE.md)
- [MAGI后端迁移TTT](../../../docs/ttt/MAGI后端迁移.ttt.md)
- [MAGI后端实现澄清决策](../../../docs/ttt/MAGI后端实现澄清决策.md)
- [前端事件总线](../../../app/src/magi/events/magiEventBus.ts)

### 术语表

- **Seel**: 贤者，MAGI系统的三个决策单元之一
- **Trinity**: 统合者，负责整合三贤人观点
- **Round**: 轮次，一次完整的决策流程
- **Deliberation**: 审慎决策，需要投票的决策流程
- **Consensus**: 共识，最终输出给用户的结果
