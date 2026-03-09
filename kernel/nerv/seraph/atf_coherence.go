package seraph

// ComputeInternalCoherence 计算内部一致性 C_int
// 计算所有4个AI（Trinity + 3贤人）之间的平均相似度
func ComputeInternalCoherence(similarities map[string]float64) float64 {
	// 6对组合: (T,m), (T,b), (T,c), (m,b), (m,c), (b,c)
	if len(similarities) == 0 {
		return 0
	}

	sum := 0.0
	count := 0
	for _, sim := range similarities {
		sum += sim
		count++
	}

	if count == 0 {
		return 0
	}

	return sum / float64(count)
}

// ComputeExternalCoherence 计算外部一致性 C_ext
// Trinity与参考基线的相似度
func ComputeExternalCoherence(trinitySim float64) float64 {
	return trinitySim
}

// ComputeRawCoherence 计算原始一致性分数 C
// beta: 内外权重，建议0.6
func ComputeRawCoherence(cInt, cExt, beta float64) float64 {
	return beta*cInt + (1-beta)*cExt
}

// ComputeSyncRate 计算同步率 ρ (赔率变换)
func ComputeSyncRate(rawCoherence float64) SyncRate {
	// 避免除零和数值溢出
	if rawCoherence >= 0.9999 {
		rawCoherence = 0.9999
	}
	if rawCoherence <= 0.0001 {
		rawCoherence = 0.0001
	}

	// ρ = C / (1 - C)
	rho := rawCoherence / (1 - rawCoherence)

	// 确定区间
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
