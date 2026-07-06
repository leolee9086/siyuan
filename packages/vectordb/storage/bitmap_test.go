package storage

import (
	"encoding/binary"
	"os"
	"path/filepath"
	"sync"
	"testing"
)

// ============================================================================
// DeletedBitmap 基本操作测试
// ============================================================================

func TestNewDeletedBitmap(t *testing.T) {
	b := NewDeletedBitmap()
	if b == nil {
		t.Fatal("NewDeletedBitmap returned nil")
	}
	if b.CountDeleted() != 0 {
		t.Errorf("initial CountDeleted = %d, want 0", b.CountDeleted())
	}
	if b.IsDirty() {
		t.Error("initial IsDirty should be false")
	}
}

func TestNewDeletedBitmapWithCapacity(t *testing.T) {
	b := NewDeletedBitmapWithCapacity(128)
	if b == nil {
		t.Fatal("NewDeletedBitmapWithCapacity returned nil")
	}
	if b.CountDeleted() != 0 {
		t.Errorf("initial CountDeleted = %d, want 0", b.CountDeleted())
	}
	if b.IsDirty() {
		t.Error("initial IsDirty should be false")
	}
}

func TestMarkDeleted_And_IsDeleted(t *testing.T) {
	b := NewDeletedBitmap()

	b.MarkDeleted(5)
	if !b.IsDeleted(5) {
		t.Error("IsDeleted(5) should be true after MarkDeleted")
	}
	if b.CountDeleted() != 1 {
		t.Errorf("CountDeleted = %d, want 1", b.CountDeleted())
	}

	b.MarkDeleted(5)
	if b.CountDeleted() != 1 {
		t.Errorf("CountDeleted after double mark = %d, want 1", b.CountDeleted())
	}
}

func TestMarkDeleted_Multiple(t *testing.T) {
	b := NewDeletedBitmap()

	ids := []uint64{0, 1, 2, 63, 64, 65, 127, 128, 1000}
	for _, id := range ids {
		b.MarkDeleted(id)
	}

	if b.CountDeleted() != uint64(len(ids)) {
		t.Errorf("CountDeleted = %d, want %d", b.CountDeleted(), len(ids))
	}

	for _, id := range ids {
		if !b.IsDeleted(id) {
			t.Errorf("IsDeleted(%d) should be true", id)
		}
	}

	// 未删除的节点不应被标记
	notDeleted := []uint64{3, 66, 200, 999}
	for _, id := range notDeleted {
		if b.IsDeleted(id) {
			t.Errorf("IsDeleted(%d) should be false (not deleted)", id)
		}
	}
}

func TestIsDeleted_OutOfRange(t *testing.T) {
	b := NewDeletedBitmap()
	// 未扩展的 bitmap 查询越界 ID 应返回 false
	if b.IsDeleted(999999) {
		t.Error("IsDeleted(999999) should be false for uninitialized bitmap")
	}
}

func TestIsDeletedUnsafe(t *testing.T) {
	b := NewDeletedBitmap()
	b.MarkDeleted(42)

	if !b.IsDeletedUnsafe(42) {
		t.Error("IsDeletedUnsafe(42) should be true after MarkDeleted")
	}
	if b.IsDeletedUnsafe(0) {
		t.Error("IsDeletedUnsafe(0) should be false")
	}
	if b.IsDeletedUnsafe(99999) {
		t.Error("IsDeletedUnsafe(99999) should be false for out of range")
	}
}

func TestCountDeleted_Empty(t *testing.T) {
	b := NewDeletedBitmap()
	if count := b.CountDeleted(); count != 0 {
		t.Errorf("CountDeleted on empty bitmap = %d, want 0", count)
	}
}

func TestCountDeleted_LargeRange(t *testing.T) {
	b := NewDeletedBitmap()
	for i := uint64(0); i < 256; i += 2 {
		b.MarkDeleted(i)
	}
	// 0,2,4,...,254 = 128 个
	if count := b.CountDeleted(); count != 128 {
		t.Errorf("CountDeleted = %d, want 128", count)
	}
}

func TestIsDirty_ClearDirty(t *testing.T) {
	b := NewDeletedBitmap()

	if b.IsDirty() {
		t.Error("initial IsDirty should be false")
	}

	b.MarkDeleted(1)
	if !b.IsDirty() {
		t.Error("IsDirty should be true after MarkDeleted")
	}

	b.ClearDirty()
	if b.IsDirty() {
		t.Error("IsDirty should be false after ClearDirty")
	}

	// 再次标记应再次设置 dirty
	b.MarkDeleted(2)
	if !b.IsDirty() {
		t.Error("IsDirty should be true after second MarkDeleted")
	}
}

