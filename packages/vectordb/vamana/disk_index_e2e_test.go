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
	"testing"
	"time"

	"s-forge.local/vectordb/storage"
)

// ============================================================================
// 端到端测试: Build → Save → Open → Query
// ============================================================================

// TestDiskIndex_EndToEnd_SIFT10K 使用 SIFT 10K 进行端到端测试
// 验证完整流程：构建内存索引 → 保存到磁盘 → 加载磁盘索引 → 查询并验证召回率
func TestDiskIndex_EndToEnd_SIFT10K(t *testing.T) {
	requireScaleTest(t)

	dataPath := getSIFTDataPath()
	if dataPath == "" {
		t.Skip("SIFT dataset not found. Download from: ftp://ftp.irisa.fr/local/texmex/corpus/sift.tar.gz")
	}

	const numVectors = 10000

	t.Logf("=== Disk Index End-to-End Test (SIFT 10K) ===")

	// 1. 加载数据
	t.Logf("Step 1: Loading data...")
	baseVectors, dim, err := loadFvecsPartial(filepath.Join(dataPath, "sift_base.fvecs"), numVectors)
	if err != nil {
		t.Fatalf("Failed to load base vectors: %v", err)
	}
	t.Logf("  Loaded %d base vectors, dimension=%d", len(baseVectors), dim)

	queryVectors, _, err := loadFvecs(filepath.Join(dataPath, "sift_query.fvecs"))
	if err != nil {
		t.Fatalf("Failed to load query vectors: %v", err)
	}

	// 计算 ground truth
	numQueries := 100
	k := 10
	t.Logf("  Computing ground truth for %d queries (k=%d)...", numQueries, k)
	groundTruth := computeGroundTruth(baseVectors, queryVectors[:numQueries], k)

	// 2. 构建内存索引
	t.Logf("\nStep 2: Building in-memory index...")
	config := DefaultConfig()
	config.R = 32
	config.L = 50
	config.Alpha = 1.2

	memIdx := New(dim, config)
	buildStart := time.Now()
	if err := memIdx.Build(baseVectors); err != nil {
		t.Fatalf("Build failed: %v", err)
	}
	buildTime := time.Since(buildStart)
	t.Logf("  Build completed in %v (%.0f vectors/sec)", buildTime, float64(numVectors)/buildTime.Seconds())

	// 验证内存索引的召回率
	memRecall := computeAverageRecall(memIdx, queryVectors[:numQueries], groundTruth, k, 50)
	t.Logf("  In-memory Recall@%d: %.2f%%", k, memRecall*100)

	// 3. 保存到磁盘
	t.Logf("\nStep 3: Saving to disk...")
	tmpDir := t.TempDir()
	basePath := filepath.Join(tmpDir, "sift10k_index")

	saveStart := time.Now()
	if err := memIdx.SaveToDisk(basePath); err != nil {
		t.Fatalf("SaveToDisk failed: %v", err)
	}
	saveTime := time.Since(saveStart)
	t.Logf("  Save completed in %v", saveTime)

	// 检查文件
	indexInfo, _ := os.Stat(basePath + diskIndexExt)
	bbqInfo, bbqErr := os.Stat(basePath + diskBBQExt)
	t.Logf("  Index file size: %s", formatBytes(uint64(indexInfo.Size())))
	if bbqErr == nil {
		t.Logf("  BBQ file size: %s", formatBytes(uint64(bbqInfo.Size())))
	}

	// 4. 设置 reader factory 并加载磁盘索引
	t.Logf("\nStep 4: Loading disk index...")

	// 保存原始 factory
	originalFactory := OpenDiskIndexReader
	defer func() { OpenDiskIndexReader = originalFactory }()

	// 设置 Windows mmap reader
	OpenDiskIndexReader = func(path string, readOnly bool) (storage.DiskIndexReader, error) {
		return storage.OpenReader(path, readOnly)
	}

	loadStart := time.Now()
	diskIdx, err := Open(basePath)
	if err != nil {
		t.Fatalf("Open disk index failed: %v", err)
	}
	defer diskIdx.Close()
	loadTime := time.Since(loadStart)
	t.Logf("  Load completed in %v", loadTime)

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

	// 5. 验证向量读取
	t.Logf("\nStep 5: Verifying vector storage...")
	for nodeID := uint64(0); nodeID < 10; nodeID++ {
		diskVec, err := diskIdx.ReadVector(nodeID)
		if err != nil {
			t.Errorf("ReadVector failed for node %d: %v", nodeID, err)
			continue
		}
		memVec := baseVectors[nodeID]

		// 比较向量值
		for j := 0; j < dim; j++ {
			if diskVec[j] != memVec[j] {
				t.Errorf("Vector mismatch at node %d, dim %d: disk=%.6f, mem=%.6f",
					nodeID, j, diskVec[j], memVec[j])
				break
			}
		}
	}
	t.Logf("  Vector verification passed for first 10 nodes")

	// 6. 验证邻居列表
	t.Logf("\nStep 6: Verifying neighbor lists...")
	for nodeID := uint32(0); nodeID < 10; nodeID++ {
		diskNeighbors := diskIdx.GetNeighbors(uint64(nodeID))
		memNeighbors := memIdx.GetNeighbors(nodeID)

		if len(diskNeighbors) != len(memNeighbors) {
			t.Errorf("Neighbor count mismatch at node %d: disk=%d, mem=%d",
				nodeID, len(diskNeighbors), len(memNeighbors))
			continue
		}

		for j := range diskNeighbors {
			if diskNeighbors[j] != memNeighbors[j] {
				t.Errorf("Neighbor mismatch at node %d, index %d: disk=%d, mem=%d",
					nodeID, j, diskNeighbors[j], memNeighbors[j])
				break
			}
		}
	}
	t.Logf("  Neighbor verification passed for first 10 nodes")

	// 7. 磁盘索引搜索召回率验证
	t.Logf("\nStep 7: Verifying disk index search recall...")
	searchL := 50
	diskRecall := computeDiskAverageRecall(diskIdx, queryVectors[:numQueries], groundTruth, k, searchL)
	t.Logf("  Disk Index Recall@%d (L=%d): %.2f%%", k, searchL, diskRecall*100)
	t.Logf("  In-memory Recall@%d (L=%d): %.2f%% (reference)", k, searchL, memRecall*100)

	// 磁盘索引召回率应该与内存索引相近（允许一定误差，因为 BBQ 近似）
	recallDiff := memRecall - diskRecall
	t.Logf("  Recall difference: %.2f%%", recallDiff*100)

	// 磁盘索引召回率应该至少达到内存索引的 80%，或者绝对值 >= 70%
	minAcceptableRecall := 0.70
	if diskRecall < minAcceptableRecall {
		t.Errorf("Disk index recall too low: %.2f%%, expected >= %.2f%%", diskRecall*100, minAcceptableRecall*100)
	}

	// 测试不同的 searchL 参数
	t.Logf("\n  Testing different searchL values:")
	for _, testL := range []int{20, 50, 100, 200} {
		recall := computeDiskAverageRecall(diskIdx, queryVectors[:numQueries], groundTruth, k, testL)
		t.Logf("    searchL=%d: Recall@%d = %.2f%%", testL, k, recall*100)
	}

	t.Logf("\n=== End-to-End Test Completed Successfully ===")
}

