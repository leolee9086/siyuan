package vectordb

import (
	"context"
	"errors"
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

	originalFlush := flushCollection
	flushCollection = func(*CollectionHandle) error {
		return errors.New("injected sync failure")
	}
	t.Cleanup(func() {
		flushCollection = originalFlush
	})

	result, err := col.Write(context.Background(), WriteBatch{Operations: []WriteOperation{{Point: &Point{ID: "sync-failed", Vector: []float32{2, 0}}}}}, WriteOptions{Durability: DurabilitySync})
	if !errors.Is(err, ErrPersistenceFailed) {
		t.Fatalf("同步失败应返回 ErrPersistenceFailed，实际为 %v", err)
	}
	if result.Committed || result.CommitSequence != 0 || result.Applied != 1 || result.IndexHealthy {
		t.Fatalf("同步失败结果不符合未提交契约：%+v", result)
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
