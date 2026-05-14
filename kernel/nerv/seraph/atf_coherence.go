package seraph

import "math"

// SimilarityPair 保存一对角色之间的双面相似度信息。
// ShapeSim：余弦相似度（反映人格轮廓的形状/方向一致性）范围 [-1, 1]
// MagnitudeSim：幅度相似度（基于归一化欧氏距离）范围 [-1, 1]，1 表示量级完全一致
type SimilarityPair struct {
	ShapeSim     float64
	MagnitudeSim float64
}

// ------------------------------------------------------------
// 双面相似度计算（余弦 + 幅度）
// ------------------------------------------------------------

// ComputeBigFiveSimilarityDual 计算两个人格基座之间的双面相似度。
// weights 为每个特质的权重，若为 nil 或某特质权重为 0，则默认权重为 1.0。
// 返回值：ShapeSim（余弦相似度）和 MagnitudeSim（幅度相似度）。
func ComputeBigFiveSimilarityDual(p1, p2 *PersonaBase, weights map[string]float64) SimilarityPair {
	if p1 == nil || p2 == nil {
		return SimilarityPair{}
	}

	var dot, norm1, norm2 float64
	var sumSq, sumW float64

	for key, v1 := range p1.Facets {
		v2, ok := p2.Facets[key]
		if !ok {
			continue
		}
		w := 1.0
		if weights != nil {
			if wVal, exists := weights[key]; exists && wVal != 0 {
				w = wVal
			}
		}

		// 余弦部分
		dot += w * v1 * v2
		norm1 += w * v1 * v1
		norm2 += w * v2 * v2

		// 欧氏部分
		diff := v1 - v2
		sumSq += w * diff * diff
		sumW += w
	}

	// 计算余弦相似度
	var shapeSim float64
	norm1 = math.Sqrt(norm1)
	norm2 = math.Sqrt(norm2)
	if norm1 == 0 || norm2 == 0 {
		shapeSim = 0
	} else {
		shapeSim = dot / (norm1 * norm2)
		if shapeSim > 1 {
			shapeSim = 1
		} else if shapeSim < -1 {
			shapeSim = -1
		}
	}

	// 计算幅度相似度：归一化欧氏距离映射到 [-1, 1]
	var magnitudeSim float64
	if sumW == 0 {
		magnitudeSim = 0
	} else {
		normDist := math.Sqrt(sumSq / sumW)
		maxPossibleDiff := 1.0 // 假设维度范围标准化为1
		if normDist > maxPossibleDiff {
			normDist = maxPossibleDiff
		}
		magnitudeSim = 1 - 2*normDist/maxPossibleDiff
		if magnitudeSim > 1 {
			magnitudeSim = 1
		} else if magnitudeSim < -1 {
			magnitudeSim = -1
		}
	}

	return SimilarityPair{
		ShapeSim:     shapeSim,
		MagnitudeSim: magnitudeSim,
	}
}

// ------------------------------------------------------------
// 内部一致性 C_int 的重构计算
// ------------------------------------------------------------

// ComputeCIntFromTripletV2 基于三对双面相似度计算新的内部一致性 C_int。
// pairs 为三对非主导子结构 (如 m,b / m,c / b,c) 的 SimilarityPair，顺序任意。
// 规则：
//   - 符号由形状相似度的最小值（minShape）决定：minShape ≥ 0 → C_int ≥ 0，minShape < 0 → C_int < 0。
//   - 正区数值由平均幅度相似度与 minShape 调制的乘积决定。
//   - 负区数值由平均绝对形状相似度（为主）和平均幅度相似度（为辅）混合决定。
// 返回值范围 [-1, 1]。
func ComputeCIntFromTripletV2(pairs [3]SimilarityPair) float64 {
	shapeSims := [3]float64{pairs[0].ShapeSim, pairs[1].ShapeSim, pairs[2].ShapeSim}
	magSims := [3]float64{pairs[0].MagnitudeSim, pairs[1].MagnitudeSim, pairs[2].MagnitudeSim}

	// 形状最小值
	minShape := shapeSims[0]
	if shapeSims[1] < minShape {
		minShape = shapeSims[1]
	}
	if shapeSims[2] < minShape {
		minShape = shapeSims[2]
	}

	// 平均幅度（取绝对值以确保正值）
	meanMag := (math.Abs(magSims[0]) + math.Abs(magSims[1]) + math.Abs(magSims[2])) / 3.0

	var absCInt float64
	if minShape >= 0 {
		// ----- 无结构性对抗：正区 -----
		// 调制因子：形状最低值越高，越接近1，即使幅度低也能获得较高的 |C_int|
		modulation := 0.3 + 0.7*minShape // minShape ∈ [0,1] 对应调制 ∈ [0.3, 1.0]
		absCInt = meanMag * modulation
		if absCInt > 1.0 {
			absCInt = 1.0
		}
		return absCInt
	} else {
		// ----- 存在结构性对抗：负区 -----
		absShapeAvg := (math.Abs(shapeSims[0]) + math.Abs(shapeSims[1]) + math.Abs(shapeSims[2])) / 3.0
		absCInt = absShapeAvg*0.8 + meanMag*0.2
		if absCInt > 1.0 {
			absCInt = 1.0
		}
		return -absCInt
	}
}

