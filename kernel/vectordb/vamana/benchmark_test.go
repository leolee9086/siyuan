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
	"bufio"
	"encoding/binary"
	"fmt"
	"io"
	"math"
	"os"
	"path/filepath"
	"runtime"
	"sort"
	"testing"
	"time"
)

// ============================================================================
// 数据集加载器
// ============================================================================

// loadFvecs 读取 fvecs 格式文件 (SIFT1M/GIST1M)
// Format: <d(int32)> <float32>...<float32>
func loadFvecs(path string) ([][]float32, int, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, 0, err
	}
	defer f.Close()

	fi, err := f.Stat()
	if err != nil {
		return nil, 0, err
	}
	fileSize := fi.Size()

	var firstDim int32
	if err := binary.Read(f, binary.LittleEndian, &firstDim); err != nil {
		return nil, 0, err
	}
	f.Seek(0, 0)

	dim := int(firstDim)
	rowBytes := 4 + dim*4
	numVectors := int(fileSize / int64(rowBytes))

	vectors := make([][]float32, 0, numVectors)
	reader := bufio.NewReaderSize(f, 16*1024*1024)
	buf := make([]byte, rowBytes)

	for {
		if _, err := io.ReadFull(reader, buf); err != nil {
			if err == io.EOF {
				break
			}
			return nil, 0, err
		}

		d := int32(binary.LittleEndian.Uint32(buf[0:4]))
		if int(d) != dim {
			return nil, 0, fmt.Errorf("dimension mismatch: expected %d, got %d", dim, d)
		}

		vec := make([]float32, dim)
		for i := 0; i < dim; i++ {
			bits := binary.LittleEndian.Uint32(buf[4+i*4:])
			vec[i] = math.Float32frombits(bits)
		}
		vectors = append(vectors, vec)
	}

	return vectors, dim, nil
}

// loadFvecsPartial 读取 fvecs 文件的前 n 个向量
func loadFvecsPartial(path string, n int) ([][]float32, int, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, 0, err
	}
	defer f.Close()

	var firstDim int32
	if err := binary.Read(f, binary.LittleEndian, &firstDim); err != nil {
		return nil, 0, err
	}
	f.Seek(0, 0)

	dim := int(firstDim)
	rowBytes := 4 + dim*4

	vectors := make([][]float32, 0, n)
	reader := bufio.NewReaderSize(f, 16*1024*1024)
	buf := make([]byte, rowBytes)

	for i := 0; i < n; i++ {
		if _, err := io.ReadFull(reader, buf); err != nil {
			if err == io.EOF {
				break
			}
			return nil, 0, err
		}

		d := int32(binary.LittleEndian.Uint32(buf[0:4]))
		if int(d) != dim {
			return nil, 0, fmt.Errorf("dimension mismatch: expected %d, got %d", dim, d)
		}

		vec := make([]float32, dim)
		for i := 0; i < dim; i++ {
			bits := binary.LittleEndian.Uint32(buf[4+i*4:])
			vec[i] = math.Float32frombits(bits)
		}
		vectors = append(vectors, vec)
	}

	return vectors, dim, nil
}

// loadIvecs 读取 ivecs 格式文件 (Ground Truth)
// Format: <d(int32)> <int32>...<int32>
func loadIvecs(path string) ([][]int32, int, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, 0, err
	}
	defer f.Close()

	fi, err := f.Stat()
	if err != nil {
		return nil, 0, err
	}
	fileSize := fi.Size()

	var firstDim int32
	if err := binary.Read(f, binary.LittleEndian, &firstDim); err != nil {
		return nil, 0, err
	}
	f.Seek(0, 0)

	dim := int(firstDim)
	rowBytes := 4 + dim*4
	numVectors := int(fileSize / int64(rowBytes))

	vectors := make([][]int32, 0, numVectors)
	reader := bufio.NewReaderSize(f, 4*1024*1024)
	buf := make([]byte, rowBytes)

	for {
		if _, err := io.ReadFull(reader, buf); err != nil {
			if err == io.EOF {
				break
			}
			return nil, 0, err
		}

		d := int32(binary.LittleEndian.Uint32(buf[0:4]))
		if int(d) != dim {
			return nil, 0, fmt.Errorf("dimension mismatch: expected %d, got %d", dim, d)
		}

		vec := make([]int32, dim)
		for i := 0; i < dim; i++ {
			vec[i] = int32(binary.LittleEndian.Uint32(buf[4+i*4:]))
		}
		vectors = append(vectors, vec)
	}

	return vectors, dim, nil
}

