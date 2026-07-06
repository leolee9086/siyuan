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
	"os"
	"path/filepath"
	"sort"
	"strings"
	"testing"
	"time"

	"s-forge.local/vectordb/storage"
)

// bbqBenchConfig 描述一组 BBQ benchmark 配置
type bbqBenchConfig struct {
	Name             string
	QueryBits        int
	OverSearchFactor float64
}

// bbqBenchResult 存储单个配置的 benchmark 结果
type bbqBenchResult struct {
	Config     bbqBenchConfig
	Recall     float64 // Recall@K (0~1)
	AvgLatency float64 // 平均搜索延迟 (µs)
	P99Latency float64 // P99 搜索延迟 (µs)
	NumQueries int
	K          int
	SearchL    int
	NumVectors int
	Dimension  int
}

// preOptBaseline 优化前基线数据（来自 bbq-4bit-asymmetric-query.ttt.md）
type preOptBaseline struct {
	Name       string
	Recall     float64 // 百分比形式 (e.g. 91.80)
	AvgLatency float64 // µs
}

// getPreOptBaselines 返回优化前基线数据
func getPreOptBaselines() []preOptBaseline {
	return []preOptBaseline{
		{Name: "1-bit, OSF=5.0", Recall: 91.80, AvgLatency: 3115},
		{Name: "4-bit, OSF=5.0", Recall: 98.20, AvgLatency: 4244},
		{Name: "4-bit, OSF=3.0", Recall: 96.10, AvgLatency: 2973},
		{Name: "4-bit, OSF=2.0", Recall: 92.50, AvgLatency: 2058},
	}
}

