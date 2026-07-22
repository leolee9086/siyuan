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
	"path/filepath"
	"testing"
	"time"

	"github.com/siyuan-note/siyuan/kernel/vectordb/bbq"
)

// normalizeVector 对向量进行 L2 归一化
func normalizeVector(vec []float32) {
	var norm float32
	for _, v := range vec {
		norm += v * v
	}
	norm = float32(math.Sqrt(float64(norm)))
	if norm > 0 {
		for i := range vec {
			vec[i] /= norm
		}
	}
}

// computeBruteForceKNNCosine 使用余弦相似度暴力搜索 K 近邻
// 对于归一化向量，余弦相似度 = 点积，距离 = 1 - 点积
func computeBruteForceKNNCosine(vectors [][]float32, query []float32, k int) []int32 {
	type distPair struct {
		id   int32
		dist float32 // 距离 = 1 - 余弦相似度
	}

	pairs := make([]distPair, len(vectors))
	for i, v := range vectors {
		// 计算点积（对于归一化向量，点积 = 余弦相似度）
		var dotProd float32
		for j := range v {
			dotProd += v[j] * query[j]
		}
		// 距离 = 1 - 余弦相似度
		pairs[i] = distPair{id: int32(i), dist: 1 - dotProd}
	}

	// 部分排序，只需要前 k 个（距离最小的）
	for i := 0; i < k && i < len(pairs); i++ {
		minIdx := i
		for j := i + 1; j < len(pairs); j++ {
			if pairs[j].dist < pairs[minIdx].dist {
				minIdx = j
			}
		}
		pairs[i], pairs[minIdx] = pairs[minIdx], pairs[i]
	}

	result := make([]int32, k)
	for i := 0; i < k && i < len(pairs); i++ {
		result[i] = pairs[i].id
	}
	return result
}

// ============================================================================
// BBQ 集成测试
// ============================================================================

// TestBBQIntegration 验证 BBQ 集成的功能正确性
// 包括：自动启用检测、数据结构初始化、SearchWithBBQ 返回正确结果
func TestBBQIntegration(t *testing.T) {
	t.Run("BBQAutoEnable", testBBQAutoEnable)
	t.Run("BBQDataStructures", testBBQDataStructures)
	t.Run("BBQSearchReturnsResults", testBBQSearchReturnsResults)
}

// testBBQAutoEnable 验证 BBQ 在 dimension >= 33 时自动启用
func testBBQAutoEnable(t *testing.T) {
	config := DefaultConfig()

	// 测试低维向量 (dim < 33) 不启用 BBQ
	lowDimIdx := New(32, config)
	if lowDimIdx.bbqEnabled {
		t.Errorf("BBQ should NOT be enabled for dimension 32, but got enabled")
	}

	// 测试边界值 (dim = 33) 启用 BBQ
	boundaryIdx := New(33, config)
	if !boundaryIdx.bbqEnabled {
		t.Errorf("BBQ should be enabled for dimension 33, but got disabled")
	}

	// 测试高维向量 (dim = 128) 启用 BBQ
	highDimIdx := New(128, config)
	if !highDimIdx.bbqEnabled {
		t.Errorf("BBQ should be enabled for dimension 128, but got disabled")
	}

	// 验证 bbqPackedSize 计算正确
	// 对于 128 维: (128 + 7) / 8 = 16 bytes
	expectedPackedSize := (128 + 7) / 8
	if highDimIdx.bbqPackedSize != expectedPackedSize {
		t.Errorf("bbqPackedSize mismatch: expected %d, got %d",
			expectedPackedSize, highDimIdx.bbqPackedSize)
	}

	t.Logf("BBQ auto-enable test passed:")
	t.Logf("  - dim=32: bbqEnabled=%v (expected false)", lowDimIdx.bbqEnabled)
	t.Logf("  - dim=33: bbqEnabled=%v (expected true)", boundaryIdx.bbqEnabled)
	t.Logf("  - dim=128: bbqEnabled=%v, bbqPackedSize=%d",
		highDimIdx.bbqEnabled, highDimIdx.bbqPackedSize)
}

