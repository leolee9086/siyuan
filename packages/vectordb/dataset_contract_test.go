package vectordb

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"testing"
)

func datasetContractOptions() DatasetOptions {
	return DatasetOptions{
		Embeddings: map[string]EmbeddingSchema{
			"title": {Dimension: 2, DistanceMetric: "cosine"},
			"body":  {Dimension: 3, DistanceMetric: "l2"},
		},
		Indexes: map[string]IndexViewOptions{
			"title-fast":   {Embedding: "title", Engine: EngineHNSW},
			"title-second": {Embedding: "title", Engine: EngineHNSW},
			"body-main":    {Embedding: "body", Engine: EngineHNSW},
		},
		Entities: []Entity{
			{
				ID: "title-only",
				Embeddings: map[string][]float32{
					"title": {1, 0},
				},
				Meta: MarshalMeta(map[string]any{"kind": "note", "label": "title-only"}),
			},
			{
				ID: "consensus",
				Embeddings: map[string][]float32{
					"title": {0.8, 0.2},
					"body":  {0.2, 0, 0},
				},
				Meta: MarshalMeta(map[string]any{"kind": "note", "label": "consensus"}),
			},
			{
				ID: "body-only",
				Embeddings: map[string][]float32{
					"body": {0, 0, 0},
				},
				Meta: MarshalMeta(map[string]any{"kind": "code", "label": "body-only"}),
			},
			{
				ID: "far",
				Embeddings: map[string][]float32{
					"title": {0, 1},
					"body":  {10, 10, 10},
				},
				Meta: MarshalMeta(map[string]any{"kind": "note", "label": "far"}),
			},
		},
	}
}