// ============================================================================
// 辅助函数
// ============================================================================

// getSIFTDataPath 获取 SIFT 数据集路径
func getSIFTDataPath() string {
	// 从当前目录向上查找 test_data/sift
	candidates := []string{
		"../../../test_data/sift",
		"../../test_data/sift",
		"../test_data/sift",
		"test_data/sift",
	}

	for _, p := range candidates {
		if _, err := os.Stat(filepath.Join(p, "sift_base.fvecs")); err == nil {
			return p
		}
	}
	return ""
}

// computeRecallAtK 计算 Recall@K
func computeRecallAtK(results []SearchResult, groundTruth []int32, k int) float64 {
	if k > len(groundTruth) {
		k = len(groundTruth)
	}
	if k > len(results) {
		k = len(results)
	}

	gtSet := make(map[int32]struct{}, k)
	for i := 0; i < k; i++ {
		gtSet[groundTruth[i]] = struct{}{}
	}

	hits := 0
	for i := 0; i < len(results) && i < k; i++ {
		if _, ok := gtSet[int32(results[i].ID)]; ok {
			hits++
		}
	}

	return float64(hits) / float64(k)
}

// neighborsToSearchResults 将 []Neighbor 转换为 []SearchResult（供 BBQ 测试使用）
func neighborsToSearchResults(neighbors []Neighbor) []SearchResult {
	results := make([]SearchResult, len(neighbors))
	for i, n := range neighbors {
		results[i] = SearchResult{ID: uint64(n.ID), Distance: n.Distance}
	}
	return results
}