// testBBQDataStructures 验证 BBQ 数据结构正确初始化
func testBBQDataStructures(t *testing.T) {
	const numVectors = 1000
	const dimension = 128

	// 生成随机向量
	vectors := generateRandomVectors(numVectors, dimension)

	config := DefaultConfig()
	config.R = 32
	config.L = 50

	idx := New(dimension, config)
	if err := idx.Build(vectors); err != nil {
		t.Fatalf("Build failed: %v", err)
	}

	// 验证 BBQ 已启用
	if !idx.bbqEnabled {
		t.Fatal("BBQ should be enabled for dimension 128")
	}

	// 验证 bbqPacked 已分配且大小正确
	expectedPackedLen := numVectors * idx.bbqPackedSize
	if len(idx.bbqPacked) != expectedPackedLen {
		t.Errorf("bbqPacked length mismatch: expected %d, got %d",
			expectedPackedLen, len(idx.bbqPacked))
	}

	// 验证 bbqCompensations 已分配且大小正确
	if len(idx.bbqCompensations) != numVectors {
		t.Errorf("bbqCompensations length mismatch: expected %d, got %d",
			numVectors, len(idx.bbqCompensations))
	}

	// 验证 bbqCentroid 已计算且维度正确
	if len(idx.bbqCentroid) != dimension {
		t.Errorf("bbqCentroid dimension mismatch: expected %d, got %d",
			dimension, len(idx.bbqCentroid))
	}

	// 验证 bbqPacked 不全为零 (至少有一些非零编码)
	nonZeroCount := 0
	for _, code := range idx.bbqPacked {
		if code != 0 {
			nonZeroCount++
		}
	}
	if nonZeroCount == 0 {
		t.Error("bbqPacked are all zeros, quantization may have failed")
	}

	// 验证 bbqCompensations 不全为零
	nonZeroCompCount := 0
	for _, comp := range idx.bbqCompensations {
		if comp != 0 {
			nonZeroCompCount++
		}
	}
	if nonZeroCompCount == 0 {
		t.Error("bbqCompensations are all zeros, quantization may have failed")
	}

	t.Logf("BBQ data structures test passed:")
	t.Logf("  - bbqPacked: %d bytes (%d non-zero)",
		len(idx.bbqPacked), nonZeroCount)
	t.Logf("  - bbqCompensations: %d values (%d non-zero)",
		len(idx.bbqCompensations), nonZeroCompCount)
	t.Logf("  - bbqCentroid: %d dimensions", len(idx.bbqCentroid))
}

// testBBQSearchReturnsResults 验证 SearchWithBBQ 返回正确结果
func testBBQSearchReturnsResults(t *testing.T) {
	const numVectors = 1000
	const dimension = 128
	const k = 10
	const rerankFactor = 10

	// 生成随机向量
	vectors := generateRandomVectors(numVectors, dimension)

	config := DefaultConfig()
	config.R = 32
	config.L = 50

	idx := New(dimension, config)
	if err := idx.Build(vectors); err != nil {
		t.Fatalf("Build failed: %v", err)
	}

	// 生成查询向量
	query := generateRandomVectors(1, dimension)[0]

	// 执行 BBQ 搜索
	results := idx.SearchWithBBQ(query, k, rerankFactor)

	// 验证返回结果数量
	if len(results) != k {
		t.Errorf("SearchWithBBQ returned %d results, expected %d", len(results), k)
	}

	// 验证结果 ID 有效
	for i, r := range results {
		if r.ID >= uint32(numVectors) {
			t.Errorf("Result %d has invalid ID: %d (max: %d)", i, r.ID, numVectors-1)
		}
	}

	// 验证结果按距离排序
	for i := 1; i < len(results); i++ {
		if results[i].Distance < results[i-1].Distance {
			t.Errorf("Results not sorted: result[%d].Distance=%f < result[%d].Distance=%f",
				i, results[i].Distance, i-1, results[i-1].Distance)
		}
	}

	t.Logf("BBQ search test passed:")
	t.Logf("  - Returned %d results", len(results))
	t.Logf("  - Distance range: [%f, %f]", results[0].Distance, results[len(results)-1].Distance)
}

