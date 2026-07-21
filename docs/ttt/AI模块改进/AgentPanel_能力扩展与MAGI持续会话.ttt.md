# Agent Panel 能力扩展与 MAGI 持续会话（TikTocTak）

> **最终目标**：沿“扩展 Agent Panel 能力”的方向，建立可组合的行为扩展点、目标适配器和会话策略，使 Dock、Tab、浮窗、MAGI desktop/mobile 与独立网页能够通过配置和 hook 获得不同能力，而不依赖在核心面板中持续增加目标分支。
>
> **当前目标**：完成 MAGI 持续会话界面改造与身份隔离；同一身份只加载一条连续时间线，身份切换时卸载旧记录，不同身份的记录在服务端存储、列表和读取边界上严格分离。
>
> **下一步任务**：为 MAGI 会话增加经 armor 验证的身份归属，前端按当前 `identityId` 恢复唯一会话并隐藏多会话动作，再完成 desktop/mobile/Dock/独立页身份切换验收。
>
> **本轮范围**：优先完成 MAGI 持续会话和身份隔离；工具包、竞赛模式及新增消息动作继续保留在后续阶段，本轮不并行实现。

---

## 1. 不变量与边界

- MAGI 是与固定用户身份关联的一条持续通信时间线，不采用普通 Agent 的多会话轮换语义。
- 普通 Agent 与 MAGI 可以共享消息呈现和 Composer；会话生命周期、投递确认和重放策略分别采用各自的默认实现。
- MAGI 消息一旦被后端明确接收，面板永久隐藏重新发送/重新回答动作。
- 发送结果不明确时，前端先查询原消息的投递状态；没有幂等确认前，不创建第二个 MAGI 轮次。
- 同一用户身份在 Dock、Tab、浮窗、MAGI desktop、MAGI mobile 和独立 Agent 页面中只对应一份 MAGI 连续记录。
- 身份标识使用稳定的身份 subject 或服务端分配的稳定 key，不使用会过期、轮换或泄露权限的 armor token 作为会话主键。
- MAGI 会话的保存、索引、列表、读取和删除都必须验证身份归属；前端过滤只承担界面职责，不作为隔离边界。
- 身份退出或切换后立即清空内存中的旧消息、Composer 历史和请求身份；新身份完成权威会话加载前保持明确加载状态。
- MAGI 的“新会话、删除会话、重新回答”不是普通 Agent 动作的别名；是否显示必须由目标策略和 capability registry 决定。
- Agent Panel 核心只依赖抽象 port、adapter、policy 和 hook；不得直接导入 Layout、Vue、Dialog、Menu、完整 App 或具体身份页面。
- 新行为优先通过新增 hook、registry entry 或 adapter 实现；只有稳定且跨目标共用的规则才进入核心默认策略。
- 所有扩展点必须有生命周期、错误、取消和销毁语义；扩展抛错不得被静默吞掉。
- 模型工具权限与用户主动触发的消息动作属于两套注册表；“追加到当前笔记”不因其写入行为而混入 LLM 工具白名单。
- 每个对话可以解析出独立的有效工具集；请求开始后使用不可变配置快照，运行中修改只影响后续请求。
- 工具必须声明 `read-only`、`workspace-write`、`external-effect` 或 `unknown` 影响等级；未声明的工具按 `unknown` 处理。
- 多 LLM 并行推理的竞赛模式启用运行时只读执行闸门；每一次工具调用都在服务端执行前接受当前竞赛策略判定。
- 同一用户消息在并行模式下只保存一份，其多个回答以关联该消息的响应组和独立分支保存。
- 竞赛组可以在创建后追加已经形成的上下文；追加上下文只改变分支输入快照，不改变竞赛组的执行策略。

## 2. 当前基线

