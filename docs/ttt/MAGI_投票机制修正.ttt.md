# MAGI 投票机制修正 执行跟踪 (TikTocTak)

> **目标**: 将 `magiConsensus.ts` 中错误实现的"评分排名"投票机制修正为 `MAGI认知架构.design.md` 中设计的"三方二元表决"机制，并正确区分普通模式（统合、不投票）与重要任务模式（显式投票），同时修正 Trinity 的输入格式为内心独白形式。
>
> **流程**: 这是一个滚动更新的执行路线图。
> 1. 从"近期计划"中认领一个任务。
> 2. 完成开发和测试。
> 3. 将其移动到"已归档/已完成"区域。
> 4. 将"中期计划"中的条目提升到"近期计划"。
>
> **关联 ttt**:
> - [MAGI_输入栏迁移修复.ttt.md](./MAGI_输入栏迁移修复.ttt.md) — ⚠️ 该 ttt 的 T2.2 调用了本 ttt 将要重写的共识/投票函数，Phase 3 完成后需回去适配 T2.2 Step B

---

## 问题描述

`magiConsensus.ts` 的投票实现与 [`MAGI认知架构.design.md`](../设计/MAGI认知架构.design.md) 的设计存在四重偏差：

### 偏差1: 投票语义错误——评分排名 vs 二元表决

| 维度 | 设计文档 | 当前实现 |
|------|----------|----------|
| **投什么** | 对一个拟议行动投"批准/否决" | 对多个响应投数值评分 |
| **目的** | 门控：决定做不做 | 排名：决定选哪个 |
| **结果** | 通过/否决 + 反刍循环 | 加权得分最高者胜出 |
| **概念模型** | 议会三方表决（≥2/3通过） | 评委打分竞选 |

设计中的 `VoteResult`：
```go
type VoteResult struct {
    Melchior  string  // "批准" | "否决"
    Balthazar string  // "批准" | "否决"
    Casper    string  // "批准" | "否决"
    Passed    bool
    Round     int     // 反刍轮次
}
```

当前实现的 `VoteResult`（`messageFactory.types.ts`）：
```typescript
interface VoteResult {
    scores?: Array<{ score: number; comment?: string }>;
    conclusion: string;
}
```

> **注**: 设计文档原文在普通模式中使用了"Selection（选择）"一词，经确认这是用词不当——Trinity 在普通模式下的工作是**统合**（将三方视角融合为统一的自我判断），而不是从中选一个。设计文档已同步修正。

### 偏差2: 投票时机错误——每次必投 vs 按需触发

| 维度 | 设计文档 | 当前实现 |
|------|----------|----------|
| **何时投** | 仅 Melchior 标注 `requires_deliberation: true` 时 | 每次对话都投 |
| **普通模式** | 不进行显式投票，Trinity 统合三方视角形成自我判断 | 无此模式 |
| **触发条件** | Critical Decision Mode | 写死了无条件触发 |

### 偏差3: 投票角色错误——维度表决 vs 互评打分

设计中三贤人各自代表一个**决策维度**投一票：
- Melchior → 理性维度（逻辑与风险评估）
- Balthazar → 感性维度（情感影响与伦理直觉）
- Casper → 本能维度（整体直觉与当下感受）

当前实现中贤人对**其他贤人的回答打分**，是一种交叉互评。

### 偏差4: Trinity 输入格式缺失——统合 vs 总结

设计中 Trinity 看到的内容应该以**内心独白**形式组织，暗示这是"我"的内部思绪：

```
[外界输入]
哥哥说：xxx

[理性面]
基于逻辑与事实，我认为：（Melchior 产出）

[感性面]
基于情感与直觉，我认为：（Balthazar 产出）

[本能面]
本能告诉我：（Casper 产出）
```

当前实现中 Trinity 收到的是普通的 `validResponses` 数组，prompt 层面把它当作需要"总结"的外部文本，而非自己的内在声音。

### 涉及文件

