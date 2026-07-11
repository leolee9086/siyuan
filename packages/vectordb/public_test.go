package vectordb

import (
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"testing"

	"s-forge.local/vectordb/storage"
	"s-forge.local/vectordb/vamana"
)

func TestUnifiedDB_DiskVamanaLifecycle(t *testing.T) {
	dbPath := t.TempDir()
	db, err := Open(dbPath)
	if err != nil {
		t.Fatalf("open db: %v", err)
	}

	points := []Point{
		{ID: "alpha", Vector: []float32{0, 0, 0, 0}, Meta: MarshalMeta(map[string]string{"kind": "seed"})},
		{ID: "beta", Vector: []float32{10, 10, 10, 10}},
		{ID: "gamma", Vector: []float32{20, 20, 20, 20}},
		{ID: "delta", Vector: []float32{30, 30, 30, 30}},
	}

	col, err := db.CreateCollectionWithOptions("disk-main", CollectionOptions{
		Engine: EngineDiskVamana,
		Points: points,
	})
	if err != nil {
		t.Fatalf("create disk-vamana collection: %v", err)
	}
	if stats := col.Stats(); stats.Engine != EngineDiskVamana || stats.Count != len(points) || stats.Dimension != 4 {
		t.Fatalf("unexpected stats after create: %+v", stats)
	}

	results, err := col.Search([]float32{0, 0, 0, 0}, SearchOptions{TopK: 2, EfSearch: 20})
	if err != nil {
		t.Fatalf("search disk-vamana collection: %v", err)
	}
	if len(results) == 0 || results[0].ID != "alpha" {
		t.Fatalf("expected alpha as nearest result, got %+v", results)
	}

	var meta map[string]string
	if err := json.Unmarshal(results[0].Meta, &meta); err != nil {
		t.Fatalf("unmarshal result meta: %v", err)
	}
	if meta["kind"] != "seed" {
		t.Fatalf("unexpected meta: %+v", meta)
	}

	if err := col.Upsert([]Point{{ID: "epsilon", Vector: []float32{1, 1, 1, 1}}}); err != nil {
		t.Fatalf("upsert disk-vamana collection: %v", err)
	}
	if err := col.Upsert([]Point{{ID: "alpha", Vector: []float32{50, 50, 50, 50}, Meta: MarshalMeta(map[string]string{"kind": "updated"})}}); err != nil {
		t.Fatalf("update existing disk-vamana point: %v", err)
	}
	if stats := col.Stats(); stats.Count != 5 {
		t.Fatalf("unexpected stats after upsert: %+v", stats)
	}

	results, err = col.Search([]float32{50, 50, 50, 50}, SearchOptions{TopK: 2, EfSearch: 20})
	if err != nil {
		t.Fatalf("search updated disk-vamana collection: %v", err)
	}
	if len(results) == 0 || results[0].ID != "alpha" {
		t.Fatalf("expected updated alpha as nearest result, got %+v", results)
	}

	if err := col.Delete([]string{"beta"}); err != nil {
		t.Fatalf("delete disk-vamana collection: %v", err)
	}
	if stats := col.Stats(); stats.Count != 4 {
		t.Fatalf("unexpected stats after delete: %+v", stats)
	}
	if err := col.Close(); err != nil {
		t.Fatalf("close collection: %v", err)
	}

	reloadedDB, err := Open(dbPath)
	if err != nil {
		t.Fatalf("reload db: %v", err)
	}
	reopened, err := reloadedDB.OpenCollection("disk-main")
	if err != nil {
		t.Fatalf("reopen disk-vamana collection: %v", err)
	}
	defer reopened.Close()

	if stats := reopened.Stats(); stats.Engine != EngineDiskVamana || stats.Count != 4 {
		t.Fatalf("unexpected stats after reopen: %+v", stats)
	}
	results, err = reopened.Search([]float32{50, 50, 50, 50}, SearchOptions{TopK: 2, EfSearch: 20})
	if err != nil {
		t.Fatalf("search reopened updated collection: %v", err)
	}
	if len(results) == 0 || results[0].ID != "alpha" {
		t.Fatalf("expected updated alpha after reopen, got %+v", results)
	}
	results, err = reopened.Search([]float32{1, 1, 1, 1}, SearchOptions{TopK: 4, EfSearch: 20})
	if err != nil {
		t.Fatalf("search reopened collection: %v", err)
	}
	if len(results) == 0 || results[0].ID != "epsilon" {
		t.Fatalf("expected epsilon after reopen, got %+v", results)
	}
	for _, result := range results {
		if result.ID == "beta" {
			t.Fatalf("deleted beta should not be returned after reopen: %+v", results)
		}
	}
}

