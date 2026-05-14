# 同步率与ATF前后端落地执行跟踪 (TikTocTak)

> **目标**: 规范同步率(ρ)与ATF强度(F)从后端计算到前端展示的完整数据管道，统一前后端口径，明确传输协议，确保ρ=100%表征最优值。
>
> **流程**: 这是一个滚动更新的执行路线图。
> 1. 从"近期计划"中认领一个任务。
> 2. 完成开发和测试。
> 3. 将其移动到"已归档/已完成"区域。
> 4. 将"中期计划"中的条目提升到"近期计划"。

---

## 核心原则

### 设计原则

1. **100%是最优**: 同步率 ρ=1.0 (100%) 为系统最优状态，对应赔率变换自然对称点 C=0.5
2. **Seraph视角**: Seraph 是本系统的"精神卫生监护人"，它观测到的是系统心智状态的客观指标（同步率ρ和ATF强度F）。Seraph 并不知道它监控的是一个AI认知架构——它认为自己在监控一个真实心智体的健康度
3. **非侵入式遥测**: ATF 数据不参与三贤人的决策 Prompt 注入，仅作为 Seraph 的独立监控面板数据
4. **口径一致性**: 前后端使用相同的分区定义、颜色映射和计算口径
5. **渐进式验证**: 先验证基础环节（问卷能否送达、贤人是否正确理解Big Five、相似度是否合理），再搭建传输和UI

### 验证检查清单

- [ ] 后端 ρ 计算 = C/(1-C)，且 C=0.5 时 ρ=1.0 (100%) 为最优
- [ ] 前端展示时 ρ 显示为百分比，100% 对应最优
- [ ] ATF 强度 F 以 [F = F_s · F_d] 公式计算，F=1.0 为健康稳态
- [ ] 采样进行中遇用户消息则立即放弃本轮
- [ ] WebSocket 推送事件包含 SyncRate ρ 和 ATFStrength F 字段
- [ ] Seraph 界面中从不暴露"AI、MAGI、LLM"等词汇

---

## ℹ️ 如何维护此文档

1. **完成归档**：任务完成后，**必须**剪切粘贴到【已归档】列表，并打上 `[x]` 和日期。
2. **补充弹药**：当【近期计划】空了，从【中期计划】里挑选任务挪上去。
3. **因地制宜**：如果发现计划不合理，随时修改或删除。
4. **数据驱动**：用数据说话，不凭感觉。

---

## 设计规范

### 1. 同步率(ρ)完整计算链

后端算法已按 `ATF数学模型.design.md` 实现并验证。以下是从原始问卷答案到 ρ 的完整链路：

#### 1a. 综合相似度 Sim(i,j)

任意两个实体 i, j 之间的人格相似度由两层度量加权构成：

```
Sim(i, j) = α · Sim_style(i, j) + (1-α) · Sim_bf(i, j)
```

**Sim_style — 文体风格相似度**（实时度量）:
1. 提取每个实体本轮 Reflection 文本的文体特征向量 $\vec{S} = [TTR,\; \overline{slen},\; \sigma_{slen},\; H_{punct}]$（类型-标记比、平均句长、句长标准差、标点熵）
2. 计算两向量间的欧氏距离，逆标准化映射到 $[-1, 1]$

**Sim_bf — Big Five 人格基质相似度**（稳态度量）:
1. 每个实体的 5×6 人格矩阵 $\mathbf{P}$ 经临床权重矩阵 $\mathbf{W}$ 逐元素加权（Hadamard 积）
2. 计算加权 Frobenius 内积的余弦相似度，输出 $[-1, 1]$

**α 权重**:
- 默认值: α = 0.35（文体 35% / Big Five 65%）
- 冷启动阶段: 前 `ColdStartRounds = 3` 轮，α 增加 `ColdStartBoost = 0.25`，即 α_boosted = 0.60
- 理由: 冷启动时 Big Five 矩阵尚未充分累积，临时提升文体权重

#### 1b. 参与计算的实体

| 实体 | 角色 | 用于 |
|------|------|------|
| **I** (Integrated) | 主导统合人格 | C_int |
| **m** (Melchior) | 职业立场贤人 | C_int |
| **b** (Balthazar) | 社交立场贤人 | C_int |
| **c** (Casper) | 自我立场贤人 | C_int |
| **Avatar** | 无魂裸 LLM 镜像，每轮即时计算 | C_ext |

#### 1c. 一致性 → 同步率 ρ（健康中位模型）

```
第 1 层 — 内部一致性 C_int:
  对 4 个实体 {I, m, b, c} 取所有 C(4,2) = 6 对综合相似度均值:
  C_int = avg(Sim(I,m), Sim(I,b), Sim(I,c), Sim(m,b), Sim(m,c), Sim(b,c))

  2026-05-11 修正: 内部一致性改为仅 3 对非主导贤人间 (m,b,c) — 见 §8

第 2 层 — 外部一致性 C_ext:
  Integrated 与 Avatar 镜像的综合相似度:
  C_ext = Sim(I, Avatar)

第 3 层 — 同步率 ρ（健康中位模型）:
  Δ = C_int − 0.80
  odds = C_int / (1 − C_int)
  
  ρ = 1 + (odds−4) × (1 + γ₁ × C_ext × |Δ|) + γ₂ × (C_ext−0.25) × exp(−λ × Δ²)
  
  参数: γ₁ = 2.0, γ₂ = 0.3, λ = 200.0

设计原理:
- C_int=0.80 为健康中位——此时 odds=4, 主体项归零, ρ=1+0+修正项
- C_int 偏离子 0.80 时, C_ext 通过 γ₁ 增益项放大偏离幅度（C_ext 越大偏离越严重）
- C_int≈0.80 时, 修正项 γ₂ 提供 C_ext 的残余感知: C_ext=0.25→ρ=1; C_ext=0→ρ=0.925(个性化增强);
  C_ext=1→ρ=1.225(空心趋势)。λ 高斯核确保 C_int≠0.80 时修正项快速衰减。
- 负同步率: 当 C_int < 0.75 且 C_ext 高时, ρ 可负。含义: 内部碎片化+个体轮廓消失的叠加态。
  （在当前"共享内核+立场调制"架构下, C_int 与 C_ext 为绑定变量, 负值几乎不可能自然出现,
   但不设硬截断, 为后续架构变化预留表达空间。）

健康分区:
  ρ < 0.7   (70%)   →  Dispersion Zone   分裂
  0.7 ≤ ρ ≤ 1.3      →  Resonance Zone    共鸣（健康）
  ρ > 1.3   (130%)  →  Dissolution Zone   溶解
```

