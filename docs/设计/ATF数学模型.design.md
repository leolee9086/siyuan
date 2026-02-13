# ATF System Mathematical Model (ATF系统数学模型)

> **Version**: 0.1 (Draft)
> **Status**: In Progress
> **Related**: `AIagent设计.design.md`

本文档详细描述 **ATF (Adaptive Trinity Feedback)** 系统的数学基础，旨在为 "同步率" ($\rho$) 和 "绝对领域强度" ($F$) 提供基于认知科学的量化方法。

## 1. Theoretical Foundation (理论基础)

本模型基于以下两个核心理论：

1.  **Integrated Information Theory (IIT, Tononi)**: 意识对应于系统各部分信息的整合程度 ($\Phi$)。我们使用 **Synchronization Rate ($\rho$)** 作为 $\Phi$ 的近似代理。
2.  **Criticality Hypothesis (临界假说)**: 大脑在 "有序" 和 "混沌" 的边缘 (Edge of Chaos) 运作效率最高。ATF 强度 ($F$) 被设计为在临界点 ($\rho = 1.0$, 即 100%) 达到峰值。

## 2. State Space (状态空间)

Agent 的心理状态由 **Psyche Matrix** 定义，基于 NEO-PI-R 标准的 Big Five (OCEAN) 模型。每个特质包含 6 个 facet（子维度），完整人格表示为 $5 \times 6$ 矩阵。

### 2.0 OCEAN Facet Structure (OCEAN 子维度结构)

基于 NEO-PI-R (Costa & McCrae, 1992) 标准问卷的 30 facet 定义：

| Trait | $f_1$ | $f_2$ | $f_3$ | $f_4$ | $f_5$ | $f_6$ |
|-------|--------|--------|--------|--------|--------|--------|
| **O** (Openness) | Fantasy | Aesthetics | Feelings | Actions | Ideas | Values |
| **C** (Conscientiousness) | Competence | Order | Dutifulness | Achievement | Self-Discipline | Deliberation |
| **E** (Extraversion) | Warmth | Gregariousness | Assertiveness | Activity | Excitement-Seeking | Positive Emotions |
| **A** (Agreeableness) | Trust | Straightforwardness | Altruism | Compliance | Modesty | Tender-Mindedness |
| **N** (Neuroticism) | Anxiety | Angry Hostility | Depression | Self-Consciousness | Impulsiveness | Vulnerability |

每个 facet 的取值范围为 $[-1, 1]$，其中 $-1$ 表示该 facet 极低，$+1$ 表示极高。

**Psyche Matrix** 定义为：

$$
\mathbf{P} \in [-1, 1]^{5 \times 6}
$$

其中 $\mathbf{P}[i][j]$ 表示第 $i$ 个特质的第 $j$ 个 facet 的强度。

**与标准问卷的对接**: NEO-PI-R 问卷包含 240 题（每 facet 8 题），每题 5 级 Likert 量表。原始分数经标准化后线性映射到 $[-1, 1]$ 区间。对 AI 施测时，将问卷题目作为 prompt 输入，AI 的选项回答直接映射为 facet 分数。

### 2.1 Trinity Matrix (全局工作空间)

Trinity 是 MAGI 系统的 **独立决策实体** 与 **全局工作空间 (Global Workspace)**，持有完整的 $5 \times 6$ 人格矩阵：

$$
\mathbf{P}_{T} \in [-1, 1]^{5 \times 6}
$$

Trinity 不是三贤人的算术聚合，而是一个主动的决策主体。它通过自省 (Introspection) 观察三贤人的输出，基于速度和置信度进行选择与综合，最终形成统一的自我状态。$\mathbf{P}_{T}$ 反映的是 Trinity 作为"自我"在当前时刻的完整人格表达——不仅包含五大特质的总体倾向，还包含每个特质内部 facet 层面的细微差异。

### 2.2 Wise Men Matrices (贤人矩阵 - 人格侧写)