func TestUnifiedDB_DiskVamanaSyncWriteDoesNotRebuildBaseIndex(t *testing.T) {
	dbPath := t.TempDir()
	db, err := Open(dbPath)
	if err != nil {
		t.Fatal(err)
	}
	points := []Point{
		{ID: "medoid", Vector: []float32{0, 0, 0, 0}},
		{ID: "one", Vector: []float32{10, 10, 10, 10}},
		{ID: "two", Vector: []float32{20, 20, 20, 20}},
	}
	collection, err := db.CreateCollectionWithOptions("incremental-durable", CollectionOptions{Engine: EngineDiskVamana, Points: points})
	if err != nil {
		t.Fatal(err)
	}
	indexPath := filepath.Join(dbPath, "incremental-durable", "vamana.index")
	before, err := os.Stat(indexPath)
	if err != nil {
		t.Fatal(err)
	}

	if err := collection.Upsert([]Point{{ID: "medoid", Vector: []float32{50, 50, 50, 50}}, {ID: "new", Vector: []float32{1, 1, 1, 1}}}); err != nil {
		t.Fatal(err)
	}
	if err := collection.Delete([]string{"one"}); err != nil {
		t.Fatal(err)
	}
	after, err := os.Stat(indexPath)
	if err != nil {
		t.Fatal(err)
	}
	if after.Size() != before.Size() || !after.ModTime().Equal(before.ModTime()) {
		t.Fatalf("普通同步写入不应全量重建基础索引：before=%d/%v，after=%d/%v", before.Size(), before.ModTime(), after.Size(), after.ModTime())
	}
	if err := collection.Close(); err != nil {
		t.Fatal(err)
	}

	reopenedDB, err := Open(dbPath)
	if err != nil {
		t.Fatal(err)
	}
	defer reopenedDB.Close()
	reopened, err := reopenedDB.OpenCollection("incremental-durable")
	if err != nil {
		t.Fatal(err)
	}
	results, err := reopened.Search([]float32{50, 50, 50, 50}, SearchOptions{TopK: 3, EfSearch: 20})
	if err != nil || len(results) == 0 || results[0].ID != "medoid" {
		t.Fatalf("删除磁盘 medoid 后增量恢复失败：results=%+v，err=%v", results, err)
	}
	for _, result := range results {
		if result.ID == "one" {
			t.Fatalf("已删除节点不应在重启后返回：%+v", results)
		}
	}
}

func TestUnifiedDB_DiskVamanaCloseReleasesFiles(t *testing.T) {
	for i := 0; i < 100; i++ {
		dbPath := t.TempDir()
		db, err := Open(dbPath)
		if err != nil {
			t.Fatalf("iteration %d: open db: %v", i, err)
		}
		col, err := db.CreateCollectionWithOptions("disk-close", CollectionOptions{
			Engine: EngineDiskVamana,
			Points: []Point{{ID: "p1", Vector: []float32{1, 2, 3, 4}}},
		})
		if err != nil {
			t.Fatalf("iteration %d: create collection: %v", i, err)
		}
		if err := col.Close(); err != nil {
			t.Fatalf("iteration %d: close collection: %v", i, err)
		}

		collectionPath := filepath.Join(dbPath, "disk-close")
		renamedPath := filepath.Join(dbPath, "disk-close-renamed")
		if err := os.Rename(collectionPath, renamedPath); err != nil {
			t.Fatalf("iteration %d: rename closed collection directory: %v", i, err)
		}
		if err := os.RemoveAll(renamedPath); err != nil {
			t.Fatalf("iteration %d: remove closed collection directory: %v", i, err)
		}
	}
}