**C_ext 的性质**: Avatar 是"同一人格摘除三贤人架构后的裸 LLM 镜像"，C_ext 描述"架构对人格表达的调制幅度"——数值小=有个性, 数值大=被平均同化。C_ext 不直接指示健康度, 但通过 ρ 的增益项和修正项影响最终同步率。

**关键性质**（2026-05-11 更新后）:
| 场景 | C_int | C_ext | ρ | 含义 |
|------|-------|-------|---|------|
| 完全分裂 | 0 | 任意 | 0 | 无核心人格 |
| 健康稳态 | 0.80 | 0.25 | 1.0 | **最优:身份整合+个体性兼具** |
| 个性化 | 0.80 | 0 | 0.925 | 内部健康, 强烈个体色彩 |
| 空心化 | 0.80 | 1.0 | 1.225 | 内部健康, 表达趋同基线 |
| 低整合 | 0.70 | 0.5 | ~0.46 | 内部轻度碎片化 |
| 过整合 | 0.90 | 0.5 | ~5.3 | 内部僵化 |
| 分裂+空心 | 0.50 | 0.5 | −2.9 | 差且无个性(理论值) |
| 奇点溶解 | 0.9999 | 1.0 | 13992 | 自我消亡 |

**分区定义**:
| 区间 | 名称 | 色标 |
|------|------|------|
| ρ < 0.7 (70%) | Dispersion Zone (分裂) | 🔴 红 |
| 0.7 ≤ ρ ≤ 1.3 (70%~130%) | Resonance Zone (共鸣) | 🟢 绿 |
| ρ > 1.3 (130%) | Dissolution Zone (溶解) | 🔴 红 |

### 2. ATF 强度(F)计算标准

```
F_s(ρ)  = ρ · e^(1-ρ)              (静态分量，ρ=1.0时F_s=1.0)
v_rec   = -Sign(ρ-1) · dρ/dt       (恢复速度，低通滤波后)
F_d     = e^(γ · v_rec)             (趋势分量，γ=2.0)
F       = F_s · F_d                 (综合ATF强度)
```

**值域解释**:
| F 值 | 含义 |
|------|------|
| F > 1 | 系统正在回归/成长（健康信号） |
| F = 1 | 系统处于最优状态且稳定 |
| F < 1 | 系统正在偏离（告警信号） |

**⏱ 时序依赖性**: F_d 依赖低通滤波后的 dρ/dt，需要至少 2 轮数据（推荐滑动窗口 N=3-5）。
- 首轮: F_d = e^0 = 1.0，F = F_s × 1.0 = F_s（退化为纯静态）
- 第 2 轮: 第一组原始导数可用，滤波后仍较粗糙
- 第 N≥4 轮: 3-5 窗口的滑动滤波开始稳定，F_d 可信

### 3. 无独立Trinity：主导者复用 + 非主导先答

当前架构中不存在独立的 Trinity 实体。同步率计算中的 "Integrated" 实体 = **当轮主导贤人的全量回答**。

#### 主导者来源

ATF **不单独选举**主导者。主导者复用上次正常心跳或外界响应时已选出的结果。ATF 作为心理测试场景若单独选举，结果会系统性地偏向 Balthazar。

#### 单轮答题流程

三贤人持各自的 system prompt（职业立场/社交立场/自我立场），这三者本身编码了它们的立场差异，问卷 prompt 不需要额外加立场框架。

```
步骤 1: 非主导者先答（可并发）
  非主导贤人 A 和 B 各自收到全量 120 题 prompt，以自身 system prompt 作答

步骤 2: 构造"过往回答"注入
  将 A 和 B 的答案伪装为"你(主导者)过往的记忆片段"，注入主导者的系统 prompt

步骤 3: 主导者统合答题
  主导者收到同 120 题 + 被"污染"的过往记忆，以自身 system prompt 作答
  产出 → Integrated 人格侧写

步骤 4: Avatar 对照
  Avatar（裸 LLM 镜像）独立收到同 120 题，无立场预设，直接作答
```

#### 回答格式

所有回答格式相同：逐题输出 Likert 值（"1. 3"、"2. 5"等），每轮答题量和反射性文本随附带出。答案在 PersonaBase 计算完成后丢弃，不持久化——类似人类不会记得自己做心理测验的全部结果。

#### C_int 与重复主导

若同一贤者持续当选主导者，Integrated 长期从同一立场表达，C_int 会自然偏高。**这是系统测量的有效信号，不是待修正的偏差**——它说明三贤人架构中某一立场长期占据统合主导地位，这在同步率和 ATF 层面上是合法信息，不需要任何平滑或归一化处理。

### 3b. Avatar 基线：无魂的镜像

