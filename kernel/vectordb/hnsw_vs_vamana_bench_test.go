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

import (
	"fmt"
	"math/rand"
	"path/filepath"
	"runtime"
	"sync/atomic"
	"testing"
	"time"

	"github.com/siyuan-note/siyuan/kernel/vectordb/bbq"
	"github.com/siyuan-note/siyuan/kernel/vectordb/hnsw"
	"github.com/siyuan-note/siyuan/kernel/vectordb/storage"
	"github.com/siyuan-note/siyuan/kernel/vectordb/vamana"
)

// ============================================================================
// 测试常量
// ============================================================================

const (
	benchCompDim       = 128   // 向量维度
	benchCompTotal     = 50000 // 总向量数
	benchCompPhaseSize = 10000 // 每阶段插入数

	// DiskVamana 种子索引大小：用 BuildFromVectors 构建初始索引，
	// 后续通过 Insert 逐条追加。
	diskVamanaSeedSize = 1000
)

// ============================================================================
// HNSW Distancer 实现 (用于基准测试)
// ============================================================================

// benchDistancer 实现 hnsw.Distancer 接口，用于基准测试。
// 仅支持 euclidean 距离，不支持 BBQ 量化（基准测试不需要）。
type benchDistancer struct {
	vectors [][]float32
	visited []uint32
	epoch   uint32
}

func newBenchDistancer(capacity int) *benchDistancer {
	return &benchDistancer{
		vectors: make([][]float32, 0, capacity),
		visited: make([]uint32, 0, capacity),
	}
}

func (d *benchDistancer) AddVector(id hnsw.DocID, vec []float32) {
	for int(id) >= len(d.vectors) {
		d.vectors = append(d.vectors, nil)
		d.visited = append(d.visited, 0)
	}
	d.vectors[id] = vec
}

func (d *benchDistancer) ComputeDistance(a, b hnsw.DocID, _ string) float32 {
	va, vb := d.vectors[a], d.vectors[b]
	var sum float32
	for i := range va {
		diff := va[i] - vb[i]
		sum += diff * diff
	}
	return sum
}

func (d *benchDistancer) ComputeDistanceFromVector(query []float32, id hnsw.DocID, _ string) float32 {
	v := d.vectors[id]
	var sum float32
	for i := range query {
		diff := query[i] - v[i]
		sum += diff * diff
	}
	return sum
}

func (d *benchDistancer) ComputeBBQDistance(a, b hnsw.DocID) float32 {
	return d.ComputeDistance(a, b, "")
}

func (d *benchDistancer) ComputeBBQDistanceFromQuery(_ []byte, _ bbq.QuantizationResult, _ hnsw.DocID) float32 {
	return 0
}

func (d *benchDistancer) QuantizeQuery(_ []float32) ([]byte, bbq.QuantizationResult) {
	return nil, bbq.QuantizationResult{}
}

func (d *benchDistancer) GetUnsafe(id hnsw.DocID) ([]float32, bool) {
	if int(id) >= len(d.vectors) || d.vectors[id] == nil {
		return nil, false
	}
	return d.vectors[id], true
}

func (d *benchDistancer) NewSearchEpoch() uint32 {
	return atomic.AddUint32(&d.epoch, 1)
}

func (d *benchDistancer) IsVisited(id hnsw.DocID, epoch uint32) bool {
	return atomic.LoadUint32(&d.visited[id]) == epoch
}

func (d *benchDistancer) MarkVisited(id hnsw.DocID, epoch uint32) {
	atomic.StoreUint32(&d.visited[id], epoch)
}

// ============================================================================
// 数据集生成
// ============================================================================

// generateBenchVectors 生成固定种子的随机向量数据集。
// 两个索引使用完全相同的数据集，确保对比公平。
func generateBenchVectors(total, dim int) [][]float32 {
	rng := rand.New(rand.NewSource(42))
	vectors := make([][]float32, total)
	for i := range vectors {
		v := make([]float32, dim)
		for j := range v {
			v[j] = rng.Float32()*2 - 1
		}
		vectors[i] = v
	}
	return vectors
}

// ============================================================================
// 分阶段吞吐量测试
// ============================================================================

// phaseResult 记录单阶段的测试结果
type phaseResult struct {
	Phase      int
	StartK     int // 起始数量 (千)
	EndK       int // 结束数量 (千)
	Duration   time.Duration
	Throughput float64 // items/sec
}