// ============================================================================
// BBQ 召回率测试
// ============================================================================

// TestBBQRecall 测试 BBQ 搜索的召回率
// 使用 SIFT10K 数据集，比较 SearchWithBBQ 与暴力搜索的召回率
// 目标：Recall@10 >= 95%
func TestBBQRecall(t *testing.T) {
	dataPath := getSIFTDataPath()
	if dataPath == "" {
		t.Skip("SIFT dataset not found. Download from: ftp://ftp.irisa.fr/local/texmex/corpus/sift.tar.gz")
	}

	const numVectors = 10000
	const k = 10
	const numQueries = 100

	t.Logf("=== BBQ Recall Test (SIFT 10K) ===")

	// 加载数据
	baseVectors, dim, err := loadFvecsPartial(filepath.Join(dataPath, "sift_base.fvecs"), numVectors)
	if err != nil {
		t.Fatalf("Failed to load base vectors: %v", err)
	}
	t.Logf("Loaded %d base vectors, dimension=%d", len(baseVectors), dim)

	queryVectors, _, err := loadFvecs(filepath.Join(dataPath, "sift_query.fvecs"))
	if err != nil {
		t.Fatalf("Failed to load query vectors: %v", err)
	}
	t.Logf("Loaded %d query vectors", len(queryVectors))

	// 计算 ground truth
	t.Logf("Computing ground truth for %d queries (k=%d)...", numQueries, k)
	groundTruth := computeGroundTruth(baseVectors, queryVectors[:numQueries], k)

	// 构建索引
	config := DefaultConfig()
	config.R = 32
	config.L = 50
	config.Alpha = 1.2

	idx := New(dim, config)
	t.Logf("Building index with R=%d, L=%d, Alpha=%.1f...", config.R, config.L, config.Alpha)

	if err := idx.Build(baseVectors); err != nil {
		t.Fatalf("Build failed: %v", err)
	}

	// 验证 BBQ 已启用
	if !idx.bbqEnabled {
		t.Fatalf("BBQ should be enabled for dimension %d (threshold=%d)", dim, bbq.BBQEnableThreshold)
	}
	t.Logf("BBQ enabled: true, bbqPackedSize=%d", idx.bbqPackedSize)

	// 测试不同的 rerankFactor
	rerankFactors := []int{5, 10, 20, 30, 50}

	t.Logf("\n%-15s %-15s %-15s", "RerankFactor", "Recall@10", "Avg Latency")
	t.Logf("%-15s %-15s %-15s", "------------", "---------", "-----------")

	for _, rerankFactor := range rerankFactors {
		var totalRecall float64
		var totalLatency float64

		for i := 0; i < numQueries; i++ {
			start := time.Now()
			results := idx.SearchWithBBQ(queryVectors[i], k, rerankFactor)
			latency := time.Since(start).Microseconds()
			totalLatency += float64(latency)

			recall := computeRecallAtK(neighborsToSearchResults(results), groundTruth[i], k)
			totalRecall += recall
		}

		avgRecall := totalRecall / float64(numQueries)
		avgLatency := totalLatency / float64(numQueries)

		t.Logf("%-15d %-15.2f%% %-15.2fµs", rerankFactor, avgRecall*100, avgLatency)

		// 验证召回率达标 (rerankFactor >= 20 时应达到 95%)
		// 注意: 1-bit 策略需要更大的 rerankFactor 来达到高召回率
		if rerankFactor >= 20 && avgRecall < 0.95 {
			t.Errorf("Recall@%d with rerankFactor=%d too low: %.2f%%, expected >= 95%%",
				k, rerankFactor, avgRecall*100)
		}
	}
}