// TestDiskIndex_EndToEnd_SIFT100K 使用 SIFT 100K 进行端到端测试
func TestDiskIndex_EndToEnd_SIFT100K(t *testing.T) {
	requireScaleTest(t)

	if testing.Short() {
		t.Skip("Skipping SIFT100K end-to-end test in short mode")
	}

	dataPath := getSIFTDataPath()
	if dataPath == "" {
		t.Skip("SIFT dataset not found")
	}

	const numVectors = 100000

	t.Logf("=== Disk Index End-to-End Test (SIFT 100K) ===")

	// 加载数据
	baseVectors, dim, err := loadFvecsPartial(filepath.Join(dataPath, "sift_base.fvecs"), numVectors)
	if err != nil {
		t.Fatalf("Failed to load base vectors: %v", err)
	}

	// 构建索引
	config := DefaultConfig()
	config.R = 64
	config.L = 100

	memIdx := New(dim, config)
	t.Logf("Building index with %d vectors...", numVectors)
	buildStart := time.Now()
	if err := memIdx.Build(baseVectors); err != nil {
		t.Fatalf("Build failed: %v", err)
	}
	t.Logf("Build completed in %v", time.Since(buildStart))

	// 保存到磁盘
	tmpDir := t.TempDir()
	basePath := filepath.Join(tmpDir, "sift100k_index")

	t.Logf("Saving to disk...")
	saveStart := time.Now()
	if err := memIdx.SaveToDisk(basePath); err != nil {
		t.Fatalf("SaveToDisk failed: %v", err)
	}
	t.Logf("Save completed in %v", time.Since(saveStart))

	// 设置 reader factory
	originalFactory := OpenDiskIndexReader
	defer func() { OpenDiskIndexReader = originalFactory }()

	OpenDiskIndexReader = func(path string, readOnly bool) (storage.DiskIndexReader, error) {
		return storage.OpenReader(path, readOnly)
	}

	// 加载磁盘索引
	t.Logf("Loading disk index...")
	loadStart := time.Now()
	diskIdx, err := Open(basePath)
	if err != nil {
		t.Fatalf("Open disk index failed: %v", err)
	}
	defer diskIdx.Close()
	t.Logf("Load completed in %v", time.Since(loadStart))

	// 验证基本信息
	if diskIdx.NumPointsTotal() != uint64(numVectors) {
		t.Errorf("NumPointsTotal mismatch: got %d, want %d", diskIdx.NumPointsTotal(), numVectors)
	}

	// 验证随机节点的向量和邻居
	testNodes := []uint64{0, 1000, 50000, 99999}
	for _, nodeID := range testNodes {
		diskVec, err := diskIdx.ReadVector(nodeID)
		if err != nil {
			t.Errorf("ReadVector failed for node %d: %v", nodeID, err)
			continue
		}

		// 验证向量维度
		if len(diskVec) != dim {
			t.Errorf("Vector dimension mismatch at node %d: got %d, want %d", nodeID, len(diskVec), dim)
		}

		// 验证邻居列表非空
		neighbors := diskIdx.GetNeighbors(nodeID)
		if len(neighbors) == 0 {
			t.Errorf("Node %d has no neighbors", nodeID)
		}
	}

	t.Logf("=== SIFT 100K End-to-End Test Passed ===")
}

