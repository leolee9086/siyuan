# MAGI 工具调用迁移到标准 MCP/Skill 机制执行跟踪 (TikTocTak)

> **目标**: 将 `app/src/magi` 当前基于 `tools/tool_choice + 本地tool_calls解析` 的工具调用链路，迁移为标准化的 **MCP + Skill** 机制；在迁移期间保持 OpenAI-compatible 外观与现有业务行为稳定。
> 量化目标：
> 1. `app/src/magi/core/wise/*`、`app/src/magi/core/nerv/avatarRuntime/*` 的工具定义与调用入口 100% 通过 Skill 注册中心管理（不再散落硬编码 schema）。
> 2. 工具执行 100% 经过统一 MCP 客户端调用层（发现、选择、执行、错误语义统一）。
> 3. `speak`、`configure_avatar_exposure`、`report_to_core` 三类关键工具迁移后行为与现网一致（含 channel/heartbeat 约束）。
> 4. 对外 `StandardLLMAdapter` 契约不变（请求/响应/SSE 结构不新增 MAGI 私有字段）。
> 5. 全链路具备可观测性：可记录 `tool -> skill -> mcp-call -> result` 的审计轨迹。
>
> **流程**: 这是一个滚动更新的执行路线图。
> 1. 从“近期计划”中认领一个任务。
> 2. 完成设计、开发和测试。
> 3. 将其移动到“已归档/已完成”区域。
> 4. 将“中期计划”中的条目提升到“近期计划”。
>
> **关联设计**:
> - [`docs/设计/MAGI认知架构.design.md`](../设计/MAGI认知架构.design.md)
> - [`docs/设计/MAGI_NERV_Avatar池化与内外工具隔离.design.md`](../设计/MAGI_NERV_Avatar池化与内外工具隔离.design.md)
>
> **关联 ttt**:
> - [`docs/ttt/MAGI_三贤人界面解耦_OpenAI适配接口同构.ttt.md`](./MAGI_三贤人界面解耦_OpenAI适配接口同构.ttt.md)
> - [`docs/ttt/MAGI_NERV_Avatar池化_内外工具隔离.ttt.md`](./MAGI_NERV_Avatar池化_内外工具隔离.ttt.md)
> - [`docs/ttt/基础AI执行层_流式输出改造.ttt.md`](./基础AI执行层_流式输出改造.ttt.md)
>
> **适用规程**:
> - [`docs/规程/tiktoctac文档(ttt)编写规程.procedure.md`](../规程/tiktoctac文档(ttt)编写规程.procedure.md)

---

## 核心原则

1. **标准优先**: 先冻结 MCP/Skill 边界与术语，再做代码迁移，禁止边迁移边改协议。
2. **适配层吸收差异**: 现有 `tools/tool_choice` 与 `tool_calls` 语义差异在适配层消化，不向上层业务扩散。
3. **行为等价**: 迁移前后对外可见行为必须一致，特别是 Trinity 输出与 Avatar 心跳链路。
4. **渐进落地**: 先建立桥接层，再分模块替换，保留可回退开关直到验证稳定。
5. **审计完整**: 工具发现、调用、失败、回退都必须有统一日志语义与追踪字段。
6. **最小侵入**: 优先替换调用路径，不重写业务策略逻辑。

**验证检查清单**:
- [ ] 代码库存在统一 Skill 注册入口与生命周期管理（register/list/resolve）。
- [ ] 代码库存在统一 MCP 调用入口与错误模型（超时/不可用/参数错误）。
- [ ] `trinity.toolset.ts`、`avatar.toolset.ts` 不再直接承载运行时硬编码工具 schema。
- [ ] `streamProcessor.ts` 的工具结果消费切换到统一 Skill 结果模型。
- [ ] `magiStandardLLMAdapter.ts` 在保持外部契约不变前提下可走 MCP/Skill 调用路径。
- [ ] 关键回归场景通过：Trinity speak、Avatar heartbeat、Avatar report、exposure 配置。

---

## 现状评估 (2026-03-06)

1. 当前工具调用主链路依赖 OpenAI-compatible `tools/tool_choice` 透传与本地 `tool_calls` 解析。
2. 工具定义分散在 `trinity.toolset.ts`、`avatar.toolset.ts` 等文件，缺少统一注册中心。
3. 工具结果聚合与解析集中在 `streamProcessor.ts`，但属于模型响应格式绑定实现。
4. 目前无明确 MCP client/server 协议层、capability discovery 或 skill registry 机制。
5. `magiStandardLLMAdapter.ts` 已形成统一外部入口，适合作为迁移承载边界。

---

## ℹ️ 如何维护此文档

1. **完成归档**：阶段完成后，必须移动到【已归档/已完成】并写明日期与成果文件。
2. **单任务在途**：仅允许一个近期任务标记为 `[-]`，避免并行迁移造成协议漂移。
3. **先验收后迁移**：每阶段必须先满足验收标准，再进入下一阶段。
4. **证据必附**：行为等价结论必须附测试或回放证据。

---

## 🟢 近期计划

