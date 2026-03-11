# MAGI 多轮历史堆栈管理执行跟踪 (TikTocTak)

> **目标**: 在不破坏现有三贤人/Trinity 协作链路的前提下，落地“真正的多轮历史堆栈管理”。
> 量化目标：
> 1. 三贤人每个实例都使用各自 `contextMessages` 作为主上下文栈（受 `memorySize` 限制），不再被每轮 `overrideMessages` 全量覆盖。
> 2. 当且仅当 `Melchior` 本轮**未发起工具调用**时，下一轮三贤人看到的上一轮公共历史为 Trinity `speak` 原文（不加 `source=echo` 包装，不加“上一轮Trinity综合输出：”前缀）。
> 3. 对于连续 5 轮会话，能稳定复现“每轮上下文包含上一轮历史”的行为，且导出记录可审计分支判定依据。
>
> **流程**: 这是一个滚动更新的执行路线图。
> 1. 从"近期计划"中认领一个任务。
> 2. 完成开发和测试。
> 3. 将其移动到"已归档/已完成"区域。
> 4. 将"中期计划"中的条目提升到"近期计划"。
>
> **关联设计**:
> - [`docs/设计/MAGI认知架构.design.md`](../设计/MAGI认知架构.design.md)
> - [`docs/设计/MAGI_Shell行动层.design.md`](../设计/MAGI_Shell行动层.design.md)
>
> **关联 ttt**:
> - [`MAGI_投票机制修正.ttt.md`](./MAGI_投票机制修正.ttt.md)
> - [`MAGI_详细记录导出.ttt.md`](./MAGI_详细记录导出.ttt.md)
>
> **适用规程**:
> - [`docs/规程/tiktoctac文档(ttt)编写规程.procedure.md`](../规程/tiktoctac文档(ttt)编写规程.procedure.md)
> - [`docs/规程/代码质量/代码拆分与模块化.procedure.md`](../规程/代码质量/代码拆分与模块化.procedure.md)
> - [`docs/规程/代码质量/lint错误修复.procedure.md`](../规程/代码质量/lint错误修复.procedure.md)
>
> **阶段边界 (2026-03-03)**: 本文档先冻结“实现计划与验收标准”，不在本阶段直接修改业务代码。

---

## 核心原则

1. **历史栈优先**: 三贤人上下文以各自 `contextMessages` 为主，不以每轮人工拼接覆盖真实栈。
2. **分支可审计**: “Melchior 是否调用工具”必须来自流式 `tool_calls` 实测，不允许启发式猜测。
3. **语义纯净**: Trinity 历史注入必须是可见回复原文，不增加未约定包装文本（包括 `source=echo` 包裹和解释性前缀）。
4. **角色隔离**: 三贤人历史栈互相独立，Trinity 为跨角色公共历史来源，不等于三贤人共用同一物理栈。
5. **最小侵入**: 先建立历史管理层，再逐步替换现有 `overrideMessages` 依赖，避免一次性大改导致回归。

**验证检查清单**:
- [x] 三贤人每轮调用时都能从自身历史栈读取至少 1 条上一轮内容（第二轮起）。
- [x] 非冷启动场景不再使用“全量 `overrideMessages`”覆盖三贤人上下文。
- [x] `melchiorUsedToolCall` 判定来源为流式 `tool_calls` 实测字段。
- [x] `melchiorUsedToolCall=false` 时，下一轮注入文本与上一轮 Trinity `speak.content` 完全一致（逐字匹配）。
- [x] `melchiorUsedToolCall=true` 时，不注入 Trinity 公共历史到三贤人（保持各自私有延续策略）。
- [ ] 导出记录能展示每轮“判定来源、历史注入内容、注入目标”三项证据。

---

## ℹ️ 如何维护此文档

1. **完成归档**：任务完成后，**必须**剪切粘贴到【已归档】列表，并打上 `[x]` 和日期。
2. **补充弹药**：当【近期计划】空了，从【中期计划】里挑选任务挪上去。
3. **因地制宜**：如果发现计划不合理，随时修改或删除。
4. **数据驱动**：用日志证据和测试结果说话，不凭感觉。

