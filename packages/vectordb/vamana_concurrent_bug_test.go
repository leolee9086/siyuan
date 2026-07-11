package vectordb

import (
	"errors"
	"fmt"
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

func TestConcurrentStress_UpsertSearchFlushClose(t *testing.T) {
	dbPath := t.TempDir()
	db, err := Open(dbPath)
	if err != nil {
		t.Fatal(err)
	}

	const pointCount = 32
	points := make([]Point, pointCount)
	for i := range points {
		points[i] = Point{ID: fmt.Sprintf("p-%02d", i), Vector: []float32{float32(i), 1, 2, 3}}
	}
	col, err := db.CreateCollectionWithOptions("concurrent-stress", CollectionOptions{
		Engine: EngineDiskVamana,
		Points: points,
	})
	if err != nil {
		t.Fatal(err)
	}

	start := make(chan struct{})
	var workers sync.WaitGroup
	errCh := make(chan error, 128)

	for worker := 0; worker < 32; worker++ {
		workers.Add(1)
		go func(worker int) {
			defer workers.Done()
			<-start
			for iteration := 0; iteration < 30; iteration++ {
				_, searchErr := col.Search([]float32{float32((worker + iteration) % pointCount), 1, 2, 3}, SearchOptions{TopK: 5})
				if searchErr != nil {
					errCh <- searchErr
					return
				}
			}
		}(worker)
	}

	for worker := 0; worker < 4; worker++ {
		workers.Add(1)
		go func(worker int) {
			defer workers.Done()
			<-start
			for iteration := 0; iteration < 12; iteration++ {
				id := fmt.Sprintf("p-%02d", (worker+iteration*4)%pointCount)
				upsertErr := col.Upsert([]Point{{
					ID:     id,
					Vector: []float32{float32(worker*100 + iteration), 1, 2, 3},
				}})
				if upsertErr != nil {
					errCh <- upsertErr
					return
				}
			}
		}(worker)
	}

	workers.Add(1)
	go func() {
		defer workers.Done()
		<-start
		for iteration := 0; iteration < 12; iteration++ {
			if flushErr := col.Flush(); flushErr != nil {
				errCh <- flushErr
				return
			}
		}
	}()

	close(start)
	workers.Wait()
	close(errCh)
	for workerErr := range errCh {
		t.Fatalf("concurrent operation failed: %v", workerErr)
	}

	if stats := col.Stats(); stats.Count != pointCount {
		t.Fatalf("unexpected live point count before close: got %d, want %d", stats.Count, pointCount)
	}
	ids := col.(*CollectionHandle).col.ListIDs()
	seen := make(map[string]struct{}, len(ids))
	for _, id := range ids {
		if _, duplicated := seen[id]; duplicated {
			t.Fatalf("duplicate external ID: %s", id)
		}
		seen[id] = struct{}{}
	}
	if len(seen) != pointCount {
		t.Fatalf("unexpected unique ID count: got %d, want %d", len(seen), pointCount)
	}

	if err := col.Close(); err != nil {
		t.Fatalf("close collection: %v", err)
	}
	if _, err := col.Search([]float32{0, 1, 2, 3}, SearchOptions{TopK: 1}); !errors.Is(err, ErrCollectionClosed) {
		t.Fatalf("expected stable closed error after close, got %v", err)
	}

	reopenedDB, err := Open(dbPath)
	if err != nil {
		t.Fatalf("reopen database: %v", err)
	}
	defer reopenedDB.Close()
	reopened, err := reopenedDB.OpenCollection("concurrent-stress")
	if err != nil {
		t.Fatalf("reopen collection: %v", err)
	}
	defer reopened.Close()
	if stats := reopened.Stats(); stats.Count != pointCount {
		t.Fatalf("unexpected live point count after reopen: got %d, want %d", stats.Count, pointCount)
	}
}