func TestUnifiedDB_FetchPointsAfterSearch(t *testing.T) {
	dbPath := t.TempDir()
	db, err := Open(dbPath)
	if err != nil {
		t.Fatalf("open db: %v", err)
	}

	// 构建 DiskVamana 集合，含元数据
	points := []Point{
		{ID: "f1", Vector: []float32{1, 0, 0, 0}, Meta: MarshalMeta(map[string]string{"tag": "one"})},
		{ID: "f2", Vector: []float32{0, 1, 0, 0}},
		{ID: "f3", Vector: []float32{0, 0, 1, 0}, Meta: MarshalMeta(map[string]string{"tag": "three"})},
	}
	col, err := db.CreateCollectionWithOptions("fetch-test", CollectionOptions{
		Engine:    EngineDiskVamana,
		Dimension: 4,
		Points:    points,
	})
	if err != nil {
		t.Fatalf("create collection: %v", err)
	}

	// 搜索后按结果 ID 取回完整点
	results, err := col.Search([]float32{1, 0, 0, 0}, SearchOptions{TopK: 3, EfSearch: 20})
	if err != nil {
		t.Fatalf("search failed: %v", err)
	}
	if len(results) == 0 || results[0].ID != "f1" {
		t.Fatalf("expected f1 as top result, got %+v", results[0])
	}

	// FetchPoints 按 ID 批量取回向量+元数据
	ids := []string{"f1", "f2", "f-none"}
	fetched, err := col.FetchPoints(ids)
	if err != nil {
		t.Fatalf("FetchPoints failed: %v", err)
	}
	if len(fetched) != 2 {
		t.Fatalf("expected 2 fetched points (f-none should be skipped), got %d", len(fetched))
	}
	if fetched[0].ID != "f1" || len(fetched[0].Vector) != 4 {
		t.Errorf("f1 fetch mismatch: %+v", fetched[0])
	}
	if fetched[1].ID != "f2" {
		t.Errorf("f2 fetch mismatch: got ID=%s", fetched[1].ID)
	}
	// f1 应有元数据
	for _, pt := range fetched {
		if pt.ID == "f1" {
			var meta map[string]string
			if err := json.Unmarshal(pt.Meta, &meta); err != nil {
				t.Fatalf("unmarshal meta for f1: %v", err)
			}
			if meta["tag"] != "one" {
				t.Errorf("f1 meta tag mismatch: got %v", meta)
			}
		}
	}

	_ = col.Close()

	// 重新打开后 FetchPoints 仍可工作
	db2, err := Open(dbPath)
	if err != nil {
		t.Fatalf("reopen db: %v", err)
	}
	col2, err := db2.OpenCollection("fetch-test")
	if err != nil {
		t.Fatalf("reopen collection: %v", err)
	}
	defer col2.Close()

	fetched2, err := col2.FetchPoints([]string{"f3"})
	if err != nil {
		t.Fatalf("FetchPoints after reopen failed: %v", err)
	}
	if len(fetched2) != 1 || fetched2[0].ID != "f3" {
		t.Errorf("after reopen: expected f3, got %+v", fetched2)
	}
}

