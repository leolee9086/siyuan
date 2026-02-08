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
	"math/rand"
	"testing"
)

// =========================================
// bitops.go 单元测试
// =========================================

func TestComputeNaiveDotProduct(t *testing.T) {
	tests := []struct {
		name  string
		query []byte
		index []byte
		want  int
	}{
		{
			name:  "空切片",
			query: []byte{},
			index: []byte{},
			want:  0,
		},
		{
			name:  "长度不等返回0",
			query: []byte{1, 2},
			index: []byte{1},
			want:  0,
		},
		{
			name:  "单元素",
			query: []byte{3},
			index: []byte{4},
			want:  12,
		},
		{
			name:  "4元素_循环展开路径",
			query: []byte{1, 2, 3, 4},
			index: []byte{5, 6, 7, 8},
			want:  1*5 + 2*6 + 3*7 + 4*8, // 5+12+21+32=70
		},
		{
			name:  "5元素_展开加余数",
			query: []byte{1, 2, 3, 4, 5},
			index: []byte{1, 1, 1, 1, 1},
			want:  15,
		},
		{
			name:  "全零",
			query: []byte{0, 0, 0, 0},
			index: []byte{1, 2, 3, 4},
			want:  0,
		},
		{
			name:  "8元素_两轮展开",
			query: []byte{1, 1, 1, 1, 1, 1, 1, 1},
			index: []byte{2, 2, 2, 2, 2, 2, 2, 2},
			want:  16,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := ComputeNaiveDotProduct(tt.query, tt.index)
			if got != tt.want {
				t.Errorf("ComputeNaiveDotProduct() = %d, want %d", got, tt.want)
			}
		})
	}
}

func TestComputePackedDotProduct(t *testing.T) {
	tests := []struct {
		name  string
		query []byte
		index []byte
		want  int
	}{
		{
			name:  "空切片",
			query: []byte{},
			index: []byte{},
			want:  0,
		},
		{
			name:  "长度不等返回0",
			query: []byte{0xFF},
			index: []byte{0xFF, 0x00},
			want:  0,
		},
		{
			name:  "全1_AND_全1",
			query: []byte{0xFF},
			index: []byte{0xFF},
			want:  8,
		},
		{
			name:  "全1_AND_全0",
			query: []byte{0xFF},
			index: []byte{0x00},
			want:  0,
		},
		{
			name:  "交替位",
			query: []byte{0xAA}, // 10101010
			index: []byte{0x55}, // 01010101
			want:  0,
		},
		{
			name:  "部分重叠",
			query: []byte{0xF0}, // 11110000
			index: []byte{0xFF}, // 11111111
			want:  4,
		},
		{
			name:  "多字节",
			query: []byte{0xFF, 0x00, 0x0F},
			index: []byte{0xFF, 0xFF, 0x0F},
			want:  8 + 0 + 4, // 12
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := ComputePackedDotProduct(tt.query, tt.index)
			if got != tt.want {
				t.Errorf("ComputePackedDotProduct() = %d, want %d", got, tt.want)
			}
		})
	}
}

func TestComputePackedHammingDistance(t *testing.T) {
	tests := []struct {
		name string
		a    []byte
		b    []byte
		want int
	}{
		{
			name: "相同向量距离为0",
			a:    []byte{0xFF, 0x00},
			b:    []byte{0xFF, 0x00},
			want: 0,
		},
		{
			name: "长度不等返回65535",
			a:    []byte{0xFF},
			b:    []byte{0xFF, 0x00},
			want: 65535,
		},
		{
			name: "完全不同",
			a:    []byte{0xFF},
			b:    []byte{0x00},
			want: 8,
		},
		{
			name: "一位不同",
			a:    []byte{0x01},
			b:    []byte{0x00},
			want: 1,
		},
		{
			name: "多字节",
			a:    []byte{0xFF, 0xFF},
			b:    []byte{0x00, 0x00},
			want: 16,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := ComputePackedHammingDistance(tt.a, tt.b)
			if got != tt.want {
				t.Errorf("ComputePackedHammingDistance() = %d, want %d", got, tt.want)
			}
		})
	}
}

func TestComputePackedDotProduct64(t *testing.T) {
	tests := []struct {
		name  string
		query []uint64
		index []uint64
		want  int
	}{
		{
			name:  "空切片",
			query: []uint64{},
			index: []uint64{},
			want:  0,
		},
		{
			name:  "长度不等返回0",
			query: []uint64{0xFFFFFFFFFFFFFFFF},
			index: []uint64{0xFFFFFFFFFFFFFFFF, 0},
			want:  0,
		},
		{
			name:  "全1_AND_全1",
			query: []uint64{0xFFFFFFFFFFFFFFFF},
			index: []uint64{0xFFFFFFFFFFFFFFFF},
			want:  64,
		},
		{
			name:  "全1_AND_全0",
			query: []uint64{0xFFFFFFFFFFFFFFFF},
			index: []uint64{0},
			want:  0,
		},
		{
			name:  "多元素",
			query: []uint64{0xFFFFFFFFFFFFFFFF, 0x00FF00FF00FF00FF},
			index: []uint64{0xFFFFFFFFFFFFFFFF, 0x00FF00FF00FF00FF},
			want:  64 + 32,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := ComputePackedDotProduct64(tt.query, tt.index)
			if got != tt.want {
				t.Errorf("ComputePackedDotProduct64() = %d, want %d", got, tt.want)
			}
		})
	}
}

