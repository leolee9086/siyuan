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
	"math/bits"
)

// =========================================
// BBQ 位运算点积
// 使用POPCNT优化的二进制向量运算
// =========================================

// 计算朴素点积 直接计算未打包量化向量的点积
// 适用于4-bit查询 x 1-bit索引
// 循环展开4x优化
func 计算朴素点积(查询 []byte, 索引 []byte) int {
	if len(查询) != len(索引) {
		return 0
	}
	
	和 := 0
	n := len(查询)
	i := 0
	
	// 每次处理4个元素
	for ; i <= n-4; i += 4 {
		和 += int(查询[i])*int(索引[i]) +
			int(查询[i+1])*int(索引[i+1]) +
			int(查询[i+2])*int(索引[i+2]) +
			int(查询[i+3])*int(索引[i+3])
	}
	
	// 处理剩余元素
	for ; i < n; i++ {
		和 += int(查询[i]) * int(索引[i])
	}
	return 和
}

// 计算打包位点积 使用POPCNT优化的1-bit点积
// 输入为打包的二进制向量 (8个维度压缩到1个字节)
func 计算打包位点积(查询 []byte, 索引 []byte) int {
	if len(查询) != len(索引) {
		return 0
	}

	// 使用AND计算同为1的位数
	和 := 0
	for i := 0; i < len(查询); i++ {
		和 += bits.OnesCount8(查询[i] & 索引[i])
	}
	return 和
}

// 计算打包汉明距离 计算两个打包二进制向量的汉明距离
func 计算打包汉明距离(a []byte, b []byte) int {
	if len(a) != len(b) {
		return 65535
	}
	
	距离 := 0
	for i := 0; i < len(a); i++ {
		距离 += bits.OnesCount8(a[i] ^ b[i])
	}
	return 距离
}

// 计算打包位点积64 使用uint64进行批量计算以提高性能
func 计算打包位点积64(查询 []uint64, 索引 []uint64) int {
	if len(查询) != len(索引) {
		return 0
	}

	和 := 0
	for i := 0; i < len(查询); i++ {
		和 += bits.OnesCount64(查询[i] & 索引[i])
	}
	return 和
}

// 字节转uint64 将字节数组转换为uint64数组
func 字节转uint64(数据 []byte) []uint64 {
	长度 := (len(数据) + 7) / 8
	结果 := make([]uint64, 长度)
	
	for i := 0; i < len(数据); i++ {
		索引 := i / 8
		移位 := uint(7-i%8) * 8
		结果[索引] |= uint64(数据[i]) << 移位
	}
	
	return 结果
}

// BatchDotProduct 批量计算点积 (用于HNSW搜索优化)
type 批量点积计算器 struct {
	查询      []byte   // 量化后的查询向量
	查询打包  []byte   // 打包后的查询 (用于1-bit)
	查询校正  量化结果
	使用四位  bool
}

// 新建批量点积计算器 创建批量计算器
func 新建批量点积计算器(查询向量 []float32, 质心 []float32, 使用四位 bool) *批量点积计算器 {
	量化器 := 新建标量量化器(余弦相似度)
	
	var 位数 int
	if 使用四位 {
		位数 = 4
	} else {
		位数 = 1
	}
	
	量化查询 := make([]byte, len(查询向量))
	校正 := 量化器.标量量化(查询向量, 量化查询, 位数, 质心)
	
	var 打包查询 []byte
	if !使用四位 {
		打包查询 = 打包为二进制(量化查询)
	}
	
	return &批量点积计算器{
		查询:     量化查询,
		查询打包: 打包查询,
		查询校正: 校正,
		使用四位: 使用四位,
	}
}

// 计算 计算与单个索引向量的点积
func (b *批量点积计算器) 计算(索引量化 []byte, 索引打包 []byte) int {
	if b.使用四位 {
		return 计算朴素点积(b.查询, 索引量化)
	}
	return 计算打包位点积(b.查询打包, 索引打包)
}