// computeBruteForceKNN 暴力搜索K近邻 (用于生成 ground truth)
func computeBruteForceKNN(vectors [][]float32, query []float32, k int) []int32 {
	type distPair struct {
		id   int32
		dist float32
	}

	pairs := make([]distPair, len(vectors))
	for i, v := range vectors {
		var dist float32
		for j := range v {
			diff := v[j] - query[j]
			dist += diff * diff
		}
		pairs[i] = distPair{id: int32(i), dist: dist}
	}

	// 部分排序，只需要前 k 个
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

// computeGroundTruth 为查询向量计算 ground truth
func computeGroundTruth(baseVectors [][]float32, queryVectors [][]float32, k int) [][]int32 {
	groundTruth := make([][]int32, len(queryVectors))
	for i, query := range queryVectors {
		groundTruth[i] = computeBruteForceKNN(baseVectors, query, k)
	}
	return groundTruth
}

// getMemStats 获取内存统计
func getMemStats() runtime.MemStats {
	var m runtime.MemStats
	runtime.ReadMemStats(&m)
	return m
}

// formatBytes 格式化字节数
func formatBytes(bytes uint64) string {
	const (
		KB = 1024
		MB = KB * 1024
		GB = MB * 1024
	)
	switch {
	case bytes >= GB:
		return fmt.Sprintf("%.2f GB", float64(bytes)/GB)
	case bytes >= MB:
		return fmt.Sprintf("%.2f MB", float64(bytes)/MB)
	case bytes >= KB:
		return fmt.Sprintf("%.2f KB", float64(bytes)/KB)
	default:
		return fmt.Sprintf("%d B", bytes)
	}
}

// percentile 计算百分位数
func percentile(values []float64, p float64) float64 {
	if len(values) == 0 {
		return 0
	}
	sorted := make([]float64, len(values))
	copy(sorted, values)
	sort.Float64s(sorted)

	idx := int(float64(len(sorted)-1) * p / 100.0)
	return sorted[idx]
}

// ============================================================================
// 大规模测试
// ============================================================================

// TestSIFT10K 测试 SIFT 数据集 (1万向量) - 快速验证
func TestSIFT10K(t *testing.T) {
	if testing.Short() {
		t.Skip("external SIFT dataset benchmark")
	}
	dataPath := getSIFTDataPath()
	if dataPath == "" {
		t.Skip("SIFT dataset not found. Download from: ftp://ftp.irisa.fr/local/texmex/corpus/sift.tar.gz")
	}

	const numVectors = 10000

	t.Logf("=== SIFT 10K Benchmark ===")
	t.Logf("Loading %d vectors from %s...", numVectors, dataPath)

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

	// 为部分数据集计算 ground truth (因为文件中的 ground truth 是基于完整 1M 数据集)
	numQueries := 100
	k := 10
	t.Logf("Computing ground truth for %d queries (k=%d)...", numQueries, k)
	gtStart := time.Now()
	groundTruth := computeGroundTruth(baseVectors, queryVectors[:numQueries], k)
	t.Logf("Ground truth computed in %v", time.Since(gtStart))

	// 记录初始内存
	runtime.GC()
	memBefore := getMemStats()

	// 构建索引
	config := DefaultConfig()
	config.R = 32
	config.L = 50
	config.Alpha = 1.2

	idx := New(dim, config)

	t.Logf("\nBuilding index with R=%d, L=%d, Alpha=%.1f...", config.R, config.L, config.Alpha)
	buildStart := time.Now()
	if err := idx.Build(baseVectors); err != nil {
		t.Fatalf("Build failed: %v", err)
	}
	buildTime := time.Since(buildStart)

	// 记录构建后内存
	runtime.GC()
	memAfter := getMemStats()
	memUsed := memAfter.Alloc - memBefore.Alloc

	t.Logf("Build completed in %v", buildTime)
	t.Logf("Build throughput: %.0f vectors/sec", float64(numVectors)/buildTime.Seconds())
	t.Logf("Memory used: %s", formatBytes(memUsed))

	// 查询测试
	searchL := 50

	t.Logf("\nRunning %d queries with k=%d, L=%d...", numQueries, k, searchL)

	latencies := make([]float64, numQueries)
	recalls := make([]float64, numQueries)

	queryStart := time.Now()
	for i := 0; i < numQueries; i++ {
		start := time.Now()
		results, _ := idx.Search(queryVectors[i], k, searchL)
		latencies[i] = float64(time.Since(start).Microseconds())

		// 计算召回率 - 使用暴力搜索作为ground truth (因为只有10K向量)
		recalls[i] = computeRecallAtK(results, groundTruth[i], k)
	}
	totalQueryTime := time.Since(queryStart)

	// 统计结果
	avgLatency := 0.0
	avgRecall := 0.0
	for i := 0; i < numQueries; i++ {
		avgLatency += latencies[i]
		avgRecall += recalls[i]
	}
	avgLatency /= float64(numQueries)
	avgRecall /= float64(numQueries)

	p50 := percentile(latencies, 50)
	p99 := percentile(latencies, 99)
	qps := float64(numQueries) / totalQueryTime.Seconds()

	t.Logf("\n=== Query Results ===")
	t.Logf("Total query time: %v", totalQueryTime)
	t.Logf("QPS: %.2f", qps)
	t.Logf("Latency P50: %.2f µs", p50)
	t.Logf("Latency P99: %.2f µs", p99)
	t.Logf("Recall@%d: %.2f%%", k, avgRecall*100)
}

// TestSIFT100K 测试 SIFT 数据集 (10万向量)
func TestSIFT100K(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping SIFT100K test in short mode")
	}
	dataPath := getSIFTDataPath()
	if dataPath == "" {
		t.Skip("SIFT dataset not found. Download from: ftp://ftp.irisa.fr/local/texmex/corpus/sift.tar.gz")
	}

	const numVectors = 100000

	t.Logf("=== SIFT 100K Benchmark ===")
	t.Logf("Loading %d vectors from %s...", numVectors, dataPath)

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

	// 为部分数据集计算 ground truth
	numQueries := 100
	k := 10
	t.Logf("Computing ground truth for %d queries (k=%d)...", numQueries, k)
	gtStart := time.Now()
	groundTruth := computeGroundTruth(baseVectors, queryVectors[:numQueries], k)
	t.Logf("Ground truth computed in %v", time.Since(gtStart))

	// 记录初始内存
	runtime.GC()
	memBefore := getMemStats()

	// 构建索引
	config := DefaultConfig()
	config.R = 64
	config.L = 100
	config.Alpha = 1.2

	idx := New(dim, config)

	t.Logf("\nBuilding index with R=%d, L=%d, Alpha=%.1f...", config.R, config.L, config.Alpha)
	buildStart := time.Now()
	if err := idx.Build(baseVectors); err != nil {
		t.Fatalf("Build failed: %v", err)
	}
	buildTime := time.Since(buildStart)

	// 记录构建后内存
	runtime.GC()
	memAfter := getMemStats()
	memUsed := memAfter.Alloc - memBefore.Alloc

	t.Logf("Build completed in %v", buildTime)
	t.Logf("Build throughput: %.0f vectors/sec", float64(numVectors)/buildTime.Seconds())
	t.Logf("Memory used: %s", formatBytes(memUsed))
	t.Logf("Memory per vector: %.2f KB", float64(memUsed)/float64(numVectors)/1024)

	// 查询测试
	searchL := 100

	t.Logf("\nRunning %d queries with k=%d, L=%d...", numQueries, k, searchL)

	latencies := make([]float64, numQueries)
	recalls := make([]float64, numQueries)

	queryStart := time.Now()
	for i := 0; i < numQueries; i++ {
		start := time.Now()
		results, _ := idx.Search(queryVectors[i], k, searchL)
		latencies[i] = float64(time.Since(start).Microseconds())

		// 计算召回率 (只对前100K向量有效的ground truth)
		recalls[i] = computeRecallAtK(results, groundTruth[i], k)
	}
	totalQueryTime := time.Since(queryStart)

	// 统计结果
	avgLatency := 0.0
	avgRecall := 0.0
	for i := 0; i < numQueries; i++ {
		avgLatency += latencies[i]
		avgRecall += recalls[i]
	}
	avgLatency /= float64(numQueries)
	avgRecall /= float64(numQueries)

	p50 := percentile(latencies, 50)
	p99 := percentile(latencies, 99)
	qps := float64(numQueries) / totalQueryTime.Seconds()

	t.Logf("\n=== Query Results ===")
	t.Logf("Total query time: %v", totalQueryTime)
	t.Logf("QPS: %.2f", qps)
	t.Logf("Latency P50: %.2f µs", p50)
	t.Logf("Latency P99: %.2f µs", p99)
	t.Logf("Average latency: %.2f µs", avgLatency)
	t.Logf("Recall@%d: %.2f%%", k, avgRecall*100)

	// 验证召回率
	if avgRecall < 0.80 {
		t.Errorf("Recall@%d too low: %.2f%%, expected >= 80%%", k, avgRecall*100)
	}
}