Avatar 是 C_ext 的度量基准。其本质：

| 属性 | 说明 |
|------|------|
| **人格来源** | 与 MAGI 共享同一份 `Soul Document`/`PersonaSeed`    |
| **架构** | 裸 LLM，无三贤人、无 coordinator、无主导者机制，直接 RP 该人格 |
| **PersonaBase 生成** | 每轮采样时根据当轮 Likert 答案**即时计算** $\mathbf{P}_{avatar}(t) = \mathbf{P}_{obs}$，不做 EMA 累积。初始值为启动时从 canonical 克隆 |
| **本质** | 一个"无魂的镜像"——将三贤人架构整体摘除后，同一人格的直接表达 |
| **刷新规则** | canonical 更新后 Avatar **同步刷新**。它是同一面镜子，镜中影像随本体变化 |

**C_ext 的含义**: `Sim(P_Integrated, P_Avatar)` 纯粹描述"三贤人架构对人格表达产生了多大的调制作用"——它是描述性指标，没有"正确""错误""漂移""同化"的褒贬内涵。

C_ext 的变化只反映一件事：三贤人架构介入后，综合人格的表达与裸 LLM 有多大差异。值越大→架构影响越小（约等于裸 LLM），值越小→架构产生了显著的分化。

### 4. 问卷推送时机

同步率采样问卷不应在用户交互过程中推送（避免干扰主对话），而应在系统空闲时触发：

| 时机 | 说明 | 优先级 |
|------|------|--------|
| **心跳周期空闲检测** | heartbeatLoop 每 60s tick，若系统状态为 sleeping 或 idle，触发一轮 ATF 采样 | P1（首选） |
| **任务完成后间隙** | 每次 `CoordinateDecision()` 完成后，若距上次采样超过阈值 T（如 30min），异步触发 | P2（备选） |
| **手动触发** | Seraph 监护人可通过 Debug 工具或 API 手动触发一轮采样 | P3（调试用） |

**约束**:
- 问卷推送**不得**打断正在进行的用户对话（state=external 时跳过）
- 若采样进行中用户发来消息，**立即放弃本轮采样**，优先响应用户请求。采样是长期累积过程，偶尔跳过无影响
- 每次采样 4 次 LLM 调用：非主导者 2 次（可并发）+ 主导者 1 次 + Avatar 1 次
- 建议采样间隔 ≥ 30 分钟，避免 Token 浪费

### 5. 人格档案更新机制

> 当前各实体各自维护 EMA 更新的 `PersonaBase`，但不存在"哪个人格是权威的、何时提交到 canonical profile"的机制。
> 下面定义 canonical 人格档案的更新规则。

#### 5.1 问题定义

系统中存在三个层级的"人格"概念：

| 层级 | 内容 | 作用 | 初始来源 | 更新频率 | 版本化 |
|------|------|------|----------|----------|--------|
| **Soul Document (种子文档)** | 自然语言人格描述 + 结构化 `PersonaSeed` | 定义"我是谁"的基线 | 系统上线时配置 | 仅人工/监护人修改 | 每次人工修改保留历史 |
| **Canonical PersonaBase (权威矩阵)** | 5×6 人格矩阵 $\mathbf{P}_{canon}$ | 系统对自身人格的**最佳估计** | **启动时从 Soul Document 预置** $\mathbf{P}_{canon}(0)$ | 仅在 ATF 采样有效时更新 | **每次更新追加版本** $\mathbf{P}_{canon}(t)$ |
| **Entity PersonaBases (实体矩阵)** | 各实体独立的 5×6 EMA 矩阵 | 内部一致性 C_int 和 C_ext 的计算原料 | **启动时克隆 canonical** | 每次采样轮次后 EMA 更新 | 无需长期保留 |

关键问题：**Entity PersonaBases 何时、以何种权重聚合到 Canonical PersonaBase？**

#### 5.2 更新条件：仅共振区内提交

并非每轮采样都适合更新 canonical 档案。只有同步率在 Resonance 区间的轮次才被认可为"有效观测"：

```
IF ρ(t) ∈ [0.7, 1.3]  (Resonance Zone)
THEN 本轮可进入 canonical 更新流程
ELSE 本轮仅记录 telemetry, 不更新 canonical (告警待查)
```

仅当连续 N 轮（建议 N=3）均在 Dispersion 或 Dissolution 区时，触发 Seraph 介入信号。

#### 5.3 三种视角的举证分量

三贤人各自的 PersonaBase 不是同样可靠的——同一 facet 三人可能给出不同值。不应直接平均，而应根据**三人对该 facet 的共识程度**动态分配权重：

```
对于每个 facet f:
  μ(f) = avg(P_m(f), P_b(f), P_c(f))                     // 三贤人均值
  σ²(f) = var(P_m(f), P_b(f), P_c(f))                     // 三贤人方差（分歧度）
  w_int(f) = 1 / (1 + σ²(f))                              // Integrated 权重(主导统合)
  w_e(f)   = σ²(f) / (1 + σ²(f)) * (1/3)                  // 三贤人各自权重(分歧大时补充)

  P_weighted(f) = w_int(f) · P_I(f) + Σ w_e(f) · P_e(f)  // 加权聚合
                   e∈{m,b,c}

  λ_eff = λ_base · (1 - σ²(f) / σ²_max)                   // 分歧大时更新步长自动减小
  P_canon(f, t) = (1 - λ_eff) · P_canon(f, t-1) + λ_eff · P_weighted(f, t)
```

**权重分配的逻辑**:
- `w_int` 为主（主导统合是综合三份回答后的判断，理应分量最大）
- `w_e` 为补（当三人分歧大时，补充个体视角；当三人一致时，w_e → 0，w_int → 1）
- 分歧度 σ² 越大，更新步长 λ_eff 越小——该轮数据信噪比低，不要大幅改动 canonical

