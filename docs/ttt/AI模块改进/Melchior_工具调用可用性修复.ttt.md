# Melchior 工具调用可用性修复执行跟踪 (TikTocTak)

> **目标**: 基于 `kernel/nerv/magi` 后端真实架构修复 Melchior 工具调用可用性问题，废弃“前端执行器主导”错误前提，建立可验证的后端工具链路。
> 量化目标：
> 1. Melchior 默认配置与加载配置均显式包含 `deliberation_signal` 工具定义。
> 2. 后端对 Melchior 工具调用的识别、参数解析、审慎决策信号回填覆盖率达到 100%（关键分支测试全通过）。
> 3. 不新增前端工具执行职责；前端仅消费后端事件与结果。
> 4. 对现有 Trinity `speak`、Avatar `report_to_core` 路径零回归。
>
> **流程**: 这是一个滚动更新的执行路线图。
> 1. 从“近期计划”中认领一个任务并标记为 `[-]`。
> 2. 完成实现与测试。
> 3. 满足验收标准后移动到“已归档/已完成”。
> 4. 将“中期计划”中的下一项提升到“近期计划”。
>
> **关联与依赖说明**:
> - 依赖：[`docs/ttt/AI模块改进/MAGI后端迁移.ttt.md`](./MAGI后端迁移.ttt.md)  
>   说明：该文档对审慎决策工具信号有明确约束，本 TTT 需要与其保持一致。
> - 并行：[`docs/ttt/AI模块改进/MAGI_三贤人机制完善.ttt.md`](./MAGI_三贤人机制完善.ttt.md)  
>   说明：可并行推进，但避免同时修改同一后端协调器文件。
> - 后续：[`docs/ttt/AI模块改进/MAGI_工具调用迁移_标准MCP_Skill机制.ttt.md`](./MAGI_工具调用迁移_标准MCP_Skill机制.ttt.md)  
>   说明：本 TTT 解决当前后端缺口，后续再统一到 MCP/Skill 体系。
>
> **适用规程**:
> - [`docs/规程/tiktoctac文档(ttt)编写规程.procedure.md`](../../规程/tiktoctac文档(ttt)编写规程.procedure.md)

---

## 核心原则

1. **架构对齐**: 工具调用主逻辑归属后端，前端不承担执行器职责。
2. **问题先证据化**: 先核查“工具定义、透传、解析、回填”四段链路，再改代码。
3. **最小改动**: 优先修配置与解析缺口，不重写无关流程。
4. **失败显式化**: 参数解析失败、工具缺失、信号回填失败必须可观测。
5. **滚动执行**: 近期计划仅保留单一在途任务，完成后再提升下一个阶段。
6. **可回归验证**: 每阶段必须伴随对应测试，不允许测试后置到最后。

**验证检查清单**:
- [ ] Melchior 配置中存在 `deliberation_signal` 工具定义（默认配置 + 文件加载后）。
- [ ] `Sage.SendMessage` 请求体持续透传 `tools/toolChoice`。
- [ ] `collector` 能稳定解析 `deliberation_signal` 参数并回填 `RequiresDeliberation/DeliberationReason`。
- [ ] 工具参数非法或缺失时有显式失败语义与日志。
- [ ] Trinity `speak` 与 Avatar 报告链路回归测试通过。

---

## 现状评估 (2026-03-15)

1. 后端 `Sage` 已有 `tools/toolChoice` 字段，并在 `SendMessage` 时透传到 LLM 客户端。
2. 后端 `llm/client.go` 已将 `Tools/ToolChoice` 填入请求，并支持流式 `tool_calls` 增量转换。
3. `collector` 已聚合 `tool_calls`，并把 `HasToolCalls` 回填为 `UsedToolCall`。
4. `collector` 已尝试读取 Melchior 的 `deliberation_signal` 参数并回填审慎决策字段。
5. 关键缺口：默认 Melchior 工具配置当前注册的是 `buildAvatar`，未见 `deliberation_signal` 工具定义，存在“提示词要求可调用但工具未声明”的不一致风险。

---

## ℹ️ 如何维护此文档

1. **完成归档**：任务完成后移动到【已归档/已完成】，并附日期与成果文件。
2. **单任务在途**：同一时刻仅允许一个近期任务标记为 `[-]`。
3. **先验收后流转**：未满足验收标准不得标记为 `[x]`。
4. **证据优先**：每个完成项必须附文件路径、测试名或日志证据。
5. **子任务状态同步**：子任务完成后立即更新对应 Phase 状态（`[ ] -> [-] -> [x]`）。

---

## 🟢 近期计划