func TestDatasetSupportsNamedEmbeddingsAndMultipleIndexViews(t *testing.T) {
	db, err := Open(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	dataset, err := db.CreateDataset("documents", datasetContractOptions())
	if err != nil {
		t.Fatal(err)
	}

	for _, indexName := range []string{"title-fast", "title-second"} {
		results, searchErr := dataset.SearchIndex(indexName, []float32{1, 0}, SearchOptions{TopK: 2, EfSearch: 32})
		if searchErr != nil {
			t.Fatalf("索引 %q 查询失败：%v", indexName, searchErr)
		}
		if len(results) != 2 || results[0].ID != "title-only" || results[1].ID != "consensus" {
			t.Fatalf("索引 %q 未独立查询同一 title 嵌入：%+v", indexName, results)
		}
		if string(results[0].Meta) == "" {
			t.Fatalf("索引 %q 未返回实体级 meta", indexName)
		}
	}

	bodyResults, err := dataset.SearchIndex("body-main", []float32{0, 0, 0}, SearchOptions{TopK: 2, EfSearch: 32})
	if err != nil {
		t.Fatal(err)
	}
	if len(bodyResults) != 2 || bodyResults[0].ID != "body-only" || bodyResults[1].ID != "consensus" {
		t.Fatalf("body 嵌入查询结果错误：%+v", bodyResults)
	}
	grouped, err := dataset.SearchIndex("body-main", []float32{0, 0, 0}, SearchOptions{TopK: 3, GroupBy: "kind", MaxPerGroup: 1})
	if err != nil {
		t.Fatal(err)
	}
	if len(grouped) != 2 || grouped[0].ID != "body-only" || grouped[1].ID != "consensus" {
		t.Fatalf("数据集查询未使用实体级 meta 分组：%+v", grouped)
	}
}

func TestDatasetRRFUsesEntityIdentityWeightsAndSourceDetails(t *testing.T) {
	db, err := Open(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	dataset, err := db.CreateDataset("documents", datasetContractOptions())
	if err != nil {
		t.Fatal(err)
	}

	request := FusionSearchRequest{
		TopK: 3,
		Queries: []FusionQuery{
			{Index: "title-fast", Vector: []float32{1, 0}, Options: SearchOptions{TopK: 3, EfSearch: 32}},
			{Index: "body-main", Vector: []float32{0, 0, 0}, Options: SearchOptions{TopK: 3, EfSearch: 32}},
		},
	}
	response, err := dataset.SearchFusion(context.Background(), request)
	if err != nil {
		t.Fatal(err)
	}
	if len(response.Results) != 3 || response.Results[0].ID != "consensus" {
		t.Fatalf("RRF 未提升多路一致实体：%+v", response.Results)
	}
	if len(response.Results[0].Sources) != 2 {
		t.Fatalf("RRF 未保留两路来源明细：%+v", response.Results[0])
	}
	if response.Results[0].Sources[0].Rank < 1 || response.Results[0].Sources[0].Index == "" {
		t.Fatalf("来源明细缺少 rank 或索引名：%+v", response.Results[0].Sources)
	}

	request.Queries[0].Weight = 100
	weighted, err := dataset.SearchFusion(context.Background(), request)
	if err != nil {
		t.Fatal(err)
	}
	if len(weighted.Results) == 0 || weighted.Results[0].ID != "title-only" {
		t.Fatalf("RRF 权重未生效：%+v", weighted.Results)
	}
}

func TestDatasetFusionFailurePolicyIsExplicit(t *testing.T) {
	db, err := Open(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	dataset, err := db.CreateDataset("documents", datasetContractOptions())
	if err != nil {
		t.Fatal(err)
	}

	request := FusionSearchRequest{
		TopK: 2,
		Queries: []FusionQuery{
			{Index: "title-fast", Vector: []float32{1, 0}, Options: SearchOptions{TopK: 2}},
			{Index: "body-main", Vector: []float32{0, 0}, Options: SearchOptions{TopK: 2}},
		},
	}
	if _, err := dataset.SearchFusion(context.Background(), request); !errors.Is(err, ErrVectorDimensionInvalid) {
		t.Fatalf("默认策略应整体报告失败来源：%v", err)
	}

	request.AllowPartial = true
	response, err := dataset.SearchFusion(context.Background(), request)
	if err != nil {
		t.Fatalf("AllowPartial 不应返回整体错误：%v", err)
	}
	if len(response.Results) == 0 || len(response.Failures) != 1 || response.Failures[0].Index != "body-main" {
		t.Fatalf("部分结果或失败明细错误：%+v", response)
	}
}

func TestDatasetSchemaViewsAndRRFRemainUsableAfterRestart(t *testing.T) {
	path := t.TempDir()
	db, err := Open(path)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := db.CreateDataset("documents", datasetContractOptions()); err != nil {
		t.Fatal(err)
	}
	if err := db.Close(); err != nil {
		t.Fatal(err)
	}

	db, err = Open(path)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	dataset, err := db.OpenDataset("documents")
	if err != nil {
		t.Fatal(err)
	}
	response, err := dataset.SearchFusion(context.Background(), FusionSearchRequest{
		TopK: 1,
		Queries: []FusionQuery{
			{Index: "title-second", Vector: []float32{1, 0}, Options: SearchOptions{TopK: 3}},
			{Index: "body-main", Vector: []float32{0, 0, 0}, Options: SearchOptions{TopK: 3}},
		},
	})
	if err != nil {
		t.Fatal(err)
	}
	if len(response.Results) != 1 || response.Results[0].ID != "consensus" || len(response.Results[0].Meta) == 0 {
		t.Fatalf("重启后数据集契约丢失：%+v", response.Results)
	}
}

func TestDatasetEntityReplacementUpdatesEveryIndexView(t *testing.T) {
	db, err := Open(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	datasetAPI, err := db.CreateDataset("documents", datasetContractOptions())
	if err != nil {
		t.Fatal(err)
	}
	dataset := datasetAPI.(*Dataset)

	write, err := dataset.UpsertEntities(context.Background(), []Entity{{
		ID: "consensus",
		Embeddings: map[string][]float32{
			"title": {-1, 0},
		},
		Meta: MarshalMeta(map[string]any{"label": "replaced"}),
	}}, WriteOptions{Durability: DurabilitySync})
	if err != nil || !write.Committed || write.Applied != 1 {
		t.Fatalf("实体替换失败：result=%+v，err=%v", write, err)
	}
	for _, index := range []string{"title-fast", "title-second"} {
		results, err := dataset.SearchIndex(index, []float32{-1, 0}, SearchOptions{TopK: 1})
		if err != nil || len(results) != 1 || results[0].ID != "consensus" {
			t.Fatalf("索引 %q 未同步实体替换：results=%+v，err=%v", index, results, err)
		}
	}
	body, err := dataset.SearchIndex("body-main", []float32{0.2, 0, 0}, SearchOptions{TopK: 4})
	if err != nil {
		t.Fatal(err)
	}
	for _, result := range body {
		if result.ID == "consensus" {
			t.Fatalf("替换时缺失的 body 嵌入仍留在索引中：%+v", body)
		}
	}

	deleted, err := dataset.DeleteEntities(context.Background(), []string{"consensus"}, WriteOptions{Durability: DurabilitySync})
	if err != nil || !deleted.Committed {
		t.Fatalf("删除实体失败：result=%+v，err=%v", deleted, err)
	}
	entities, err := dataset.FetchEntities([]string{"consensus"})
	if err != nil || len(entities) != 0 {
		t.Fatalf("删除后仍可获取实体：entities=%+v，err=%v", entities, err)
	}
}

func TestDatasetCanAddAnotherANNViewAndReopenIt(t *testing.T) {
	path := t.TempDir()
	db, err := Open(path)
	if err != nil {
		t.Fatal(err)
	}
	datasetAPI, err := db.CreateDataset("documents", datasetContractOptions())
	if err != nil {
		t.Fatal(err)
	}
	dataset := datasetAPI.(*Dataset)
	if err := dataset.AddIndex("title-third", IndexViewOptions{Embedding: "title", Engine: EngineHNSW}); err != nil {
		t.Fatal(err)
	}
	results, err := dataset.SearchIndex("title-third", []float32{1, 0}, SearchOptions{TopK: 2})
	if err != nil || len(results) != 2 || results[0].ID != "title-only" {
		t.Fatalf("新增视图不可查询：results=%+v，err=%v", results, err)
	}
	if err := db.Close(); err != nil {
		t.Fatal(err)
	}

	db, err = Open(path)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	datasetAPI, err = db.OpenDataset("documents")
	if err != nil {
		t.Fatal(err)
	}
	stats := datasetAPI.Stats()
	if stats.EntityCount != 4 || stats.Indexes["title-third"].Embedding != "title" || stats.Embeddings["body"].Dimension != 3 {
		t.Fatalf("重启后 schema 或视图 introspection 错误：%+v", stats)
	}
	results, err = datasetAPI.SearchIndex("title-third", []float32{1, 0}, SearchOptions{TopK: 1})
	if err != nil || len(results) != 1 || results[0].ID != "title-only" {
		t.Fatalf("重启后新增视图不可查询：results=%+v，err=%v", results, err)
	}
}

func TestDatasetCanAddDiskVamanaViewThroughPublicAPI(t *testing.T) {
	db, err := Open(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	dataset, err := db.CreateDataset("documents", datasetContractOptions())
	if err != nil {
		t.Fatal(err)
	}
	if err := dataset.AddIndex("title-disk", IndexViewOptions{Embedding: "title", Engine: EngineDiskVamana}); err != nil {
		t.Fatal(err)
	}
	results, err := dataset.SearchIndex("title-disk", []float32{1, 0}, SearchOptions{TopK: 2, EfSearch: 32})
	if err != nil || len(results) != 2 || results[0].ID != "title-only" {
		t.Fatalf("DiskVamana 视图不可查询：results=%+v，err=%v", results, err)
	}
}

func TestDatasetReplaysPendingCrossIndexTransactionOnOpen(t *testing.T) {
	path := t.TempDir()
	db, err := Open(path)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := db.CreateDataset("documents", datasetContractOptions()); err != nil {
		t.Fatal(err)
	}
	if err := db.Close(); err != nil {
		t.Fatal(err)
	}

	datasetPath := filepath.Join(path, datasetsDirectoryName, datasetPhysicalName("documents"))
	transaction := datasetTransaction{Upserts: []Entity{{
		ID: "recovered",
		Embeddings: map[string][]float32{
			"title": {-1, 0},
			"body":  {-1, -1, -1},
		},
		Meta: MarshalMeta(map[string]any{"label": "recovered"}),
	}}}
	if err := saveDatasetTransaction(datasetPath, transaction); err != nil {
		t.Fatal(err)
	}

	db, err = Open(path)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	dataset, err := db.OpenDataset("documents")
	if err != nil {
		t.Fatal(err)
	}
	for _, index := range []string{"title-fast", "title-second"} {
		results, err := dataset.SearchIndex(index, []float32{-1, 0}, SearchOptions{TopK: 1})
		if err != nil || len(results) != 1 || results[0].ID != "recovered" {
			t.Fatalf("索引 %q 未重放事务：results=%+v，err=%v", index, results, err)
		}
	}
	if _, err := os.Stat(filepath.Join(datasetPath, datasetTransactionName)); !os.IsNotExist(err) {
		t.Fatalf("成功恢复后事务意图未清理：%v", err)
	}
}

func TestDeleteDatasetDoesNotResurrectOnRestart(t *testing.T) {
	path := t.TempDir()
	db, err := Open(path)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := db.CreateDataset("documents", datasetContractOptions()); err != nil {
		t.Fatal(err)
	}
	if err := db.DeleteDataset("documents"); err != nil {
		t.Fatal(err)
	}
	if _, err := db.OpenDataset("documents"); !errors.Is(err, ErrDatasetNotFound) {
		t.Fatalf("删除后仍可打开数据集：%v", err)
	}
	if err := db.Close(); err != nil {
		t.Fatal(err)
	}

	db, err = Open(path)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	if _, err := db.OpenDataset("documents"); !errors.Is(err, ErrDatasetNotFound) {
		t.Fatalf("重启后数据集复活：%v", err)
	}
}

func TestDatasetBlocksSearchUntilFailedTransactionIsRecovered(t *testing.T) {
	db, err := Open(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	dataset, err := db.CreateDataset("documents", datasetContractOptions())
	if err != nil {
		t.Fatal(err)
	}

	originalPersist := persistWriteCollection
	defer func() { persistWriteCollection = originalPersist }()
	persistWriteCollection = func(handle *CollectionHandle, operations []WriteOperation, sequence uint64) error {
		if handle.Name() == indexPhysicalName("body-main") {
			return errors.New("injected view persistence failure")
		}
		return originalPersist(handle, operations, sequence)
	}
	_, writeErr := dataset.UpsertEntities(context.Background(), []Entity{{
		ID: "pending",
		Embeddings: map[string][]float32{
			"title": {-1, 0},
			"body":  {-1, -1, -1},
		},
	}}, WriteOptions{Durability: DurabilitySync})
	persistWriteCollection = originalPersist
	if writeErr == nil {
		t.Fatal("故障注入未使数据集事务失败")
	}
	if _, err := dataset.SearchIndex("title-fast", []float32{-1, 0}, SearchOptions{TopK: 1}); !errors.Is(err, ErrIndexRecoveryRequired) {
		t.Fatalf("部分提交后查询未被阻断：%v", err)
	}

	result, err := dataset.UpsertEntities(context.Background(), []Entity{{
		ID: "after-recovery",
		Embeddings: map[string][]float32{
			"title": {0, -1},
			"body":  {-2, -2, -2},
		},
	}}, WriteOptions{Durability: DurabilitySync})
	if err != nil || !result.Committed {
		t.Fatalf("待提交事务无法重放后继续写入：result=%+v，err=%v", result, err)
	}
	if _, err := dataset.SearchIndex("title-fast", []float32{0, -1}, SearchOptions{TopK: 1}); err != nil {
		t.Fatalf("恢复后查询仍被阻断：%v", err)
	}
}

func TestDatasetOpenFailureReleasesPreviouslyOpenedDatasetLocks(t *testing.T) {
	path := t.TempDir()
	db, err := Open(path)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := db.CreateDataset("a", datasetContractOptions()); err != nil {
		t.Fatal(err)
	}
	if _, err := db.CreateDataset("z", datasetContractOptions()); err != nil {
		t.Fatal(err)
	}
	if err := db.Close(); err != nil {
		t.Fatal(err)
	}

	corruptedPath := filepath.Join(path, datasetsDirectoryName, datasetPhysicalName("z"))
	if err := os.WriteFile(filepath.Join(corruptedPath, datasetManifestName), []byte("corrupted"), 0644); err != nil {
		t.Fatal(err)
	}
	if failedDB, err := Open(path); err == nil {
		_ = failedDB.Close()
		t.Fatal("损坏的数据集 manifest 未使打开失败")
	}
	if err := os.RemoveAll(corruptedPath); err != nil {
		t.Fatal(err)
	}

	db, err = Open(path)
	if err != nil {
		t.Fatalf("打开失败未释放此前数据集锁：%v", err)
	}
	defer db.Close()
	if _, err := db.OpenDataset("a"); err != nil {
		t.Fatalf("有效数据集无法重新打开：%v", err)
	}
}
