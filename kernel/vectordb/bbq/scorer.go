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

// ComputeQuantizedDistance 计算量化距离 将BBQ相似度转换为距离 (用于HNSW)
// 返回值越小表示越相似
func (s *QuantizedScorer) ComputeQuantizedDistance(dotProduct int, queryCorr, indexCorr QuantizationResult, dimension int, centroidDot float32, use4Bit bool) float32 {
	var score float32
	if use4Bit {
		score = s.ComputeScore4Bit(dotProduct, queryCorr, indexCorr, dimension, centroidDot)
	} else {
		score = s.ComputeScore1Bit(dotProduct, queryCorr, indexCorr, dimension, centroidDot)
	}
	// 相似度转距离: 分数越高距离越小
	// 对于余弦: 分数在[0,1], 距离=1-分数
	return 1.0 - score
}

// ScaleMaxInnerProductScore 缩放最大内积分数 将内积分数转换为正值
func ScaleMaxInnerProductScore(score float32) float32 {
	if score < 0 {
		return 1.0 / (1.0 - score)
	}
	return score + 1.0
}