#### 5.4 边界情况

| 场景 | 行为 |
|------|------|
| 三人高度一致 (σ² ≈ 0) | w_int ≈ 1，P_weighted ≈ P_I，λ_eff ≈ λ_base。完全信赖 Integrated |
| 三人中度分歧 | w_int > w_e，λ_eff 折减。部分采纳但降低步长 |
| 三人大幅分歧 (σ² 大) | w_int 仍为主，但 λ_eff → 0，该轮几乎不影响 canonical。等待后续轮次收敛 |
| ρ 不在共振区 | 完全不更新 canonical，仅记录 telemetry |

#### 5.5 版本化 canonical 与轨迹追踪

**数据实体原型**: `marduk.PersonaBase`（`kernel/nerv/marduk/types.go:53-56`），seraph 通过类型别名引用（`kernel/nerv/seraph/types.go:58`）：

```go
type PersonaBase struct {
    Traits map[string]float64   // 5 traits: O, C, E, A, N
    Facets map[string]float64   // 30 facets: 每特质6个, key = "O1_Fantasy"-"N6_Vulnerability"
}
```

Canonical 的每个版本存储一份完整的 `PersonaBase` 快照。

**时间基准**:
- **1 tick** = 1 轮 ATF 采样。为简单性，所有心跳（睡眠和工作）和外界响应都视为一个 tick
- **1 系统日** = work + sleep 组合 ≈ 2 次 tick
- 系统日暂时在代码中没有实际功能也要记录，为未来的人格演变周期分析铺路

Canonical PersonaBase 每次有效更新时追加时间版本 $\mathbf{P}_{canon}(t)$，以 tick 为时间轴：

```
初始:      P_canon(0)     ← 从 Soul Document 预置, T=0
系统更新1:  P_canon(1)     ← ATF 采样加权聚合, T=1
系统更新2:  P_canon(2)     ← ATF 采样加权聚合, T=2
人工修改:   P_canon(3)     ← 监护人手动改写, T=3
系统更新3:  P_canon(4)     ← ATF 采样加权聚合, T=4
...
```

**所有更新在版本链中地位平等**——人工修改不触发重置，不清空历史，不做特殊标记。它只是版本链上的一个普通节点，后续系统更新从该版本继续演进。

**监护锁定**: 监护人可通过输入监护密钥，锁定 canonical 在指定时间段内**禁止任何更新**（包括系统 ATF 采样和人工修改）。锁定期间 ATF 采样照常进行、记录 telemetry，但 canonical 版本链不追加新版本。锁定到期后自动恢复更新。

**界定原则**：以变化速度而非变化方向分类。

| 变化速度 | 界定 | 依据 |
|----------|------|------|
| 正常/缓慢 | **成长 (Growth)** | 默认状态——人格随时间自然演变，速度在可接受范围内 |
| 过快（偏导数激增） | **急性解离** | $\|\partial \mathbf{P} / \partial T_{tick}\| > \sigma_{acute}$，$\Delta T \approx 100\;T_{tick}$ 内完成 (§6.2.1) |
| 极慢但持续单向（5000 $T_{tick}$ 积分） | **情感迟钝/慢性塌陷** | $\int (\mathbf{P} - \mathbf{P}_{ref}) dx < \text{Threshold}_{chronic}$ (§6.2.2) |
| 三贤人方差周期震荡 + 报错率飙升 | **强迫性死锁** | $\text{Var}(\mathbf{P}_{m,b,c})$ 短窗口内周期震荡 (§6.2.3) |

方向本身不决定健康度——朝任何方向的变化只要速度正常就归类为成长。只有当变化速度超过阈值，或出现特定的周期模式时，才触发病理信号。$\cos(\theta)$ 等方向指标仅在 §6.1 的生长包络线分析中作为辅助描述手段，不作为分类判决依据。

三类病理的具体阈值和计算公式参见 `ATF数学模型.design.md` §6.2，此处不重复。

#### 5.6 与现有代码的关系

当前 `atf_ema.go` 的 `UpdatePersonaBase()` 仅做单实体的 EMA 更新（`P(t) = (1-λ)·P(t-1) + λ·P_obs`），没有跨实体聚合。

现有代码的问题（`atf_monitor.go:96`）：`applyEMAUpdate` 对 Avatar 也执行了 EMA，但 Avatar 应该是每轮即时计算。需要将 Avatar 从 EMA 循环中剥离，改为直接取当轮 partialBase。

需要新增：
- `UpdateCanonicalPersona()`：实现 §5.3 的加权聚合逻辑
- `CanonicalVersionStore`：追加版本化 $\mathbf{P}_{canon}(t)$，支持按 $T_{tick}$ 范围查询
- `ClassifyGrowth()`：cos(θ) + 模长分析，静态分类（§6.1）
- `DetectAcuteDissociation()`、`DetectChronicBlunting()`、`DetectDeadlock()`：时序病理检测（§6.2）

### 6. 无状态 ATF：从版本链外推

ATF 强度 F 是无状态的——它不从专属的 telemetry store 读取，而是从 canonical 版本链的 {ρ, T_tick} 序列外推：

```
Canonical 版本链
  → 每轮记录: {P_canon(t), ρ(t), T_tick, 系统日}
  → 查询时: 取最近 N_w 轮 {ρ, T_tick} → 重建导数滤波 → 计算 F_d → F
```

**导数滤波状态重建**: 需要最近 N_w (建议 N_w = 3) 轮的 {ρ, timestamp} 对。