// TestBBQRecallVsNormalSearch 对比 BBQ 搜索与普通搜索的召回率
func TestBBQRecallVsNormalSearch(t *testing.T) {
	dataPath := getSIFTDataPath()
	if dataPath == "" {
		t.Skip("SIFT dataset not found")
	}

	const numVectors = 10000
	const k = 10
	const numQueries = 100

	// 加载数据
	baseVectors, dim, err := loadFvecsPartial(filepath.Join(dataPath, "sift_base.fvecs"), numVectors)
	if err != nil {
		t.Fatalf("Failed to load base vectors: %v", err)
	}

	queryVectors, _, err := loadFvecs(filepath.Join(dataPath, "sift_query.fvecs"))
	if err != nil {
		t.Fatalf("Failed to load query vectors: %v", err)
	}

	// 计算 ground truth
	groundTruth := computeGroundTruth(baseVectors, queryVectors[:numQueries], k)

	// 构建索引
	config := DefaultConfig()
	config.R = 32
	config.L = 50

	idx := New(dim, config)
	if err := idx.Build(baseVectors); err != nil {
		t.Fatalf("Build failed: %v", err)
	}

	t.Logf("=== BBQ vs Normal Search Comparison ===")
	t.Logf("%-20s %-15s %-15s", "Method", "Recall@10", "Avg Latency")
	t.Logf("%-20s %-15s %-15s", "------", "---------", "-----------")

	// 普通搜索
	var normalRecall, normalLatency float64
	for i := 0; i < numQueries; i++ {
		start := time.Now()
		results, _ := idx.Search(queryVectors[i], k, 50)
		normalLatency += float64(time.Since(start).Microseconds())
		normalRecall += computeRecallAtK(results, groundTruth[i], k)
	}
	normalRecall /= float64(numQueries)
	normalLatency /= float64(numQueries)
	t.Logf("%-20s %-15.2f%% %-15.2fµs", "Normal Search", normalRecall*100, normalLatency)

	// BBQ 搜索 (使用 rerankFactor=20 以达到 95%+ 召回率)
	var bbqRecall, bbqLatency float64
	for i := 0; i < numQueries; i++ {
		start := time.Now()
		results := idx.SearchWithBBQ(queryVectors[i], k, 20)
		bbqLatency += float64(time.Since(start).Microseconds())
		bbqRecall += computeRecallAtK(neighborsToSearchResults(results), groundTruth[i], k)
	}
	bbqRecall /= float64(numQueries)
	bbqLatency /= float64(numQueries)
	t.Logf("%-20s %-15.2f%% %-15.2fµs", "BBQ Search", bbqRecall*100, bbqLatency)

	// BBQ 召回率应该接近普通搜索
	recallDiff := normalRecall - bbqRecall
	if recallDiff > 0.05 {
		t.Errorf("BBQ recall (%.2f%%) is significantly lower than normal search (%.2f%%)",
			bbqRecall*100, normalRecall*100)
	}
}

// ============================================================================
// BBQ 内存压缩比测试
// ============================================================================

