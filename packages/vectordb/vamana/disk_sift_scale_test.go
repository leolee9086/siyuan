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
	"os"
	"path/filepath"
	"runtime"
	"testing"
	"time"

	"s-forge.local/vectordb/storage"
)

// ============================================================================
// SIFT1M 磁盘索引端到端测试
// ============================================================================

// TestDiskIndex_EndToEnd_SIFT1M 使用完整 SIFT1M 数据集进行磁盘索引端到端测试
// 验证完整流程：构建内存索引 → 保存到磁盘 → 加载磁盘索引 → 查询并验证召回率
//
// 此测试需要约 15 分钟完成，超出 go test 默认 10 分钟超时。
// 运行方式：VAMANA_SCALE_TEST=1 go test -run TestDiskIndex_EndToEnd_SIFT1M -timeout 30m -v
func TestDiskIndex_EndToEnd_SIFT1M(t *testing.T) {
	requireScaleTest(t)

	// 1M 规模测试需要长超时保护，避免常规超时中断写入中的磁盘索引。

	// 检查测试 deadline，若剩余时间不足 12 分钟则跳过
	if deadline, ok := t.Deadline(); ok {
		remaining := time.Until(deadline)
		if remaining < 12*time.Minute {
			t.Skipf("Skipping SIFT1M test: only %v remaining before deadline, need at least 12m", remaining.Round(time.Second))
		}
	}

	dataPath := getSIFTDataPath()
	if dataPath == "" {
		t.Skip("SIFT dataset not found. Download from: ftp://ftp.irisa.fr/local/texmex/corpus/sift.tar.gz")
	}

	t.Logf("=== Disk Index End-to-End Test (SIFT 1M) ===")

	// 记录初始内存
	runtime.GC()
	memStart := getMemStats()
	t.Logf("Initial memory: %s", formatBytes(memStart.Alloc))

	// 1. 加载数据
	t.Logf("\nStep 1: Loading SIFT1M data...")
	loadStart := time.Now()

	baseVectors, dim, err := loadFvecs(filepath.Join(dataPath, "sift_base.fvecs"))
	if err != nil {
		t.Fatalf("Failed to load base vectors: %v", err)
	}
	numVectors := len(baseVectors)
	t.Logf("  Loaded %d base vectors, dimension=%d (took %v)", numVectors, dim, time.Since(loadStart))

	queryVectors, _, err := loadFvecs(filepath.Join(dataPath, "sift_query.fvecs"))
	if err != nil {
		t.Fatalf("Failed to load query vectors: %v", err)
	}
	t.Logf("  Loaded %d query vectors", len(queryVectors))

	groundTruth, gtK, err := loadIvecs(filepath.Join(dataPath, "sift_groundtruth.ivecs"))
	if err != nil {
		t.Fatalf("Failed to load ground truth: %v", err)
	}
	t.Logf("  Loaded %d ground truth entries, k=%d", len(groundTruth), gtK)

	// 记录数据加载后内存
	runtime.GC()
	memAfterLoad := getMemStats()
	t.Logf("  Memory after loading data: %s (delta: %s)",
		formatBytes(memAfterLoad.Alloc),
		formatBytes(memAfterLoad.Alloc-memStart.Alloc))

	// 2. 构建内存索引
	t.Logf("\nStep 2: Building in-memory index...")
	config := DefaultConfig()
	config.R = 64
	config.L = 100
	config.Alpha = 1.2

	memIdx := New(dim, config)
	t.Logf("  Config: R=%d, L=%d, Alpha=%.1f", config.R, config.L, config.Alpha)

	buildStart := time.Now()
	if err := memIdx.Build(baseVectors); err != nil {
		t.Fatalf("Build failed: %v", err)
	}
	buildTime := time.Since(buildStart)
	t.Logf("  Build completed in %v (%.0f vectors/sec)", buildTime, float64(numVectors)/buildTime.Seconds())

	// 记录构建后内存
	runtime.GC()
	memAfterBuild := getMemStats()
	t.Logf("  Memory after build: %s (delta: %s)",
		formatBytes(memAfterBuild.Alloc),
		formatBytes(memAfterBuild.Alloc-memAfterLoad.Alloc))

	// 3. 保存到磁盘
	t.Logf("\nStep 3: Saving to disk...")
	tmpDir := t.TempDir()
	basePath := filepath.Join(tmpDir, "sift1m_index")

	saveStart := time.Now()
	if err := memIdx.SaveToDisk(basePath); err != nil {
		t.Fatalf("SaveToDisk failed: %v", err)
	}
	saveTime := time.Since(saveStart)
	t.Logf("  Save completed in %v", saveTime)

	// 检查文件大小
	indexInfo, _ := os.Stat(basePath + diskIndexExt)
	bbqInfo, bbqErr := os.Stat(basePath + diskBBQExt)
	t.Logf("  Index file size: %s", formatBytes(uint64(indexInfo.Size())))
	if bbqErr == nil {
		t.Logf("  BBQ file size: %s", formatBytes(uint64(bbqInfo.Size())))
	}

	// 释放内存索引
	memIdx = nil
	baseVectors = nil
	runtime.GC()
	memAfterRelease := getMemStats()
	t.Logf("  Memory after releasing in-memory index: %s", formatBytes(memAfterRelease.Alloc))

	// 4. 加载磁盘索引
	t.Logf("\nStep 4: Loading disk index...")

	// 设置 reader factory
	originalFactory := OpenDiskIndexReader
	defer func() { OpenDiskIndexReader = originalFactory }()

	OpenDiskIndexReader = func(path string, readOnly bool) (storage.DiskIndexReader, error) {
		return storage.OpenReader(path, readOnly)
	}

	loadDiskStart := time.Now()
	diskIdx, err := Open(basePath)
	if err != nil {
		t.Fatalf("Open disk index failed: %v", err)
	}
	defer diskIdx.Close()
	loadDiskTime := time.Since(loadDiskStart)
	t.Logf("  Load completed in %v", loadDiskTime)

	// 记录磁盘索引加载后内存
	runtime.GC()
	memAfterDiskLoad := getMemStats()
	t.Logf("  Memory after loading disk index: %s (delta: %s)",
		formatBytes(memAfterDiskLoad.Alloc),
		formatBytes(memAfterDiskLoad.Alloc-memAfterRelease.Alloc))

	// 验证元数据
	t.Logf("  Dimension: %d", diskIdx.Dimension())
	t.Logf("  NumPoints: %d", diskIdx.NumPointsTotal())
	t.Logf("  Medoid: %d", diskIdx.Medoid())
	t.Logf("  MaxDegree: %d", diskIdx.MaxDegree())
	t.Logf("  HasBBQ: %v", diskIdx.HasBBQ())
	t.Logf("  HasBBQMeta: %v", diskIdx.HasBBQMeta())

	if diskIdx.Dimension() != dim {
		t.Errorf("Dimension mismatch: got %d, want %d", diskIdx.Dimension(), dim)
	}
	if diskIdx.NumPointsTotal() != uint64(numVectors) {
		t.Errorf("NumPointsTotal mismatch: got %d, want %d", diskIdx.NumPointsTotal(), numVectors)
	}

	// 5. 验证向量读取（抽样检查）
	t.Logf("\nStep 5: Verifying vector storage (sampling)...")
	sampleNodes := []uint64{0, 1000, 100000, 500000, 999999}
	for _, nodeID := range sampleNodes {
		diskVec, err := diskIdx.ReadVector(nodeID)
		if err != nil {
			t.Errorf("ReadVector failed for node %d: %v", nodeID, err)
			continue
		}
		if len(diskVec) != dim {
			t.Errorf("Vector dimension mismatch at node %d: got %d, want %d", nodeID, len(diskVec), dim)
		}
	}
	t.Logf("  Vector verification passed for sample nodes")

	// 6. 磁盘索引搜索召回率验证
	t.Logf("\nStep 6: Verifying disk index search recall...")

	numQueries := len(queryVectors)
	if numQueries > 1000 {
		numQueries = 1000
	}
	k := 10
	searchL := 100

	t.Logf("  Running %d queries with k=%d, efSearch=%d...", numQueries, k, searchL)

	latencies := make([]float64, numQueries)
	recalls := make([]float64, numQueries)

	queryStart := time.Now()
	for i := 0; i < numQueries; i++ {
		start := time.Now()
		results, _ := diskIdx.Search(queryVectors[i], k, searchL)
		latencies[i] = float64(time.Since(start).Microseconds())
		recalls[i] = computeDiskRecallAtK(results, groundTruth[i], k)
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
	t.Logf("  Total query time: %v", totalQueryTime)
	t.Logf("  QPS: %.2f", qps)
	t.Logf("  Latency P50: %.2f µs", p50)
	t.Logf("  Latency P99: %.2f µs", p99)
	t.Logf("  Average latency: %.2f µs", avgLatency)
	t.Logf("  Recall@%d: %.2f%%", k, avgRecall*100)

	// 验证召回率
	minAcceptableRecall := 0.70
	if avgRecall < minAcceptableRecall {
		t.Errorf("Disk index recall too low: %.2f%%, expected >= %.2f%%", avgRecall*100, minAcceptableRecall*100)
	}

	// 7. 测试不同的 searchL 参数
	t.Logf("\nStep 7: Testing different efSearch values...")
	testQueries := 100
	for _, testL := range []int{50, 100, 200, 500} {
		recall := computeDiskAverageRecall(diskIdx, queryVectors[:testQueries], groundTruth[:testQueries], k, testL)
		t.Logf("  efSearch=%d: Recall@%d = %.2f%%", testL, k, recall*100)
	}

	// 8. 内存使用报告
	t.Logf("\n=== Memory Usage Report ===")
	runtime.GC()
	memFinal := getMemStats()
	t.Logf("  Final memory: %s", formatBytes(memFinal.Alloc))
	t.Logf("  Peak memory (estimated): %s", formatBytes(memAfterBuild.Alloc))
	t.Logf("  Disk index memory footprint: %s", formatBytes(memFinal.Alloc-memAfterRelease.Alloc))

	t.Logf("\n=== SIFT 1M End-to-End Test Completed Successfully ===")
}