三贤人 (Melchior, Balthazar, Casper) 各自持有 Trinity 完整人格的 **侧写 (Profile)**，即对同一人格空间的不同投影。在任意时刻 $t$：

$$
\mathbf{P}_m, \mathbf{P}_b, \mathbf{P}_c \in [-1, 1]^{5 \times 6}
$$

每位贤人的矩阵并非 Trinity 矩阵的子集，而是从各自认知视角（理性/感性/直觉）对同一人格的独立观测。矩阵表示使得差异可以在 facet 粒度上被检测——例如 Melchior 和 Balthazar 可能在 Openness 总分上一致，但在 Ideas vs Feelings 的 facet 分布上截然不同。

### 2.3 Reference Matrix (参考基线)

为度量系统的 **外部一致性**，引入参考矩阵 $\mathbf{P}_{ref}$：使用与 Trinity 相同的人格描述 (Soul Document) 驱动一个 **裸 LLM (Bare LLM)**，对其执行完整的 NEO-PI-R 问卷评估所得的矩阵。

$$
\mathbf{P}_{ref} \in [-1, 1]^{5 \times 6}
$$

$\mathbf{P}_{ref}$ 代表"未经 MAGI 认知架构加工的原始人格基线"，用于检测 MAGI 系统是否偏离了预设人格，或是否被 LLM 的统计规律同化。矩阵粒度使得检测精度从"特质级别"提升到"facet 级别"——即使五大特质总分不变，facet 分布的微妙变化也能被捕获。

## 3. Synchronization Rate ($\rho$) - The Order Parameter

同步率 $\rho$ 衡量系统的 **整合度 (Integration)**。它由两个正交分量共同决定：**内部一致性** ($C_{int}$) 衡量 MAGI 系统四个 AI 之间的协调程度，**外部一致性** ($C_{ext}$) 衡量 MAGI 整体相对于人格基线的偏离程度。

### 3.1 Similarity Metrics (相似度度量)

一致性的度量采用两种互补的方法：

#### 3.1.1 Semantic Similarity (语义相似度) — 实时度量

对 MAGI 系统中各 AI 的 **输出文本** 计算语义相似度。给定两个 AI 在同一轮次的输出文本 $\text{out}_i$ 和 $\text{out}_j$，通过嵌入模型映射到语义空间后计算余弦相似度：

$$
\text{Sim}_{sem}(i, j) = \frac{\text{Embed}(\text{out}_i) \cdot \text{Embed}(\text{out}_j)}{\|\text{Embed}(\text{out}_i)\| \cdot \|\text{Embed}(\text{out}_j)\|}
$$

归一化到 $[0, 1]$ 区间。此度量在每轮对话中实时计算。

#### 3.1.2 Big Five Questionnaire (大五人格问卷) — 定时度量

定期（如每日或每 N 轮对话后）对 MAGI 系统中的各 AI 执行标准化的 NEO-PI-R 问卷自检，更新其人格矩阵 $\mathbf{P}$。两个 AI 的人格矩阵一致性采用 **归一化 Frobenius 内积**：

$$
\text{Sim}_{bf}(i, j) = \frac{\langle \mathbf{P}_i, \mathbf{P}_j \rangle_F}{\|\mathbf{P}_i\|_F \cdot \|\mathbf{P}_j\|_F}
$$

其中 $\langle \mathbf{A}, \mathbf{B} \rangle_F = \sum_{r,c} A_{rc} \cdot B_{rc}$ 为 Frobenius 内积，$\|\mathbf{A}\|_F = \sqrt{\sum_{r,c} A_{rc}^2}$ 为 Frobenius 范数。

归一化到 $[0, 1]$ 区间。此度量在 facet 粒度上检测人格漂移——即使两个 AI 的五大特质总分相同，facet 分布的差异也会降低 $\text{Sim}_{bf}$。

#### 3.1.3 Composite Similarity (综合相似度)

