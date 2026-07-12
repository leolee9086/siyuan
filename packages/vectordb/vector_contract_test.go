package vectordb

import (
	"context"
	"errors"
	"math"
	"path/filepath"
	"testing"

	"s-forge.local/vectordb/bbq"
	"s-forge.local/vectordb/vamana"
)

func TestCosineVectorsAreNormalizedAcrossEngines(t *testing.T) {
	for _, engine := range []Engine{EngineHNSW, EngineDiskVamana} {
		t.Run(string(engine), func(t *testing.T) {
			db, err := Open(t.TempDir())
			if err != nil {
				t.Fatal(err)
			}
			defer db.Close()

			collection, err := db.CreateCollectionWithOptions("cosine", CollectionOptions{
				Engine:         engine,
				DistanceMetric: "cosine",
				Points: []Point{
					{ID: "direction", Vector: []float32{100, 1, 0, 0}},
					{ID: "euclidean-near", Vector: []float32{1, 1, 0, 0}},
					{ID: "opposite", Vector: []float32{-1, 0, 0, 0}},
				},
			})
			if err != nil {
				t.Fatal(err)
			}

			results, err := collection.Search([]float32{10, 0, 0, 0}, SearchOptions{TopK: 3, EfSearch: 32})
			if err != nil {
				t.Fatal(err)
			}
			if len(results) != 3 || results[0].ID != "direction" {
				t.Fatalf("cosine 排序仍受向量模长影响：%+v", results)
			}
			if results[0].Distance < 0 || results[0].Distance > 0.001 {
				t.Fatalf("cosine distance 未使用规范尺度：%f", results[0].Distance)
			}

			points, err := collection.FetchPoints([]string{"direction"})
			if err != nil || len(points) != 1 {
				t.Fatalf("读取规范向量失败：points=%+v，err=%v", points, err)
			}
			if norm := ComputeNorm(points[0].Vector); math.Abs(float64(norm-1)) > 1e-5 {
				t.Fatalf("cosine 存储向量未归一化：norm=%f", norm)
			}

			if err := collection.Upsert([]Point{{ID: "updated", Vector: []float32{0, 20, 0, 0}}}); err != nil {
				t.Fatal(err)
			}
			points, err = collection.FetchPoints([]string{"updated"})
			if err != nil || len(points) != 1 || points[0].Vector[1] != 1 {
				t.Fatalf("增量 cosine 向量未归一化：points=%+v，err=%v", points, err)
			}
		})
	}
}

func TestInvalidVectorValuesAreRejectedBeforeCommit(t *testing.T) {
	for _, engine := range []Engine{EngineHNSW, EngineDiskVamana} {
		t.Run(string(engine), func(t *testing.T) {
			db, err := Open(t.TempDir())
			if err != nil {
				t.Fatal(err)
			}
			defer db.Close()
			collection, err := db.CreateCollectionWithOptions("values", CollectionOptions{
				Engine:         engine,
				DistanceMetric: "cosine",
				Points: []Point{
					{ID: "a", Vector: []float32{1, 0, 0, 0}},
					{ID: "b", Vector: []float32{0, 1, 0, 0}},
				},
			})
			if err != nil {
				t.Fatal(err)
			}

			invalid := [][]float32{
				{0, 0, 0, 0},
				{float32(math.NaN()), 0, 0, 0},
				{float32(math.Inf(1)), 0, 0, 0},
			}
			for index, vector := range invalid {
				if err := collection.Upsert([]Point{{ID: "invalid", Vector: vector}}); !errors.Is(err, ErrVectorValueInvalid) {
					t.Fatalf("非法写入 %d 未被拒绝：%v", index, err)
				}
				if _, err := collection.Search(vector, SearchOptions{TopK: 1}); !errors.Is(err, ErrVectorValueInvalid) {
					t.Fatalf("非法查询 %d 未被拒绝：%v", index, err)
				}
			}
			if stats := collection.Stats(); stats.Count != 2 {
				t.Fatalf("非法写入改变了集合：%+v", stats)
			}
		})
	}
}