// TestDiskIndex_SaveLoad_WithBBQ 测试带 BBQ 的保存和加载
func TestDiskIndex_SaveLoad_WithBBQ(t *testing.T) {
	requireScaleTest(t)

	dataPath := getSIFTDataPath()
	if dataPath == "" {
		t.Skip("SIFT dataset not found")
	}

	const numVectors = 1000

	// 加载数据
	baseVectors, dim, err := loadFvecsPartial(filepath.Join(dataPath, "sift_base.fvecs"), numVectors)
	if err != nil {
		t.Fatalf("Failed to load base vectors: %v", err)
	}

	// 构建带 BBQ 的索引
	config := DefaultConfig()
	config.R = 32
	config.L = 50
	// BBQ 在 dim >= 96 时自动启用 (BBQEnableThreshold)

	memIdx := New(dim, config)
	if err := memIdx.Build(baseVectors); err != nil {
		t.Fatalf("Build failed: %v", err)
	}

	// 保存
	tmpDir := t.TempDir()
	basePath := filepath.Join(tmpDir, "bbq_index")

	if err := memIdx.SaveToDisk(basePath); err != nil {
		t.Fatalf("SaveToDisk failed: %v", err)
	}

	// 检查 BBQ 文件存在
	if _, err := os.Stat(basePath + diskBBQExt); os.IsNotExist(err) {
		t.Errorf("BBQ file should exist when EnableBBQ=true")
	}

	// 设置 reader factory
	originalFactory := OpenDiskIndexReader
	defer func() { OpenDiskIndexReader = originalFactory }()

	OpenDiskIndexReader = func(path string, readOnly bool) (storage.DiskIndexReader, error) {
		return storage.OpenReader(path, readOnly)
	}

	// 加载并验证
	diskIdx, err := Open(basePath)
	if err != nil {
		t.Fatalf("Open failed: %v", err)
	}
	defer diskIdx.Close()

	// 验证 BBQ 加载
	if !diskIdx.HasBBQ() {
		t.Errorf("BBQ should be loaded")
	}

	// 验证 BBQ 元数据加载
	t.Logf("HasBBQ: %v, HasBBQMeta: %v", diskIdx.HasBBQ(), diskIdx.HasBBQMeta())
	if !diskIdx.HasBBQMeta() {
		t.Errorf("BBQ metadata should be loaded (version 2 format)")
	}

	// 验证 BBQ 码
	code := diskIdx.GetBBQCode(0)
	if code == nil {
		t.Errorf("GetBBQCode should return non-nil for node 0")
	}

	expectedLen := (dim + 7) / 8
	if len(code) != expectedLen {
		t.Errorf("BBQ code length mismatch: got %d, want %d", len(code), expectedLen)
	}
}