- 统一面板核心位于 `app/src/layout/dock/agent/AgentChat.ts`，由 Dock、Tab、浮窗、MAGI 宿主和独立入口复用。
- `AgentPanelCapabilities` 已采用细粒度 Port，可按宿主能力隐藏动作。
- `NativeAgentTargetAdapter` 和 `MagiTargetAdapter` 已分别承载普通 Agent SSE 与 MAGI 标准流式响应。
- 当前重发策略 `agentPanel.retryPolicy` 以工具、确认、问答、快照和回滚事件判断普通 Agent 是否可重放。
- 现有策略仍以“没有可见副作用即可重发”为基础，MAGI 内部主管 AI、三贤人协调和事件推进不应继续套用该条件。
- 当前 MAGI 面板仍沿用 `sessionId` 作为请求身份和会话记录边界；需要确认其是否应升级为“身份 subject -> 唯一 MAGI conversation”映射。
- `SessionStore` 主要服务普通 Agent 的会话列表和多会话操作；MAGI 应建立独立的连续记录查询和投递状态接口。
- 既有总体 TTT：[AgentPanel 多端统一、MAGI 聊天替换与独立入口](./AgentPanel_多端统一_MAGI聊天替换与独立入口.ttt.md)。本文件只追踪扩展能力与 MAGI 持续会话语义，不重复记录已完成的宿主迁移。

## 3. 目标架构

### 3.1 扩展优先的面板运行时

Agent Panel 运行时由以下可组合部件组成：

```ts
type AgentPanelExtension = {
    id: string;
    install(context: AgentPanelExtensionContext): AgentPanelExtensionHandle;
};

type AgentPanelExtensionContext = {
    target: AgentPanelTarget;
    capabilities: Readonly<AgentPanelCapabilities>;
    actions: AgentPanelActionRegistry;
    hooks: AgentPanelHookRegistry;
    messages: AgentPanelMessageStore;
};
```

- `Target Adapter`：定义消息发送、中止、历史读取、投递确认和目标专属事件。
- `Policy`：决定某动作在当前目标、消息状态和宿主能力下是否可见、可用或需要确认。
- `Action Registry`：注册复制、引用、重发、登录、重新连接、打开设置等动作，不在渲染器里硬编码目标判断。
- `Hook Registry`：提供发送前、请求接收后、消息落盘后、错误展示前、会话切换前和销毁前扩展点。
- `Message Store`：维护消息状态和可观察事件；扩展通过命令提交变化，不直接修改 DOM 或内部数组。
- `Host Ports`：只提供宿主能力，不承载 MAGI/Native 业务判断。

### 3.2 MAGI 持续会话

建议的稳定模型：

```ts
type MagiIdentityConversation = {
    identitySubject: string;
    conversationId: string;
    lastServerSequence: number;
    messages: MagiMessage[];
};

type MagiDeliveryState =
    | "draft"
    | "dispatching"
    | "accepted"
    | "completed"
    | "rejected"
    | "delivery-unknown";
```

- `identitySubject` 是同一用户身份跨宿主共享记录的稳定键。
- `conversationId` 由服务端或一次性身份初始化流程稳定分配，刷新、切换宿主和重新登录后保持不变。
- `clientMessageId` 是每条用户消息的幂等键，服务端必须支持查询和去重。
- `accepted` 表示 MAGI 已接收并可能进入内部协调；从此状态起不显示重发。
- `delivery-unknown` 仅进入投递状态查询或恢复流程，禁止直接新建请求。
- MAGI 面板不显示普通 Agent 的新会话列表；需要切换身份时，切换的是身份时间线而不是新建空会话。

### 3.3 可扩展行为策略

- `messageActionPolicy`：按 target、delivery state、工具影响声明和宿主 capability 返回动作状态。
- `conversationLifecyclePolicy`：决定新建、删除、归档、恢复和切换是否存在。
- `deliveryRecoveryPolicy`：处理超时、连接中断、服务端已接收但客户端未收到完成事件等状态。
- `renderExtension`：注册消息卡片、状态标记、工具摘要和目标专属信息，核心消息模型保持只读。
- `hostActionExtension`：通过细粒度 Port 暴露登录、设置、Tab、浮窗、通知和编辑器上下文。
- `auditExtension`：记录扩展动作和失败原因；不得把完整正文重新写入主 CLI 日志。

### 3.4 会话级工具配置与继承

需求登记：

- [ ] 细粒度调整每一个对话的工具可用性。
- [ ] 对话可以继承一个工具包配置，并以本地配置覆盖工具包默认值。
- [ ] 通过配置组合覆盖纯聊天、知识检索、笔记助手和完整编码工具等不同能力层级。

