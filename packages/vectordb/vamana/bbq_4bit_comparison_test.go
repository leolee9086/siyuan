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
	"fmt"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"s-forge.local/vectordb/storage"
)

// bbqTestConfig 描述一组 BBQ 查询配置
type bbqTestConfig struct {
	Name             string
	QueryBits        int
	OverSearchFactor float64
}

// bbqTestResult 存储单个配置的测试结果
type bbqTestResult struct {
	Config     bbqTestConfig
	Recall     float64
	AvgLatency float64 // 微秒
}

// TestBBQ4BitComparison 对比 1-bit 和 4-bit BBQ 查询在不同 OverSearchFactor 下的召回率。
//
// 构建 SIFT 100K 磁盘索引，然后依次切换 BBQ 配置进行搜索，
// 输出格式化的对比表格。
func TestBBQ4BitComparison(t *testing.T) {
	requireScaleTest(t)

	if testing.Short() {
		t.Skip("Skipping BBQ 4-bit comparison test in short mode")
	}

	dataPath := getSIFTDataPath()
	if dataPath == "" {
		t.Skip("SIFT dataset not found")
	}

	const numVectors = 100000

	// ========== 加载数据 ==========
	t.Logf("=== BBQ 4-bit vs 1-bit Comparison Test (SIFT 100K) ===")
	t.Logf("Loading %d base vectors...", numVectors)

	baseVectors, dim, err := loadFvecsPartial(filepath.Join(dataPath, "sift_base.fvecs"), numVectors)
	if err != nil {
		t.Fatalf("Failed to load base vectors: %v", err)
	}
	t.Logf("Loaded %d base vectors, dimension=%d", len(baseVectors), dim)

	queryVectors, _, err := loadFvecs(filepath.Join(dataPath, "sift_query.fvecs"))
	if err != nil {
		t.Fatalf("Failed to load query vectors: %v", err)
	}

	// 使用前 100 个查询计算 ground truth
	numQueries := 100
	k := 10
	t.Logf("Computing ground truth for %d queries (k=%d)...", numQueries, k)
	groundTruth := computeGroundTruth(baseVectors, queryVectors[:numQueries], k)

	// ========== 构建索引 ==========
	t.Logf("Building in-memory index...")
	config := DefaultConfig()
	config.R = 64
	config.L = 100
	config.Alpha = 1.2

	memIdx := New(dim, config)
	buildStart := time.Now()
	if err := memIdx.Build(baseVectors); err != nil {
		t.Fatalf("Build failed: %v", err)
	}
	t.Logf("Build completed in %v", time.Since(buildStart))

	// ========== 保存到磁盘 ==========
	tmpDir := t.TempDir()
	basePath := filepath.Join(tmpDir, "sift100k_4bit_cmp")

	t.Logf("Saving to disk...")
	if err := memIdx.SaveToDisk(basePath); err != nil {
		t.Fatalf("SaveToDisk failed: %v", err)
	}

	// 释放内存索引
	memIdx = nil
	baseVectors = nil

	// ========== 加载磁盘索引 ==========
	originalFactory := OpenDiskIndexReader
	defer func() { OpenDiskIndexReader = originalFactory }()

	OpenDiskIndexReader = func(path string, readOnly bool) (storage.DiskIndexReader, error) {
		return storage.OpenReader(path, readOnly)
	}

	t.Logf("Loading disk index...")
	diskIdx, err := Open(basePath)
	if err != nil {
		t.Fatalf("Open disk index failed: %v", err)
	}
	defer diskIdx.Close()

	t.Logf("HasBBQ: %v, HasBBQMeta: %v", diskIdx.HasBBQ(), diskIdx.HasBBQMeta())

	// ========== 定义测试配置 ==========
	configs := []bbqTestConfig{
		{Name: "1-bit, OSF=5.0", QueryBits: 1, OverSearchFactor: 5.0},
		{Name: "4-bit, OSF=5.0", QueryBits: 4, OverSearchFactor: 5.0},
		{Name: "4-bit, OSF=3.0", QueryBits: 4, OverSearchFactor: 3.0},
		{Name: "4-bit, OSF=2.0", QueryBits: 4, OverSearchFactor: 2.0},
		{Name: "4-bit, OSF=1.0", QueryBits: 4, OverSearchFactor: 1.0},
	}

	searchL := 100
	queries := queryVectors[:numQueries]

	// ========== 运行对比 ==========
	t.Logf("\nRunning comparison with searchL=%d, k=%d, numQueries=%d...\n", searchL, k, numQueries)

	results := make([]bbqTestResult, 0, len(configs))

	for _, cfg := range configs {
		diskIdx.SetBBQQueryBits(cfg.QueryBits)
		diskIdx.SetBBQOverSearchFactor(cfg.OverSearchFactor)

		// 测量延迟和召回率
		totalLatency := 0.0
		totalRecall := 0.0
		for i, query := range queries {
			start := time.Now()
			searchResults, _ := diskIdx.Search(query, k, searchL)
			totalLatency += float64(time.Since(start).Microseconds())
			totalRecall += computeDiskRecallAtK(searchResults, groundTruth[i], k)
		}

		avgRecall := totalRecall / float64(numQueries)
		avgLatency := totalLatency / float64(numQueries)

		results = append(results, bbqTestResult{
			Config:     cfg,
			Recall:     avgRecall,
			AvgLatency: avgLatency,
		})

		t.Logf("  %s => Recall@%d: %.2f%%, AvgLatency: %.0f µs",
			cfg.Name, k, avgRecall*100, avgLatency)
	}

	// ========== 输出格式化表格 ==========
	t.Logf("\n%s", formatComparisonTable(results, k))

	// ========== 基本断言 ==========
	// 4-bit OSF=5.0 的召回率应该 >= 1-bit OSF=5.0
	if len(results) >= 2 {
		recall1bit := results[0].Recall
		recall4bitOSF5 := results[1].Recall
		if recall4bitOSF5 < recall1bit-0.02 {
			t.Errorf("4-bit OSF=5.0 recall (%.2f%%) significantly worse than 1-bit OSF=5.0 (%.2f%%)",
				recall4bitOSF5*100, recall1bit*100)
		}
	}
}

