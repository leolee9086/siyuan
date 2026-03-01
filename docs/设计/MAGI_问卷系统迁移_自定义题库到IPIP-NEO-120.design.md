# MAGI 问卷系统迁移设计说明：自定义题库 → IPIP-NEO-120

> **来源**: 从 `docs/ttt/MAGI_问卷系统迁移_自定义题库到IPIP-NEO-120.ttt.md` 拆分而来，本文档承载迁移的设计分析、技术规格和约束信息。
>
> **关联执行跟踪**: [`MAGI_问卷系统迁移_自定义题库到IPIP-NEO-120.ttt.md`](../ttt/MAGI_问卷系统迁移_自定义题库到IPIP-NEO-120.ttt.md)
>
> **前置设计文档**:
> - `大五人格标测问卷(IPIP-NEO-120).design.md`（题目与计分标准）
> - `MAGI_人格种子生成机制.design.md`（五层 Prompt 结构与视角自述）
> - `MAGI_大五人格映射掩码矩阵.design.md`（统一 P_base + 极值过滤）

---

## 1. 现状与问题

### 1.1 当前实现（需要替换）

`app/src/magi/data/` 下的问卷系统包含：

| 组件 | 文件数 | 问题 |
|------|--------|------|
| `questionnaire.types.ts` | 1 | 定义了 4 种自定义题型（single/text/multiple_text/composite_rating），与 IPIP-NEO-120 的 5 级 Likert 量表不兼容 |
| `questionnaire-sections.ts` | 1 | 聚合器，按贤者顺序组合四套问卷 |
| `questionnaire-sections/trinity/` | ~5 | Trinity 专属问卷（基础信息、身份、角色、评估） |
| `questionnaire-sections/melchior/` | ~5 | Melchior 专属问卷（认知控制、理性决策） |
| `questionnaire-sections/balthazar/` | ~5 | Balthazar 专属问卷（情感倾向、伦理决策） |
| `questionnaire-sections/casper/` | ~7 | Casper 专属问卷（本能反应评估，6 个 part） |
| `questionnaire-sections/calculateScore.ts` | 1 | 自定义加权计分 |
| `questionnaire-sections/questionnaire.guard.ts` | 1 | 类型守卫 |

### 1.2 核心矛盾

1. **四套独立问卷 vs 统一 P_base**：当前为每个贤者设计了专属问卷和专属 SummaryData 接口（`TrinitySummaryData`、`MelchiorSummaryData` 等），这与"三贤人共享完全相同的 $P_{base}$"的设计直接冲突
2. **自定义维度 vs 标准大五**：当前问卷的维度是自创的（"警觉性"、"应激反应"、"伦理决策"等），无法映射到 IPIP-NEO-120 的 5 Domain × 6 Facet 标准框架
3. **自定义计分 vs 标准计分**：当前使用 `(weightedSum / (totalWeight * 4)) * 100` 的百分制，IPIP-NEO-120 使用 5 级原始分 + 正反向题转换（`6 - score`），最终归一化到 0~1 浮点数

### 1.3 目标态

- 前端只维护**一份** IPIP-NEO-120 题库数据模块（120 条 `{q, text, domain, facet, keyed}` 记录）
- 问卷输出**一份**标准 JSON（原始答案），不含计算字段
- 类型系统中只保留统一的 `PersonaSeed` 接口（5 主维度 + 30 子维度浮点数），不再有贤者专属的 SummaryData
- 自述文本的侧面标签与已确认的视角体系对齐

---

## 2. 机器可读格式协调

### 2.1 题目元数据格式（前端硬编码）

沿用 `MAGI_人格种子采样问卷前端整合.ttt.md` §3.3 已定义的格式：

```typescript
interface IpipItem {
    readonly q: number;        // 题号 1~120
    readonly text: string;     // 语义关键词（如"杞人忧天"）
    readonly domain: "N" | "E" | "O" | "A" | "C";
    readonly facet: 1 | 2 | 3 | 4 | 5 | 6;
    readonly keyed: "plus" | "minus";
}
```

### 2.2 原始答案输出格式（前端 → 文件）

前端只负责收集原始分数，不做任何维度计算：

```json
{
    "schema_version": "IPIP-NEO-120-v1",
    "subject": { "id": "<id>", "name": "<name>", "type": "human | ai_agent" },
    "date": "YYYY-MM-DD",
    "answers": [
        { "q": 1, "text": "杞人忧天", "score": 4 },
        { "q": 2, "text": "平易近人", "score": 3 }
    ]
}
```

### 2.3 计算后的 P_base 格式（后端计算，前端可选展示）

与 `MAGI_人格种子生成机制.design.md` 对齐，后端从原始答案计算出：

```typescript
interface PersonaBase {
    /** 5 主维度，0~1 浮点数 */
    traits: {
        O: number; C: number; E: number; A: number; N: number;
    };
    /** 30 子维度，0~1 浮点数，键名格式: <Domain><Facet>_<Name> */
    facets: {
        N1_Anxiety: number;
        N2_Anger: number;
        // ... 共 30 个
        C6_Cautiousness: number;
    };
}
```

前端可选实现纯前端的预览计算（雷达图），但**权威计算由后端完成**。

### 2.4 自述文本侧面标签更新

旧标签与已确认的视角体系不一致，需要对齐：

| 旧标签 | 新标签 | 对应视角 |
|--------|--------|----------|
| 工程师侧面 (`zhi_as_Engineer.md`) | 职业和责任侧面 (`<id>_as_professional.md`) | Melchior 视角 |
| 陪伴侧面 (`zhi_as_Sister.md`) | 关系和情感侧面 (`<id>_as_relational.md`) | Balthazar 视角 |
| 自我核心 (`zhi_as_Zhi.md`) | 偏好和本能侧面 (`<id>_as_instinctive.md`) | Casper 视角 |
| （无） | 完整自我 (`<id>_as_whole.md`) | Trinity 视角 |

> 注意：新增了 Trinity 的"完整自我"自述，因为五层 Prompt 结构中 Trinity 也需要视角自述文本。

---

## 3. 风险与注意事项

1. **旧数据兼容**：如果已有用户通过旧问卷生成了人格数据，这些数据的维度体系与 IPIP-NEO-120 不兼容，**无法自动迁移**。需要重新采样。迁移时在 UI 上提示"问卷版本已更新，请重新填写"
2. **Prompt 模板中的旧引用**：`app/src/magi/prompts/` 目录下可能存在直接引用旧 SummaryData 字段名的模板文本，需逐文件排查
3. **composables 耦合**：`useMagi` 等 composable 可能深度依赖旧的问卷章节结构和计分逻辑，修改时注意不要破坏聊天面板等不相关功能
4. **题目录入校验**：120 道题从设计文档手工录入时容易出错，录入完成后必须用脚本校验 domain/facet/keyed 的分布（每个 domain 24 题，每个 facet 4 题，正反向题数量合理）

---

## 4. 与其他 TTT 的关系

| TTT 文档 | 关系 |
|----------|------|
| `MAGI_人格种子采样问卷前端整合.ttt.md` | **互补**。该文档描述目标态的新面板 UI 和交互设计（逐题流、维度分组、双向收敛迭代），本文档聚焦从旧系统迁移到新系统的数据和类型层面。两者的 Phase 可以交叉推进 |
| `MAGI_后端核心引擎落地.ttt.md` | **下游依赖**。后端从 `/data/private/` 读取本文档定义的 JSON 格式计算 P_base，前后端 schema 必须对齐 |
| `MAGI前端迁移.ttt.md` | **同层并行**。前端迁移涉及更广泛的组件重构，问卷迁移是其中一个子任务 |