// TestDiskIndex_SaveLoad_WithDeletion 测试带删除的保存和加载
func TestDiskIndex_SaveLoad_WithDeletion(t *testing.T) {
	requireScaleTest(t)

	dataPath := getSIFTDataPath()
	if dataPath == "" {
		t.Skip("SIFT dataset not found")
	}

	const numVectors = 1000

	// 加载数据
	baseVectors, dim, err := loadFvecsPartial(filepath.Join(dataPath, "sift_base.fvecs"), numVectors)
	if err != nil {
		t.Fatalf("Failed to load base vectors: %v", err)
	}

	// 构建索引
	config := DefaultConfig()
	config.R = 32
	config.L = 50

	memIdx := New(dim, config)
	if err := memIdx.Build(baseVectors); err != nil {
		t.Fatalf("Build failed: %v", err)
	}

	// 删除一些节点
	deletedNodes := []uint32{10, 50, 100, 500, 999}
	for _, id := range deletedNodes {
		memIdx.Delete(id)
	}

	// 保存
	tmpDir := t.TempDir()
	basePath := filepath.Join(tmpDir, "deletion_index")

	if err := memIdx.SaveToDisk(basePath); err != nil {
		t.Fatalf("SaveToDisk failed: %v", err)
	}

	// 检查删除位图文件存在
	if _, err := os.Stat(basePath + diskDeletedExt); os.IsNotExist(err) {
		t.Errorf("Deleted bitmap file should exist when there are deletions")
	}

	// 设置 reader factory
	originalFactory := OpenDiskIndexReader
	defer func() { OpenDiskIndexReader = originalFactory }()

	OpenDiskIndexReader = func(path string, readOnly bool) (storage.DiskIndexReader, error) {
		return storage.OpenReader(path, readOnly)
	}

	// 加载并验证
	diskIdx, err := Open(basePath)
	if err != nil {
		t.Fatalf("Open failed: %v", err)
	}
	defer diskIdx.Close()

	// 验证删除位图
	for _, id := range deletedNodes {
		if !diskIdx.IsDeleted(uint64(id)) {
			t.Errorf("Node %d should be marked as deleted", id)
		}
	}

	// 验证未删除节点
	if diskIdx.IsDeleted(0) {
		t.Errorf("Node 0 should not be deleted")
	}

	// 验证有效点数
	expectedNumPoints := uint64(numVectors - len(deletedNodes))
	if diskIdx.NumPoints() != expectedNumPoints {
		t.Errorf("NumPoints mismatch: got %d, want %d", diskIdx.NumPoints(), expectedNumPoints)
	}
}

// ============================================================================
// 辅助函数
// ============================================================================

// computeAverageRecall 计算内存索引的平均召回率（使用 BBQ 搜索）
//
// rerankFactor 的计算考虑 DefaultBBQOverSearchFactor，使内存 BBQ 搜索宽度
// 与 DiskVamanaIndex.Search 的行为一致（efSearch × BBQOverSearchFactor × rerankFactor）。
func computeAverageRecall(idx *VamanaIndex, queries [][]float32, groundTruth [][]int32, k, searchL int) float64 {
	totalRecall := 0.0
	// 使用 SearchWithBBQ 进行公平比较
	// 搜索宽度对齐 DiskVamanaIndex.Search: efSearch * DefaultBBQOverSearchFactor
	// SearchWithBBQ 使用 rerankFactor 作为搜索宽度缩放：搜索宽度 = k * rerankFactor
	// 因此 rerankFactor = (searchL * DefaultBBQOverSearchFactor) / k
	bbqSearchL := int(float64(searchL) * DefaultBBQOverSearchFactor)
	rerankFactor := bbqSearchL / k
	if rerankFactor < 1 {
		rerankFactor = 1
	}
	for i, query := range queries {
		results := idx.SearchWithBBQ(query, k, rerankFactor)
		totalRecall += computeRecallAtK(neighborsToSearchResults(results), groundTruth[i], k)
	}
	return totalRecall / float64(len(queries))
}

// computeDiskAverageRecall 计算磁盘索引的平均召回率
func computeDiskAverageRecall(idx *DiskVamanaIndex, queries [][]float32, groundTruth [][]int32, k, efSearch int) float64 {
	totalRecall := 0.0
	for i, query := range queries {
		results, _ := idx.Search(query, k, efSearch)
		totalRecall += computeDiskRecallAtK(results, groundTruth[i], k)
	}
	return totalRecall / float64(len(queries))
}

// computeDiskRecallAtK 计算磁盘索引搜索结果的 Recall@K
func computeDiskRecallAtK(results []SearchResult, groundTruth []int32, k int) float64 {
	if k > len(groundTruth) {
		k = len(groundTruth)
	}
	if k > len(results) {
		k = len(results)
	}
	if k == 0 {
		return 0.0
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
