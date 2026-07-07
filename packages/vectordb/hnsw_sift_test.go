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

// 本文件由 kernel/vectordb/hnsw_sift_test.go 移植，
// 导入路径已适配 packages/vectordb 的独立模块结构。

package vectordb

import (
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

// =========================================
// SIFT dataset helpers (package-level, for HNSW Collection tests)
// =========================================

// loadFvecsPartial reads the first n vectors from an fvecs file.
func loadFvecsPartial(path string, n int) ([][]float32, int, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, 0, err
	}
	defer f.Close()

	// Read first dimension
	var firstDim int32
	if err := binary.Read(f, binary.LittleEndian, &firstDim); err != nil {
		return nil, 0, err
	}
	dim := int(firstDim)
	f.Seek(0, 0)

	rowBytes := 4 + dim*4
	vectors := make([][]float32, 0, n)

	for i := 0; i < n; i++ {
		buf := make([]byte, rowBytes)
		if _, err := io.ReadFull(f, buf); err != nil {
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
		for j := 0; j < dim; j++ {
			bits := binary.LittleEndian.Uint32(buf[4+j*4:])
			vec[j] = math.Float32frombits(bits)
		}
		vectors = append(vectors, vec)
	}
	return vectors, dim, nil
}

// getSIFTDataPath finds the SIFT dataset directory.
// From packages/vectordb, the test_data is expected at ../../test_data/sift
// (two levels up from packages/vectordb to repo root).
func getSIFTDataPath() string {
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

// hnswBruteForceKNN brute-force kNN search for SIFT vectors (L2 squared).
// Returns indices (0..len(vectors)-1) sorted by distance ascending.
func hnswBruteForceKNN(vectors [][]float32, query []float32, k int) []int {
	type pair struct {
		idx  int
		dist float32
	}
	pairs := make([]pair, len(vectors))
	for i, v := range vectors {
		var d float32
		for j := range v {
			diff := v[j] - query[j]
			d += diff * diff
		}
		pairs[i] = pair{idx: i, dist: d}
	}
	sort.Slice(pairs, func(i, j int) bool { return pairs[i].dist < pairs[j].dist })
	if k > len(pairs) {
		k = len(pairs)
	}
	result := make([]int, k)
	for i := 0; i < k; i++ {
		result[i] = pairs[i].idx
	}
	return result
}

// hnswComputeRecallAtK computes recall@k for SearchResults.
// groundTruthIndices: the true top-k indices (from brute force).
func hnswComputeRecallAtK(results []SearchResult, groundTruthIndices []int, k int) float64 {
	gtSet := make(map[string]bool, k)
	for _, idx := range groundTruthIndices {
		gtSet[fmt.Sprintf("%d", idx)] = true
	}
	hits := 0
	for i := 0; i < len(results) && i < k; i++ {
		if gtSet[results[i].ID] {
			hits++
		}
	}
	if k == 0 {
		return 0
	}
	return float64(hits) / float64(k)
}

// hnswPercentile computes the p-th percentile of values (0..100).
func hnswPercentile(values []float64, p float64) float64 {
	if len(values) == 0 {
		return 0
	}
	sorted := make([]float64, len(values))
	copy(sorted, values)
	sort.Float64s(sorted)
	idx := int(float64(len(sorted)-1) * p / 100.0)
	return sorted[idx]
}

// hnswFormatBytes formats bytes to human-readable string.
func hnswFormatBytes(bytes uint64) string {
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

// =========================================
// HNSW SIFT Tests
// =========================================

// TestHNSW_SIFT_10K builds an HNSW index on SIFT 10K and measures recall.
func TestHNSW_SIFT_10K(t *testing.T) {
	dataPath := getSIFTDataPath()
	if dataPath == "" {
		t.Skip("SIFT dataset not found. Download from: ftp://ftp.irisa.fr/local/texmex/corpus/sift.tar.gz")
	}

	const numVectors = 10000

	t.Logf("=== HNSW SIFT 10K ===")
	t.Logf("Loading %d vectors from %s...", numVectors, dataPath)

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

	numQueries := 100
	k := 10

	// Compute ground truth (brute force for 10K)
	t.Logf("Computing ground truth for %d queries (k=%d)...", numQueries, k)
	gtStart := time.Now()
	groundTruth := make([][]int, numQueries)
	for i := 0; i < numQueries; i++ {
		groundTruth[i] = hnswBruteForceKNN(baseVectors, queryVectors[i], k)
	}
	t.Logf("Ground truth computed in %v", time.Since(gtStart))

	// Memory before build
	runtime.GC()
	var mBefore runtime.MemStats
	runtime.ReadMemStats(&mBefore)

	// Build HNSW index — 使用 NewCollectionWithMetric 从创建起即指定 L2 度量，
	// 确保 VectorStore 的 BBQ 量化器和 HNSWIndex 的距离计算均使用欧氏距离。
	// 若先以默认 cosine 创建再改 Config，量化器仍为余弦模式，导致图结构质量差、
	// 插入性能随规模超线性退化。
	collection := NewCollectionWithMetric("sift10k", dim, "l2")

	t.Logf("Building HNSW index (M=%d, efConstruction=%d)...",
		collection.Config.M, collection.Config.EfConstruction)
	buildStart := time.Now()
	for i, vec := range baseVectors {
		err := collection.InsertPoint(Point{
			ID:     fmt.Sprintf("%d", i),
			Vector: vec,
		})
		if err != nil {
			t.Fatalf("Insert failed at %d: %v", i, err)
		}
	}
	buildTime := time.Since(buildStart)

	runtime.GC()
	var mAfter runtime.MemStats
	runtime.ReadMemStats(&mAfter)
	memUsed := mAfter.Alloc - mBefore.Alloc

	t.Logf("Build completed in %v", buildTime)
	t.Logf("Build throughput: %.0f vectors/sec", float64(numVectors)/buildTime.Seconds())
	t.Logf("Memory used: %s", hnswFormatBytes(memUsed))

	// Search
	efSearch := 200
	t.Logf("Running %d queries with k=%d, efSearch=%d...", numQueries, k, efSearch)

	latencies := make([]float64, numQueries)
	recalls := make([]float64, numQueries)

	queryStart := time.Now()
	for i := 0; i < numQueries; i++ {
		start := time.Now()
		results := collection.Search(queryVectors[i], k, efSearch)
		latencies[i] = float64(time.Since(start).Microseconds())
		recalls[i] = hnswComputeRecallAtK(results, groundTruth[i], k)
	}
	totalQueryTime := time.Since(queryStart)

	avgLatency := 0.0
	avgRecall := 0.0
	for i := 0; i < numQueries; i++ {
		avgLatency += latencies[i]
		avgRecall += recalls[i]
	}
	avgLatency /= float64(numQueries)
	avgRecall /= float64(numQueries)

	p50 := hnswPercentile(latencies, 50)
	p99 := hnswPercentile(latencies, 99)
	qps := float64(numQueries) / totalQueryTime.Seconds()

	t.Logf("\n=== Query Results ===")
	t.Logf("Total query time: %v", totalQueryTime)
	t.Logf("QPS: %.2f", qps)
	t.Logf("Latency P50: %.2f µs", p50)
	t.Logf("Latency P99: %.2f µs", p99)
	t.Logf("Average latency: %.2f µs", avgLatency)
	t.Logf("Recall@%d: %.2f%%", k, avgRecall*100)
}

// TestHNSW_SIFT_100K builds an HNSW index on SIFT 100K and measures recall.
func TestHNSW_SIFT_100K(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping HNSW SIFT 100K test in short mode")
	}

	dataPath := getSIFTDataPath()
	if dataPath == "" {
		t.Skip("SIFT dataset not found. Download from: ftp://ftp.irisa.fr/local/texmex/corpus/sift.tar.gz")
	}

	const numVectors = 100000

	t.Logf("=== HNSW SIFT 100K ===")
	t.Logf("Loading %d vectors from %s...", numVectors, dataPath)

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

	numQueries := 100
	k := 10

	// Compute ground truth
	t.Logf("Computing ground truth for %d queries (k=%d)...", numQueries, k)
	gtStart := time.Now()
	groundTruth := make([][]int, numQueries)
	for i := 0; i < numQueries; i++ {
		groundTruth[i] = hnswBruteForceKNN(baseVectors, queryVectors[i], k)
	}
	t.Logf("Ground truth computed in %v", time.Since(gtStart))

	// Memory
	runtime.GC()
	var mBefore runtime.MemStats
	runtime.ReadMemStats(&mBefore)

	// Build HNSW index — 同 TestHNSW_SIFT_10K，从创建起即指定 L2 度量
	collection := NewCollectionWithMetric("sift100k", dim, "l2")

	t.Logf("Building HNSW index (M=%d, efConstruction=%d)...",
		collection.Config.M, collection.Config.EfConstruction)
	buildStart := time.Now()
	for i, vec := range baseVectors {
		err := collection.InsertPoint(Point{
			ID:     fmt.Sprintf("%d", i),
			Vector: vec,
		})
		if err != nil {
			t.Fatalf("Insert failed at %d: %v", i, err)
		}
	}
	buildTime := time.Since(buildStart)

	runtime.GC()
	var mAfter runtime.MemStats
	runtime.ReadMemStats(&mAfter)
	memUsed := mAfter.Alloc - mBefore.Alloc

	t.Logf("Build completed in %v", buildTime)
	t.Logf("Build throughput: %.0f vectors/sec", float64(numVectors)/buildTime.Seconds())
	t.Logf("Memory used: %s", hnswFormatBytes(memUsed))
	t.Logf("Memory per vector: %.2f KB", float64(memUsed)/float64(numVectors)/1024)

	// Search
	efSearch := 200
	t.Logf("Running %d queries with k=%d, efSearch=%d...", numQueries, k, efSearch)

	latencies := make([]float64, numQueries)
	recalls := make([]float64, numQueries)

	queryStart := time.Now()
	for i := 0; i < numQueries; i++ {
		start := time.Now()
		results := collection.Search(queryVectors[i], k, efSearch)
		latencies[i] = float64(time.Since(start).Microseconds())
		recalls[i] = hnswComputeRecallAtK(results, groundTruth[i], k)
	}
	totalQueryTime := time.Since(queryStart)

	avgLatency := 0.0
	avgRecall := 0.0
	for i := 0; i < numQueries; i++ {
		avgLatency += latencies[i]
		avgRecall += recalls[i]
	}
	avgLatency /= float64(numQueries)
	avgRecall /= float64(numQueries)

	p50 := hnswPercentile(latencies, 50)
	p99 := hnswPercentile(latencies, 99)
	qps := float64(numQueries) / totalQueryTime.Seconds()

	t.Logf("\n=== Query Results ===")
	t.Logf("Total query time: %v", totalQueryTime)
	t.Logf("QPS: %.2f", qps)
	t.Logf("Latency P50: %.2f µs", p50)
	t.Logf("Latency P99: %.2f µs", p99)
	t.Logf("Average latency: %.2f µs", avgLatency)
	t.Logf("Recall@%d: %.2f%%", k, avgRecall*100)
}

// TestHNSW_SIFT_1M builds an HNSW index on full SIFT 1M and measures recall.
func TestHNSW_SIFT_1M(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping HNSW SIFT 1M test in short mode")
	}

	dataPath := getSIFTDataPath()
	if dataPath == "" {
		t.Skip("SIFT dataset not found. Download from: ftp://ftp.irisa.fr/local/texmex/corpus/sift.tar.gz")
	}

	t.Logf("=== HNSW SIFT 1M ===")
	t.Logf("Loading full dataset from %s...", dataPath)

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

	groundTruth, _, err := loadIvecs(filepath.Join(dataPath, "sift_groundtruth.ivecs"))
	if err != nil {
		t.Fatalf("Failed to load ground truth: %v", err)
	}
	t.Logf("Loaded %d ground truth entries", len(groundTruth))

	// Memory
	runtime.GC()
	var mBefore runtime.MemStats
	runtime.ReadMemStats(&mBefore)

	// Build HNSW index — 同 TestHNSW_SIFT_10K，从创建起即指定 L2 度量
	collection := NewCollectionWithMetric("sift1m", dim, "l2")

	numVectors := len(baseVectors)
	t.Logf("Building HNSW index (M=%d, efConstruction=%d)...",
		collection.Config.M, collection.Config.EfConstruction)
	buildStart := time.Now()
	for i, vec := range baseVectors {
		err := collection.InsertPoint(Point{
			ID:     fmt.Sprintf("%d", i),
			Vector: vec,
		})
		if err != nil {
			t.Fatalf("Insert failed at %d: %v", i, err)
		}
	}
	buildTime := time.Since(buildStart)

	runtime.GC()
	var mAfter runtime.MemStats
	runtime.ReadMemStats(&mAfter)
	memUsed := mAfter.Alloc - mBefore.Alloc

	t.Logf("Build completed in %v", buildTime)
	t.Logf("Build throughput: %.0f vectors/sec", float64(numVectors)/buildTime.Seconds())
	t.Logf("Memory used: %s", hnswFormatBytes(memUsed))
	t.Logf("Memory per vector: %.2f KB", float64(memUsed)/float64(numVectors)/1024)

	// Search
	numQueries := len(queryVectors)
	if numQueries > 200 {
		numQueries = 200
	}
	k := 10
	efSearch := 200

	t.Logf("Running %d queries with k=%d, efSearch=%d...", numQueries, k, efSearch)

	latencies := make([]float64, numQueries)
	recalls := make([]float64, numQueries)

	queryStart := time.Now()
	for i := 0; i < numQueries; i++ {
		start := time.Now()
		results := collection.Search(queryVectors[i], k, efSearch)
		latencies[i] = float64(time.Since(start).Microseconds())

		// Use pre-loaded ground truth (int32 indices)
		gtSet := make(map[string]bool, k)
		for j := 0; j < k; j++ {
			gtSet[fmt.Sprintf("%d", groundTruth[i][j])] = true
		}
		hits := 0
		for _, r := range results {
			if gtSet[r.ID] {
				hits++
			}
		}
		recalls[i] = float64(hits) / float64(k)
	}
	totalQueryTime := time.Since(queryStart)

	avgLatency := 0.0
	avgRecall := 0.0
	for i := 0; i < numQueries; i++ {
		avgLatency += latencies[i]
		avgRecall += recalls[i]
	}
	avgLatency /= float64(numQueries)
	avgRecall /= float64(numQueries)

	p50 := hnswPercentile(latencies, 50)
	p99 := hnswPercentile(latencies, 99)
	qps := float64(numQueries) / totalQueryTime.Seconds()

	t.Logf("\n=== Query Results ===")
	t.Logf("Total query time: %v", totalQueryTime)
	t.Logf("QPS: %.2f", qps)
	t.Logf("Latency P50: %.2f µs", p50)
	t.Logf("Latency P99: %.2f µs", p99)
	t.Logf("Average latency: %.2f µs", avgLatency)
	t.Logf("Recall@%d: %.2f%%", k, avgRecall*100)

	// Verify recall threshold
	if avgRecall < 0.70 {
		t.Errorf("Recall@%d too low: %.2f%%, expected >= 70%%", k, avgRecall*100)
	}
}