// TestBBQMemoryUsage 验证 BBQ 的内存压缩比
// 对于 128 维向量：原始 512B -> BBQ 编码 16B (2 * uint64)
// 理论压缩比约为 32:1
func TestBBQMemoryUsage(t *testing.T) {
	if testing.Short() {
		t.Skip("BBQ memory usage measurement")
	}
	const numVectors = 10000
	const dimension = 128

	// 生成随机向量
	vectors := generateRandomVectors(numVectors, dimension)

	config := DefaultConfig()
	config.R = 32
	config.L = 50

	idx := New(dimension, config)
	if err := idx.Build(vectors); err != nil {
		t.Fatalf("Build failed: %v", err)
	}

	// 计算原始向量内存
	// 每个 float32 = 4 bytes, 128 维 = 512 bytes/向量
	originalBytesPerVector := dimension * 4
	originalTotalBytes := numVectors * originalBytesPerVector

	// 计算 BBQ 编码内存
	// 每个向量: bbqPackedSize bytes + 4 bytes (compensation float32)
	bbqBytesPerVector := idx.bbqPackedSize + 4
	bbqTotalBytes := numVectors * bbqBytesPerVector

	// 计算压缩比
	compressionRatio := float64(originalBytesPerVector) / float64(bbqBytesPerVector)

	t.Logf("=== BBQ Memory Usage Test ===")
	t.Logf("Vectors: %d, Dimension: %d", numVectors, dimension)
	t.Logf("")
	t.Logf("Original vector storage:")
	t.Logf("  - Per vector: %d bytes (128 * 4 bytes)", originalBytesPerVector)
	t.Logf("  - Total: %s", formatBytes(uint64(originalTotalBytes)))
	t.Logf("")
	t.Logf("BBQ encoded storage:")
	t.Logf("  - bbqPackedSize: %d", idx.bbqPackedSize)
	t.Logf("  - Per vector: %d bytes (%d + 4)", bbqBytesPerVector, idx.bbqPackedSize)
	t.Logf("  - Total: %s", formatBytes(uint64(bbqTotalBytes)))
	t.Logf("")
	t.Logf("Compression ratio: %.2f:1", compressionRatio)

	// 验证压缩比接近理论值
	// 对于 128 维: 512 / (16 + 4) = 512 / 20 = 25.6:1
	// 注意：实际压缩比略低于 32:1，因为需要存储补偿因子
	expectedMinRatio := 20.0
	if compressionRatio < expectedMinRatio {
		t.Errorf("Compression ratio %.2f:1 is lower than expected minimum %.2f:1",
			compressionRatio, expectedMinRatio)
	}

	// 验证 BBQ 数据结构大小
	actualBBQPackedBytes := len(idx.bbqPacked)
	actualBBQCompBytes := len(idx.bbqCompensations) * 4
	actualBBQCentroidBytes := len(idx.bbqCentroid) * 4

	t.Logf("")
	t.Logf("Actual BBQ data structure sizes:")
	t.Logf("  - bbqPacked: %d bytes = %s", len(idx.bbqPacked), formatBytes(uint64(actualBBQPackedBytes)))
	t.Logf("  - bbqCompensations: %d float32 = %s", len(idx.bbqCompensations), formatBytes(uint64(actualBBQCompBytes)))
	t.Logf("  - bbqCentroid: %d float32 = %s", len(idx.bbqCentroid), formatBytes(uint64(actualBBQCentroidBytes)))
}

// TestBBQMemoryUsageVariousDimensions 测试不同维度下的内存压缩比
func TestBBQMemoryUsageVariousDimensions(t *testing.T) {
	if testing.Short() {
		t.Skip("BBQ memory usage matrix")
	}
	dimensions := []int{64, 128, 256, 512, 768, 1024}
	const numVectors = 1000

	t.Logf("=== BBQ Memory Compression Ratio by Dimension ===")
	t.Logf("%-10s %-15s %-15s %-15s", "Dimension", "Original/Vec", "BBQ/Vec", "Ratio")
	t.Logf("%-10s %-15s %-15s %-15s", "---------", "------------", "-------", "-----")

	for _, dim := range dimensions {
		vectors := generateRandomVectors(numVectors, dim)

		config := DefaultConfig()
		idx := New(dim, config)
		if err := idx.Build(vectors); err != nil {
			t.Fatalf("Build failed for dim=%d: %v", dim, err)
		}

		originalBytes := dim * 4
		bbqBytes := idx.bbqPackedSize + 4
		ratio := float64(originalBytes) / float64(bbqBytes)

		t.Logf("%-10d %-15d %-15d %-15.2f:1", dim, originalBytes, bbqBytes, ratio)
	}
}

// ============================================================================
// BBQ 搜索速度测试
// ============================================================================

