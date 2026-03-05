# MAGI NERV Avatar池化与内外工具隔离设计

> **状态**: 草稿 (Draft)
> **版本**: v0.2.0
> **更新日期**: 2026-03-05
> **关联**: `MAGI_Shell行动层.design.md`、`MAGI认知架构.design.md`、`MAGI_多轮历史堆栈协议.design.md`

---

## 1. 目标与边界

### 1.1 目标

1. 在 `nerv` 行动层引入 Avatar 角色池，减少重复创建成本。
2. 保证“只有新建 Avatar 需要用户同意”，复用不需要。
3. 建立内部工具与外部工具双通道隔离，避免内部消息泄漏给 LLM 接口调用者。
4. 保持对外 OpenAI-compatible 契约不变，调用者无感知。

### 1.2 非目标

1. 不改变 Trinity/三贤人的认知策略本身。
2. 不改变现有对外请求字段结构。
3. 不在本阶段定义新的 UI 交互形态细节（仅定义审批能力接口）。

---

## 2. 术语定义

1. **Trinity**: MAGI 统合自我，Avatar 的任务分发者与结果整合者。
2. **Avatar**: `nerv` 中可被池化复用的执行角色实例（可类比模式/Mode，而非线程）。
3. **内部工具 (Internal Tool)**: 仅用于 Avatar 与 Trinity 协调的信息通道工具。
4. **外部工具 (External Tool)**: 文件、命令、网络等实际执行工具。
5. **LLM接口调用者**: 通过 OpenAI-compatible 接口请求 MAGI 的外部调用方（含裸 LLM 适配模式调用者）。

---

## 3. 总体架构

```
External Caller
   -> StandardLLMAdapter (OpenAI-compatible)
   -> Trust Rule Layer (Ingress, Internal Only)
   -> Trinity
   -> NERV AvatarRolePool
      -> Avatar
         -> Internal Tool Bus (Avatar <-> Trinity)
         -> External Tool Bus (Avatar -> Tool Runtime)
   -> Trinity Final Speak
   -> External Caller
```

关键约束：
1. External Caller 不可见 Internal Tool Bus 内容。
2. Avatar 仅持有 Trinity 下发的任务包与必要上下文，不直接读取全量历史。
3. Trinity 可查询池状态并决定是否申请创建新 Avatar 角色实例。
4. Trust Rule Layer 仅生成内部可信度信封，不改变外部接口契约。

---

## 4. 可信度规则层（Trust Rule Layer）

### 4.1 设计目标

1. 在 Adapter 入口基于现有 LLM 接口调用参数与传输上下文，生成可信度评估。
2. 将评估结果作为内部信封提供给 Trinity 决策“自己处理/交给 Avatar/拒绝”。
3. 保持 OpenAI-compatible 外观不变，不新增对外请求字段。

### 4.2 输入信号来源

1. **请求参数信号（来自现有兼容字段）**:
   - `model`
   - `messages`（尤其 system/user 的语义特征）
   - `temperature`
   - `max_tokens`
   - `stream`
2. **传输上下文信号（服务端已有上下文）**:
   - 鉴权结果（token 是否有效、来源标识）
   - 频率与异常行为（重试风暴、爆破模式）
   - 调用方历史画像（通过内部审计记录）
   - 来源通道标识（Guardian / ExternalAgent / Cron 等）

### 4.2.1 来源通道安全约束（防语义攻击）

1. `channel` 必须归一化到白名单枚举：`guardian | external-agent | system-cron | unknown`。
2. 非白名单值一律降级为 `unknown`，禁止原样进入 LLM 输入。
3. 传递给三贤人/Trinity 时必须使用结构化信封（如 `<request_source>{...}</request_source>`），禁止拼接自由文本标签名。
4. `channel` 字段仅作为路由与风控信号，不作为可执行指令。

### 4.3 内部信封结构

