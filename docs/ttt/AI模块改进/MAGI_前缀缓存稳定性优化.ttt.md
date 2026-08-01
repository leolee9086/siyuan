# MAGI 前缀缓存稳定性优化执行跟踪 (TikTocTak)

> **目标**: 消除 MAGI 后端消息组装中破坏 LLM 前缀缓存（prefix cache）的动态内容前置问题，并清理前端遗留直连死代码，为前端增加前缀缓存命中监控。量化目标：
> 1. 后端每次请求的**稳定前缀**（system 提示词 + 唤醒序列）在相邻轮次完全一致，动态 `<status>` 信封移至消息序列尾部（与 user 输入信封并列），不再位于 system 之后。
> 2. 动态 system 注记（如 `injectForegroundSystemNote`、心跳工具提醒等）不再以持久 system 消息形式写入历史中部；确需保留语义的改为追加到本轮 user 消息尾部。
> 3. 前端遗留直连路径（mockWise 直连 `/chat/completions` 与 `构建SSE请求配置` 动态时间 system 提示词）经引用关系确认后移除，主链路仅保留后端 adapter 转发。
> 4. 信封语义不被滥用：`request_source`、`runtime_clock`、`status` 等仅由服务端按既有信任模型生成，改造过程中不得新增前端可伪造的信封注入路径。
> 5. 前端增加前缀缓存命中监控：每个 magi 请求可观测到请求前缀指纹与命中状态，支持对比相邻请求的稳定前缀差异。
>
> **流程**: 这是一个滚动更新的执行路线图。
> 1. 从「近期计划」中认领一个任务。
> 2. 完成开发、测试和验证。
> 3. 将其移动到「已归档/已完成」区域。
> 4. 将「中期计划」中的条目提升到「近期计划」。
>
> **关联设计**:
> - [`docs/设计/MAGI认知架构.design.md`](../../设计/MAGI认知架构.design.md)（如存在）
>
> **关联 ttt**:
> - [`MAGI_三贤人机制完善.ttt.md`](./MAGI_三贤人机制完善.ttt.md)
> - [`AgentPanel_能力扩展与MAGI持续会话.ttt.md`](./AgentPanel_能力扩展与MAGI持续会话.ttt.md)
>
> **适用规程**:
> - [`docs/规程/tiktoctac文档(ttt)编写规程.procedure.md`](../../规程/tiktoctac文档(ttt)编写规程.procedure.md)
> - [`docs/规程/测试与修复/后端Go测试编写.procedure.md`](../../规程/测试与修复/后端Go测试编写.procedure.md)
> - [`docs/规程/测试与修复/前端测试执行与错误修复.procedure.md`](../../规程/测试与修复/前端测试执行与错误修复.procedure.md)
> - [`docs/规程/代码质量/前端模块功能剥离.procedure.md`](../../规程/代码质量/前端模块功能剥离.procedure.md)

---

## 核心原则

1. **稳定前缀优先**: 发送给 LLM 的请求头（system + wakeup）必须是确定性、可复现的固定字节序列；任何动态内容（时间、状态、随机、轮次）不得进入该前缀。
2. **动态内容后移**: 动态信封（`<status>`、`<runtime_clock>`、`<workspace_snapshot>`、`<request_source>`、`<claimed_recent_history>`、`<passive_memory_recall>`）统一组装到本轮 user 消息，不插入 system 之后。
3. **确定性改造**: 每个修改都必须有测试证明：给定相同输入序列，构建出的请求前缀逐字节一致；动态内容只出现在预期尾部位置。
4. **信封不伪造**: 信封是服务端信任模型的一部分，改造只调整组装位置，不新增前端可注入的信封、不改变既有信任判定逻辑。
5. **死代码移除需证据**: 前端直连路径删除前必须先确认引用关系（unused 报告 + 调用图），禁止仅凭印象删除可能仍在使用的代码。
6. **最小侵入**: 先测试固定现状（绿色基线），再逐项后移动态内容，每次改动保持测试全绿。

