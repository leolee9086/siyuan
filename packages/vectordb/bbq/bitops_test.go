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
	"encoding/binary"
	"math/rand"
	"testing"
)

func TestComputeTransposedDotProductWordsMatchesBytePath(t *testing.T) {
	for _, dimension := range []int{64, 128, 384, 768} {
		query := make([]byte, dimension)
		data := make([]byte, dimension)
		for index := range query {
			query[index] = byte((index*7 + 3) & 15)
			data[index] = byte((index*11 + 1) & 1)
		}
		transposed := PackBitTranspose4(query)
		packed := PackBinary(data)
		queryWords := make([]uint64, len(transposed)/8)
		packedWords := make([]uint64, len(packed)/8)
		for index := range queryWords {
			queryWords[index] = binary.LittleEndian.Uint64(transposed[index*8:])
		}
		for index := range packedWords {
			packedWords[index] = binary.LittleEndian.Uint64(packed[index*8:])
		}
		bytesResult := ComputeTransposedDotProduct(transposed, packed)
		wordsResult := ComputeTransposedDotProductWords(queryWords, packedWords)
		if wordsResult != bytesResult {
			t.Fatalf("维度 %d 的 uint64 点积不一致：bytes=%d，words=%d", dimension, bytesResult, wordsResult)
		}
	}
}

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
// BitTranspose 布局测试
// =========================================

func TestPackBitTranspose4_KnownValues(t *testing.T) {
	// 手动构造：4个维度，值分别为 0, 1, 2, 15
	// dim=4 → 1个块（对齐到64维），32字节输出
	data := []byte{0, 1, 2, 15}
	out := PackBitTranspose4(data)

	if len(out) != 32 {
		t.Fatalf("输出长度 = %d, 期望 32", len(out))
	}

	// 验证：逐维度解包，确认与输入一致
	// 位位置使用 ^7 与 PackBinary 大端位序对齐
	for i := 0; i < 4; i++ {
		var val byte
		bit := uint(i ^ 7) // 大端位序：与 PackBinary 的 bitIdx = 7 - i%8 一致
		b0 := out[bit/8]
		b1 := out[8+bit/8]
		b2 := out[16+bit/8]
		b3 := out[24+bit/8]
		val |= ((b0 >> (bit % 8)) & 1) << 0
		val |= ((b1 >> (bit % 8)) & 1) << 1
		val |= ((b2 >> (bit % 8)) & 1) << 2
		val |= ((b3 >> (bit % 8)) & 1) << 3
		if val != data[i] {
			t.Errorf("维度 %d: 解包值 = %d, 期望 %d", i, val, data[i])
		}
	}

	// 验证填充位为0：维度4-63应该全为0
	for i := 4; i < 64; i++ {
		var val byte
		bit := uint(i ^ 7) // 大端位序
		b0 := out[bit/8]
		b1 := out[8+bit/8]
		b2 := out[16+bit/8]
		b3 := out[24+bit/8]
		val |= ((b0 >> (bit % 8)) & 1) << 0
		val |= ((b1 >> (bit % 8)) & 1) << 1
		val |= ((b2 >> (bit % 8)) & 1) << 2
		val |= ((b3 >> (bit % 8)) & 1) << 3
		if val != 0 {
			t.Errorf("填充维度 %d: 解包值 = %d, 期望 0", i, val)
		}
	}
}

func TestPackBitTranspose4_AllZero(t *testing.T) {
	data := make([]byte, 128)
	out := PackBitTranspose4(data)
	for i, b := range out {
		if b != 0 {
			t.Fatalf("全零输入: 输出字节[%d] = 0x%02X, 期望 0x00", i, b)
		}
	}
}

func TestPackBitTranspose4_AllMax(t *testing.T) {
	data := make([]byte, 64)
	for i := range data {
		data[i] = 15
	}
	out := PackBitTranspose4(data)
	// 1个块，32字节。每个位平面的uint64应该全为1（低64位）
	if len(out) != 32 {
		t.Fatalf("输出长度 = %d, 期望 32", len(out))
	}
	for p := 0; p < 4; p++ {
		for byteIdx := 0; byteIdx < 8; byteIdx++ {
			if out[p*8+byteIdx] != 0xFF {
				t.Errorf("位平面 %d 字节 %d = 0x%02X, 期望 0xFF", p, byteIdx, out[p*8+byteIdx])
			}
		}
	}
}