// TestSIFT1M 测试完整 SIFT1M 数据集 (100万向量)
func TestSIFT1M(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping SIFT1M test in short mode")
	}

	dataPath := getSIFTDataPath()
	if dataPath == "" {
		t.Skip("SIFT dataset not found. Download from: ftp://ftp.irisa.fr/local/texmex/corpus/sift.tar.gz")
	}

	t.Logf("=== SIFT 1M Benchmark ===")
	t.Logf("Loading full dataset from %s...", dataPath)

	// 加载完整数据
	baseVectors, dim, err := loadFvecs(filepath.Join(dataPath, "sift_base.fvecs"))
	if err != nil {
		t.Fatalf("Failed to load base vectors: %v", err)
	}
	t.Logf("Loaded %d base vectors, dimension=%d", len(baseVectors), dim)

	queryVectors, _, err := loadFvecs(filepath.Join(dataPath, "sift_query.fvecs"))
	if err != nil {
		t.Fatalf("Failed to load query vectors: %v", err)
	}
	t.Logf("Loaded %d query vectors", len(queryVectors))

	groundTruth, gtK, err := loadIvecs(filepath.Join(dataPath, "sift_groundtruth.ivecs"))
	if err != nil {
		t.Fatalf("Failed to load ground truth: %v", err)
	}
	t.Logf("Loaded %d ground truth entries, k=%d", len(groundTruth), gtK)

	// 记录初始内存
	runtime.GC()
	memBefore := getMemStats()

	// 构建索引
	config := DefaultConfig()
	config.R = 64
	config.L = 100
	config.Alpha = 1.2

	idx := New(dim, config)

	t.Logf("\nBuilding index with R=%d, L=%d, Alpha=%.1f...", config.R, config.L, config.Alpha)
	buildStart := time.Now()
	if err := idx.Build(baseVectors); err != nil {
		t.Fatalf("Build failed: %v", err)
	}
	buildTime := time.Since(buildStart)

	// 记录构建后内存
	runtime.GC()
	memAfter := getMemStats()
	memUsed := memAfter.Alloc - memBefore.Alloc

	numVectors := len(baseVectors)
	t.Logf("Build completed in %v", buildTime)
	t.Logf("Build throughput: %.0f vectors/sec", float64(numVectors)/buildTime.Seconds())
	t.Logf("Memory used: %s", formatBytes(memUsed))
	t.Logf("Memory per vector: %.2f KB", float64(memUsed)/float64(numVectors)/1024)

	// 查询测试
	numQueries := len(queryVectors)
	if numQueries > 1000 {
		numQueries = 1000
	}

	k := 10
	searchL := 100

	t.Logf("\nRunning %d queries with k=%d, L=%d...", numQueries, k, searchL)

	latencies := make([]float64, numQueries)
	recalls := make([]float64, numQueries)

	queryStart := time.Now()
	for i := 0; i < numQueries; i++ {
		start := time.Now()
		results, _ := idx.Search(queryVectors[i], k, searchL)
		latencies[i] = float64(time.Since(start).Microseconds())
		recalls[i] = computeRecallAtK(results, groundTruth[i], k)
	}
	totalQueryTime := time.Since(queryStart)

	// 统计结果
	avgLatency := 0.0
	avgRecall := 0.0
	for i := 0; i < numQueries; i++ {
		avgLatency += latencies[i]
		avgRecall += recalls[i]
	}
	avgLatency /= float64(numQueries)
	avgRecall /= float64(numQueries)

	p50 := percentile(latencies, 50)
	p99 := percentile(latencies, 99)
	qps := float64(numQueries) / totalQueryTime.Seconds()

	t.Logf("\n=== Query Results ===")
	t.Logf("Total query time: %v", totalQueryTime)
	t.Logf("QPS: %.2f", qps)
	t.Logf("Latency P50: %.2f µs", p50)
	t.Logf("Latency P99: %.2f µs", p99)
	t.Logf("Average latency: %.2f µs", avgLatency)
	t.Logf("Recall@%d: %.2f%%", k, avgRecall*100)

	// 验证召回率
	if avgRecall < 0.85 {
		t.Errorf("Recall@%d too low: %.2f%%, expected >= 85%%", k, avgRecall*100)
	}
}

