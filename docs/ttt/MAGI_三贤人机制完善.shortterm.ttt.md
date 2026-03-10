# MAGI 三贤人机制完善（近期子计划）执行跟踪 (TikTocTak)

> **目标**: 将主计划的 Phase 1/2 拆解为可直接执行的短周期任务，优先落地“被动召回前置 + 单轮多步工具循环 + 三贤人决策结束信号工具族与 Trinity `speak` 协议分层一致性”。
> 量化目标：
> 1. 三贤人请求链路 100% 先经过被动召回阶段，并产出结构化 recall envelope（命中/空命中/失败均可区分）。
> 2. Melchior/Balthazar 单轮最少支持 3 次主动工具调用迭代；Casper 主动工具调用为 0，仅输出快速决策信号并收敛到 Trinity。
> 3. 三贤人与 Trinity 协议分层清晰：三贤人仅发“决策结束信号”进入工作空间，Trinity 通过 `speak`（`public/internal`）输出。
> 4. 非数据安全场景禁止静默错误；错误至少在返回值或事件中显式暴露。
>
> **流程**: 这是一个滚动更新的执行路线图。
> 1. 从“近期计划”中认领一个任务。
> 2. 完成开发和测试。
> 3. 将其移动到“已归档/已完成”区域。
> 4. 将“中期计划”中的条目提升到“近期计划”。
>
> **父计划**:
> - [`docs/ttt/MAGI_三贤人机制完善.ttt.md`](./MAGI_三贤人机制完善.ttt.md)
>
> **适用规程**:
> - [`docs/规程/tiktoctac文档(ttt)编写规程.procedure.md`](../规程/tiktoctac文档(ttt)编写规程.procedure.md)

---

## 核心原则

1. **先召回后推理**: 三贤人每轮必须先完成被动召回，再进入本轮生成/工具阶段。
2. **循环可控**: 工具循环必须受统一步数、超时、速率预算约束。
3. **协议分层**: 三贤人使用“决策结束信号工具族”完成交接，Trinity 使用 `speak` 完成输出，二者不得混用。
4. **任其崩溃**: 非数据安全场景不兜底、不吞错，不伪造“成功”。
5. **全程可观测**: 每次迭代都可追踪到 `round_id`、`seel`、`step`、`termination_reason`。
6. **职责分工刚性**: Casper 保持“本能/快速判断”路径，不承担主动多步工具查询职责。

**验证检查清单**:
- [ ] 被动召回在三贤人入口可观测，且空召回有显式结构而非省略。
- [ ] 三贤人终止条件仅允许：`decision_signal/handoff_to_trinity`、`max_steps`、`timeout`、`error`。
- [ ] Trinity 成功输出必须包含 `speak(channel=public)`；`speak(channel=internal)`仅用于内部报告。
- [ ] 三贤人决策信号与 Trinity `speak` 均可通过 `message_id/channel` 在事件流连续追踪。
- [ ] Melchior/Balthazar 支持多步主动工具循环；Casper 不进入主动查询循环并保持快速收敛。
- [ ] 工具错误不会被静默吞掉，调用方能拿到明确失败语义。

---

## 现状切分 (2026-03-10)

1. `kernel/nerv/magi/sages/sage.go` 当前以单次 `SendMessage` 为核心，尚未内建通用多步循环执行器。
2. `kernel/nerv/magi/coordinator/collector.go` 已具备并发收集能力，但尚未按贤者职责管理“Melchior/Balthazar 多步主动查询 + Casper 快速通道”。
3. `kernel/nerv/magi/stream/processor.go` 已包含 `speak` 与 `deliberation_signal` 解析能力，但“三贤人工具族终止语义 + Trinity speak 输出语义”仍需统一。
4. 现有链路可借鉴 `myclaw/nanoClaw` 的迭代预算、并行工具和审计思路，但要遵守 MAGI 的 crash-only 约束。

---

## ℹ️ 如何维护此文档

