# ATF实现问题验证报告

## 验证时间
2026-03-08

## 验证结论
**8个问题全部真实存在**，按严重度分类如下：

## 口径声明（同步率区间）

本报告采用与代码实现一致、且与 `docs/设计/ATF数学模型.design.md` 对齐的同步率分区口径：

- `Dispersion`: $\rho < 0.7$
- `Resonance`: $0.7 \le \rho \le 1.3$
- `Dissolution`: $\rho > 1.3$

---

## 高严重度问题（2个）

### 1. C_ext基线构造不独立 ✓ 确认

**问题描述**：Trinity和Avatar使用相同的人格描述文档（IntegratedDescription），导致外部一致性C_ext系统性偏高。

**证据**：
- `atf_answerer.go:292-303` buildEntityPrompt函数：
  ```go
  func buildEntityPrompt(subject MonitorSubject, entity ATFEntity, questions []IpipNeo120Item) string {
      var perspective string
      switch entity {
      case EntityMelchior:
          perspective = subject.Descriptions.ProfessionalDescription
      case EntityBalthazar:
          perspective = subject.Descriptions.LifeDescription
      case EntityCasper:
          perspective = subject.Descriptions.InstinctNeedsDescription
      default:  // Trinity和Avatar都走这里
          perspective = subject.Descriptions.IntegratedDescription
      }
  ```

- `atf_answerer.go:172-186` buildDeterministicReflection同样逻辑

- `atf_monitor.go:115-119` 使用Trinity-Avatar相似度作为C_ext：
  ```go
  trinityAvatarSim := toUnitInterval(computePairSimilarity(personaByEntity, styles, EntityTrinity, EntityAvatar, alpha, bigFiveWeight))
  pairs["T_avatar"] = trinityAvatarSim
  // ...
  cExt := ComputeExternalCoherence(trinityAvatarSim)
  ```

**影响**：
- C_ext长期接近1.0（实测≈0.9975）
- 同步率ρ被推高到dissolution区（实测≈80）
- 失去外部基线的校准作用

**根本原因**：Avatar应该是"裸LLM"基线，但实现中给了它与Trinity相同的人格文档。

---

### 2. 大五矩阵值域[0,1]与设计[-1,1]不一致 ✓ 确认

**问题描述**：PersonaBase使用[0,1]值域，而非设计文档中的[-1,1]，导致余弦相似度无法表达"反向人格"。

**证据**：
- `constants.go:79-81` 归一化函数：
  ```go
  func toNormalizedScore(scoreOnOneToFive float64) float64 {
      return (scoreOnOneToFive - 1) / 4  // 结果在[0,1]
  }
  ```

- `validator.go:123,141` 强校验[0,1]：
  ```go
  if score < 0 || score > 1 {
      return &ValidationError{
          Message: fmt.Sprintf("分数超出范围: %.2f, 必须在0-1之间", score),
      }
  }
  ```

- `atf_similarity.go:47` 余弦相似度计算：
  ```go
  cosineSim := dotProduct / (math.Sqrt(norm1) * math.Sqrt(norm2))
  return cosineSim  // 在非负向量空间中，余弦值≥0
  ```

**影响**：
- 非负向量的余弦相似度范围实际为[0,1]而非[-1,1]
- 无法表达"完全相反的人格"（理论上应该=-1）
- 相似度基线被抬高，进一步推高C_int/C_ext和ρ

**设计意图**：ATF数学模型假设PersonaBase在[-1,1]，这样余弦相似度才能充分利用[-1,1]区间。

---

## 中严重度问题（4个）

### 3. rho==1时动态项符号处理偏差 ✓ 确认

**问题描述**：Sign(ρ-1)在ρ==1时应该=0，但实现中被当作-1处理。

**证据**：
- `atf_strength.go:16-20`：
  ```go
  sign := -1.0
  if rho > 1.0 {
      sign = 1.0
  }
  // 当rho==1时，sign=-1.0
  ```

**数学定义**：
- Sign(x) = -1 if x<0, 0 if x==0, +1 if x>0
- 当ρ=1时，ρ-1=0，Sign(0)=0

**影响**：
- 在共振中心点（ρ=1）附近引入额外的趋势偏置
- 动态项不应受导数影响，但实际会受影响

---

### 4. ComputeATFState内部状态可能矛盾 ✓ 确认

**问题描述**：函数内部计算syncRate，但strength使用外部传入的rho，可能不一致。

**证据**：
- `atf_strength.go:36-39`：
  ```go
  func ComputeATFState(cInt, cExt, beta, rho, rhoDerivative, gamma float64) ATFState {
      rawCoherence := ComputeRawCoherence(cInt, cExt, beta)
      syncRate := ComputeSyncRate(rawCoherence)  // 计算出syncRate.Value
      strength := ComputeATFStrength(rho, rhoDerivative, gamma)  // 但用外部rho
  ```

