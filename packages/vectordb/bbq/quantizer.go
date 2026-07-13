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
	"errors"
	"fmt"
	"math"
	"sync"
)

var ErrQuantizerInput = errors.New("invalid quantizer input")

// =========================================
// BBQ 标量量化器
// 实现各向异性损失函数和坐标下降优化
// =========================================

// QuantizationResult 量化结果 包含量化过程中的校正因子
type QuantizationResult struct {
	LowerBound   float32 // 量化区间下界
	UpperBound   float32 // 量化区间上界
	Correction   float32 // 欧氏距离用norm², 余弦用centroid_dp
	QuantizedSum float32 // 量化后分量的和
}

// SimilarityType 相似度类型
type SimilarityType int

const (
	EuclideanDistance SimilarityType = iota
	CosineSimilarity
	MaxInnerProduct
)

// workVecPool 工作向量缓冲池 用于减少 Quantize 热路径上的内存分配和 GC 压力
var workVecPool = sync.Pool{
	New: func() interface{} {
		// 初始容量为0，实际使用时按需扩容
		s := make([]float32, 0)
		return &s
	},
}

// getWorkVec 从池中获取工作向量缓冲区，确保容量至少为 n
func getWorkVec(n int) *[]float32 {
	p := workVecPool.Get().(*[]float32)
	if cap(*p) < n {
		*p = make([]float32, n)
	} else {
		*p = (*p)[:n]
	}
	return p
}

// putWorkVec 将工作向量缓冲区归还到池中
func putWorkVec(p *[]float32) {
	workVecPool.Put(p)
}

// ScalarQuantizer 标量量化器 实现BBQ核心算法
type ScalarQuantizer struct {
	lambda     float32
	iterations int
	similarity SimilarityType
}

// NewScalarQuantizer 新建标量量化器 创建量化器实例
func NewScalarQuantizer(similarity SimilarityType) *ScalarQuantizer {
	return &ScalarQuantizer{
		lambda:     DefaultLambda,
		iterations: DefaultIterations,
		similarity: similarity,
	}
}

// NewScalarQuantizerWithTuning 创建使用显式各向异性权重和优化轮数的量化器。
// 它用于离线标定不同数据分布；非法参数保留默认值。
func NewScalarQuantizerWithTuning(similarity SimilarityType, lambda float32, iterations int) *ScalarQuantizer {
	quantizer := NewScalarQuantizer(similarity)
	if lambda >= 0 && lambda <= 1 {
		quantizer.lambda = lambda
	}
	if iterations >= 0 {
		quantizer.iterations = iterations
	}
	return quantizer
}

// QuantizeChecked 严格校验输入后执行标量量化。
func (q *ScalarQuantizer) QuantizeChecked(vector []float32, dest []byte, bits int, centroid []float32) (QuantizationResult, error) {
	if len(vector) == 0 || len(vector) != len(centroid) || len(dest) != len(vector) {
		return QuantizationResult{}, fmt.Errorf("%w: vector=%d centroid=%d destination=%d", ErrQuantizerInput, len(vector), len(centroid), len(dest))
	}
	if bits < 1 || bits > 8 {
		return QuantizationResult{}, fmt.Errorf("%w: bits=%d", ErrQuantizerInput, bits)
	}
	return q.quantize(vector, dest, bits, centroid), nil
}

// Quantize 保留无错兼容签名；非法输入返回零校正结果而不触发 panic。
func (q *ScalarQuantizer) Quantize(vector []float32, dest []byte, bits int, centroid []float32) QuantizationResult {
	result, _ := q.QuantizeChecked(vector, dest, bits, centroid)
	return result
}

