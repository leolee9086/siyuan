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

import (
	"math"
	"math/rand"
	"testing"
)

// =========================================
// quantizer.go 单元测试
// =========================================

func TestNewScalarQuantizer(t *testing.T) {
	q := NewScalarQuantizer(CosineSimilarity)
	if q == nil {
		t.Fatal("NewScalarQuantizer returned nil")
	}
	if q.lambda != DefaultLambda {
		t.Errorf("lambda = %f, want %f", q.lambda, DefaultLambda)
	}
	if q.iterations != DefaultIterations {
		t.Errorf("iterations = %d, want %d", q.iterations, DefaultIterations)
	}
	if q.similarity != CosineSimilarity {
		t.Errorf("similarity = %d, want %d", q.similarity, CosineSimilarity)
	}
}

func TestQuantize_1Bit_Euclidean(t *testing.T) {
	q := NewScalarQuantizer(EuclideanDistance)
	vector := []float32{0.5, -0.3, 0.8, -0.1, 0.6, -0.7, 0.2, 0.9}
	centroid := CreateZeroCentroid(len(vector))
	dest := make([]byte, len(vector))

	result := q.Quantize(vector, dest, 1, centroid)

	// 验证量化结果的基本属性
	if result.LowerBound >= result.UpperBound {
		t.Errorf("LowerBound(%f) >= UpperBound(%f)", result.LowerBound, result.UpperBound)
	}

	// 1-bit量化: dest 值只能是 0 或 1
	for i, v := range dest {
		if v != 0 && v != 1 {
			t.Errorf("dest[%d] = %d, want 0 or 1", i, v)
		}
	}

	// Euclidean 模式下 Correction 应该是 normSq
	var normSq float32
	for _, v := range vector {
		normSq += v * v
	}
	if math.Abs(float64(result.Correction-normSq)) > 0.01 {
		t.Errorf("Correction = %f, want normSq ~= %f", result.Correction, normSq)
	}
}

func TestQuantize_1Bit_Cosine(t *testing.T) {
	q := NewScalarQuantizer(CosineSimilarity)
	vector := []float32{0.5, -0.3, 0.8, -0.1}
	centroid := []float32{0.1, 0.1, 0.1, 0.1}
	dest := make([]byte, len(vector))

	result := q.Quantize(vector, dest, 1, centroid)

	// Cosine 模式下 Correction 应该是 centroidDot
	var centroidDot float32
	for i := range vector {
		centroidDot += vector[i] * centroid[i]
	}
	if math.Abs(float64(result.Correction-centroidDot)) > 0.001 {
		t.Errorf("Correction = %f, want centroidDot ~= %f", result.Correction, centroidDot)
	}
}

func TestQuantize_4Bit(t *testing.T) {
	q := NewScalarQuantizer(EuclideanDistance)
	vector := []float32{0.5, -0.3, 0.8, -0.1, 0.6, -0.7, 0.2, 0.9}
	centroid := CreateZeroCentroid(len(vector))
	dest := make([]byte, len(vector))

	result := q.Quantize(vector, dest, 4, centroid)

	if result.LowerBound >= result.UpperBound {
		t.Errorf("LowerBound(%f) >= UpperBound(%f)", result.LowerBound, result.UpperBound)
	}

	// 4-bit量化: dest 值在 0-15 范围内
	for i, v := range dest {
		if v > 15 {
			t.Errorf("dest[%d] = %d, want <= 15", i, v)
		}
	}
}

func TestQuantize_Deterministic(t *testing.T) {
	q := NewScalarQuantizer(CosineSimilarity)
	vector := []float32{0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8}
	centroid := CreateZeroCentroid(len(vector))

	dest1 := make([]byte, len(vector))
	r1 := q.Quantize(vector, dest1, 1, centroid)

	dest2 := make([]byte, len(vector))
	r2 := q.Quantize(vector, dest2, 1, centroid)

	// 相同输入应产生相同输出
	for i := range dest1 {
		if dest1[i] != dest2[i] {
			t.Errorf("dest[%d]: first=%d, second=%d", i, dest1[i], dest2[i])
		}
	}
	if r1.LowerBound != r2.LowerBound || r1.UpperBound != r2.UpperBound {
		t.Error("non-deterministic quantization bounds")
	}
}