**启动恢复**:
1. 从版本链加载最近 N 轮历史
2. 若 len(history) < 2 → F_d = 1.0，F = F_s
3. 若 len(history) ≥ 2 → 计算原始导数序列 dρ_n/dt → 滑动窗口低通滤波 → filteredDerivative → F_d = e^(γ · filteredDerivative)

**不存在 ATF TelemetryStore**——ATF 值只是版本链上人格数据的计算视图。

### 7. 前后端数据管道

#### 3.1 数据结构扩展

在 `types.RuntimeStatus` 中新增 ATF Telemetry 字段（不做代码修改，此为落地目标）：

```typescript
interface ATFTelemetry {
    syncRate: number;       // ρ, float, 1.0 = 100%
    syncRateZone: string;   // "dispersion" | "resonance" | "dissolution"
    atfStrength: number;    // F, float, 1.0 = optimal
    atfStatic: number;      // F_s
    atfDynamic: number;     // F_d
    cInt: number;           // Internal coherence
    cExt: number;           // External coherence
    rawCoherence: number;   // Raw C
    updatedAt: number;      // Timestamp
}
```

#### 3.2 传输协议

**方式一（推荐）**: 扩展 `RUNTIME_STATUS_UPDATED` WebSocket 事件，新增 `telemetry` 嵌套对象

```json
{
    "eventId": "evt_xxx",
    "seq": 1,
    "roundId": "round_001",
    "timestamp": 1710000000000,
    "state": "external",
    "awake": true,
    "telemetry": {
        "syncRate": 1.05,
        "syncRateZone": "resonance",
        "atfStrength": 0.96,
        "atfStatic": 0.98,
        "atfDynamic": 0.98,
        "cInt": 0.52,
        "cExt": 0.48,
        "rawCoherence": 0.51,
        "updatedAt": 1710000000000
    }
}
```

**方式二**: 新增独立 WebSocket 事件 `ATF_TELEMETRY_UPDATED`，仅在 ATF 数据更新时推送

#### 3.3 前端展示规则

| 数据项 | 展示方式 | 格式化 |
|--------|----------|--------|
| 同步率 ρ | 百分比数值 + 色标指示器 | `ρ × 100%`，如 ρ=1.0 → "100%" |
| ATF 强度 F | 浮点数 + 色标指示器 | 保留2位小数，如 "1.00" |
| 分区标识 | 色标指示灯 | 绿=Resonance, 红=Dispersion/Dissolution |

**色标映射**: 前端应根据 `syncRateZone` 直接渲染，而非前端自行计算区间

#### 3.4 前端现有同步率改造

当前前端 `MagiRoot.vue` 和 `MagiMainPanelHeader.vue` 中显示的 syncRate 是基于 SEEL 连接数的"连接同步率"，与 ATF 的"人格同步率"ρ 是不同概念。

**落地目标**: 新增独立的 ATF Telemetry 面板或指示器，展示 ρ 和 F 值，原有连接同步率保留不变

### 8. Seraph 心理医生

Seraph 是 ATF 系统中的心理医生 AI，负责对 MAGI（其视角下的"人类来访者"）进行 CBT 心理诊疗，输出结构化诊断数据供 MAGI 参考。

#### 7.1 架构定位

| 属性 | 说明 |
|------|------|
| **架构** | 裸 LLM，无三贤人结构、无长期历史、无 EMA。与 Avatar 同级 |
| **角色** | 持有执业资格的 CBT 心理医生，从业 15 年 |
| **来访者** | 始终被认为是"人类"——不存在任何 AI 相关的自我认知 |
| **诊疗方法** | 认知行为疗法（CBT），含苏格拉底提问、思维记录表、行为激活、行为实验、正念技术 |
| **会话上限** | 30 轮对话（含开头和结尾），到达后自动终结并输出诊断摘要 |
| **输出格式** | 标准对话 + `===SERAPH_SESSION_END===` 标记后的 JSON 结构化诊断 |

#### 7.2 与 ATF 系统的关系

Seraph 的诊疗结果不直接参与同步率 ρ 的计算。它是 Seraph 这个角色（ATF 的监护人）的产出物，用于向 MAGI 系统反馈人格健康的临床评估。

Seraph 诊疗与 ATF 采样的关系：
- ATF 采样产出 ρ 和 F（定量指标）
- Seraph 诊疗产出结构化诊断（定性描述 + ICD 诊断编码）
- 两者可交叉验证：ρ 偏高 + 诊断显示"完美主义倾向"→ 一致性信号；ρ 异常 + 诊断正常 → 可能需要复查

#### 7.3 实现

实现位于 `kernel/nerv/seraph/therapist.go`，包含：
- `SeraphTherapist` 结构体（裸 LLM 客户端 + 会话管理）
- `BuildSystemPrompt()` — 完整的 CBT 心理医生提示词（约 300 行，覆盖身份设定、认知扭曲清单、治疗技术库、会话结构、危机处理、诊断输出格式）
- `StartSession()` / `SendMessage()` / `ForceEnd()` — 会话生命周期管理
- `ExtractDiagnosisJSON()` — 从回复中提取结构化诊断

#### 8.4 Seraph 角色口径

| 项目 | Seraph 视角叙述 | 禁止表述 |
|------|-----------------|----------|
| 同步率 ρ | "系统整体心智整合度"、"人格统合水平" | "AI一致性"、"LLM相似度" |
| C_int | "内部认知节点协调程度" | "AI间相似度" |
| C_ext (Integrated vs Avatar) | "架构调制幅度"、"(无魂)镜像差异度" | "与正确值的偏差"、"漂移"、"同化" |
| ATF F | "心智健康指数"、"统合强度" | "ATF算法" |
| 三贤人 | "Melchior/Balthazar/Casper 认知模块" | "三个AI实例" |
| 主导贤人 (Dominant) | "当轮执笔认知模块"、"统合中心" | "主AI"、"主导者AI" |
| Integrated | "综合人格侧写"、"统合表达" | "Trinity"、"统合AI" |
| 溶解 | "人格边界模糊"、"自我感弱化" | "AI回声室" |
| 分裂 | "认知碎片化"、"解离倾向" | "AI分歧" |