---

## 现状评估 (2026-03-03)

1. **数据结构层面**: 三贤人实例确实各自拥有 `contextMessages` 历史栈（`mockWise.ts` / `wise.types.ts`）。
2. **执行路径层面**: 当前贤者 `reply` 被 `overrideMessages` 强制覆盖，导致真实历史栈在主路径上被绕过。
3. **历史注入偏差**: 目前将 Trinity 上一轮内容注入为 `source=echo` + “上一轮Trinity综合输出：...” 文本，这不符合“像三贤人自己直接回复一样可见”的目标语义。
4. **分支判定能力**: 已接入 Melchior `tool_calls` 实测判定能力，但尚未完成“基于真实历史栈”的全链路落地。

---

## 近期计划

- [-] **Phase 2: 历史栈管理器落地（不改业务语义） (P0)**
  - **背景**: 先抽象历史栈读写，避免散落在共识流程里直接拼接字符串。
  - **行动**:
    1. 新建 `historyStack` 管理模块（建议放在 `app/src/magi/composables/consensus/` 下）。
    2. 提供 API：
       - `appendRoundInput(owner, userInput)`
       - `appendRoundOutput(owner, output, sourcePolicy)`
       - `resolveContextWindow(owner, memorySize)`
       - `commitTrinitySharedHistory(rawSpeak, eligible)`
    3. 保持现有对外行为不变，仅将历史读写收拢到单点。
  - **验收标准**:
    - 历史读写入口不再分散在 3 个以上文件中。
    - 不引入循环依赖，不触发目录条目上限和文件行数规则。
  - **参考文件**:
    - `app/src/magi/composables/magiConsensus.ts`
    - `app/src/magi/composables/useMagi.consensus.ts`
    - `app/src/magi/core/wise/mockWise.ops.ts`

- [ ] **Phase 3: 三贤人上下文切换到真实历史栈 (P0)**
  - **背景**: 当前最大问题是每轮 `overrideMessages` 盖掉真实历史。
  - **行动**:
    1. 将贤者主路径改为“历史栈 + 本轮输入”的增量上下文，而非“每轮整包重写”。
    2. 保留唤醒序列，但改为冷启动一次性注入，热轮次不重复。
    3. 在此阶段移除 `trinityHistory` 的解释性包装注入逻辑。
  - **验收标准**:
    - 第 2 轮起，三贤者上下文窗口中可见上一轮真实内容（来自栈，不是每轮模板重建）。
    - `overrideMessages` 仅用于必要特殊路径（如 Trinity 特殊编排），不用于三贤者常规回复。
  - **参考文件**:
    - `app/src/magi/core/wise/mockWise.prompts.ts`
    - `app/src/magi/core/wise/mockWise.ops.ts`

- [ ] **Phase 4: Trinity 公共历史注入精确化 (P0)**
  - **背景**: 你指出的偏差必须修正为“像直接回复一样”。
  - **行动**:
    1. 将“Trinity 历史注入文本”改为 `speak.content` 原文，不增加任何包裹标签和提示前缀。
    2. 历史注入由 `melchiorUsedToolCall` 精确判定触发：
       - `false` 才注入
       - `true` 禁止注入
    3. 在导出元信息中增加注入证据字段（例如注入轮次、注入目标、原文字段 hash）。
  - **验收标准**:
    - 同轮回放中，历史注入文本与 Trinity `speak` 原文逐字一致。
    - 错误分支不会误注入跨轮公共历史。
  - **参考文件**:
    - `app/src/magi/composables/magiConsensus.reply.ts`
    - `app/src/magi/composables/useMagi.consensus.ts`
    - `app/src/magi/utils/streamProcessor.ts`