// TestBBQ4BitBenchmark 端到端 benchmark：验证 S1-S3 优化后的 BBQ 4-bit 路径性能。
//
// 测试矩阵（SIFT 100K, dim=128, squared_l2）：
//   - 1-bit 基线:    bbqQueryBits=1, OverSearchFactor=5.0
//   - 4-bit 高精度:  bbqQueryBits=4, OverSearchFactor=5.0
//   - 4-bit 平衡:    bbqQueryBits=4, OverSearchFactor=3.0
//   - 4-bit 快速:    bbqQueryBits=4, OverSearchFactor=2.0
//
// 每个配置测量 Recall@10、平均搜索延迟、P99 搜索延迟。
// 结果与优化前基线对比，输出到 benchmark_4bit_optimized.txt。
func TestBBQ4BitBenchmark(t *testing.T) {
	requireScaleTest(t)

	if testing.Short() {
		t.Skip("Skipping BBQ 4-bit benchmark in short mode")
	}

	dataPath := getSIFTDataPath()
	if dataPath == "" {
		t.Skip("SIFT dataset not found")
	}

	const (
		numVectors = 100000
		numQueries = 100
		k          = 10
		searchL    = 100
	)

	// ========== 加载数据 ==========
	t.Logf("=== BBQ 4-bit Optimized Benchmark (SIFT 100K) ===")
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

	t.Logf("Computing ground truth for %d queries (k=%d)...", numQueries, k)
	groundTruth := computeGroundTruth(baseVectors, queryVectors[:numQueries], k)

	// ========== 构建索引 ==========
	t.Logf("Building in-memory index (R=64, L=100, Alpha=1.2)...")
	config := DefaultConfig()
	config.R = 64
	config.L = 100
	config.Alpha = 1.2

	memIdx := New(dim, config)
	buildStart := time.Now()
	if err := memIdx.Build(baseVectors); err != nil {
		t.Fatalf("Build failed: %v", err)
	}
	buildTime := time.Since(buildStart)
	t.Logf("Build completed in %v", buildTime)

	// ========== 保存到磁盘 ==========
	tmpDir := t.TempDir()
	basePath := filepath.Join(tmpDir, "sift100k_benchmark")

	t.Logf("Saving to disk...")
	if err := memIdx.SaveToDisk(basePath); err != nil {
		t.Fatalf("SaveToDisk failed: %v", err)
	}

	// 释放内存索引和基向量
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

	// ========== 定义测试配置矩阵 ==========
	configs := []bbqBenchConfig{
		{Name: "1-bit, OSF=5.0", QueryBits: 1, OverSearchFactor: 5.0},
		{Name: "4-bit, OSF=5.0", QueryBits: 4, OverSearchFactor: 5.0},
		{Name: "4-bit, OSF=3.0", QueryBits: 4, OverSearchFactor: 3.0},
		{Name: "4-bit, OSF=2.0", QueryBits: 4, OverSearchFactor: 2.0},
	}

	queries := queryVectors[:numQueries]

	// ========== 运行 benchmark ==========
	t.Logf("\nRunning benchmark: searchL=%d, k=%d, numQueries=%d\n", searchL, k, numQueries)

	results := make([]bbqBenchResult, 0, len(configs))

	for _, cfg := range configs {
		diskIdx.SetBBQQueryBits(cfg.QueryBits)
		diskIdx.SetBBQOverSearchFactor(cfg.OverSearchFactor)

		latencies := make([]float64, numQueries)
		totalRecall := 0.0

		for i, query := range queries {
			start := time.Now()
			searchResults, _ := diskIdx.Search(query, k, searchL)
			latencies[i] = float64(time.Since(start).Microseconds())
			totalRecall += computeDiskRecallAtK(searchResults, groundTruth[i], k)
		}

		avgRecall := totalRecall / float64(numQueries)
		avgLatency := computeMean(latencies)
		p99Latency := computePercentile(latencies, 99)

		result := bbqBenchResult{
			Config:     cfg,
			Recall:     avgRecall,
			AvgLatency: avgLatency,
			P99Latency: p99Latency,
			NumQueries: numQueries,
			K:          k,
			SearchL:    searchL,
			NumVectors: numVectors,
			Dimension:  dim,
		}
		results = append(results, result)

		t.Logf("  %s => Recall@%d: %.2f%%, AvgLatency: %.0f µs, P99: %.0f µs",
			cfg.Name, k, avgRecall*100, avgLatency, p99Latency)
	}

	// ========== 输出结果 ==========
	report := formatBenchmarkReport(results)
	t.Logf("\n%s", report)

	// ========== 写入结果文件 ==========
	outputPath := filepath.Join(".", "benchmark_4bit_optimized.txt")
	if err := os.WriteFile(outputPath, []byte(report), 0644); err != nil {
		t.Errorf("Failed to write benchmark results: %v", err)
	} else {
		t.Logf("Results written to %s", outputPath)
	}

	// ========== 召回率断言（规程要求：磁盘索引 ≥ 90%）==========
	for _, r := range results {
		if r.Recall < 0.90 {
			t.Errorf("Config %q: Recall@%d = %.2f%%, below 90%% threshold (规程 2.2)",
				r.Config.Name, k, r.Recall*100)
		}
	}
}

// computeMean 计算 float64 切片的算术平均值
func computeMean(values []float64) float64 {
	if len(values) == 0 {
		return 0
	}
	sum := 0.0
	for _, v := range values {
		sum += v
	}
	return sum / float64(len(values))
}

// computePercentile 计算 float64 切片的第 p 百分位数 (p: 0~100)
func computePercentile(values []float64, p float64) float64 {
	if len(values) == 0 {
		return 0
	}
	sorted := make([]float64, len(values))
	copy(sorted, values)
	sort.Float64s(sorted)

	idx := int(float64(len(sorted)-1) * p / 100.0)
	if idx >= len(sorted) {
		idx = len(sorted) - 1
	}
	return sorted[idx]
}