// TestBBQSearchSpeed 比较 BBQ 搜索与普通搜索的速度
func TestBBQSearchSpeed(t *testing.T) {
	if testing.Short() {
		t.Skip("BBQ search speed measurement")
	}
	dataPath := getSIFTDataPath()
	if dataPath == "" {
		t.Skip("SIFT dataset not found")
	}

	const numVectors = 10000
	const k = 10
	const numQueries = 100

	// 加载数据
	baseVectors, dim, err := loadFvecsPartial(filepath.Join(dataPath, "sift_base.fvecs"), numVectors)
	if err != nil {
		t.Fatalf("Failed to load base vectors: %v", err)
	}

	queryVectors, _, err := loadFvecs(filepath.Join(dataPath, "sift_query.fvecs"))
	if err != nil {
		t.Fatalf("Failed to load query vectors: %v", err)
	}

	// 构建索引
	config := DefaultConfig()
	config.R = 32
	config.L = 50

	idx := New(dim, config)
	if err := idx.Build(baseVectors); err != nil {
		t.Fatalf("Build failed: %v", err)
	}

	t.Logf("=== BBQ Search Speed Test ===")
	t.Logf("Vectors: %d, Dimension: %d, Queries: %d", numVectors, dim, numQueries)

	// 预热
	for i := 0; i < 10; i++ {
		idx.Search(queryVectors[i], k, 50)
		idx.SearchWithBBQ(queryVectors[i], k, 10)
	}

	// 普通搜索计时
	normalStart := time.Now()
	for i := 0; i < numQueries; i++ {
		idx.Search(queryVectors[i], k, 50)
	}
	normalDuration := time.Since(normalStart)
	normalAvgLatency := float64(normalDuration.Microseconds()) / float64(numQueries)

	// BBQ 搜索计时 (rerankFactor=20 以达到 95%+ 召回率)
	bbqStart := time.Now()
	for i := 0; i < numQueries; i++ {
		idx.SearchWithBBQ(queryVectors[i], k, 20)
	}
	bbqDuration := time.Since(bbqStart)
	bbqAvgLatency := float64(bbqDuration.Microseconds()) / float64(numQueries)

	t.Logf("")
	t.Logf("%-20s %-15s %-15s %-15s", "Method", "Total Time", "Avg Latency", "QPS")
	t.Logf("%-20s %-15s %-15s %-15s", "------", "----------", "-----------", "---")
	t.Logf("%-20s %-15v %-15.2fµs %-15.2f",
		"Normal Search", normalDuration, normalAvgLatency,
		float64(numQueries)/normalDuration.Seconds())
	t.Logf("%-20s %-15v %-15.2fµs %-15.2f",
		"BBQ Search", bbqDuration, bbqAvgLatency,
		float64(numQueries)/bbqDuration.Seconds())

	speedup := normalAvgLatency / bbqAvgLatency
	t.Logf("")
	t.Logf("Speedup: %.2fx", speedup)

	// 注意：BBQ 搜索可能不一定更快，因为需要额外的量化和重排步骤
	// 但在大规模数据集上，BBQ 的优势会更明显
}

// BenchmarkBBQSearch 基准测试：BBQ 搜索性能
func BenchmarkBBQSearch(b *testing.B) {
	dataPath := getSIFTDataPath()
	if dataPath == "" {
		b.Skip("SIFT dataset not found")
	}

	// 加载数据
	vectors, dim, err := loadFvecsPartial(filepath.Join(dataPath, "sift_base.fvecs"), 10000)
	if err != nil {
		b.Fatalf("Failed to load vectors: %v", err)
	}

	queries, _, err := loadFvecs(filepath.Join(dataPath, "sift_query.fvecs"))
	if err != nil {
		b.Fatalf("Failed to load queries: %v", err)
	}

	config := DefaultConfig()
	config.R = 32
	config.L = 50

	idx := New(dim, config)
	if err := idx.Build(vectors); err != nil {
		b.Fatalf("Build failed: %v", err)
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		idx.SearchWithBBQ(queries[i%len(queries)], 10, 10)
	}
}

