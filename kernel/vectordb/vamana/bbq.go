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

package vamana

import (
	"math"
	"sort"
	"sync"

	"github.com/siyuan-note/siyuan/kernel/vectordb/bbq"
)

// ============================================================================
// BBQ 量化相关函数
// ============================================================================

// computeBBQCentroid 计算所有向量的质心（均值向量）
// 用于 BBQ 量化时的中心化处理，提高量化精度
func (idx *VamanaIndex) computeBBQCentroid() {
	n := len(idx.vectors)
	if n == 0 {
		idx.bbqCentroid = make([]float32, idx.dimension)
		return
	}

	centroid := make([]float32, idx.dimension)

	// 累加所有向量
	for _, vec := range idx.vectors {
		for j := 0; j < idx.dimension; j++ {
			centroid[j] += vec[j]
		}
	}

	// 计算均值
	invN := 1.0 / float32(n)
	for j := 0; j < idx.dimension; j++ {
		centroid[j] *= invN
	}

	idx.bbqCentroid = centroid
}

// computeBBQDataParallel 并行计算所有向量的 BBQ 编码
func (idx *VamanaIndex) computeBBQDataParallel(numWorkers int) {
	n := len(idx.vectors)
	if n == 0 {
		return
	}

	// 1. 分配存储空间
	idx.bbqPacked = make([]byte, n*idx.bbqPackedSize) // 打包数据用于 1-bit 查询
	idx.bbqUnpacked = make([]byte, n*idx.dimension)   // 未打包数据用于 4-bit 查询
	idx.bbqCompensations = make([]float32, n)
	idx.bbqLowerBounds = make([]float32, n)
	idx.bbqUpperBounds = make([]float32, n)
	idx.bbqQuantizedSums = make([]float32, n)

	// 2. 并行量化
	var wg sync.WaitGroup
	chunkSize := (n + numWorkers - 1) / numWorkers

	for w := 0; w < numWorkers; w++ {
		start := w * chunkSize
		end := start + chunkSize
		if end > n {
			end = n
		}
		if start >= end {
			break
		}

		wg.Add(1)
		go func(start, end int) {
			defer wg.Done()

			// 每个 worker 创建自己的量化器和临时缓冲区
			// 使用 CosineSimilarity 模式配合均值质心，效果最佳
			quantizer := bbq.NewScalarQuantizer(bbq.CosineSimilarity)
			quantized := make([]byte, idx.dimension)

			for i := start; i < end; i++ {
				// 量化向量
				result := quantizer.Quantize(idx.vectors[i], quantized, 1, idx.bbqCentroid)

				// 存储未打包数据 (用于 4-bit 查询)
				unpackedOffset := i * idx.dimension
				copy(idx.bbqUnpacked[unpackedOffset:unpackedOffset+idx.dimension], quantized)

				// 打包为 []byte (用于 1-bit 查询)
				packed := bbq.PackBinary(quantized)

				// 存储打包结果
				offset := i * idx.bbqPackedSize
				copy(idx.bbqPacked[offset:offset+idx.bbqPackedSize], packed)
				idx.bbqCompensations[i] = result.Correction
				idx.bbqLowerBounds[i] = result.LowerBound
				idx.bbqUpperBounds[i] = result.UpperBound
				idx.bbqQuantizedSums[i] = result.QuantizedSum
			}
		}(start, end)
	}

	wg.Wait()
}

// bbqDistance 计算两个已量化向量之间的近似距离
// 使用 POPCNT 计算汉明距离，结合补偿因子计算近似欧氏距离
// 基于 1-bit 量化的距离估计公式
func (idx *VamanaIndex) bbqDistance(id1, id2 uint32) float32 {
	if !idx.bbqEnabled {
		return idx.fastDistance(id1, id2)
	}

	// 获取两个向量的 BBQ 编码
	offset1 := int(id1) * idx.bbqPackedSize
	offset2 := int(id2) * idx.bbqPackedSize
	code1 := idx.bbqPacked[offset1 : offset1+idx.bbqPackedSize]
	code2 := idx.bbqPacked[offset2 : offset2+idx.bbqPackedSize]

	// 计算点积 (AND + POPCNT)
	// 对于 1-bit 量化，点积 = 两个向量同为 1 的位数
	dotProd := bbq.ComputePackedDotProduct(code1, code2)

	// 获取补偿因子 (||x||² 和 ||y||²)
	normSq1 := idx.bbqCompensations[id1]
	normSq2 := idx.bbqCompensations[id2]

	// 近似欧氏距离公式 (简化版，假设量化区间为 [0, 1]):
	// ||x - y||² ≈ ||x||² + ||y||² - 2 * dotProduct * scale
	// 其中 scale = sqrt(||x||² * ||y||²) / dimension
	dim := float32(idx.dimension)
	scale := (normSq1 + normSq2) / (2.0 * dim)
	estimatedDot := float32(dotProd) * scale

	// 欧氏距离平方
	distSq := normSq1 + normSq2 - 2.0*estimatedDot
	if distSq < 0 {
		distSq = 0
	}
	return distSq
}

