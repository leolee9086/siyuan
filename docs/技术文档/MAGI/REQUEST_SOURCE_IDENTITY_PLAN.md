# MAGI 请求来源与界面身份改进方案

> **版本**: v1.1.0  
> **创建时间**: 2026-03-07  
> **状态**: 草案

## 概述

本文档定义 MAGI 后端对“请求来源信息”的统一采集、解析、路由与策略使用方案。

核心约束如下：

1. 对外保持 OpenAI/Claude 裸接口高兼容。
2. 请求身份强信号以 `API Key + model` 为主。
3. 主界面身份按“界面”识别，不按“设备”识别。
4. UA/IP 等弱信号仅用于审计，不作为身份判定依据。
5. 记忆作用域遵循主设计：Melchior 按界面工作台；Balthazar/Casper 跨界面连续（同一主体）。
6. API 层只做解析与门禁：仅拒绝鉴权错误来源，并严格限制“MAGI 直答”只对主界面可信请求开放。
7. 是否派出 Avatar 由 MAGI 内部自主判定，API 层不做 Avatar 派发决策；Avatar 是所有非 MAGI 且向 MAGI 汇报的协议角色，内部复用上游思源普通 Agent，外部由未来 LLM 转发服务接入。

## 背景与当前问题

当前实现存在以下断层：

1. API 层未形成统一 `RequestSourceContext`，来源信息未被可靠下传。
2. MAGI 内部无法稳定判断请求来自哪个通道、哪个界面、何种信任等级。
3. Trinity 提示词已经约定 `<request_source>`，但后端未稳定注入同构来源信封。

这会导致路由、风险控制、上下文作用域控制、审计均无法做到可验证的一致行为。

## 目标

### 1. MAGI 需要来源信息做什么

1. 路由决策：
   - `Trinity 直答`
   - `Avatar 委派（内部普通 Agent 或外部转发 Agent）`
   - `拒绝/降级`
2. 策略决策：
   - 工具权限矩阵
   - 审慎决策触发阈值
   - 速率限制与配额
3. 会话标识与记忆作用域控制：
   - 以 `channel + principal + interface (+conversation)` 作为会话追踪主键
   - 记忆读写采用“按贤者分层作用域”，而非全量严格隔离
4. 审计追踪：
   - 可还原“谁、从哪个界面、以什么权限”触发了什么行为

### 2. 裸 LLM 接口来源采集

采用分层采集，按可信度由高到低：

1. 强信号（身份判定）：
   - `Authorization: Bearer <MAGI Key>`
   - `model`（仅作为意图与路由提示，必须受 key 绑定策略约束）
2. 中信号（兼容层）：
   - OpenAI `user`
   - Claude `metadata.user_id`
   - 可选 system 标签 `<request_source>...</request_source>`（仅补充，不可越权覆盖）
3. 弱信号（仅审计）：
   - IP、UA、Referrer、X-Forwarded-* 等

### 3. 主界面作为可信 channel 且需要多端识别

主界面未来归入可信通道，但身份识别维度改为“界面”，不是“设备”。

具体含义：

1. 一个用户可有多个界面入口（例如桌面主界面、移动主界面、Web 主界面）。
2. 每个界面入口都有独立 `interface_id` 与绑定策略。
3. 同一用户不同界面共享主体级长期记忆（Balthazar/Casper），但保留界面级工作台（Melchior）。

## 术语与数据模型

### Source Channel（来源通道）

沿用当前可控枚举：

- `guardian`
- `external-agent`
- `system-cron`
- `unknown`

其中主界面默认映射为 `guardian`。

### Interface Identity（界面身份）

新增界面身份维度：

- `principal_id`: 用户主体标识（谁）
- `interface_id`: 界面实例标识（从哪一个界面入口来）
- `interface_kind`: 界面类型（如 `magi-main-ui`、`magi-source-panel`、`sdk-client`）

注意：`interface_id` 不是硬件设备 ID，不与设备指纹强耦合。

### Memory Scope（记忆作用域，按贤者分层）

为与主设计文档一致，记忆作用域不做“一刀切按界面隔离”，而是按贤者分层：

1. `melchior_scope_key = channel:principal_id:interface_id[:conversation_id]`
   - 当前场景全量工作台
   - 跨任务清零
