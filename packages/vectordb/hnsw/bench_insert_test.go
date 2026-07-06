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

package hnsw

import (
	"fmt"
	"math/rand"
	"os"
	"path/filepath"
	"runtime/pprof"
	"testing"
	"time"
)

const (
	benchDim       = 128
	benchPhaseSize = 10_000
	benchMaxTotal  = 50_000
)

// newBenchDistancer 创建用于基准测试的 mockDistancer，
// 预生成所有向量以排除向量生成开销。
func newBenchDistancer(total int, dim int) (*mockDistancer, [][]float32) {
	rng := rand.New(rand.NewSource(42))
	dist := newMockDistancer(euclideanDistance)
	vectors := make([][]float32, total)
	for i := 0; i < total; i++ {
		v := make([]float32, dim)
		for j := range v {
			v[j] = rng.Float32()*2 - 1
		}
		vectors[i] = v
	}
	return dist, vectors
}

// newBenchIndex 创建用于基准测试的 HNSW 索引（使用默认配置）。
func newBenchIndex(dim int, dist *mockDistancer) *HNSWIndex {
	cfg := DefaultConfig()
	return NewHNSWIndex(dim, cfg, dist)
}

// BenchmarkInsertPhased 分阶段插入基准测试。
// 每阶段插入 benchPhaseSize 条向量，记录各阶段吞吐量。
func BenchmarkInsertPhased(b *testing.B) {
	phases := benchMaxTotal / benchPhaseSize
	for phase := 0; phase < phases; phase++ {
		phaseName := fmt.Sprintf("phase_%d_%dk_to_%dk",
			phase, phase*benchPhaseSize/1000, (phase+1)*benchPhaseSize/1000)

		b.Run(phaseName, func(b *testing.B) {
			for n := 0; n < b.N; n++ {
				b.StopTimer()
				dist, vectors := newBenchDistancer(benchMaxTotal, benchDim)
				idx := newBenchIndex(benchDim, dist)

				// 预插入前面阶段的数据
				for i := 0; i < phase*benchPhaseSize; i++ {
					dist.AddVector(DocID(i), vectors[i])
					idx.Insert(DocID(i))
				}

				// 准备当前阶段的向量到 distancer
				start := phase * benchPhaseSize
				end := start + benchPhaseSize
				for i := start; i < end; i++ {
					dist.AddVector(DocID(i), vectors[i])
				}

				b.ResetTimer()
				b.StartTimer()

				// 计时：仅测量当前阶段的插入
				for i := start; i < end; i++ {
					idx.Insert(DocID(i))
				}

				b.StopTimer()
				b.ReportMetric(float64(benchPhaseSize)/b.Elapsed().Seconds(), "items/sec")
			}
		})
	}
}

// BenchmarkInsertTotal 总量插入基准测试，测量从 0 到 benchMaxTotal 的整体吞吐量。
func BenchmarkInsertTotal(b *testing.B) {
	for n := 0; n < b.N; n++ {
		b.StopTimer()
		dist, vectors := newBenchDistancer(benchMaxTotal, benchDim)
		idx := newBenchIndex(benchDim, dist)
		for i := 0; i < benchMaxTotal; i++ {
			dist.AddVector(DocID(i), vectors[i])
		}
		b.ResetTimer()
		b.StartTimer()

		for i := 0; i < benchMaxTotal; i++ {
			idx.Insert(DocID(i))
		}

		b.StopTimer()
		b.ReportMetric(float64(benchMaxTotal)/b.Elapsed().Seconds(), "items/sec")
	}
}

// TestInsertThroughputCurve 非 benchmark 测试，输出分阶段吞吐量衰减曲线数据。
// 使用 go test -run TestInsertThroughputCurve -v 运行。
func TestInsertThroughputCurve(t *testing.T) {
	requireDiagnosticTest(t)

	dist, vectors := newBenchDistancer(benchMaxTotal, benchDim)
	idx := newBenchIndex(benchDim, dist)

	// 预加载所有向量到 distancer
	for i := 0; i < benchMaxTotal; i++ {
		dist.AddVector(DocID(i), vectors[i])
	}

	phases := benchMaxTotal / benchPhaseSize
	t.Logf("=== 插入吞吐量衰减曲线 (dim=%d, total=%d, phase=%d) ===",
		benchDim, benchMaxTotal, benchPhaseSize)
	t.Logf("%-12s %-12s %-15s %-15s", "Phase", "Range", "Duration", "Items/sec")

	for phase := 0; phase < phases; phase++ {
		start := phase * benchPhaseSize
		end := start + benchPhaseSize

		t0 := time.Now()
		for i := start; i < end; i++ {
			idx.Insert(DocID(i))
		}
		elapsed := time.Since(t0)

		throughput := float64(benchPhaseSize) / elapsed.Seconds()
		t.Logf("%-12d %-12s %-15s %-15.1f",
			phase,
			fmt.Sprintf("%dk-%dk", start/1000, end/1000),
			elapsed.Round(time.Millisecond),
			throughput,
		)
	}
}

// TestInsertCPUProfile 收集插入过程的 CPU profile。
// 将 profile 写入 testdata/insert_cpu.prof。
func TestInsertCPUProfile(t *testing.T) {
	requireDiagnosticTest(t)

	dist, vectors := newBenchDistancer(benchMaxTotal, benchDim)
	idx := newBenchIndex(benchDim, dist)

	for i := 0; i < benchMaxTotal; i++ {
		dist.AddVector(DocID(i), vectors[i])
	}

	// 确保 testdata 目录存在
	testdataDir := filepath.Join("testdata")
	if err := os.MkdirAll(testdataDir, 0o755); err != nil {
		t.Fatalf("创建 testdata 目录失败: %v", err)
	}

	profPath := filepath.Join(testdataDir, "insert_cpu.prof")
	f, err := os.Create(profPath)
	if err != nil {
		t.Fatalf("创建 profile 文件失败: %v", err)
	}
	defer f.Close()

	// 开始 CPU profiling
	if err := pprof.StartCPUProfile(f); err != nil {
		t.Fatalf("启动 CPU profiling 失败: %v", err)
	}

	t0 := time.Now()
	for i := 0; i < benchMaxTotal; i++ {
		idx.Insert(DocID(i))
	}
	elapsed := time.Since(t0)

	pprof.StopCPUProfile()

	throughput := float64(benchMaxTotal) / elapsed.Seconds()
	t.Logf("CPU Profile 已写入: %s", profPath)
	t.Logf("插入 %d 条耗时 %s, 吞吐量 %.1f items/sec", benchMaxTotal, elapsed.Round(time.Millisecond), throughput)
}
