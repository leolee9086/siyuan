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

package vectordb

import (
	"fmt"
	"math"

	"s-forge.local/vectordb/bbq"
)

// =========================================
// 距离计算函数
// =========================================

// CosineDistance 计算余弦距离
// 返回值范围 [0, 2]，0 表示完全相同，2 表示完全相反
// 8路展开 + 独立累加器打破数据依赖链
func CosineDistance(a, b []float32) float32 {
	if len(a) != len(b) || len(a) == 0 {
		return 2.0
	}

	n := len(a)
	var d0, d1, d2, d3, d4, d5, d6, d7 float32 // dot accumulators
	var a0, a1, a2, a3, a4, a5, a6, a7 float32 // normA accumulators
	var b0, b1, b2, b3, b4, b5, b6, b7 float32 // normB accumulators
	i := 0

	for ; i <= n-8; i += 8 {
		d0 += a[i] * b[i]
		d1 += a[i+1] * b[i+1]
		d2 += a[i+2] * b[i+2]
		d3 += a[i+3] * b[i+3]
		d4 += a[i+4] * b[i+4]
		d5 += a[i+5] * b[i+5]
		d6 += a[i+6] * b[i+6]
		d7 += a[i+7] * b[i+7]
		a0 += a[i] * a[i]
		a1 += a[i+1] * a[i+1]
		a2 += a[i+2] * a[i+2]
		a3 += a[i+3] * a[i+3]
		a4 += a[i+4] * a[i+4]
		a5 += a[i+5] * a[i+5]
		a6 += a[i+6] * a[i+6]
		a7 += a[i+7] * a[i+7]
		b0 += b[i] * b[i]
		b1 += b[i+1] * b[i+1]
		b2 += b[i+2] * b[i+2]
		b3 += b[i+3] * b[i+3]
		b4 += b[i+4] * b[i+4]
		b5 += b[i+5] * b[i+5]
		b6 += b[i+6] * b[i+6]
		b7 += b[i+7] * b[i+7]
	}

	dotProduct := d0 + d1 + d2 + d3 + d4 + d5 + d6 + d7
	normA := a0 + a1 + a2 + a3 + a4 + a5 + a6 + a7
	normB := b0 + b1 + b2 + b3 + b4 + b5 + b6 + b7

	for ; i < n; i++ {
		dotProduct += a[i] * b[i]
		normA += a[i] * a[i]
		normB += b[i] * b[i]
	}

	if normA == 0 || normB == 0 {
		return 1.0
	}

	similarity := dotProduct / (float32(math.Sqrt(float64(normA))) * float32(math.Sqrt(float64(normB))))
	distance := 1.0 - similarity

	if distance < 0 {
		distance = 0
	}
	if distance > 2 {
		distance = 2
	}

	return distance
}

// CosineDistanceWithNorm 使用预计算范数的余弦距离
// 8路展开 + 独立累加器
func CosineDistanceWithNorm(a, b []float32, normA, normB float32) float32 {
	if len(a) != len(b) || len(a) == 0 {
		return 2.0
	}

	if normA == 0 || normB == 0 {
		return 1.0
	}

	n := len(a)
	var s0, s1, s2, s3, s4, s5, s6, s7 float32
	i := 0

	for ; i <= n-8; i += 8 {
		s0 += a[i] * b[i]
		s1 += a[i+1] * b[i+1]
		s2 += a[i+2] * b[i+2]
		s3 += a[i+3] * b[i+3]
		s4 += a[i+4] * b[i+4]
		s5 += a[i+5] * b[i+5]
		s6 += a[i+6] * b[i+6]
		s7 += a[i+7] * b[i+7]
	}
	dotProduct := s0 + s1 + s2 + s3 + s4 + s5 + s6 + s7
	for ; i < n; i++ {
		dotProduct += a[i] * b[i]
	}

	similarity := dotProduct / (normA * normB)
	distance := 1.0 - similarity

	if distance < 0 {
		distance = 0
	}
	if distance > 2 {
		distance = 2
	}

	return distance
}

