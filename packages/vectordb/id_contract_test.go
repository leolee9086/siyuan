package vectordb

import (
	"errors"
	"testing"
)

func TestHNSWPointIDContractAndFreeIDRecovery(t *testing.T) {
	collection := NewCollectionWithMetric("ids", 4, "l2")
	if err := collection.InsertPoint(Point{Vector: []float32{1, 2, 3, 4}}); !errors.Is(err, ErrPointIDInvalid) {
		t.Fatalf("空 ID 必须被拒绝：%v", err)
	}
	if err := collection.InsertPoint(Point{ID: "wrong-dimension", Vector: []float32{1, 2}}); !errors.Is(err, ErrVectorDimensionInvalid) {
		t.Fatalf("错误维度必须被拒绝：%v", err)
	}

	for _, id := range []string{"a", "b", "c"} {
		if err := collection.InsertPoint(Point{ID: id, Vector: []float32{1, 2, 3, 4}}); err != nil {
			t.Fatal(err)
		}
	}
	if err := collection.DeletePointWithError("b"); err != nil {
		t.Fatal(err)
	}
	if len(collection.freeDocIDs) != 1 || collection.freeDocIDs[0] != 1 {
		t.Fatalf("删除节点未登记可复用 ID：%v", collection.freeDocIDs)
	}

	basePath := t.TempDir()
	if err := SaveCollection(collection, basePath); err != nil {
		t.Fatal(err)
	}
	reopened, err := LoadCollection(basePath, collection.ColName)
	if err != nil {
		t.Fatal(err)
	}
	if len(reopened.freeDocIDs) != 1 || reopened.freeDocIDs[0] != 1 {
		t.Fatalf("重开后未恢复可复用 ID：%v", reopened.freeDocIDs)
	}
	if err := reopened.InsertPoint(Point{ID: "d", Vector: []float32{4, 3, 2, 1}}); err != nil {
		t.Fatal(err)
	}
	if docID := reopened.IDMap["d"]; docID != 1 {
		t.Fatalf("新节点未复用删除空洞：%d", docID)
	}
}

func TestInitialPointsUseLastWriteWinsAcrossEngines(t *testing.T) {
	for _, engine := range []Engine{EngineHNSW, EngineDiskVamana} {
		t.Run(string(engine), func(t *testing.T) {
			db, err := Open(t.TempDir())
			if err != nil {
				t.Fatal(err)
			}
			defer db.Close()

			points := []Point{
				{ID: "a", Vector: []float32{0, 0, 0, 0}},
				{ID: "b", Vector: []float32{2, 2, 2, 2}},
				{ID: "a", Vector: []float32{1, 1, 1, 1}},
				{ID: "c", Vector: []float32{3, 3, 3, 3}},
			}
			collection, err := db.CreateCollectionWithOptions("deduplicated", CollectionOptions{Engine: engine, Points: points})
			if err != nil {
				t.Fatal(err)
			}
			if stats := collection.Stats(); stats.Count != 3 || stats.TotalCount != 3 {
				t.Fatalf("初始重复 ID 未按最后写入归一化：%+v", stats)
			}
			fetched, err := collection.FetchPoints([]string{"a"})
			if err != nil || len(fetched) != 1 || fetched[0].Vector[0] != 1 {
				t.Fatalf("重复 ID 的最终值错误：points=%+v，err=%v", fetched, err)
			}
		})
	}
}

func TestInitialPointsRejectEmptyIDAcrossEngines(t *testing.T) {
	for _, engine := range []Engine{EngineHNSW, EngineDiskVamana} {
		t.Run(string(engine), func(t *testing.T) {
			db, err := Open(t.TempDir())
			if err != nil {
				t.Fatal(err)
			}
			defer db.Close()
			_, err = db.CreateCollectionWithOptions("invalid-id", CollectionOptions{
				Engine: engine,
				Points: []Point{{Vector: []float32{1, 2, 3, 4}}},
			})
			if !errors.Is(err, ErrPointIDInvalid) {
				t.Fatalf("空 ID 必须返回 ErrPointIDInvalid：%v", err)
			}
		})
	}
}