// ------------------------------------------------------------
// 外部一致性（保持原接口）
// ------------------------------------------------------------

// ComputeExternalCoherence 计算外部一致性 C_ext。
// integratedSim 为主导统合结果与参考基线的相似度（标量，范围 [-1, 1]）。
func ComputeExternalCoherence(integratedSim float64) float64 {
	return integratedSim
}

// ------------------------------------------------------------
// 同步率计算（最终版，符号保留，正区不误判）
// ------------------------------------------------------------

// ComputeSyncRateFromParts 计算同步率 ρ（最终修正版）。
// 公式：
//   delta       = |C_int| - 0.80
//   oddsNorm    = |C_int| / (4 * (1 - |C_int|))
//   mainGain    = 1 + γ * C_ext * |delta|
//   corrTerm    = β * (C_ext - 0.25) * exp(-λ * delta²)
//   mag         = oddsNorm * mainGain + corrTerm
//   ρ           = sign(C_int) * mag
// 性质保证：
//   C_int > 0  →  ρ > 0
//   C_int = 0  →  ρ = 0
//   C_int < 0  →  ρ < 0
//   黄金稳态点 C_int = 0.80  →  ρ ≈ 1（修正项微调）
func ComputeSyncRateFromParts(cInt, cExt float64) SyncRate {
	// 钳位 C_int
	clamped := cInt
	if clamped >= 0.9999 {
		clamped = 0.9999
	} else if clamped <= -0.9999 {
		clamped = -0.9999
	}

	absCInt := math.Abs(clamped)
	delta := absCInt - 0.80

	// oddsNorm = |C_int| / (4 * (1 - |C_int|))
	var oddsNorm float64
	if absCInt >= 0.9999 {
		oddsNorm = 0.9999 / (4 * (1 - 0.9999))
	} else {
		oddsNorm = absCInt / (4 * (1 - absCInt))
	}

	mainGain := 1 + SyncRateGamma*cExt*math.Abs(delta)
	corrTerm := SyncRateBeta * (cExt - 0.618) * math.Exp(-SyncRateLambda*delta*delta)

	mag := oddsNorm*mainGain + corrTerm
	if mag < 0 {
		mag = 0
	}

	var rho float64
	if clamped > 0 {
		rho = mag
	} else if clamped < 0 {
		rho = -mag
	} else {
		rho = 0.0
	}

	return buildSyncRate(rho)
}

// buildSyncRate 根据 ρ 值划分区间。
func buildSyncRate(rho float64) SyncRate {
	zone := "resonance"
	if rho < 0.7 {
		zone = "dispersion"
	} else if rho > 1.3 {
		zone = "dissolution"
	}
	return SyncRate{
		Value: rho,
		Zone:  zone,
	}
}

// ------------------------------------------------------------
// 完整流程封装（示例）
// ------------------------------------------------------------

// ComputeSyncRateFull 从三贤者角色基底及主导统合与基线的相似度计算最终同步率。
// personas: 长度为4的切片，依次为 [I（主导）, m, b, c]
// baselineSim: I 与参考基线的相似度（C_ext）
// weights: 特质权重映射（可选，nil 表示等权）
// ComputeCIntFromTriplet 从三对非主导子结构的两两原始相似度计算 C_int。
// C_int = sign(min(mb, mc, bc)) × avg(|mb|, |mc|, |bc|)
// 保留以兼容当前 monitor 调用。新代码使用 ComputeCIntFromTripletV2。
func ComputeCIntFromTriplet(mb, mc, bc float64) float64 {
	minVal := mb
	if mc < minVal {
		minVal = mc
	}
	if bc < minVal {
		minVal = bc
	}
	absAvg := (math.Abs(mb) + math.Abs(mc) + math.Abs(bc)) / 3.0
	if minVal < 0 {
		return -absAvg
	}
	return absAvg
}

const (
	SyncRateGamma  = 2.0
	SyncRateBeta   = 0.3
	SyncRateLambda = 200.0
)

func absF64(a float64) float64 {
	if a < 0 {
		return -a
	}
	return a
}

func ComputeSyncRateFull(personas [4]*PersonaBase, baselineSim float64, weights map[string]float64) SyncRate {
	// 三对非主导子结构：(m,b), (m,c), (b,c)
	pairs := [3]SimilarityPair{
		ComputeBigFiveSimilarityDual(personas[1], personas[2], weights),
		ComputeBigFiveSimilarityDual(personas[1], personas[3], weights),
		ComputeBigFiveSimilarityDual(personas[2], personas[3], weights),
	}
	cInt := ComputeCIntFromTripletV2(pairs)
	cExt := ComputeExternalCoherence(baselineSim)
	return ComputeSyncRateFromParts(cInt, cExt)
}