func TestGetInitialInterval(t *testing.T) {
	q := NewScalarQuantizer(EuclideanDistance)

	tests := []struct {
		name   string
		bits   int
		stdDev float32
		mean   float32
		minVal float32
		maxVal float32
	}{
		{"1bit", 1, 1.0, 0.0, -3.0, 3.0},
		{"4bit", 4, 0.5, 0.1, -2.0, 2.0},
		{"8bit", 8, 1.0, 0.0, -5.0, 5.0},
		{"invalid_0bit", 0, 1.0, 0.0, -1.0, 1.0},
		{"invalid_9bit", 9, 1.0, 0.0, -1.0, 1.0},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			interval := q.GetInitialInterval(tt.bits, tt.stdDev, tt.mean, tt.minVal, tt.maxVal)

			if interval[0] > interval[1] {
				t.Errorf("lower(%f) > upper(%f)", interval[0], interval[1])
			}
			// 区间应在数据范围内
			if interval[0] < tt.minVal {
				t.Errorf("lower(%f) < minVal(%f)", interval[0], tt.minVal)
			}
			if interval[1] > tt.maxVal {
				t.Errorf("upper(%f) > maxVal(%f)", interval[1], tt.maxVal)
			}
		})
	}
}

func TestPackBinary(t *testing.T) {
	tests := []struct {
		name   string
		vector []byte
		want   []byte
	}{
		{
			name:   "空向量",
			vector: []byte{},
			want:   []byte{},
		},
		{
			name:   "全1_8位",
			vector: []byte{1, 1, 1, 1, 1, 1, 1, 1},
			want:   []byte{0xFF},
		},
		{
			name:   "全0_8位",
			vector: []byte{0, 0, 0, 0, 0, 0, 0, 0},
			want:   []byte{0x00},
		},
		{
			name:   "交替_10101010",
			vector: []byte{1, 0, 1, 0, 1, 0, 1, 0},
			want:   []byte{0xAA},
		},
		{
			name:   "不足8位_补零",
			vector: []byte{1, 1, 0},
			want:   []byte{0xC0}, // 11000000
		},
		{
			name:   "9位_跨两字节",
			vector: []byte{1, 1, 1, 1, 1, 1, 1, 1, 1},
			want:   []byte{0xFF, 0x80}, // 11111111 10000000
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := PackBinary(tt.vector)
			if len(got) != len(tt.want) {
				t.Fatalf("PackBinary() len = %d, want %d", len(got), len(tt.want))
			}
			for i := range got {
				if got[i] != tt.want[i] {
					t.Errorf("PackBinary()[%d] = 0x%02X, want 0x%02X", i, got[i], tt.want[i])
				}
			}
		})
	}
}

func TestCreateZeroCentroid(t *testing.T) {
	c := CreateZeroCentroid(128)
	if len(c) != 128 {
		t.Fatalf("len = %d, want 128", len(c))
	}
	for i, v := range c {
		if v != 0 {
			t.Errorf("centroid[%d] = %f, want 0", i, v)
		}
	}
}

// =========================================
// 基准测试
// =========================================

func BenchmarkQuantize_1Bit_128dim(b *testing.B) {
	q := NewScalarQuantizer(CosineSimilarity)
	rng := rand.New(rand.NewSource(42))
	vector := make([]float32, 128)
	for i := range vector {
		vector[i] = rng.Float32()*2 - 1
	}
	centroid := CreateZeroCentroid(128)
	dest := make([]byte, 128)

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		q.Quantize(vector, dest, 1, centroid)
	}
}

func BenchmarkQuantize_4Bit_128dim(b *testing.B) {
	q := NewScalarQuantizer(CosineSimilarity)
	rng := rand.New(rand.NewSource(42))
	vector := make([]float32, 128)
	for i := range vector {
		vector[i] = rng.Float32()*2 - 1
	}
	centroid := CreateZeroCentroid(128)
	dest := make([]byte, 128)

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		q.Quantize(vector, dest, 4, centroid)
	}
}
