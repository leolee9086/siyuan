// SiYuan - Refactor your thinking
// Copyright (c) 2020-present, b3log.org
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program.  If not, see <https://www.gnu.org/licenses/>.

package bbq

// =========================================
// BBQ 量化评分器
// 使用校正因子精确还原相似度
// =========================================

// QuantizedScorer 量化评分器 使用校正因子精确还原相似度
type QuantizedScorer struct {
	similarity SimilarityType
}

// NewQuantizedScorer 新建量化评分器 创建评分器实例
func NewQuantizedScorer(similarity SimilarityType) *QuantizedScorer {
	return &QuantizedScorer{similarity: similarity}
}

// ComputeScore1Bit 计算一位评分 计算1-bit量化向量的相似度
// 参数:
//   - dotProduct: 量化向量的点积 (通过ComputePackedDotProduct计算)
//   - queryCorr: 查询向量的量化结果
//   - indexCorr: 索引向量的量化结果
//   - dimension: 向量维度
//   - centroidDot: 查询与质心的点积 (余弦/内积时使用)
func (s *QuantizedScorer) ComputeScore1Bit(dotProduct int, queryCorr, indexCorr QuantizationResult, dimension int, centroidDot float32) float32 {
	x1 := indexCorr.QuantizedSum
	ax := indexCorr.LowerBound
	lx := indexCorr.UpperBound - ax
	ay := queryCorr.LowerBound
	ly := queryCorr.UpperBound - ay
	y1 := queryCorr.QuantizedSum

	// 还原点积估计
	score := ax*ay*float32(dimension) +
		ay*lx*x1 +
		ax*ly*y1 +
		lx*ly*float32(dotProduct)

	switch s.similarity {
	case EuclideanDistance:
		euclidScore := queryCorr.Correction + indexCorr.Correction - 2.0*score
		result := 1.0 / (1.0 + euclidScore)
		if result < 0 {
			return 0
		}
		return result
	case CosineSimilarity:
		score += queryCorr.Correction + indexCorr.Correction - centroidDot
		result := (1.0 + score) / 2.0
		if result < 0 {
			return 0
		}
		return result
	case MaxInnerProduct:
		score += queryCorr.Correction + indexCorr.Correction - centroidDot
		return ScaleMaxInnerProductScore(score)
	}
	return 0
}

// ComputeScore4Bit 计算四位评分 计算4-bit查询 + 1-bit索引的相似度
func (s *QuantizedScorer) ComputeScore4Bit(dotProduct int, queryCorr, indexCorr QuantizationResult, dimension int, centroidDot float32) float32 {
	x1 := indexCorr.QuantizedSum
	ax := indexCorr.LowerBound
	lx := indexCorr.UpperBound - ax
	ay := queryCorr.LowerBound
	ly := (queryCorr.UpperBound - ay) * ScalingFactor4Bit // 4-bit需要缩放
	y1 := queryCorr.QuantizedSum

	score := ax*ay*float32(dimension) +
		ay*lx*x1 +
		ax*ly*y1 +
		lx*ly*float32(dotProduct)

	switch s.similarity {
	case EuclideanDistance:
		euclidScore := queryCorr.Correction + indexCorr.Correction - 2.0*score
		result := 1.0 / (1.0 + euclidScore)
		if result < 0 {
			return 0
		}
		return result
	case CosineSimilarity, MaxInnerProduct:
		adjustedScore := score + queryCorr.Correction + indexCorr.Correction - centroidDot
		if s.similarity == MaxInnerProduct {
			return ScaleMaxInnerProductScore(adjustedScore)
		}
		result := (1.0 + adjustedScore) / 2.0
		if result < 0 {
			return 0
		}
		return result
	}
	return 0
}

// ComputeQuantizedDistance 计算量化距离，返回值越小表示越相似。
//
// 对于 EuclideanDistance 模式：直接返回原始欧氏距离平方估计值，
// 保持与图构建使用的 euclideanDistance() 相同的数值尺度，
// 避免 1/(1+d²) 饱和变换导致的距离区分度丧失。
//
// 对于 CosineSimilarity/MaxInnerProduct 模式：返回 1-score（相似度转距离）。
func (s *QuantizedScorer) ComputeQuantizedDistance(dotProduct int, queryCorr, indexCorr QuantizationResult, dimension int, centroidDot float32, use4Bit bool) float32 {
	if s.similarity == EuclideanDistance {
		// 直接计算原始欧氏距离平方估计值，不经过饱和变换
		return s.computeEuclideanDistanceEstimate(dotProduct, queryCorr, indexCorr, dimension, use4Bit)
	}

	var score float32
	if use4Bit {
		score = s.ComputeScore4Bit(dotProduct, queryCorr, indexCorr, dimension, centroidDot)
	} else {
		score = s.ComputeScore1Bit(dotProduct, queryCorr, indexCorr, dimension, centroidDot)
	}
	// 相似度转距离: 分数越高距离越小
	return 1.0 - score
}

// computeEuclideanDistanceEstimate 直接计算欧氏距离平方的 BBQ 估计值。
//
// 公式: ||q - x||² ≈ ||q||² + ||x||² - 2 * <q_hat, x_hat>
// 其中 <q_hat, x_hat> 通过量化区间参数还原点积估计。
// Correction 在 EuclideanDistance 模式下存储的是 normSq（向量范数平方）。
func (s *QuantizedScorer) computeEuclideanDistanceEstimate(dotProduct int, queryCorr, indexCorr QuantizationResult, dimension int, use4Bit bool) float32 {
	x1 := indexCorr.QuantizedSum
	ax := indexCorr.LowerBound
	lx := indexCorr.UpperBound - ax
	ay := queryCorr.LowerBound
	ly := queryCorr.UpperBound - ay
	if use4Bit {
		ly *= ScalingFactor4Bit
	}
	y1 := queryCorr.QuantizedSum

	// 还原点积估计
	dotEst := ax*ay*float32(dimension) +
		ay*lx*x1 +
		ax*ly*y1 +
		lx*ly*float32(dotProduct)

	// 原始欧氏距离平方: ||q||² + ||x||² - 2*<q,x>
	dist := queryCorr.Correction + indexCorr.Correction - 2.0*dotEst
	if dist < 0 {
		dist = 0
	}
	return dist
}

// ScaleMaxInnerProductScore 缩放最大内积分数 将内积分数转换为正值
func ScaleMaxInnerProductScore(score float32) float32 {
	if score < 0 {
		return 1.0 / (1.0 - score)
	}
	return score + 1.0
}
