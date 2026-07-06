# Agent 聊天记录笔记化存储执行跟踪 (TikTocTak)

> **目标**: 在兼容现有 agent 前后端 API 和上游会话结构的前提下，将 agent 聊天记录的主持久化从 `storage/ai/agent/sessions/*.json` 切换为 AI 主笔记本中的普通笔记文档与块树。量化目标：
> 1. 新增或更新会话时，聊天正文、思考步骤、工具调用、确认卡片、问题卡片、快照与回滚事件 `100%` 落入笔记块树。
> 2. `/api/ai/agent/lsSessions|getSession|saveSession|removeSession` 响应结构与现有 `SessionStore` 消费结构保持 `100%` 兼容。
> 3. 旧 JSON 会话迁移后，可从笔记文档无损恢复为现有 `AgentSession.entries`，字段恢复率达到 `100%`。
> 4. 新写入主路径对 `storage/ai/agent/sessions/*.json` 的依赖命中率降为 `0%`，旧 JSON 仅作为迁移输入或短期回退读取。
> 5. 会话文档可被 SiYuan 原生同步、索引、搜索、引用和人工阅读，且属性中不得保存完整会话 JSON。
>
> **流程**: 这是一个滚动更新的执行路线图。
> 1. 从“近期计划”中认领一个任务。
> 2. 完成开发和测试。
> 3. 将其移动到“已归档/已完成”区域。
> 4. 将“中期计划”中的条目提升到“近期计划”。
>
> **关联 ttt**:
> - [`MAGI_AI人格档案文档笔记化存储优化.ttt.md`](./MAGI_AI人格档案文档笔记化存储优化.ttt.md)
> - [`MAGI_工作空间管理AI主笔记本落地.ttt.md`](./MAGI_工作空间管理AI主笔记本落地.ttt.md)
>
> **适用规程**:
> - [`docs/规程/tiktoctac文档(ttt)编写规程.procedure.md`](../../规程/tiktoctac文档(ttt)编写规程.procedure.md)
> - [`docs/规程/代码质量/Go后端代码重构.procedure.md`](../../规程/代码质量/Go后端代码重构.procedure.md)
> - [`docs/规程/代码质量/API请求重构.procedure.md`](../../规程/代码质量/API请求重构.procedure.md)
>
> **阶段边界 (2026-07-06)**: 本文档先冻结实现计划与验收标准，不在本阶段直接修改业务代码。

---

## 核心原则

1. **笔记块树真源**: agent 会话的主存必须是 AI 主笔记本中的文档和块树，JSON 文件只允许作为迁移输入、回退读取或临时兼容窗口。
2. **上游兼容优先**: 保留现有 API 路径、返回字段、前端 `SessionStore` 数据结构和 SSE 流式协议，不要求上游 UI 一次性理解新的底层存储。
3. **正文承载聊天内容**: 用户消息、助手回复、思考摘要和事件摘要必须作为可读正文块存在，不能把完整会话重新塞进文档属性、块属性或单个 JSON 代码块伪装成“笔记化”。
4. **属性承载协议与索引**: 文档属性和块属性只保存协议版本、类型、ID、时间、状态、排序、模型、token 统计等索引字段；大字段与嵌套结构使用正文子块承载。
5. **结构可逆恢复**: 从会话文档块树恢复出的 `AgentSession.entries` 必须与保存前语义一致，尤其不能丢失工具调用参数、工具结果、确认状态、问题答案和快照 ID。
6. **增量写入优先**: 流式会话期间只更新新增 entry、最后一个 assistant/thinking entry 和状态变化块，避免每个 token 全量重写整篇文档。
7. **单会话单文档**: 一个 agent 会话对应一个会话文档；文档根块与 `custom-ai-agent-session-id` 建立稳定映射，避免同一会话分散在多个文档。
8. **迁移可回退**: 旧 JSON 迁移必须幂等；迁移失败不得删除旧数据，成功后写入迁移标记并切换主读路径。
9. **同步与索引友好**: 所有写入走现有事务、块属性和索引刷新链路，不能绕过 SiYuan 文件系统、同步和历史机制直接改 `.sy` 文件。