**影响**：
- 如果调用方传入的rho != syncRate.Value，同一ATFState内部会不一致
- syncRate.Zone可能与strength.Static不匹配

**注意**：当前atf_monitor.go中未使用此函数，所以暂未触发问题。

---

### 5. EMA显著性门控与设计思路不一致 ✓ 确认

**问题描述**：监测主路径使用简化门控`|score-3|`，而不是设计的"当前人格vs观测人格偏差"。

**证据**：
- `atf_monitor.go:197-216` 实际使用的简化版本：
  ```go
  func computeSalienceLambda(answers []RawAnswer, maxLambda float64) float64 {
      sum := 0.0
      for _, answer := range answers {
          sum += math.Abs(float64(answer.Score)-3.0) / 2.0  // 简化：只看分数极端度
      }
      salience := sum / float64(len(answers))
      return salience * maxLambda
  }
  ```

- `atf_ema.go:26` 设计的复杂版本（未被使用）：
  ```go
  func (u *EMAUpdater) ComputeSalience(currentScore, observedScore float64) float64 {
      deviation := math.Abs(observedScore - currentScore)  // 偏差
      extremity := math.Max(math.Abs(observedScore), math.Abs(1.0-observedScore))  // 极端度
      salience := deviation * extremity  // 偏差×极端度
      return salience * u.MaxLambda
  }
  ```

**影响**：
- 简化版本只关注"极端打分"，不关注"人格偏移"
- 可能对稳定但极端的人格过度更新
- 可能对温和但偏移的人格更新不足

---

### 6. 文体相似度特征维度简化 ✓ 确认

**问题描述**：只使用4个浅层特征+固定缩放，缺少设计文档中的高级特征。

**证据**：
- `atf_style.go:149-165`：
  ```go
  func ComputeStyleSimilarity(s1, s2 StyleMetrics) float64 {
      v1 := []float64{
          s1.TypeTokenRatio,
          s1.AvgSentenceLength / 100.0,  // 固定缩放
          s1.SentenceLengthStd / 100.0,
          s1.PunctuationEntropy / 10.0,
      }
      // 只有4个特征
  ```

**缺失特征**（根据设计文档）：
- 虚词指纹（function word fingerprint）
- 极端标点比例
- 条件困惑度（conditional PPL）
- Z-score标准化

**影响**：
- Sim_style分辨力降低
- 固定缩放常数缺乏理论依据
- 可能无法区分细微的文体差异

---

## 低严重度问题（2个）

### 7. 配置字段声明但未生效 ✓ 确认

**问题描述**：BigFiveWeight和ExternalWeight字段存在但未使用。

**证据**：
- `atf_monitor_types.go:6-16` 定义了字段：
  ```go
  type SimilarityWeights struct {
      StyleWeight    float64 // alpha
      BigFiveWeight  float64 // 1-alpha  ← 定义了但未使用
      // ...
  }
  type CoherenceWeights struct {
      InternalWeight float64 // beta
      ExternalWeight float64 // 1-beta  ← 定义了但未使用
  }
  ```

- `atf_monitor.go:73,120` 强制计算：
  ```go
  bigFiveWeight := 1 - alpha  // 不使用opts.Similarity.BigFiveWeight
  // ...
  raw := ComputeRawCoherence(cInt, cExt, m.opts.Coherence.InternalWeight)  // 不使用ExternalWeight
  ```

**影响**：
- 配置看起来可调，实际不生效
- 可能误导用户以为可以独立配置这些权重

---

### 8. 同步率边界硬裁剪 ✓ 确认

**问题描述**：C被裁剪到[0.0001,0.9999]，掩盖真实极值信息。

**证据**：
- `atf_coherence.go:40-44`：
  ```go
  if rawCoherence >= 0.9999 {
      rawCoherence = 0.9999
  }
  if rawCoherence <= 0.0001 {
      rawCoherence = 0.0001
  }
  ```

**影响**：
- 数值稳定性提升（避免除零和溢出）
- 但会掩盖"接近奇点"的真实幅度
- ρ被限制在[0.0001, 9999]区间

**权衡**：这是数值稳定性与信息保真度的权衡，当前选择偏向稳定性。

---

## 验证方法

1. **代码审查**：逐行检查相关函数实现
2. **交叉引用**：追踪函数调用链，确认实际使用路径
3. **类型检查**：验证数据结构定义与使用是否一致
4. **数学验证**：对比实现与设计文档的数学公式

## 测试状态

当前`go test ./nerv/seraph -count=1`可通过，但测试用例未覆盖这些边界情况和系统性偏差。

---

## 建议优先级

1. **立即修复**：问题1（C_ext基线）、问题2（值域不一致）
2. **计划修复**：问题3（符号处理）、问题5（EMA门控）
3. **优化改进**：问题4（状态一致性）、问题6（文体特征）
4. **文档说明**：问题7（配置字段）、问题8（边界裁剪）