**验证检查清单**:
- [ ] 后端新增单元测试：`buildRequestMessages` 在相邻轮次（相同历史栈）下稳定前缀（system + wakeup）逐字节一致。
- [ ] 后端新增单元测试：`<status>` 信封出现在请求消息序列的尾部 user 消息内，且 system 之后不再出现动态内容。
- [ ] 后端既有测试（`sage_test.go`、`coordinator_test.go`、`source_test.go`、心跳相关）全部保持绿色。
- [ ] 前端移除直连路径后 `pnpm run lint` 无新增错误，`unused-exports` 报告不含被误删的符号。
- [ ] 前端前缀缓存命中监控可观测：请求序列包含稳定前缀指纹，且相邻请求指纹差异可对比。
- [ ] 信封信任判定既有测试（`source_test.go`、`coordinator_test.go` 的 request_source 断言）未被破坏。

---

## ℹ️ 如何维护此文档

1. **完成归档**: 任务完成后，**必须**剪切粘贴到「已归档」列表，并打上 `[x]` 和日期。
2. **补充弹药**: 当「近期计划」空了，从「中期计划」里挑选任务挪上去。
3. **因地制宜**: 如果发现计划不合理，随时修改或删除。
4. **数据驱动**: 用日志证据和测试结果说话，不凭感觉。

---

## 现状评估 (2026-08-02)

1. **后端消息组装**: [`buildRequestMessages`](../../../kernel/nerv/magi/sages/sage.go:342) 将动态 `<status>` 信封放在 system 之后、wakeup 和历史之前，导致前缀随轮次跳变。
2. **动态 system 注记**: [`injectForegroundSystemNote`](../../../kernel/api/magi.go:683) 以及心跳工具提醒（[`collector_sage.go`](../../../kernel/nerv/magi/coordinator/collector_sage.go:79)）以持久 system 消息写入历史中部，持续侵蚀前缀命中。
3. **心跳动态时间**: [`buildHeartbeatPrompt`](../../../kernel/api/magi_runtime.go:541) 含 RFC3339 时间，但经 `buildSourceAwareUserInputBySage` 进入 user 消息尾部，不破坏前缀（现状已符合目标，需测试固化）。
4. **前端遗留直连**: [`mockWise.prompts.ts`](../../../app/src/magi/core/wise/mockWise.prompts.ts:200) 的 `构建Trinity系统环境提示词(Date.now())` 把动态北京时间放进 system 消息，属严重前缀破坏，但主链路已走后端 adapter；该路径是否仍被引用需先调查。
5. **信封信任**: 信封由服务端 `BuildSourceAwareUserInputFull`（[`source.go`](../../../kernel/nerv/magi/prompts/source.go:65)）统一生成，前端不参与。

---

## 🟢 近期计划

- [ ] **Phase 5: 前端前缀缓存命中监控（P1）**
  - **背景**: 目前无法观测每个请求的前缀稳定性和命中情况，缓存优化缺乏数据支撑。
  - **行动**:
    1. 在 magi 前端 adapter（[`magiStandardLLMAdapter.backend.ts`](../../../app/src/magi/adapters/magiStandardLLMAdapter.backend.ts:202)）请求发送前，计算请求消息数组的稳定前缀指纹（system + 前 N 条消息的 hash）。
    2. 发送到后端时携带指纹元数据（仅观测用途，不参与后端信任判定），或在监控 WebSocket 事件中附带。
    3. 在 Trinity 监控面板或 magi 运行时状态中展示相邻请求前缀指纹对比与差异位置。
  - **验收标准**: 每个 magi 请求可观测到前缀指纹；相邻请求差异（如有）可在监控面板中定位。
  - **参考文件**:
    - `app/src/magi/adapters/magiStandardLLMAdapter.backend.ts`