**验证检查清单**:
- [ ] 已冻结会话文档根属性、entry 块属性、子块结构和字段映射表。
- [ ] `ListSessions/GetSession/SaveSession/DeleteSession` 已由笔记存储适配层驱动，外部 API 结构不变。
- [ ] 新会话完整写入 AI 主笔记本，且重启后能从笔记恢复为现有前端可渲染的 `entries`。
- [ ] 用户消息、助手回复、thinking、toolCalls、confirm、question、snapshot、rollback 均有对应笔记块结构。
- [ ] 旧 `session.json` 可幂等迁移，迁移后 UI 会话列表、切换、重命名、删除行为保持一致。
- [ ] 前端“在文件夹中显示”类入口已改为打开会话文档，不再暴露旧 JSON 目录作为主要用户入口。
- [ ] 并发流式、跨实例广播、删除、重命名和只读状态均有回归验证。

---

## ℹ️ 如何维护此文档

1. **完成归档**：任务完成后，**必须**剪切粘贴到【已归档/已完成】列表，并打上 `[x]` 和日期。
2. **补充弹药**：当【近期计划】空了，从【中期计划】里挑选任务挪上去。
3. **因地制宜**：如果发现计划不合理，随时修改或删除。
4. **数据驱动**：用迁移结果、测试结果和真实会话回放说话，不凭感觉。

---

## 结构冻结草案 (2026-07-06)

### 1. 存储位置

1. 会话文档位于现有 AI 主笔记本中，建议路径为 `/Agent/Chats/<会话标题>`。
2. 若工作空间不存在可用 AI 主笔记本，后端应复用 `ResolveActiveWorkspaceAIMainNotebook` 的状态判定，返回可观察错误，不静默写入普通笔记本。
3. 每个会话只对应一个文档；优先尝试使文档根块 ID 与 `sessionID` 一致，若现有创建链路不支持指定文档 ID，则使用文档根属性 `custom-ai-agent-session-id` 建立映射。
4. 会话列表以带有 `custom-ai-agent-session=true` 的文档为查询对象，旧 `index.json` 不再是主索引。

### 2. 会话文档根属性

| 属性名 | 示例值 | 是否必需 | 说明 |
|---|---|---|---|
| `custom-ai-agent-session` | `true` | 是 | 标记该文档是 agent 会话文档 |
| `custom-ai-agent-session-id` | `20260706120000-abcdefg` | 是 | 兼容现有 session ID |
| `custom-ai-agent-schema-version` | `1` | 是 | 笔记化协议版本 |
| `custom-ai-agent-title` | `AI Agent` | 是 | 会话标题，用于列表兜底 |
| `custom-ai-agent-created-at` | `1783339200000` | 是 | 创建时间，毫秒时间戳 |
| `custom-ai-agent-updated-at` | `1783339300000` | 是 | 更新时间，毫秒时间戳 |
| `custom-ai-agent-titled` | `true` | 否 | 是否已自动生成标题 |
| `custom-ai-agent-model` | `provider-model-id` | 否 | 最近使用模型 |
| `custom-ai-agent-prompt-tokens` | `1234` | 否 | 累计 prompt tokens |
| `custom-ai-agent-completion-tokens` | `567` | 否 | 累计 completion tokens |
| `custom-ai-agent-context-tokens` | `1800` | 否 | 最近上下文 token |
| `custom-ai-agent-context-limit` | `128000` | 否 | 最近上下文上限 |
| `custom-ai-agent-context-cached-tokens` | `300` | 否 | 最近缓存 token |
| `custom-ai-agent-always-allow` | `true` | 否 | 会话级工具确认策略 |
| `custom-ai-agent-snapshots` | `["repo-id"]` | 否 | 快照 ID 列表，小数组可用 JSON 字符串 |

**权威规则**:

1. 根属性只保存会话元数据和列表检索字段。
2. `entries`、`messages`、`toolCalls`、`thinking.steps` 不允许完整存入根属性。
3. token breakdown 这类较大的 map 如需持久化，应使用专用元数据子块承载，根属性只保存汇总数字。

### 3. Entry 顶层块结构

每个 `SessionEntry` 对应会话文档下的一个顶层子块，文档内顺序就是聊天顺序。所有 entry 顶层块必须带以下属性：

| 属性名 | 示例值 | 是否必需 | 说明 |
|---|---|---|---|
| `custom-ai-agent-entry` | `true` | 是 | 标记该块是会话 entry |
| `custom-ai-agent-entry-id` | `entry-uuid` | 是 | 前端 entry ID |
| `custom-ai-agent-entry-type` | `assistant` | 是 | `user|thinking|assistant|confirm|question|snapshot|rollback|metadata` |
| `custom-ai-agent-entry-order` | `12` | 是 | 稳定排序序号 |
| `custom-ai-agent-entry-timestamp` | `1783339300000` | 否 | entry 发生时间 |
| `custom-ai-agent-entry-duration` | `3.4` | 否 | thinking 或 assistant 耗时 |
| `custom-ai-agent-entry-status` | `approved` | 否 | confirm/question 等状态 |