建议契约：

```ts
type ToolEffect = "read-only" | "workspace-write" | "external-effect" | "unknown";

type ConversationToolProfile = {
    extends?: string;
    overrides: Record<string, "inherit" | "allow" | "deny">;
};

type ResolvedToolProfile = {
    sourcePackageId?: string;
    sourcePackageVersion?: string;
    enabledToolIds: readonly string[];
    effects: Readonly<Record<string, ToolEffect>>;
    resolutionHash: string;
};
```

解析顺序固定为：

1. 读取已版本化的工具包默认配置。
2. 应用当前对话的本地 `allow/deny/inherit` 覆盖。
3. 与平台、身份及宿主声明的权限上限取交集。
4. 校验依赖工具、互斥项和工具影响等级。
5. 生成不可变 `ResolvedToolProfile`，随本次请求记录其版本与 hash。

约束：

- 本地覆盖可以改变工具包默认值，但越权项会得到明确的解析错误和原因。
- 工具包更新不应悄悄改变正在执行的请求；历史消息保留当时使用的解析快照标识。
- 工具 id、版本、影响等级和来源必须可审计；未知工具不得自动进入只读集合。
- “纯聊天”是空工具集配置，不需要建立另一套 Agent 实现。
- “完整编码工具”是包含读取、编辑、命令执行和相关确认策略的工具包，不在面板核心硬编码工具名单。

### 3.5 多只读 AI 并行推理

需求登记：

- [ ] 同一个用户消息发送给多个 LLM 接口，并同步显示各分支回答。
- [ ] 并行推理要求所有 LLM 分支仅使用只读工具。

建议契约：

```ts
type ParallelResponder = {
    id: string;
    adapterId: string;
    model: string;
};

type ResponseFanoutProfile = {
    responders: readonly ParallelResponder[];
    executionMode: "competition-read-only" | "parallel-standard";
};

type ParallelResponseGroup = {
    sourceMessageId: string;
    branches: readonly ParallelResponseBranch[];
};
```

- `Response Orchestrator` 接收一条用户消息和上下文来源快照，为每个 responder 创建独立 request id；竞赛组的执行模式在组生命周期内固定。
- 每个分支拥有独立流、状态、用量、错误和停止控制，同时提供“全部停止”动作。
- 任一分支失败都显示该分支的明确错误，其它分支继续工作；响应组本身不伪装成单一回答。
- 竞赛模式的核心约束是运行时工具闸门，而非启动前工具集审查：每个工具调用在真正执行前重新读取当前策略，写入、外部副作用和未知影响等级的调用都被结构化阻断。
- 被阻断的工具调用必须生成可见的 `tool_execution_blocked` 分支事件，包含工具 id、影响等级、阻断策略版本和用户可读原因；不得把它伪装成工具成功或静默丢弃。
- 工具阻断后的分支行为由响应策略决定：可以让模型基于已有上下文继续回答，也可以结束该分支并标记为“需要写入权限”；两种结果都要在 UI 中明确区分。
- 桌面宿主可以并列或分栏展示；窄 Dock 和移动宿主通过 renderer extension 选择分页、分段或纵向分组，响应数据模型保持一致。
- 各分支按服务端序号独立追加，刷新后恢复原响应组，不把多个回答拼接成一条 assistant 正文。
- 多 LLM fan-out 是普通 Agent 的响应编排能力；是否向 MAGI 开放由 MAGI target policy 单独声明。

竞赛模式的上下文与 UI/UX 约束：

- 竞赛组由“用户问题、初始上下文、追加上下文”三类输入组成；每个来源显示来源会话、消息范围、创建时间和只读快照标识。
- 已经经历不同上下文的 Agent 可以加入同一竞赛组，但每个分支保留自己的上下文 provenance，界面不把它们拼成一条历史会话。
- 竞赛组顶部固定显示 `COMPETITION / READ-ONLY` 状态、参与者数量、上下文来源数量和当前策略版本。
- 每个分支显示模型、上下文来源摘要、流式状态、工具读取记录和被阻断调用；“阻断”是可见状态而非普通错误 Toast。
- 追加上下文采用显式的“添加上下文”动作，先展示待加入来源清单，再提交组级快照；运行中的分支继续使用原快照，下一轮才读取新增来源。
- 竞赛组不复用普通 Agent 的编辑、确认、回滚和重发动作；消息导出、复制、引用等只读动作可以由 action registry 单独声明。
- 移动端使用响应组分页或分段视图，保留每个分支独立状态；不依赖全局断点改变竞赛语义。