- [ ] **Phase 5: 多轮回归与可审计验证 (P1)**
  - **背景**: 该问题本质是“多轮状态一致性”，必须靠回放测试验收。
  - **行动**:
    1. 补充最小集成测试：2 轮、3 轮、5 轮会话，覆盖 `tool_call true/false` 两条主分支。
    2. 增加开发态调试导出：每轮上下文窗口快照（脱敏）与注入决策日志。
    3. 复核 `memorySize` 截断行为是否与预期一致（不出现越界或重复注入）。
  - **验收标准**:
    - 关键分支测试通过，且可复现你提出的目标行为。
    - 详细导出中可定位每轮历史来源与注入策略。
  - **参考文件**:
    - `app/src/magi/composables/useMagi.consensus.ts`
    - `app/src/magi/composables/useMagi.export.ts`

---

## 中期计划

- [ ] **Phase 6: 历史策略可配置化 (P2)**
  - **背景**: 后续可能需要在实验阶段切换“Trinity 公共历史注入策略”。
  - **行动**:
    1. 将历史策略抽象为配置项（默认开启精确策略）。
    2. 保持默认行为与本 TTT 一致，实验策略通过显式开关启用。
  - **验收标准**:
    - 配置切换不影响主链路稳定性。

- [ ] **Phase 7: 历史污染防护与裁剪优化 (P2)**
  - **背景**: 长会话中公共历史重复注入会放大上下文污染风险。
  - **行动**:
    1. 增加去重和压缩策略（按轮次 hash 去重）。
    2. 增加“注入预算”限制，避免公共历史挤占用户输入窗口。
  - **验收标准**:
    - 在长会话（20+ 轮）下历史窗口保持稳定可控。

---

## 风险与依赖

1. **高风险**: 从 `overrideMessages` 切换到真实历史栈可能影响现有人格锚定效果，需要冷启动/热启动边界控制。
2. **中风险**: 目录条目上限、文件行数上限可能导致实现期需要同步模块拆分。
3. **中风险**: Trinity 与三贤者历史策略切换时，若日志字段未同步，审计链会断裂。
4. **依赖**: 需要复用并扩展现有 `melchiorUsedToolCall` 实测字段与导出通道。

---

## 已归档/已完成

- [x] **Phase 1: 历史协议冻结与行为矩阵定义 (P0)** [已完成 2026-03-03]
  - **背景**: 先把“什么写入历史、何时写入、谁能看到”冻结为协议，避免实现期反复返工。
  - **完成情况**: 完成轮次历史条目模型、三贤人历史写入矩阵、冷启动/热启动边界与状态机定义；明确禁止 `source=echo` 包裹和“上一轮Trinity综合输出：”前缀。
  - **成果文件**:
    - `docs/设计/MAGI_多轮历史堆栈协议.design.md`
    - `docs/ttt/MAGI_多轮历史堆栈管理.ttt.md`

- [x] **立项：多轮历史堆栈管理 TTT 建立** [已完成 2026-03-03]
  - **背景**: 当前实现存在“有历史结构、无历史主路径”的偏差，且 Trinity 历史注入文本不符合目标语义。
  - **完成情况**: 完成现状问题冻结、目标行为定义、阶段计划与验收标准编制。
  - **成果文件**: `docs/ttt/MAGI_多轮历史堆栈管理.ttt.md`

---

## 执行记录

| 日期 | 任务 | 状态 | 备注 |
|------|------|------|------|
| 2026-03-03 | 创建 TTT 并冻结目标语义 | ✅ | 明确禁止 `source=echo` 包裹与“上一轮Trinity综合输出：”前缀注入 |
| 2026-03-03 | 完成 Phase 1 协议冻结 | ✅ | 新增协议文档，固化历史条目模型、写入矩阵、冷/热启动边界、状态机与示例轮次 |
| 2026-03-03 | Phase 3 主路径切换（核心） | ✅ | 三贤人改为冷启动一次注入，常规轮次走真实历史栈；不再每轮 `overrideMessages` 覆盖 |
| 2026-03-03 | Phase 4 注入语义修正（核心） | ✅ | 命中 `melchiorUsedToolCall=false` 且来源为 Trinity 综合输出时，用 Trinity 原文覆盖三贤人最近 assistant 历史 |
