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
// BBQ (Better Binary Quantization) 常量
// 基于Lucene的二值量化算法
// =========================================

// QueryQuantizationBits 查询向量量化位数 (1位启用POPCNT优化，速度更快但精度略降)
const QueryQuantizationBits = 1

// IndexQuantizationBits 索引向量量化位数 (1位用于压缩存储)
const IndexQuantizationBits = 1

// BBQEnableThreshold defines the minimum dimension to enable Binary Quantization
// Vectors with dimension >= this value will use BBQ optimization
const BBQEnableThreshold = 33

// ScalingFactor4Bit 4位量化缩放因子: 将0-15映射到[0,1]
const ScalingFactor4Bit = 1.0 / 15.0

// DefaultLambda 默认各向异性权重 (平衡方向误差与幅度误差)
const DefaultLambda = 0.1

// DefaultIterations 默认优化迭代次数
const DefaultIterations = 5

// MinMSEGrid 最小MSE网格 - 基于均匀分布的最优量化区间
// 每个位数的间隔值经过理论推导和数值优化
// 索引: bits-1, 值: [lower, upper] 相对于标准差的倍数
var MinMSEGrid = [8][2]float64{
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
	ConvergenceThreshold = 1e-8
	MinDeterminant       = 1e-12
	FloatPrecision       = 1e-8
)
