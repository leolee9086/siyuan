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
// BBQ 量化评分器
// 使用校正因子精确还原相似度
// =========================================

// 量化评分器 计算量化向量间的相似度
type 量化评分器 struct {
	相似度 相似度类型
}

// 新建量化评分器 创建评分器实例
func 新建量化评分器(相似度 相似度类型) *量化评分器 {
	return &量化评分器{相似度: 相似度}
}

// 计算一位评分 计算1-bit量化向量的相似度
// 参数:
//   - 位点积: 量化向量的点积 (通过ComputePackedDotProduct计算)
//   - 查询校正: 查询向量的量化结果
//   - 索引校正: 索引向量的量化结果
//   - 维度: 向量维度
//   - 质心点积: 查询与质心的点积 (余弦/内积时使用)
func (s *量化评分器) 计算一位评分(位点积 int, 查询校正, 索引校正 量化结果, 维度 int, 质心点积 float32) float32 {
	x1 := 索引校正.量化分量和
	ax := 索引校正.下界
	lx := 索引校正.上界 - ax
	ay := 查询校正.下界
	ly := 查询校正.上界 - ay
	y1 := 查询校正.量化分量和

	// 还原点积估计
	分数 := ax*ay*float32(维度) +
		ay*lx*x1 +
		ax*ly*y1 +
		lx*ly*float32(位点积)

	switch s.相似度 {
	case 欧氏距离:
		欧氏分数 := 查询校正.附加校正 + 索引校正.附加校正 - 2.0*分数
		结果 := 1.0 / (1.0 + 欧氏分数)
		if 结果 < 0 {
			return 0
		}
		return 结果
	case 余弦相似度:
		分数 += 查询校正.附加校正 + 索引校正.附加校正 - 质心点积
		结果 := (1.0 + 分数) / 2.0
		if 结果 < 0 {
			return 0
		}
		return 结果
	case 最大内积:
		分数 += 查询校正.附加校正 + 索引校正.附加校正 - 质心点积
		return 缩放最大内积分数(分数)
	}
	return 0
}

// 计算四位评分 计算4-bit查询 + 1-bit索引的相似度
func (s *量化评分器) 计算四位评分(位点积 int, 查询校正, 索引校正 量化结果, 维度 int, 质心点积 float32) float32 {
	x1 := 索引校正.量化分量和
	ax := 索引校正.下界
	lx := 索引校正.上界 - ax
	ay := 查询校正.下界
	ly := (查询校正.上界 - ay) * 四位缩放因子 // 4-bit需要缩放
	y1 := 查询校正.量化分量和

	分数 := ax*ay*float32(维度) +
		ay*lx*x1 +
		ax*ly*y1 +
		lx*ly*float32(位点积)

	switch s.相似度 {
	case 欧氏距离:
		欧氏分数 := 查询校正.附加校正 + 索引校正.附加校正 - 2.0*分数
		结果 := 1.0 / (1.0 + 欧氏分数)
		if 结果 < 0 {
			return 0
		}
		return 结果
	case 余弦相似度, 最大内积:
		调整分数 := 分数 + 查询校正.附加校正 + 索引校正.附加校正 - 质心点积
		if s.相似度 == 最大内积 {
			return 缩放最大内积分数(调整分数)
		}
		结果 := (1.0 + 调整分数) / 2.0
		if 结果 < 0 {
			return 0
		}
		return 结果
	}
	return 0
}

// 计算量化距离 将BBQ相似度转换为距离 (用于HNSW)
// 返回值越小表示越相似
func (s *量化评分器) 计算量化距离(位点积 int, 查询校正, 索引校正 量化结果, 维度 int, 质心点积 float32, 使用四位 bool) float32 {
	var 分数 float32
	if 使用四位 {
		分数 = s.计算四位评分(位点积, 查询校正, 索引校正, 维度, 质心点积)
	} else {
		分数 = s.计算一位评分(位点积, 查询校正, 索引校正, 维度, 质心点积)
	}
	// 相似度转距离: 分数越高距离越小
	// 对于余弦: 分数在[0,1], 距离=1-分数
	return 1.0 - 分数
}

// 缩放最大内积分数 将内积分数转换为正值
func 缩放最大内积分数(分数 float32) float32 {
	if 分数 < 0 {
		return 1.0 / (1.0 - 分数)
	}
	return 分数 + 1.0
}