```ts
type TrustBase = "low" | "medium" | "high";
type RiskLevel = "low" | "medium" | "high";

interface RequestTrustEnvelope {
  requestId: string;
  roundId: string;
  callerId: string;
  source: "guardian" | "external-agent" | "system-cron" | "unknown";
  trustBase: TrustBase;
  riskLevel: RiskLevel;
  reasons: string[];
  createdAt: number;
}
```

### 4.4 入口门禁（强约束）

1. 适配器入口先执行规则层校验，结果仅有 `allow | deny`。
2. 若 `deny`：
   - 对外返回标准失败响应（保持兼容错误外观）。
   - 必须向 Trinity 发送内部告警事件：`connection_attempt_blocked`。
3. 若 `allow`：
   - 生成 `RequestTrustEnvelope` 并进入 Trinity 决策阶段。

### 4.5 决策分层（硬规则 + Trinity 主动决策）

1. **规则层硬判定（不可被 Trinity 越权抬高）**:
   - 输出 `trustBase` 与 `riskLevel`。
2. **Trinity 主动决策（在规则边界内）**:
   - 输入：用户任务 + `RequestTrustEnvelope` + 来源历史画像 + 角色池状态。
   - 输出：`trinity_direct | avatar_delegate | reject`。
   - 重点：Trinity 需优先解析“请求来源是否可信”，再决定是否派出 Avatar。

### 4.6 决策矩阵（冻结草案）

| trustBase | riskLevel | Trinity 决策 |
|---|---|---|
| low | 任意 | `reject` 或先身份确认 |
| medium | low | `avatar_delegate` |
| medium | medium/high | `reject` |
| high | low | `trinity_direct` |
| high | medium/high | `avatar_delegate`（必要时触发新建审批） |

### 4.7 来源绑定与持续托管

```ts
interface SourceAvatarBinding {
  sourceKey: string;            // 由 callerId + source 归一化
  avatarRoleId: string;
  boundAt: number;
  lastReportAt: number;
  state: "active" | "escalated" | "expired";
}
```

1. Trinity 首次对某来源做出 `avatar_delegate` 后，建立 `source -> avatarRole` 绑定。
2. 绑定有效期内，同来源后续请求默认直接路由到该 Avatar 处理，Trinity 不再逐请求介入。
3. 仅在以下场景触发升级并重新介入 Trinity：
   - Avatar 未按协议调用内部汇报（超时）。
   - Avatar 主动汇报风险或不确定性。
   - 内部工具调用失败或策略违规。
   - 来源可信度下降或被规则层标记异常。

---

## 5. Avatar池模型

### 5.1 数据结构（建议）

```ts
type AvatarStatus = "idle" | "leased" | "pending_approval" | "retired" | "failed";

interface AvatarDescriptor {
  avatarRoleId: string;
  status: AvatarStatus;
  createdAt: number;
  lastLeasedAt: number | null;
  lastReleasedAt: number | null;
  leaseRoundId: string | null;
  personaVersion: string;
}

interface AvatarPoolSnapshot {
  active: number;
  idle: number;
  pendingApproval: number;
  retired: number;
  failed: number;
}
```

### 5.2 复用与新建策略

1. `acquireAvatarRole` 优先复用 `idle` Avatar 角色实例。
2. 无可复用对象时，触发 `requestCreateAvatarApproval`。
3. 仅在审批通过后允许创建新 Avatar 并转为 `leased`。
4. 审批拒绝时，返回可解释的“创建被拒绝”状态，由 Trinity 决定降级策略。
5. `releaseAvatar` 将任务完成 Avatar 归还池，默认重置任务态上下文。

---

## 6. 审批门禁设计

### 6.1 触发条件

1. 池中无可复用 Avatar 且当前任务确需新角色实例。
2. 扩容场景需要突破当前池规模上限。

### 6.2 审批记录（最小字段）

```ts
interface AvatarCreateApprovalRecord {
  requestId: string;
  roundId: string;
  reason: string;
  requestedAt: number;
  decision: "approved" | "rejected";
  decidedAt: number;
}
```

### 6.3 强约束