- [-] **Phase 1.6: Melchior 审慎投票后 400 错误修复 (P0)** [进行中 2026-03-15]
  - **背景**: Melchior 发起 `deliberation_signal` 后，后续请求出现 `400 Bad Request: Invalid assistant message: content or tool_calls must be set`。当前怀疑点是后端将 assistant 消息写回上下文时未完整回填工具调用字段。
  - **行动**:
    1. 核查并修正 `collector` 写回 assistant 上下文逻辑：当存在工具调用时回填 `ToolCalls`，避免生成空 `content` 且无 `tool_calls` 的非法消息。
    2. 对齐 Trinity 既有的工具调用回写模式，统一 assistant/tool 消息结构约束。
    3. 补充 Melchior 会话复用场景测试，覆盖“仅工具调用无文本”和“文本+工具调用”两类分支。
    4. 增加关键日志，显式记录非法上下文防护命中与降级行为。
  - **验收标准**:
    - Melchior 发起审慎决策后继续对话不再触发 400 错误。
    - 发送到 LLM 的 assistant 历史消息满足 `content or tool_calls` 协议要求。
    - 新增与回归测试覆盖上述分支并通过。
  - **参考文件**:
    - `kernel/nerv/magi/coordinator/collector.go`
    - `kernel/nerv/magi/llm/client.go`
    - `kernel/nerv/magi/coordinator/trinity.go`
    - `kernel/nerv/magi/coordinator/collector_test.go`

- [x] **Phase 1.5: 通用工具调用状态推送机制 (P0)** [已完成 2026-03-15]
  - **背景**: 工具调用状态需要推送到前端，但当前缺少通用机制。需要让工具函数本身能够推送状态，并区分调用者。
  - **后端完成情况**:
    1. ✅ 添加 `TOOL_CALL_DETECTED` 通用事件类型
    2. ✅ 添加 `DELIBERATION_SIGNAL_RAISED` 专用事件类型
    3. ✅ 实现 `PushToolCallDetected` 推送函数（包含调用者、工具名、参数）
    4. ✅ 实现 `PushDeliberationSignalRaised` 推送函数（包含发起者、原因）
    5. ✅ 在 collector 中集成推送逻辑
    6. ✅ 测试验证推送事件包含完整信息
  - **前端完成情况**:
    1. ✅ 扩展投票状态类型以存储审慎决策信息
    2. ✅ 在 magiProjector 中订阅 `DELIBERATION_SIGNAL_RAISED` 事件并更新投票状态
    3. ✅ 在 magiProjector 中订阅 `TOOL_CALL_DETECTED` 事件并显示在贤者面板
    4. ✅ 更新投票UI格式化函数显示发起者和原因
    5. ✅ 添加事件类型到 WebSocket 桥接器支持列表
  - **验收标准**:
    - ✅ 后端推送包含调用者、工具名、参数的通用事件
    - ✅ `deliberation_signal` 触发专用事件，包含发起者和原因
    - ✅ Melchior 面板显示工具调用状态
    - ✅ 投票 UI 显示发起者和原因
  - **成果文件**:
    - 后端: `kernel/nerv/magi/websocket/events.go`, `kernel/nerv/magi/coordinator/collector.go`, `kernel/nerv/magi/coordinator/coordinator.go`, `kernel/nerv/magi/coordinator/voting.go`, `kernel/nerv/magi/coordinator/voting_test.go`, `kernel/nerv/magi/websocket/events_test.go`
    - 前端: `app/src/magi/composables/useMagi.types.ts`, `app/src/magi/events/magiEventBus.types.ts`, `app/src/magi/events/magiWebSocketBridge.ts`, `app/src/magi/events/magiProjector.ts`, `app/src/magi/events/dispatchMagiWebSocketMessage.guard.ts`, `app/src/magi/components/magi-main-panel/MagiMainPanel.ctx.ts`, `app/src/magi/components/magi-main-panel/MagiMainPanel.guard.ts`

---

## 🟡 中期计划

- [ ] **Phase 2: Trinity/Avatar 链路回归验证 (P1)**
  - **背景**: Melchior 修复不能破坏现有 Trinity `speak` 与 Avatar 报告路径。
  - **行动**:
    1. 运行并补齐 Trinity `speak` 相关测试。
    2. 运行并补齐 Avatar `report_to_core` 相关测试。
    3. 验证协调器端到端流程无回归。
  - **验收标准**:
    - Trinity 与 Avatar 关键测试全部通过。
    - 无新增破坏性行为。

- [ ] **Phase 3: 与 MCP/Skill 迁移接口对齐 (P2)**
  - **背景**: 当前修复应作为后续统一迁移的稳定基线。
  - **行动**: 将本次补丁涉及的工具定义与解析接口抽象为可迁移形态。
  - **验收标准**: 后续迁移文档可直接复用本阶段输出的契约与测试。