// formatComparisonTable 生成格式化的对比结果表格
func formatComparisonTable(results []bbqTestResult, k int) string {
	var sb strings.Builder

	sb.WriteString(fmt.Sprintf("╔══════════════════════╦══════════════╦═══════════════╗\n"))
	sb.WriteString(fmt.Sprintf("║ %-20s ║ Recall@%-5d ║ AvgLatency    ║\n", "Configuration", k))
	sb.WriteString(fmt.Sprintf("╠══════════════════════╬══════════════╬═══════════════╣\n"))

	for _, r := range results {
		sb.WriteString(fmt.Sprintf("║ %-20s ║ %10.2f%% ║ %9.0f µs  ║\n",
			r.Config.Name, r.Recall*100, r.AvgLatency))
	}

	sb.WriteString(fmt.Sprintf("╚══════════════════════╩══════════════╩═══════════════╝\n"))

	// 添加分析摘要
	if len(results) >= 2 {
		baseline := results[0] // 1-bit OSF=5.0
		sb.WriteString(fmt.Sprintf("\nBaseline: %s (Recall=%.2f%%)\n", baseline.Config.Name, baseline.Recall*100))
		for i := 1; i < len(results); i++ {
			r := results[i]
			recallDelta := (r.Recall - baseline.Recall) * 100
			latencyRatio := r.AvgLatency / baseline.AvgLatency
			sign := "+"
			if recallDelta < 0 {
				sign = ""
			}
			sb.WriteString(fmt.Sprintf("  vs %s: recall %s%.2f%%, latency %.2fx\n",
				r.Config.Name, sign, recallDelta, latencyRatio))
		}
	}

	return sb.String()
}