// BenchmarkSIFTBuild 基准测试：索引构建
func BenchmarkSIFTBuild(b *testing.B) {
	dataPath := getSIFTDataPath()
	if dataPath == "" {
		b.Skip("SIFT dataset not found")
	}

	// 加载10K向量用于基准测试
	vectors, dim, err := loadFvecsPartial(filepath.Join(dataPath, "sift_base.fvecs"), 10000)
	if err != nil {
		b.Fatalf("Failed to load vectors: %v", err)
	}

	config := DefaultConfig()
	config.R = 64
	config.L = 100

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		idx := New(dim, config)
		idx.Build(vectors)
	}
}

// BenchmarkSIFTSearch 基准测试：查询性能
func BenchmarkSIFTSearch(b *testing.B) {
	dataPath := getSIFTDataPath()
	if dataPath == "" {
		b.Skip("SIFT dataset not found")
	}

	// 加载数据
	vectors, dim, err := loadFvecsPartial(filepath.Join(dataPath, "sift_base.fvecs"), 100000)
	if err != nil {
		b.Fatalf("Failed to load vectors: %v", err)
	}

	queries, _, err := loadFvecs(filepath.Join(dataPath, "sift_query.fvecs"))
	if err != nil {
		b.Fatalf("Failed to load queries: %v", err)
	}

	config := DefaultConfig()
	config.R = 64
	config.L = 100

	idx := New(dim, config)
	if err := idx.Build(vectors); err != nil {
		b.Fatalf("Build failed: %v", err)
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		idx.Search(queries[i%len(queries)], 10, 100)
	}
}