func TestPackBitTranspose4_RoundTrip(t *testing.T) {
	// 随机数据，验证打包后逐维解包与原始一致
	rng := rand.New(rand.NewSource(12345))
	for _, dim := range []int{1, 7, 63, 64, 65, 100, 128, 200, 256, 512} {
		t.Run("dim_"+itoa(dim), func(t *testing.T) {
			data := make([]byte, dim)
			for i := range data {
				data[i] = byte(rng.Intn(16))
			}
			out := PackBitTranspose4(data)

			numBlocks := (dim + 63) / 64
			if len(out) != numBlocks*32 {
				t.Fatalf("输出长度 = %d, 期望 %d", len(out), numBlocks*32)
			}

			// 逐维解包验证（使用 ^7 大端位序，与 PackBinary 一致）
			for i := 0; i < dim; i++ {
				block := i / 64
				bit := uint((i % 64) ^ 7) // 大端位序
				byteInBlock := bit / 8
				bitInByte := bit % 8
				base := block * 32

				var val byte
				val |= ((out[base+int(byteInBlock)] >> bitInByte) & 1) << 0
				val |= ((out[base+8+int(byteInBlock)] >> bitInByte) & 1) << 1
				val |= ((out[base+16+int(byteInBlock)] >> bitInByte) & 1) << 2
				val |= ((out[base+24+int(byteInBlock)] >> bitInByte) & 1) << 3
				if val != data[i] {
					t.Errorf("dim=%d 维度 %d: 解包 = %d, 期望 %d", dim, i, val, data[i])
				}
			}
		})
	}
}

// itoa 简单整数转字符串，避免引入 strconv
func itoa(n int) string {
	if n == 0 {
		return "0"
	}
	s := ""
	for n > 0 {
		s = string(rune('0'+n%10)) + s
		n /= 10
	}
	return s
}

// =========================================
// TransposedDotProduct 正确性测试
// =========================================

// naiveDotProduct4x1 参考实现：逐维计算 4-bit × 1-bit 点积
// 使用 PackBinary 大端位序：维度 d 在字节 d/8 的第 (7 - d%8) 位
func naiveDotProduct4x1(query4bit []byte, index1bit []byte) int {
	dim := len(query4bit)
	sum := 0
	for i := 0; i < dim; i++ {
		byteIdx := i / 8
		bitIdx := uint(7 - i%8) // 大端位序，与 PackBinary 一致
		if byteIdx < len(index1bit) {
			bit := (index1bit[byteIdx] >> bitIdx) & 1
			sum += int(query4bit[i]) * int(bit)
		}
	}
	return sum
}

func TestComputeTransposedDotProduct_VsNaive(t *testing.T) {
	rng := rand.New(rand.NewSource(42))
	for _, dim := range []int{1, 7, 63, 64, 65, 100, 128, 200, 256, 512} {
		t.Run("dim_"+itoa(dim), func(t *testing.T) {
			query := make([]byte, dim)
			for i := range query {
				query[i] = byte(rng.Intn(16))
			}
			packedBits := (dim + 7) / 8
			index := make([]byte, packedBits)
			for i := range index {
				index[i] = byte(rng.Intn(256))
			}

			// 清除超出维度的尾部位
			if dim%8 != 0 {
				mask := byte((1 << (dim % 8)) - 1)
				index[len(index)-1] &= mask
			}

			transposed := PackBitTranspose4(query)
			got := ComputeTransposedDotProduct(transposed, index)
			want := naiveDotProduct4x1(query, index)

			if got != want {
				t.Errorf("dim=%d: Transposed=%d, Naive=%d", dim, got, want)
			}
		})
	}
}

func TestComputeTransposedDotProduct_AllZeroQuery(t *testing.T) {
	query := make([]byte, 128)
	index := make([]byte, 16)
	for i := range index {
		index[i] = 0xFF
	}
	transposed := PackBitTranspose4(query)
	got := ComputeTransposedDotProduct(transposed, index)
	if got != 0 {
		t.Errorf("全零查询: 点积 = %d, 期望 0", got)
	}
}

func TestComputeTransposedDotProduct_AllZeroIndex(t *testing.T) {
	query := make([]byte, 128)
	for i := range query {
		query[i] = 15
	}
	index := make([]byte, 16)
	transposed := PackBitTranspose4(query)
	got := ComputeTransposedDotProduct(transposed, index)
	if got != 0 {
		t.Errorf("全零索引: 点积 = %d, 期望 0", got)
	}
}