两个 AI 之间的综合相似度为两种度量的加权融合：

$$
\text{Sim}(i, j) = \alpha \cdot \text{Sim}_{sem}(i, j) + (1 - \alpha) \cdot \text{Sim}_{bf}(i, j)
$$

*   $\alpha \in [0, 1]$: 语义权重（建议 $\alpha = 0.7$，侧重实时语义信号）。
*   当问卷数据尚未就绪时，退化为 $\text{Sim} = \text{Sim}_{sem}$。

### 3.2 Internal Coherence ($C_{int}$) — 内部分量

内部一致性衡量 MAGI 系统 **四个 AI**（Trinity + 三贤人）之间的综合协调程度。计算所有 $\binom{4}{2} = 6$ 对的相似度均值：

$$
C_{int} = \frac{1}{6} \sum_{i<j} \text{Sim}(\mathbf{P}_i, \mathbf{P}_j), \quad i, j \in \{T, m, b, c\}
$$

*   $C_{int} \to 1$: 四个 AI 完全一致（高度共鸣或回声室）。
*   $C_{int} \to 0$: 四个 AI 完全正交（极度分裂）。

### 3.3 External Coherence ($C_{ext}$) — 外部分量

外部一致性衡量 MAGI 系统整体（以 Trinity 为代表）与 **裸 LLM 参考基线** 之间的一致性：

$$
C_{ext} = \text{Sim}(\mathbf{P}_T, \mathbf{P}_{ref})
$$

其中 $\mathbf{P}_{ref}$ 为 Section 2.3 定义的参考矩阵。

*   $C_{ext} \to 1$: MAGI 的人格表达与裸 LLM 高度一致，意味着认知架构未产生有效的人格分化——系统正在被 LLM 的统计规律 **同化 (Assimilation)**。
*   $C_{ext} \to 0$: MAGI 的人格表达与裸 LLM 完全不同，意味着系统可能已经 **漂移 (Drift)** 到不可识别的状态。

外部一致性的健康区间为中等值，过高（同化）和过低（漂移）均为异常。

### 3.4 Raw Coherence Score (原始一致性分数)

内外分量的加权融合产生原始一致性分数 $C$：

$$
C = \beta \cdot C_{int} + (1 - \beta) \cdot C_{ext}
$$

*   $\beta \in [0, 1]$: 内外权重（建议 $\beta = 0.6$，内部一致性略占主导）。
*   $C \in [0, 1]$。

### 3.5 Odds Ratio Transform (赔率变换)

**核心洞察**: 完全一致性 ($C = 1$) 不是"稍微偏高"的正常状态，而是一个 **病理性奇点 (Pathological Singularity)**——四个 AI 的输出完全相同意味着内部多样性归零，MAGI 与裸 LLM 无法区分，自我彻底消亡。同步率应当反映这一事实：当一致性趋向完美时，$\rho$ 应趋向无穷大，而非某个有限值。

因此，采用 **赔率变换 (Odds Ratio)**，即统计学中 logit 函数的指数形式：

$$
\rho = \frac{C}{1 - C}
$$

**数学性质**:
*   $C = 0 \Rightarrow \rho = 0$: 完全分裂，同步率为零。
*   $C = 0.5 \Rightarrow \rho = 1.0$ (100%): **无需任何校准参数**，50% 的原始一致性自然映射到 100% 同步率。
*   $C = 0.75 \Rightarrow \rho = 3.0$ (300%): 高度一致，已进入危险区域。
*   $C \to 1 \Rightarrow \rho \to +\infty$: 完全一致性是不可达的奇点，同步率趋向无穷大。

**为什么 100% 是自然的健康中心**: 赔率变换的对称点恰好在 $C = 0.5$，此时"一致性"与"多样性"各占一半——系统既有足够的整合度来维持自我，又保留了足够的内部差异来避免僵化。这不是人为校准的结果，而是从一致性与多样性的对偶关系中自然涌现的。