2. `balthazar_scope_key = channel:principal_id`
   - 跨任务/跨界面情景记忆连续
3. `casper_scope_key = channel:principal_id`
   - 仅保留短工作窗（5~7 chunks）+ 全域召回，不做界面硬隔离

### RequestSourceContext（建议结构）

```go
type RequestSourceContext struct {
    RequestID      string            `json:"requestId"`
    Channel        string            `json:"channel"`        // guardian|external-agent|system-cron|unknown
    PrincipalID    string            `json:"principalId"`    // 用户主体ID
    InterfaceID    string            `json:"interfaceId"`    // 界面ID（非设备ID）
    InterfaceKind  string            `json:"interfaceKind"`  // magi-main-ui|magi-source-panel|sdk-client...
    ConversationID string            `json:"conversationId"` // 界面内会话ID（可选）
    SourceSessionKey string          `json:"sourceSessionKey"` // channel:principal:interface[:conversation]
    DirectResponseAllowed bool       `json:"directResponseAllowed"` // 是否允许MAGI直答（由API门禁计算）
    CallerID       string            `json:"callerId"`       // 调用方逻辑ID
    TrustBase      string            `json:"trustBase"`      // low|medium|high
    RiskLevel      string            `json:"riskLevel"`      // low|medium|high
    AuthStrength   string            `json:"authStrength"`   // strong|medium|weak
    ModelIntent    string            `json:"modelIntent"`    // 从model解析出的意图
    RawAttributes  map[string]string `json:"rawAttributes"`  // 审计用原始字段
}
```

## 采集与解析规则

## 0. API 层职责边界（必须）

API 层仅负责以下动作：

1. 解析并规范化 `RequestSourceContext`。
2. 执行鉴权校验（key 有效性、key-model 绑定、key-channel 许可）。
3. 计算 `directResponseAllowed` 门禁位，仅控制“是否允许 MAGI 直答”。

API 层不负责以下动作：

1. 不决定是否派出 Avatar。
2. 不根据业务语义选择 Trinity/Avatar 执行策略。
3. 不改写贤者记忆作用域。

## 1. API Key 绑定注册（强约束）

后端维护 Key Registry（可配置或存储）：

1. `key_hash -> principal_id`
2. `key_hash -> allowed_channels`
3. `key_hash -> allowed_models/model_prefix`
4. `key_hash -> default_interface_kind`
5. `key_hash -> default_trust/risk/policy_profile`

规则：

1. 未识别 key 直接拒绝。
2. key 与 model 不匹配直接拒绝。
3. key 对应 channel 之外请求直接拒绝（鉴权错误）。

## 2. model 解析（路由提示）

`model` 不单独决定身份，只在 key 通过后用于决策提示：

1. 推断路由意图（如标准 MAGI、特定 Avatar 策略）。
2. 作为 MAGI 内部决策提示（前提是 key 允许该 model）。
3. API 层不依据 `model` 做 Avatar 派发判定。

## 3. 界面身份解析（非设备）

优先从兼容字段解析：

1. OpenAI: `user`
2. Claude: `metadata.user_id`

解析建议格式：

1. `principal:<principal_id>;interface:<interface_id>;kind:<interface_kind>`
2. 或由前端约定的等价紧凑格式（需后端白名单解析器）

若缺失：

1. 使用 key 绑定默认界面类型。
2. `interface_id` 回退为会话内临时值，不提升信任等级。

## 4. request_source 标签解析（补充层）

可解析 `<request_source>...</request_source>`，但只允许补充：

1. 可补充审计信息。
2. 不可覆盖 key 已绑定的高可信字段。
3. 字段冲突时以 key 绑定信息为准，并记录冲突审计事件。

## 5. 弱信号处理

IP/UA 只记录到 `RawAttributes`：

1. 用于风控画像与追踪。
2. 不参与主身份决策。

## 6. MAGI 直答门禁（API Rule）

`directResponseAllowed=true` 仅在以下条件同时满足时成立：

1. 鉴权通过。
2. `channel=guardian`。
3. `interface_kind=magi-main-ui`。
4. 信任等级达到主界面直答阈值（建议 `trustBase=high`）。

否则：

1. 不拒绝（只要鉴权合法）。
2. 仅将 `directResponseAllowed=false` 传入 MAGI。
3. 后续是否走 Avatar 由 MAGI 内部决定。

