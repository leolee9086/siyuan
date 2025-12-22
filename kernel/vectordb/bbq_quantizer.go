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
	"math"
)

// =========================================
// BBQ 标量量化器
// 实现各向异性损失函数和坐标下降优化
// =========================================

// 量化结果 包含量化过程中的校正因子
type 量化结果 struct {
	下界         float32 // 量化区间下界
	上界         float32 // 量化区间上界
	附加校正     float32 // 欧氏距离用norm², 余弦用centroid_dp
	量化分量和   float32 // 量化后分量的和
}

// 相似度类型
type 相似度类型 int

const (
	欧氏距离 相似度类型 = iota
	余弦相似度
	最大内积
)

// 标量量化器 实现BBQ核心算法
type 标量量化器 struct {
	lambda   float32
	迭代次数 int
	相似度   相似度类型
}

// 新建标量量化器 创建量化器实例
func 新建标量量化器(相似度 相似度类型) *标量量化器 {
	return &标量量化器{
		lambda:   默认Lambda,
		迭代次数: 默认迭代次数,
		相似度:   相似度,
	}
}

// 标量量化 对向量进行标量量化
// 参数:
//   - 向量: 输入向量
//   - 目标: 量化结果存储数组 (会被修改)
//   - 位数: 量化位数 (1-8)
//   - 质心: 质心向量 (用于中心化)
//
// 返回: 量化结果元数据
func (q *标量量化器) 标量量化(向量 []float32, 目标 []byte, 位数 int, 质心 []float32) 量化结果 {
	维度 := len(向量)
	
	// 1. 计算质心点积 (非欧氏距离需要)
	var 质心点积 float32 = 0
	if q.相似度 != 欧氏距离 {
		for i := 0; i < 维度; i++ {
			质心点积 += 向量[i] * 质心[i]
		}
	}

	// 2. 质心中心化并计算统计信息
	工作向量 := make([]float32, 维度)
	var 最小值 float32 = math.MaxFloat32
	var 最大值 float32 = -math.MaxFloat32
	var 和 float32 = 0
	var 平方和 float32 = 0

	for i := 0; i < 维度; i++ {
		中心化值 := 向量[i] - 质心[i]
		工作向量[i] = 中心化值

		if 中心化值 < 最小值 {
			最小值 = 中心化值
		}
		if 中心化值 > 最大值 {
			最大值 = 中心化值
		}
		和 += 中心化值
		平方和 += 中心化值 * 中心化值
	}

	均值 := 和 / float32(维度)

	// 计算标准差
	var 方差和 float32 = 0
	for _, 值 := range 工作向量 {
		差 := 值 - 均值
		方差和 += 差 * 差
	}
	标准差 := float32(math.Sqrt(float64(方差和 / float32(维度))))
	范数平方 := 平方和

	// 3. 获取初始区间
	区间 := q.获取初始区间(位数, 标准差, 均值, 最小值, 最大值)

	// 4. 优化区间
	q.优化区间(&区间, 工作向量, 范数平方, 1<<位数)

	// 5. 量化向量并计算分量和
	下界, 上界 := 区间[0], 区间[1]
	级数 := 1 << 位数
	步数 := 级数 - 1
	var 步长 float32 = 0
	if 步数 > 0 {
		步长 = (上界 - 下界) / float32(步数)
	}
	var 步长倒数 float32 = 0
	if 步长 > 0 {
		步长倒数 = 1.0 / 步长
	}
	var 量化分量和 float32 = 0

	for i := 0; i < 维度; i++ {
		xi := 工作向量[i]
		// 限制在区间内
		限制值 := xi
		if 限制值 < 下界 {
			限制值 = 下界
		}
		if 限制值 > 上界 {
			限制值 = 上界
		}

		if 位数 == 1 {
			// 1bit量化: 使用阈值二值化
			阈值 := (下界 + 上界) / 2.0
			var 量化值 byte = 0
			if 限制值 >= 阈值 {
				量化值 = 1
			}
			目标[i] = 量化值
			量化分量和 += float32(量化值)
		} else {
			// 其他位数: 四舍五入
			赋值 := (限制值 - 下界) * 步长倒数
			赋值 = float32(math.Round(float64(赋值)))
			if 赋值 > float32(步数) {
				赋值 = float32(步数)
			}
			目标[i] = byte(赋值)
			量化分量和 += 赋值
		}
	}

	// 6. 设置附加校正
	var 最终校正 float32
	if q.相似度 == 欧氏距离 {
		最终校正 = 范数平方
	} else {
		最终校正 = 质心点积
	}

	return 量化结果{
		下界:       下界,
		上界:       上界,
		附加校正:   最终校正,
		量化分量和: 量化分量和,
	}
}