### 3.6 可扩展消息动作

需求登记：

- [ ] 支持更多消息操作按钮，例如“导出为图片”和“追加到当前笔记”。

所有消息动作通过 `AgentPanelActionRegistry` 声明：

```ts
type MessageActionExtension = {
    id: string;
    order: number;
    resolve(context: MessageActionContext): MessageActionState;
    execute(context: MessageActionContext, signal: AbortSignal): Promise<void>;
};
```

- `resolve` 返回 `hidden/enabled/disabled`、原因和所需 capability，渲染器只消费解析结果。
- “导出为图片”依赖细粒度 `MessageImageExportPort`，负责主题、Markdown、代码块和图片资源的离屏渲染与导出。
- “追加到当前笔记”依赖细粒度 `CurrentNoteAppendPort`，由宿主执行编辑器事务并返回写入结果；独立页缺少该 capability 时隐藏动作。
- 用户主动触发的写入动作必须保留来源消息 id、目标文档 id、结果和错误记录。
- 动作扩展独立决定是否适用于 user、assistant、tool、parallel branch 或 response group，不在消息 DOM 创建函数中写固定分支。
- 图标、提示、分组、排序、快捷键和移动端收纳策略均来自动作声明与 renderer extension。

## 4. 近期计划

- [ ] **Phase 0：语义冻结与现状盘点**
  - [ ] 列出普通 Agent/MAGI 的所有消息动作、会话动作和宿主动作。
  - [ ] 标记每个动作的目标范围、前置状态、失败状态、可取消性和副作用等级。
  - [ ] 确认 MAGI 身份 subject 的稳定来源和当前后端会话字段。
  - [ ] 确认“后端接收成功”的权威事件与查询接口。

- [ ] **Phase 1：建立扩展契约**
  - [ ] 定义 `AgentPanelActionRegistry`、`AgentPanelHookRegistry` 和扩展生命周期类型。
  - [ ] 明确扩展注册顺序、优先级、重复 id、异常传播和卸载规则。
  - [ ] 将按钮显示/禁用/确认逻辑从 DOM 创建函数迁移到 action policy。
  - [ ] 为每个扩展点增加无 DOM 单元测试和销毁测试。

- [-] **Phase 2：MAGI 单一连续记录（当前唯一在途阶段）**
  - [ ] 建立 `identitySubject -> conversationId` 的稳定映射。
  - [ ] 增加 `clientMessageId`、服务端序号和投递状态持久化。
  - [ ] 在服务端会话索引、读取、保存和删除边界验证 MAGI 身份归属。
  - [ ] 让所有 MAGI 宿主加载同一份权威记录，禁止通过新建普通 session 形成第二条时间线。
  - [ ] 隐藏 MAGI 的新会话、删除会话和会话级重放动作。
  - [ ] 身份切换时卸载旧时间线，按新身份重新解析唯一会话；加载期间不显示旧身份消息。
  - [ ] 为跨宿主并发发送增加序列冲突和重复消息测试。

- [ ] **Phase 3：MAGI 投递恢复**
  - [ ] 明确身份校验失败、服务端拒绝、网络中断、接收未知和完成事件缺失的状态转换。
  - [ ] `accepted`、`completed` 和 `delivery-unknown` 状态不创建第二次发送。
  - [ ] 为身份恢复、重新连接和投递查询提供独立 action extension。
  - [ ] 错误卡只显示与当前状态匹配的动作，不用“重新回答”掩盖投递不确定性。