## 来源信息在 MAGI 内部的使用方式

## 1. 路由层

1. 输入门禁来自 API：`directResponseAllowed`。
2. 当 `directResponseAllowed=true` 时，允许 MAGI 走 Trinity 直答路径。
3. 当 `directResponseAllowed=false` 时，MAGI 不得直答；是否派出 Avatar 由 MAGI 内部策略自主判定。
   - 对普通笔记界面等上游入口，采用 `avatar-first` 作为默认策略模板。
4. `interface_kind` 仅作为策略上下文，不改变“Avatar 由 MAGI 判定”的边界。

## 2. 策略层

1. 高信任主界面允许完整工具集。
2. 非主界面直答来源默认关闭直答能力（由 API 门禁保证）。
3. 外部或未知来源限制高风险工具。
4. 低信任高风险来源可直接阻断。

## 3. 上下文注入层

统一注入安全来源信封到贤者输入：

```xml
<request_source>{
  "channel":"guardian|external-agent|system-cron|unknown",
  "source":"...",
  "trustBase":"low|medium|high",
  "riskLevel":"low|medium|high",
  "principal":"...",
  "interface":"..."
}</request_source>
```

## 4. 会话与记忆层

分离“会话追踪键”和“记忆作用域键”：

1. 会话追踪键（用于路由、并发控制、审计）：
   - `source_session_key = channel + ":" + principal_id + ":" + interface_id + (":" + conversation_id)`
2. 记忆作用域键（用于贤者上下文）：
   - `melchior_scope_key = channel + ":" + principal_id + ":" + interface_id + (":" + conversation_id)`
   - `balthazar_scope_key = channel + ":" + principal_id`
   - `casper_scope_key = channel + ":" + principal_id`（但仅保留短窗）

效果：

1. Melchior 仍能按界面聚焦当前任务，避免界面内工作台串扰。
2. Balthazar/Casper 保留跨界面连续性，符合“经验与直觉跨场景存在”的主设计。
3. API 层可继续通过 `interface_id/interface_kind` 做身份判定与策略控制，但不强行改变贤者记忆理论。

## 5. 审计层

每轮记录以下最小审计字段：

1. request_id
2. principal_id
3. interface_id/interface_kind
4. channel/trust/risk
5. key_id_hash
6. model
7. route_decision/policy_decision

## 主界面可信通道方案（按界面）

## 1. 通道定义

1. `src/magi` 主聊天界面默认 `channel=guardian`。
2. Source Simulation 面板默认 `channel=external-agent` 或按配置映射。
3. 普通笔记界面（思源上游已存在的非 MAGI 监控入口）使用 `channel=external-agent`，不占用主界面直答通道。

## 2. 界面身份绑定

1. 主界面启动时获取界面身份（`interface_id`）。
2. 主界面请求使用绑定的 MAGI Key。
3. 后端校验 key 与 `interface_kind=magi-main-ui` 的绑定关系。

## 3. 多端识别策略

多端不按设备判定，按界面入口判定：

1. 桌面主界面: `interface_kind=magi-main-ui`, `interface_id=desktop-main`
2. 移动主界面: `interface_kind=magi-main-ui`, `interface_id=mobile-main`
3. Web 主界面: `interface_kind=magi-main-ui`, `interface_id=web-main`

可进一步细化为每个界面实例独立 ID（例如多窗口）。

## 4. 回退与降级

1. 若界面身份缺失或冲突，降级到 `external-agent` 或 `unknown`。
2. 降级后触发更严格工具与路由策略。

## 5. 普通笔记界面入口策略（非 MAGI 监控入口）

1. 普通笔记界面标记为 `interface_kind=siyuan-note-upstream`（或等价约定值）。
2. API 层对该入口固定 `directResponseAllowed=false`（即便鉴权合法）。
3. 请求进入 MAGI 后，默认走 Avatar 执行路径（avatar-first），由 MAGI 内部完成派发判定与执行；Avatar 通过 `report2magi` 汇报，MAGI 可读取其完整会话历史。
4. 该入口不模拟主界面身份，不共享主界面直答权限。

## 6. 工作空间管理 AI 主界面为何不做严格信息隔离