// bbqDistanceToQuery 计算查询向量（已量化）到索引中某个向量的近似距离
// 使用 BBQ 评分器计算，与 store.go 中的实现保持一致
func (idx *VamanaIndex) bbqDistanceToQuery(id uint32, queryCode []byte, queryCorr bbq.QuantizationResult) float32 {
	if !idx.bbqEnabled {
		return 0 // 不应该在未启用 BBQ 时调用
	}

	// 获取索引向量的 BBQ 编码
	offset := int(id) * idx.bbqPackedSize
	indexCode := idx.bbqPacked[offset : offset+idx.bbqPackedSize]

	// 计算点积 (AND + POPCNT)
	dotProd := bbq.ComputePackedDotProduct(queryCode, indexCode)

	// 获取索引向量的量化元数据
	indexCorr := bbq.QuantizationResult{
		LowerBound:   idx.bbqLowerBounds[id],
		UpperBound:   idx.bbqUpperBounds[id],
		Correction:   idx.bbqCompensations[id],
		QuantizedSum: idx.bbqQuantizedSums[id],
	}

	// 使用 BBQ 评分器计算距离
	// 使用 CosineSimilarity 模式配合均值质心，效果最佳
	scorer := bbq.NewQuantizedScorer(bbq.CosineSimilarity)
	return scorer.ComputeQuantizedDistance(dotProd, queryCorr, indexCorr, idx.dimension, 0, false)
}

// bbqDistanceToQuery4Bit 使用 4-bit 查询量化计算距离
// 4-bit 查询与 1-bit 索引的点积计算，精度更高
// 性能优化: 使用预创建的 scorer，避免热路径上的对象分配
func (idx *VamanaIndex) bbqDistanceToQuery4Bit(id uint32, query4Bit []byte, queryCorr bbq.QuantizationResult) float32 {
	if !idx.bbqEnabled {
		return 0
	}

	// 获取索引向量的未打包 1-bit 数据
	unpackedOffset := int(id) * idx.dimension
	indexUnpacked := idx.bbqUnpacked[unpackedOffset : unpackedOffset+idx.dimension]

	// 计算 4-bit 查询与 1-bit 索引的点积
	dotProd := bbq.ComputeNaiveDotProduct(query4Bit, indexUnpacked)

	// 获取索引向量的量化元数据
	indexCorr := bbq.QuantizationResult{
		LowerBound:   idx.bbqLowerBounds[id],
		UpperBound:   idx.bbqUpperBounds[id],
		Correction:   idx.bbqCompensations[id],
		QuantizedSum: idx.bbqQuantizedSums[id],
	}

	// 使用预创建的评分器 (性能优化: 避免每次调用都创建新对象)
	return idx.bbqScorer.ComputeQuantizedDistance(dotProd, queryCorr, indexCorr, idx.dimension, 0, true)
}

// bbqDistanceToQuery1Bit 使用 1-bit + POPCNT 计算距离
// 性能优化: 使用硬件 POPCNT 指令，比 4-bit 朴素乘法快 3-5 倍
func (idx *VamanaIndex) bbqDistanceToQuery1Bit(id uint32, queryCodes []byte, queryCorr bbq.QuantizationResult) float32 {
	if !idx.bbqEnabled {
		return 0
	}

	// 获取索引向量的打包 1-bit 数据
	offset := int(id) * idx.bbqPackedSize
	indexPacked := idx.bbqPacked[offset : offset+idx.bbqPackedSize]

	// 使用 POPCNT 计算点积
	dotProd := bbq.ComputePackedDotProduct(queryCodes, indexPacked)

	// 获取索引向量的量化元数据
	indexCorr := bbq.QuantizationResult{
		LowerBound:   idx.bbqLowerBounds[id],
		UpperBound:   idx.bbqUpperBounds[id],
		Correction:   idx.bbqCompensations[id],
		QuantizedSum: idx.bbqQuantizedSums[id],
	}

	// 使用 1-bit 评分模式
	return idx.bbqScorer.ComputeQuantizedDistance(dotProd, queryCorr, indexCorr, idx.dimension, 0, false)
}

