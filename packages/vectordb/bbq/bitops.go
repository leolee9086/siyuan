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

// =========================================
// BitTranspose 布局与 POPCNT 加速点积
// 将4-bit数据按位平面组织，使4-bit×1-bit点积
// 可用 AND+POPCNT 实现，每64维仅需4次操作
// =========================================

// bitTransposeBlockDims 是 BitTranspose 布局中每个块覆盖的维度数。
// 每个块包含4个uint64（32字节），分别存储64个维度的bit-0到bit-3。
const bitTransposeBlockDims = 64

// bitTransposeBlockBytes 是每个 BitTranspose 块的字节数（4 × 8 = 32）。
const bitTransposeBlockBytes = 4 * 8

// PackBitTranspose4 将逐字节的4-bit量化数据转换为BitTranspose布局。
//
// 输入: data[i] 是第i维的4-bit量化值（0-15），每维1字节。
// 输出: BitTranspose格式的字节切片，维度向上对齐到64的倍数。
//
// BitTranspose布局（以64维为一个块）：
//
//	Block k (dim k*64 .. k*64+63):
//	  word0 (uint64, LE): 64个维度的 bit-0
//	  word1 (uint64, LE): 64个维度的 bit-1
//	  word2 (uint64, LE): 64个维度的 bit-2
//	  word3 (uint64, LE): 64个维度的 bit-3
//
// 位位置与 PackBinary 大端位序对齐：维度 d 在块内的 uint64 位位置为 (d%64)^7，
// 即每字节内的位序反转（高位在前），与 PackBinary 的 bitIdx = 7 - d%8 一致。
// 这确保 ComputeTransposedDotProduct 可直接使用 PackBinary 输出的 packed 1-bit 数据。
// 超出实际维度的填充位为0。
func PackBitTranspose4(data []byte) []byte {
	return PackBitTranspose4Into(data, nil)
}

// PackBitTranspose4Into 将 4-bit 数据写入可复用缓冲区。
func PackBitTranspose4Into(data, out []byte) []byte {
	dim := len(data)
	numBlocks := (dim + bitTransposeBlockDims - 1) / bitTransposeBlockDims
	required := numBlocks * bitTransposeBlockBytes
	if cap(out) < required {
		out = make([]byte, required)
	} else {
		out = out[:required]
	}

	for block := 0; block < numBlocks; block++ {
		blockStart := block * bitTransposeBlockDims
		var b0, b1, b2, b3 uint64

		// 确定本块实际覆盖的维度数
		blockEnd := blockStart + bitTransposeBlockDims
		if blockEnd > dim {
			blockEnd = dim
		}

		for j := blockStart; j < blockEnd; j++ {
			v := data[j]
			// 使用 XOR 7 将位位置与 PackBinary 的大端位序对齐：
			// PackBinary 中维度 d 在字节内的位位置为 7 - d%8，
			// 经 LittleEndian.Uint64 加载后在 uint64 中的位位置为 (d/8)*8 + (7 - d%8) = d^7（块内偏移）。
			bit := uint((j - blockStart) ^ 7)
			// 将4-bit值的每一位分散到对应的位平面
			b0 |= uint64((v>>0)&1) << bit
			b1 |= uint64((v>>1)&1) << bit
			b2 |= uint64((v>>2)&1) << bit
			b3 |= uint64((v>>3)&1) << bit
		}

		// 以小端序写入4个uint64
		off := block * bitTransposeBlockBytes
		binary.LittleEndian.PutUint64(out[off:], b0)
		binary.LittleEndian.PutUint64(out[off+8:], b1)
		binary.LittleEndian.PutUint64(out[off+16:], b2)
		binary.LittleEndian.PutUint64(out[off+24:], b3)
	}

	return out
}

// ComputeTransposedDotProduct 计算BitTranspose格式的4-bit查询与packed 1-bit索引的点积。
//
// 输入:
//   - transposed: PackBitTranspose4 输出的BitTranspose格式数据（4-bit查询）
//   - packed: 1-bit packed索引向量（每8维1字节，低位对应低维度）
//
// 输出: 点积结果（等价于 sum(query4bit[i] * index1bit[i])）
//
// 算法: 对每个64维块，从packed读取64个1-bit值（一个uint64），
// 与4个位平面分别AND后POPCNT，按权重1/2/4/8累加。
func ComputeTransposedDotProduct(transposed []byte, packed []byte) int {
	numBlocks := len(transposed) / bitTransposeBlockBytes
	packedLen := len(packed)
	sum := 0

	for i := 0; i < numBlocks; i++ {
		// 从packed中加载64个1-bit值为一个uint64
		var bitsWord uint64
		byteOff := i * 8
		if byteOff+8 <= packedLen {
			// 完整的8字节，直接读取
			bitsWord = binary.LittleEndian.Uint64(packed[byteOff:])
		} else {
			// 尾部不足8字节，逐字节组装
			for j := byteOff; j < packedLen && j < byteOff+8; j++ {
				bitsWord |= uint64(packed[j]) << (uint(j-byteOff) * 8)
			}
		}

		// 从transposed中加载4个位平面
		tOff := i * bitTransposeBlockBytes
		b0 := binary.LittleEndian.Uint64(transposed[tOff:])
		b1 := binary.LittleEndian.Uint64(transposed[tOff+8:])
		b2 := binary.LittleEndian.Uint64(transposed[tOff+16:])
		b3 := binary.LittleEndian.Uint64(transposed[tOff+24:])

		// AND + POPCNT，按位权重累加
		sum += bits.OnesCount64(bitsWord&b0) * 1
		sum += bits.OnesCount64(bitsWord&b1) * 2
		sum += bits.OnesCount64(bitsWord&b2) * 4
		sum += bits.OnesCount64(bitsWord&b3) * 8
	}

	return sum
}

// ComputeTransposedDotProductWords 计算已按 uint64 对齐的 4-bit×1-bit 点积。
func ComputeTransposedDotProductWords(queryWords, packedWords []uint64) int {
	sum := 0
	for block, bitsWord := range packedWords {
		offset := block * 4
		sum += bits.OnesCount64(bitsWord & queryWords[offset])
		sum += bits.OnesCount64(bitsWord&queryWords[offset+1]) * 2
		sum += bits.OnesCount64(bitsWord&queryWords[offset+2]) * 4
		sum += bits.OnesCount64(bitsWord&queryWords[offset+3]) * 8
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