- [-] **Phase 1: MCP/Skill 迁移边界冻结与清单盘点 (P0)**
  - **背景**: 现有工具调用入口分散，先冻结边界才能避免重复改造。
  - **行动**:
    1. 盘点工具定义、调用、解析、结果消费链路（覆盖 `wise`、`avatarRuntime`、`adapter`、`streamProcessor`）。
    2. 定义仓库内统一术语与模型：`SkillDescriptor`、`SkillInvocation`、`MCPCallResult`、`ToolVisibility`。
    3. 输出迁移映射表：旧工具名 -> 新 Skill ID -> 对应 MCP 能力。
    4. 冻结“桥接期兼容策略”（双轨/开关/回退条件）。
  - **验收标准**:
    - 完成迁移映射表并可用于开发分工。
    - 关键路径文件清单完整且可追踪。
    - 迁移开关策略与回退条件明确。

- [ ] **Phase 2: 建立 MCP/Skill 基础设施层 (P0)**
  - **背景**: 没有统一基础设施，业务模块无法稳定迁移。
  - **行动**:
    1. 新建 Skill 注册中心与解析器（注册、发现、按 ID 解析）。
    2. 新建 MCP 调用网关（请求构建、超时、重试、错误归一化）。
    3. 提供 OpenAI `tools/tool_choice` 到 Skill 调用的桥接适配（仅用于过渡）。
    4. 补齐基础单元测试（注册冲突、参数校验、错误分支）。
  - **验收标准**:
    - 基础设施可独立运行并通过测试。
    - 上层无需直接拼装工具 schema 即可发起调用。
    - 错误模型统一且可被上层消费。

- [ ] **Phase 3: Trinity/Avatar 工具链路迁移 (P0)**
  - **背景**: `speak`、`report_to_core`、`configure_avatar_exposure` 是当前核心工具路径。
  - **行动**:
    1. 将 Trinity/Avatar 工具定义迁移到 Skill 描述层。
    2. 将原有参数解析逻辑迁移为 Skill 输出解析器。
    3. 将 `buildTrinityToolReplyOptions` 与 `buildAvatarMetaToolReplyOptions` 改为调用 Skill 入口。
    4. 保持 `channel/internal`、`heartbeat` 等规则不回退。
  - **验收标准**:
    - 三类关键工具可通过 Skill 机制完整运行。
    - Trinity 外显文本与 Avatar 内部报告行为与迁移前一致。
    - 不再依赖散落 schema 的直接注入路径。

- [ ] **Phase 4: 适配器与流处理层迁移 (P1)**
  - **背景**: 工具迁移后，统一入口和流处理也需切换到 Skill 结果语义。
  - **行动**:
    1. 在 `magiStandardLLMAdapter.ts` 接入 MCP/Skill 调度链路。
    2. 在 `streamProcessor.ts` 增加 Skill 结果聚合与回放能力，减少对模型原生 `tool_calls` 结构的耦合。
    3. 保持 `StandardLLMAdapter` 外部契约与 SSE 输出兼容。
  - **验收标准**:
    - 外部接口无破坏性变化。
    - 内部可观测链路可从请求追踪到 Skill 执行结果。
    - 关键流式场景通过回归测试。

- [ ] **Phase 5: 双轨灰度、回归与旧链路下线 (P1)**
  - **背景**: 需要降低迁移风险，避免一次性切换影响主流程。
  - **行动**:
    1. 增加迁移特性开关（默认安全值），支持旧链路回退。
    2. 对关键场景做 A/B 回放比对（内容一致性、工具触发率、错误率）。
    3. 稳定后下线旧 `tools/tool_choice + 本地解析` 直连路径。
  - **验收标准**:
    - 灰度期间无 P0 回归。
    - 回放指标达到门槛后再移除旧链路。
    - 文档、测试、实现三者一致。

---

## 🟡 中期计划

- [ ] **Phase 6: Skill 扩展生态与治理 (P2)**
  - **背景**: 迁移完成后需要长期维持技能边界与质量。
  - **行动**: 引入 Skill 元数据治理（版本、所有者、稳定性等级、弃用策略）。
  - **验收标准**: 新增 Skill 具备统一准入与审查流程。

- [ ] **Phase 7: 安全与权限模型增强 (P2)**
  - **背景**: MCP/Skill 机制引入后，工具权限边界更关键。
  - **行动**: 增加基于来源信任度的 Skill 调用权限策略与审计策略。
  - **验收标准**: 高风险来源无法调用高权限 Skill，且审计可回放。

---

## 风险与依赖

1. **高风险**: 迁移过程中语义不一致导致 Trinity/Avatar 行为回归。
2. **高风险**: 桥接期双轨逻辑复杂，容易出现重复调用或漏调用。
3. **中风险**: 流处理层仍受模型 chunk 格式影响，兼容处理不完整会导致结果丢失。
4. **依赖**: 依赖 `StandardLLMAdapter` 现有稳定入口作为迁移承载点。
5. **依赖**: 依赖现有测试与回放能力扩展，否则难以证明“行为等价”。

---

## 🏁 已归档/已完成

- [x] **立项：MCP/Skill 工具调用迁移 TTT 建立** [已完成 2026-03-06]
  - **背景**: 现有工具调用为自定义实现，缺少标准 MCP/Skill 机制。
  - **完成情况**: 完成迁移目标、阶段拆解、验收标准、风险与依赖定义。
  - **成果文件**:
    - `docs/ttt/MAGI_工具调用迁移_标准MCP_Skill机制.ttt.md`