// quantize 对已经验证的输入执行标量量化。
func (q *ScalarQuantizer) quantize(vector []float32, dest []byte, bits int, centroid []float32) QuantizationResult {
	dimension := len(vector)

	// 1. 计算质心点积 (非欧氏距离需要)
	var centroidDot float32 = 0
	if q.similarity != EuclideanDistance {
		for i := 0; i < dimension; i++ {
			centroidDot += vector[i] * centroid[i]
		}
	}

	// 2. 质心中心化并计算统计信息
	// 使用 sync.Pool 复用工作缓冲区，避免每次调用都分配内存
	workVecPtr := getWorkVec(dimension)
	workVec := *workVecPtr
	defer putWorkVec(workVecPtr)

	var minVal float32 = math.MaxFloat32
	var maxVal float32 = -math.MaxFloat32
	var sum float32 = 0
	var sqSum float32 = 0

	for i := 0; i < dimension; i++ {
		centered := vector[i] - centroid[i]
		workVec[i] = centered

		if centered < minVal {
			minVal = centered
		}
		if centered > maxVal {
			maxVal = centered
		}
		sum += centered
		sqSum += centered * centered
	}

	mean := sum / float32(dimension)

	// 计算标准差
	var varSum float32 = 0
	for _, val := range workVec {
		diff := val - mean
		varSum += diff * diff
	}
	stdDev := float32(math.Sqrt(float64(varSum / float32(dimension))))
	normSq := sqSum

	// 3. 获取初始区间
	interval := q.GetInitialInterval(bits, stdDev, mean, minVal, maxVal)

	// 4. 优化区间
	q.OptimizeInterval(&interval, workVec, normSq, 1<<bits)

	// 5. 量化向量并计算分量和
	lower, upper := interval[0], interval[1]
	levels := 1 << bits
	steps := levels - 1
	var stepSize float32 = 0
	if steps > 0 {
		stepSize = (upper - lower) / float32(steps)
	}
	var stepScale float32 = 0
	if stepSize > 0 {
		stepScale = 1.0 / stepSize
	}
	var quantizedSum float32 = 0

	for i := 0; i < dimension; i++ {
		xi := workVec[i]
		// 限制在区间内
		clamped := xi
		if clamped < lower {
			clamped = lower
		}
		if clamped > upper {
			clamped = upper
		}

		if bits == 1 {
			// 1bit量化: 使用阈值二值化
			threshold := (lower + upper) / 2.0
			var qVal byte = 0
			if clamped >= threshold {
				qVal = 1
			}
			dest[i] = qVal
			quantizedSum += float32(qVal)
		} else {
			// 其他位数: 四舍五入
			val := (clamped - lower) * stepScale
			val = float32(math.Round(float64(val)))
			if val > float32(steps) {
				val = float32(steps)
			}
			dest[i] = byte(val)
			quantizedSum += val
		}
	}

	// 6. 设置附加校正
	var finalCorrection float32
	if q.similarity == EuclideanDistance {
		finalCorrection = normSq
	} else {
		finalCorrection = centroidDot
	}

	return QuantizationResult{
		LowerBound:   lower,
		UpperBound:   upper,
		Correction:   finalCorrection,
		QuantizedSum: quantizedSum,
	}
}

// GetInitialInterval 获取初始区间 基于MSE最优网格
func (q *ScalarQuantizer) GetInitialInterval(bits int, stdDev, mean, minVal, maxVal float32) [2]float32 {
	if bits < 1 || bits > 8 {
		return [2]float32{minVal, maxVal}
	}

	grid := MinMSEGrid[bits-1]
	gridLow := float32(grid[0])
	gridHigh := float32(grid[1])

	lower := gridLow*stdDev + mean
	upper := gridHigh*stdDev + mean

	// 限制在数据范围内
	if lower < minVal {
		lower = minVal
	}
	if lower > maxVal {
		lower = maxVal
	}
	if upper < minVal {
		upper = minVal
	}
	if upper > maxVal {
		upper = maxVal
	}

	return [2]float32{lower, upper}
}

// OptimizeInterval 优化区间 使用坐标下降法
func (q *ScalarQuantizer) OptimizeInterval(interval *[2]float32, vector []float32, normSq float32, levels int) {
	initialLoss := q.ComputeLoss(vector, *interval, levels, normSq)
	scale := (1.0 - q.lambda) / normSq

	if math.IsInf(float64(scale), 0) || math.IsNaN(float64(scale)) {
		return
	}

	for iter := 0; iter < q.iterations; iter++ {
		a, b := interval[0], interval[1]
		stepScale := float32(levels-1) / (b - a)

		var daa, dab, dbb, dax, dbx float32 = 0, 0, 0, 0, 0

		for _, xi := range vector {
			clamped := xi
			if clamped < a {
				clamped = a
			}
			if clamped > b {
				clamped = b
			}
			k := float32(math.Round(float64((clamped - a) * stepScale)))
			s := k / float32(levels-1)

			daa += (1.0 - s) * (1.0 - s)
			dab += (1.0 - s) * s
			dbb += s * s
			dax += xi * (1.0 - s)
			dbx += xi * s
		}

		m0 := scale*dax*dax + q.lambda*daa
		m1 := scale*dax*dbx + q.lambda*dab
		m2 := scale*dbx*dbx + q.lambda*dbb

		det := m0*m2 - m1*m1
		if math.Abs(float64(det)) < MinDeterminant {
			return
		}

		aOpt := (m2*dax - m1*dbx) / det
		bOpt := (m0*dbx - m1*dax) / det

		if math.Abs(float64(interval[0]-aOpt)) < FloatPrecision &&
			math.Abs(float64(interval[1]-bOpt)) < FloatPrecision {
			return
		}

		newLoss := q.ComputeLoss(vector, [2]float32{aOpt, bOpt}, levels, normSq)
		if newLoss > initialLoss {
			return
		}

		interval[0] = aOpt
		interval[1] = bOpt
		initialLoss = newLoss
	}
}

