# Seraph 四盲测试与ATF计算实现任务

## 任务目标

在 `kernel/nerv/seraph` 中实现定期抽题提问机制，用于计算 Trinity、三贤人和 Avatar 的 ATF 和同步率分量。

## 核心需求

### 1. 四盲测试机制 (Four-Blind Test)

- Trinity、Melchior、Balthazar、Casper 四个实体完全隔离作答
- 靶向比例抽题：
  - Trinity: 全域随机抽题
  - Melchior (理智): 80% 认知/逻辑维度 + 20% 跨界
  - Balthazar (情感): 80% 情感/协调维度 + 20% 跨界
  - Casper (本能): 80% 本能/应激维度 + 20% 跨界
- Avatar: 视为裸 LLM，作为外部参考基线

### 2. 相似度计算权重平衡

需要权衡两种相似度度量的权重：

#### 文体风格监控 (Sim_style)
- 实时度量，计算开销低
- 捕获"说话习惯"而非"说话内容"
- 特征：TTR、句长统计、标点熵
- 适合快速检测人格外壳同化

#### 大五人格基质 (Sim_bf)
- 稳态滞流度量，基于 EMA 长期更新
- 捕获真正的人格漂移
- 基于 PersonaBase 矩阵的加权 Frobenius 内积
- 适合检测底层人格解体

#### 综合权重建议
根据 ATF 数学模型文档：
- α = 0.35 (文体风格权重)
- 1-α = 0.65 (大五人格权重)
- 冷启动阶段动态上调 α

**设计理由**：
- 大五人格基质经过事件显著性门控，更可靠
- 文体特征作为敏捷补位，应对实时突发状况
- 冷启动时大五矩阵未充分累积，临时提升文体权重

## 实现任务清单

- [ ] **T1: 创建问卷抽题模块**
  - [ ] T1.1: 定义抽题策略接口
  - [ ] T1.2: 实现靶向比例抽题算法
  - [ ] T1.3: 实现题目情境化转换

- [ ] **T2: 创建四盲测试执行器**
  - [ ] T2.1: 定义测试会话结构
  - [ ] T2.2: 实现隔离作答机制
  - [ ] T2.3: 实现答案收集与解析

- [ ] **T3: 创建 EMA 更新模块**
  - [ ] T3.1: 实现事件显著性计算 λ(S_obs)
  - [ ] T3.2: 实现 PersonaBase 矩阵 EMA 更新
  - [ ] T3.3: 实现矩阵持久化

- [ ] **T4: 集成 ATF 计算流程**
  - [ ] T4.1: 连接抽题→作答→计算→更新流程
  - [ ] T4.2: 实现定期触发机制
  - [ ] T4.3: 实现遥测数据推送

- [ ] **T5: 权重配置与调优**
  - [ ] T5.1: 实现权重配置管理
  - [ ] T5.2: 实现冷启动检测与动态调权
  - [ ] T5.3: 添加权重调优测试

- [ ] **T6: 测试与验证**
  - [ ] T6.1: 单元测试覆盖
  - [ ] T6.2: 集成测试验证
  - [ ] T6.3: 性能测试

## 技术设计要点

### 抽题策略

```go
type SamplingStrategy interface {
    Sample(count int) []QuestionItem
}

type TargetedRatioSampler struct {
    primaryDomains   []Domain  // 80% 主场域
    secondaryDomains []Domain  // 20% 跨界域
}

type UniformSampler struct {
    allDomains []Domain  // Trinity 全域随机
}
```

### 权重配置

```go
type SimilarityWeights struct {
    StyleWeight    float64  // α，默认 0.35
    BigFiveWeight  float64  // 1-α，默认 0.65
    ColdStartBoost float64  // 冷启动时的 α 提升量
}

type CoherenceWeights struct {
    InternalWeight float64  // β，默认 0.6
    ExternalWeight float64  // 1-β，默认 0.4
}
```

### EMA 更新

```go
type EMAUpdater struct {
    maxLambda float64  // λ_max，最大更新步长
}

func (u *EMAUpdater) ComputeSalience(event Event) float64 {
    // 计算事件显著性 S_obs
    // 返回 λ(S_obs) ∈ [0, λ_max]
}

func (u *EMAUpdater) UpdateMatrix(
    current PersonaBase,
    observed PersonaBase,
    lambda float64,
) PersonaBase {
    // P^(T) = (1-λ) * P^(T-1) + λ * P_obs^(T)
}
```

## 参考文档

- `docs/设计/ATF数学模型.design.md` - ATF 数学模型完整规范
- `docs/设计/MAGI_人格种子生成机制.design.md` - 人格种子与四盲测试
- `kernel/nerv/seraph/atf_*.go` - 已实现的 ATF 计算模块
- `kernel/nerv/seraph/question_bank.go` - IPIP-NEO-120 题库

## 注意事项

1. **绝对隔离**：四个实体作答时必须完全隔离，不能看到彼此答案
2. **异步收敛**：每次测验更新的 Facet 可能不同，通过长期 EMA 实现矩阵完整填充
3. **权重平衡**：文体风格和大五人格的权重需要根据实际效果调优
4. **性能考虑**：文体风格计算开销低，可实时执行；大五问卷需要 LLM 调用，应控制频率
5. **冷启动处理**：系统初期大五矩阵未充分累积时，需要提升文体权重

## 当前状态

- [x] ATF 计算模块已实现（atf_types.go, atf_style.go, atf_similarity.go, atf_coherence.go, atf_strength.go）
- [x] 测试验证通过
- [ ] 抽题机制待实现
- [ ] 四盲测试执行器待实现
- [ ] EMA 更新模块待实现
- [ ] 集成流程待实现