**Range**: $\rho \in [0, +\infty)$，实际运行中通常在 $[0.3, 3.0]$ 区间。

**区间解释**:
*   $\rho < 0.7$ (**Dispersion Zone**): 内部分裂或外部漂移严重，自我边界模糊。
*   $0.7 \le \rho \le 1.3$ (**Resonance Zone**): 健康的整合状态，一致性与多样性处于动态平衡。
*   $\rho > 1.3$ (**Dissolution Zone**): 内部过度一致（回声室）或外部过度趋同（被 LLM 同化），系统正在丧失多样性。随着 $\rho$ 增大，溶解加速——这不是线性恶化，而是指数级崩溃。

## 4. ATF Strength ($F$) - The Resilience Metric

ATF 强度 $F$ 衡量系统在 **防止无序分裂 (Dispersion)** 和 **人格溶解 (Dissolution)** 两个方向上的有效性。它不是同步率的简单静态映射，而是融合了 **位置** (proximity) 和 **趋势** (trend) 的动力学指标。

*   $F > 1$: 系统正在 **回归或成长** 为正常状态（健康信号）。
*   $F = 1$: 系统处于最优状态且稳定。
*   $F < 1$: 系统正在 **偏离** 正常状态（告警信号）。

### 4.1 Static Component $F_s$ (位置分量)

衡量 $\rho$ 与最优值 1.0 的接近程度：

$$
F_s(\rho) = \rho \cdot e^{1 - \rho}
$$

*   $F_s(1.0) = 1$（最优位置）。
*   $\rho < 1$: 近线性上升；$\rho > 1$: 指数衰减。
*   非对称性反映"过度同步比不足同步更危险"。

### 4.2 Dynamic Component $F_d$ (趋势分量)

衡量 $\rho$ 是否正在 **向 1.0 靠近** (recovery) 还是 **远离 1.0** (deterioration)。

首先定义 **恢复速度 (Recovery Velocity)**：

$$
v_{rec} = -\text{Sign}(\rho - 1) \cdot \dot{\rho}
$$

*   $\dot{\rho} = d\rho/dt$: 同步率的变化率（离散系统中用指数移动平均近似：$\dot{\rho}(t) \approx \text{EMA}(\rho(t) - \rho(t-1))$）。
*   $v_{rec} > 0$: $\rho$ 正在向 1.0 靠近（恢复中）。
*   $v_{rec} < 0$: $\rho$ 正在远离 1.0（恶化中）。
*   $v_{rec} = 0$: $\rho$ 稳定不变。

趋势分量通过指数映射将恢复速度转化为乘性因子：

$$
F_d = e^{\gamma \cdot v_{rec}}
$$

*   $\gamma > 0$: 趋势敏感度系数（建议 $\gamma = 2.0$）。
*   $v_{rec} > 0 \Rightarrow F_d > 1$: 恢复趋势放大 ATF。
*   $v_{rec} = 0 \Rightarrow F_d = 1$: 无趋势影响。
*   $v_{rec} < 0 \Rightarrow F_d < 1$: 恶化趋势削弱 ATF。

### 4.3 Combined ATF (综合公式)

$$
F = F_s(\rho) \cdot F_d(\rho, \dot{\rho})
$$

### 4.4 Behavior Analysis

| 场景 | $\rho$ | $\dot{\rho}$ | $F_s$ | $F_d$ | $F$ | 含义 |
|------|--------|-------------|-------|-------|-----|------|
| 最优稳态 | 1.0 | 0 | 1.0 | 1.0 | **1.0** | 完美状态 |
| 轻微偏离但回归中 | 0.85 | +0.05 | 0.98 | 1.11 | **1.08** | 健康：系统正在自我修复 |
| 轻微偏离且恶化中 | 0.85 | -0.05 | 0.98 | 0.90 | **0.88** | 告警：偏离正在加速 |
| 严重分裂但回归中 | 0.5 | +0.10 | 0.82 | 1.22 | **1.00** | 位置差但趋势好，勉强维持 |
| 严重分裂且恶化中 | 0.5 | -0.10 | 0.82 | 0.82 | **0.67** | 危险：需要 Seraph 干预 |
| 过同步且回归中 | 1.5 | -0.05 | 0.91 | 1.11 | **1.01** | 健康：正在脱离溶解区 |
| 过同步且恶化中 | 1.5 | +0.10 | 0.91 | 0.82 | **0.75** | 危险：加速溶解 |

