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
	"math/bits"
)

// =========================================
// BBQ 位运算点积
// 使用POPCNT优化的二进制向量运算
// =========================================

// 计算朴素点积 直接计算未打包量化向量的点积
// 适用于4-bit查询 x 1-bit索引
// 循环展开4x优化
// ComputeNaiveDotProduct 计算朴素点积 直接计算未打包量化向量的点积
// 适用于4-bit查询 x 1-bit索引
// 循环展开4x优化
func ComputeNaiveDotProduct(query []byte, index []byte) int {
	if len(query) != len(index) {
		return 0
	}

	sum := 0
	n := len(query)
	i := 0

	// 每次处理4个元素
	for ; i <= n-4; i += 4 {
		sum += int(query[i])*int(index[i]) +
			int(query[i+1])*int(index[i+1]) +
			int(query[i+2])*int(index[i+2]) +
			int(query[i+3])*int(index[i+3])
	}

	// 处理剩余元素
	for ; i < n; i++ {
		sum += int(query[i]) * int(index[i])
	}
	return sum
}

// ComputePackedDotProduct 计算打包位点积 使用POPCNT优化的1-bit点积
// 输入为打包的二进制向量 (8个维度压缩到1个字节)
func ComputePackedDotProduct(query []byte, index []byte) int {
	if len(query) != len(index) {
		return 0
	}

	// 使用AND计算同为1的位数
	sum := 0
	for i := 0; i < len(query); i++ {
		sum += bits.OnesCount8(query[i] & index[i])
	}
	return sum
}

// ComputePackedHammingDistance 计算打包汉明距离 计算两个打包二进制向量的汉明距离
func ComputePackedHammingDistance(a []byte, b []byte) int {
	if len(a) != len(b) {
		return 65535
	}

	dist := 0
	for i := 0; i < len(a); i++ {
		dist += bits.OnesCount8(a[i] ^ b[i])
	}
	return dist
}

// ComputePackedHammingDistance64 计算打包汉明距离64 使用uint64进行批量计算以提高性能
func ComputePackedHammingDistance64(a []uint64, b []uint64) int {
	if len(a) != len(b) {
		return 65535
	}

	dist := 0
	for i := 0; i < len(a); i++ {
		dist += bits.OnesCount64(a[i] ^ b[i])
	}
	return dist
}

// ComputePackedDotProduct64 计算打包位点积64 使用uint64进行批量计算以提高性能
func ComputePackedDotProduct64(query []uint64, index []uint64) int {
	if len(query) != len(index) {
		return 0
	}

	sum := 0
	for i := 0; i < len(query); i++ {
		sum += bits.OnesCount64(query[i] & index[i])
	}
	return sum
}

// BytesToUint64 字节转uint64 将字节数组转换为uint64数组
func BytesToUint64(data []byte) []uint64 {
	length := (len(data) + 7) / 8
	result := make([]uint64, length)

	for i := 0; i < len(data); i++ {
		idx := i / 8
		shift := uint(7-i%8) * 8
		result[idx] |= uint64(data[i]) << shift
	}

	return result
}

// BatchDotProductCalculator 批量点积计算器 批量计算点积 (用于HNSW搜索优化)
type BatchDotProductCalculator struct {
	Query       []byte             // 量化后的查询向量
	QueryPacked []byte             // 打包后的查询 (用于1-bit)
	Correction  QuantizationResult // 查询校正
	Use4Bit     bool
}

// NewBatchDotProductCalculator 新建批量点积计算器 创建批量计算器
func NewBatchDotProductCalculator(queryVec []float32, centroid []float32, use4Bit bool) *BatchDotProductCalculator {
	quantizer := NewScalarQuantizer(CosineSimilarity)

	var bits int
	if use4Bit {
		bits = 4
	} else {
		bits = 1
	}

	quantizedQuery := make([]byte, len(queryVec))
	correction := quantizer.Quantize(queryVec, quantizedQuery, bits, centroid)

	var packedQuery []byte
	if !use4Bit {
		packedQuery = PackBinary(quantizedQuery)
	}

	return &BatchDotProductCalculator{
		Query:       quantizedQuery,
		QueryPacked: packedQuery,
		Correction:  correction,
		Use4Bit:     use4Bit,
	}
}

// Compute 计算 计算与单个索引向量的点积
func (b *BatchDotProductCalculator) Compute(indexQuantized []byte, indexPacked []byte) int {
	if b.Use4Bit {
		return ComputeNaiveDotProduct(b.Query, indexQuantized)
	}
	return ComputePackedDotProduct(b.QueryPacked, indexPacked)
}