func TestL2VectorsPreserveMagnitude(t *testing.T) {
	db, err := Open(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	collection, err := db.CreateCollectionWithOptions("l2", CollectionOptions{
		Engine:         EngineHNSW,
		DistanceMetric: "l2",
		Points:         []Point{{ID: "a", Vector: []float32{3, 4}}},
	})
	if err != nil {
		t.Fatal(err)
	}
	points, err := collection.FetchPoints([]string{"a"})
	if err != nil || len(points) != 1 || points[0].Vector[0] != 3 || points[0].Vector[1] != 4 {
		t.Fatalf("L2 向量不应被归一化：points=%+v，err=%v", points, err)
	}
}

func TestCosineMetricSurvivesReopenAcrossEngines(t *testing.T) {
	for _, engine := range []Engine{EngineHNSW, EngineDiskVamana} {
		t.Run(string(engine), func(t *testing.T) {
			path := t.TempDir()
			db, err := Open(path)
			if err != nil {
				t.Fatal(err)
			}
			created, err := db.CreateCollectionWithOptions("reopen-cosine", CollectionOptions{
				Engine:         engine,
				DistanceMetric: "cosine",
				Points: []Point{
					{ID: "direction", Vector: []float32{100, 1, 0, 0}},
					{ID: "euclidean-near", Vector: []float32{1, 1, 0, 0}},
				},
			})
			if err != nil {
				t.Fatal(err)
			}
			if engine == EngineDiskVamana && !created.(*CollectionHandle).col.(*VamanaCollection).CosineNormalized {
				t.Fatal("新 DiskVamana cosine 集合必须记录归一化磁盘语义")
			}
			if err := db.Close(); err != nil {
				t.Fatal(err)
			}

			reopenedDB, err := Open(path)
			if err != nil {
				t.Fatal(err)
			}
			defer reopenedDB.Close()
			collection, err := reopenedDB.OpenCollection("reopen-cosine")
			if err != nil {
				t.Fatal(err)
			}
			if engine == EngineDiskVamana && !collection.(*CollectionHandle).col.(*VamanaCollection).CosineNormalized {
				t.Fatal("DiskVamana cosine 归一化语义未持久化")
			}
			results, err := collection.Search([]float32{5, 0, 0, 0}, SearchOptions{TopK: 2, EfSearch: 32})
			if err != nil || len(results) != 2 || results[0].ID != "direction" {
				t.Fatalf("重开后 cosine 契约丢失：results=%+v，err=%v", results, err)
			}
		})
	}
}

func TestInnerProductMetricContract(t *testing.T) {
	db, err := Open(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	collection, err := db.CreateCollectionWithOptions("ip", CollectionOptions{
		Engine:         EngineHNSW,
		DistanceMetric: "ip",
		Points: []Point{
			{ID: "maximum-dot", Vector: []float32{10, 10}},
			{ID: "euclidean-near", Vector: []float32{1, 0}},
		},
	})
	if err != nil {
		t.Fatal(err)
	}
	results, err := collection.Search([]float32{1, 0}, SearchOptions{TopK: 2, EfSearch: 32})
	if err != nil || len(results) != 2 || results[0].ID != "maximum-dot" {
		t.Fatalf("HNSW inner product 排序错误：results=%+v，err=%v", results, err)
	}
	if results[0].Distance != -10 || results[0].Score != 10 {
		t.Fatalf("inner product 距离或分数语义错误：%+v", results[0])
	}

	_, err = db.CreateCollectionWithOptions("disk-ip", CollectionOptions{
		Engine:         EngineDiskVamana,
		DistanceMetric: "ip",
		Points: []Point{
			{ID: "a", Vector: []float32{1, 0}},
			{ID: "b", Vector: []float32{0, 1}},
		},
	})
	if !errors.Is(err, ErrMetricUnsupported) {
		t.Fatalf("DiskVamana 在实现 MIPS 变换前必须拒绝 ip：%v", err)
	}

	config := vamana.DefaultDiskBuildConfig()
	config.DistanceMetric = bbq.MaxInnerProduct
	_, err = BuildVamanaCollection("direct-disk-ip", []Point{
		{ID: "a", Vector: []float32{1, 0}},
		{ID: "b", Vector: []float32{0, 1}},
	}, filepath.Join(t.TempDir(), "index"), config, CollectionMeta{})
	if !errors.Is(err, ErrMetricUnsupported) {
		t.Fatalf("直接构建 DiskVamana 也必须拒绝 ip：%v", err)
	}
}

func TestDiskVamanaLegacyCosineVectorsRemainCorrect(t *testing.T) {
	ensureDiskVamanaReader()
	basePath := filepath.Join(t.TempDir(), "legacy-cosine")
	vectors := [][]float32{
		{100, 1, 0, 0},
		{1, 1, 0, 0},
		{-1, 0, 0, 0},
	}
	config := vamana.DefaultDiskBuildConfig()
	config.DistanceMetric = bbq.CosineSimilarity
	config.R = 2
	config.L = 8
	if _, err := vamana.BuildFromVectors(basePath, vectors, config); err != nil {
		t.Fatal(err)
	}
	index, err := vamana.Open(basePath)
	if err != nil {
		t.Fatal(err)
	}
	legacy := NewVamanaCollection("legacy-cosine", 4, index, CollectionMeta{})
	legacy.RootPath = basePath
	legacy.BasePath = basePath
	legacy.Config = config
	legacy.IDMap = map[string]uint64{"direction": 0, "euclidean-near": 1, "opposite": 2}
	legacy.DocMap = map[uint64]string{0: "direction", 1: "euclidean-near", 2: "opposite"}
	if err := SaveVamanaCollectionState(legacy, basePath); err != nil {
		t.Fatal(err)
	}
	if err := legacy.Close(); err != nil {
		t.Fatal(err)
	}

	reopened, err := OpenVamanaCollection("legacy-cosine", basePath, CollectionMeta{})
	if err != nil {
		t.Fatal(err)
	}
	results, err := reopened.SearchWithError([]float32{1, 0, 0, 0}, 3, 16)
	if err != nil {
		t.Fatal(err)
	}
	if len(results) != 3 || results[0].ID != "direction" {
		t.Fatalf("旧 cosine 集合重开后排序受模长影响：%+v", results)
	}
	if err := reopened.InsertPoint(Point{ID: "new", Vector: []float32{0, 10, 0, 0}}); err != nil {
		t.Fatal(err)
	}
	if _, err := reopened.Checkpoint(context.Background()); err != nil {
		t.Fatal(err)
	}
	if reopened.CosineNormalized {
		t.Fatal("包含旧原始向量的 checkpoint 不得错误标记为已归一化")
	}
	if err := reopened.Close(); err != nil {
		t.Fatal(err)
	}
	reopenedAgain, err := OpenVamanaCollection("legacy-cosine", basePath, CollectionMeta{})
	if err != nil {
		t.Fatal(err)
	}
	defer reopenedAgain.Close()
	results, err = reopenedAgain.SearchWithError([]float32{1, 0, 0, 0}, 4, 16)
	if err != nil || len(results) != 4 || results[0].ID != "direction" {
		t.Fatalf("旧 cosine 集合 checkpoint 后兼容语义丢失：results=%+v，err=%v", results, err)
	}
}