func TestComputeTransposedDotProduct_AllMax(t *testing.T) {
	dim := 128
	query := make([]byte, dim)
	for i := range query {
		query[i] = 15
	}
	index := make([]byte, dim/8)
	for i := range index {
		index[i] = 0xFF
	}
	transposed := PackBitTranspose4(query)
	got := ComputeTransposedDotProduct(transposed, index)
	// 每维贡献 15*1 = 15，共128维
	want := 15 * dim
	if got != want {
		t.Errorf("全满: 点积 = %d, 期望 %d", got, want)
	}
}

// TestComputeTransposedDotProduct_VsComputeNaiveDotProduct 验证与现有 ComputeNaiveDotProduct 一致
func TestComputeTransposedDotProduct_VsComputeNaiveDotProduct(t *testing.T) {
	rng := rand.New(rand.NewSource(99))
	for _, dim := range []int{64, 128, 256, 512} {
		t.Run("dim_"+itoa(dim), func(t *testing.T) {
			for trial := 0; trial < 20; trial++ {
				query4bit := make([]byte, dim)
				for i := range query4bit {
					query4bit[i] = byte(rng.Intn(16))
				}
				// 生成1-bit packed索引
				packedLen := dim / 8
				indexPacked := make([]byte, packedLen)
				for i := range indexPacked {
					indexPacked[i] = byte(rng.Intn(256))
				}

				// 展开1-bit为逐字节（0或1）以供 ComputeNaiveDotProduct 使用
				// 使用 PackBinary 大端位序：维度 d 在字节 d/8 的第 (7 - d%8) 位
				indexExpanded := make([]byte, dim)
				for i := 0; i < dim; i++ {
					indexExpanded[i] = (indexPacked[i/8] >> uint(7-i%8)) & 1
				}

				wantNaive := ComputeNaiveDotProduct(query4bit, indexExpanded)

				transposed := PackBitTranspose4(query4bit)
				gotTransposed := ComputeTransposedDotProduct(transposed, indexPacked)

				if gotTransposed != wantNaive {
					t.Errorf("dim=%d trial=%d: Transposed=%d, Naive=%d",
						dim, trial, gotTransposed, wantNaive)
				}
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

// =========================================
// 4-bit×1-bit 点积: Naive vs Transposed 对比
// =========================================

// benchNaive4x1 辅助函数：准备 Naive 点积的输入数据
func benchNaive4x1(b *testing.B, dim int) {
	rng := rand.New(rand.NewSource(42))
	query := make([]byte, dim)
	for i := range query {
		query[i] = byte(rng.Intn(16))
	}
	// 生成packed 1-bit索引并展开为逐字节
	packedLen := dim / 8
	indexPacked := make([]byte, packedLen)
	for i := range indexPacked {
		indexPacked[i] = byte(rng.Intn(256))
	}
	indexExpanded := make([]byte, dim)
	for i := 0; i < dim; i++ {
		indexExpanded[i] = (indexPacked[i/8] >> uint(7-i%8)) & 1
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		ComputeNaiveDotProduct(query, indexExpanded)
	}
}

// benchTransposed4x1 辅助函数：准备 Transposed 点积的输入数据
func benchTransposed4x1(b *testing.B, dim int) {
	rng := rand.New(rand.NewSource(42))
	query := make([]byte, dim)
	for i := range query {
		query[i] = byte(rng.Intn(16))
	}
	packedLen := dim / 8
	indexPacked := make([]byte, packedLen)
	for i := range indexPacked {
		indexPacked[i] = byte(rng.Intn(256))
	}
	transposed := PackBitTranspose4(query)

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		ComputeTransposedDotProduct(transposed, indexPacked)
	}
}

func BenchmarkNaiveDotProduct4x1_128dim(b *testing.B)      { benchNaive4x1(b, 128) }
func BenchmarkNaiveDotProduct4x1_256dim(b *testing.B)      { benchNaive4x1(b, 256) }
func BenchmarkNaiveDotProduct4x1_512dim(b *testing.B)      { benchNaive4x1(b, 512) }
func BenchmarkTransposedDotProduct4x1_128dim(b *testing.B) { benchTransposed4x1(b, 128) }
func BenchmarkTransposedDotProduct4x1_256dim(b *testing.B) { benchTransposed4x1(b, 256) }
func BenchmarkTransposedDotProduct4x1_512dim(b *testing.B) { benchTransposed4x1(b, 512) }
