package seraph

import "math"

// ComputeBigFiveSimilarity 计算两个PersonaBase的大五人格相似度
// 使用加权Frobenius内积，归一化到[-1,1]
func ComputeBigFiveSimilarity(p1, p2 *PersonaBase, weights map[string]float64) float64 {
	if p1 == nil || p2 == nil {
		return 0
	}

	// 默认权重：所有facet权重为1.0
	if weights == nil {
		weights = make(map[string]float64)
	}

	// 计算加权内积和模长
	dotProduct := 0.0
	norm1 := 0.0
	norm2 := 0.0

	// 遍历所有facets
	for facetKey, val1 := range p1.Facets {
		val2, exists := p2.Facets[facetKey]
		if !exists {
			continue
		}

		weight := weights[facetKey]
		if weight == 0 {
			weight = 1.0
		}

		weightedVal1 := weight * val1
		weightedVal2 := weight * val2

		dotProduct += weightedVal1 * weightedVal2
		norm1 += weightedVal1 * weightedVal1
		norm2 += weightedVal2 * weightedVal2
	}

	if norm1 == 0 || norm2 == 0 {
		return 0
	}

	// 余弦相似度
	cosineSim := dotProduct / (math.Sqrt(norm1) * math.Sqrt(norm2))

	// 归一化到[-1,1]（余弦相似度本身就在[-1,1]）
	return cosineSim
}

// ComputeCompositeSimilarity 计算综合相似度
// alpha: 文体权重，建议0.35
func ComputeCompositeSimilarity(styleSim, bigFiveSim, alpha float64) float64 {
	return alpha*styleSim + (1-alpha)*bigFiveSim
}