- [ ] **Phase 4：扩展能力迁移**
  - [ ] 将普通 Agent 重发策略迁移为可注册 policy，保留当前严格副作用门控作为默认实现。
  - [ ] 将 MAGI 目标策略作为独立实现注入，不在核心类中增加 `if (kind === "magi")` 分支集合。
  - [ ] 将菜单、Dialog、通知、设置、身份、编辑器、插件、Tab、浮窗和最小化动作接入 action registry。
  - [ ] 独立页面通过 capability registry 隐藏缺失动作，并为隐藏原因保留可观测诊断信息。

- [ ] **Phase 5：会话级工具配置**
  - [ ] 建立工具注册表、影响等级和版本化工具包 schema。
  - [ ] 实现工具包默认值、本地覆盖、权限上限交集和不可变解析快照。
  - [ ] 为纯聊天、只读检索、笔记助手和编码工具包建立配置夹具。
  - [ ] 覆盖继承、覆盖、越权、未知工具、版本变化和运行中配置变化测试。

- [ ] **Phase 6：多只读 AI 响应编排**
  - [ ] 定义响应组、分支状态机、请求关联和持久化格式。
  - [ ] 实现 fan-out orchestrator、分支独立停止和全部停止。
  - [ ] 建立竞赛组的 `competition-read-only` 运行时工具闸门，在每一次工具执行前判定并阻断写入调用。
  - [ ] 定义 `tool_execution_blocked` 事件、分支后续策略和前端可见阻断卡片。
  - [ ] 支持从不同历史会话追加上下文快照，保留来源 provenance 和分支独立上下文。
  - [ ] 增加部分失败、乱序 chunk、刷新恢复、跨宿主同步、阻断调用和用量统计测试。
  - [ ] 通过 renderer extension 完成桌面、窄 Dock 和移动宿主呈现，不引入全局断点业务判断。

- [ ] **Phase 7：消息动作扩展**
  - [ ] 将复制、引用和普通 Agent 重发迁入统一 action registry。
  - [ ] 增加 `MessageImageExportPort` 与“导出为图片”扩展。
  - [ ] 增加 `CurrentNoteAppendPort` 与“追加到当前笔记”扩展。
  - [ ] 验证缺失 capability 隐藏、写入事务、动作取消、错误可见性和销毁清理。

## 5. 中期计划

- [ ] 建立可版本化的 Agent Panel Extension SDK 和宿主兼容矩阵。
- [ ] 支持外部宿主注册目标 adapter、消息 renderer、动作和投递恢复策略。
- [ ] 为消息动作提供声明式菜单分组、排序、快捷键和权限/身份前置条件。
- [ ] 支持工具包导入、导出、版本锁定、差异预览和对话间复制配置。
- [ ] 支持并行回答的对比、择优引用和合并摘要；合并本身作为新的显式请求记录。
- [ ] 建立跨宿主消息同步、只读镜像和冲突提示的公共 runtime。
- [ ] 将普通 Agent 与 MAGI 的数据模型、事件协议和缓存策略分离记录，避免 SessionStore 继续承担两种语义。

## 6. 远期计划

- [ ] 支持可审计的检查点/事务恢复模型；在此之前不对 MAGI 提供重放能力。
- [ ] 支持插件以扩展形式提供新的 Agent 目标和专用消息卡片。
- [ ] 建立扩展安装、卸载、版本升级和故障隔离机制。
- [ ] 支持组织级工具权限上限和可审计的配置签名。

## 7. 验收标准

