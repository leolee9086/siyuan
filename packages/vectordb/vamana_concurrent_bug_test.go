package vectordb

import (
	"sync"
	"testing"
)

// ============================================================
// 最严重的未暴露 Bug：
// VamanaCollection.InsertPoint 在更新（update）路径中，
// 在 Index.Delete 和 Index.Insert 之间释放 Mu 锁
// （vamana_collection.go:136），导致：
//   1. 并发 FlushToDisk 在此窗口内看到不完整的 IDMap
//   2. FlushToDisk 重建索引时不包含正被更新的点
//   3. 点被永久丢失
//   4. 新分配的 nodeID 成为悬空指针
// ============================================================

func TestBug_VamanaInsertUpdateRace(t *testing.T) {
	dbPath := t.TempDir()
	db, err := Open(dbPath)
	if err != nil {
		t.Fatal(err)
	}

	points := []Point{
		{ID: "p1", Vector: []float32{1, 0, 0, 0}},
		{ID: "p2", Vector: []float32{0, 1, 0, 0}},
		{ID: "p3", Vector: []float32{0, 0, 1, 0}},
	}
	col, err := db.CreateCollectionWithOptions("race-test", CollectionOptions{
		Engine: EngineDiskVamana,
		Points: points,
	})
	if err != nil {
		t.Fatal(err)
	}

	// 并发更新 p1 向量，同时反复 Flush
	var wg sync.WaitGroup

	// 更新者：连续更新 p1（触发 Index.Delete + Index.Insert 路径）
	wg.Add(1)
	go func() {
		defer wg.Done()
		for i := 0; i < 100; i++ {
			newVec := []float32{float32(i), float32(i + 1), float32(i + 2), float32(i + 3)}
			_ = col.Upsert([]Point{{ID: "p1", Vector: newVec}})
		}
	}()

	// Flush 者：反复刷新磁盘（触发 FlushToDisk = 重建索引）
	wg.Add(1)
	go func() {
		defer wg.Done()
		for i := 0; i < 20; i++ {
			_ = col.Flush()
		}
	}()

	// 搜索者：反复查找
	wg.Add(1)
	go func() {
		defer wg.Done()
		for i := 0; i < 100; i++ {
			_, err := col.Search([]float32{float32(i % 50), 0, 0, 0}, SearchOptions{TopK: 3})
			if err != nil {
				t.Errorf("Search error: %v", err)
				return
			}
		}
	}()

	wg.Wait()

	// 验证：3 个点应全部存在
	stats := col.Stats()
	t.Logf("Before close: Count=%d", stats.Count)

	if stats.Count != 3 {
		t.Errorf("BUG: 并发 Insert+Flush 后数据丢失！Count=%d（期望 3）", stats.Count)
	}

	_ = col.Close()

	// 重新打开验证持久化完整性
	db2, err := Open(dbPath)
	if err != nil {
		t.Fatal(err)
	}
	col2, err := db2.OpenCollection("race-test")
	if err != nil {
		t.Fatal(err)
	}
	defer col2.Close()

	stats2 := col2.Stats()
	t.Logf("After reopen: Count=%d", stats2.Count)

	if stats2.Count != 3 {
		t.Errorf("BUG: 重新打开后数据丢失！Count=%d（期望 3）", stats2.Count)
	}

	// 验证 p1、p2、p3 均可搜索到
	for _, id := range []string{"p1", "p2", "p3"} {
		points, err := col2.FetchPoints([]string{id})
		if err != nil {
			t.Errorf("FetchPoints %s error: %v", id, err)
			continue
		}
		if len(points) == 0 {
			t.Errorf("BUG: 点 %s 在重新打开后丢失", id)
		}
	}
}
