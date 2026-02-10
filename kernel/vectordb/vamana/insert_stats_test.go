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
	"math/rand"
	"testing"
)

// TestInsertDistanceStats 统计 Vamana Insert 各阶段的距离计算次数。
// 在 10K 和 20K 规模下分别运行，输出每次 Insert 的平均距离计算次数。
func TestInsertDistanceStats(t *testing.T) {
	const dim = 128

	scales := []int{10000, 20000}
	for _, n := range scales {
		t.Run(fmt.Sprintf("N=%d", n), func(t *testing.T) {
			runInsertStats(t, n, dim)
		})
	}
}

// runInsertStats 在指定规模下运行 Insert 统计
func runInsertStats(t *testing.T, n, dim int) {
	cfg := DefaultConfig()
	idx := New(dim, cfg)

	// 生成随机向量
	rng := rand.New(rand.NewSource(42))
	vectors := make([][]float32, n)
	for i := range vectors {
		v := make([]float32, dim)
		for j := range v {
			v[j] = rng.Float32()
		}
		vectors[i] = v
	}

	// 逐个插入并收集统计
	idx.ResetStats()

	for i := 0; i < n; i++ {
		_, err := idx.Insert(vectors[i])
		if err != nil {
			t.Fatalf("Insert %d failed: %v", i, err)
		}
	}

	// 读取统计结果
	greedyDist := idx.StatsGreedyDist.Load()
	selfPruneDist := idx.StatsSelfPruneDist.Load()
	backedgeDist := idx.StatsBackedgeDist.Load()
	backedgeCalls := idx.StatsBackedgeCalls.Load()
	backedgePrunes := idx.StatsBackedgePrunes.Load()
	totalDist := greedyDist + selfPruneDist + backedgeDist

	// 第一个点没有搜索/剪枝，有效插入数 = n-1
	effective := float64(n - 1)

	t.Logf("=== Vamana Insert Distance Stats (N=%d, dim=%d, R=%d, L=%d, Alpha=%.1f) ===",
		n, dim, cfg.R, cfg.L, cfg.Alpha)
	t.Logf("  greedySearch dist:     %d total, %.1f avg/insert", greedyDist, float64(greedyDist)/effective)
	t.Logf("  selfPrune dist:        %d total, %.1f avg/insert", selfPruneDist, float64(selfPruneDist)/effective)
	t.Logf("  backedge dist:         %d total, %.1f avg/insert", backedgeDist, float64(backedgeDist)/effective)
	t.Logf("  total dist:            %d total, %.1f avg/insert", totalDist, float64(totalDist)/effective)
	t.Logf("  addEdgeAndPrune calls: %d total, %.1f avg/insert", backedgeCalls, float64(backedgeCalls)/effective)
	t.Logf("  backedge prunes:       %d total, %.1f avg/insert", backedgePrunes, float64(backedgePrunes)/effective)

	pruneRatio := float64(0)
	if backedgeCalls > 0 {
		pruneRatio = float64(backedgePrunes) / float64(backedgeCalls) * 100
	}
	t.Logf("  prune trigger ratio:   %.1f%% (%d/%d)", pruneRatio, backedgePrunes, backedgeCalls)
}