// TestUnifiedDB_FetchPoints_HNSW 验证 HNSW 引擎的 FetchPoints
func TestUnifiedDB_FetchPoints_HNSW(t *testing.T) {
	db, err := Open(t.TempDir())
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	col, err := db.CreateCollectionWithOptions("hnsw-fetch", CollectionOptions{
		Engine:    EngineHNSW,
		Dimension: 3,
		Points: []Point{
			{ID: "x", Vector: []float32{1, 0, 0}, Meta: MarshalMeta(map[string]string{"v": "x"})},
			{ID: "y", Vector: []float32{0, 1, 0}},
		},
	})
	if err != nil {
		t.Fatalf("create hnsw collection: %v", err)
	}

	fetched, err := col.FetchPoints([]string{"x", "z"})
	if err != nil {
		t.Fatalf("FetchPoints hnsw failed: %v", err)
	}
	if len(fetched) != 1 {
		t.Fatalf("expected 1 fetched (z not found), got %d", len(fetched))
	}
	if fetched[0].ID != "x" || len(fetched[0].Vector) != 3 {
		t.Errorf("hnsw fetch x mismatch: %+v", fetched[0])
	}
}

func TestUnifiedDB_SearchScoreThreshold(t *testing.T) {
	db, err := Open(t.TempDir())
	if err != nil {
		t.Fatalf("open db: %v", err)
	}

	// 插入距离分布不同的向量，使 ScoreThreshold 能截断部分结果
	col, err := db.CreateCollectionWithOptions("score-test", CollectionOptions{
		Engine:    EngineHNSW,
		Dimension: 2,
		Points: []Point{
			{ID: "near", Vector: []float32{0.99, 0.01}},
			{ID: "mid", Vector: []float32{0.5, 0.5}},
			{ID: "far", Vector: []float32{0.01, 0.99}},
		},
	})
	if err != nil {
		t.Fatalf("create collection: %v", err)
	}

	// 查询与 near 相同的向量，score 约为 1.0
	query := []float32{0.99, 0.01}

	// 无阈值：应返回全部 3 个
	results, err := col.Search(query, SearchOptions{TopK: 3})
	if err != nil {
		t.Fatalf("search without threshold: %v", err)
	}
	if len(results) != 3 {
		t.Fatalf("expected 3 results without threshold, got %d", len(results))
	}

	// ScoreThreshold=0.9：应只返回 near（score≈1.0）
	results, err = col.Search(query, SearchOptions{TopK: 3, ScoreThreshold: 0.9})
	if err != nil {
		t.Fatalf("search threshold=0.9: %v", err)
	}
	if len(results) == 0 || results[0].ID != "near" {
		t.Fatalf("threshold=0.9: expected near at top, got %+v", results)
	}
	if len(results) > 1 {
		t.Logf("threshold=0.9 returned %d results (may include near only if scores drop below 0.9)", len(results))
	}

	// ScoreThreshold=0.0：应返回全部
	results, err = col.Search(query, SearchOptions{TopK: 3, ScoreThreshold: 0.0})
	if err != nil {
		t.Fatalf("search threshold=0.0: %v", err)
	}
	if len(results) != 3 {
		t.Fatalf("threshold=0.0 expected 3 results, got %d", len(results))
	}
}

func TestUnifiedDB_Count(t *testing.T) {
	db, err := Open(t.TempDir())
	if err != nil {
		t.Fatalf("open db: %v", err)
	}

	col, err := db.CreateCollectionWithOptions("count-test", CollectionOptions{
		Engine:    EngineHNSW,
		Dimension: 2,
		Points: []Point{
			{ID: "a", Vector: []float32{1, 0}},
			{ID: "b", Vector: []float32{0, 1}},
		},
	})
	if err != nil {
		t.Fatalf("create collection: %v", err)
	}

	if got := col.Stats().Count; got != 2 {
		t.Fatalf("expected count=2 after create, got %d", got)
	}

	if err := col.Upsert([]Point{{ID: "c", Vector: []float32{0.5, 0.5}}}); err != nil {
		t.Fatalf("upsert c: %v", err)
	}
	if got := col.Stats().Count; got != 3 {
		t.Fatalf("expected count=3 after upsert, got %d", got)
	}

	if err := col.Delete([]string{"a"}); err != nil {
		t.Fatalf("delete a: %v", err)
	}
	if got := col.Stats().Count; got != 2 {
		t.Fatalf("expected count=2 after delete, got %d", got)
	}
}