// ============================================================================
// BBQ 搜索相关函数
// ============================================================================

// greedySearchBBQ 基于 BBQ 的贪婪图搜索
// 性能优化: 根据维度自动选择最优策略
// - 维度 >= 128: 使用 1-bit + POPCNT 硬件加速 (性能优先)
// - 维度 < 128: 使用 4-bit 朴素乘法 (精度更高)
func (idx *VamanaIndex) greedySearchBBQ(scratch *SearchScratch, startIDs []uint32, query []float32, L int) []Neighbor {
	if !idx.bbqEnabled {
		// 如果未启用 BBQ，回退到精确搜索
		return idx.greedySearch(scratch, startIDs, query, L)
	}

	// 根据维度选择量化策略
	if idx.dimension >= 128 {
		// 1-bit 策略: 使用 POPCNT 硬件加速，性能更高
		return idx.greedySearchBBQ1Bit(scratch, startIDs, query, L)
	}

	// 4-bit 策略: 精度更高，适用于低维度
	return idx.greedySearchBBQ4Bit(scratch, startIDs, query, L)
}

// greedySearchBBQ1Bit 使用 1-bit + POPCNT 策略的 BBQ 搜索
// 性能优化: 使用硬件 POPCNT 指令加速点积计算
func (idx *VamanaIndex) greedySearchBBQ1Bit(scratch *SearchScratch, startIDs []uint32, query []float32, L int) []Neighbor {
	// 从对象池获取量化缓冲区
	queryQuantized := idx.bbqQuery4BitPool.Get().([]byte)
	defer idx.bbqQuery4BitPool.Put(queryQuantized)

	// 使用 1-bit 量化查询向量
	queryCorr := idx.bbqQuantizer.Quantize(query, queryQuantized, 1, idx.bbqCentroid)

	// 打包为 []byte 用于 POPCNT (与 bbqPacked 格式一致)
	queryPacked := bbq.PackBinary(queryQuantized)

	// 执行搜索
	return idx.greedySearchBBQ1BitWithQuantized(scratch, startIDs, queryPacked, queryCorr)
}

// greedySearchBBQ4Bit 使用 4-bit 策略的 BBQ 搜索
// 适用于低维度向量，精度更高
func (idx *VamanaIndex) greedySearchBBQ4Bit(scratch *SearchScratch, startIDs []uint32, query []float32, L int) []Neighbor {
	// 从对象池获取 query4Bit 切片
	query4Bit := idx.bbqQuery4BitPool.Get().([]byte)
	defer idx.bbqQuery4BitPool.Put(query4Bit)

	// 使用 4-bit 量化查询向量
	queryCorr := idx.bbqQuantizer.Quantize(query, query4Bit, 4, idx.bbqCentroid)

	// 执行搜索
	return idx.greedySearchBBQWithQuantized(scratch, startIDs, query4Bit, queryCorr)
}

// greedySearchBBQWithQuantized 使用预量化查询执行 BBQ 贪婪搜索 (4-bit 策略)
// 性能优化: 分离量化和搜索逻辑，允许调用者复用量化结果
func (idx *VamanaIndex) greedySearchBBQWithQuantized(scratch *SearchScratch, startIDs []uint32, query4Bit []byte, queryCorr bbq.QuantizationResult) []Neighbor {
	scratch.Reset()

	idx.mu.RLock()
	defer idx.mu.RUnlock()

	scratch.Visited.EnsureCapacity(len(idx.vectors))

	// 初始化: 从入口点开始
	for _, startID := range startIDs {
		if int(startID) >= len(idx.vectors) {
			continue
		}
		// 跳过已删除节点
		if idx.deleted.Test(startID) {
			continue
		}
		scratch.Visited.Insert(startID)
		dist := idx.bbqDistanceToQuery4Bit(startID, query4Bit, queryCorr)
		scratch.Best.Insert(Neighbor{ID: startID, Distance: dist})
		scratch.Cmps++
	}

	// 贪婪搜索
	for scratch.Best.HasUnvisited() {
		// 获取最近的未访问节点
		closest, ok := scratch.Best.PopClosestUnvisited()
		if !ok {
			break
		}

		// 展开邻居
		neighbors := idx.neighbors[closest.ID]

		for _, neighborID := range neighbors {
			// 跳过已删除节点
			if idx.deleted.Test(neighborID) {
				continue
			}
			if scratch.Visited.Insert(neighborID) {
				dist := idx.bbqDistanceToQuery4Bit(neighborID, query4Bit, queryCorr)
				scratch.Best.Insert(Neighbor{ID: neighborID, Distance: dist})
				scratch.Cmps++
			}
		}
		scratch.Hops++
	}

	return scratch.Best.All()
}

