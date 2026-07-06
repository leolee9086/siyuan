package vectordb

import (
	"encoding/json"
	"errors"
	"testing"
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
