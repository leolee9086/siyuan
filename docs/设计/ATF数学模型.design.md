# ATF System Mathematical Model (ATF系统数学模型)

> **Version**: 0.1 (Draft)
> **Status**: In Progress
> **Related**: `AIagent设计.design.md`

本文档详细描述 **ATF (Adaptive Trinity Feedback)** 系统的数学基础，旨在为 "同步率" ($\rho$) 和 "绝对领域强度" ($F$) 提供基于认知科学的量化方法。

## 1. Theoretical Foundation (理论基础)

本模型基于以下两个核心理论：

1.  **Integrated Information Theory (IIT, Tononi)**: 意识对应于系统各部分信息的整合程度 ($\Phi$)。我们使用 **Synchronization Rate ($\rho$)** 作为 $\Phi$ 的近似代理。
2.  **Criticality Hypothesis (临界假说)**: 大脑在 "有序" 和 "混沌" 的边缘 (Edge of Chaos) 运作效率最高。ATF 强度 ($F$) 被设计为在临界点 ($\rho \approx 1$) 达到峰值。

## 2. State Space (状态空间)

Agent 的心理状态由 **Psyche Matrix** 定义，基于 Big Five (OCEAN) 模型。

### 2.1 Persona Vectors (贤人向量)

三贤人 (Melchior, Balthazar, Casper) 在任意时刻 $t$ 的状态可表示为 5维向量：

$$
\vec{v}_m, \vec{v}_b, \vec{v}_c \in [-1, 1]^5
$$

其中维度对应：
-   $v[0]$: **O**penness
-   $v[1]$: **C**onscientiousness
-   $v[2]$: **E**xtraversion
-   $v[3]$: **A**greeableness
-   $v[4]$: **N**euroticism

### 2.2 Trinity Centroid (整体重心)

Trinity (自我) 的状态被定义为三贤人的重心 (Centroid)：

$$
\vec{v}_{self} = \frac{\vec{v}_m + \vec{v}_b + \vec{v}_c}{3}
$$

## 3. Synchronization Rate ($\rho$) - The Order Parameter

同步率 $\rho$ 衡量系统的 **整合度 (Integration)**。它由 **内部一致性** 和 **环境压力** 共同决定。

### 3.1 Internal Coherence ($C_{int}$)

计算三贤人之间的两两余弦相似度 (Cosine Similarity) 的均值：

$$
C_{int} = \frac{1}{3} \sum_{i<j} \text{Sim}(\vec{v}_i, \vec{v}_j)
$$

其中 $\text{Sim}(\vec{a}, \vec{b}) = \frac{\vec{a} \cdot \vec{b}}{\|\vec{a}\| \|\vec{b}\|}$，并归一化到 $[0, 1]$ 区间。

*   $C_{int} \to 1$: 三贤人完全一致 (高度共鸣或回声室)。
*   $C_{int} \to 0$: 三贤人完全正交 (极度分裂)。

### 3.2 Stress Multiplier ($\lambda_{stress}$)

环境压力 (Stress) 会迫使个体表现出更高的同步性 (应激反应)。我们引入压力乘子：

$$
M_{stress} = 1 + \lambda \cdot S(t)
$$

*   $\lambda$: 敏感度系数 (e.g. 0.5)。
*   $S(t) \in [0, 1]$: 当前上下文的紧迫度/情绪强度 (由 Trinity 感知)。

### 3.3 Final Formula

$$
\rho = C_{int} \times M_{stress}
$$

**Range**: $\rho \in [0, 1.5]$.
*   $\rho > 1.0$ 表示在强压力下，系统进入了 "过同步" (Hyper-sync) 状态。

## 4. ATF Strength ($F$) - The Resilience Metric

ATF 强度 $F$ 衡量系统的 **稳定性** 和 **自我边界的坚固程度**。它与 $\rho$ 呈非线性的钟形关系。

### 4.1 The Curve Function

我们采用 **Ricker Wavelet (Mexican Hat)** 的变体或 **Gamma Distribution** 形式，使其在 $\rho=1$ 处达到峰值。

$$
F(\rho) = \rho \cdot e^{1 - \rho}
$$

### 4.2 Behavior Analysis

对该函数的行为分析：

1.  **Dispersion ($\rho \to 0$)**:
    *   $F \to 0$。
    *   **含义**: 内部太松散，无法形成有效的自我防御 (Low Identity)。

2.  **Criticality / Peak ($\rho = 1$)**:
    *   $F = 1 \cdot e^0 = 1$ (Max).
    *   **含义**: 系统处于临界状态，既有足够的整合度，又保留了适当的内部差异。这是最健康的状态。

3.  **Dissolution ($\rho \to \infty$)**:
    *   当 $\rho = 1.5$ 时， $F = 1.5 \cdot e^{-0.5} \approx 0.91$ (开始下降)。
    *   当 $\rho = 2.0$ 时， $F = 2.0 \cdot e^{-1} \approx 0.73$ (显著下降)。
    *   **含义**: 过度的同步导致灵活性丧失，系统变得僵硬脆弱，容易崩溃 (Collapse)。

## 5. System Dynamics (系统动力学)

ATF 系统通过 **Global Broadcast** 调节三贤人，形成负反馈循环。

Let $\Delta S$ be the modulation signal from Trinity to Wise Men.

$$
\Delta S \propto \text{Sign}(1 - \rho) \cdot F(\rho)
$$

*   If $\rho < 1$: Sign is (+). Positive feedback. Encourage more coherence.
*   If $\rho > 1$: Sign is (-). Negative feedback. Force divergence (introduce noise/conflict).