| 文件 | 现状 | 需修正 |
|------|------|--------|
| `app/src/magi/composables/magiConsensus.ts` | 错误的评分排名投票、无条件触发 | 重写为二元表决 + 按需触发 + 统合逻辑 |
| `app/src/magi/utils/messageFactory.types.ts` | VoteResult 为评分结构 | 重写为表决结构 |
| `app/src/magi/core/wise/mockWise.ops.ts` | 随机评分模拟 | 重写为随机二元表决模拟 |
| `app/src/magi/composables/magiConsensus.guard.ts` | 类型守卫 | 适配新结构 |
| `app/src/magi/core/wise/promptTemplates/` | Trinity prompt 把三贤人产出当外部文本 | 改为内心独白格式 |

---

## 核心原则

1. **忠于设计文档**: `MAGI认知架构.design.md` 是唯一的设计权威，实现必须对齐
2. **普通模式不投票**: 大部分对话走 Standard Synthesis，Trinity 统合三方视角而非选择
3. **三方二元表决**: 投票时每个贤人投"批准"or"否决"，≥2/3通过
4. **反刍循环**: 否决后 Trinity 进入反刍状态，生成新自述再次表决
5. **内心独白格式**: Trinity 的输入以暗示而非要求的方式组织，暗示这是"我"的内部思绪
6. **向前兼容**: 当前前端处于 Mock 阶段，修正应面向未来后端对接

### 验证清单

- [x] `VoteResult` 结构包含三贤人各自的"批准/否决"和 `passed` / `round`
- [x] 普通模式不调用投票流程，Trinity 执行统合而非选择
- [x] Trinity 的输入以内心独白形式组织，暗示而非要求
- [x] Critical Decision 模式触发三方表决
- [x] 否决时有反刍循环入口（至少预留接口）
- [x] Mock 投票产出符合新 VoteResult 结构
- [x] 现有消息流和共识生成逻辑适配新结构

---

## ℹ️ 如何维护此文档

1. **完成归档**：任务完成后，**必须**剪切粘贴到【已归档】列表，并打上 `[x]` 和日期。
2. **补充弹药**：当【近期计划】空了，从【中期计划】里挑选任务挪上去。
3. **因地制宜**：如果发现计划不合理，随时修改或删除。
4. **数据驱动**：用数据说话，不凭感觉。

---

## 🟢 近期计划

- [x] **Phase 1: VoteResult 类型重构 (P0)**
  - **背景**: 当前 VoteResult 是评分数组结构，与设计中的三方表决结构完全不同
  - **行动**:
    1. 重写 `messageFactory.types.ts` 中的 `VoteResult` 为三方表决结构（`melchior: "批准"|"否决"`, `balthazar`, `casper`, `passed: bool`, `round: number`）
    2. 更新 `ConsensusMessage.meta` 移除 `weights`/`details`，改为 `vote: VoteResult`
    3. 更新 `magiConsensus.guard.ts` 中的类型守卫
  - **验收标准**: 新 VoteResult 类型定义与设计文档 §1 的 Go 结构体语义对齐；`tsc --noEmit` 无新增类型错误
  - **参考文档**: [`MAGI认知架构.design.md` §1](../设计/MAGI认知架构.design.md)

- [x] **Phase 2: Mock 投票适配 (P0)**
  - **背景**: `mockWise.ops.ts` 中的 `执行投票操作` 产出随机评分，需改为随机二元表决
  - **行动**:
    1. 重写 `执行投票操作` 返回 `{ melchior, balthazar, casper, passed, round }` 结构
    2. 随机生成"批准/否决"，按 ≥2/3 规则计算 passed
    3. 移除评语库（MELCHIOR评语列表等）和 `生成投票条目` 等函数
    4. 更新 `wise.types.ts` 中的 `VoteForResult` 类型
  - **验收标准**: Mock 投票产出符合新 VoteResult 结构；lint 通过
  - **参考文档**: [`mockWise.ops.ts`](../../app/src/magi/core/wise/mockWise.ops.ts)