// greedySearchBBQ1BitWithQuantized 使用 1-bit + POPCNT 策略的 BBQ 搜索
// 性能优化: 使用硬件 POPCNT 指令加速点积计算
func (idx *VamanaIndex) greedySearchBBQ1BitWithQuantized(scratch *SearchScratch, startIDs []uint32, queryCodes []byte, queryCorr bbq.QuantizationResult) []Neighbor {
	scratch.Reset()

	idx.mu.RLock()
	defer idx.mu.RUnlock()

	scratch.Visited.EnsureCapacity(len(idx.vectors))

	// 初始化: 从入口点开始
	for _, startID := range startIDs {
		if int(startID) >= len(idx.vectors) {
			continue
		}
		// 跳过已删除节点
		if idx.deleted.Test(startID) {
			continue
		}
		scratch.Visited.Insert(startID)
		dist := idx.bbqDistanceToQuery1Bit(startID, queryCodes, queryCorr)
		scratch.Best.Insert(Neighbor{ID: startID, Distance: dist})
		scratch.Cmps++
	}

	// 贪婪搜索
	for scratch.Best.HasUnvisited() {
		// 获取最近的未访问节点
		closest, ok := scratch.Best.PopClosestUnvisited()
		if !ok {
			break
		}

		// 展开邻居
		neighbors := idx.neighbors[closest.ID]

		for _, neighborID := range neighbors {
			// 跳过已删除节点
			if idx.deleted.Test(neighborID) {
				continue
			}
			if scratch.Visited.Insert(neighborID) {
				dist := idx.bbqDistanceToQuery1Bit(neighborID, queryCodes, queryCorr)
				scratch.Best.Insert(Neighbor{ID: neighborID, Distance: dist})
				scratch.Cmps++
			}
		}
		scratch.Hops++
	}

	return scratch.Best.All()
}

// SearchWithBBQ 两阶段搜索：BBQ 粗筛 + 全精度重排
// 第一阶段使用 BBQ 近似距离快速筛选 k*rerankFactor 个候选
// 第二阶段使用全精度向量计算真实距离，返回 top-k 结果
// 性能优化: 使用对象池复用 scratch，使用堆选择 top-k 替代完整排序
func (idx *VamanaIndex) SearchWithBBQ(query []float32, k int, rerankFactor int) []Neighbor {
	// 检查 BBQ 是否启用，若未启用则回退到普通 Search
	if !idx.bbqEnabled {
		// 使用默认 efSearch = k * rerankFactor
		return idx.Search(query, k, k*rerankFactor)
	}

	idx.mu.RLock()
	if len(idx.vectors) == 0 || idx.medoid == math.MaxUint32 {
		idx.mu.RUnlock()
		return nil
	}
	vectorCount := len(idx.vectors)
	idx.mu.RUnlock()

	// 第一阶段：BBQ 粗筛
	// 获取 k * rerankFactor 个候选
	candidateCount := k * rerankFactor
	if candidateCount < k {
		candidateCount = k
	}

	// 性能优化: 使用对象池复用 scratch
	scratch := idx.getScratch()
	defer idx.putScratch(scratch)

	// 确保 scratch 容量足够
	scratch.Visited.EnsureCapacity(vectorCount)
	scratch.Best.SetCapacity(candidateCount)

	startIDs := []uint32{idx.medoid}
	candidates := idx.greedySearchBBQ(scratch, startIDs, query, candidateCount)

	if len(candidates) == 0 {
		return nil
	}

	// 第二阶段：全精度重排
	// 使用 euclideanDistance 计算真实距离
	idx.mu.RLock()
	defer idx.mu.RUnlock()

	// 重新计算每个候选的真实距离
	for i := range candidates {
		id := candidates[i].ID
		if int(id) < len(idx.vectors) {
			candidates[i].Distance = euclideanDistance(query, idx.vectors[id])
		}
	}

	// 性能优化: 使用堆选择 top-k，O(n log k) 替代完整排序 O(n log n)
	// 当 k 远小于 n 时，堆选择更高效
	if len(candidates) > k {
		result := selectTopK(candidates, k)
		return result
	}

	// 候选数量不超过 k，直接排序返回
	sort.Slice(candidates, func(i, j int) bool {
		return candidates[i].Distance < candidates[j].Distance
	})

	result := make([]Neighbor, len(candidates))
	copy(result, candidates)
	return result
}