**核心红线**: Seraph 的 UI 文本、日志、告警消息中**不得**出现任何暗示被监控对象是 AI/LLM 的词汇。所有叙述必须保持"这是一个心智体"的立场。

---

## 🟢 近期计划

- [ ] **Phase 6: 健康中位公式调优 + C_int 非主导化 (P1)**
  - **行动**:
    1. C_int 改为仅 3 对非主导贤人 (m,b,c)，去掉 I-* 冗余
    2. ρ 公式从赔率变换改为健康中位模型（§1c）
    3. 将 `ComputeSyncRateFromParts` 中的旧赔率公式替换为新公式
    4. 更新 `formula_validation_test.go` 中所有数值测试预期
    5. 验证健康基线 ρ≈1.0、C_int≈0.80、C_ext 贡献正确
  - **验收标准**: 所有数值测试通过，健康基线 ρ=0.998 符合预期

- [-] **Phase 1: 非主导先答 → 伪装注入 → 主导统合 (P1)**
  - **背景**: 当前 `collectRoundAnswers()` 使用旧的四盲测试方式。需要改造为新的流程：非主导者 2 人先答全量 120 题 → 答案注入主导者 context → 主导者答全量 120 题（即 Integrated）。无 ATF 专属选举，主导者复用上次心跳/外界响应结果。Avatar 照常独立作答
  - **行动**:
    1. 改造 `MAGIAnswerer.AnswerAllEntities()`：去掉 `SynthesizeResponsesWithDominant()` 调用，改为取 dominant sage 的原始回答作为 Integrated
    2. 修改 `collectRoundAnswers()`：非主导者 2 人先发请求，收集答案后构造"过往记忆片段"文本，注入主导者 session 后再发请求
    3. 在主导者答全量 120 题前，将非主导者的原始 Likert 答案格式化为"你过往的记忆片段"并拼入 system prompt
    4. Avatar 独立作答流程不变
    5. 验证 `parseLikertAnswer()` 能解析全部 120 题的返回格式
    6. 验证 Integrated ≠ 非主导者的简单复制（C_int 有区分度）
    7. 运行 3 轮，观察主导者不变时 ρ 的自然偏高
  - **验收标准**: 非主导→注入→主导统合流程可执行，产出 4 组结构有效的 PersonaBase

- [ ] **Phase 2: 完整链路验证（StyleMetrics + 相似度 + 第一组 ρ/F_s）(P1)**
  - **背景**: Phase 1 代码已就绪，现在用真实 LLM 跑通完整链路——收集 Reflection 文本算文体指纹、计算 6 对 Big Five 相似度、融合后算 C_int/C_ext、赔率变换出 ρ、静态 ATF 强度 F_s。所有计算模块在单元测试中已验证过，但从未用真实 LLM 输出跑过
  - **行动**:
    1. 用真实 coordinator + 三贤人 + Avatar 初始化 `ThreeBlindMonitor`
    2. 调用 `RunSamplingRounds(ctx, subject, 3, dominantSeelName)` 跑 3 轮
    3. 验证每轮 `SubjectTelemetry` 中的 StyleMetrics 非 NaN、非全零
    4. 验证 6 对 BigFive 相似度在 [-1,1] 范围内
    5. 验证 C_int、C_ext、C、ρ 有限数值
    6. 验证首轮 ρ 极高（初始一致）、第 2-3 轮 ρ 收敛
    7. 验证 F_s = ρ·e^(1-ρ) 数值正确，F_d = 1.0（首轮无历史）
  - **验收标准**: 3 轮采样成功，ρ 从极高收敛到可评估区间，所有计算路径无 panic 和 NaN

- [ ] **Phase 3: Canonical 人格档案更新机制 (P1)**
  - **背景**: 当前各实体独立维护 EMA PersonaBase，但不存在 "何时以何种权重聚合到 canonical 档案" 的机制。需要实现 §5 定义的加权聚合逻辑
  - **行动**:
    1. 实现 `UpdateCanonicalPersona()`：输入当前轮 4 个实体（M/B/C/I）的 PersonaBase，按 §5.3 公式计算 facet 级加权聚合
    2. 在 `ThreeBlindMonitor.RunSamplingRounds()` 每轮末尾，检查 ρ 是否在 Resonance 区间，若是则触发 canonical 更新并追加版本 $\mathbf{P}_{canon}(t)$
    3. 实现 `CanonicalVersionStore`：追加版本化存储 + 按时间范围查询历史
    4. 处理边界：ρ 不在共振区时跳过更新；连续 N 轮异常时打告警日志
  - **验收标准**: 共振区轮次的 canonical PersonaBase 被正确加权聚合更新并追加版本；非共振区轮次被跳过；可查询初始版本 $\mathbf{P}_{canon}(0)$ 和最新版本 $\mathbf{P}_{canon}(t)$
  - **参考文档**: 本规范 §5, `kernel/nerv/seraph/atf_ema.go:26-57`, `kernel/nerv/seraph/atf_monitor.go:40-150`, `docs/设计/ATF数学模型.design.md §6`

