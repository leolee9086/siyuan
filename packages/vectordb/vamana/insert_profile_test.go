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
	"os"
	"runtime/pprof"
	"testing"
	"time"
)

// TestInsertCPUProfile 对 Vamana Insert 路径进行 CPU Profile 分析
// 插入 20K 条 128 维向量，收集 CPU profile 数据
func TestInsertCPUProfile(t *testing.T) {
	requireDiagnosticTest(t)

	const (
		dim   = 128
		total = 20000
	)

	// 生成随机向量
	rng := rand.New(rand.NewSource(42))
	vectors := make([][]float32, total)
	for i := range vectors {
		v := make([]float32, dim)
		for j := range v {
			v[j] = rng.Float32()*2 - 1
		}
		vectors[i] = v
	}

	// 创建索引（使用默认配置）
	cfg := DefaultConfig()
	idx := New(dim, cfg)

	// 创建 CPU profile 文件
	profFile, err := os.Create("cpu_insert_profile.prof")
	if err != nil {
		t.Fatalf("创建 profile 文件失败: %v", err)
	}
	defer profFile.Close()

	// 开始 CPU profiling
	if err := pprof.StartCPUProfile(profFile); err != nil {
		t.Fatalf("启动 CPU profile 失败: %v", err)
	}

	start := time.Now()

	// 逐条插入
	for i := 0; i < total; i++ {
		if _, err := idx.Insert(vectors[i]); err != nil {
			pprof.StopCPUProfile()
			t.Fatalf("插入第 %d 条向量失败: %v", i, err)
		}
		if (i+1)%5000 == 0 {
			elapsed := time.Since(start)
			rate := float64(i+1) / elapsed.Seconds()
			t.Logf("已插入 %d/%d, 耗时 %v, 速率 %.0f/s", i+1, total, elapsed, rate)
		}
	}

	pprof.StopCPUProfile()

	elapsed := time.Since(start)
	rate := float64(total) / elapsed.Seconds()
	t.Logf("总计插入 %d 条向量, 耗时 %v, 平均速率 %.0f/s", total, elapsed, rate)
	fmt.Printf("Profile 已保存到 cpu_insert_profile.prof\n")
}