---

## 风险与依赖

1. **高风险：提示词-工具定义不一致**
   - 失败场景：提示词要求调用 `deliberation_signal`，但模型请求未声明该工具。
   - 检测方法：检查 Melchior 请求体 tools 列表是否包含该工具名。
2. **中风险：工具参数解析脆弱**
   - 失败场景：模型返回非标准 JSON，导致审慎决策信号丢失。
   - 检测方法：非法参数测试与日志告警。
3. **中风险：状态字段误导**
   - 失败场景：`UsedToolCall=true` 但 `RequiresDeliberation` 未正确回填。
   - 检测方法：状态组合测试与事件对账。
4. **依赖：后端测试框架可稳定执行**
   - 说明：若测试不稳定，优先修测试基础设施再推进阶段。

---

## ❌ 失败记录/复盘

- [x] **Phase 1.5 失败：投票UI仅显示工具调用，未显示审慎决策详情** [已修复 2026-03-15]
  - **触发条件**: 前端正确订阅了 `DELIBERATION_SIGNAL_RAISED` 事件并更新投票状态，但投票UI仍然不显示发起者和原因
  - **根本原因**: 后端 `PushVotingResult()` 函数未在投票结果事件中包含审慎决策信息。前端从 `SEEL_VOTE_UPDATED` 事件获取投票状态数据，而该事件缺少 `deliberationInitiator` 和 `deliberationReason` 字段
  - **影响范围**:
    - 投票UI无法显示是谁发起的审慎决策以及原因
    - `DELIBERATION_SIGNAL_RAISED` 事件虽然推送但未被投票UI使用
  - **修复方案**:
    1. 修改 `PushVotingResult()` 签名，添加 `deliberationInitiator` 和 `deliberationReason` 参数
    2. 修改 `ProcessVoting()` 签名，接收并传递审慎决策参数
    3. 修改 `executeVoting()` 从 Melchior 响应中提取审慎决策信息并传递给 `ProcessVoting()`
    4. 更新所有测试文件中的函数调用，传入空字符串作为默认值
  - **复发预防**:
    - 事件推送机制应确保关键状态信息在最终结果事件中完整包含
    - 前端UI依赖的数据应从结果事件获取，而非依赖中间过程事件
    - 添加端到端测试验证UI显示内容与后端推送数据的一致性
  - **相关文件**:
    - `kernel/nerv/magi/websocket/events.go`
    - `kernel/nerv/magi/coordinator/voting.go`
    - `kernel/nerv/magi/coordinator/coordinator.go`
    - `kernel/nerv/magi/coordinator/voting_test.go`
    - `kernel/nerv/magi/websocket/events_test.go`

---

## 🏁 已归档/已完成

- [x] **立项：Melchior 工具调用可用性修复 TTT 建立** [已完成 2026-03-15]
  - **背景**: 已确认 Melchior 工具调用链路需要按后端架构重新核查。
  - **完成情况**: 建立执行跟踪文档并定义阶段目标。
  - **成果文件**:
    - `docs/ttt/AI模块改进/Melchior_工具调用可用性修复.ttt.md`

- [x] **废弃错误前提（前端执行器主导）并重置路线** [已完成 2026-03-15]
  - **背景**: 旧版本路线将问题错误归因到前端，忽略了后端已存在的工具透传与解析链路。
  - **完成情况**: 将 TTT 重构为后端核查与修复路线，明确前后端职责边界。
  - **成果文件**:
    - `docs/ttt/AI模块改进/Melchior_工具调用可用性修复.ttt.md`

- [x] **Phase 1: 后端链路基线核查与配置缺口修复 (P0)** [已完成 2026-03-15]
  - **背景**: 提示词要求调用 `deliberation_signal` 工具，但 Melchior 配置未声明该工具。
  - **完成情况**:
    1. 创建 `BuildDeliberationSignalToolDef()` 工具定义函数
    2. 将 `deliberation_signal` 添加到 Melchior 默认配置
    3. 确保配置文件加载时自动补齐该工具
    4. 补充测试覆盖合法参数、非法 JSON、未调用工具三种场景
  - **成果文件**:
    - `kernel/nerv/magi/config/config.go` (新增常量和工具定义函数)
    - `kernel/nerv/magi/config/manager.go` (更新默认配置和自动补齐逻辑)
    - `kernel/nerv/magi/config/config_test.go` (新增 3 个配置测试)
    - `kernel/nerv/magi/coordinator/collector_test.go` (新增 2 个解析测试)
  - **测试结果**: 所有测试通过，覆盖率达标