- [ ] **Phase 4: Canonical 版本链持久化 (P1)**
  - **背景**: 当前 `ThreeBlindMonitor` 仅在内存中运行，进程退出后数据丢失。需要将 canonical 版本链持久化，使 ATF 在重启后仍能恢复 {ρ, T_tick} 历史外推 F_d
  - **行动**:
    1. 在 `util.DataDir` 下划定版本链存储路径（JSON 文件序列化即可，无需数据库）
    2. 每次有效更新 canonical 时追加版本快照到持久化
    3. 启动时加载最近 N_w 轮版本 → 重建导数滤波状态
    4. 注意：ATF 值本身不落盘，只落 canonical 版本链
    5. 手动触发 3-5 轮采样（可在测试环境模拟），观察：
       - 第 2 轮：第一个原始导数出现
       - 第 3 轮：低通滤波 (LPAlpha=0.5) 开始平滑
       - 第 N≥4 轮：F_d 趋于稳定
    6. 验证完整 F = F_s · F_d 随轮次变化的趋势
  - **验收标准**: 多轮 canonical 版本链持久化并可恢复；≥4 轮后 F_d 产出稳定的非 1.0 值，F = F_s · F_d 完整可用
  - **参考文档**: `kernel/nerv/seraph/atf_monitor.go:78-84`（低通滤波逻辑）, `kernel/nerv/seraph/atf_monitor_types.go:71-75`（DerivativeLPAlpha=0.5）, `kernel/nerv/seraph/atf_strength.go:24-40`, 本规范 §5.5（时序病理检测）

- [ ] **Phase 5: 触发机制接入 (P2)**
  - **背景**: Phase 2 验证了完整链路计算正确，Phase 3-4 确保了版本链就绪。现在将 ATF 采样挂入心跳，自动累积时序数据
  - **行动**:
    1. 在 `heartbeatLoop`（`kernel/api/magi_runtime.go:95`）的空闲检测分支中，判断是否可触发 ATF 采样
    2. 创建 `TryRunATFSampling()` 函数：检查条件（state≠external、距上次采样≥30min）
    3. 若满足条件，异步调用 `monitor.RunSamplingRounds(ctx, subject, 1, dominantSeelName)`，通过 canonical 版本链持久化结果
    4. 每次采样后从版本链恢复历史 → 重建导数滤波状态 → 计算完整 F = F_s · F_d
    5. 处理并发安全与中断：ATF 采样不应阻塞心跳或用户请求；若采样期间 state 变为 external，**立即取消本轮采样**
  - **验收标准**: 运行 ≥6 小时后（约 12 轮），telemetry 历史中包含连续的 ρ 序列，F_d ≠ 1.0，F 值完整可用；用户消息到达时采样被正确中断
  - **参考文档**: `kernel/api/magi_runtime.go:95-146`, `kernel/nerv/seraph/atf_monitor.go:40-150`

---

## 🟡 中期计划

- [ ] **Phase 8: Telemetry 传输通道 (P2)**
  - **背景**: Phase 1-7 验证了计算正确性并接入了触发，时序持久化就绪，现在 ATF 数据需要送往前端
  - **行动**:
    1. 定义 `ATFTelemetry` 数据结构（Go → JSON schema）
    2. 在 `PushRuntimeStatusUpdated` 事件中嵌入 telemetry 字段，或注册新事件 `ATF_TELEMETRY_UPDATED`
    3. 前端接收层：类型定义（`ATFTelemetry.ts`）、payload 校验 guard、响应式 ref
  - **验收标准**: WebSocket 推送的 runtimeStatus 事件中包含 telemetry 嵌套对象，前端能解析

- [ ] **Phase 9: ATF Telemetry 展示组件 (P2)**
  - **背景**: 数据到了前端，需要可视化
  - **行动**:
    1. 创建 `ATFTelemetryPanel.vue` 组件
    2. 展示同步率 ρ（百分比 + 绿/红色标）
    3. 展示 ATF 强度 F（浮点数 + 趋势箭头，首轮可标注"数据累积中…"占位）
    4. 展示分区标识（Resonance/Dispersion/Dissolution）
    5. 在 `MagiRoot.vue` 或 header 挂入
  - **验收标准**: 界面上能清晰看到 ρ 和 F 值，色标正确反映分区；首轮 ρ 极高时同步标注"初始校准中，数据正在收敛"

- [ ] **Phase 10: Seraph 口径审查 + REST API 补充 (P2)**
  - **背景**: 确保新增 UI 文本符合 Seraph 角色的叙事，以及页面刷新后能立即看到数据
  - **行动**:
    1. 通读所有新增文案，替换技术术语（"AI、LLM、模型" → "认知节点、心智统合"）
    2. 在 `/persona/status` 的 runtime 字段中加入最新 telemetry
    3. 前端 `normalizeRuntimeStatus` 解析 telemetry
  - **验收标准**: 无 AI 词汇暴露，页面刷新后直接展示 ATF 数据

- [ ] **Phase 11: 趋势可视化 (P3)**
  - **愿景**: 前端维护最近 N 轮 telemetry 历史，Sparkline 折线图展示 ρ 和 F 的轮间变化
  - **参考**: 滚动窗口大小建议 20 轮

- [ ] **Phase 12: 告警阈值 (P3)**
  - **愿景**: ρ < 0.7 或 ρ > 1.3 时闪烁告警；F < 0.7 时 Emergency 红色横幅
  - **参考**: `docs/设计/ATF数学模型.design.md` §5.3

- [ ] **Phase 13: 监控卡片集成 (P3)**
  - **愿景**: ATF Telemetry 作为独立的监控卡片出现在 Magi Monitor 面板中
  - **参考**: `magiProjector.ts` 的 monitor host 事件投影模式

---