### 4. Entry 正文与子块规则

| Entry 类型 | 顶层块正文 | 子块规则 | 恢复字段 |
|---|---|---|---|
| `user` | 用户消息 Markdown 原文 | 无必需子块 | `content/timestamp` |
| `assistant` | 助手回复 Markdown 原文 | 每个工具调用一个 `tool-call` 子块；可选 token 元数据子块 | `content/toolCalls/promptTokens/completionTokens/reasoningContent` |
| `thinking` | 思考摘要或自动生成标题 | 每个 step 一个 `thinking-step` 子块 | `steps/duration/reasoningContent` |
| `confirm` | 可读确认摘要 | 一个 `confirm-args` 子块保存参数 JSON | `confirmName/confirmArgs/confirmID/confirmStatus` |
| `question` | 可读问题摘要 | 一个 `question-payload` 子块保存问题和答案 JSON | `questionID/questions/status/answers` |
| `snapshot` | 快照摘要 | 无必需子块 | `snapshotID` |
| `rollback` | 回滚摘要 | 无必需子块 | `snapshotID` |

**子块属性约定**:

1. 工具调用子块使用 `custom-ai-agent-part=tool-call`，并保存 `custom-ai-agent-tool-name`、`custom-ai-agent-tool-call-id`、`custom-ai-agent-part-order`。
2. 工具调用参数和结果允许放在子块正文中的 fenced JSON 代码块中，因为这是单个工具调用的可审计载荷，不是整会话 JSON 镜像。
3. thinking step 子块使用 `custom-ai-agent-part=thinking-step`，正文保存 `reasoning`，属性保存 `custom-ai-agent-step-tool-names` 小数组字符串，长 `reasoningContent` 可作为子块正文的折叠区或专用代码块。
4. confirm/question 的参数 JSON 只存该事件载荷，不承载其他 entry。
5. 读取时以属性定位结构，以文档顺序恢复数组顺序；属性缺失或重复时应返回结构错误而不是猜测。

### 5. API 兼容层

1. 保留 `agent.ListSessions`、`agent.GetSession`、`agent.SaveSession`、`agent.DeleteSession` 的公开函数名。
2. 新增内部适配层 `NoteSessionStore`，负责笔记文档读写、索引查询、旧 JSON 迁移和错误收敛。
3. `/api/ai/agent/saveSession` 仍接收现有 `AgentSession` JSON body；后端把 body 转为文档块事务。
4. `/api/ai/agent/getSession` 仍返回现有 `AgentSession` shape；后端从文档恢复并补齐兼容字段。
5. `/api/ai/agent/lsSessions` 返回 `SessionIndexItem`，数据来源从旧 `index.json` 切到文档属性查询。
6. `/api/ai/agent/removeSession` 删除或移动会话文档到回收站，并广播现有 `agentSessionChanged`。

### 6. 迁移规则

1. 首次打开 agent 面板或后端启动空闲期扫描旧目录 `storage/ai/agent/sessions`。
2. 对每个旧 `session.json` 读取 `id/title/createdAt/updatedAt/entries/snapshots/alwaysAllow`。
3. 若目标会话文档已存在且 schema 合法，则跳过迁移并写入旧目录迁移标记。
4. 若目标文档不存在，则创建会话文档、写根属性、按 `entries` 顺序创建 entry 块和子块。
5. 迁移成功后在旧会话目录写入 `migrated.json`，记录目标文档 ID、迁移时间和协议版本。
6. 迁移失败不得删除旧 `session.json`；读取路径允许短期回退到旧 JSON，并在日志中记录失败原因。
7. 新会话和已迁移会话不再向旧 JSON 主路径写入。

### 7. 前端调整边界

1. `SessionStore` 的 API 路径、`AgentSession` 类型和保存调用保持不变。
2. `AgentSessionPanel` 的桌面端“在文件夹中显示”改为“打开会话文档”，调用块打开能力定位会话文档根块。
3. 删除会话继续调用 `removeSession`，但语义变为删除会话文档。
4. 重命名会话继续调用 `rename`，但后端或兼容层同步修改文档标题和根属性。
5. 跨实例刷新继续依赖 `agentSessionChanged`，不新增前端私有同步协议。

