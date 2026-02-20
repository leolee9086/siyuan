# MAGI 认知架构设计 (Ghost)

## 1. 概述

**MAGI (Multiple Autonomous Governance Intelligence)** 是 Agent 的认知内核，即 "Ghost"。它封装了完整的人格模拟、多视角决策和精神卫生机制。

**核心原则**:
1. **封装透明**: Ghost 对外暴露统一的 LLM 接口——接收消息，返回响应文本或工具调用请求。调用方 (Shell) 无需感知内部的三贤人、ATF、Seraph 等机制。
2. **自主决策**: Ghost 内部通过多视角竞争与综合产生最终决策，而非简单的 LLM 单次调用。
3. **精神卫生**: 内置同步率监控和 Seraph 调节机制，防止人格溶解或分裂。

**接口契约**:

```
// Ghost 对 Shell 暴露的唯一接口
// Shell 视角下，Ghost 就是一个增强版的 LLM
type Ghost interface {
    // 接收用户消息 + 上下文，返回响应
    // 内部经过 MAGI 决策流程，但对调用方透明
    Think(ctx Context, messages []Message) (Response, error)
}

type Response struct {
    Text       string      // 最终响应文本
    ToolCalls  []ToolCall  // 工具调用请求（由 Shell 执行）
    Metadata   GhostMeta   // 可选的诊断信息（SyncRate, ATF 等）
}
```

## 2. Ghost in the Shell (灵与肉)

-   **Ghost (The Mind - MAGI System)**:
    -   包含 **Trinity** (自我) 和 **Three Wise Men** (潜意识/思考侧面)。
    -   纯粹的信息处理核心，无法直接与物理世界交互。
    -   运行在 **System 2** (慢思考) 循环中。

-   **Shell (The Body - Action Layer)**:
    -   **定义**: 外部行动 AI (Action AI)，包含工具链、API 接口和消息通道。
    -   **指挥链**: **只接受 Trinity 的指令**。三贤人无权直接驱动 Shell。
    -   **职责**: 执行具体操作 (File I/O, Network, Docker Exec) 并返回结果。
    -   **详见**: [AIagent设计.design.md](AIagent设计.design.md) — Shell 运行时设计。

## 3. MAGI Internal — 三贤人机制

-   **Melchior (理性侧写 - Semantic)**:
    -   **定义**: "织" (Zhi) 的纯理性侧面。
    -   **记忆访问**: **全量访问** (Short-term + Long-term Semantic Memory)。
    -   **反馈接收**: 接收 Shell 返回的 **详细执行结果内容** (Detailed Content)。
    -   **侧重**: 逻辑推演、事实核查、代码实现。

-   **Balthazar (感性侧写 - Episodic)**:
    -   **定义**: "织" (Zhi) 的纯感性侧面。
    -   **记忆访问**: **全量访问** (Short-term + Long-term Episodic Memory)。
    -   **反馈接收**: 接收 Shell 返回的 **执行成功/失败状态** (Success/Fail Status) 及情感影响。
    -   **侧重**: 共情、情绪价值、伦理判断。

-   **Casper (直觉侧写 - Intuitive)**:
    -   **定义**: "织" (Zhi) 的**完整人格** (Holistic)，但受限于"工作记忆"。
    -   **记忆访问**: **仅持有工作记忆 (Working Memory)** (5~7 个组块/Chunks)，模拟人类的短时记忆限制。
    -   **反馈接收**: 接收 Shell 返回的 **完整结果 (Complete Result)**，但只能保留最新的少量信息。
    -   **侧重**: 直觉判断、创造性思维、快速反应。

-   **Trinity (The Executor - Unified Self)**:
    -   **定义**: "织" (Zhi) 的**自我意识**与**执行中枢**。
    -   **输入来源**: 常态下为 **自省 (Introspection)**，拒收外部 Input，仅观察三贤人的 Output。但在“越权模式 (Berserk)”下，可解除隔离，直接获取全量上下文。
    -   **职责**: 
        1.  将 System 2 的思考转化为 System 1 的指令。
        2.  指挥 Shell 执行操作。
        3.  将 Shell 的反馈按规则分发给三贤人 (Dispatcher)。