// TestRecallVsSearchL 测试不同 SearchL 参数对召回率的影响
func TestRecallVsSearchL(t *testing.T) {
	if testing.Short() {
		t.Skip("search recall parameter comparison")
	}
	dataPath := getSIFTDataPath()
	if dataPath == "" {
		t.Skip("SIFT dataset not found")
	}

	// 加载数据
	vectors, dim, err := loadFvecsPartial(filepath.Join(dataPath, "sift_base.fvecs"), 100000)
	if err != nil {
		t.Fatalf("Failed to load vectors: %v", err)
	}

	queries, _, err := loadFvecs(filepath.Join(dataPath, "sift_query.fvecs"))
	if err != nil {
		t.Fatalf("Failed to load queries: %v", err)
	}

	// 为部分数据集计算 ground truth
	k := 10
	numQueries := 100
	t.Logf("Computing ground truth for %d queries...", numQueries)
	groundTruth := computeGroundTruth(vectors, queries[:numQueries], k)

	// 构建索引
	config := DefaultConfig()
	config.R = 64
	config.L = 100

	idx := New(dim, config)
	if err := idx.Build(vectors); err != nil {
		t.Fatalf("Build failed: %v", err)
	}

	// 测试不同的 SearchL 值
	searchLValues := []int{10, 20, 50, 100, 200, 500}

	t.Logf("\n=== Recall vs SearchL ===")
	t.Logf("%-10s %-15s %-15s %-15s", "SearchL", "Recall@10", "Avg Latency", "QPS")
	t.Logf("%-10s %-15s %-15s %-15s", "-------", "---------", "-----------", "---")

	for _, searchL := range searchLValues {
		latencies := make([]float64, numQueries)
		recalls := make([]float64, numQueries)

		start := time.Now()
		for i := 0; i < numQueries; i++ {
			qStart := time.Now()
			results, _ := idx.Search(queries[i], k, searchL)
			latencies[i] = float64(time.Since(qStart).Microseconds())
			recalls[i] = computeRecallAtK(results, groundTruth[i], k)
		}
		totalTime := time.Since(start)

		avgRecall := 0.0
		avgLatency := 0.0
		for i := 0; i < numQueries; i++ {
			avgRecall += recalls[i]
			avgLatency += latencies[i]
		}
		avgRecall /= float64(numQueries)
		avgLatency /= float64(numQueries)
		qps := float64(numQueries) / totalTime.Seconds()

		t.Logf("%-10d %-15.2f%% %-15.2fµs %-15.2f", searchL, avgRecall*100, avgLatency, qps)
	}
}

// ============================================================================
// 并行构建测试
// ============================================================================