1. 主界面访问前提是已具备工作空间访问权限，调用方本就可读取工作空间笔记；再做主界面内“严格内容隔离”收益很低。
2. 主风险面在“外部来源伪装为主界面”而非“主界面内部多界面互访”；应把强约束放在 API Key 绑定、channel 识别、策略门控。
3. 严格隔离会破坏 Balthazar/Casper 的跨场景连续记忆设计，削弱系统的经验与直觉稳定性。
4. 更合理边界是：
   - 鉴权隔离：严格（key/channel/interface_kind）
   - 权限隔离：严格（工具白名单、风险等级）
   - 记忆隔离：分层（Melchior 界面级；Balthazar/Casper 主体级）

## 分阶段实施计划

## Phase 1: 身份平面与数据模型

1. 增加 `RequestSourceContext` 类型与解析结果对象。
2. 增加 Key Registry（内存+配置文件或持久化）。
3. 增加 `model -> intent` 白名单映射。
4. 增加 `MemoryScopeResolver`，统一派生 `source_session_key / melchior_scope_key / balthazar_scope_key / casper_scope_key`。

## Phase 2: API 入口统一解析

1. `/api/s-forge/magi/v1/chat/completions` 解析来源上下文。
2. `/api/s-forge/magi/v1/messages` 解析来源上下文。
3. 两条入口统一调用同一个解析器，确保行为一致。
4. API 仅执行鉴权错误拒绝与 `directResponseAllowed` 门禁计算，不做 Avatar 派发决策。
5. 为普通笔记界面入口固定设置 `directResponseAllowed=false`。

## Phase 3: MAGI 内部贯通

1. `api -> coordinator -> collector -> sages -> trinity` 全链路携带 `RequestSourceContext`。
2. 在贤者输入层注入规范化 `<request_source>`。
3. 在路由与策略层接入 `channel/trust/risk/interface`。
4. 在贤者上下文管理层接入 `MemoryScopeResolver`，按贤者选择对应 scope key。
5. 在 coordinator 层消费 `directResponseAllowed`，并由 MAGI 内部决定 Avatar 派发与执行路径（对上游普通笔记入口采用 avatar-first 默认模板）；内部 Avatar 复用普通 Agent 会话和 `report2magi` 工具，外部 Avatar 通过转发服务的等价报告适配器接入。

## Phase 4: 主界面可信化

1. `src/magi` 主界面接入界面身份透传。
2. 主界面 key 与其它入口 key 分离。
3. 落地“混合作用域”：Melchior 按界面工作台；Balthazar/Casper 按主体连续记忆。
4. 普通笔记界面入口固定为上游类型，不进入主界面直答通道。

## Phase 5: 审计与测试

1. 增加来源冲突审计日志。
2. 增加拒绝原因与降级原因可观测字段。
3. 增加单元测试、集成测试、兼容性回归测试。

## 测试与验收要点

## 1. 兼容性

1. OpenAI SDK 标准请求可直接工作。
2. Claude messages 协议可直接工作。
3. 未提供扩展字段时仍有稳定回退行为。

## 2. 安全性

1. 伪造 `request_source` 不能提升权限。
2. key-model 冲突必须被拒绝。
3. 主界面与非主界面策略边界可验证。
4. API 层仅拒绝鉴权错误来源，合法来源不因业务路由被 API 误拒。

## 3. 一致性

1. 相同来源在 chat/messages 两端点决策一致。
2. 同一 `principal` 不同 `interface`：
   - Melchior 作用域隔离有效
   - Balthazar/Casper 跨界面连续有效
3. 审计记录字段完整可追踪。
4. 普通笔记界面入口在两端点均固定 `directResponseAllowed=false`。
5. 是否派出 Avatar 的决策在 MAGI 内部一致，不在 API 层分叉；MAGI 对全部 Avatar 历史拥有受保护的读取和分析能力。

## 参考策略来源

1. myclaw 的 Gateway + Channel + MessageBus 分层与 `InboundMessage(Channel/SenderID/ChatID/Metadata)` 模型。
2. myclaw/nanoClaw 的通道白名单与签名校验模式（allowFrom、Webhook token/signature）。
3. nanoClaw 的 `session_id = channel:user` 思路，扩展为“会话追踪键 + 记忆作用域键”双平面。

## 非目标

1. 不以 UA/IP 作为主身份认证。
2. 不将设备指纹作为主会话键。
3. 不通过自由文本提示词完成身份判定。