// 获取初始区间 基于MSE最优网格
func (q *标量量化器) 获取初始区间(位数 int, 标准差, 均值, 最小值, 最大值 float32) [2]float32 {
	if 位数 < 1 || 位数 > 8 {
		return [2]float32{最小值, 最大值}
	}

	网格 := 最小MSE网格[位数-1]
	网格下 := float32(网格[0])
	网格上 := float32(网格[1])

	下界 := 网格下*标准差 + 均值
	上界 := 网格上*标准差 + 均值

	// 限制在数据范围内
	if 下界 < 最小值 {
		下界 = 最小值
	}
	if 下界 > 最大值 {
		下界 = 最大值
	}
	if 上界 < 最小值 {
		上界 = 最小值
	}
	if 上界 > 最大值 {
		上界 = 最大值
	}

	return [2]float32{下界, 上界}
}

// 优化区间 使用坐标下降法
func (q *标量量化器) 优化区间(区间 *[2]float32, 向量 []float32, 范数平方 float32, 级数 int) {
	初始损失 := q.计算损失(向量, *区间, 级数, 范数平方)
	缩放 := (1.0 - q.lambda) / 范数平方

	if math.IsInf(float64(缩放), 0) || math.IsNaN(float64(缩放)) {
		return
	}

	for iter := 0; iter < q.迭代次数; iter++ {
		a, b := 区间[0], 区间[1]
		步长倒数 := float32(级数-1) / (b - a)

		var daa, dab, dbb, dax, dbx float32 = 0, 0, 0, 0, 0

		for _, xi := range 向量 {
			限制值 := xi
			if 限制值 < a {
				限制值 = a
			}
			if 限制值 > b {
				限制值 = b
			}
			k := float32(math.Round(float64((限制值 - a) * 步长倒数)))
			s := k / float32(级数-1)

			daa += (1.0 - s) * (1.0 - s)
			dab += (1.0 - s) * s
			dbb += s * s
			dax += xi * (1.0 - s)
			dbx += xi * s
		}

		m0 := 缩放*dax*dax + q.lambda*daa
		m1 := 缩放*dax*dbx + q.lambda*dab
		m2 := 缩放*dbx*dbx + q.lambda*dbb

		det := m0*m2 - m1*m1
		if math.Abs(float64(det)) < 最小行列式值 {
			return
		}

		a优化 := (m2*dax - m1*dbx) / det
		b优化 := (m0*dbx - m1*dax) / det

		if math.Abs(float64(区间[0]-a优化)) < 浮点精度 &&
			math.Abs(float64(区间[1]-b优化)) < 浮点精度 {
			return
		}

		新损失 := q.计算损失(向量, [2]float32{a优化, b优化}, 级数, 范数平方)
		if 新损失 > 初始损失 {
			return
		}

		区间[0] = a优化
		区间[1] = b优化
		初始损失 = 新损失
	}
}

// 计算损失 各向异性损失函数
func (q *标量量化器) 计算损失(向量 []float32, 区间 [2]float32, 级数 int, 范数平方 float32) float32 {
	a, b := 区间[0], 区间[1]
	步长 := (b - a) / float32(级数-1)
	步长倒数 := 1.0 / 步长
	var xe, e float32 = 0, 0

	for _, xi := range 向量 {
		限制值 := xi
		if 限制值 < a {
			限制值 = a
		}
		if 限制值 > b {
			限制值 = b
		}
		k := float32(math.Round(float64((限制值 - a) * 步长倒数)))
		xiq := a + 步长*k

		差 := xi - xiq
		xe += xi * 差
		e += 差 * 差
	}

	return (1.0-q.lambda)*xe*xe/范数平方 + q.lambda*e
}

// 打包为二进制 将1-bit量化结果打包为字节数组
func 打包为二进制(向量 []byte) []byte {
	维度 := len(向量)
	打包大小 := (维度 + 7) / 8
	结果 := make([]byte, 打包大小)

	for i := 0; i < 维度; i++ {
		if 向量[i] != 0 {
			字节索引 := i / 8
			位索引 := uint(7 - i%8) // 高位在前
			结果[字节索引] |= (1 << 位索引)
		}
	}

	return 结果
}

// 创建零质心 生成指定维度的零向量作为默认质心
func 创建零质心(维度 int) []float32 {
	return make([]float32, 维度)
}
