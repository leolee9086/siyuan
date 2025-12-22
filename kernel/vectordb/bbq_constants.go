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

// =========================================
// BBQ (Better Binary Quantization) 常量
// 基于Lucene的二值量化算法
// =========================================

// 查询向量量化位数 (4位可提供更高精度)
const 查询量化位数 = 4

// 索引向量量化位数 (1位用于压缩存储)
const 索引量化位数 = 1

// 4位量化缩放因子: 将0-15映射到[0,1]
const 四位缩放因子 = 1.0 / 15.0

// 默认各向异性权重 (平衡方向误差与幅度误差)
const 默认Lambda = 0.1

// 默认优化迭代次数
const 默认迭代次数 = 5

// 最小MSE网格 - 基于均匀分布的最优量化区间
// 每个位数的间隔值经过理论推导和数值优化
// 索引: bits-1, 值: [lower, upper] 相对于标准差的倍数
var 最小MSE网格 = [8][2]float64{
	{-0.798, 0.798}, // 1位
	{-1.493, 1.493}, // 2位
	{-2.051, 2.051}, // 3位
	{-2.514, 2.514}, // 4位
	{-2.916, 2.916}, // 5位
	{-3.278, 3.278}, // 6位
	{-3.611, 3.611}, // 7位
	{-3.922, 3.922}, // 8位
}

// 数值精度常量
const (
	收敛阈值    = 1e-8
	最小行列式值 = 1e-12
	浮点精度   = 1e-8
)
