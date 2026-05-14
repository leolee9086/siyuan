package seraph

import "math"

// ComputeBigFiveSimilarity 计算两个PersonaBase的大五人格相似度
// 使用归一化欧氏距离：sim = 1 - 2 * sqrt(avg_weighted_sq_diff) ∈ [-1, 1]
// 1.0 = 完全一致（距离=0），-1.0 = 完全相反（距离=最大）
func ComputeBigFiveSimilarity(p1, p2 *PersonaBase, weights map[string]float64) float64 {
	if p1 == nil || p2 == nil {
		return 0
	}

	sumSq := 0.0
	sumW := 0.0

	for facetKey, val1 := range p1.Facets {
		val2, exists := p2.Facets[facetKey]
		if !exists {
			continue
		}

		weight := weights[facetKey]
		if weight == 0 {
			weight = 1.0
		}

		diff := val1 - val2
		sumSq += weight * diff * diff
		sumW += weight
	}

	if sumW == 0 {
		return 0
	}

	normalizedDist := math.Sqrt(sumSq / sumW)
	if normalizedDist > 1 {
		normalizedDist = 1
	}

	return 1 - 2*normalizedDist
}

// ComputeCompositeSimilarity 计算综合相似度
// alpha: 文体权重，建议0.35
func ComputeCompositeSimilarity(styleSim, bigFiveSim, alpha float64) float64 {
	return alpha*styleSim + (1-alpha)*bigFiveSim
}
