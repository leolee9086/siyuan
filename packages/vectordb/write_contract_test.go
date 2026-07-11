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
	col, err := db.CreateCollectionWithOptions("batch", CollectionOptions{Engine: EngineHNSW, Dimension: 2})
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
	if result.Committed || result.CommitSequence != 0 || result.Applied != 1 || !result.IndexHealthy {
		t.Fatalf("同步失败结果不符合回滚后的未提交契约：%+v", result)
	}
	if points, fetchErr := col.FetchPoints([]string{"sync-failed"}); fetchErr != nil || len(points) != 0 {
		t.Fatalf("同步失败后应回滚内存写入：%+v，%v", points, fetchErr)
	}
}

func TestWriteContractCancellationDuringApplyRollsBackBatch(t *testing.T) {
	db, err := Open(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
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
	col, err := db.CreateCollectionWithOptions("sync-reopen", CollectionOptions{Engine: EngineHNSW, Dimension: 2})
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

func TestWriteContractCommitSequenceIsLinearized(t *testing.T) {
	db, err := Open(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
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