// TestHNSWvsVamanaInsertThroughput 全面对比 HNSW / Vamana / DiskVamana 的构建吞吐量。
//
// Section 1: 单线程算法效率对比（分阶段，每阶段 10K）
//   - HNSW Insert          — 逐条 Insert, 并行度 1
//   - Vamana Insert        — 逐条 Insert, 并行度 1
//   - Vamana Build-1T      — BuildParallel(v,1), 并行度 1（仅总体）
//   - DiskVamana Insert    — 逐条 Insert, 并行度 1
//
// Section 2: 多线程并行吞吐量（总体）
//   - Vamana Build-MT      — Build(v), NumCPU 线程
//   - DiskVamana Build     — BuildFromVectors, NumCPU 线程
//
// 使用 go test -run TestHNSWvsVamanaInsertThroughput -v -timeout 30m 运行。
func TestHNSWvsVamanaInsertThroughput(t *testing.T) {
	if testing.Short() {
		t.Skip("insertion throughput comparison")
	}
	vectors := generateBenchVectors(benchCompTotal, benchCompDim)
	phases := benchCompTotal / benchCompPhaseSize
	numCPU := runtime.NumCPU()

	t.Logf("=== HNSW / Vamana / DiskVamana 全面性能对比 ===")
	t.Logf("维度=%d, 总量=%d, 每阶段=%d, 阶段数=%d, NumCPU=%d",
		benchCompDim, benchCompTotal, benchCompPhaseSize, phases, numCPU)

	// ════════════════════════════════════════════════════════════════════
	// Section 1: 单线程算法效率对比
	// ════════════════════════════════════════════════════════════════════
	t.Logf("\n" + "═══════════════════════════════════════════════════════════")
	t.Logf("  Section 1: 单线程算法效率对比 (并行度=1)")
	t.Logf("═══════════════════════════════════════════════════════════")

	// ── 1a. HNSW Insert ──
	t.Logf("\n--- [1a] HNSW Insert (M=16, efConstruction=200, euclidean) ---")
	hnswResults := runHNSWPhasedInsert(t, vectors)

	// ── 1b. Vamana Insert ──
	t.Logf("\n--- [1b] Vamana Insert (R=32, L=200, Alpha=1.2, euclidean) ---")
	vamanaInsertResults := runVamanaPhasedInsert(t, vectors)

	// ── 1c. Vamana Build-1T ──
	t.Logf("\n--- [1c] Vamana Build-1T (R=32, L=200, Alpha=1.2, BuildParallel workers=1) ---")
	build1TDur, build1TThroughput := runVamanaBuild1T(t, vectors)

	// ── 1d. DiskVamana Insert ──
	t.Logf("\n--- [1d] DiskVamana Insert (R=32, L=200, seed=%d, euclidean) ---", diskVamanaSeedSize)
	diskInsertResults := runDiskVamanaPhasedInsert(t, vectors)

	// ── Section 1 汇总表 ──
	t.Logf("\n┌─────────────────────────────────────────────────────────────────────────────────────────┐")
	t.Logf("│ Section 1: 单线程分阶段对比 (每阶段 %dK)                                              │", benchCompPhaseSize/1000)
	t.Logf("├──────────┬──────────────────┬──────────────────┬──────────────────┬──────────────────────┤")
	t.Logf("│ %-8s │ %-16s │ %-16s │ %-16s │ %-20s │",
		"Phase", "HNSW-Ins", "Vamana-Ins", "DiskVam-Ins", "Build-1T (总体)")
	t.Logf("├──────────┼──────────────────┼──────────────────┼──────────────────┼──────────────────────┤")
	diskPhases := len(diskInsertResults)
	for i := 0; i < phases; i++ {
		build1TCol := ""
		if i == 0 {
			build1TCol = fmt.Sprintf("%.0f items/s", build1TThroughput)
		}
		diskCol := "           -   "
		if i < diskPhases {
			diskCol = fmt.Sprintf("%14.0f/s", diskInsertResults[i].Throughput)
		}
		t.Logf("│ %-8s │ %14.0f/s │ %14.0f/s │ %s │ %-20s │",
			fmt.Sprintf("%dk-%dk", hnswResults[i].StartK, hnswResults[i].EndK),
			hnswResults[i].Throughput,
			vamanaInsertResults[i].Throughput,
			diskCol,
			build1TCol,
		)
	}
	t.Logf("└──────────┴──────────────────┴──────────────────┴──────────────────┴──────────────────────┘")

	// Section 1 总体统计
	var hnswTotalDur, vamanaInsTotalDur, diskInsTotalDur time.Duration
	for i := 0; i < phases; i++ {
		hnswTotalDur += hnswResults[i].Duration
		vamanaInsTotalDur += vamanaInsertResults[i].Duration
	}
	for i := 0; i < diskPhases; i++ {
		diskInsTotalDur += diskInsertResults[i].Duration
	}
	hnswOverall := float64(benchCompTotal) / hnswTotalDur.Seconds()
	vamanaInsOverall := float64(benchCompTotal) / vamanaInsTotalDur.Seconds()
	diskInsTotal := diskVamanaSeedSize + diskPhases*benchCompPhaseSize
	diskInsOverall := float64(diskInsTotal) / diskInsTotalDur.Seconds()

	t.Logf("\nSection 1 总体吞吐量:")
	t.Logf("  %-22s %10.0f items/s", "HNSW Insert:", hnswOverall)
	t.Logf("  %-22s %10.0f items/s", "Vamana Insert:", vamanaInsOverall)
	t.Logf("  %-22s %10.0f items/s  (%s)", "Vamana Build-1T:", build1TThroughput, build1TDur.Round(time.Millisecond))
	t.Logf("  %-22s %10.0f items/s", "DiskVamana Insert:", diskInsOverall)

	// ════════════════════════════════════════════════════════════════════
	// Section 2: 多线程并行吞吐量
	// ════════════════════════════════════════════════════════════════════
	t.Logf("\n" + "═══════════════════════════════════════════════════════════")
	t.Logf("  Section 2: 多线程并行吞吐量 (NumCPU=%d)", numCPU)
	t.Logf("═══════════════════════════════════════════════════════════")

	// ── 2a. Vamana Build-MT ──
	t.Logf("\n--- [2a] Vamana Build-MT (R=32, L=200, Build, workers=NumCPU) ---")
	buildMTDur, buildMTThroughput := runVamanaBuildMT(t, vectors)

	// ── 2b. DiskVamana Build ──
	t.Logf("\n--- [2b] DiskVamana Build (R=32, L=200, BuildFromVectors, workers=NumCPU) ---")
	diskBuildDur, diskBuildThroughput := runDiskVamanaBuild(t, vectors)

	t.Logf("\n┌─────────────────────────────────────────────────────────────────┐")
	t.Logf("│ Section 2: 多线程总体吞吐量 (NumCPU=%d)                        │", numCPU)
	t.Logf("├──────────────────────┬──────────────────┬──────────────────────┤")
	t.Logf("│ %-20s │ %-16s │ %-20s │", "索引", "耗时", "吞吐量")
	t.Logf("├──────────────────────┼──────────────────┼──────────────────────┤")
	t.Logf("│ %-20s │ %16s │ %16.0f/s   │", "Vamana Build-MT", buildMTDur.Round(time.Millisecond), buildMTThroughput)
	t.Logf("│ %-20s │ %16s │ %16.0f/s   │", "DiskVamana Build", diskBuildDur.Round(time.Millisecond), diskBuildThroughput)
	t.Logf("└──────────────────────┴──────────────────┴──────────────────────┘")

	// ════════════════════════════════════════════════════════════════════
	// 衰减分析
	// ════════════════════════════════════════════════════════════════════
	t.Logf("\n=== 衰减分析 (末阶段/首阶段 吞吐量比) ===")
	if phases > 1 {
		type decayEntry struct {
			name  string
			first float64
			last  float64
		}
		entries := []decayEntry{
			{"HNSW Insert", hnswResults[0].Throughput, hnswResults[phases-1].Throughput},
			{"Vamana Insert", vamanaInsertResults[0].Throughput, vamanaInsertResults[phases-1].Throughput},
		}
		if diskPhases > 1 {
			entries = append(entries, decayEntry{
				"DiskVamana Insert", diskInsertResults[0].Throughput, diskInsertResults[diskPhases-1].Throughput,
			})
		}
		for _, e := range entries {
			ratio := e.last / e.first
			t.Logf("  %-22s %.2f  (%.0f → %.0f)", e.name+":", ratio, e.first, e.last)
		}
	}
}