1. **仅拆近期**: 本文档只跟踪主计划 Phase 1/2 的细化落地，超出范围的项移回父计划。
2. **单任务在途**: 同时仅允许一个任务标记 `[-]`。
3. **先证据后归档**: 归档必须附验证证据（测试点、日志字段、事件字段）。
4. **失败可见**: 任何失败路径必须记录触发条件和传播路径。

---

## 🟢 近期计划

- [ ] **Phase S1: 被动召回协议与 recall envelope 定义 (P0)**
  - **背景**: 主计划 Phase 1 需要“分词器被动召回”成为固定前置阶段，先明确协议与边界。
  - **行动**:
    1. 明确 recall envelope 字段（建议至少含 `round_id`、`seel`、`query`、`hits`、`truncated`、`error`）。
    2. 约定空召回语义（`hits=[]` 且 `error=nil`），与失败语义（`error!=nil`）严格区分。
    3. 约定被动召回结果如何注入到贤者请求上下文（system 前缀或独立 context message）。
    4. 增加召回阶段观测字段（耗时、命中条数、截断原因）。
  - **验收标准**:
    - 三贤人链路均存在 recall envelope，且字段一致。
    - 空召回与失败召回在结构和事件语义上可区分。
    - 文档化契约可直接指导后续实现和测试编写。
  - **参考文档**:
    - `kernel/nerv/magi/sages/sage.go`
    - `kernel/nerv/magi/coordinator/collector.go`
    - `toread/myclaw/internal/memory/memory.go`
    - `toread/nanoClaw/nanoclaw/core/agent.py`
    - `toread/nanoClaw/nanoclaw/core/context.py`
    - `toread/nanoClaw/nanoclaw/memory/store.py`

- [ ] **Phase S2: 三贤人单轮多步工具循环执行器设计 (P0)**
  - **背景**: 主计划 Phase 2 核心是“Melchior/Balthazar 多步主动查询 + Casper 快速决策通道”并行收敛到 Trinity。
  - **行动**:
    1. 设计 `assistant -> tool -> assistant` 循环执行器与状态字段（`step`、`tool_name`、`termination_reason`）。
    2. 定义分角色预算参数：Melchior/Balthazar 使用 `max_steps/step_timeout/round_timeout/tool_rate_limit`；Casper 主动查询步数固定为 0。
    3. 约束工具结果回写策略：Melchior/Balthazar 每次工具结果必须进入上下文后再触发下一次 LLM 请求。
    4. 拆分终止口径：三贤人终止与 Trinity `speak` 输出分别建模和校验。
    5. 明确错误传播：工具失败/超时应终止当前贤者本轮并显式上抛。
  - **验收标准**:
    - 文档中可明确判断“循环继续/终止”的规则，不依赖隐式行为。
    - Melchior/Balthazar 每轮至少 3 步主动工具调用协议成立并有失控保护。
    - Casper 主动工具调用步数为 0，且可观测到“快速决策信号 -> Trinity”路径。
    - 异常路径具备统一错误码或终止原因枚举。
  - **参考文档**:
    - `kernel/nerv/magi/stream/processor.go`
    - `kernel/nerv/magi/coordinator/collector.go`
    - `toread/myclaw/internal/config/config.go`
    - `toread/nanoClaw/nanoclaw/core/agent.py`
    - `toread/nanoClaw/nanoclaw/security/budget.py`
    - `toread/nanoClaw/tests/test_agent.py`