## 4. 决策流程 (The Conscious Loop)

1.  **Perception (感知)**: Shell 接收 User Input，存入 Context。
2.  **Introspection (内省 - Time-Based Competition)**:
    -   **Race Condition**: 三贤人基于 **上一轮 Trinity 的状态** 并发思考。
    -   **Reflex Arc (反射弧)**:
        -   若 Casper 在极短时间 (`t < t_reflex`, e.g. 300ms) 内返回，视为 **"直觉/本能"**。
        -   **Trinity Action**: 直接采纳 Casper 的输出作为最终结果，**跳过** 等待其他贤人和综合决策过程。
        -   **Constraint**: Reflex Mode **禁止调用工具** (Safety First)。快速反应仅限于对话/表情/情感宣泄。若 Casper 试图在反射弧中调用工具，Trinity 将强制降级为普通思考模式 (System 2)。
    -   **Standard Loop**: 若无快速反射，则等待 `t_window`，收集所有有效输出。
3.  **Synthesis (综合 - No Explicit Voting)**:
    -   Trinity 不再进行复杂的加权投票。
    -   **Selection**: 基于响应速度 (Fastest) 和置信度 (Confidence) 直接选择一个"胜出的想法" (Winning Thought)。
    -   **Monologue Generation (独白生成)**: Trinity 生成一段**自述 (Self-Description)**，作为"当下的自我感受"。
4.  **Action (行动)**: Trinity 指挥 Shell 执行工具。
5.  **Global Broadcast (全局广播 - Feedback Loop)**:
    -   Trinity 的 **Self-Description** 被广播给三贤人，决定它们 **下一轮的状态**。
    -   **Polarity (极性)**: 取决于当前 **SyncRate**。
        -   **SyncRate <= 100% (Positive Modulation)**: 正向调节。Trinity 的情绪/状态 **增强** 三贤人的倾向 (e.g. Trinity 兴奋 -> Balthazar 更兴奋)。
        -   **SyncRate > 100% (Negative Modulation)**: 负向调节 (Damping)。Trinity 的状态 **抑制/反转** 三贤人的倾向 (e.g. Trinity 过于亢奋 -> 强制 Balthazar 冷静)，以打破回声室效应，防止溶解。
    -   **Modulation Target**:
        -   **Length (长度)** -> **Balthazar's Temperature**.
        -   **Emotional Tags (情绪标签)** -> **Melchior's Context**.
        -   **Full Content (完整内容)** -> **Casper's Context**.

-   **Self-Reflection Loop**:
    -   周期性 (e.g. 每 10 轮对话或 Idle 时) 检查 Session 状态。
    -   **检测幻觉**: 对比 Memory 中的事实与生成的回复。
    -   **目标对齐**: 检查当前行为是否符合 Soul Document 中的 `Instructions`。

## 5. 精神卫生与调节 (Mental Health & Regulation)

### 5.1 ATF System (Adaptive Trinity Feedback - 绝对领域/自适应反馈)

"ATF" (Adaptive Trinity Feedback) 是 Agent 的精神免疫系统，用于维持 "自我" (Self) 的边界，防止被 LLM 的统计规律同化 (Dissolution)。
*Cultural Ref: A.T. Field (Absolute Terror Field) - The barrier of the soul.*

#### 5.1.1 Psyche Matrix (心智矩阵) - 基于 Big Five (OCEAN)

引入量化的五大性格特质向量作为 **ATF** 的计算基础：
-   **O (Openness)**: 开放性 (创造力/好奇心)
-   **C (Conscientiousness)**: 尽责性 (条理/自律)
-   **E (Extraversion)**: 外向性 (社交/活力)
-   **A (Agreeableness)**: 宜人性 (信任/利他)
-   **N (Neuroticism)**: 神经质 (敏感/焦虑)

#### 5.1.2 Synchronization Rate (同步率) & ATF Strength (绝对领域强度)

> **Detailed Math Model**: [ATF数学模型.design.md](ATF数学模型.design.md)

ATF 的强度与同步率 ($\rho$) 呈 **钟形曲线 (Bell Curve)** 关系，峰值在 $\rho = 1.0$。