// TestBuildParallel 测试并行构建功能
func TestBuildParallel(t *testing.T) {
	if testing.Short() {
		t.Skip("parallel build performance test")
	}
	dataPath := getSIFTDataPath()
	if dataPath == "" {
		t.Skip("SIFT dataset not found")
	}

	const numVectors = 10000

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
	numQueries := 100
	k := 10
	groundTruth := computeGroundTruth(baseVectors, queryVectors[:numQueries], k)

	config := DefaultConfig()
	config.R = 32
	config.L = 50
	config.Alpha = 1.2

	// 测试不同的 worker 数量
	workerCounts := []int{1, 2, 4, runtime.NumCPU()}

	t.Logf("=== Parallel Build Test ===")
	t.Logf("Vectors: %d, Dimension: %d", numVectors, dim)
	t.Logf("%-10s %-15s %-15s %-15s", "Workers", "Build Time", "Throughput", "Recall@10")

	for _, numWorkers := range workerCounts {
		idx := New(dim, config)

		buildStart := time.Now()
		if err := idx.BuildParallel(baseVectors, numWorkers); err != nil {
			t.Fatalf("BuildParallel failed with %d workers: %v", numWorkers, err)
		}
		buildTime := time.Since(buildStart)

		// 验证召回率
		totalRecall := 0.0
		for i := 0; i < numQueries; i++ {
			results, _ := idx.Search(queryVectors[i], k, 50)
			totalRecall += computeRecallAtK(results, groundTruth[i], k)
		}
		avgRecall := totalRecall / float64(numQueries)

		throughput := float64(numVectors) / buildTime.Seconds()
		t.Logf("%-10d %-15v %-15.0f %-15.2f%%", numWorkers, buildTime, throughput, avgRecall*100)

		// 验证召回率不低于串行构建
		if avgRecall < 0.90 {
			t.Errorf("Recall too low with %d workers: %.2f%%, expected >= 90%%", numWorkers, avgRecall*100)
		}
	}
}

// TestBuildParallel100K 测试 100K 规模的并行构建
func TestBuildParallel100K(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping 100K parallel build test in short mode")
	}

	dataPath := getSIFTDataPath()
	if dataPath == "" {
		t.Skip("SIFT dataset not found")
	}

	const numVectors = 100000

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
	numQueries := 100
	k := 10
	t.Logf("Computing ground truth...")
	groundTruth := computeGroundTruth(baseVectors, queryVectors[:numQueries], k)

	config := DefaultConfig()
	config.R = 64
	config.L = 100
	config.Alpha = 1.2

	t.Logf("=== Parallel Build 100K Test ===")
	t.Logf("Vectors: %d, Dimension: %d", numVectors, dim)

	// 只测试并行构建（串行构建在100K规模下太慢）
	numWorkers := runtime.NumCPU()
	t.Logf("\n--- Parallel Build (%d workers) ---", numWorkers)
	idxParallel := New(dim, config)
	parallelStart := time.Now()
	if err := idxParallel.BuildParallel(baseVectors, numWorkers); err != nil {
		t.Fatalf("Parallel build failed: %v", err)
	}
	parallelTime := time.Since(parallelStart)
	parallelThroughput := float64(numVectors) / parallelTime.Seconds()
	t.Logf("Parallel: %v (%.0f vec/s)", parallelTime, parallelThroughput)

	// 验证召回率
	t.Logf("\n--- Recall Test ---")
	parallelRecall := 0.0
	for i := 0; i < numQueries; i++ {
		parallelResults, _ := idxParallel.Search(queryVectors[i], k, 100)
		parallelRecall += computeRecallAtK(parallelResults, groundTruth[i], k)
	}
	parallelRecall /= float64(numQueries)

	t.Logf("Parallel Recall@%d: %.2f%%", k, parallelRecall*100)

	// 验证召回率达标
	if parallelRecall < 0.80 {
		t.Errorf("Parallel recall (%.2f%%) too low, expected >= 80%%", parallelRecall*100)
	}
}

// BenchmarkBuildParallel 基准测试：并行构建
func BenchmarkBuildParallel(b *testing.B) {
	dataPath := getSIFTDataPath()
	if dataPath == "" {
		b.Skip("SIFT dataset not found")
	}

	vectors, dim, err := loadFvecsPartial(filepath.Join(dataPath, "sift_base.fvecs"), 10000)
	if err != nil {
		b.Fatalf("Failed to load vectors: %v", err)
	}

	config := DefaultConfig()
	config.R = 64
	config.L = 100

	numWorkers := runtime.NumCPU()

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		idx := New(dim, config)
		idx.BuildParallel(vectors, numWorkers)
	}
}