// BenchmarkNormalVsBBQSearch 基准测试：普通搜索 vs BBQ 搜索
func BenchmarkNormalVsBBQSearch(b *testing.B) {
	dataPath := getSIFTDataPath()
	if dataPath == "" {
		b.Skip("SIFT dataset not found")
	}

	vectors, dim, err := loadFvecsPartial(filepath.Join(dataPath, "sift_base.fvecs"), 10000)
	if err != nil {
		b.Fatalf("Failed to load vectors: %v", err)
	}

	queries, _, err := loadFvecs(filepath.Join(dataPath, "sift_query.fvecs"))
	if err != nil {
		b.Fatalf("Failed to load queries: %v", err)
	}

	config := DefaultConfig()
	idx := New(dim, config)
	if err := idx.Build(vectors); err != nil {
		b.Fatalf("Build failed: %v", err)
	}

	b.Run("NormalSearch", func(b *testing.B) {
		for i := 0; i < b.N; i++ {
			idx.Search(queries[i%len(queries)], 10, 50)
		}
	})

	b.Run("BBQSearch", func(b *testing.B) {
		for i := 0; i < b.N; i++ {
			idx.SearchWithBBQ(queries[i%len(queries)], 10, 10)
		}
	})
}

// ============================================================================
// BBQ 边界条件测试
// ============================================================================

// TestBBQBoundaryConditions 测试 BBQ 的边界条件
func TestBBQBoundaryConditions(t *testing.T) {
	t.Run("LowDimensionNoBBQ", testLowDimensionNoBBQ)
	t.Run("EmptyIndexBBQ", testEmptyIndexBBQ)
	t.Run("SingleVectorBBQ", testSingleVectorBBQ)
	t.Run("BBQThresholdBoundary", testBBQThresholdBoundary)
}

// testLowDimensionNoBBQ 验证低维向量不启用 BBQ
func testLowDimensionNoBBQ(t *testing.T) {
	const numVectors = 100
	const dimension = 32 // < BBQEnableThreshold (33)

	vectors := generateRandomVectors(numVectors, dimension)

	config := DefaultConfig()
	idx := New(dimension, config)

	if err := idx.Build(vectors); err != nil {
		t.Fatalf("Build failed: %v", err)
	}

	// 验证 BBQ 未启用
	if idx.bbqEnabled {
		t.Errorf("BBQ should NOT be enabled for dimension %d", dimension)
	}

	// 验证 BBQ 数据结构为空
	if len(idx.bbqPacked) != 0 {
		t.Errorf("bbqPacked should be empty, got %d elements", len(idx.bbqPacked))
	}
	if len(idx.bbqCompensations) != 0 {
		t.Errorf("bbqCompensations should be empty, got %d elements", len(idx.bbqCompensations))
	}
	if len(idx.bbqCentroid) != 0 {
		t.Errorf("bbqCentroid should be empty, got %d elements", len(idx.bbqCentroid))
	}

	// SearchWithBBQ 应该回退到普通搜索
	query := generateRandomVectors(1, dimension)[0]
	results := idx.SearchWithBBQ(query, 10, 10)

	if len(results) == 0 {
		t.Error("SearchWithBBQ should return results even when BBQ is disabled")
	}

	t.Logf("Low dimension test passed: dim=%d, bbqEnabled=%v, results=%d",
		dimension, idx.bbqEnabled, len(results))
}

// testEmptyIndexBBQ 测试空索引的 BBQ 搜索
func testEmptyIndexBBQ(t *testing.T) {
	const dimension = 128

	config := DefaultConfig()
	idx := New(dimension, config)

	// 不构建任何向量
	query := generateRandomVectors(1, dimension)[0]
	results := idx.SearchWithBBQ(query, 10, 10)

	if len(results) != 0 {
		t.Errorf("SearchWithBBQ on empty index should return 0 results, got %d", len(results))
	}

	t.Logf("Empty index test passed: results=%d", len(results))
}