// ComputeLoss 计算损失 各向异性损失函数
func (q *ScalarQuantizer) ComputeLoss(vector []float32, interval [2]float32, levels int, normSq float32) float32 {
	a, b := interval[0], interval[1]
	stepSize := (b - a) / float32(levels-1)
	stepScale := 1.0 / stepSize
	var xe, e float32 = 0, 0

	for _, xi := range vector {
		clamped := xi
		if clamped < a {
			clamped = a
		}
		if clamped > b {
			clamped = b
		}
		k := float32(math.Round(float64((clamped - a) * stepScale)))
		xiq := a + stepSize*k

		diff := xi - xiq
		xe += xi * diff
		e += diff * diff
	}

	return (1.0-q.lambda)*xe*xe/normSq + q.lambda*e
}

// PackBinary 打包为二进制 将1-bit量化结果打包为字节数组
func PackBinary(vector []byte) []byte {
	dimension := len(vector)
	packedSize := (dimension + 7) / 8
	result := make([]byte, packedSize)
	PackBinaryInto(vector, result)
	return result
}

// PackBinaryInto 将 1-bit 量化结果写入调用方提供的打包缓冲区。
// 复用目标缓冲区可避免批量构建和增量写入时为每个向量分配临时切片。
func PackBinaryInto(vector, result []byte) {
	packedSize := (len(vector) + 7) / 8
	if len(result) < packedSize {
		return
	}
	clear(result[:packedSize])

	for i := 0; i < len(vector); i++ {
		if vector[i] != 0 {
			byteIdx := i / 8
			bitIdx := uint(7 - i%8) // 高位在前
			result[byteIdx] |= (1 << bitIdx)
		}
	}
}

// CreateZeroCentroid 创建零质心 生成指定维度的零向量作为默认质心
func CreateZeroCentroid(dimension int) []float32 {
	return make([]float32, dimension)
}

// QuantizeRange 对 vectors[start:end] 范围内的向量执行 1-bit 标量量化，
// 将量化码打包为 packed 格式，并写入四个元数据数组。
//
// 每个向量执行以下操作序列（在内存索引 computeBBQDataParallel 与
// 磁盘构建 computeBBQChunk 中完全重复，此处统一提取）：
//
//  1. quantizer.Quantize(vec, quantized, 1, centroid) → result
//  2. PackBinary(quantized) → packed
//  3. copy(bbqPacked[i*packedSize:], packed)
//  4. lower[i] = result.LowerBound, upper[i] = result.UpperBound
//     correction[i] = result.Correction, sum[i] = result.QuantizedSum
//
// quantized 缓冲区由调用方分配且每个 goroutine 独立，避免并发写冲突。
func QuantizeRange(quantizer *ScalarQuantizer, vectors [][]float32, centroid []float32,
	start, end, dimension, packedSize int,
	bbqPacked []byte, lower, upper, correction, sum []float32) {
	quantized := make([]byte, dimension)
	for i := start; i < end; i++ {
		vec := vectors[i]
		result := quantizer.Quantize(vec, quantized, 1, centroid)
		packed := PackBinary(quantized)
		offset := i * packedSize
		copy(bbqPacked[offset:offset+packedSize], packed)
		lower[i] = result.LowerBound
		upper[i] = result.UpperBound
		correction[i] = result.Correction
		sum[i] = result.QuantizedSum
	}
}
