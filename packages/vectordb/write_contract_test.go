package vectordb

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"sync"
	"testing"
)

func TestWriteContractValidationAndCompatibility(t *testing.T) {
	db, err := Open(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	col, err := db.CreateCollectionWithOptions("contract", CollectionOptions{Engine: EngineHNSW, Dimension: 2})
	if err != nil {
		t.Fatal(err)
	}

	if _, err := col.Write(context.Background(), WriteBatch{}, WriteOptions{}); !errors.Is(err, ErrInvalidWriteBatch) {
		t.Fatalf("空批次应返回 ErrInvalidWriteBatch，实际为 %v", err)
	}
	if _, err := col.Write(context.Background(), WriteBatch{Operations: []WriteOperation{{Point: &Point{ID: "bad", Vector: []float32{1}}}}}, WriteOptions{}); !errors.Is(err, ErrVectorDimensionInvalid) {
		t.Fatalf("维度错误应返回 ErrVectorDimensionInvalid，实际为 %v", err)
	}
	if _, err := col.Write(context.Background(), WriteBatch{Operations: []WriteOperation{{DeleteID: "x"}}}, WriteOptions{Durability: "invalid"}); !errors.Is(err, ErrUnsupportedDurability) {
		t.Fatalf("未知持久性应返回 ErrUnsupportedDurability，实际为 %v", err)
	}

	compatibility, err := CheckFormatCompatibility(CurrentFormatMajor, CurrentFormatMinor, 0, 0)
	if err != nil || !compatibility.Readable || !compatibility.Writable || compatibility.RequiresMigration {
		t.Fatalf("当前格式兼容性错误：%+v，%v", compatibility, err)
	}
	compatibility, err = CheckFormatCompatibility(CurrentFormatMajor, CurrentFormatMinor+1, 0, 0)
	if err != nil || !compatibility.Readable || compatibility.Writable || !compatibility.RequiresMigration {
		t.Fatalf("未来次版本应只读并要求迁移：%+v，%v", compatibility, err)
	}
	if _, err := CheckFormatCompatibility(CurrentFormatMajor+1, 0, 0, 0); !errors.Is(err, ErrFormatIncompatible) {
		t.Fatalf("未来主版本应返回 ErrFormatIncompatible，实际为 %v", err)
	}
	if _, err := CheckFormatCompatibility(CurrentFormatMajor, CurrentFormatMinor, 1, 0); !errors.Is(err, ErrFormatIncompatible) {
		t.Fatalf("未知特性位应返回 ErrFormatIncompatible，实际为 %v", err)
	}
}

func TestWriteContractLastOperationWinsAndCompatibilityWrappers(t *testing.T) {
	db, err := Open(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	col, err := db.CreateCollectionWithOptions("batch", CollectionOptions{
		Engine:         EngineHNSW,
		Dimension:      2,
		DistanceMetric: "l2",
	})
	if err != nil {
		t.Fatal(err)
	}

	result, err := col.Write(context.Background(), WriteBatch{Operations: []WriteOperation{
		{Point: &Point{ID: "same", Vector: []float32{1, 0}}},
		{DeleteID: "same"},
	}}, WriteOptions{Durability: DurabilityMemory})
	if err != nil {
		t.Fatal(err)
	}
	if !result.Committed || result.CommitSequence != 1 || result.Applied != 1 {
		t.Fatalf("批次结果不符合预期：%+v", result)
	}
	if points, err := col.FetchPoints([]string{"same"}); err != nil || len(points) != 0 {
		t.Fatalf("同批次最后删除应生效：%+v，%v", points, err)
	}

	result, err = col.Write(context.Background(), WriteBatch{Operations: []WriteOperation{
		{Point: &Point{ID: "same", Vector: []float32{2, 0}}},
		{Point: &Point{ID: "same", Vector: []float32{3, 0}}},
	}}, WriteOptions{Durability: DurabilityMemory})
	if err != nil {
		t.Fatal(err)
	}
	if result.CommitSequence != 2 || result.Applied != 1 {
		t.Fatalf("重复 ID 应只应用最后操作：%+v", result)
	}
	points, err := col.FetchPoints([]string{"same"})
	if err != nil || len(points) != 1 || points[0].Vector[0] != 3 {
		t.Fatalf("最后更新未生效：%+v，%v", points, err)
	}

	if err := col.Upsert([]Point{{ID: "wrapped", Vector: []float32{4, 0}}}); err != nil {
		t.Fatalf("兼容 Upsert 失败：%v", err)
	}
	if err := col.Delete([]string{"wrapped"}); err != nil {
		t.Fatalf("兼容 Delete 失败：%v", err)
	}
	if err := col.Upsert(nil); err != nil {
		t.Fatalf("空 Upsert 应保持兼容成功：%v", err)
	}
	if err := col.Delete(nil); err != nil {
		t.Fatalf("空 Delete 应保持兼容成功：%v", err)
	}
}

func TestWriteContractDurabilityModes(t *testing.T) {
	db, err := Open(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	col, err := db.CreateCollectionWithOptions("durability", CollectionOptions{Engine: EngineHNSW, Dimension: 2})
	if err != nil {
		t.Fatal(err)
	}

	originalAsyncFlush := asyncFlushCollection
	asyncFlushCalled := make(chan struct{}, 1)
	asyncFlushCollection = func(*CollectionHandle) {
		asyncFlushCalled <- struct{}{}
	}
	t.Cleanup(func() {
		asyncFlushCollection = originalAsyncFlush
	})

	memoryPoint := Point{ID: "memory", Vector: []float32{1, 0}}
	memoryResult, err := col.Write(context.Background(), WriteBatch{Operations: []WriteOperation{{Point: &memoryPoint}}}, WriteOptions{Durability: DurabilityMemory})
	if err != nil || memoryResult.Durability != DurabilityMemory || !memoryResult.Committed {
		t.Fatalf("memory 模式失败：%+v，%v", memoryResult, err)
	}
	select {
	case <-asyncFlushCalled:
		t.Fatal("memory 模式不得触发异步刷新")
	default:
	}

	asyncPoint := Point{ID: "async", Vector: []float32{2, 0}}
	asyncResult, err := col.Write(context.Background(), WriteBatch{Operations: []WriteOperation{{Point: &asyncPoint}}}, WriteOptions{Durability: DurabilityAsync})
	if err != nil || asyncResult.Durability != DurabilityAsync || !asyncResult.Committed {
		t.Fatalf("async 模式失败：%+v，%v", asyncResult, err)
	}
	select {
	case <-asyncFlushCalled:
	default:
		t.Fatal("async 模式应调度异步刷新")
	}

	syncPoint := Point{ID: "sync", Vector: []float32{3, 0}}
	syncResult, err := col.Write(context.Background(), WriteBatch{Operations: []WriteOperation{{Point: &syncPoint}}}, WriteOptions{Durability: DurabilitySync})
	if err != nil || syncResult.Durability != DurabilitySync || !syncResult.Committed {
		t.Fatalf("sync 模式失败：%+v，%v", syncResult, err)
	}
}

func TestWriteContractCancellationAndSyncFailure(t *testing.T) {
	db, err := Open(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	col, err := db.CreateCollectionWithOptions("failures", CollectionOptions{Engine: EngineHNSW, Dimension: 2})
	if err != nil {
		t.Fatal(err)
	}

	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	if _, err := col.Write(ctx, WriteBatch{Operations: []WriteOperation{{Point: &Point{ID: "cancelled", Vector: []float32{1, 0}}}}}, WriteOptions{}); !errors.Is(err, context.Canceled) {
		t.Fatalf("取消应保留 context.Canceled，实际为 %v", err)
	}
	if points, err := col.FetchPoints([]string{"cancelled"}); err != nil || len(points) != 0 {
		t.Fatalf("提交前取消不得产生写入：%+v，%v", points, err)
	}

	originalPersistWrite := persistWriteCollection
	persistWriteCollection = func(*CollectionHandle, []WriteOperation, uint64) error {
		return errors.New("injected sync failure")
	}
	t.Cleanup(func() {
		persistWriteCollection = originalPersistWrite
	})

	result, err := col.Write(context.Background(), WriteBatch{Operations: []WriteOperation{{Point: &Point{ID: "sync-failed", Vector: []float32{2, 0}}}}}, WriteOptions{Durability: DurabilitySync})
	if !errors.Is(err, ErrPersistenceFailed) {
		t.Fatalf("同步失败应返回 ErrPersistenceFailed，实际为 %v", err)
	}
	if result.Committed || result.CommitSequence != 0 || result.Applied != 0 || !result.IndexHealthy {
		t.Fatalf("同步失败结果不符合 WAL 提交前未修改索引的契约：%+v", result)
	}
	if points, fetchErr := col.FetchPoints([]string{"sync-failed"}); fetchErr != nil || len(points) != 0 {
		t.Fatalf("同步失败后应回滚内存写入：%+v，%v", points, fetchErr)
	}
}

func TestWriteContractDiskVamanaWALFailureDoesNotMutateGraph(t *testing.T) {
	db, err := Open(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = db.Close() })
	collection, err := db.CreateCollectionWithOptions("vamana-wal-failure", CollectionOptions{
		Engine: EngineDiskVamana,
		Points: []Point{
			{ID: "a", Vector: []float32{0, 0}},
			{ID: "b", Vector: []float32{10, 10}},
			{ID: "c", Vector: []float32{20, 20}},
		},
	})
	if err != nil {
		t.Fatal(err)
	}
	handle := collection.(*CollectionHandle)
	vamanaCollection := handle.col.(*VamanaCollection)
	beforeTotal := vamanaCollection.Index.NumPointsTotal()
	beforeLive := vamanaCollection.Index.NumPoints()
	beforeIDs := make(map[string]uint64, len(vamanaCollection.IDMap))
	for id, nodeID := range vamanaCollection.IDMap {
		beforeIDs[id] = nodeID
	}

	originalPersistWrite := persistWriteCollection
	persistWriteCollection = func(*CollectionHandle, []WriteOperation, uint64) error {
		return errors.New("injected DiskVamana WAL failure")
	}
	t.Cleanup(func() { persistWriteCollection = originalPersistWrite })

	updated := Point{ID: "a", Vector: []float32{1, 1}}
	created := Point{ID: "uncommitted", Vector: []float32{1, 2}}
	result, err := collection.Write(context.Background(), WriteBatch{Operations: []WriteOperation{
		{Point: &updated},
		{DeleteID: "b"},
		{Point: &created},
	}}, WriteOptions{Durability: DurabilitySync})
	if !errors.Is(err, ErrPersistenceFailed) {
		t.Fatalf("WAL 失败应返回 ErrPersistenceFailed，实际为 %v", err)
	}
	if result.Committed || !result.IndexHealthy {
		t.Fatalf("WAL 失败不得提交且索引应保持健康：%+v", result)
	}
	if got := vamanaCollection.Index.NumPointsTotal(); got != beforeTotal {
		t.Fatalf("WAL 失败后磁盘图总节点从 %d 变为 %d，说明补偿回滚留下了墓碑", beforeTotal, got)
	}
	if got := vamanaCollection.Index.NumPoints(); got != beforeLive {
		t.Fatalf("WAL 失败后存活节点从 %d 变为 %d", beforeLive, got)
	}
	for id, nodeID := range beforeIDs {
		if got, ok := vamanaCollection.IDMap[id]; !ok || got != nodeID {
			t.Fatalf("WAL 失败后 ID %q 的内部映射从 %d 变为 %d（存在=%v）", id, nodeID, got, ok)
		}
	}
	if _, ok := vamanaCollection.IDMap[created.ID]; ok {
		t.Fatal("WAL 失败后外部 ID 映射仍然存在")
	}
	points, fetchErr := collection.FetchPoints([]string{"a", "b"})
	if fetchErr != nil || len(points) != 2 || points[0].Vector[0] != 0 || points[1].Vector[0] != 10 {
		t.Fatalf("WAL 失败后原始向量发生变化：%+v，%v", points, fetchErr)
	}
}

func TestWriteContractDiskVamanaFsyncFailureRollsBackWALFrame(t *testing.T) {
	path := t.TempDir()
	db, err := Open(path)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	collection, err := db.CreateCollectionWithOptions("vamana-fsync-failure", CollectionOptions{
		Engine: EngineDiskVamana,
		Points: []Point{
			{ID: "a", Vector: []float32{0, 0}},
			{ID: "b", Vector: []float32{10, 10}},
			{ID: "c", Vector: []float32{20, 20}},
		},
	})
	if err != nil {
		t.Fatal(err)
	}
	handle := collection.(*CollectionHandle)
	vamanaCollection := handle.col.(*VamanaCollection)
	beforeTotal := vamanaCollection.Index.NumPointsTotal()
	walPath := filepath.Join(path, "vamana-fsync-failure", "vamana"+VamanaWALFileExt)
	var beforeWALSize int64
	if info, statErr := os.Stat(walPath); statErr == nil {
		beforeWALSize = info.Size()
	} else if !os.IsNotExist(statErr) {
		t.Fatal(statErr)
	}

	originalSync := syncVamanaWALFile
	syncVamanaWALFile = func(*os.File) error { return errors.New("injected fsync failure") }
	point := Point{ID: "not-durable", Vector: []float32{1, 2}}
	result, err := collection.Write(context.Background(), WriteBatch{Operations: []WriteOperation{{Point: &point}}}, WriteOptions{Durability: DurabilitySync})
	syncVamanaWALFile = originalSync
	if !errors.Is(err, ErrPersistenceFailed) {
		t.Fatalf("fsync 失败应返回 ErrPersistenceFailed，实际为 %v", err)
	}
	if result.Committed || result.Applied != 0 || !result.IndexHealthy {
		t.Fatalf("fsync 失败不得发布索引修改：%+v", result)
	}
	if got := vamanaCollection.Index.NumPointsTotal(); got != beforeTotal {
		t.Fatalf("fsync 失败后图节点从 %d 变为 %d", beforeTotal, got)
	}
	info, statErr := os.Stat(walPath)
	if statErr != nil {
		t.Fatal(statErr)
	}
	if info.Size() != beforeWALSize {
		t.Fatalf("fsync 失败后 WAL 完整帧未截断，原大小 %d，现大小 %d", beforeWALSize, info.Size())
	}
	if err := db.Close(); err != nil {
		t.Fatal(err)
	}

	reopened, err := Open(path)
	if err != nil {
		t.Fatal(err)
	}
	defer reopened.Close()
	reopenedCollection, err := reopened.OpenCollection("vamana-fsync-failure")
	if err != nil {
		t.Fatal(err)
	}
	points, err := reopenedCollection.FetchPoints([]string{point.ID})
	if err != nil || len(points) != 0 {
		t.Fatalf("fsync 失败的批次不得在重开后出现：%+v，%v", points, err)
	}
}

func TestWriteContractDirectorySyncFailureDoesNotCommitAcrossEngines(t *testing.T) {
	for _, engine := range []Engine{EngineHNSW, EngineDiskVamana} {
		t.Run(string(engine), func(t *testing.T) {
			db, err := Open(t.TempDir())
			if err != nil {
				t.Fatal(err)
			}
			defer db.Close()
			options := CollectionOptions{Engine: engine, Dimension: 2, DistanceMetric: "l2"}
			if engine == EngineDiskVamana {
				options.Points = []Point{
					{ID: "a", Vector: []float32{1, 0}},
					{ID: "b", Vector: []float32{0, 1}},
					{ID: "c", Vector: []float32{-1, 0}},
				}
			}
			collection, err := db.CreateCollectionWithOptions("directory-sync", options)
			if err != nil {
				t.Fatal(err)
			}

			originalSyncDirectory := syncParentDirectory
			syncCalls := 0
			syncParentDirectory = func(string) error {
				syncCalls++
				return errors.New("injected directory sync failure")
			}
			point := Point{ID: "not-durable", Vector: []float32{2, 3}}
			result, writeErr := collection.Write(context.Background(), WriteBatch{Operations: []WriteOperation{{Point: &point}}}, WriteOptions{Durability: DurabilitySync})
			syncParentDirectory = originalSyncDirectory
			if !errors.Is(writeErr, ErrPersistenceFailed) {
				t.Fatalf("目录同步失败应返回 ErrPersistenceFailed：%v", writeErr)
			}
			if syncCalls != 1 || result.Committed || result.Applied != 0 || !result.IndexHealthy {
				t.Fatalf("目录同步失败的提交结果错误：calls=%d，result=%+v", syncCalls, result)
			}
			points, fetchErr := collection.FetchPoints([]string{point.ID})
			if fetchErr != nil || len(points) != 0 {
				t.Fatalf("目录同步失败后索引被修改：points=%+v，err=%v", points, fetchErr)
			}
		})
	}
}

func TestWriteContractDiskVamanaCancellationBeforeWALCommit(t *testing.T) {
	db, err := Open(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	collection, err := db.CreateCollectionWithOptions("vamana-cancel-before-wal", CollectionOptions{
		Engine: EngineDiskVamana,
		Points: []Point{
			{ID: "a", Vector: []float32{0, 0}},
			{ID: "b", Vector: []float32{10, 10}},
			{ID: "c", Vector: []float32{20, 20}},
		},
	})
	if err != nil {
		t.Fatal(err)
	}
	vamanaCollection := collection.(*CollectionHandle).col.(*VamanaCollection)
	beforeTotal := vamanaCollection.Index.NumPointsTotal()
	ctx, cancel := context.WithCancel(context.Background())
	point := Point{ID: "cancelled", Vector: []float32{1, 2}}
	result, err := collection.Write(ctx, WriteBatch{Operations: []WriteOperation{{Point: &point}}}, WriteOptions{
		Durability: DurabilitySync,
		OnProgress: func(progress WriteProgress) {
			if progress.Stage == "persisting" {
				cancel()
			}
		},
	})
	if !errors.Is(err, context.Canceled) {
		t.Fatalf("WAL 提交前取消应保留 context.Canceled，实际为 %v", err)
	}
	if result.Committed || result.Applied != 0 || !result.IndexHealthy {
		t.Fatalf("WAL 提交前取消不得发布事务：%+v", result)
	}
	if got := vamanaCollection.Index.NumPointsTotal(); got != beforeTotal {
		t.Fatalf("WAL 提交前取消后图节点从 %d 变为 %d", beforeTotal, got)
	}
	if points, fetchErr := collection.FetchPoints([]string{point.ID}); fetchErr != nil || len(points) != 0 {
		t.Fatalf("WAL 提交前取消后出现写入：%+v，%v", points, fetchErr)
	}
}

func TestWriteContractDiskVamanaCommittedWALRecoversApplyFailure(t *testing.T) {
	path := t.TempDir()
	db, err := Open(path)
	if err != nil {
		t.Fatal(err)
	}
	collection, err := db.CreateCollectionWithOptions("vamana-redo", CollectionOptions{
		Engine: EngineDiskVamana,
		Points: []Point{
			{ID: "a", Vector: []float32{0, 0}},
			{ID: "b", Vector: []float32{10, 10}},
			{ID: "c", Vector: []float32{20, 20}},
		},
	})
	if err != nil {
		t.Fatal(err)
	}
	handle := collection.(*CollectionHandle)
	vamanaCollection := handle.col.(*VamanaCollection)
	if err := vamanaCollection.Index.Close(); err != nil {
		t.Fatal(err)
	}

	point := Point{ID: "redo", Vector: []float32{1, 2}, Meta: []byte(`{"committed":true}`)}
	result, err := collection.Write(context.Background(), WriteBatch{Operations: []WriteOperation{{Point: &point}}}, WriteOptions{Durability: DurabilitySync})
	if !errors.Is(err, ErrIndexRecoveryRequired) {
		t.Fatalf("WAL 已提交但索引应用失败应要求恢复，实际为 %v", err)
	}
	if !result.Committed || result.CommitSequence == 0 || result.Applied != 0 || result.IndexHealthy {
		t.Fatalf("WAL 提交后的失败结果错误：%+v", result)
	}
	if _, err := collection.Search(point.Vector, SearchOptions{TopK: 1}); !errors.Is(err, ErrIndexRecoveryRequired) {
		t.Fatalf("不完整索引不得继续查询，实际为 %v", err)
	}
	if err := db.Close(); err != nil {
		t.Fatal(err)
	}

	reopened, err := Open(path)
	if err != nil {
		t.Fatal(err)
	}
	defer reopened.Close()
	reopenedCollection, err := reopened.OpenCollection("vamana-redo")
	if err != nil {
		t.Fatal(err)
	}
	points, err := reopenedCollection.FetchPoints([]string{point.ID})
	if err != nil {
		t.Fatal(err)
	}
	if len(points) != 1 || points[0].Vector[0] != 1 || points[0].Vector[1] != 2 || string(points[0].Meta) != `{"committed":true}` {
		t.Fatalf("重开后未完整重放已提交 WAL：%+v", points)
	}
	next := Point{ID: "next", Vector: []float32{2, 3}}
	nextResult, err := reopenedCollection.Write(context.Background(), WriteBatch{Operations: []WriteOperation{{Point: &next}}}, WriteOptions{Durability: DurabilitySync})
	if err != nil {
		t.Fatal(err)
	}
	if nextResult.CommitSequence != result.CommitSequence+1 {
		t.Fatalf("恢复后提交序号未连续：失败提交 %+v，下一提交 %+v", result, nextResult)
	}
}

func TestWriteContractDiskVamanaRejectsInvalidBatchBeforeReplay(t *testing.T) {
	path := t.TempDir()
	db, err := Open(path)
	if err != nil {
		t.Fatal(err)
	}
	collection, err := db.CreateCollectionWithOptions("vamana-invalid-wal", CollectionOptions{
		Engine: EngineDiskVamana,
		Points: []Point{
			{ID: "a", Vector: []float32{0, 0}},
			{ID: "b", Vector: []float32{10, 10}},
			{ID: "c", Vector: []float32{20, 20}},
		},
	})
	if err != nil {
		t.Fatal(err)
	}
	vamanaCollection := collection.(*CollectionHandle).col.(*VamanaCollection)
	badPoint := Point{ID: "bad", Vector: []float32{1}}
	if err := AppendVamanaWAL(vamanaCollection, []WriteOperation{
		{DeleteID: "a"},
		{Point: &badPoint},
	}, 1, true); err != nil {
		t.Fatal(err)
	}
	if err := db.Close(); err != nil {
		t.Fatal(err)
	}

	if _, err := Open(path); !errors.Is(err, ErrStorageCorrupted) {
		t.Fatalf("非法 WAL 批次应在修改索引前被拒绝，实际为 %v", err)
	}
	walPath := filepath.Join(path, "vamana-invalid-wal", "vamana"+VamanaWALFileExt)
	if err := os.Remove(walPath); err != nil {
		t.Fatal(err)
	}
	reopened, err := Open(path)
	if err != nil {
		t.Fatal(err)
	}
	defer reopened.Close()
	reopenedCollection, err := reopened.OpenCollection("vamana-invalid-wal")
	if err != nil {
		t.Fatal(err)
	}
	points, err := reopenedCollection.FetchPoints([]string{"a"})
	if err != nil || len(points) != 1 {
		t.Fatalf("拒绝非法 WAL 后基础快照被部分修改：%+v，%v", points, err)
	}
}

func TestWriteContractCancellationDuringApplyRollsBackBatch(t *testing.T) {
	db, err := Open(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	col, err := db.CreateCollectionWithOptions("cancel-rollback", CollectionOptions{Engine: EngineHNSW, Dimension: 2})
	if err != nil {
		t.Fatal(err)
	}
	if err := col.Upsert([]Point{{ID: "existing", Vector: []float32{1, 0}, Meta: []byte(`{"version":1}`)}}); err != nil {
		t.Fatal(err)
	}

	ctx, cancel := context.WithCancel(context.Background())
	updated := Point{ID: "existing", Vector: []float32{2, 0}, Meta: []byte(`{"version":2}`)}
	created := Point{ID: "created", Vector: []float32{3, 0}}
	result, err := col.Write(ctx, WriteBatch{Operations: []WriteOperation{
		{Point: &updated},
		{Point: &created},
	}}, WriteOptions{
		Durability: DurabilityMemory,
		OnProgress: func(progress WriteProgress) {
			if progress.Stage == "applying" && progress.Completed == 1 {
				cancel()
			}
		},
	})
	if !errors.Is(err, ErrBatchApplyFailed) || !errors.Is(err, context.Canceled) {
		t.Fatalf("应用中取消应保留批次错误和 context.Canceled，实际为 %v", err)
	}
	if result.Committed || result.CommitSequence != 0 || result.Applied != 1 {
		t.Fatalf("应用中取消不得提交批次：%+v", result)
	}

	points, fetchErr := col.FetchPoints([]string{"existing", "created"})
	if fetchErr != nil {
		t.Fatal(fetchErr)
	}
	if len(points) != 1 || points[0].ID != "existing" || points[0].Vector[0] != 1 || string(points[0].Meta) != `{"version":1}` {
		t.Fatalf("应用中取消后应完整恢复写入前状态：%+v", points)
	}
}

func TestWriteContractSyncSurvivesReopen(t *testing.T) {
	path := t.TempDir()
	db, err := Open(path)
	if err != nil {
		t.Fatal(err)
	}
	col, err := db.CreateCollectionWithOptions("sync-reopen", CollectionOptions{
		Engine:         EngineHNSW,
		Dimension:      2,
		DistanceMetric: "l2",
	})
	if err != nil {
		t.Fatal(err)
	}
	point := Point{ID: "durable", Vector: []float32{1, 2}, Meta: []byte(`{"durable":true}`)}
	result, err := col.Write(context.Background(), WriteBatch{Operations: []WriteOperation{{Point: &point}}}, WriteOptions{Durability: DurabilitySync})
	if err != nil || !result.Committed {
		t.Fatalf("同步写入失败：%+v，%v", result, err)
	}
	if err := db.Close(); err != nil {
		t.Fatal(err)
	}

	reopened, err := Open(path)
	if err != nil {
		t.Fatal(err)
	}
	defer reopened.Close()
	reopenedCol, err := reopened.OpenCollection("sync-reopen")
	if err != nil {
		t.Fatal(err)
	}
	points, err := reopenedCol.FetchPoints([]string{"durable"})
	if err != nil {
		t.Fatal(err)
	}
	if len(points) != 1 || points[0].Vector[0] != 1 || points[0].Vector[1] != 2 || string(points[0].Meta) != `{"durable":true}` {
		t.Fatalf("同步写入在重开后丢失：%+v", points)
	}
	next := Point{ID: "next", Vector: []float32{3, 4}}
	nextResult, err := reopenedCol.Write(context.Background(), WriteBatch{Operations: []WriteOperation{{Point: &next}}}, WriteOptions{Durability: DurabilitySync})
	if err != nil {
		t.Fatal(err)
	}
	if nextResult.CommitSequence != result.CommitSequence+1 {
		t.Fatalf("重开后提交序号应继续递增：首次 %+v，重开后 %+v", result, nextResult)
	}
}

func TestWriteContractWALTornTailAndCorruption(t *testing.T) {
	t.Run("torn tail", func(t *testing.T) {
		path := t.TempDir()
		db, err := Open(path)
		if err != nil {
			t.Fatal(err)
		}
		col, err := db.CreateCollectionWithOptions("wal-tail", CollectionOptions{Engine: EngineHNSW, Dimension: 2})
		if err != nil {
			t.Fatal(err)
		}
		point := Point{ID: "committed", Vector: []float32{1, 2}}
		if _, err := col.Write(context.Background(), WriteBatch{Operations: []WriteOperation{{Point: &point}}}, WriteOptions{Durability: DurabilitySync}); err != nil {
			t.Fatal(err)
		}
		walPath := filepath.Join(path, "wal-tail", WALFileName)
		wal, err := os.OpenFile(walPath, os.O_APPEND|os.O_WRONLY, 0644)
		if err != nil {
			t.Fatal(err)
		}
		if _, err := wal.Write([]byte{1, 2, 3, 4, 5}); err != nil {
			_ = wal.Close()
			t.Fatal(err)
		}
		if err := wal.Close(); err != nil {
			t.Fatal(err)
		}
		if err := db.Close(); err != nil {
			t.Fatal(err)
		}

		reopened, err := Open(path)
		if err != nil {
			t.Fatalf("撕裂尾帧不应破坏已同步记录：%v", err)
		}
		reopenedCol, err := reopened.OpenCollection("wal-tail")
		if err != nil {
			t.Fatal(err)
		}
		points, err := reopenedCol.FetchPoints([]string{"committed"})
		if err != nil || len(points) != 1 {
			t.Fatalf("撕裂尾帧后已同步记录丢失：%+v，%v", points, err)
		}
		afterTail := Point{ID: "after-tail", Vector: []float32{3, 4}}
		if _, err := reopenedCol.Write(context.Background(), WriteBatch{Operations: []WriteOperation{{Point: &afterTail}}}, WriteOptions{Durability: DurabilitySync}); err != nil {
			t.Fatal(err)
		}
		if err := reopened.Close(); err != nil {
			t.Fatal(err)
		}
		reopenedAgain, err := Open(path)
		if err != nil {
			t.Fatal(err)
		}
		defer reopenedAgain.Close()
		reopenedAgainCol, err := reopenedAgain.OpenCollection("wal-tail")
		if err != nil {
			t.Fatal(err)
		}
		points, err = reopenedAgainCol.FetchPoints([]string{"committed", "after-tail"})
		if err != nil || len(points) != 2 {
			t.Fatalf("修复撕裂尾帧后追加的同步记录必须可恢复：%+v，%v", points, err)
		}
	})

	t.Run("checksum corruption", func(t *testing.T) {
		path := t.TempDir()
		db, err := Open(path)
		if err != nil {
			t.Fatal(err)
		}
		col, err := db.CreateCollectionWithOptions("wal-corrupt", CollectionOptions{Engine: EngineHNSW, Dimension: 2})
		if err != nil {
			t.Fatal(err)
		}
		point := Point{ID: "committed", Vector: []float32{1, 2}}
		if _, err := col.Write(context.Background(), WriteBatch{Operations: []WriteOperation{{Point: &point}}}, WriteOptions{Durability: DurabilitySync}); err != nil {
			t.Fatal(err)
		}
		walPath := filepath.Join(path, "wal-corrupt", WALFileName)
		data, err := os.ReadFile(walPath)
		if err != nil {
			t.Fatal(err)
		}
		data[len(data)-1] ^= 0xff
		if err := os.WriteFile(walPath, data, 0644); err != nil {
			t.Fatal(err)
		}
		if err := db.Close(); err != nil {
			t.Fatal(err)
		}
		if _, err := Open(path); !errors.Is(err, ErrStorageCorrupted) {
			t.Fatalf("完整 WAL 帧损坏应返回 ErrStorageCorrupted，实际为 %v", err)
		}
	})
}

func TestWriteContractDiskVamanaSequenceSurvivesReopen(t *testing.T) {
	path := t.TempDir()
	db, err := Open(path)
	if err != nil {
		t.Fatal(err)
	}
	col, err := db.CreateCollectionWithOptions("vamana-sequence", CollectionOptions{
		Engine:    EngineDiskVamana,
		Dimension: 2,
		Points: []Point{
			{ID: "a", Vector: []float32{1, 0}},
			{ID: "b", Vector: []float32{0, 1}},
			{ID: "c", Vector: []float32{1, 1}},
		},
	})
	if err != nil {
		t.Fatal(err)
	}
	first := Point{ID: "d", Vector: []float32{2, 1}}
	firstResult, err := col.Write(context.Background(), WriteBatch{Operations: []WriteOperation{{Point: &first}}}, WriteOptions{Durability: DurabilitySync})
	if err != nil {
		t.Fatal(err)
	}
	if err := db.Close(); err != nil {
		t.Fatal(err)
	}

	reopened, err := Open(path)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		_ = reopened.Close()
	})
	reopenedCol, err := reopened.OpenCollection("vamana-sequence")
	if err != nil {
		t.Fatal(err)
	}
	second := Point{ID: "e", Vector: []float32{2, 2}}
	secondResult, err := reopenedCol.Write(context.Background(), WriteBatch{Operations: []WriteOperation{{Point: &second}}}, WriteOptions{Durability: DurabilitySync})
	if err != nil {
		t.Fatal(err)
	}
	if secondResult.CommitSequence != firstResult.CommitSequence+1 {
		t.Fatalf("Vamana 重开后提交序号应继续递增：首次 %+v，重开后 %+v", firstResult, secondResult)
	}
}

func TestWriteContractDiskVamanaWALTornTailAndCorruption(t *testing.T) {
	create := func(t *testing.T, path, name string) CollectionAPI {
		t.Helper()
		db, err := Open(path)
		if err != nil {
			t.Fatal(err)
		}
		col, err := db.CreateCollectionWithOptions(name, CollectionOptions{
			Engine: EngineDiskVamana,
			Points: []Point{
				{ID: "a", Vector: []float32{0, 0}},
				{ID: "b", Vector: []float32{10, 10}},
				{ID: "c", Vector: []float32{20, 20}},
			},
		})
		if err != nil {
			t.Fatal(err)
		}
		point := Point{ID: "committed", Vector: []float32{1, 2}}
		if _, err := col.Write(context.Background(), WriteBatch{Operations: []WriteOperation{{Point: &point}}}, WriteOptions{Durability: DurabilitySync}); err != nil {
			t.Fatal(err)
		}
		return col
	}

	t.Run("torn tail", func(t *testing.T) {
		path := t.TempDir()
		col := create(t, path, "vamana-wal-tail")
		walPath := filepath.Join(path, "vamana-wal-tail", "vamana"+VamanaWALFileExt)
		wal, err := os.OpenFile(walPath, os.O_APPEND|os.O_WRONLY, 0644)
		if err != nil {
			t.Fatal(err)
		}
		if _, err := wal.Write([]byte{1, 2, 3, 4, 5}); err != nil {
			_ = wal.Close()
			t.Fatal(err)
		}
		if err := wal.Close(); err != nil {
			t.Fatal(err)
		}
		if err := col.(*CollectionHandle).db.Close(); err != nil {
			t.Fatal(err)
		}

		reopened, err := Open(path)
		if err != nil {
			t.Fatalf("DiskVamana WAL 撕裂尾帧不应破坏已同步记录：%v", err)
		}
		defer reopened.Close()
		reopenedCol, err := reopened.OpenCollection("vamana-wal-tail")
		if err != nil {
			t.Fatal(err)
		}
		points, err := reopenedCol.FetchPoints([]string{"committed"})
		if err != nil || len(points) != 1 {
			t.Fatalf("DiskVamana WAL 撕裂尾帧后已同步记录丢失：%+v，%v", points, err)
		}
		afterTail := Point{ID: "after-tail", Vector: []float32{3, 4}}
		if _, err := reopenedCol.Write(context.Background(), WriteBatch{Operations: []WriteOperation{{Point: &afterTail}}}, WriteOptions{Durability: DurabilitySync}); err != nil {
			t.Fatal(err)
		}
		if err := reopened.Close(); err != nil {
			t.Fatal(err)
		}
		reopenedAgain, err := Open(path)
		if err != nil {
			t.Fatal(err)
		}
		defer reopenedAgain.Close()
		reopenedAgainCol, err := reopenedAgain.OpenCollection("vamana-wal-tail")
		if err != nil {
			t.Fatal(err)
		}
		points, err = reopenedAgainCol.FetchPoints([]string{"committed", "after-tail"})
		if err != nil || len(points) != 2 {
			t.Fatalf("修复撕裂尾帧后追加的同步记录必须可恢复：%+v，%v", points, err)
		}
	})

	t.Run("checksum corruption", func(t *testing.T) {
		path := t.TempDir()
		col := create(t, path, "vamana-wal-corrupt")
		walPath := filepath.Join(path, "vamana-wal-corrupt", "vamana"+VamanaWALFileExt)
		data, err := os.ReadFile(walPath)
		if err != nil {
			t.Fatal(err)
		}
		data[len(data)-1] ^= 0xff
		if err := os.WriteFile(walPath, data, 0644); err != nil {
			t.Fatal(err)
		}
		if err := col.(*CollectionHandle).db.Close(); err != nil {
			t.Fatal(err)
		}
		if _, err := Open(path); !errors.Is(err, ErrStorageCorrupted) {
			t.Fatalf("DiskVamana 完整 WAL 帧损坏应返回 ErrStorageCorrupted，实际为 %v", err)
		}
	})
}

func TestWriteContractCommitSequenceIsLinearized(t *testing.T) {
	db, err := Open(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	col, err := db.CreateCollectionWithOptions("linearized", CollectionOptions{Engine: EngineHNSW, Dimension: 2})
	if err != nil {
		t.Fatal(err)
	}

	const writerCount = 16
	sequences := make(chan uint64, writerCount)
	errorsCh := make(chan error, writerCount)
	var writers sync.WaitGroup
	for writer := 0; writer < writerCount; writer++ {
		writers.Add(1)
		go func(writer int) {
			defer writers.Done()
			point := Point{ID: string(rune('a' + writer)), Vector: []float32{float32(writer), 1}}
			result, writeErr := col.Write(context.Background(), WriteBatch{Operations: []WriteOperation{{Point: &point}}}, WriteOptions{Durability: DurabilityMemory})
			if writeErr != nil {
				errorsCh <- writeErr
				return
			}
			sequences <- result.CommitSequence
		}(writer)
	}
	writers.Wait()
	close(errorsCh)
	close(sequences)
	for writeErr := range errorsCh {
		t.Fatal(writeErr)
	}

	seen := make(map[uint64]struct{}, writerCount)
	for sequence := range sequences {
		seen[sequence] = struct{}{}
	}
	for sequence := uint64(1); sequence <= writerCount; sequence++ {
		if _, ok := seen[sequence]; !ok {
			t.Fatalf("缺少提交序号 %d：%v", sequence, seen)
		}
	}
	if stats := col.Stats(); stats.Count != writerCount {
		t.Fatalf("并发批次后计数错误：%+v", stats)
	}
}