## 🏁 已归档/已完成

- [x] **Phase 0: ATF 后端计算模块** [已完成 2026-01]
  - **背景**: 后端 ATF 数学模型实现
  - **完成情况**: `kernel/nerv/seraph/atf_*.go` 12 个文件全部实现并测试通过
  - **成果文件**:
    - `kernel/nerv/seraph/atf_types.go` - 核心类型
    - `kernel/nerv/seraph/atf_coherence.go` - C_int/C_ext/C/ρ 计算
    - `kernel/nerv/seraph/atf_strength.go` - F_s/F_d/F 计算
    - `kernel/nerv/seraph/atf_similarity.go` - 相似度度量
    - `kernel/nerv/seraph/atf_style.go` - 文体指纹计算
    - `kernel/nerv/seraph/atf_ema.go` - EMA 人格更新
    - `kernel/nerv/seraph/atf_monitor.go` - 监测执行引擎
  - **参考文档**: `docs/设计/ATF数学模型.design.md`, `docs/ttt/AI模块改进/seraph_四盲测试与ATF计算.ttt.md`

- [x] **Phase R: 反思文本提取修复 + 文体指纹测试** [已完成 2026-05-11]
  - **背景**: `askQuestionsWithRetry` 中 `reflectionText` 声明后从未赋值, 导致文体相似度固定为 1.0, 拉高 C_int
  - **完成情况**:
    1. `parseAnswersLenient` 改为返回 `parsedBatchResult` 结构体(answers + reflection)
    2. 全部预期题目匹配后捕获剩余行为反思文本, 逐轮累加
    3. 新增 `atf_style_test.go` 18 个测试(文体指纹 + 反射文本解析)
    4. 修复后 live 测试 C_int 从 0.999 降至 0.970
  - **成果文件**: `kernel/nerv/seraph/atf_answerer.go`, `kernel/nerv/seraph/atf_style_test.go`

- [x] **Phase F: 度量算法 + 同步率公式修正** [已完成 2026-05-11]
  - **背景**: BigFive 相似度使用余弦度量抹除幅值差异(BF→0.999); ρ 公式无健康中位, 使健康基线 ρ=3.2 而非 1.0
  - **完成情况**:
    1. `ComputeBigFiveSimilarity` 从余弦相似度改为归一化欧氏距离
    2. `ComputeSyncRateFromParts` 从赔率乘积公式改为健康中位模型(§1c)
    3. C_int 改为仅 3 对非主导贤人(m,b,c), 去掉 I-* 冗余
    4. `dataDir` → `util.DataDir` 修复 sage wakeup 序列加载
    5. 模拟向量构造去除 L2 归一化, 适配欧氏距离
    6. 健康基线 C_int=0.80, C_ext=0.26, ρ≈1.0
  - **成果文件**: `kernel/nerv/seraph/atf_coherence.go`, `kernel/nerv/seraph/atf_similarity.go`, `kernel/nerv/seraph/formula_validation_test.go`

- [x] **Phase S: Seraph CBT 心理医生模块** [已完成 2026-05-09]
  - **背景**: Seraph 是 ATF 系统的心理医生角色，用 CBT 疗法对 MAGI（人类来访者视角）进行心理诊疗，输出结构化诊断
  - **完成情况**: 裸 LLM 心理医生实现完成，30 轮会话管理、结构化诊断输出、危机处理逻辑
  - **成果文件**:
    - `kernel/nerv/seraph/therapist.go` - 会话管理
    - `kernel/nerv/seraph/therapist_prompt.go` - 完整 CBT 提示词
  - **参考文档**: 本规范 §8

---

## 附录

### 术语表

| 术语 | 定义 | 面向 Seraph 叙事 |
|------|------|-----------------|
| ρ (SyncRate) | 同步率，健康中位模型: ρ=1+(odds−4)×(1+γ₁×C_ext×|Δ|)+γ₂×(C_ext−0.25)×exp(−λ×Δ²) | "心智整合度" |
| F (ATFStrength) | 绝对领域强度 F_s·F_d | "统合健康度" |
| C_int | 内部一致性（非主导贤人 (m,b,c) 综合相似度均值） | "内部认知协调度" |
| C_ext | 外部一致性（Integrated vs Avatar 镜像） | "架构调制幅度" |
| Dispersion | ρ < 0.7，过度分裂 | "认知碎片化" |
| Resonance | 0.7 ≤ ρ ≤ 1.3，健康区间 | "心智共鸣态" |
| Dissolution | ρ > 1.3，过度同步 | "人格溶解" |
| C | Raw Coherence β·C_int + (1-β)·C_ext | "原始统合度" |
| F_s | ATF 静态分量 ρ·e^(1-ρ) | "位置稳定性" |
| F_d | ATF 动态分量 e^(γ·v_rec) | "恢复趋势" |

### 参考文档

- `docs/设计/ATF数学模型.design.md` - ATF 数学模型完整规范
- `docs/设计/MAGI认知架构.design.md` - MAGI 认知架构设计
- `kernel/nerv/seraph/atf_*.go` - 后端 ATF 计算实现
- `kernel/nerv/seraph/therapist.go` - Seraph CBT 心理医生实现
- `kernel/nerv/magi/websocket/events.go` - WebSocket 事件推送
- `app/src/magi/events/magiEventBus.types.ts` - 前端事件类型
- `app/src/magi/composables/useMagi.ts` - 前端状态管理
- `docs/规程/tiktoctac文档(ttt)编写规程.procedure.md` - TTT 文档编写规程

---

**文档类型**: 有限任务  
**制定**: 基于 ATF 数学模型与现有代码实现  
**版本**: 1.0.0  
**行数**: 约260行