### 8. 风险与约束

1. **高风险**: 流式过程频繁保存可能造成事务压力，必须采用增量写入和节流策略。
2. **高风险**: 工具调用参数与结果可能很大，必须限制单块大小并为超大内容设计截断或附件化策略。
3. **中风险**: 用户人工编辑会话文档可能破坏协议，读取层必须能定位错误并给出可恢复提示。
4. **中风险**: 会话列表性能依赖属性查询和索引刷新，需要避免每次列表全量解析所有会话文档。
5. **约束**: 不直接手改 `.sy` 文件，不绕过事务和索引；不运行 `pnpm build` 作为验证。

---

## 🟢 近期计划

- [ ] **Phase 1: 会话笔记协议冻结与现状映射 (P0)**
  - **背景**: 当前 agent 会话已从 `messages` 收敛到 `entries`，但持久化仍在 `storage/ai/agent/sessions`，需要先冻结笔记块结构和兼容映射，避免实现期重复返工。
  - **行动**:
    1. 盘点 `kernel/agent/session.go`、`kernel/agent/agent.go`、`kernel/api/agent.go`、`app/src/layout/dock/agent/SessionStore.ts` 的现有字段和调用边界。
    2. 冻结会话文档根属性、entry 块属性、子块类型和 `AgentSession.entries` 双向映射。
    3. 明确属性只做协议与索引，正文块承载可读聊天内容，工具调用等复杂结构使用子块。
    4. 定义结构损坏、属性缺失、重复 entry、子块载荷损坏时的错误策略。
  - **验收标准**:
    - 字段映射表可直接指导 `NoteSessionStore` 实现。
    - 已明确哪些字段进属性、哪些字段进正文块、哪些字段进子块 JSON 载荷。
    - 已明确旧 JSON 迁移、回退读取和迁移标记策略。
  - **参考文件**:
    - `kernel/agent/session.go`
    - `kernel/agent/agent.go`
    - `kernel/api/agent.go`
    - `app/src/layout/dock/agent/SessionStore.ts`

- [ ] **Phase 2: 后端 NoteSessionStore 读写适配层 (P0)**
  - **背景**: API 兼容要求外部函数名和响应 shape 不变，底层必须先抽出可替换存储层。
  - **行动**:
    1. 新增 agent 会话存储接口或内部适配结构，提供 `List/Get/Save/Delete/Rename` 能力。
    2. 实现会话文档定位、创建、根属性写入和 entry 块序列化。
    3. 实现会话文档解析为现有 `AgentSession` map 的读取路径。
    4. 保留旧 JSON 读取作为未迁移会话的兼容回退。
  - **验收标准**:
    - 现有 `/api/ai/agent/*Session` 接口返回结构不变。
    - 新建会话主路径只写笔记文档。
    - 重启后可从笔记文档恢复会话并由现有前端渲染。
  - **参考文件**:
    - `kernel/agent/session.go`
    - `kernel/model/ai_main_notebook.go`
    - `kernel/model/blockial.go`
    - `kernel/model/transaction.go`

- [ ] **Phase 3: 流式增量保存与 checkpoint 收口 (P0)**
  - **背景**: 当前 agent 运行时有 checkpoint 与前端 `saveSession` 双写时序，笔记化后必须避免整文档高频重写。
  - **行动**:
    1. 将 `saveCheckpoint/writeCheckpointLocked` 的落盘目标切到笔记存储或只作为异常恢复过渡层。
    2. 为流式中的 assistant/thinking entry 建立“按 entry ID 更新最后块”的增量写入策略。
    3. 确认 `streamStart/streamEnd/update` 广播时序仍能保证其他实例读到完整内容。
    4. 对 confirm/question 状态变化、snapshot 追加、rollback 追加建立最小事务。
  - **验收标准**:
    - 长回复流式过程中不会每个 token 全量重写会话文档。
    - SSE 完成后，其他实例刷新读取到完整最终文档。
    - 中途异常后可从最后成功写入的笔记块恢复可读历史。
  - **参考文件**:
    - `kernel/agent/agent.go`
    - `kernel/api/agent.go`
    - `app/src/layout/dock/agent/AgentChat.ts`