// L2Distance 计算欧几里得距离的平方
// 8路展开 + 独立累加器打破数据依赖链
func L2Distance(a, b []float32) float32 {
	if len(a) != len(b) || len(a) == 0 {
		return float32(math.MaxFloat32)
	}

	n := len(a)
	var s0, s1, s2, s3, s4, s5, s6, s7 float32
	i := 0

	for ; i <= n-8; i += 8 {
		d0 := a[i] - b[i]
		d1 := a[i+1] - b[i+1]
		d2 := a[i+2] - b[i+2]
		d3 := a[i+3] - b[i+3]
		d4 := a[i+4] - b[i+4]
		d5 := a[i+5] - b[i+5]
		d6 := a[i+6] - b[i+6]
		d7 := a[i+7] - b[i+7]
		s0 += d0 * d0
		s1 += d1 * d1
		s2 += d2 * d2
		s3 += d3 * d3
		s4 += d4 * d4
		s5 += d5 * d5
		s6 += d6 * d6
		s7 += d7 * d7
	}
	sum := s0 + s1 + s2 + s3 + s4 + s5 + s6 + s7
	for ; i < n; i++ {
		d := a[i] - b[i]
		sum += d * d
	}

	return sum
}

// DotProduct 计算向量点积，使用八路独立累加器缩短依赖链。
func DotProduct(a, b []float32) float32 {
	if len(a) != len(b) || len(a) == 0 {
		return 0
	}
	n := len(a)
	var s0, s1, s2, s3, s4, s5, s6, s7 float32
	i := 0
	for ; i <= n-8; i += 8 {
		s0 += a[i] * b[i]
		s1 += a[i+1] * b[i+1]
		s2 += a[i+2] * b[i+2]
		s3 += a[i+3] * b[i+3]
		s4 += a[i+4] * b[i+4]
		s5 += a[i+5] * b[i+5]
		s6 += a[i+6] * b[i+6]
		s7 += a[i+7] * b[i+7]
	}
	sum := s0 + s1 + s2 + s3 + s4 + s5 + s6 + s7
	for ; i < n; i++ {
		sum += a[i] * b[i]
	}
	return sum
}

func vectorDistance(a, b []float32, metric string) float32 {
	switch metric {
	case "l2", "euclidean":
		return L2Distance(a, b)
	case "ip", "dot", "innerproduct":
		return -DotProduct(a, b)
	default:
		return CosineDistance(a, b)
	}
}

// ComputeNorm 计算向量模长
func ComputeNorm(v []float32) float32 {
	var sum float32
	for _, val := range v {
		sum += val * val
	}
	return float32(math.Sqrt(float64(sum)))
}

// NormalizeVector 归一化向量（原地修改）
func NormalizeVector(v []float32) {
	norm := ComputeNorm(v)
	if norm == 0 {
		return
	}
	for i := range v {
		v[i] /= norm
	}
}

func prepareVectorForMetric(vector []float32, metric string) ([]float32, error) {
	var normSquare float64
	for dimension, value := range vector {
		if math.IsNaN(float64(value)) || math.IsInf(float64(value), 0) {
			return nil, fmt.Errorf("%w at dimension %d", ErrVectorValueInvalid, dimension)
		}
		normSquare += float64(value) * float64(value)
	}
	if metric != "cosine" {
		return vector, nil
	}
	if normSquare == 0 {
		return nil, fmt.Errorf("%w: cosine vector has zero norm", ErrVectorValueInvalid)
	}
	if math.Abs(normSquare-1) <= 1e-6 {
		return vector, nil
	}
	prepared := make([]float32, len(vector))
	inverseNorm := float32(1 / math.Sqrt(normSquare))
	for dimension, value := range vector {
		prepared[dimension] = value * inverseNorm
	}
	return prepared, nil
}

func similarityMetricName(metric bbq.SimilarityType) string {
	switch metric {
	case bbq.CosineSimilarity:
		return "cosine"
	case bbq.MaxInnerProduct:
		return "ip"
	default:
		return "l2"
	}
}

func collectionMetricName(collection VectorCollection) string {
	switch typed := collection.(type) {
	case *Collection:
		return typed.Config.MetricType
	case *VamanaCollection:
		return similarityMetricName(typed.Index.DistanceMetric())
	default:
		return "l2"
	}
}
