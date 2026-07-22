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
	"path/filepath"
	"runtime/pprof"
	"testing"
	"time"

	"github.com/siyuan-note/siyuan/kernel/vectordb/storage"
)

// TestDiskInsertCPUProfile 对 DiskVamana Insert 路径进行 CPU Profile 分析。
//
// 流程：
//  1. 用 BuildFromVectors 构建 10K 向量的种子索引
//  2. 逐条 Insert 1000 个向量，同时收集 CPU profile
//  3. 将 profile 写入 cpu_disk_insert.prof
//
// 运行: go test -v -run TestDiskInsertCPUProfile -timeout 600s -count 1
func TestDiskInsertCPUProfile(t *testing.T) {
	if testing.Short() {
		t.Skip("CPU profile generation")
	}
	const (
		dim       = 128
		seedSize  = 10000
		insertNum = 1000
		total     = seedSize + insertNum
	)

	// ── 配置磁盘索引读取器 ──
	originalFactory := OpenDiskIndexReader
	t.Cleanup(func() { OpenDiskIndexReader = originalFactory })
	OpenDiskIndexReader = func(path string, readOnly bool) (storage.DiskIndexReader, error) {
		return storage.OpenReader(path, readOnly)
	}

	// ── 生成随机向量 ──
	rng := rand.New(rand.NewSource(42))
	vectors := make([][]float32, total)
	for i := range vectors {
		v := make([]float32, dim)
		for j := range v {
			v[j] = rng.Float32()*2 - 1
		}
		vectors[i] = v
	}

	seedVectors := vectors[:seedSize]
	insertVectors := vectors[seedSize:]

	// ── 构建种子索引 ──
	dir := t.TempDir()
	basePath := filepath.Join(dir, "disk_profile_bench")

	seedCfg := DefaultDiskBuildConfig()
	seedCfg.R = 32
	seedCfg.L = 200
	seedCfg.Alpha = 1.2

	t.Logf("构建种子索引: %d 条向量 → %s", seedSize, basePath)
	seedStart := time.Now()
	if _, err := BuildFromVectors(basePath, seedVectors, seedCfg); err != nil {
		t.Fatalf("BuildFromVectors (seed) failed: %v", err)
	}
	t.Logf("种子索引构建完成: %s", time.Since(seedStart).Round(time.Millisecond))

	// ── 打开磁盘索引 ──
	idx, err := Open(basePath)
	if err != nil {
		t.Fatalf("Open failed: %v", err)
	}
	t.Cleanup(func() {
		if cerr := idx.Close(); cerr != nil {
			t.Errorf("Close failed: %v", cerr)
		}
	})

	// ── 创建 CPU profile 文件 ──
	profPath := filepath.Join(".", "cpu_disk_insert.prof")
	profFile, err := os.Create(profPath)
	if err != nil {
		t.Fatalf("创建 profile 文件失败: %v", err)
	}
	defer profFile.Close()

	// ── 开始 CPU profiling ──
	if err := pprof.StartCPUProfile(profFile); err != nil {
		t.Fatalf("启动 CPU profile 失败: %v", err)
	}

	start := time.Now()

	// ── 逐条插入 ──
	for i := 0; i < insertNum; i++ {
		if _, ierr := idx.Insert(insertVectors[i]); ierr != nil {
			pprof.StopCPUProfile()
			t.Fatalf("Insert 第 %d 条向量失败: %v", i, ierr)
		}
		if (i+1)%200 == 0 {
			elapsed := time.Since(start)
			rate := float64(i+1) / elapsed.Seconds()
			t.Logf("已插入 %d/%d, 耗时 %v, 速率 %.1f/s", i+1, insertNum, elapsed.Round(time.Millisecond), rate)
		}
	}

	pprof.StopCPUProfile()

	elapsed := time.Since(start)
	rate := float64(insertNum) / elapsed.Seconds()
	t.Logf("总计插入 %d 条向量, 耗时 %v, 平均速率 %.1f/s", insertNum, elapsed.Round(time.Millisecond), rate)
	fmt.Printf("Profile 已保存到 %s\n", profPath)
}