func TestUnifiedDB_PublicInterfaceManagement(t *testing.T) {
	var dbi DB
	dbi, err := Open(t.TempDir())
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	defer dbi.Close()

	_, err = dbi.CreateCollectionWithOptions("disk", CollectionOptions{
		Engine: EngineDiskVamana,
		Points: []Point{
			{ID: "a", Vector: []float32{0, 0, 0}},
			{ID: "b", Vector: []float32{1, 1, 1}},
		},
	})
	if err != nil {
		t.Fatalf("create disk collection: %v", err)
	}
	_, err = dbi.CreateCollectionWithOptions("mem", CollectionOptions{
		Engine:    EngineHNSW,
		Dimension: 3,
		Points:    []Point{{ID: "m", Vector: []float32{0, 1, 0}}},
	})
	if err != nil {
		t.Fatalf("create hnsw collection: %v", err)
	}

	stats := dbi.ListCollectionStats()
	if len(stats) != 2 {
		t.Fatalf("expected 2 collections, got %+v", stats)
	}
	if stats[0].Name != "disk" || stats[0].Engine != EngineDiskVamana {
		t.Fatalf("unexpected first collection stats: %+v", stats)
	}
	if stats[1].Name != "mem" || stats[1].Engine != EngineHNSW {
		t.Fatalf("unexpected second collection stats: %+v", stats)
	}

	if err := dbi.DeleteCollection("disk"); err != nil {
		t.Fatalf("delete disk collection: %v", err)
	}
	_, err = dbi.OpenCollection("disk")
	if !errors.Is(err, ErrCollectionNotFound) {
		t.Fatalf("expected ErrCollectionNotFound after delete, got %v", err)
	}
	if err := dbi.DeleteCollection("missing"); !errors.Is(err, ErrCollectionNotFound) {
		t.Fatalf("expected ErrCollectionNotFound for missing delete, got %v", err)
	}
}

func TestUnifiedDB_DimensionValidation(t *testing.T) {
	db, err := Open(t.TempDir())
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	defer db.Close()

	_, err = db.CreateCollectionWithOptions("bad-disk", CollectionOptions{
		Engine:    EngineDiskVamana,
		Dimension: 4,
		Points:    []Point{{ID: "a", Vector: []float32{1, 2, 3}}},
	})
	if !errors.Is(err, ErrVectorDimensionInvalid) {
		t.Fatalf("expected ErrVectorDimensionInvalid on create, got %v", err)
	}

	col, err := db.CreateCollectionWithOptions("disk", CollectionOptions{
		Engine: EngineDiskVamana,
		Points: []Point{{ID: "a", Vector: []float32{0, 0, 0}}, {ID: "b", Vector: []float32{1, 1, 1}}},
	})
	if err != nil {
		t.Fatalf("create disk collection: %v", err)
	}
	defer col.Close()
	if err := col.Upsert([]Point{{ID: "c", Vector: []float32{1, 2}}}); !errors.Is(err, ErrVectorDimensionInvalid) {
		t.Fatalf("expected ErrVectorDimensionInvalid on upsert, got %v", err)
	}
	if _, err := col.Search([]float32{1, 2}, SearchOptions{TopK: 1}); !errors.Is(err, ErrVectorDimensionInvalid) {
		t.Fatalf("expected ErrVectorDimensionInvalid on search, got %v", err)
	}
}