// testSingleVectorBBQ 测试单向量索引的 BBQ 搜索
func testSingleVectorBBQ(t *testing.T) {
	const dimension = 128

	config := DefaultConfig()
	idx := New(dimension, config)

	// 只插入一个向量
	vector := generateRandomVectors(1, dimension)[0]
	if err := idx.Build([][]float32{vector}); err != nil {
		t.Fatalf("Build failed: %v", err)
	}

	// 验证 BBQ 已启用
	if !idx.bbqEnabled {
		t.Error("BBQ should be enabled for dimension 128")
	}

	// 搜索应该返回这个唯一的向量
	results := idx.SearchWithBBQ(vector, 10, 10)

	if len(results) != 1 {
		t.Errorf("Expected 1 result, got %d", len(results))
	}

	if len(results) > 0 && results[0].ID != 0 {
		t.Errorf("Expected ID 0, got %d", results[0].ID)
	}

	t.Logf("Single vector test passed: results=%d", len(results))
}

// testBBQThresholdBoundary 测试 BBQ 启用阈值边界
func testBBQThresholdBoundary(t *testing.T) {
	config := DefaultConfig()

	// 测试阈值以下
	for dim := 30; dim < bbq.BBQEnableThreshold; dim++ {
		idx := New(dim, config)
		if idx.bbqEnabled {
			t.Errorf("BBQ should NOT be enabled for dimension %d", dim)
		}
	}

	// 测试阈值及以上
	for dim := bbq.BBQEnableThreshold; dim <= bbq.BBQEnableThreshold+5; dim++ {
		idx := New(dim, config)
		if !idx.bbqEnabled {
			t.Errorf("BBQ should be enabled for dimension %d", dim)
		}

		// 验证 bbqPackedSize 计算正确
		expectedPackedSize := (dim + 7) / 8
		if idx.bbqPackedSize != expectedPackedSize {
			t.Errorf("dim=%d: bbqPackedSize mismatch: expected %d, got %d",
				dim, expectedPackedSize, idx.bbqPackedSize)
		}
	}

	t.Logf("BBQ threshold boundary test passed: threshold=%d", bbq.BBQEnableThreshold)
}

// TestBBQWithRandomData 使用随机数据测试 BBQ 功能
func TestBBQWithRandomData(t *testing.T) {
	const numVectors = 5000
	const dimension = 128
	const k = 10
	const numQueries = 50

	// 生成随机向量并归一化（BBQ 使用余弦相似度，需要归一化向量）
	vectors := generateRandomVectors(numVectors, dimension)
	for i := range vectors {
		normalizeVector(vectors[i])
	}
	queries := generateRandomVectors(numQueries, dimension)
	for i := range queries {
		normalizeVector(queries[i])
	}

	// 构建索引
	config := DefaultConfig()
	config.R = 32
	config.L = 50

	idx := New(dimension, config)
	if err := idx.Build(vectors); err != nil {
		t.Fatalf("Build failed: %v", err)
	}

	// 计算 ground truth（使用欧几里得距离，与 SearchWithBBQ 重排阶段一致）
	groundTruth := make([][]int32, numQueries)
	for i, query := range queries {
		groundTruth[i] = computeBruteForceKNN(vectors, query, k)
	}

	// 测试 BBQ 搜索召回率
	// 随机数据的分布特性与真实数据不同，需要更大的 rerankFactor
	// SIFT 数据使用 rerankFactor=20 可达 96%+，随机数据需要 rerankFactor=30
	const rerankFactor = 30
	var totalRecall float64
	for i, query := range queries {
		results := idx.SearchWithBBQ(query, k, rerankFactor)
		recall := computeRecallAtK(neighborsToSearchResults(results), groundTruth[i], k)
		totalRecall += recall
	}
	avgRecall := totalRecall / float64(numQueries)

	t.Logf("=== BBQ Random Data Test ===")
	t.Logf("Vectors: %d, Dimension: %d, Queries: %d", numVectors, dimension, numQueries)
	t.Logf("RerankFactor: %d", rerankFactor)
	t.Logf("Average Recall@%d: %.2f%%", k, avgRecall*100)

	// 召回率应该至少达到 90%
	if avgRecall < 0.90 {
		t.Errorf("Recall@%d too low: %.2f%%, expected >= 90%%", k, avgRecall*100)
	}
}