// ============================================================================
// HNSW 分阶段插入
// ============================================================================

func runHNSWPhasedInsert(t *testing.T, vectors [][]float32) []phaseResult {
	t.Helper()

	// 使用生产级 VectorStore 替代 benchDistancer，
	// 以反映真实的连续内存布局和 8 路展开距离计算性能
	store := NewVectorStore(benchCompDim, "cosine")
	store.Grow(benchCompTotal)
	cfg := hnsw.Config{
		M:              16,
		EfConstruction: 200,
		EfSearch:       64,
		MaxLevel:       16,
		MetricType:     "l2", // VectorStore 使用 "l2" 而非 "euclidean"
	}
	idx := hnsw.NewHNSWIndex(benchCompDim, cfg, store)

	// 预加载所有向量到 VectorStore
	for i, v := range vectors {
		store.Set(DocID(i), v)
	}

	phases := benchCompTotal / benchCompPhaseSize
	results := make([]phaseResult, phases)

	t.Logf("%-12s %-12s %-15s %-15s", "Phase", "Range", "Duration", "Items/sec")
	for phase := 0; phase < phases; phase++ {
		start := phase * benchCompPhaseSize
		end := start + benchCompPhaseSize

		t0 := time.Now()
		for i := start; i < end; i++ {
			idx.Insert(hnsw.DocID(i))
		}
		elapsed := time.Since(t0)
		throughput := float64(benchCompPhaseSize) / elapsed.Seconds()

		results[phase] = phaseResult{
			Phase:      phase,
			StartK:     start / 1000,
			EndK:       end / 1000,
			Duration:   elapsed,
			Throughput: throughput,
		}

		t.Logf("%-12d %-12s %-15s %-15.0f",
			phase,
			fmt.Sprintf("%dk-%dk", start/1000, end/1000),
			elapsed.Round(time.Millisecond),
			throughput,
		)
	}

	return results
}