func TestComputePackedHammingDistance64(t *testing.T) {
	tests := []struct {
		name string
		a    []uint64
		b    []uint64
		want int
	}{
		{
			name: "相同向量距离为0",
			a:    []uint64{0xFFFFFFFFFFFFFFFF},
			b:    []uint64{0xFFFFFFFFFFFFFFFF},
			want: 0,
		},
		{
			name: "长度不等返回65535",
			a:    []uint64{0},
			b:    []uint64{0, 0},
			want: 65535,
		},
		{
			name: "完全不同",
			a:    []uint64{0xFFFFFFFFFFFFFFFF},
			b:    []uint64{0},
			want: 64,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := ComputePackedHammingDistance64(tt.a, tt.b)
			if got != tt.want {
				t.Errorf("ComputePackedHammingDistance64() = %d, want %d", got, tt.want)
			}
		})
	}
}

func TestBytesToUint64(t *testing.T) {
	tests := []struct {
		name string
		data []byte
		want []uint64
	}{
		{
			name: "空切片",
			data: []byte{},
			want: []uint64{},
		},
		{
			name: "单字节",
			data: []byte{0xFF},
			// shift = (7-0%8)*8 = 56, result[0] = 0xFF << 56
			want: []uint64{0xFF00000000000000},
		},
		{
			name: "8字节完整",
			data: []byte{0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08},
			want: []uint64{0x0102030405060708},
		},
		{
			name: "9字节跨两个uint64",
			data: []byte{0xFF, 0, 0, 0, 0, 0, 0, 0, 0xAA},
			want: []uint64{0xFF00000000000000, 0xAA00000000000000},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := BytesToUint64(tt.data)
			if len(got) != len(tt.want) {
				t.Fatalf("BytesToUint64() len = %d, want %d", len(got), len(tt.want))
			}
			for i := range got {
				if got[i] != tt.want[i] {
					t.Errorf("BytesToUint64()[%d] = 0x%X, want 0x%X", i, got[i], tt.want[i])
				}
			}
		})
	}
}

// TestBytesToUint64_DotProductConsistency 验证 byte 版本和 uint64 版本的点积结果一致
func TestBytesToUint64_DotProductConsistency(t *testing.T) {
	rng := rand.New(rand.NewSource(42))

	for _, size := range []int{8, 16, 24, 32, 64, 128} {
		t.Run("size_"+string(rune('0'+size/10))+string(rune('0'+size%10)), func(t *testing.T) {
			a := make([]byte, size)
			b := make([]byte, size)
			for i := range a {
				a[i] = byte(rng.Intn(256))
				b[i] = byte(rng.Intn(256))
			}

			dotByte := ComputePackedDotProduct(a, b)
			a64 := BytesToUint64(a)
			b64 := BytesToUint64(b)
			dot64 := ComputePackedDotProduct64(a64, b64)

			if dotByte != dot64 {
				t.Errorf("size=%d: byte dot=%d, uint64 dot=%d", size, dotByte, dot64)
			}
		})
	}
}

// =========================================
// 基准测试
// =========================================

func BenchmarkComputePackedDotProduct_128dim(b *testing.B) {
	// 128维 -> 16字节打包
	rng := rand.New(rand.NewSource(42))
	query := make([]byte, 16)
	index := make([]byte, 16)
	for i := range query {
		query[i] = byte(rng.Intn(256))
		index[i] = byte(rng.Intn(256))
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		ComputePackedDotProduct(query, index)
	}
}

func BenchmarkComputePackedDotProduct64_128dim(b *testing.B) {
	rng := rand.New(rand.NewSource(42))
	query := make([]byte, 16)
	index := make([]byte, 16)
	for i := range query {
		query[i] = byte(rng.Intn(256))
		index[i] = byte(rng.Intn(256))
	}
	q64 := BytesToUint64(query)
	i64 := BytesToUint64(index)

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		ComputePackedDotProduct64(q64, i64)
	}
}

func BenchmarkBytesToUint64_128dim(b *testing.B) {
	rng := rand.New(rand.NewSource(42))
	data := make([]byte, 16)
	for i := range data {
		data[i] = byte(rng.Intn(256))
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		BytesToUint64(data)
	}
}

func BenchmarkComputePackedDotProduct_768dim(b *testing.B) {
	// 768维 -> 96字节打包
	rng := rand.New(rand.NewSource(42))
	query := make([]byte, 96)
	index := make([]byte, 96)
	for i := range query {
		query[i] = byte(rng.Intn(256))
		index[i] = byte(rng.Intn(256))
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		ComputePackedDotProduct(query, index)
	}
}

func BenchmarkComputePackedDotProduct64_768dim(b *testing.B) {
	rng := rand.New(rand.NewSource(42))
	query := make([]byte, 96)
	index := make([]byte, 96)
	for i := range query {
		query[i] = byte(rng.Intn(256))
		index[i] = byte(rng.Intn(256))
	}
	q64 := BytesToUint64(query)
	i64 := BytesToUint64(index)

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		ComputePackedDotProduct64(q64, i64)
	}
}