// formatBenchmarkReport 生成完整的 benchmark 报告，包含优化前后对比
func formatBenchmarkReport(results []bbqBenchResult) string {
	var sb strings.Builder

	// 报告头
	sb.WriteString("BBQ 4-bit Optimized Benchmark Report\n")
	sb.WriteString("=====================================\n")
	if len(results) > 0 {
		r := results[0]
		sb.WriteString(fmt.Sprintf("Dataset: SIFT %dK, dim=%d, squared_l2\n", r.NumVectors/1000, r.Dimension))
		sb.WriteString(fmt.Sprintf("Queries: %d, k=%d, searchL=%d\n", r.NumQueries, r.K, r.SearchL))
	}
	sb.WriteString(fmt.Sprintf("Date: %s\n\n", time.Now().Format("2006-01-02 15:04:05")))

	// 优化后结果表
	sb.WriteString("Optimized Results (S1-S3: BitTranspose + POPCNT + ContiguousMemory)\n")
	sb.WriteString("┌──────────────────────┬──────────────┬───────────────┬───────────────┐\n")
	sb.WriteString(fmt.Sprintf("│ %-20s │ Recall@%-5d │ AvgLatency    │ P99Latency    │\n", "Configuration", results[0].K))
	sb.WriteString("├──────────────────────┼──────────────┼───────────────┼───────────────┤\n")

	for _, r := range results {
		sb.WriteString(fmt.Sprintf("│ %-20s │ %10.2f%% │ %9.0f µs  │ %9.0f µs  │\n",
			r.Config.Name, r.Recall*100, r.AvgLatency, r.P99Latency))
	}

	sb.WriteString("└──────────────────────┴──────────────┴───────────────┴───────────────┘\n\n")

	// 优化前基线表
	baselines := getPreOptBaselines()
	sb.WriteString("Pre-Optimization Baseline (from bbq-4bit-asymmetric-query.ttt.md)\n")
	sb.WriteString("┌──────────────────────┬──────────────┬───────────────┐\n")
	sb.WriteString(fmt.Sprintf("│ %-20s │ Recall@%-5d │ AvgLatency    │\n", "Configuration", results[0].K))
	sb.WriteString("├──────────────────────┼──────────────┼───────────────┤\n")

	for _, b := range baselines {
		sb.WriteString(fmt.Sprintf("│ %-20s │ %10.2f%% │ %9.0f µs  │\n",
			b.Name, b.Recall, b.AvgLatency))
	}

	sb.WriteString("└──────────────────────┴──────────────┴───────────────┘\n\n")

	// 对比分析
	sb.WriteString("Optimization Delta (Optimized - Baseline)\n")
	sb.WriteString("┌──────────────────────┬────────────────┬──────────────────┬──────────────┐\n")
	sb.WriteString(fmt.Sprintf("│ %-20s │ Recall Δ       │ Latency Δ        │ Speedup      │\n", "Configuration"))
	sb.WriteString("├──────────────────────┼────────────────┼──────────────────┼──────────────┤\n")

	baselineMap := make(map[string]preOptBaseline, len(baselines))
	for _, b := range baselines {
		baselineMap[b.Name] = b
	}

	for _, r := range results {
		if b, ok := baselineMap[r.Config.Name]; ok {
			recallDelta := r.Recall*100 - b.Recall
			latencyDelta := r.AvgLatency - b.AvgLatency
			speedup := b.AvgLatency / r.AvgLatency

			recallSign := "+"
			if recallDelta < 0 {
				recallSign = ""
			}
			latencySign := "+"
			if latencyDelta < 0 {
				latencySign = ""
			}

			sb.WriteString(fmt.Sprintf("│ %-20s │ %s%6.2f pp     │ %s%8.0f µs    │ %10.2fx  │\n",
				r.Config.Name, recallSign, recallDelta, latencySign, latencyDelta, speedup))
		}
	}

	sb.WriteString("└──────────────────────┴────────────────┴──────────────────┴──────────────┘\n\n")

	// 规程合规性检查
	sb.WriteString("Compliance Check (规程 2.2: 磁盘索引 recall@10 ≥ 90%)\n")
	for _, r := range results {
		status := "✓ PASS"
		if r.Recall < 0.90 {
			status = "✗ FAIL"
		}
		sb.WriteString(fmt.Sprintf("  %s: %s (%.2f%%)\n", r.Config.Name, status, r.Recall*100))
	}

	return sb.String()
}