- 同一 MAGI 用户身份从 Dock、Tab、浮窗、desktop、mobile 和独立页打开时，看到同一条连续聊天记录。
- MAGI 消息进入 `accepted` 后，所有宿主均不显示重新发送动作。
- 投递状态不明确时，所有宿主都进入查询/恢复流程，不产生重复 MAGI 轮次。
- MAGI 身份缺失只显示身份入口；普通 Agent 的重发策略不影响 MAGI。
- 普通 Agent 的工具、确认、问答、快照和回滚动作仍由其独立策略控制。
- 每个对话都能解析出确定、可审计且带版本 hash 的有效工具配置。
- 工具包继承与本地覆盖结果稳定；权限上限、未知工具和依赖冲突均产生结构化错误。
- 纯聊天、只读检索、笔记助手和编码工具配置使用同一解析器和 Target Adapter 契约。
- 一条用户消息可产生多个独立流式回答；每个分支的模型、状态、错误、用量和停止动作清晰可辨。
- 竞赛响应组在每一次工具调用前执行只读闸门；违规调用被显式阻断并显示工具、策略和分支状态。
- 不同历史上下文可以加入同一竞赛组；来源、快照、分支和追加时间在 UI 中清晰可追溯。
- “导出为图片”“追加到当前笔记”等动作通过 registry 和细粒度 Port 接入，缺失宿主能力时按 capability 隐藏。
- 新增一个消息动作或目标行为时，只需注册 extension/policy/adapter，不修改核心渲染分支。
- 扩展卸载、宿主销毁和初始化失败后无残留请求、定时器、监听器或 DOM。
- 单元测试覆盖 policy、hook 顺序、异常传播、投递状态机、幂等去重和跨宿主同步。
- 浏览器测试覆盖 `1280x720` MAGI desktop、`390x844` MAGI mobile、Dock、Tab、浮窗和 `1440x900` 独立页。

## 8. 风险与控制

- **扩展点泛化过度**：每个 hook 只承载一个稳定生命周期语义，不创建万能事件总线。
- **目标分支回流核心**：目标差异放入 adapter/policy；核心只消费统一命令和状态。
- **投递状态误判**：以服务端接收事件和幂等查询为权威，禁止依据网络异常文本猜测。
- **身份串线**：conversation key 不使用 token，不从前端显示名推导；服务端返回稳定 subject 映射。
- **扩展异常污染主流程**：扩展错误进入可见错误事件和审计日志，核心消息状态保持明确。
- **旧会话迁移**：旧 MAGI 记录必须通过显式迁移脚本建立身份映射，缺失身份时停留在待认领状态。
- **配置继承漂移**：请求保存工具包版本和解析 hash；工具包升级只影响之后生成的新快照。
- **竞赛工具越权**：运行时闸门位于服务端真实工具执行边界；启动前解析只用于 UI 提示和配置诊断，不承担最终授权。
- **上下文来源混淆**：每个追加来源生成不可变快照和 provenance，响应组只关联来源，不改写原会话历史。
- **并行响应串流**：每个 chunk 必须携带 response group、branch 和 request id，过期或错分支事件直接进入协议错误。
- **动作与工具混淆**：模型工具、宿主 capability 和用户消息动作分别注册，禁止共享含义含混的权限布尔值。

## 9. 关联文件与文档

- [Agent Panel 主 TTT](./AgentPanel_多端统一_MAGI聊天替换与独立入口.ttt.md)
- [Agent Panel 持续改进](../AgentPanel_持续改进.ttt.md)
- [AgentChat 实现](../../app/src/layout/dock/agent/AgentChat.ts)
- [Agent Panel runtime ports](../../app/src/layout/dock/agent/runtime/agentPanel.ports.types.ts)
- [Agent Panel retry policy](../../app/src/layout/dock/agent/runtime/agentPanel.retryPolicy.ts)
- [SessionStore](../../app/src/layout/dock/agent/SessionStore.ts)

## 10. 已归档/已完成

- [x] 2026-07-22：创建本 TTT，冻结 MAGI 单一连续记录、接收后不重发、投递不确定状态和扩展优先原则。
- [x] 2026-07-22：确认本阶段只创建文档，代码保持原状；后续实现必须先补齐 policy、hook、adapter 和状态机测试。
- [x] 2026-07-22：登记会话级工具可用性、工具包继承与本地覆盖、多只读 AI 并行响应、导出图片和追加当前笔记需求；分别归入工具配置、响应编排和消息动作扩展，代码保持原状。
- [x] 2026-07-22：修正竞赛模式设计：只读约束改为服务端每次工具执行前的运行时闸门；允许向竞赛组追加不同历史上下文，并为来源 provenance、分支状态、阻断事件和移动端响应组视图补充 UX 约束，代码保持原状。
- [x] 2026-07-22：将当前唯一在途目标调整为 MAGI 持续会话界面与身份隔离；工具配置、竞赛编排和消息动作阶段保留但暂不展开。