// ============================================================================
// 自动扩容测试
// ============================================================================

func TestDeletedBitmap_AutoExpand(t *testing.T) {
	b := NewDeletedBitmapWithCapacity(64)

	// 初始容量只有 1 个 uint64 (64 bits)
	b.MarkDeleted(200) // 需要 wordIndex=3，应自动扩容

	if !b.IsDeleted(200) {
		t.Error("IsDeleted(200) should be true after expansion")
	}

	// 验证扩容后低位仍正确
	if b.IsDeleted(0) {
		t.Error("IsDeleted(0) should still be false after expansion")
	}

	// 验证 CountDeleted 正确
	if count := b.CountDeleted(); count != 1 {
		t.Errorf("CountDeleted = %d, want 1", count)
	}
}

func TestDeletedBitmap_ExpandMultipleTimes(t *testing.T) {
	b := NewDeletedBitmap()

	for i := uint64(0); i < 5000; i += 100 {
		b.MarkDeleted(i)
	}

	for i := uint64(0); i < 5000; i += 100 {
		if !b.IsDeleted(i) {
			t.Errorf("IsDeleted(%d) should be true after marking", i)
		}
	}

	if b.IsDeleted(1) {
		t.Error("IsDeleted(1) should be false (not marked)")
	}
}

// ============================================================================
// 持久化测试
// ============================================================================

func TestSaveLoadDeletedBitmap_RoundTrip(t *testing.T) {
	b := NewDeletedBitmap()
	b.MarkDeleted(5)
	b.MarkDeleted(100)
	b.MarkDeleted(1000)
	b.ClearDirty()

	path := filepath.Join(t.TempDir(), "deleted.bin")
	if err := SaveDeletedBitmap(path, b); err != nil {
		t.Fatalf("SaveDeletedBitmap failed: %v", err)
	}

	loaded, err := LoadDeletedBitmap(path)
	if err != nil {
		t.Fatalf("LoadDeletedBitmap failed: %v", err)
	}

	if !loaded.IsDeleted(5) {
		t.Error("loaded IsDeleted(5) should be true")
	}
	if !loaded.IsDeleted(100) {
		t.Error("loaded IsDeleted(100) should be true")
	}
	if !loaded.IsDeleted(1000) {
		t.Error("loaded IsDeleted(1000) should be true")
	}
	if loaded.IsDeleted(6) {
		t.Error("loaded IsDeleted(6) should be false")
	}
	if loadCount := loaded.CountDeleted(); loadCount != 3 {
		t.Errorf("loaded CountDeleted = %d, want 3", loadCount)
	}
	if loaded.IsDirty() {
		t.Error("loaded IsDirty should be false")
	}
}

func TestSaveDeletedBitmap_Empty(t *testing.T) {
	b := NewDeletedBitmap()
	path := filepath.Join(t.TempDir(), "empty_deleted.bin")
	if err := SaveDeletedBitmap(path, b); err != nil {
		t.Fatalf("SaveDeletedBitmap empty failed: %v", err)
	}

	loaded, err := LoadDeletedBitmap(path)
	if err != nil {
		t.Fatalf("LoadDeletedBitmap empty failed: %v", err)
	}
	if loaded.CountDeleted() != 0 {
		t.Errorf("loaded CountDeleted = %d, want 0", loaded.CountDeleted())
	}
}

func TestLoadDeletedBitmap_FileNotFound(t *testing.T) {
	path := filepath.Join(t.TempDir(), "nonexistent.bin")
	loaded, err := LoadDeletedBitmap(path)
	if err != nil {
		t.Fatalf("LoadDeletedBitmap for missing file failed: %v", err)
	}
	if loaded == nil {
		t.Fatal("LoadDeletedBitmap returned nil for missing file")
	}
	if loaded.CountDeleted() != 0 {
		t.Errorf("empty bitmap CountDeleted = %d, want 0", loaded.CountDeleted())
	}
}

func TestLoadDeletedBitmap_InvalidMagic(t *testing.T) {
	path := filepath.Join(t.TempDir(), "invalid_magic.bin")
	data := make([]byte, 20)
	// wrong magic
	binary.LittleEndian.PutUint32(data[0:], 0xDEADBEAF)
	if err := os.WriteFile(path, data, 0644); err != nil {
		t.Fatalf("WriteFile failed: %v", err)
	}

	_, err := LoadDeletedBitmap(path)
	if err != ErrInvalidMagic {
		t.Errorf("Expected ErrInvalidMagic, got %v", err)
	}
}