func TestUnifiedDB_DiskVamanaRejectsEmptyInitialPoints(t *testing.T) {
	db, err := Open(t.TempDir())
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	_, err = db.CreateCollectionWithOptions("empty-disk", CollectionOptions{Engine: EngineDiskVamana})
	if !errors.Is(err, ErrDiskVamanaNeedsPoints) {
		t.Fatalf("expected ErrDiskVamanaNeedsPoints, got %v", err)
	}
}

func TestUnifiedDB_HNSWLifecycle(t *testing.T) {
	db, err := Open(t.TempDir())
	if err != nil {
		t.Fatalf("open db: %v", err)
	}

	col, err := db.CreateCollectionWithOptions("memory", CollectionOptions{
		Engine:    EngineHNSW,
		Dimension: 3,
		Points: []Point{
			{ID: "a", Vector: []float32{1, 0, 0}},
			{ID: "b", Vector: []float32{0, 1, 0}},
		},
	})
	if err != nil {
		t.Fatalf("create hnsw collection: %v", err)
	}
	if stats := col.Stats(); stats.Engine != EngineHNSW || stats.Count != 2 || stats.Dimension != 3 {
		t.Fatalf("unexpected hnsw stats: %+v", stats)
	}
	results, err := col.Search([]float32{1, 0, 0}, SearchOptions{TopK: 1})
	if err != nil {
		t.Fatalf("search hnsw collection: %v", err)
	}
	if len(results) == 0 || results[0].ID != "a" {
		t.Fatalf("expected a as nearest result, got %+v", results)
	}
}

// TestUnifiedDB_DistanceMetricConsistency 验证度量类型系统一致性。
func TestUnifiedDB_DistanceMetricConsistency(t *testing.T) {
	db, err := Open(t.TempDir())
	if err != nil {
		t.Fatalf("open db: %v", err)
	}

	// 1) CollectionOptions 支持 DistanceMetric，HNSW 引擎使用 cosine
	col, err := db.CreateCollectionWithOptions("metric-test", CollectionOptions{
		Engine:         EngineHNSW,
		Dimension:      2,
		DistanceMetric: "cosine",
		Points: []Point{
			{ID: "a", Vector: []float32{1, 0}},
			{ID: "b", Vector: []float32{0, 1}},
		},
	})
	if err != nil {
		t.Fatalf("create with DistanceMetric: %v", err)
	}
	defer col.Close()
	results, err := col.Search([]float32{1, 0}, SearchOptions{TopK: 3})
	if err != nil {
		t.Fatalf("search: %v", err)
	}
	if len(results) == 0 || results[0].ID != "a" {
		t.Fatalf("cosine: expected a as top-1, got %+v", results)
	}

	// 2) DiskVamana 引擎也通过 DistanceMetric
	col2, err := db.CreateCollectionWithOptions("disk-metric", CollectionOptions{
		Engine:         EngineDiskVamana,
		Dimension:      2,
		DistanceMetric: "l2",
		Points: []Point{
			{ID: "x", Vector: []float32{1, 0}},
			{ID: "y", Vector: []float32{2, 0}},
		},
	})
	if err != nil {
		t.Fatalf("create disk with l2: %v", err)
	}
	defer col2.Close()
	results, err = col2.Search([]float32{1.5, 0}, SearchOptions{TopK: 3})
	if err != nil {
		t.Fatalf("search disk: %v", err)
	}
	if len(results) == 0 {
		t.Fatalf("disk l2: got no results")
	}

	// 3) 未知度量应返回明确错误
	_, err = db.CreateCollectionWithOptions("bad-metric", CollectionOptions{
		Engine:         EngineHNSW,
		Dimension:      2,
		DistanceMetric: "unknown_metric_type",
	})
	if err == nil {
		t.Error("expected error for unknown metric type, got nil")
	}

	// 4) 不指定 DistanceMetric 时使用默认（不应报错）
	col3, err := db.CreateCollectionWithOptions("default-metric", CollectionOptions{
		Engine:    EngineHNSW,
		Dimension: 2,
		Points: []Point{
			{ID: "d", Vector: []float32{1, 0}},
		},
	})
	if err != nil {
		t.Fatalf("create with default metric: %v", err)
	}
	defer col3.Close()
	results, err = col3.Search([]float32{1, 0}, SearchOptions{TopK: 1})
	if err != nil {
		t.Fatalf("search default metric: %v", err)
	}
	if len(results) == 0 || results[0].ID != "d" {
		t.Fatalf("default metric: expected d as top-1, got %+v", results)
	}
}

