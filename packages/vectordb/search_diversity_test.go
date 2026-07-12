package vectordb

import "testing"

func TestSearchExclusionAndGroupingAcrossEngines(t *testing.T) {
	for _, engine := range []Engine{EngineHNSW, EngineDiskVamana} {
		t.Run(string(engine), func(t *testing.T) {
			db, err := Open(t.TempDir())
			if err != nil {
				t.Fatal(err)
			}
			defer db.Close()
			meta := func(document string) []byte {
				return MarshalMeta(map[string]interface{}{"document": map[string]string{"id": document}})
			}
			collection, err := db.CreateCollectionWithOptions("diversity", CollectionOptions{
				Engine:         engine,
				DistanceMetric: "l2",
				Points: []Point{
					{ID: "a-1", Vector: []float32{0, 0, 0, 0}, Meta: meta("a")},
					{ID: "a-2", Vector: []float32{0.1, 0, 0, 0}, Meta: meta("a")},
					{ID: "b-1", Vector: []float32{0.2, 0, 0, 0}, Meta: meta("b")},
					{ID: "c-1", Vector: []float32{0.3, 0, 0, 0}, Meta: meta("c")},
				},
			})
			if err != nil {
				t.Fatal(err)
			}

			grouped, err := collection.Search([]float32{0, 0, 0, 0}, SearchOptions{
				TopK:        3,
				EfSearch:    32,
				GroupBy:     "document.id",
				MaxPerGroup: 1,
			})
			if err != nil {
				t.Fatal(err)
			}
			if len(grouped) != 3 || grouped[0].ID != "a-1" || grouped[1].ID != "b-1" || grouped[2].ID != "c-1" {
				t.Fatalf("分组多样性结果错误：%+v", grouped)
			}

			excluded, err := collection.Search([]float32{0, 0, 0, 0}, SearchOptions{
				TopK:       2,
				EfSearch:   32,
				ExcludeIDs: []string{"a-1"},
			})
			if err != nil {
				t.Fatal(err)
			}
			if len(excluded) != 2 || excluded[0].ID != "a-2" || excluded[1].ID != "b-1" {
				t.Fatalf("排除 ID 结果错误：%+v", excluded)
			}
		})
	}
}

func TestSearchGroupingTreatsMissingMetadataAsUnique(t *testing.T) {
	db, err := Open(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	collection, err := db.CreateCollectionWithOptions("missing-group", CollectionOptions{
		Engine:         EngineHNSW,
		DistanceMetric: "l2",
		Points: []Point{
			{ID: "a", Vector: []float32{0, 0}},
			{ID: "b", Vector: []float32{1, 0}},
		},
	})
	if err != nil {
		t.Fatal(err)
	}
	results, err := collection.Search([]float32{0, 0}, SearchOptions{TopK: 2, GroupBy: "document.id"})
	if err != nil || len(results) != 2 {
		t.Fatalf("缺少分组字段的结果不应互相折叠：results=%+v，err=%v", results, err)
	}
}

func TestSearchDiversityCandidateBoundaries(t *testing.T) {
	db, err := Open(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	empty, err := db.CreateCollectionWithOptions("empty", CollectionOptions{
		Engine:         EngineHNSW,
		Dimension:      2,
		DistanceMetric: "l2",
	})
	if err != nil {
		t.Fatal(err)
	}
	results, err := empty.Search([]float32{0, 0}, SearchOptions{TopK: 3, ExcludeIDs: []string{"missing"}})
	if err != nil || len(results) != 0 {
		t.Fatalf("空集合多样性搜索错误：results=%+v，err=%v", results, err)
	}

	collection, err := db.CreateCollectionWithOptions("duplicates", CollectionOptions{
		Engine:         EngineHNSW,
		DistanceMetric: "l2",
		Points: []Point{
			{ID: "a", Vector: []float32{0, 0}},
			{ID: "b", Vector: []float32{1, 0}},
			{ID: "c", Vector: []float32{2, 0}},
		},
	})
	if err != nil {
		t.Fatal(err)
	}
	results, err = collection.Search([]float32{0, 0}, SearchOptions{
		TopK:       2,
		ExcludeIDs: []string{"a", "a", "missing"},
	})
	if err != nil || len(results) != 2 || results[0].ID != "b" || results[1].ID != "c" {
		t.Fatalf("重复排除 ID 不应导致结果不足：results=%+v，err=%v", results, err)
	}
}

func TestSearchGroupingPreservesLargeIntegerKeys(t *testing.T) {
	db, err := Open(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	collection, err := db.CreateCollectionWithOptions("large-groups", CollectionOptions{
		Engine:         EngineHNSW,
		DistanceMetric: "l2",
		Points: []Point{
			{ID: "a", Vector: []float32{0, 0}, Meta: []byte(`{"group":9007199254740992}`)},
			{ID: "b", Vector: []float32{1, 0}, Meta: []byte(`{"group":9007199254740993}`)},
		},
	})
	if err != nil {
		t.Fatal(err)
	}
	results, err := collection.Search([]float32{0, 0}, SearchOptions{TopK: 2, GroupBy: "group"})
	if err != nil || len(results) != 2 {
		t.Fatalf("大整数分组键不应因浮点精度而合并：results=%+v，err=%v", results, err)
	}
}