func TestLoadDeletedBitmap_CorruptedFile(t *testing.T) {
	path := filepath.Join(t.TempDir(), "corrupted.bin")
	// 只写 10 个字节（小于 header 的 16 字节）
	data := make([]byte, 10)
	binary.LittleEndian.PutUint32(data[0:], DeletedBitmapMagic)
	if err := os.WriteFile(path, data, 0644); err != nil {
		t.Fatalf("WriteFile failed: %v", err)
	}

	_, err := LoadDeletedBitmap(path)
	if err != ErrCorruptedFile {
		t.Errorf("Expected ErrCorruptedFile, got %v", err)
	}
}

func TestLoadDeletedBitmap_TruncatedData(t *testing.T) {
	path := filepath.Join(t.TempDir(), "truncated.bin")
	// header 说有 10 个 uint64，但数据不足
	f, err := os.Create(path)
	if err != nil {
		t.Fatalf("Create failed: %v", err)
	}
	binary.Write(f, binary.LittleEndian, DeletedBitmapMagic) // magic
	binary.Write(f, binary.LittleEndian, uint32(1))           // version
	binary.Write(f, binary.LittleEndian, uint64(640))         // bitCount = 10*64
	// 只写 3 个 uint64 而不是 10 个
	for i := 0; i < 3; i++ {
		binary.Write(f, binary.LittleEndian, uint64(0))
	}
	f.Close()

	_, err = LoadDeletedBitmap(path)
	if err != ErrCorruptedFile {
		t.Errorf("Expected ErrCorruptedFile for truncated data, got %v", err)
	}
}

// ============================================================================
// 并发安全测试
// ============================================================================

func TestDeletedBitmap_ConcurrentMarkAndCheck(t *testing.T) {
	b := NewDeletedBitmap()
	var wg sync.WaitGroup

	// 并发标记
	for i := 0; i < 100; i++ {
		wg.Add(1)
		go func(id uint64) {
			defer wg.Done()
			b.MarkDeleted(id)
		}(uint64(i))
	}

	// 并发读取
	for i := 0; i < 100; i++ {
		wg.Add(1)
		go func(id uint64) {
			defer wg.Done()
			b.IsDeleted(uint64(id))
		}(uint64(i))
	}

	wg.Wait()

	// 验证所有标记的节点可查询
	for i := 0; i < 100; i++ {
		if !b.IsDeleted(uint64(i)) {
			t.Errorf("IsDeleted(%d) should be true after concurrent mark", i)
		}
	}

	// 验证 CountDeleted 正确
	if count := b.CountDeleted(); count != 100 {
		t.Errorf("CountDeleted = %d, want 100", count)
	}
}

func TestDeletedBitmap_ConcurrentDirtyCheck(t *testing.T) {
	b := NewDeletedBitmap()
	var wg sync.WaitGroup

	// 并发标记和检查 dirty
	for i := 0; i < 50; i++ {
		wg.Add(1)
		go func(id uint64) {
			defer wg.Done()
			b.MarkDeleted(id)
			b.IsDirty()
		}(uint64(i))
	}

	wg.Wait()
}

// ============================================================================
// 保存/加载并发安全测试
// ============================================================================

func TestDeletedBitmap_SaveWhileMarking(t *testing.T) {
	b := NewDeletedBitmap()
	var wg sync.WaitGroup

	// 后台持续标记
	wg.Add(1)
	go func() {
		defer wg.Done()
		for i := uint64(0); i < 100; i++ {
			b.MarkDeleted(i)
		}
	}()

	// 同时在保存（SaveDeletedBitmap 内部持有 RLock，可以和 MarkDeleted 的 Lock 并发）
	path := filepath.Join(t.TempDir(), "concurrent_save.bin")
	wg.Add(1)
	go func() {
		defer wg.Done()
		_ = SaveDeletedBitmap(path, b)
	}()

	wg.Wait()

	// 保存后在确认的稳定状态加载
	loaded, err := LoadDeletedBitmap(path)
	if err != nil {
		t.Fatalf("LoadDeletedBitmap failed: %v", err)
	}

	// 加载后的数据可能少于 100（因为保存和标记并发），但不应该崩溃
	count := loaded.CountDeleted()
	if count > 100 {
		t.Errorf("Loaded CountDeleted = %d, should be <= 100", count)
	}
	t.Logf("Concurrent save with 100 marks: loaded %d deleted nodes", count)
}