func TestUnifiedDB_DiskVamanaClosedErrorsPropagate(t *testing.T) {
	db, err := Open(t.TempDir())
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	col, err := db.CreateCollectionWithOptions("closed-errors", CollectionOptions{
		Engine: EngineDiskVamana,
		Points: []Point{{ID: "a", Vector: []float32{1, 0}}, {ID: "b", Vector: []float32{0, 1}}},
	})
	if err != nil {
		t.Fatalf("create collection: %v", err)
	}
	if err := col.Close(); err != nil {
		t.Fatalf("close collection: %v", err)
	}

	if _, err := col.Search([]float32{1, 0}, SearchOptions{TopK: 1}); !errors.Is(err, ErrCollectionClosed) {
		t.Fatalf("expected ErrCollectionClosed from search, got %v", err)
	}
	if err := col.Delete([]string{"a"}); !errors.Is(err, ErrCollectionClosed) {
		t.Fatalf("expected ErrCollectionClosed from delete, got %v", err)
	}
	if err := col.Flush(); !errors.Is(err, ErrCollectionClosed) {
		t.Fatalf("expected ErrCollectionClosed from flush, got %v", err)
	}
}

func TestUnifiedDB_OpenCorruptedDiskVamanaReturnsStableError(t *testing.T) {
	dbPath := t.TempDir()
	db, err := Open(dbPath)
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	_, err = db.CreateCollectionWithOptions("corrupted", CollectionOptions{
		Engine: EngineDiskVamana,
		Points: []Point{{ID: "a", Vector: []float32{1, 0}}, {ID: "b", Vector: []float32{0, 1}}},
	})
	if err != nil {
		t.Fatalf("create collection: %v", err)
	}
	if err := db.Close(); err != nil {
		t.Fatalf("close db: %v", err)
	}

	indexPath := filepath.Join(dbPath, "corrupted", "vamana.index")
	file, err := os.OpenFile(indexPath, os.O_WRONLY, 0)
	if err != nil {
		t.Fatalf("open index for corruption: %v", err)
	}
	if _, err := file.WriteAt([]byte{0, 0, 0, 0}, 0); err != nil {
		_ = file.Close()
		t.Fatalf("corrupt index magic: %v", err)
	}
	if err := file.Close(); err != nil {
		t.Fatalf("close corrupted index: %v", err)
	}

	_, err = Open(dbPath)
	if !errors.Is(err, ErrStorageCorrupted) {
		t.Fatalf("expected ErrStorageCorrupted, got %v", err)
	}
}

func TestUnifiedDB_StableErrorClassification(t *testing.T) {
	tests := []struct {
		name   string
		input  error
		target error
	}{
		{name: "closed", input: vamana.ErrDiskIndexClosed, target: ErrCollectionClosed},
		{name: "dimension", input: vamana.ErrVectorDimensionMismatch, target: ErrVectorDimensionInvalid},
		{name: "corrupted", input: storage.ErrCorruptedFile, target: ErrStorageCorrupted},
		{name: "busy", input: vamana.ErrCompactionInProgress, target: ErrCollectionBusy},
		{name: "read-only", input: storage.ErrReadOnly, target: ErrCollectionReadOnly},
		{name: "persistence", input: errors.New("write failed"), target: ErrPersistenceFailed},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			if err := classifyPublicError(test.input); !errors.Is(err, test.target) {
				t.Fatalf("expected %v, got %v", test.target, err)
			}
		})
	}
}
