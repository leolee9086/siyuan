package vectordb

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/vmihailenco/msgpack/v5"
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
	failedResult, writeErr := dataset.UpsertEntities(context.Background(), []Entity{{
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
	if !failedResult.Committed || failedResult.IndexHealthy || failedResult.CommitSequence == 0 || !errors.Is(writeErr, ErrIndexRecoveryRequired) {
		t.Fatalf("跨视图失败事务结果未表达已提交但不健康：result=%+v，err=%v", failedResult, writeErr)
	}
	stats := db.ListDatasetStats()
	if len(stats) != 1 || !stats[0].RecoveryRequired || stats[0].CommitSequence != failedResult.CommitSequence-1 {
		t.Fatalf("事务恢复健康状态未暴露：%+v", stats)
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

func TestDatasetMetadataUpdatesUseWALUntilCheckpoint(t *testing.T) {
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
	statePath := filepath.Join(dataset.path, datasetStateName)
	before, err := os.ReadFile(statePath)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := dataset.UpsertEntities(context.Background(), []Entity{{
		ID: "consensus",
		Embeddings: map[string][]float32{
			"title": {0.9, 0.1},
			"body":  {0.1, 0, 0},
		},
		Meta: MarshalMeta(map[string]any{"label": "wal-update"}),
	}}, WriteOptions{Durability: DurabilitySync}); err != nil {
		t.Fatal(err)
	}
	after, err := os.ReadFile(statePath)
	if err != nil {
		t.Fatal(err)
	}
	if string(before) != string(after) {
		t.Fatal("单实体更新不应重写完整 entities.msgpack 快照")
	}
	walPath := filepath.Join(dataset.path, datasetMetaWALName)
	if info, err := os.Stat(walPath); err != nil || info.Size() == 0 {
		t.Fatalf("单实体更新未追加 metadata WAL：info=%v，err=%v", info, err)
	}
	if err := dataset.Checkpoint(context.Background()); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(walPath); !os.IsNotExist(err) {
		t.Fatalf("checkpoint 后 metadata WAL 未回收：%v", err)
	}
	checkpointed, err := os.ReadFile(statePath)
	if err != nil {
		t.Fatal(err)
	}
	if string(checkpointed) == string(before) {
		t.Fatal("checkpoint 未发布最新 meta 快照")
	}
	if err := db.Close(); err != nil {
		t.Fatal(err)
	}

	db, err = Open(path)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	reopened, err := db.OpenDataset("documents")
	if err != nil {
		t.Fatal(err)
	}
	results, err := reopened.SearchIndex("title-fast", []float32{0.9, 0.1}, SearchOptions{TopK: 1})
	if err != nil || len(results) != 1 || !bytes.Contains(results[0].Meta, []byte("wal-update")) {
		t.Fatalf("checkpoint 后 meta 未恢复：results=%+v，err=%v", results, err)
	}
}

func TestDatasetAddIndexKeepsSearchesAvailableAndQueuesWrites(t *testing.T) {
	db, err := Open(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	dataset, err := db.CreateDataset("documents", datasetContractOptions())
	if err != nil {
		t.Fatal(err)
	}

	originalHook := datasetIndexBuildHook
	started := make(chan struct{})
	release := make(chan struct{})
	datasetIndexBuildHook = func() {
		close(started)
		<-release
	}
	defer func() { datasetIndexBuildHook = originalHook }()
	addDone := make(chan error, 1)
	go func() {
		addDone <- dataset.AddIndex("title-online", IndexViewOptions{Embedding: "title", Engine: EngineHNSW})
	}()
	<-started
	cancelled, cancel := context.WithCancel(context.Background())
	cancel()
	if _, err := dataset.UpsertEntities(cancelled, []Entity{{
		ID: "cancelled-write",
		Embeddings: map[string][]float32{
			"title": {-1, 0},
			"body":  {-1, -1, -1},
		},
	}}, WriteOptions{Durability: DurabilitySync}); !errors.Is(err, context.Canceled) {
		close(release)
		t.Fatalf("索引构建期间已取消的写入未及时返回 context.Canceled：%v", err)
	}

	searchDone := make(chan error, 1)
	go func() {
		results, searchErr := dataset.SearchIndex("title-fast", []float32{1, 0}, SearchOptions{TopK: 1})
		if searchErr == nil && (len(results) != 1 || results[0].ID != "title-only") {
			searchErr = errors.New("existing index returned an unexpected result")
		}
		searchDone <- searchErr
	}()
	select {
	case err := <-searchDone:
		if err != nil {
			close(release)
			t.Fatal(err)
		}
	case <-time.After(time.Second):
		close(release)
		t.Fatal("动态索引构建阻塞了已有索引查询")
	}

	writeDone := make(chan error, 1)
	go func() {
		_, writeErr := dataset.UpsertEntities(context.Background(), []Entity{{
			ID: "queued-write",
			Embeddings: map[string][]float32{
				"title": {-1, 0},
				"body":  {-1, -1, -1},
			},
		}}, WriteOptions{Durability: DurabilitySync})
		writeDone <- writeErr
	}()
	select {
	case err := <-writeDone:
		close(release)
		t.Fatalf("索引构建发布前写入不应越过一致性屏障：%v", err)
	case <-time.After(50 * time.Millisecond):
	}
	close(release)
	if err := <-addDone; err != nil {
		t.Fatal(err)
	}
	if err := <-writeDone; err != nil {
		t.Fatal(err)
	}
	results, err := dataset.SearchIndex("title-online", []float32{-1, 0}, SearchOptions{TopK: 1})
	if err != nil || len(results) != 1 || results[0].ID != "queued-write" {
		t.Fatalf("排队写入未同步到新索引：results=%+v，err=%v", results, err)
	}
}

func TestDatasetMetadataWALTornTailIsTruncated(t *testing.T) {
	path := t.TempDir()
	if err := appendDatasetMetaWAL(path, 1, []Entity{{ID: "entity", Meta: MarshalMeta(map[string]any{"version": 1})}}, nil); err != nil {
		t.Fatal(err)
	}
	walPath := filepath.Join(path, datasetMetaWALName)
	validInfo, err := os.Stat(walPath)
	if err != nil {
		t.Fatal(err)
	}
	file, err := os.OpenFile(walPath, os.O_APPEND|os.O_WRONLY, 0644)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := file.Write([]byte{1, 2, 3, 4, 5}); err != nil {
		_ = file.Close()
		t.Fatal(err)
	}
	if err := file.Close(); err != nil {
		t.Fatal(err)
	}
	sequence := uint64(0)
	metas := make(map[string]json.RawMessage)
	if err := replayDatasetMetaWAL(path, &sequence, metas); err != nil {
		t.Fatal(err)
	}
	if sequence != 1 || !bytes.Contains(metas["entity"], []byte("version")) {
		t.Fatalf("撕裂尾截断后已同步记录丢失：sequence=%d，metas=%v", sequence, metas)
	}
	afterInfo, err := os.Stat(walPath)
	if err != nil {
		t.Fatal(err)
	}
	if afterInfo.Size() != validInfo.Size() {
		t.Fatalf("撕裂尾未截断到最后完整帧：want=%d，got=%d", validInfo.Size(), afterInfo.Size())
	}
}

func TestDatasetMetadataWALRejectsCorruptionAndSequenceGaps(t *testing.T) {
	t.Run("checksum", func(t *testing.T) {
		path := t.TempDir()
		if err := appendDatasetMetaWAL(path, 1, []Entity{{ID: "entity", Meta: MarshalMeta(map[string]any{"version": 1})}}, nil); err != nil {
			t.Fatal(err)
		}
		walPath := filepath.Join(path, datasetMetaWALName)
		data, err := os.ReadFile(walPath)
		if err != nil {
			t.Fatal(err)
		}
		data[len(data)-1] ^= 0xff
		if err := os.WriteFile(walPath, data, 0644); err != nil {
			t.Fatal(err)
		}
		sequence := uint64(0)
		err = replayDatasetMetaWAL(path, &sequence, make(map[string]json.RawMessage))
		if !errors.Is(err, ErrStorageCorrupted) {
			t.Fatalf("完整 WAL 帧损坏未被拒绝：%v", err)
		}
	})

	t.Run("sequence-gap", func(t *testing.T) {
		path := t.TempDir()
		if err := appendDatasetMetaWAL(path, 2, []Entity{{ID: "entity"}}, nil); err != nil {
			t.Fatal(err)
		}
		sequence := uint64(0)
		err := replayDatasetMetaWAL(path, &sequence, make(map[string]json.RawMessage))
		if !errors.Is(err, ErrStorageCorrupted) {
			t.Fatalf("WAL 序号缺口未被拒绝：%v", err)
		}
	})
}

func TestDatasetMetadataWALAutomaticallyCheckpointsAtLimit(t *testing.T) {
	path := t.TempDir()
	db, err := Open(path)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	datasetAPI, err := db.CreateDataset("documents", datasetContractOptions())
	if err != nil {
		t.Fatal(err)
	}
	dataset := datasetAPI.(*Dataset)
	originalThreshold := datasetMetaWALCheckpointBytes
	datasetMetaWALCheckpointBytes = 1
	defer func() { datasetMetaWALCheckpointBytes = originalThreshold }()
	if _, err := dataset.UpsertEntities(context.Background(), []Entity{{
		ID: "auto-checkpoint",
		Embeddings: map[string][]float32{
			"title": {-1, 0},
			"body":  {-1, -1, -1},
		},
		Meta: MarshalMeta(map[string]any{"checkpoint": true}),
	}}, WriteOptions{Durability: DurabilitySync}); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(filepath.Join(dataset.path, datasetMetaWALName)); !os.IsNotExist(err) {
		t.Fatalf("达到阈值后 metadata WAL 未被回收：%v", err)
	}
	data, err := os.ReadFile(filepath.Join(dataset.path, datasetStateName))
	if err != nil {
		t.Fatal(err)
	}
	var state datasetState
	if err := msgpack.Unmarshal(data, &state); err != nil {
		t.Fatal(err)
	}
	if state.Sequence != 1 || !bytes.Contains(state.Metas["auto-checkpoint"], []byte("checkpoint")) {
		t.Fatalf("自动 checkpoint 快照不完整：sequence=%d，metas=%v", state.Sequence, state.Metas)
	}
}

func TestDatasetAddIndexReplacesUnpublishedPhysicalOrphan(t *testing.T) {
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
	physicalName := indexPhysicalName("title-clean")
	if _, err := dataset.indexDB.CreateCollectionWithOptions(physicalName, CollectionOptions{
		Engine: EngineHNSW, Dimension: 2, DistanceMetric: "cosine",
		Points: []Point{{ID: "stale-orphan", Vector: []float32{-1, 0}}},
	}); err != nil {
		t.Fatal(err)
	}
	if err := dataset.AddIndex("title-clean", IndexViewOptions{Embedding: "title", Engine: EngineHNSW}); err != nil {
		t.Fatal(err)
	}
	results, err := dataset.SearchIndex("title-clean", []float32{-1, 0}, SearchOptions{TopK: 10})
	if err != nil {
		t.Fatal(err)
	}
	for _, result := range results {
		if result.ID == "stale-orphan" {
			t.Fatalf("同名重建复用了未发布 orphan 的陈旧 ID：%+v", results)
		}
	}
}

func TestDatasetRestartRecoverySkipsAppliedHNSWAndDiskVamanaViews(t *testing.T) {
	path := t.TempDir()
	db, err := Open(path)
	if err != nil {
		t.Fatal(err)
	}
	options := datasetContractOptions()
	options.Indexes["title-second"] = IndexViewOptions{Embedding: "title", Engine: EngineDiskVamana}
	datasetAPI, err := db.CreateDataset("documents", options)
	if err != nil {
		t.Fatal(err)
	}
	dataset := datasetAPI.(*Dataset)
	entity := Entity{ID: "wal-applied", Embeddings: map[string][]float32{"title": {-1, 0}, "body": {-1, -1, -1}}, Meta: MarshalMeta(map[string]any{"recovered": true})}
	titlePoint := Point{ID: entity.ID, Vector: entity.Embeddings["title"]}
	for _, indexName := range []string{"title-fast", "title-second"} {
		if _, err := dataset.handles[indexName].Write(context.Background(), WriteBatch{Operations: []WriteOperation{{Point: &titlePoint}}}, WriteOptions{Durability: DurabilitySync}); err != nil {
			t.Fatalf("预应用视图 %q：%v", indexName, err)
		}
	}
	if err := saveDatasetTransaction(dataset.path, datasetTransaction{Sequence: 1, Upserts: []Entity{entity}}); err != nil {
		t.Fatal(err)
	}
	if err := db.Close(); err != nil {
		t.Fatal(err)
	}
	originalPersist := persistWriteCollection
	defer func() { persistWriteCollection = originalPersist }()
	persistCalls := make(map[string]int)
	persistWriteCollection = func(handle *CollectionHandle, operations []WriteOperation, sequence uint64) error {
		persistCalls[handle.Name()]++
		return originalPersist(handle, operations, sequence)
	}
	db, err = Open(path)
	persistWriteCollection = originalPersist
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	if persistCalls[indexPhysicalName("title-fast")] != 0 || persistCalls[indexPhysicalName("title-second")] != 0 || persistCalls[indexPhysicalName("body-main")] != 1 {
		t.Fatalf("重启恢复未跳过已应用的 HNSW 与 DiskVamana 视图：%v", persistCalls)
	}
	reopenedAPI, err := db.OpenDataset("documents")
	if err != nil {
		t.Fatal(err)
	}
	reopened := reopenedAPI.(*Dataset)
	for _, index := range []string{"title-fast", "title-second", "body-main"} {
		results, err := reopened.SearchIndex(index, []float32{-1, 0}, SearchOptions{TopK: 1})
		if index == "body-main" {
			results, err = reopened.SearchIndex(index, []float32{-1, -1, -1}, SearchOptions{TopK: 1})
		}
		if err != nil || len(results) != 1 || results[0].ID != entity.ID {
			t.Fatalf("视图 %q 恢复结果错误：results=%+v，err=%v", index, results, err)
		}
	}
	if !bytes.Contains(reopened.metas[entity.ID], []byte("recovered")) {
		t.Fatal("集合 WAL 已应用时中央 meta 未恢复")
	}
}

func TestDatasetRestartRecoveryUsesDynamicIndexSequenceBase(t *testing.T) {
	for _, engine := range []Engine{EngineHNSW, EngineDiskVamana} {
		t.Run(string(engine), func(t *testing.T) {
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
			if _, err := dataset.UpsertEntities(context.Background(), []Entity{{
				ID: "before-late-index",
				Embeddings: map[string][]float32{
					"title": {-0.5, 0.5},
					"body":  {-0.5, -0.5, -0.5},
				},
			}}, WriteOptions{Durability: DurabilitySync}); err != nil {
				t.Fatal(err)
			}
			if err := dataset.AddIndex("title-late", IndexViewOptions{Embedding: "title", Engine: engine}); err != nil {
				t.Fatal(err)
			}
			if dataset.indexSequenceBases["title-late"] != 1 {
				t.Fatalf("动态索引未记录当前数据集序号作为基线：%v", dataset.indexSequenceBases)
			}
			entity := Entity{
				ID:         "late-index-applied",
				Embeddings: map[string][]float32{"title": {-1, 0}, "body": {-1, -1, -1}},
				Meta:       MarshalMeta(map[string]any{"dynamic": true}),
			}
			point := Point{ID: entity.ID, Vector: entity.Embeddings["title"]}
			if _, err := dataset.handles["title-late"].Write(context.Background(), WriteBatch{Operations: []WriteOperation{{Point: &point}}}, WriteOptions{Durability: DurabilitySync}); err != nil {
				t.Fatal(err)
			}
			if err := saveDatasetTransaction(dataset.path, datasetTransaction{Sequence: 2, Upserts: []Entity{entity}}); err != nil {
				t.Fatal(err)
			}
			if err := db.Close(); err != nil {
				t.Fatal(err)
			}

			originalPersist := persistWriteCollection
			persistCalls := make(map[string]int)
			persistWriteCollection = func(handle *CollectionHandle, operations []WriteOperation, sequence uint64) error {
				persistCalls[handle.Name()]++
				return originalPersist(handle, operations, sequence)
			}
			db, err = Open(path)
			persistWriteCollection = originalPersist
			if err != nil {
				t.Fatal(err)
			}
			defer db.Close()
			if persistCalls[indexPhysicalName("title-late")] != 0 {
				t.Fatalf("动态 %s 索引因物理序号从零开始而被重复应用：%v", engine, persistCalls)
			}
			for _, indexName := range []string{"title-fast", "title-second", "body-main"} {
				if persistCalls[indexPhysicalName(indexName)] != 1 {
					t.Fatalf("落后视图 %q 未恢复一次：%v", indexName, persistCalls)
				}
			}
			reopened, err := db.OpenDataset("documents")
			if err != nil {
				t.Fatal(err)
			}
			results, err := reopened.SearchIndex("title-late", []float32{-1, 0}, SearchOptions{TopK: 1})
			if err != nil || len(results) != 1 || results[0].ID != entity.ID || !bytes.Contains(results[0].Meta, []byte("dynamic")) {
				t.Fatalf("动态索引恢复结果错误：results=%+v，err=%v", results, err)
			}
		})
	}
}

func TestDatasetOpenMigratesLegacyDynamicIndexSequenceBases(t *testing.T) {
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
	if _, err := dataset.UpsertEntities(context.Background(), []Entity{{
		ID:         "before-legacy-index",
		Embeddings: map[string][]float32{"title": {-1, 0}, "body": {-1, -1, -1}},
	}}, WriteOptions{Durability: DurabilitySync}); err != nil {
		t.Fatal(err)
	}
	if err := dataset.AddIndex("title-legacy", IndexViewOptions{Embedding: "title", Engine: EngineDiskVamana}); err != nil {
		t.Fatal(err)
	}
	manifestPath := filepath.Join(dataset.path, datasetManifestName)
	if err := db.Close(); err != nil {
		t.Fatal(err)
	}
	manifestBytes, err := os.ReadFile(manifestPath)
	if err != nil {
		t.Fatal(err)
	}
	var manifest datasetManifest
	if err := msgpack.Unmarshal(manifestBytes, &manifest); err != nil {
		t.Fatal(err)
	}
	if manifest.IndexSequenceBases["title-legacy"] != 1 {
		t.Fatalf("测试前动态索引基线错误：%v", manifest.IndexSequenceBases)
	}
	manifest.IndexSequenceBases = nil
	if err := saveDatasetManifest(filepath.Dir(manifestPath), manifest); err != nil {
		t.Fatal(err)
	}

	db, err = Open(path)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	reopenedAPI, err := db.OpenDataset("documents")
	if err != nil {
		t.Fatal(err)
	}
	reopened := reopenedAPI.(*Dataset)
	if reopened.indexSequenceBases["title-legacy"] != 1 {
		t.Fatalf("旧 manifest 未推导动态索引基线：%v", reopened.indexSequenceBases)
	}
	manifestBytes, err = os.ReadFile(manifestPath)
	if err != nil {
		t.Fatal(err)
	}
	if err := msgpack.Unmarshal(manifestBytes, &manifest); err != nil {
		t.Fatal(err)
	}
	if manifest.IndexSequenceBases["title-legacy"] != 1 || len(manifest.IndexSequenceBases) != len(manifest.Indexes) {
		t.Fatalf("推导后的索引基线未持久化：bases=%v，indexes=%v", manifest.IndexSequenceBases, manifest.Indexes)
	}
}

func TestDatasetRecoversMetadataWALSyncFailureWithoutRewritingViews(t *testing.T) {
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

	originalSyncDirectory := syncParentDirectory
	defer func() { syncParentDirectory = originalSyncDirectory }()
	injected := errors.New("injected metadata WAL directory sync failure")
	failMetadataSync := true
	syncParentDirectory = func(path string) error {
		if failMetadataSync && filepath.Base(path) == datasetMetaWALName {
			failMetadataSync = false
			return injected
		}
		return originalSyncDirectory(path)
	}
	pending := Entity{
		ID:         "metadata-pending",
		Embeddings: map[string][]float32{"title": {-1, 0}, "body": {-1, -1, -1}},
		Meta:       MarshalMeta(map[string]any{"transaction": 1}),
	}
	result, writeErr := dataset.UpsertEntities(context.Background(), []Entity{pending}, WriteOptions{Durability: DurabilitySync})
	syncParentDirectory = originalSyncDirectory
	if !errors.Is(writeErr, ErrIndexRecoveryRequired) || !result.Committed || result.IndexHealthy {
		t.Fatalf("metadata WAL 同步失败未暴露待恢复事务：result=%+v，err=%v", result, writeErr)
	}

	originalPersist := persistWriteCollection
	defer func() { persistWriteCollection = originalPersist }()
	persistCalls := make(map[string]int)
	persistWriteCollection = func(handle *CollectionHandle, operations []WriteOperation, sequence uint64) error {
		persistCalls[handle.Name()]++
		return originalPersist(handle, operations, sequence)
	}
	next := Entity{
		ID:         "after-metadata-recovery",
		Embeddings: map[string][]float32{"title": {0, -1}, "body": {-2, -2, -2}},
		Meta:       MarshalMeta(map[string]any{"transaction": 2}),
	}
	result, err = dataset.UpsertEntities(context.Background(), []Entity{next}, WriteOptions{Durability: DurabilitySync})
	persistWriteCollection = originalPersist
	if err != nil || !result.Committed || !result.IndexHealthy || result.CommitSequence != 2 {
		t.Fatalf("metadata WAL 故障后无法恢复并继续写入：result=%+v，err=%v", result, err)
	}
	for _, indexName := range []string{"title-fast", "title-second", "body-main"} {
		if persistCalls[indexPhysicalName(indexName)] != 1 {
			t.Fatalf("恢复旧事务时重复写入视图 %q：%v", indexName, persistCalls)
		}
	}
	entities, err := dataset.FetchEntities([]string{pending.ID, next.ID})
	if err != nil || len(entities) != 2 || !bytes.Contains(entities[0].Meta, []byte("transaction")) || !bytes.Contains(entities[1].Meta, []byte("transaction")) {
		t.Fatalf("metadata WAL 恢复后实体真相不完整：entities=%+v，err=%v", entities, err)
	}
}
