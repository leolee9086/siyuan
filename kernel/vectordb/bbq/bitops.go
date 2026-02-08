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
	"math/bits"
)

// =========================================
// BBQ 位运算点积
// 使用POPCNT优化的二进制向量运算
// =========================================

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
// 使用 binary.BigEndian.Uint64 + OnesCount64 批量处理以利用64位POPCNT指令，
// 剩余不足8字节的尾部使用逐字节 OnesCount8 处理。
func ComputePackedDotProduct(query []byte, index []byte) int {
	if len(query) != len(index) {
		return 0
	}

	n := len(query)
	sum := 0
	i := 0
	for ; i <= n-8; i += 8 {
		q64 := binary.BigEndian.Uint64(query[i : i+8])
		i64 := binary.BigEndian.Uint64(index[i : i+8])
		sum += bits.OnesCount64(q64 & i64)
	}
	for ; i < n; i++ {
		sum += bits.OnesCount8(query[i] & index[i])
	}
	return sum
}

// ComputePackedHammingDistance 计算打包汉明距离 计算两个打包二进制向量的汉明距离
// 使用 binary.BigEndian.Uint64 + OnesCount64 批量处理以利用64位POPCNT指令，
// 剩余不足8字节的尾部使用逐字节 OnesCount8 处理。
func ComputePackedHammingDistance(a []byte, b []byte) int {
	if len(a) != len(b) {
		return 65535
	}

	n := len(a)
	dist := 0
	i := 0
	for ; i <= n-8; i += 8 {
		a64 := binary.BigEndian.Uint64(a[i : i+8])
		b64 := binary.BigEndian.Uint64(b[i : i+8])
		dist += bits.OnesCount64(a64 ^ b64)
	}
	for ; i < n; i++ {
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
// 注意: 此函数会分配新的切片。在热路径上应优先使用
// ComputePackedDotProduct/ComputePackedHammingDistance 的内联uint64处理，
// 或在存储时直接保持 []uint64 格式以避免转换开销。
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