- [x] **Phase 3: 共识流程与Trinity统合重构 (P1)**
  - **背景**: `magiConsensus.ts` 中的 `processVoting` 和 `generateConsensusReply` 基于评分排名逻辑；`handleTrinitySummary` 把三贤人产出当外部文本让 Trinity "总结"，而非统合
  - **行动**:
    1. 修改 Trinity 的输入组织：将三贤人产出以内心独白格式注入 Trinity 上下文（`[理性面] 作为织的理性面...`、`[感性面] ...`、`[本能面] 本能告诉我...`），暗示这是"我"的内部思绪而非需要总结的文本
    2. 引入 Decision Mode 判断：增加 `需要审慎决策(responses)` 函数（当前 Mock 阶段可始终返回 true 以便调试，后续由 Melchior 的 `requires_deliberation` 标注驱动）
    3. 重写 `processVoting`：不再逐个贤人对所有响应打分，而是三贤人各投一票"批准/否决"
    4. 重写 `generateConsensusReply`：移除加权排序逻辑，改为 `passed ? Trinity统合结果 : 反刍入口`
    5. 预留反刍循环接口 `startRuminationLoop`（当前可为存根）
    6. ⚠️ **协调步骤**: 完成后回到 [MAGI_输入栏迁移修复.ttt.md](./MAGI_输入栏迁移修复.ttt.md) T2.2 Step B，将 `sendUserMessage` 中的共识集成代码适配新的三方二元表决接口
  - **验收标准**: Trinity 收到的 prompt 以内心独白形式组织；普通模式跳过投票（预留）；Critical Decision 模式走三方表决；共识结果包含表决详情；lint 通过；输入栏迁移 T2.2 的集成代码已适配新接口
  - **参考文档**: [`MAGI认知架构.design.md` §4.3](../设计/MAGI认知架构.design.md)

- [x] **Phase 4: lint 与类型检查 (P1)**
  - **背景**: 重构涉及多文件类型变更，需确保全链路类型安全
  - **行动**:
    1. `tsc --noEmit` 检查无新增错误
    2. `pnpm run lint:file` 对所有修改文件逐一检查
    3. 修复发现的问题
  - **验收标准**: 所有修改文件 lint 通过；`tsc --noEmit` 无新增错误（当前受既有 TS2688 阻断）

---

## 🟡 中期计划

- [ ] **Phase 6: 反刍循环实现 (P2)**
  - **背景**: 设计中否决后 Trinity 进入反刍循环，当前仅预留接口
  - **行动**: 实现 `startRuminationLoop`：Trinity 生成新自述 → 广播给三贤人 → 重新表决 → 循环直至通过或放弃

---

## 🏁 已归档/已完成

- [x] 2026-03-02 Phase 1: VoteResult 类型重构（`messageFactory.types.ts`、`core.types.ts`、`magiConsensus.guard.ts` 已完成结构迁移）
- [x] 2026-03-02 Phase 2: Mock 投票适配（`mockWise.ops.ts`、`mockWise.ts`、`wise.types.ts` 已改为三方二元表决结构）
- [x] 2026-03-02 Phase 3: 共识流程与 Trinity 统合重构（`magiConsensus.ts`、`mockWise.subclass.ts`、`useMagi` 共识链路已适配）
- [x] 2026-03-02 Phase 4: lint 与类型检查（修改文件 `lint:file` 全通过；`tsc --noEmit` 仍受项目既有 TS2688 阻断）
- [x] 2026-03-02 Phase 5: 投票触发条件落地（`magiConsensus.ts` 改为解析 Melchior `requires_deliberation` 标注触发；`promptTemplates/Melchior.ts` 增加元标记输出协议；普通模式默认走 Standard Synthesis）

---

## 执行记录

| 日期 | 任务 | 状态 | 备注 |
|------|------|------|------|
| 2026-03-02 | 创建 ttt | ✅ | 发现 magiConsensus.ts 投票实现与设计文档存在四重偏差（语义/时机/角色/输入格式） |
| 2026-03-02 | 修正设计文档 | ✅ | 修正 MAGI认知架构.design.md §4.3：Selection→Synthesis，补充Trinity输入格式说明 |
| 2026-03-02 | Phase 1-4 执行完成 | ✅ | 完成二元表决重构、Trinity内心独白输入、sendUserMessage Step B 适配；`lint:file` 通过，`tsc --noEmit` 受既有 TS2688 阻断 |
| 2026-03-02 | Phase 5 执行完成 | ✅ | 增加 Melchior 审慎标注协议与解析逻辑，移除关键词启发式触发，投票仅由 `requires_deliberation` 驱动 |