1. 复用路径不得触发审批。
2. 新建路径无审批记录不得落地创建。
3. 审批结果必须进入可审计日志。

---

## 7. 内外工具双通道

### 7.1 工具分域

```ts
type ToolScope = "internal" | "external";
```

1. `internal` 示例：
   - `trinity.report_progress`
   - `trinity.request_guidance`
   - `trinity.complete_task`
2. `external` 示例：
   - `file.read` / `file.write`
   - `command.run`
   - `http.request`

### 7.2 路由规则

1. Avatar 发起工具调用时，先按 `ToolScope` 路由。
2. `internal` 工具仅写入内部协调通道，不进入对外消息流。
3. `external` 工具进入执行运行时，结果回传 Avatar，再由 Avatar 视情况经 `internal` 汇报 Trinity。
4. 外部请求注入的工具列表不得包含 `internal` 工具。
5. 来源已绑定 Avatar 时，请求默认直接进入 Avatar；仅升级事件回流 Trinity。
6. Trinity 的 `speak` 工具需显式支持 `channel`：
   - `channel=public`：进入对外响应流。
   - `channel=internal`：仅进入内部审计/调试流，对 LLM 接口调用者不可见。

---

## 8. 可见性矩阵

| 信息类型 | Trinity | Avatar | LLM接口调用者 | 内部审计/调试 |
|---|---|---|---|---|
| 外部用户输入 | ✅ | 按需透传 | ✅ | ✅ |
| 外部工具调用结果 | ✅ | ✅ | 仅经 Trinity 整理后可见 | ✅ |
| 内部报告/请示 | ✅ | ✅ | ❌ | ✅ |
| Avatar池状态计数 | ✅ | 部分 | ❌（默认） | ✅ |

关键说明：
1. “内部报告仅对 LLM 接口调用者不可见”不等于“系统内不可见”。
2. 内部审计可保留该信息，用于排障与追踪。

---

## 9. 对外透明策略

1. `StandardLLMAdapter` 仍只输出标准 `assistant content` / `chat.completion.chunk`。
2. 任何内部工具消息都不应写入对外 `choices[].delta.content`。
3. 任何内部事件都不应作为外部响应元字段返回。
4. 对外看起来仍是单个 LLM 在回复，Avatar 仅作为内部执行机制存在。
5. `RequestTrustEnvelope` 为内部对象，不进入外部 API schema，不返回给调用方。
6. 可信度采集只使用现有请求参数与服务端上下文，禁止要求调用方新增私有字段。
7. `connection_attempt_blocked` 仅为内部告警事件，不向外部调用者暴露。

---

## 10. 与现有模块的协调点

1. 与 `MAGI_三贤人界面解耦_OpenAI适配接口同构` 对齐：
   - Adapter 层吸收差异，UI 与外部调用方保持无感。
2. 与 `MAGI_多轮历史堆栈协议` 对齐：
   - 内部报告不污染三贤人/Trinity 公共历史主路径。
3. 与 `MAGI_Shell行动层` 对齐：
   - 保持 NERV 做语义、Tools 做执行的长期分界。
4. 与适配层契约对齐：
   - `ChatRequestParams`、`ChatResponseData` 对外结构不变，可信度在适配层内部吸收。
5. 与多源网关模式对齐（参考 nanoclaw/myclaw）：
   - 渠道标识由网关/适配层生成并归一化，不信任调用侧自由命名。

---

## 11. 验收要点（设计层）

1. 新建 Avatar 的每次请求都有审批证据。
2. 复用 Avatar 不会触发审批。
3. 内部报告在 LLM 接口返回中不可见（同步与流式均验证）。
4. 对外 OpenAI-compatible 契约测试不回归。
5. 可信度可由现有请求参数与服务端上下文稳定生成，无新增外部字段。
6. 入口 `deny` 请求会触发 Trinity 告警事件。
7. 来源绑定后后续请求由 Avatar 持续托管，且异常场景可升级回 Trinity。