- [ ] **Phase S3: 决策结束信号工具族与 Trinity `speak` 协议接缝 (P0)**
  - **背景**: 三贤人与 Trinity 需要分层协议：前者负责内部思考收敛和交接，后者负责最终输出。
  - **行动**:
    1. 定义三贤人“决策结束信号工具族”最小字段（至少含 `message_id`、`seel`、`decision`、`reason`）。
    2. 定义 `handoff_to_trinity` 信号载荷和触发时机。
    3. 定义 Trinity `speak` 最小字段（`message_id`、`channel`、`content`）并确定合法 `channel` 集合。
    4. 约定“决策信号 -> Trinity 汇聚 -> speak 输出”的时序与去重策略，保证可回放。
    5. 明确 Trinity 入口封包最小字段（贤者名、终止原因、耗时、工具轨迹摘要）。
  - **验收标准**:
    - 三贤人本轮结束必须产生决策结束信号或预算终止，不允许以 `speak` 作为结束信号。
    - Trinity 最终输出可被 `speak(channel=public)` 唯一确认并追踪。
    - Trinity 能稳定消费来自三贤人的阶段性输出与最终输出。
    - 协议不满足时显式失败，不允许隐式降级。
  - **参考文档**:
    - `kernel/nerv/magi/config/config.go`
    - `kernel/nerv/magi/config/manager.go`
    - `kernel/nerv/magi/stream/processor.go`
    - `kernel/nerv/magi/prompts/core.go`
    - `kernel/nerv/magi/types/types.go`
    - `kernel/nerv/magi/coordinator/trinity.go`
    - `kernel/nerv/magi/coordinator/collector.go`
    - `toread/nanoClaw/nanoclaw/channels/gateway.py`

- [ ] **Phase S4: 回归用例与审计字段对齐 (P1)**
  - **背景**: 上述设计若无测试与观测对齐，后续实现容易出现协议漂移。
  - **行动**:
    1. 列出最小测试集：命中/空命中/失败召回，Melchior/Balthazar 多步工具成功，Casper 主动查询拒绝，预算中断，工具异常中断。
    2. 定义关键事件字段：`round_id`、`seel`、`step`、`termination_reason`、`message_id`、`channel`。
    3. 明确审计记录最小粒度：至少记录每次工具调用和每轮终止原因。
  - **验收标准**:
    - 设计文档可直接转为测试用例，不需补充隐性规则。
    - 事件字段足以支持单轮回放和问题定位。
  - **参考文档**:
    - `kernel/nerv/magi/sages/sage_test.go`
    - `kernel/nerv/magi/websocket/events.go`
    - `toread/nanoClaw/nanoclaw/security/audit.py`
    - `toread/nanoClaw/nanoclaw/security/prompt_guard.py`

---

## 🟡 中期计划

- [ ] **Phase S5: 最高可信信道硬路由联动校验 (P1)**
  - **背景**: 主计划 Phase 4 需要与本子计划输出的协议保持一致。
  - **行动**: 将非最高可信来源直接走 Avatar 的规则写入统一路由验收矩阵。
  - **验收标准**: 非最高可信来源在任何入口都不会触发 MAGI 直答。

- [ ] **Phase S6: Crash-Only 审计闭环 (P1)**
  - **背景**: 主计划 Phase 5 需要把“显式失败”落到可审计数据上。
  - **行动**: 将错误路径的返回值、事件、日志字段对齐为同一错误语义。
  - **验收标准**: 非数据安全场景不存在静默失败路径。

---

## 风险与依赖

1. 三贤人决策信号工具族与 Trinity `speak` 双协议升级会影响现有事件消费端，需预先列兼容策略。
2. Melchior/Balthazar 多步循环若缺预算边界，可能造成响应阻塞与成本放大。
3. 若角色门禁失效，Casper 可能被错误卷入主动查询循环，导致反射弧特性退化。
4. 被动召回接线依赖现有分词器接口稳定和性能可控。
5. Crash-only 收敛会短期抬高显式失败率，需要同步观测面板。

---

## 🏁 已归档/已完成

- [x] **立项：Phase 1/2 近期子计划拆分** [已完成 2026-03-10]
  - **背景**: 主计划近期阶段复杂度较高，需要可执行的细粒度拆分。
  - **完成情况**: 已完成被动召回、工具循环、决策结束信号与 Trinity `speak` 协议、回归观测四个短期阶段的结构化拆分。
  - **成果文件**:
    - `docs/ttt/MAGI_三贤人机制完善.shortterm.ttt.md`
  - **参考文档**:
    - `docs/ttt/MAGI_三贤人机制完善.ttt.md`
    - `docs/规程/tiktoctac文档(ttt)编写规程.procedure.md`