// ============================================================================
// Vamana 分阶段逐条插入
// ============================================================================

func runVamanaPhasedInsert(t *testing.T, vectors [][]float32) []phaseResult {
	t.Helper()

	cfg := vamana.DefaultConfig()
	cfg.R = 32 // 匹配 HNSW layer0 的 2*M=32
	cfg.L = 200
	cfg.Alpha = 1.2
	cfg.MaxBackedges = 16
	idx := vamana.New(benchCompDim, cfg)

	phases := benchCompTotal / benchCompPhaseSize
	results := make([]phaseResult, phases)

	t.Logf("%-12s %-12s %-15s %-15s", "Phase", "Range", "Duration", "Items/sec")
	for phase := 0; phase < phases; phase++ {
		start := phase * benchCompPhaseSize
		end := start + benchCompPhaseSize

		t0 := time.Now()
		for i := start; i < end; i++ {
			if _, err := idx.Insert(vectors[i]); err != nil {
				t.Fatalf("Vamana Insert failed at %d: %v", i, err)
			}
		}
		elapsed := time.Since(t0)
		throughput := float64(benchCompPhaseSize) / elapsed.Seconds()

		results[phase] = phaseResult{
			Phase:      phase,
			StartK:     start / 1000,
			EndK:       end / 1000,
			Duration:   elapsed,
			Throughput: throughput,
		}

		t.Logf("%-12d %-12s %-15s %-15.0f",
			phase,
			fmt.Sprintf("%dk-%dk", start/1000, end/1000),
			elapsed.Round(time.Millisecond),
			throughput,
		)
	}

	return results
}

// ============================================================================
// Vamana Build-1T: 单线程批量构建 (Section 1 对照项)
// ============================================================================

func runVamanaBuild1T(t *testing.T, vectors [][]float32) (time.Duration, float64) {
	t.Helper()

	cfg := vamana.DefaultConfig()
	cfg.R = 32
	cfg.L = 200
	cfg.Alpha = 1.2
	cfg.MaxBackedges = 16
	idx := vamana.New(benchCompDim, cfg)

	t0 := time.Now()
	if err := idx.BuildParallel(vectors, 1); err != nil {
		t.Fatalf("Vamana BuildParallel(1) failed: %v", err)
	}
	elapsed := time.Since(t0)
	throughput := float64(len(vectors)) / elapsed.Seconds()

	t.Logf("Build-1T: %s, %.0f items/sec", elapsed.Round(time.Millisecond), throughput)
	return elapsed, throughput
}

// ============================================================================
// Vamana Build-MT: 多线程批量构建 (Section 2)
// ============================================================================

func runVamanaBuildMT(t *testing.T, vectors [][]float32) (time.Duration, float64) {
	t.Helper()

	cfg := vamana.DefaultConfig()
	cfg.R = 32
	cfg.L = 200
	cfg.Alpha = 1.2
	cfg.MaxBackedges = 16
	idx := vamana.New(benchCompDim, cfg)

	t0 := time.Now()
	if err := idx.Build(vectors); err != nil {
		t.Fatalf("Vamana Build (MT) failed: %v", err)
	}
	elapsed := time.Since(t0)
	throughput := float64(len(vectors)) / elapsed.Seconds()

	t.Logf("Build-MT (NumCPU=%d): %s, %.0f items/sec",
		runtime.NumCPU(), elapsed.Round(time.Millisecond), throughput)
	return elapsed, throughput
}