- [ ] **Phase 4: 旧 JSON 会话迁移与幂等回退 (P0)**
  - **背景**: 历史用户数据仍在旧目录，必须无损迁移并可重复执行。
  - **行动**:
    1. 实现旧 `session.json` 到会话文档的迁移器。
    2. 写入 `migrated.json` 标记，记录目标文档 ID、迁移时间、schema 版本和结果。
    3. 处理部分迁移失败、重复迁移、目标文档已存在和旧数据损坏场景。
    4. 增加迁移日志和最小诊断 API 或日志输出。
  - **验收标准**:
    - 旧会话迁移后 `entries`、token 统计、snapshot、alwaysAllow 不丢失。
    - 重复执行迁移不会生成重复会话文档。
    - 迁移失败时旧 JSON 仍可回退读取。
  - **参考文件**:
    - `kernel/agent/session.go`
    - `storage/ai/agent/sessions`

- [ ] **Phase 5: 前端会话入口与回归验证 (P1)**
  - **背景**: 前端主体可保持 API 兼容，但“在文件夹中显示”等用户入口需要从 JSON 目录转为笔记文档。
  - **行动**:
    1. 将 `AgentSessionPanel` 的会话定位入口改为打开会话文档。
    2. 确认列表、搜索、切换、重命名、删除、跨实例刷新仍按现有 UX 工作。
    3. 补齐后端单元测试和前端 lint 验证。
    4. 建立真实会话样本回放：普通对话、工具调用、confirm、question、snapshot、rollback、长流式回复。
  - **验收标准**:
    - 用户可从会话列表打开对应笔记文档。
    - 删除和重命名同步作用于会话文档。
    - `cd app && pnpm run lint` 通过；Go 修改通过对应包测试。
  - **参考文件**:
    - `app/src/layout/dock/agent/AgentSessionPanel.ts`
    - `app/src/layout/dock/agent/AgentChat.ts`
    - `app/src/layout/dock/agent/SessionStore.ts`

---

## 🟡 中期计划

- [ ] **Phase 6: 会话文档结构诊断与修复提示 (P1)**
  - **背景**: 会话作为普通笔记可被人工编辑，读取层需要可解释错误，而不是只返回空会话。
  - **行动**:
    1. 为会话文档解析器输出结构化错误码和受损块 ID。
    2. 在日志或 UI 中提示“可读正文保留，但结构化恢复失败”的具体原因。
    3. 提供轻量修复策略，例如重建缺失 order、跳过损坏工具调用子块但保留正文。
  - **验收标准**: 破损文档可以定位到具体 entry 或子块，且不会影响其他会话列表加载。

- [ ] **Phase 7: 会话文档检索与属性视图增强 (P1)**
  - **背景**: 聊天记录进入笔记后，可以进一步利用原生搜索和属性视图做管理。
  - **行动**:
    1. 评估是否自动创建“Agent 会话索引”属性视图，按模型、更新时间、token、状态筛选。
    2. 会话列表搜索从标题匹配扩展到全文或 SQL 查询。
    3. 增加按会话文档打开上下文、复制链接、引用会话块的入口。
  - **验收标准**: 增强能力不改变会话主存协议，不阻塞基础读写链路。

- [ ] **Phase 8: 超大工具结果附件化与裁剪策略 (P1)**
  - **背景**: 工具结果可能远大于普通块适合承载的体积。
  - **行动**:
    1. 定义超大工具结果阈值。
    2. 超阈值结果写入 assets 或专用附件文档，tool-call 子块保存摘要和引用。
    3. 恢复为 `AgentSession` 时按需返回完整内容或摘要。
  - **验收标准**: 大结果不会导致会话文档编辑体验明显劣化，且仍可审计原始结果。

---

## 🔴 远期计划

- [ ] **Phase 9: Agent 对话与知识库双向引用 (P2)**
  - **愿景**: 会话文档成为可引用、可搜索、可整理的知识资产；agent 可把关键回复提升为正式笔记，同时保留原会话出处。

---

## 🏁 已归档/已完成

- [x] **立项：Agent 聊天记录笔记化存储 TTT 建立** [已完成 2026-07-06]
  - **背景**: 当前 agent 会话已具备 `entries` 结构，但主持久化仍是旧 JSON 文件，未充分利用 SiYuan 笔记、属性、同步和搜索能力。
  - **完成情况**: 已创建独立 TTT，冻结目标、核心原则、结构草案、迁移策略、实现阶段和验收标准。
  - **成果文件**:
    - `docs/ttt/AI模块改进/Agent_聊天记录笔记化存储.ttt.md`