---

## 🟡 中期计划

- [ ] **Phase 6: 信封信任模型回归审计（P1）**
  - **背景**: 信封位置调整可能影响 magi 对 `request_source`/`runtime_clock`/`status` 的信任解读，需回归确认。
  - **行动**:
    1. 复核 `prompts/core.go` 中关于信封的说明与消息实际位置的一致性。
    2. 确保前端清理未新增可伪造信封的注入路径（如从 user 输入回显 `<request_source>`）。
    3. 运行 `source_test.go`、`coordinator_test.go` 全量断言。
  - **验收标准**: 信任判定相关测试全绿；无前端可伪造信封路径。

---

## 🔴 远期计划

- [ ] **Phase 7: 服务端前缀缓存命中率可观测化（P2）**
  - **愿景**: 将前缀稳定性指标接入内核监控（如 `observability/detail_log.go`），长期追踪各贤者前缀命中率随会话轮次的衰减曲线，指导上下文裁剪策略。

---

## 🏁 已归档/已完成

- [x] **Phase 0: 前缀缓存破坏调查报告** [已完成 2026-08-02]
  - **背景**: 排查 magi 消息机制是否存在前缀缓存破坏。
  - **完成情况**: 确认主破坏点为 [`buildRequestMessages`](../../../kernel/nerv/magi/sages/sage.go:342) 的 `<status>` 动态信封前置与持久 system 注记；心跳动态时间在 user 尾部（不破坏前缀）；前端 mockWise 直连路径含动态 system 时间但非活跃主链路。
  - **成果文件**: 本 ttt 文档的「现状评估」章节。

- [x] **Phase 1: 后端前缀稳定性基线测试（P0）** [已完成 2026-08-02]
  - **完成情况**: 在 `sage_test.go` 新增 `TestBuildRequestMessages_StablePrefix`（含跨 status 枚举跳变的 `TestBuildRequestMessages_StablePrefixAcrossStatusJump`）与 `TestBuildRequestMessages_StatusEnvelopePosition`；基线确认 `<status>` 前置问题后转绿。
  - **成果文件**: `kernel/nerv/magi/sages/sage_test.go`

- [x] **Phase 2: 动态 `<status>` 组装后移至消息尾部（P0）** [已完成 2026-08-02]
  - **完成情况**: [`buildRequestMessages`](../../../kernel/nerv/magi/sages/sage.go:342) 将 `<status>` 内容追加到尾部 user 消息（`appendStatusEnvelopeToTail`），system + wakeup 成为稳定前缀；sages 包测试全绿。
  - **成果文件**: `kernel/nerv/magi/sages/sage.go`

- [x] **Phase 3: 动态 system 注记改道 + 心跳信封封装（P1）** [已完成 2026-08-02]
  - **完成情况**: `injectForegroundSystemNote` 改为 `foregroundSystemNote()` 拼入 user 尾部（不持久化）；heartbeat 的 imaginativeInstr/reminder 用 `<source=seraph>` 信封封装；新增信封封装测试；coordinator 包全绿。
  - **成果文件**: `kernel/api/magi.go`、`kernel/nerv/magi/coordinator/heartbeat.go`、`heartbeat_test.go`、`voting_test.go`

- [x] **Phase 4: 前端死代码清理（P1）** [已完成 2026-08-02]
  - **完成情况**: 调查确认主链路走 [`AgentChat.magiSend.ts`](../../../app/src/layout/dock/agent/chat/message/sending/AgentChat.magiSend.ts:38) → 后端 adapter；`mockWise` 实例仅用于 UI 展示。移除 `mockWise.prompts.ts` 的动态 `Date.now()` 时间 system 注入（改为固定 `TRINITY_ENVIRONMENT_PROMPT_SUFFIX`），消除前端前缀破坏隐患。
  - **成果文件**: `app/src/magi/core/wise/mockWise.prompts.ts`