// ============================================================================
// DiskVamana 分阶段逐条插入 (Section 1)
// ============================================================================

// runDiskVamanaPhasedInsert 先用 BuildFromVectors 构建种子索引，再逐条 Insert 剩余向量。
// 种子构建时间不计入分阶段统计；分阶段仅统计 Insert 操作。
func runDiskVamanaPhasedInsert(t *testing.T, vectors [][]float32) []phaseResult {
	t.Helper()

	// ── 配置磁盘索引读取器 ──
	originalFactory := vamana.OpenDiskIndexReader
	t.Cleanup(func() { vamana.OpenDiskIndexReader = originalFactory })
	vamana.OpenDiskIndexReader = func(path string, readOnly bool) (storage.DiskIndexReader, error) {
		return storage.OpenReader(path, readOnly)
	}

	// ── 构建种子索引 ──
	dir := t.TempDir()
	basePath := filepath.Join(dir, "disk_insert_bench")

	seedCfg := vamana.DefaultDiskBuildConfig()
	seedCfg.R = 32
	seedCfg.L = 200
	seedCfg.Alpha = 1.2

	seedVectors := vectors[:diskVamanaSeedSize]
	t.Logf("构建种子索引: %d 条向量 → %s", len(seedVectors), basePath)
	seedStart := time.Now()
	if _, err := vamana.BuildFromVectors(basePath, seedVectors, seedCfg); err != nil {
		t.Fatalf("DiskVamana BuildFromVectors (seed) failed: %v", err)
	}
	t.Logf("种子索引构建完成: %s", time.Since(seedStart).Round(time.Millisecond))

	// ── 打开磁盘索引 ──
	idx, err := vamana.Open(basePath)
	if err != nil {
		t.Fatalf("DiskVamana Open failed: %v", err)
	}
	t.Cleanup(func() {
		if cerr := idx.Close(); cerr != nil {
			t.Errorf("DiskVamana Close failed: %v", cerr)
		}
	})

	// ── 分阶段插入剩余向量 ──
	remaining := vectors[diskVamanaSeedSize:]
	phases := len(remaining) / benchCompPhaseSize
	results := make([]phaseResult, phases)

	t.Logf("%-12s %-12s %-15s %-15s", "Phase", "Range", "Duration", "Items/sec")
	for phase := 0; phase < phases; phase++ {
		start := phase * benchCompPhaseSize
		end := start + benchCompPhaseSize

		// 全局偏移（用于报告）
		globalStart := diskVamanaSeedSize + start
		globalEnd := diskVamanaSeedSize + end

		t0 := time.Now()
		for i := start; i < end; i++ {
			if _, ierr := idx.Insert(remaining[i]); ierr != nil {
				t.Fatalf("DiskVamana Insert failed at global %d: %v",
					diskVamanaSeedSize+i, ierr)
			}
		}
		elapsed := time.Since(t0)
		throughput := float64(benchCompPhaseSize) / elapsed.Seconds()

		results[phase] = phaseResult{
			Phase:      phase,
			StartK:     globalStart / 1000,
			EndK:       globalEnd / 1000,
			Duration:   elapsed,
			Throughput: throughput,
		}

		t.Logf("%-12d %-12s %-15s %-15.0f",
			phase,
			fmt.Sprintf("%dk-%dk", globalStart/1000, globalEnd/1000),
			elapsed.Round(time.Millisecond),
			throughput,
		)
	}

	return results
}

// ============================================================================
// DiskVamana BuildFromVectors: 多线程批量构建 (Section 2)
// ============================================================================

func runDiskVamanaBuild(t *testing.T, vectors [][]float32) (time.Duration, float64) {
	t.Helper()

	dir := t.TempDir()
	basePath := filepath.Join(dir, "disk_build_bench")

	cfg := vamana.DefaultDiskBuildConfig()
	cfg.R = 32
	cfg.L = 200
	cfg.Alpha = 1.2

	t0 := time.Now()
	if _, err := vamana.BuildFromVectors(basePath, vectors, cfg); err != nil {
		t.Fatalf("DiskVamana BuildFromVectors failed: %v", err)
	}
	elapsed := time.Since(t0)
	throughput := float64(len(vectors)) / elapsed.Seconds()

	t.Logf("DiskVamana Build (NumCPU=%d): %s, %.0f items/sec",
		runtime.NumCPU(), elapsed.Round(time.Millisecond), throughput)
	return elapsed, throughput
}