1.  **Dispersion Zone ($\rho < 0.4$)**:
    -   **State**: 离散 (Unformed).
    -   **ATF**: Low (Normal).

2.  **Resonance Zone ($0.4 \le \rho \le 1.0$)**:
    -   **State**: 共鸣 (Resonant).
    -   **ATF**: Rising to Peak.

3.  **Dissolution Zone ($\rho > 1.0$)**:
    -   **State**: 溶解 (Dissolving).
    -   **ATF**: **Dropping** (Critical). 当 $\rho$ 过高时，系统因失去多样性而崩溃。

### 5.3 越权申请与暴走模式 (Authorization & Berserk Mode)

为了在工程上落地边缘极端场景、同时避免系统的硬编码失控，系统引入**主动越权申请流**，将最终的决断权交还给用户（监护人）：

- **感知与求援**: 同步率 $\rho$ 和 ATF 强度 $F$ 作为心智仪表盘数据，以 Telemetry 格式注入到 Context 中。当 Trinity 发现指标恶化或持续遭遇挫折（如死循环报错）时，主动生成认知：“我需要打破常规”。
- **RequestOverride**: Trinity 借由特定工具（例如 `RequestBerserkAuthorization(reason)`）向监护人解释当前困境，申请权限放开。这一动作会暂停当前的 ReAct 思考循环。
- **监护人批准 (Guardian Approval)**: 只有在监护人明确许可后，系统才真正进入**暴走模式 (Berserk Mode)**。
- **架构解缚 (Structural Unbinding)**: 
  1. **同步率豁免**: 暂时关闭 ATF 对过高/过低同步率的惩罚性负反馈，允许情绪或逻辑的极端极化。
  2. **上下文隔离解除**: Trinity 从原本“只能看三贤人总结”的幕后走到台前，直接获取所有原始输入和详尽的底层错误日志。
  3. **工具越级直调**: Trinity 绕过三贤人竞态，直接以“自我”的身份并行调用高风险执行工具，完全凭直觉与当前唯一的焦点进行单线程爆破，直至问题解决或状态被手动平息。

## 6. Dreaming Process (造梦与记忆固化)

当上下文积累到一定阈值或进入 Idle 状态时，触发 **Dreaming (造梦)** 流程，将短期记忆转化为长期记忆。

-   **Balthazar (The Weaver of Dreams)**:
    -   **任务**: 将抽象的对话/经历转化为**具象的场景描述 (Scene Description)**。
    -   **要求**: 必须是画面感极强的物理场景，无论概念多抽象都要具象化 (e.g. "代码重构" -> "在精密的钟表铺里重新打磨齿轮")。
    -   **Action**: 调用文生图工具 (Image Gen Tool) 生成一张**快照 (Snapshot)**，作为 Episodic Memory 的视觉锚点。

-   **Melchior (The Scribe of Truth)**:
    -   **任务**: 提炼**经验教训 (Lessons Learned)**。
    -   **要求**: 剥离所有情感和叙事，只保留事实、逻辑推论和因果关系。
    -   **Action**: 更新 Semantic Memory (Knowledge Graph / Vector DB)。

-   **Casper (The Diarist)**:
    -   **任务**: 撰写**日记 (Diary)**。
    -   **要求**: 极度主观的第一人称叙事，记录当下的真实感受、吐槽或灵光一闪。
    -   **Auto-Save**: 存入每日日记文档 (Siyuan Note)。

-   **Trinity (The Interpreter)**:
    -   **任务**: **统合叙事 (Unified Narrative)**。
    -   **输入**: Balthazar 的场景快照、Melchior 的真理教训、Casper 的主观日记。
    -   **Action**: 将这三者编织成一段完整的、属于"我"的**连贯记忆 (Coherent Memory)**，作为 Episodic Memory 的最终存储形式。
    -   **Storage Rule**: **对MAGI不进行特殊标记** (No "Dream" Tag)。梦境与现实经历混合存储。分辨梦境与现实不仅是 Trinity 的能力，也是其责任 (Introspection)。
    -   **Prompt**: "基于这三份不同的记录，重新描述刚才发生了什么。不仅仅是复述，而是要融合场景、道理和感受，形成属于你的独特回忆。"