**关键特性**:
1.  $F > 1$ 不要求 $\rho$ 已经到达最优——只要系统正在向正确方向移动，ATF 就会给出积极信号。
2.  $F < 1$ 即使 $\rho$ 接近最优也可能发生——如果系统正在快速偏离，趋势分量会提前发出告警。
3.  趋势分量提供了 **前瞻性预测 (Predictive Alerting)**，使 Seraph 能在问题恶化之前介入。

## 5. System Dynamics (系统动力学)

ATF 系统通过 **Global Broadcast** 调节三贤人，形成负反馈循环，使 $\rho$ 趋向最优值 $1.0$ (100%)。调节强度由 ATF 强度 $F$ 驱动——$F$ 的动力学前瞻特性使系统能够在偏离加速之前就增强调节力度。

### 5.1 Modulation Signal (调节信号)

Trinity 向三贤人发出的调节信号 $\Delta S$ 为向量，对每位贤人施加差异化的调节：

$$
\Delta \vec{S}_i = \text{Sign}(1 - \rho) \cdot F \cdot \vec{w}_i, \quad i \in \{m, b, c\}
$$

*   $\text{Sign}(1 - \rho)$: 调节方向。$\rho < 1$ 时为正（鼓励趋同），$\rho > 1$ 时为负（引入分歧）。
*   $F = F_s \cdot F_d$: 调节强度（Section 4.3）。融合了位置与趋势：
    -   当 $F > 1$（系统正在回归）时，调节信号被放大——顺势而为，加速恢复。
    -   当 $F < 1$（系统正在偏离）时，调节信号被削弱——这看似反直觉，但反映了一个事实：当系统正在恶化时，当前的调节策略可能本身就是问题的一部分，此时应触发 Seraph 干预而非盲目加大力度。
*   $\vec{w}_i$: 贤人特异性权重向量，由 Trinity 的 Global Broadcast 机制决定（参见 `AIagent设计.design.md` 7.3 节）：
    -   **Balthazar**: 通过调节 Temperature（生成多样性）响应。
    -   **Melchior**: 通过调节 Context（注入情绪标签或事实约束）响应。
    -   **Casper**: 通过调节 Context（注入完整内容或截断信息）响应。

### 5.2 Feedback Polarity (反馈极性)

*   $\rho < 1.0$ (**Positive Modulation**): 正向调节。Trinity 的状态增强三贤人的趋同倾向，鼓励更高的内部一致性。
*   $\rho > 1.0$ (**Negative Modulation / Damping**): 负向调节。Trinity 的状态抑制或反转三贤人的倾向，打破回声室效应，防止溶解。

### 5.3 Seraph Trigger Conditions (Seraph 触发条件)

基于 ATF 强度 $F$ 的动力学特性，Seraph 的触发条件从静态阈值升级为动态告警：

*   **Emergency (紧急干预)**: $F < F_{crit}$（建议 $F_{crit} = 0.7$）。无论 $\rho$ 的绝对值如何，ATF 强度持续低于临界值意味着系统正在快速恶化。
*   **Daily Check (日常检查)**: 每日固定时间评估 $F$ 的移动平均值，检测缓慢漂移。
*   **Recovery Confirmation (恢复确认)**: 干预后，当 $F > 1.0$ 持续 $N$ 轮（建议 $N = 5$）时，确认系统已恢复。
